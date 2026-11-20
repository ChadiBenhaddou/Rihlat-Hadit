#!/usr/bin/env bash
# Load pipeline/out into a REMOTE environment's D1 databases (SPEC §8 step 8).
# Usage: scripts/load-remote.sh preview|production
# Preview first; production only after the preview checks pass. Replaces the
# loaded data tables; never touches staff, reports, proposals or revisions.
set -euo pipefail
ENVNAME="${1:-}"
case "$ENVNAME" in preview) ENVFLAG=(--env preview) ;; production) ENVFLAG=() ;; *) echo "usage: $0 preview|production" >&2; exit 2 ;; esac
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/pipeline/out"
cd "$ROOT/apps/web"
python3 -I -c "import json,sys; r=json.load(open('$OUT/validation-report.json')); sys.exit(1 if r['errors'] else 0)" \
  || { echo "validation report has errors; refusing to load" >&2; exit 1; }
w() { pnpm exec wrangler "$@" --remote "${ENVFLAG[@]}"; }
w d1 migrations apply DB >/dev/null
w d1 migrations apply SEARCH_DB >/dev/null
reset=$(mktemp); trap 'rm -f "$reset"' EXIT
for t in narrator_redirects review_items data_versions transmissions chain_links chains hadith_numbers hadiths hadith_groups chapters books \
         collections gradings narrator_places places narrator_flags narrator_names narrators citations sources; do
  echo "DELETE FROM $t;" >> "$reset"
done
w d1 execute DB --file "$reset" >/dev/null
printf 'DELETE FROM matn_fts;\nDELETE FROM narrator_fts;\n' > "$reset"
w d1 execute SEARCH_DB --file "$reset" >/dev/null
for f in "$OUT"/sql/core-*.sql "$OUT"/sql/review-*.sql; do echo "core   $(basename "$f")"; w d1 execute DB --file "$f" >/dev/null; done
for f in "$OUT"/sql/search-*.sql; do echo "search $(basename "$f")"; w d1 execute SEARCH_DB --file "$f" >/dev/null; done
label=$(python3 -I -c "import sqlite3; print(sqlite3.connect('$OUT/core.sqlite').execute('SELECT label FROM data_versions ORDER BY id DESC LIMIT 1').fetchone()[0])")
pnpm exec wrangler kv key put --binding CONFIG data_version "$label" --remote "${ENVFLAG[@]}" >/dev/null
echo "loaded data version $label into $ENVNAME"
