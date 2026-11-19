/**
 * Typed request context (React Router v8 middleware is on by default, so the
 * load context is a RouterContextProvider, not a plain object).
 */
import { createContext } from 'react-router';

export const cloudflareContext = createContext<{ env: Env; ctx: ExecutionContext }>();

/** CSP nonce for this response's inline hydration scripts (docs/adr/0009). */
export const nonceContext = createContext<string>();
