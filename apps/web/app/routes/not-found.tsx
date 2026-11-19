import { Link } from 'react-router';

export function loader() {
  throw new Response('غير موجود', { status: 404 });
}

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">الصفحة غير موجودة</h1>
      <Link className="link" to="/">
        العودة إلى الرئيسية
      </Link>
    </main>
  );
}
