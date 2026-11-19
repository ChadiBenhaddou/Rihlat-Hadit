/**
 * The hadith text exactly as in its source, with tashkeel. Narrator mentions
 * are tied to graph nodes through their stored offsets (SPEC §11): hovering or
 * focusing a name highlights its node, and the reverse.
 */
interface Mention {
  start: number;
  end: number;
  nodeId: string;
}

export function HadithText({
  text,
  isnadLength,
  mentions,
  hoverId,
  onHover,
  onSelect,
}: {
  text: string;
  isnadLength: number | null;
  mentions: Mention[];
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const split = isnadLength ?? 0;
  const render = (from: number, to: number) => {
    const out: React.ReactNode[] = [];
    let cursor = from;
    for (const m of mentions) {
      if (m.end <= from || m.start >= to) continue;
      const s = Math.max(m.start, from);
      if (s > cursor) out.push(text.slice(cursor, s));
      const e = Math.min(m.end, to);
      out.push(
        <span
          key={`${m.start}-${m.end}`}
          role="button"
          tabIndex={0}
          className={`mention${hoverId === m.nodeId ? ' mention-hot' : ''}`}
          onMouseEnter={() => onHover(m.nodeId)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(m.nodeId)}
          onBlur={() => onHover(null)}
          onClick={() => onSelect(m.nodeId)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') onSelect(m.nodeId);
          }}
        >
          {text.slice(s, e)}
        </span>,
      );
      cursor = e;
    }
    if (cursor < to) out.push(text.slice(cursor, to));
    return out;
  };
  return (
    <div className="hadith-text">
      {split > 0 && <p className="isnad-text">{render(0, split)}</p>}
      <p className="matn-text">{render(split, text.length)}</p>
    </div>
  );
}
