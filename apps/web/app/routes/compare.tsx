/**
 * المقارنة بين الروايات (SPEC §12 هـ): two matns diffed word by word, original
 * text with tashkeel shown; additions underlined, omissions struck through,
 * changed words both (never colour alone). Chains side by side, aligned on
 * their shared narrators. Every entry links to its source.
 */
import { alignChains, type GraphNode, type HadithResponse } from '@isnad/shared';
import { Link, useSearchParams } from 'react-router';
import { Cite } from '~/components/Cite';
import { labelOf } from '~/graph/IsnadGraphView';
import { dataContext, notFound } from '~/lib/data.server';
import { getCompare } from '../../server/data/compare';
import type { Route } from './+types/compare';

export async function loader({ params, context }: Route.LoaderArgs) {
  const a = Number(params.a);
  const b = Number(params.b);
  if (![a, b].every((n) => Number.isInteger(n) && n > 0 && n < 100000)) notFound();
  const { db, dataVersion } = await dataContext(context);
  const cmp = await getCompare(db, ['bukhari', a], ['bukhari', b], dataVersion);
  if (!cmp) notFound('أحد الموضعين غير موجود في البيانات المحمّلة');
  return { cmp };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [
    { title: data ? `مقارنة صحيح البخاري ${data.cmp.a.number} و${data.cmp.b.number} | رحلة الحديث` : 'غير موجود' },
  ];
}

function Chain({ h, routeId }: { h: HadithResponse; routeId: number | undefined }) {
  const c = h.graph.chains.find((x) => x.id === routeId) ?? h.graph.chains[0];
  return c;
}

export default function Compare({ loaderData }: Route.ComponentProps) {
  const { a, b, diff } = loaderData.cmp;
  const [params, setParams] = useSearchParams();
  const ca = Chain({ h: a, routeId: Number(params.get('ra')) || undefined });
  const cb = Chain({ h: b, routeId: Number(params.get('rb')) || undefined });
  const nodeA = new Map(a.graph.nodes.map((n) => [n.id, n]));
  const nodeB = new Map(b.graph.nodes.map((n) => [n.id, n]));
  const rows = ca && cb ? alignChains([...ca.nodeIds].reverse(), [...cb.nodeIds].reverse(), (id) => id) : [];
  const pick = (k: 'ra' | 'rb', v: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.set(k, v);
        return n;
      },
      { replace: true, preventScrollReset: true },
    );
  const cell = (id: string | null, nodes: Map<string, GraphNode>) => {
    if (!id) return <span className="text-ink-muted">—</span>;
    const n = nodes.get(id)!;
    return n.slug ? (
      <Link className="link" to={`/narrator/${n.slug}`}>
        {labelOf(n)}
      </Link>
    ) : (
      labelOf(n)
    );
  };
  const counts = { added: 0, omitted: 0, changed: 0 };
  for (const d of diff) if (d.op !== 'same') counts[d.op]++;

  return (
    <main id="main" className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">
        المقارنة بين روايتين: {a.number} و{b.number}
      </h1>
      <p className="text-sm text-ink-muted">
        الفروق على الألفاظ بعد تجاهل التشكيل وصور الهمز، والنص المعروض كما في مصدره. زيادات: {counts.added} · نقص:{' '}
        {counts.omitted} · تغيّر: {counts.changed}
      </p>

      <section className="grid gap-4 md:grid-cols-2">
        {(
          [
            [a, 'a'],
            [b, 'b'],
          ] as const
        ).map(([h, side]) => (
          <article key={side} className="pane space-y-2">
            <h2 className="font-semibold">
              <Link className="link" to={`/bukhari/${h.number}`}>
                صحيح البخاري {h.number}
              </Link>{' '}
              <Cite ids={[h.citationId]} citations={h.graph.citations} sources={h.sources} />
            </h2>
            {h.chapter && <p className="text-sm text-ink-muted">{h.chapter.titleAr}</p>}
            <p className="hadith-text">
              {diff.map((d, i) => {
                if (side === 'a') {
                  if (d.op === 'same') return <span key={i}>{d.a} </span>;
                  if (d.op === 'omitted')
                    return (
                      <del key={i} className="diff-del" title="ليس في الرواية الأخرى">
                        {d.a}{' '}
                      </del>
                    );
                  if (d.op === 'changed')
                    return (
                      <del key={i} className="diff-chg" title={`في الأخرى: ${d.b}`}>
                        {d.a}{' '}
                      </del>
                    );
                  return null;
                }
                if (d.op === 'same') return <span key={i}>{d.b} </span>;
                if (d.op === 'added')
                  return (
                    <ins key={i} className="diff-add" title="ليس في الرواية الأخرى">
                      {d.b}{' '}
                    </ins>
                  );
                if (d.op === 'changed')
                  return (
                    <ins key={i} className="diff-chg" title={`في الأخرى: ${d.a}`}>
                      {d.b}{' '}
                    </ins>
                  );
                return null;
              })}
            </p>
          </article>
        ))}
      </section>
      <p className="text-xs text-ink-muted">
        <ins className="diff-add">مسطّر</ins>: زيادة في هذه الرواية · <del className="diff-del">مشطوب</del>: ليس في
        الأخرى · المسطّر أو المشطوب المنقّط: لفظ تغيّر.
      </p>

      <section className="pane space-y-3" aria-labelledby="chains-title">
        <h2 id="chains-title" className="font-semibold">
          الإسنادان جنبًا إلى جنب، من المصدر إلى البخاري
        </h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              [a, 'ra', ca],
              [b, 'rb', cb],
            ] as const
          ).map(([h, k, c]) =>
            h.graph.chains.length > 1 ? (
              <label key={k}>
                <span className="me-1">طريق {h.number}</span>
                <select className="select" value={c?.id} onChange={(e) => pick(k, e.target.value)}>
                  {h.graph.chains.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.routeNo}
                      {x.isSuspended ? ' (معلّق)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : null,
          )}
        </div>
        {rows.length === 0 ? (
          <p className="text-ink-muted">لا إسناد مستخرج لأحد الموضعين.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th className="text-start font-normal">رقم {a.number}</th>
                <th className="text-start font-normal">رقم {b.number}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([x, y], i) => (
                <tr key={i} className={x && y ? 'chain-shared' : ''}>
                  <td className="py-1">{cell(x, nodeA)}</td>
                  <td className="py-1">{cell(y, nodeB)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-ink-muted">الصف المظلَّل راوٍ مشترك بين الطريقين.</p>
      </section>
    </main>
  );
}
