"""One-off codemod: wrap Arabic UI text in t() and internal links in to() (see app/i18n.ts).

python3 -I scripts/i18n-wrap.py [--dry] FILE...
"""
import json
import re
import sys

AR = r'[؀-ۿ]'
dry = '--dry' in sys.argv
files = [a for a in sys.argv[1:] if not a.startswith('--')]

def q(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

total = 0
for path in files:
    src = open(path, encoding='utf-8').read()
    out = src
    # JSX text between tags (no braces inside): keep surrounding whitespace.
    def text(m):
        raw = m.group(1)
        core = raw.strip()
        if not re.search(AR, core):
            return m.group(0)
        lead = raw[: len(raw) - len(raw.lstrip())]
        trail = raw[len(raw.rstrip()):]
        return '>' + lead + '{t(' + q(re.sub(r'\s+', ' ', core)) + ')}' + trail + '<'
    out, n1 = re.subn(r'>([^<>{}]*' + AR + r'[^<>{}]*)<', text, out)
    # Text that sits between a closing } and a tag, or a tag and an opening {.
    def frag(m):
        core = m.group(2).strip()
        if not core or not re.search(AR, core):
            return m.group(0)
        raw = m.group(2)
        lead = raw[: len(raw) - len(raw.lstrip())]
        trail = raw[len(raw.rstrip()):]
        return m.group(1) + lead + '{t(' + q(re.sub(r'\s+', ' ', core)) + ')}' + trail + m.group(3)
    out, n2 = re.subn(r'(\}|>)([^<>{}\n]*' + AR + r'[^<>{}\n]*?)(\{|<)', frag, out)
    # Attributes.
    out, n3 = re.subn(r'\b(aria-label|placeholder|title)="([^"]*' + AR + r'[^"]*)"', lambda m: m.group(1) + '={t(' + q(m.group(2)) + ')}', out)
    # Internal links.
    out, n4 = re.subn(r'\bto="(/[^"]*)"', lambda m: "to={to(" + q(m.group(1)) + ")}", out)
    out, n5 = re.subn(r'\bto=\{(`/[^`]*`)\}', lambda m: 'to={to(' + m.group(1) + ')}', out)
    total += n1 + n2 + n3 + n4 + n5
    print(f'{path}: text {n1}, fragments {n2}, attrs {n3}, links {n4 + n5}')
    if not dry and out != src:
        if "from '~/i18n'" not in out:
            # after the last import line
            lines = out.split('\n')
            last = max(i for i, l in enumerate(lines) if l.startswith('import ') or l.startswith("} from '"))
            lines.insert(last + 1, "import { useI18n } from '~/i18n';")
            out = '\n'.join(lines)
        # Hook into each component (capitalized function) that now uses t( or to(.
        def add_hook(src2):
            res = []
            pos = 0
            for m in re.finditer(r'\n(export (?:default )?)?function ([A-Z]\w*)\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{', src2):
                start = m.end()
                # find matching brace for body
                depth, i = 1, start
                while depth and i < len(src2):
                    if src2[i] == '{': depth += 1
                    elif src2[i] == '}': depth -= 1
                    i += 1
                body = src2[start:i]
                names = [n for n in ('t', 'to') if re.search(r'(?<![\w.])' + n + r'\(', body)]
                if names and 'useI18n()' not in body:
                    res.append((start, '\n  const { ' + ', '.join(names) + ' } = useI18n();'))
            for at, ins in reversed(res):
                src2 = src2[:at] + ins + src2[at:]
            return src2
        out = add_hook(out)
        open(path, 'w', encoding='utf-8').write(out)
print('total', total)
