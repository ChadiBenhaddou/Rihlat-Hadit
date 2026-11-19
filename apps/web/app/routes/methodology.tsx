import { Link } from 'react-router';
import { localeOf, useI18n } from '~/i18n';
import { dataContext } from '~/lib/data.server';
import type { Route } from './+types/methodology';

export async function loader({ context }: Route.LoaderArgs) {
  const { db, dataVersion } = await dataContext(context);
  const row = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM hadiths) AS entries,
              (SELECT COUNT(DISTINCT hadith_id) FROM chains) AS withChains,
              (SELECT COUNT(*) FROM chains WHERE is_suspended = 1) AS suspended,
              (SELECT COUNT(*) FROM chain_links WHERE link_kind = 'gap') AS gaps,
              (SELECT COUNT(*) FROM narrators WHERE role != 'prophet') AS narrators,
              (SELECT COUNT(*) FROM gradings) AS gradings`,
    )
    .first<{
      entries: number;
      withChains: number;
      suspended: number;
      gaps: number;
      narrators: number;
      gradings: number;
    }>();
  return { stats: row, dataVersion };
}

export function meta({ location }: Route.MetaArgs) {
  const en = localeOf(location.pathname) === 'en';
  return [
    { title: en ? 'Methodology | Rihlat al-Hadith' : 'منهجية المنصة | رحلة الحديث' },
    {
      name: 'description',
      content: en
        ? 'How the platform’s data is sourced, reviewed and shown, and what each indicator means.'
        : 'كيف تُجمع بيانات المنصة وتُراجَع وتُعرض، وما معنى كل مؤشر.',
    },
  ];
}

export default function Methodology({ loaderData }: Route.ComponentProps) {
  const { locale } = useI18n();
  if (locale === 'en') return <MethodologyEn stats={loaderData.stats} dataVersion={loaderData.dataVersion} />;
  const s = loaderData.stats;
  return (
    <main id="main" className="prose-ar mx-auto max-w-3xl px-4 py-8">
      <h1>منهجية المنصة</h1>
      <p>
        هذه المنصة أداة بحث أولًا. لا تحكم على حديث بصحة أو ضعف، ولا يدل اتصال خطٍّ في المخطط على صحة الحديث. تعرض أقوال
        العلماء المسمَّين بمصادرها، وما تحسبه من إشارات يُسمّى «مؤشرًا للباحث» لا حكمًا.
      </p>

      <h2>من أين تأتي البيانات</h2>
      <ul>
        <li>
          <strong>الترقيم والكتب والأبواب:</strong> نص صحيح البخاري في طبعة دار طوق النجاة بترقيم محمد فؤاد عبد الباقي،
          من مدوّنة OpenITI.
        </li>
        <li>
          <strong>نصوص الأحاديث المشكولة والأسانيد والرواة وأقوال النقاد:</strong> قاعدة «الجامع» لمعرفة الحديث. هي
          قاعدة بيانات وسيطة لا تسمّي مصدرها الأصلي، فكل ما يُبنى عليها وحدها يحمل وسم «مصدر ثانوي» حتى يضيف محرر إحالة
          إلى مصدر أصلي.
        </li>
        <li>
          تفاصيل كل مصدر وترخيصه في <Link to="/sources">صفحة المصادر</Link>.
        </li>
      </ul>

      <h2>كيف رُبطت المصادر</h2>
      <p>
        رُبط كل حديث في قاعدة «الجامع» برقمه في الترقيم المرجعي بمقارنة النصين، مع تقديم ألفاظ الإسناد لأن البخاري يكرر
        المتن الواحد بأسانيد مختلفة، ثم بترتيب الأحاديث في الكتاب. ما لم يتطابق أول رواة إسناده في النصين لم يُربط، وأُحيل
        إلى المراجعة بدل أن يُثبت خطأً.
      </p>
      {s && (
        <p>
          حُمّل حتى الآن {s.entries} موضعًا، منها {s.withChains} بمخطط إسناد، و{s.suspended} طريقًا معلّقًا، و{s.gaps} رابطًا
          منقطعًا، و{s.narrators} راويًا، و{s.gradings} قولًا من أقوال النقاد. الأرقام المرجعية التي لا يوجد نصها في أي من
          المصدرين لا تُعرض، ولا يُكمل نقصها من الذاكرة.
        </p>
      )}

      <h2>حالات المراجعة</h2>
      <ul>
        <li>
          <span className="badge">مستخرج آلياً — لم يُراجَع</span> استُخرجت المعلومة آليًا ولم يراجعها محرر بعد.
        </li>
        <li>
          <span className="badge">مصدر ثانوي</span> تستند المعلومة إلى قاعدة بيانات وسيطة لا إلى مصدر أصلي محقَّق.
        </li>
        <li>كل معلومة تحمل علامة [م] تفتح مصدرها: اسم الكتاب أو القاعدة، والطبعة، وموضع المعلومة، والترخيص.</li>
        <li>ما لا تذكره المصادر يظهر «غير متوفر»، ولا يُملأ بالتخمين.</li>
      </ul>

      <h2>رسم الإسناد</h2>
      <ul>
        <li>يجري النقل في المخطط من الأعلى إلى الأسفل: النبي ﷺ في الأعلى، والبخاري في الأسفل.</li>
        <li>الراوي الذي تمر به عدة طرق يظهر مرة واحدة، فيظهر موضع التقاء الطرق.</li>
        <li>
          نوع الرابط يُعرف من شكل الخط لا من لونه وحده: متصل للرابط المتصل، ومتقطع لغير المؤكد، ومنقّط بعلامة «تعليق» أو
          «انقطاع» للطريق المعلّق أو المنقطع.
        </li>
        <li>
          صيغة الأداء على كل رابط هي اللفظ الوارد في النص قبل اسم الراوي، فإن لم ينتهِ ما قبل الاسم بصيغة أداء لم تُذكر
          صيغة.
        </li>
        <li>الاسم المبهم (مثل «رجل») يُرسم عقدة مستقلة في كل موضع، ولا تُدمج المبهمات في شخص واحد.</li>
        <li>لا صور ولا رسوم للنبي ﷺ ولا للصحابة ولا لأي راوٍ: العقد نصية فقط.</li>
      </ul>

      <h2>مؤشرات للباحث</h2>
      <p>كل مؤشر يذكر مدخلاته وصيغة حسابه ونطاقه «ضمن صحيح البخاري كما هو محمَّل هنا»، ولا يُجمع في درجة واحدة.</p>
      <ul>
        <li>
          <strong>المعاصرة:</strong> سنة وفاة الشيخ ناقص سنة مولد التلميذ، حين يذكر المصدر التاريخين. إن لم يُذكر أحدهما
          فالنتيجة «غير متوفر»، وإن جاء الفرق سالبًا قيل «لا تداخل ظاهر بحسب التواريخ المتاحة»، وهو وصف للتواريخ المسجّلة
          لا حكم على اللقاء.
        </li>
        <li>
          <strong>البلد المشترك:</strong> المدن المسجّلة للشيخ والتلميذ معًا (إقامة أو وفاة). غياب بلد مشترك مسجّل لا يدل
          على شيء.
        </li>
        <li>
          <strong>طول الإسناد:</strong> عدد الرواة بين البخاري والنبي ﷺ أو آخر راوٍ مذكور. الطرق المعلّقة لا تُقارَن في
          الطول لأنها تُسقط رواة.
        </li>
        <li>
          <strong>الانقطاع والتعليق:</strong> الروابط المعلّقة أو المنقطعة والأسماء المبهمة كما في البيانات.
        </li>
        <li>
          <strong>المدار:</strong> أقرب راوٍ إلى البخاري تمر به جميع الطرق المعروضة.
        </li>
        <li>
          <strong>عدد الرواة في كل طبقة:</strong> عدد الرواة المختلفين في كل طبقة عبر الطرق، بدءًا من المصدر.
        </li>
      </ul>
      <p>
        مؤشر «العنعنة ممن وُصف بالتدليس» لا يُعرض بعد: يحتاج أولًا إلى عرض كلام العلماء في حمل العنعنة في الصحيح من مصادره،
        وذلك لم يُراجَع بعد.
      </p>

      <h2>الإبلاغ عن خطأ</h2>
      <p>في كل صفحة حديث وراوٍ زر «الإبلاغ عن خطأ». تصل البلاغات إلى قائمة المراجعة، ولا يُعدَّل شيء إلا بمراجعة محرر.</p>
      <p className="text-sm text-ink-muted">إصدار البيانات: {loaderData.dataVersion}</p>
    </main>
  );
}

function MethodologyEn({
  stats: s,
  dataVersion,
}: {
  stats: Route.ComponentProps['loaderData']['stats'];
  dataVersion: string;
}) {
  return (
    <main id="main" className="prose-ar mx-auto max-w-3xl px-4 py-8">
      <h1>Methodology</h1>
      <p>
        This platform is a research tool first. It never grades a hadith as authentic or weak, and a connected line in a
        graph is not evidence of authenticity. It shows the statements of named scholars with their sources; anything it
        computes is labelled an indicator for the researcher, never a ruling.
      </p>
      <h2>Where the data comes from</h2>
      <ul>
        <li>
          <strong>Numbering, books and chapters:</strong> the text of Sahih al-Bukhari in the Dar Tawq al-Najat edition,
          with Muhammad Fuad Abd al-Baqi’s numbering, from the OpenITI corpus.
        </li>
        <li>
          <strong>Vocalized hadith text, chains, narrators and critics’ statements:</strong> the «الجامع» Hadith
          Knowledge Graph. It is an intermediate dataset that does not name its original source, so every fact resting
          on it alone carries the label “Secondary source” until an editor adds a citation to a primary source.
        </li>
        <li>
          Each source and its licence is listed on the <Link to="/en/sources">sources page</Link>.
        </li>
      </ul>
      <h2>How the sources were joined</h2>
      <p>
        Each entry of the knowledge graph was matched to its reference number by comparing the two texts, weighting the
        words of the isnad because al-Bukhari repeats one matn under different chains, and then by the order of entries
        in the book. Where the first narrators of the isnad differ between the two texts, the entry was not matched; it
        went to review rather than being shown wrongly.
      </p>
      {s && (
        <p>
          Loaded so far: {s.entries} entries, {s.withChains} with an isnad graph, {s.suspended} suspended routes,{' '}
          {s.gaps} broken links, {s.narrators} narrators and {s.gradings} critics’ statements. Reference numbers whose
          text is in neither source are not shown, and gaps are never filled from memory.
        </p>
      )}
      <h2>Review status</h2>
      <ul>
        <li>
          <span className="badge">Extracted automatically — not reviewed</span>: produced by the pipeline; no editor has
          checked it yet.
        </li>
        <li>
          <span className="badge">Secondary source</span>: rests on an intermediate dataset, not on an edited primary
          source.
        </li>
        <li>
          Every fact carries a [src] marker that opens its source: the work or dataset, the edition, the locator and the
          licence.
        </li>
        <li>What the sources do not say is shown as “not available” and never guessed.</li>
      </ul>
      <h2>Drawing the isnad</h2>
      <ul>
        <li>Transmission flows from top to bottom: the Prophet ﷺ at the top, al-Bukhari at the bottom.</li>
        <li>A narrator through whom several routes pass appears once, so you can see where routes converge.</li>
        <li>
          Link kind is shown by line style, never by colour alone: solid for connected, dashed for uncertain, dotted and
          labelled for a suspended (muʿallaq) or broken link.
        </li>
        <li>
          The phrase on each link is the wording that ends the text just before the narrator’s name; if that text does
          not end in a phrase of transmission, none is shown.
        </li>
        <li>
          An unnamed narrator (such as «رجل», “a man”) is drawn as a separate node every time; unnamed narrators are
          never merged.
        </li>
        <li>
          There are no images or depictions of the Prophet ﷺ, the Companions or any narrator: nodes are text only.
        </li>
      </ul>
      <h2>Indicators for the researcher</h2>
      <p>
        Each indicator states its inputs, its formula and its scope, “within Sahih al-Bukhari as loaded here”, and none
        is combined into a score.
      </p>
      <ul>
        <li>
          <strong>Contemporaneity:</strong> the teacher’s death year minus the student’s birth year, when the source
          gives both. If either is missing the result is “not available”; a negative difference reads “no apparent
          overlap by the available dates”, a description of the recorded dates, not a ruling on whether they met.
        </li>
        <li>
          <strong>Shared places:</strong> cities recorded for both teacher and student (residence or death). No shared
          city recorded proves nothing.
        </li>
        <li>
          <strong>Chain length:</strong> narrators between al-Bukhari and the Prophet ﷺ or the last named narrator.
          Suspended routes are not compared, because they omit narrators.
        </li>
        <li>
          <strong>Breaks and suspensions:</strong> suspended or broken links and unnamed narrators, as in the data.
        </li>
        <li>
          <strong>Common link (madār):</strong> the narrator nearest al-Bukhari through whom every shown route passes.
        </li>
        <li>
          <strong>Narrators per layer:</strong> distinct narrators in each layer across the routes, counting from the
          source.
        </li>
      </ul>
      <p>
        An indicator for «عن» (ʿan) from a narrator described with tadlīs is not shown yet: it first needs the scholars’
        discussion of how ʿanʿana is read in the Sahih, presented from its sources and reviewed.
      </p>
      <h2>Reporting an error</h2>
      <p>
        Every hadith and narrator page has a “Report an error” button. Reports reach the review queue, and nothing
        changes without an editor’s review.
      </p>
      <p className="text-sm text-ink-muted">Data version: {dataVersion}</p>
    </main>
  );
}
