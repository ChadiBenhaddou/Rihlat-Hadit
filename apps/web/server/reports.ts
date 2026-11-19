/**
 * «الإبلاغ عن خطأ» (SPEC §10, §14): a Turnstile token verified on the server,
 * per-IP rate limiting, a capped message, no account. Messages and contact
 * addresses are never logged.
 */
import { z } from 'zod';

export const ReportInput = z.object({
  entity: z.enum(['hadith', 'narrator']),
  entityId: z.number().int().positive(),
  message: z.string().trim().min(10).max(2000),
  contact: z
    .string()
    .trim()
    .email()
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  turnstileToken: z.string().min(1).max(2048),
});
export type ReportInput = z.infer<typeof ReportInput>;

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(secret: string | undefined, token: string, ip: string | null): Promise<boolean> {
  if (!secret) return false;
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  const res = await fetch(SITEVERIFY, { method: 'POST', body });
  if (!res.ok) return false;
  const out = (await res.json()) as { success?: boolean };
  return out.success === true;
}
