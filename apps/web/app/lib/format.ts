/** Display helpers. Western digits by default (SPEC §11). */

/** «ت 144 هـ (نحو 761 م)»: Hijri first, CE as an approximation (CE ≈ 0.97 × AH + 622). */
export function hijri(ah: number | null | undefined, ahMax?: number | null, prefix = ''): string | null {
  if (ah == null) return null;
  const ce = (y: number) => Math.round(0.97 * y + 622);
  const range = ahMax != null && ahMax !== ah;
  const ahText = range ? `${ah}–${ahMax}` : `${ah}`;
  const ceText = range ? `${ce(ah)}–${ce(ahMax!)}` : `${ce(ah)}`;
  return `${prefix}${ahText} هـ (نحو ${ceText} م)`;
}

export const UNAVAILABLE = 'غير متوفر';

export const RELATION_AR: Record<string, string> = {
  born: 'وُلد في',
  lived: 'أقام في',
  travelled: 'رحل إلى',
  died: 'توفي في',
};
export const FLAG_AR: Record<string, string> = { tadlis: 'وُصف بالتدليس', ikhtilat: 'وُصف بالاختلاط' };
export const ROLE_AR: Record<string, string> = {
  prophet: 'النبي ﷺ',
  companion: 'صحابي',
  narrator: 'راوٍ',
  compiler: 'صاحب الكتاب',
  unresolved: 'اسم مبهم',
};
export const TERMINUS_AR: Record<string, string> = {
  prophet: 'ينتهي إلى النبي ﷺ',
  companion: 'ينتهي إلى صحابي',
  successor: 'ينتهي إلى تابعي',
  other: 'ينتهي دون ذلك',
};
