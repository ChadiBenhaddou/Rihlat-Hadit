import { diffWords, type CompareResponse } from '@isnad/shared';
import type { Db } from '../db';
import { getHadith } from './hadith';

/** Two entries and their matn diff (SPEC §12 هـ). Two D1 batches. */
export async function getCompare(db: Db, a: [string, number], b: [string, number], dataVersion: string): Promise<CompareResponse | null> {
  const [ha, hb] = await Promise.all([getHadith(db, a[0], a[1], dataVersion), getHadith(db, b[0], b[1], dataVersion)]);
  if (!ha || !hb) return null;
  return { dataVersion, a: ha, b: hb, diff: diffWords(ha.matnAr ?? ha.textAr, hb.matnAr ?? hb.textAr) };
}
