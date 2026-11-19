import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import amiriRegular from '@fontsource/amiri/files/amiri-arabic-400-normal.woff2?url';
import type { Route } from './+types/root';
import { cloudflareContext, nonceContext } from './context';
import './app.css';

export function loader({ context }: Route.LoaderArgs) {
  return { nonce: context.get(nonceContext), turnstileSiteKey: context.get(cloudflareContext).env.TURNSTILE_SITE_KEY };
}

/** Preload the hadith font (SPEC §11): the matn is the page's main content. */
export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'preload', href: amiriRegular, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useRouteLoaderData<typeof loader>('root')?.nonce;
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <Meta />
        <Links />
      </head>
      <body>
        <a href="#main" className="skip-link">
          تخطَّ إلى المحتوى
        </a>
        <header className="border-b border-hairline bg-surface">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <a href="/" className="font-ui text-lg font-semibold text-ink">
              رحلة الحديث <span className="text-sm font-normal text-ink-muted">في صحيح البخاري</span>
            </a>
            <nav aria-label="الأقسام" className="flex flex-wrap gap-4 text-sm">
              <a className="hover:underline" href="/bukhari">
                الكتب
              </a>
              <a className="hover:underline" href="/search">
                البحث
              </a>
              <a className="hover:underline" href="/methodology">
                المنهجية
              </a>
              <a className="hover:underline" href="/sources">
                المصادر
              </a>
            </nav>
          </div>
        </header>
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = 'حدث خطأ';
  let details = 'تعذّر عرض هذه الصفحة.';
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'الصفحة غير موجودة';
      details = 'لم نجد الصفحة المطلوبة.';
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main id="main" className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-ink-muted">{details}</p>
      {stack && (
        <pre dir="ltr" lang="en" className="mt-4 overflow-x-auto rounded bg-surface p-4 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
