/**
 * Arabic-first UI with an English mirror under /en (SPEC §11). Strings are keyed
 * by their Arabic text, so code stays readable and a missing English entry falls
 * back to Arabic. Source text (hadith, narrator names, critics' words) is never
 * translated or transliterated: it is shown as the source gives it.
 */
import { useLocation } from 'react-router';
import { EN } from './i18n.en';

export type Locale = 'ar' | 'en';

export function localeOf(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'ar';
}

export function translate(locale: Locale, ar: string | undefined, vars?: Record<string, string | number>): string {
  if (ar == null) return '';
  let s = locale === 'en' ? (EN[ar] ?? ar) : ar;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Path in the current locale: '/bukhari/1' → '/en/bukhari/1' on English pages. */
export function localize(locale: Locale, path: string): string {
  return locale === 'en' ? (path === '/' ? '/en' : `/en${path}`) : path;
}

/** Path without the /en prefix (for language switching and hreflang). */
export function basePath(pathname: string): string {
  return localeOf(pathname) === 'en' ? pathname.replace(/^\/en/, '') || '/' : pathname;
}

export function useI18n() {
  const { pathname } = useLocation();
  const locale = localeOf(pathname);
  return {
    locale,
    dir: locale === 'ar' ? ('rtl' as const) : ('ltr' as const),
    t: (ar: string | undefined, vars?: Record<string, string | number>) => translate(locale, ar, vars),
    to: (path: string) => localize(locale, path),
  };
}

/** English for the research indicators, which the server computes in Arabic (SPEC §13). */
export const INDICATOR_EN: Record<string, { label: string; formula: string }> = {
  chain_length: {
    label: 'Chain length',
    formula: 'Narrators between al-Bukhari and the Prophet ﷺ (or the last named narrator) in each route.',
  },
  gaps: {
    label: 'Breaks and suspensions',
    formula: 'Suspended or broken links, and unnamed narrators not identified, as in the data.',
  },
  common_link: {
    label: 'Common link (madār)',
    formula: 'The narrator nearest al-Bukhari through whom every shown route passes.',
  },
  layer_counts: {
    label: 'Narrators per layer',
    formula: 'Distinct narrators in each layer across the routes, counting from the source.',
  },
  contemporaneity: {
    label: 'Contemporaneity',
    formula: 'The teacher’s death year minus the student’s birth year, when the source gives both.',
  },
  shared_places: {
    label: 'Shared places',
    formula: 'Cities recorded for both teacher and student (residence or death). A missing city proves nothing.',
  },
};
export const INDICATOR_SCOPE_EN = 'within Sahih al-Bukhari as loaded here';

const VALUE_EN: [RegExp, string][] = [
  [/أقصر طريق متصل/g, 'Shortest connected route'],
  [/أقصر طريق/g, 'Shortest route'],
  [/من الثلاثيات/g, 'a thulāthī (three-narrator) chain'],
  [/لا انقطاع ظاهر في الطرق المحمّلة/g, 'No apparent break in the loaded routes'],
  [/لا تداخل ظاهر بحسب التواريخ المتاحة/g, 'no apparent overlap by the available dates'],
  [/تداخل نحو (\d+) سنة/g, 'overlap of about $1 years'],
  [/لا تداخل ظاهر/g, 'no apparent overlap'],
  [/تداخل ظاهر/g, 'apparent overlap'],
  [/غير متوفر/g, 'not available'],
  [/روابط ببلد مشترك مسجّل: (\d+) من (\d+)/g, 'Links with a recorded shared city: $1 of $2'],
  [/لا بلد مشترك مسجّل/g, 'no shared city recorded'],
  [/لا مدار مشترك/g, 'No common link'],
  [/ — معلّق، لا يُقارَن/g, ' — suspended, not compared'],
  [/\(رقم (\d+)\)/g, '(no. $1)'],
  [/الطريق (\d+)/g, 'Route $1'],
  [/عدد الطرق/g, 'Number of routes'],
  [/الطبقة (\d+)/g, 'Layer $1'],
  [/^تعليق: /g, 'Suspension: '],
  [/^انقطاع: /g, 'Break: '],
  [/^اسم مبهم: /g, 'Unnamed: '],
  [/، /g, ', '],
];

/** Indicator values in English; names of narrators and cities stay as the source gives them. */
export function translateIndicator(locale: Locale, text: string): string {
  if (locale === 'ar') return text;
  return VALUE_EN.reduce((s, [re, en]) => s.replace(re, en), text);
}
