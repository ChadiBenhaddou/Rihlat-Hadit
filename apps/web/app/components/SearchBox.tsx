import { Form } from 'react-router';

export function SearchBox({
  defaultValue = '',
  type = 'hadith',
  autoFocus = false,
}: {
  defaultValue?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <Form method="get" action="/search" role="search" className="flex gap-2">
      <input type="hidden" name="type" value={type} />
      <label className="sr-only" htmlFor="q">
        ابحث بنص الحديث أو رقمه أو اسم الراوي
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        required
        maxLength={200}
        placeholder="ابحث بنص الحديث أو رقمه، مثل: إنما الأعمال بالنيات"
        className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base"
      />
      <button type="submit" className="btn-primary">
        بحث
      </button>
    </Form>
  );
}
