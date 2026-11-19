/** Every UI string has an English entry, and locale helpers behave (SPEC §11). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EN } from '../../app/i18n.en';
import { basePath, localeOf, localize, translate, translateIndicator } from '../../app/i18n';

const APP = fileURLToPath(new URL('../../app', import.meta.url));
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'admin' ? [] : files(p); // the editorial tools are Arabic-only
    return /\.tsx?$/.test(f) && !f.startsWith('i18n') ? [p] : [];
  });
}

describe('English UI coverage', () => {
  it('has an entry for every Arabic string passed to t() or translate()', () => {
    const missing: string[] = [];
    for (const f of files(APP)) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/(?:\bt|translate\([^,]+,)\s*\(?\s*'((?:[^'\\]|\\.)*)'/g)) {
        const key = m[1]!;
        if (/[؀-ۿ]/.test(key) && !(key in EN)) missing.push(`${f.replace(APP, 'app')}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe('locale helpers', () => {
  it('derives the locale and paths from the URL', () => {
    expect(localeOf('/en/bukhari/1')).toBe('en');
    expect(localeOf('/english')).toBe('ar');
    expect(localize('en', '/')).toBe('/en');
    expect(localize('en', '/bukhari')).toBe('/en/bukhari');
    expect(basePath('/en/bukhari/1')).toBe('/bukhari/1');
    expect(basePath('/en')).toBe('/');
  });
  it('fills placeholders and falls back to Arabic', () => {
    expect(translate('en', 'صحيح البخاري {n}', { n: 7 })).toBe('Sahih al-Bukhari 7');
    expect(translate('ar', 'صحيح البخاري {n}', { n: 7 })).toBe('صحيح البخاري 7');
    expect(translate('en', 'نص بلا ترجمة')).toBe('نص بلا ترجمة');
    expect(translate('en', undefined)).toBe('');
  });
  it('translates indicator values but keeps source names', () => {
    expect(translateIndicator('en', 'روابط ببلد مشترك مسجّل: 2 من 7')).toBe('Links with a recorded shared city: 2 of 7');
    expect(translateIndicator('en', 'تعليق: هلال ← البخاري')).toBe('Suspension: هلال ← البخاري');
  });
});
