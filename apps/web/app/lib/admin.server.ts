import type { RouterContextProvider } from 'react-router';
import { cloudflareContext } from '~/context';
import { CAN, currentStaff, type Staff } from '../../server/admin/access';

/** Every admin loader and action starts here: verified identity, then role (SPEC §14). */
export async function requireStaff(
  request: Request,
  context: Readonly<RouterContextProvider>,
  action?: keyof typeof CAN,
) {
  const { env } = context.get(cloudflareContext);
  const staff = await currentStaff(request, env);
  if (!staff) throw new Response('يلزم تسجيل الدخول عبر Cloudflare Access بحساب من فريق التحرير.', { status: 401 });
  if (action && !CAN[action].includes(staff.role))
    throw new Response('هذا الإجراء ليس من صلاحيات دورك.', { status: 403 });
  return { staff, env, db: env.DB.withSession('first-primary') };
}

export type { Staff };
