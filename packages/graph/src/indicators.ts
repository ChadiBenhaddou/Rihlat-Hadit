/**
 * Research indicators (SPEC §13). Never verdicts: each states its inputs,
 * a one-sentence formula and its scope. No combined score exists, and no
 * authenticity grade is computed anywhere.
 */
import type { Indicator, IsnadGraph } from '@isnad/shared';

const SCOPE = 'ضمن صحيح البخاري كما هو محمَّل هنا';

export function computeIndicators(g: IsnadGraph): Indicator[] {
  const out: Indicator[] = [];
  if (g.chains.length === 0) return out;
  const nameOf = new Map(g.nodes.map((n) => [n.id, n.nameAr]));

  // طول الإسناد: narrators strictly between the compiler and the Prophet ﷺ, per route.
  const lengths = g.chains.map((c) => {
    const between = c.nodeIds.slice(1).filter((id) => g.nodes.find((n) => n.id === id)?.role !== 'prophet');
    return { chain: c, length: between.length };
  });
  // Suspended routes skip narrators, so they are not compared for length.
  const connected = lengths.filter((l) => !l.chain.isSuspended);
  const measured = connected.length ? connected : lengths;
  const shortest = Math.min(...measured.map((l) => l.length));
  out.push({
    key: 'chain_length',
    labelAr: 'طول الإسناد',
    formulaAr: 'عدد الرواة بين البخاري والنبي ﷺ (أو آخر راوٍ مذكور) في كل طريق.',
    scopeAr: SCOPE,
    inputs: lengths.map((l) => ({
      labelAr: `الطريق ${l.chain.routeNo}${g.chains.some((c) => c.hadithNumber !== l.chain.hadithNumber) ? ` (رقم ${l.chain.hadithNumber})` : ''}${l.chain.isSuspended ? ' — معلّق، لا يُقارَن' : ''}`,
      value: String(l.length),
      citationIds: [],
    })),
    valueAr:
      g.chains.every((c) => c.terminus === 'prophet') && shortest === 3
        ? `${shortest} — من الثلاثيات`
        : `أقصر طريق${connected.length ? ' متصل' : ''}: ${shortest}`,
  });

  // الانقطاع: links of kind suspended or gap, and unresolved mentions.
  const broken = g.edges.filter((e) => e.kind === 'suspended' || e.kind === 'gap');
  const unresolved = g.nodes.filter((n) => n.role === 'unresolved');
  out.push({
    key: 'gaps',
    labelAr: 'الانقطاع والتعليق',
    formulaAr: 'الروابط المعلّقة أو المنقطعة، والأسماء المبهمة غير المحدَّدة، كما في البيانات.',
    scopeAr: SCOPE,
    inputs: [
      ...broken.map((e) => ({
        labelAr: `${e.kind === 'suspended' ? 'تعليق' : 'انقطاع'}: ${nameOf.get(e.from) ?? ''} ← ${nameOf.get(e.to) ?? ''}`,
        value: null,
        citationIds: [],
      })),
      ...unresolved.map((n) => ({ labelAr: `اسم مبهم: ${n.nameAr}`, value: null, citationIds: [] })),
    ],
    valueAr:
      broken.length + unresolved.length === 0
        ? 'لا انقطاع ظاهر في الطرق المحمّلة'
        : `${broken.length + unresolved.length}`,
    nodeIds: unresolved.map((n) => n.id),
  });

  // المدار: the shared narrator nearest al-Bukhari through whom every route passes.
  if (g.chains.length >= 2) {
    const sets = g.chains.map((c) => new Set(c.nodeIds.slice(1)));
    const depth = new Map<string, number>();
    for (const c of g.chains) c.nodeIds.forEach((id, i) => depth.set(id, Math.min(depth.get(id) ?? 99, i)));
    const common = [...sets[0]!].filter((id) => sets.every((s) => s.has(id)) && !id.startsWith('u:'));
    common.sort((a, b) => (depth.get(a) ?? 99) - (depth.get(b) ?? 99));
    const madar = common.find((id) => g.nodes.find((n) => n.id === id)?.role !== 'prophet');
    out.push({
      key: 'common_link',
      labelAr: 'المدار',
      formulaAr: 'أقرب راوٍ إلى البخاري تمرّ به جميع الطرق المعروضة.',
      scopeAr: SCOPE,
      inputs: [{ labelAr: 'عدد الطرق', value: String(g.chains.length), citationIds: [] }],
      valueAr: madar ? (nameOf.get(madar) ?? '') : 'لا مدار مشترك',
      ...(madar ? { nodeIds: [madar] } : {}),
    });

    // عدد الرواة في كل طبقة: distinct narrators per layer counted from the source (the Prophet ﷺ = 0).
    const layers: Set<string>[] = [];
    for (const c of g.chains) {
      const fromSource = [...c.nodeIds].reverse();
      fromSource.forEach((id, i) => (layers[i] ??= new Set()).add(id));
    }
    out.push({
      key: 'layer_counts',
      labelAr: 'عدد الرواة في كل طبقة',
      formulaAr: 'عدد الرواة المختلفين في كل طبقة عبر الطرق، بدءًا من المصدر.',
      scopeAr: SCOPE,
      inputs: layers.map((s, i) => ({ labelAr: `الطبقة ${i}`, value: String(s.size), citationIds: [] })),
      valueAr: layers.map((s) => s.size).join('، '),
    });
  }
  return out;
}
