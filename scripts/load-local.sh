#!/usr/bin/env bash
# Load pipeline/out into the LOCAL D1 databases (wrangler dev / vite dev).
# Local only: there is no --remote here by design. Remote loads go to a fresh
# preview database first (SPEC §8 step 8) and need the account owner.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/pipeline/out"
cd "$ROOT/apps/web"
[ -f "$OUT/validation-report.json" ] || { echo "run the pipeline build first" >&2; exit 1; }
python3 -I -c "import json,sys; r=json.load(open('$OUT/validation-report.json')); sys.exit(1 if r['errors'] else 0)" \
  || { echo "validation report has errors; refusing to load" >&2; exit 1; }

w() { pnpm exec wrangler "$@" --local; }
w d1 migrations apply DB >/dev/null
w d1 migrations apply SEARCH_DB >/dev/null

reset=$(mktemp)
trap 'rm -f "$reset"' EXIT
for t in data_versions transmissions chain_links chains hadith_numbers hadiths hadith_groups chapters books \
         collections gradings narrator_places places narrator_flags narrator_names narrators citations sources; do
  echo "DELETE FROM $t;" >> "$reset"
done
w d1 execute DB --file "$reset" >/dev/null
printf 'DELETE FROM matn_fts;\nDELETE FROM narrator_fts;\n' > "$reset"
w d1 execute SEARCH_DB --file "$reset" >/dev/null

for f in "$OUT"/sql/core-*.sql; do echo "core   $(basename "$f")"; w d1 execute DB --file "$f" >/dev/null; done
for f in "$OUT"/sql/search-*.sql; do echo "search $(basename "$f")"; w d1 execute SEARCH_DB --file "$f" >/dev/null; done

label=$(python3 -I -c "import sqlite3; print(sqlite3.connect('$OUT/core.sqlite').execute('SELECT label FROM data_versions ORDER BY id DESC LIMIT 1').fetchone()[0])")
w kv key put --binding CONFIG data_version "$label" >/dev/null
echo "loaded data version $label"
