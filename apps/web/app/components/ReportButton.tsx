import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';
import { useRouteLoaderData } from 'react-router';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (t: string) => void; 'expired-callback'?: () => void; language?: string },
      ) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile'));
    document.head.appendChild(s);
  });
}

/** «الإبلاغ عن خطأ»: no account; Turnstile is loaded only when the dialog opens. */
export function ReportButton({
  entity,
  entityId,
  label,
}: {
  entity: 'hadith' | 'narrator';
  entityId: number;
  label: string;
}) {
  const root = useRouteLoaderData('root') as { turnstileSiteKey?: string } | undefined;
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !root?.turnstileSiteKey) return;
    let live = true;
    loadTurnstile()
      .then(() => {
        if (!live || !widget.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(widget.current, {
          sitekey: root.turnstileSiteKey!,
          callback: setToken,
          'expired-callback': () => setToken(null),
          language: 'ar',
        });
      })
      .catch(() => live && setError('تعذّر تحميل التحقق من أنك لست برنامجًا آليًا.'));
    return () => {
      live = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
      setToken(null);
    };
  }, [open, root?.turnstileSiteKey]);

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setState('sending');
    setError('');
    const res = await fetch('/api/v1/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity,
        entityId,
        message: String(data.get('message') ?? ''),
        contact: String(data.get('contact') ?? ''),
        turnstileToken: token ?? '',
      }),
    }).catch(() => null);
    if (res?.status === 201) setState('sent');
    else {
      setState('error');
      setError(
        res?.status === 429
          ? 'بلاغات كثيرة من هذا الجهاز، حاول بعد دقيقة.'
          : 'تعذّر إرسال البلاغ. تأكد من كتابة عشرة أحرف على الأقل.',
      );
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setState('idle');
      }}
    >
      <Dialog.Trigger className="btn text-sm">الإبلاغ عن خطأ</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content className="dialog" aria-describedby="report-desc">
          <Dialog.Title className="text-lg font-semibold">الإبلاغ عن خطأ</Dialog.Title>
          <p id="report-desc" className="text-sm text-ink-muted">
            {label}. يصل البلاغ إلى قائمة المراجعة، ولا يُعدَّل شيء إلا بمراجعة محرر.
          </p>
          {state === 'sent' ? (
            <p role="status" className="mt-4">
              شكرًا لك، وصل البلاغ.
            </p>
          ) : (
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget);
              }}
            >
              <label className="block text-sm">
                ما الخطأ؟ اذكر المصدر إن أمكن.
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-line bg-surface p-2"
                />
              </label>
              <label className="block text-sm">
                بريدك للتواصل (اختياري)
                <input
                  name="contact"
                  type="email"
                  maxLength={200}
                  dir="ltr"
                  className="mt-1 w-full rounded-md border border-line bg-surface p-2"
                />
              </label>
              <div ref={widget} />
              {error && (
                <p role="alert" className="text-sm">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button type="submit" className="btn-primary" disabled={!token || state === 'sending'}>
                  {state === 'sending' ? 'جارٍ الإرسال…' : 'إرسال'}
                </button>
                <Dialog.Close className="btn">إلغاء</Dialog.Close>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
