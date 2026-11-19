import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ProblemDetails } from '@isnad/shared';

/** RFC 9457 problem details. */
export function problem(c: Context, status: ContentfulStatusCode, title: string, detail?: string): Response {
  const body: ProblemDetails = { type: 'about:blank', title, status, instance: new URL(c.req.url).pathname };
  if (detail) body.detail = detail;
  return c.body(JSON.stringify(body), status, { 'Content-Type': 'application/problem+json' });
}
