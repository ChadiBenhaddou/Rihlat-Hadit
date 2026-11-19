import { Link } from 'react-router';
import { SearchBox } from '~/components/SearchBox';
import type { Route } from './+types/home';

export function meta(_: Route.MetaArgs) {
  return [
    { title: 'رحلة الحديث في صحيح البخاري' },
    { name: 'description', content: 'منصة بحثية تعرض أسانيد صحيح البخاري مخططًا تفاعليًا موثَّقًا: تتبّع الإسناد راويًا راويًا، واستكشف طرق الحديث ورواته.' },
  ];
}

export default function Home() {
  return (
    <main id="main" className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">رحلة الحديث في صحيح البخاري</h1>
        <p className="text-lg leading-loose text-ink-muted">
          اقرأ الإسناد مخططًا: شاهِد الحديث ينتقل من النبي ﷺ إلى الصحابي فالتابعين فمن بعدهم حتى البخاري، مع صيغة الأداء في كل رابط، ومصدر
          كل معلومة وحالة مراجعتها.
        </p>
        <SearchBox autoFocus />
      </section>

      <section className="pane space-y-3">
        <h2 className="text-xl font-semibold">رحلة مقترحة: «إنما الأعمال بالنيات»</h2>
        <p className="text-ink-muted">الحديث الأول في الصحيح. ابدأ من البخاري وتتبّع الإسناد صعودًا، أو انطلق من المصدر نزولًا.</p>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-primary" to="/bukhari/1?mode=journey&dir=trace&step=0">
            تتبّع الإسناد
          </Link>
          <Link className="btn" to="/bukhari/1?mode=journey&dir=journey&step=0">
            رحلة النقل
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">ما الإسناد؟</h2>
        <p className="leading-loose">
          الإسناد سلسلة الرواة الذين نقلوا الحديث، يذكر كل واحد منهم من حدّثه به، بصيغة تبيّن طريقة التحمّل مثل «حدثنا» و«أخبرنا» و«عن» و«سمعت».
          يعرض هذا الموقع كل سلسلة رابطًا رابطًا، ويرسم الطرق المعلّقة والمنقطعة بخط متقطع لا متصل، ولا يُصدر حكمًا على صحة حديث: يعرض أقوال
          العلماء المسمَّين بمصادرها، والمؤشرات الحسابية مساعدةً للباحث فقط.
        </p>
        <p className="flex flex-wrap gap-4">
          <Link className="link" to="/bukhari">
            تصفّح كتب الصحيح
          </Link>
          <Link className="link" to="/methodology">
            منهجية المنصة
          </Link>
          <Link className="link" to="/sources">
            المصادر وتراخيصها
          </Link>
        </p>
      </section>
    </main>
  );
}
