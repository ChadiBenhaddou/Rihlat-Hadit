/**
 * Staff authentication (SPEC §14). /admin sits behind a Cloudflare Access
 * application, and the Worker verifies the Cf-Access-Jwt-Assertion again on
 * every request: RS256 signature against the team's public keys, audience,
 * issuer and expiry. Then the `staff` table supplies the role.
 *
 * Local development has no Access in front of it, so DEV builds (and only
 * DEV builds) accept DEV_ADMIN_EMAIL from .dev.vars instead.
 */
export type Role = 'editor' | 'reviewer' | 'admin';
export interface Staff {
  email: string;
  role: Role;
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

const keyCache = new Map<string, { keys: Map<string, CryptoKey>; at: number }>();
const KEY_TTL_MS = 10 * 60_000;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function teamKeys(teamDomain: string, fetcher: typeof fetch = fetch): Promise<Map<string, CryptoKey>> {
  const hit = keyCache.get(teamDomain);
  if (hit && Date.now() - hit.at < KEY_TTL_MS) return hit.keys;
  const res = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`certs ${res.status}`);
  const { keys } = (await res.json()) as { keys: Jwk[] };
  const out = new Map<string, CryptoKey>();
  for (const k of keys) {
    if (k.kty !== 'RSA') continue;
    out.set(
      k.kid,
      await crypto.subtle.importKey(
        'jwk',
        { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256', ext: true },
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      ),
    );
  }
  keyCache.set(teamDomain, { keys: out, at: Date.now() });
  return out;
}

/** The verified email from an Access JWT, or null. */
export async function verifyAccessJwt(
  token: string,
  opts: { teamDomain: string; aud: string; now?: number; fetcher?: typeof fetch },
): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, sig] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let payload: { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string };
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;
  const key = (await teamKeys(opts.teamDomain, opts.fetcher)).get(header.kid);
  if (!key) return null;
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(sig),
    new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) return null;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(opts.aud)) return null;
  if (payload.iss !== `https://${opts.teamDomain}`) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 60) return null;
  return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
}

/** The signed-in staff member, or null. Never trusts a header without verifying it. */
export async function currentStaff(request: Request, env: Env): Promise<Staff | null> {
  let email: string | null = null;
  const devEmail = (env as Env & { DEV_ADMIN_EMAIL?: string }).DEV_ADMIN_EMAIL;
  if (import.meta.env.DEV && devEmail) {
    email = devEmail.toLowerCase();
  } else {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || !env.ACCESS_AUD || env.ACCESS_TEAM_DOMAIN.startsWith('<')) return null;
    email = await verifyAccessJwt(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD });
  }
  if (!email) return null;
  const row = await env.DB.withSession('first-primary')
    .prepare('SELECT email, role FROM staff WHERE email = ?')
    .bind(email)
    .first<Staff>();
  return row ?? null;
}

export const CAN: Record<'propose' | 'decide' | 'publish' | 'manage_staff', Role[]> = {
  propose: ['editor', 'reviewer', 'admin'],
  decide: ['reviewer', 'admin'],
  publish: ['admin'],
  manage_staff: ['admin'],
};
