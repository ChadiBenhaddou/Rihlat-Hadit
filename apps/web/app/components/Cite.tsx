import * as Popover from '@radix-ui/react-popover';
import type { Citation, SourceInfo } from '@isnad/shared';

/** A citation marker that opens the source, edition, locator and licence (SPEC §11: every fact has a popover). */
export function Cite({
  ids,
  citations,
  sources,
}: {
  ids: (number | null | undefined)[];
  citations: Citation[];
  sources: SourceInfo[];
}) {
  const list = ids.flatMap((id) => citations.filter((c) => c.id === id));
  if (list.length === 0) return null;
  const bySlug = new Map(sources.map((s) => [s.slug, s]));
  return (
    <Popover.Root>
      <Popover.Trigger className="cite-trigger" aria-label="المصدر">
        [م]
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover" sideOffset={6} collisionPadding={12}>
          <ul className="space-y-3">
            {list.map((c) => {
              const s = bySlug.get(c.sourceSlug);
              return (
                <li key={c.id} className="text-sm leading-relaxed">
                  <div className="font-semibold">{s?.titleAr ?? c.sourceSlug}</div>
                  {s?.edition && <div className="text-ink-muted">{s.edition}</div>}
                  {c.locator && (
                    <div className="text-ink-muted">
                      الموضع:{' '}
                      <span dir="ltr" lang="en">
                        {c.locator}
                      </span>
                    </div>
                  )}
                  {s && (
                    <div className="text-ink-muted">
                      الترخيص:{' '}
                      <span dir="ltr" lang="en">
                        {s.license}
                      </span>
                      {s.kind === 'dataset' && ' · مصدر ثانوي'}
                    </div>
                  )}
                  {(c.url ?? s?.url) && (
                    <a className="link" href={(c.url ?? s?.url)!} rel="noopener noreferrer" target="_blank">
                      رابط المصدر
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <Popover.Arrow className="fill-[var(--color-surface)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
