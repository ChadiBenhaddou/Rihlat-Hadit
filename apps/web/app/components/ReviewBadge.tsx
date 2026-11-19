import type { ReviewStatus, SourceInfo } from '@isnad/shared';
import { useI18n } from '~/i18n';

/**
 * Principle 3: unreviewed data shows a visible badge, and a fact resting only on
 * a dataset is labelled «مصدر ثانوي» until a reviewer adds a primary citation.
 */
export function ReviewBadge({
  status,
  sourceKind,
}: {
  status: ReviewStatus;
  sourceKind?: SourceInfo['kind'] | undefined;
}) {
  const { t } = useI18n();
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {status !== 'reviewed' && (
        <span className="badge" title={t('استُخرجت هذه المعلومة آليًا ولم يراجعها محرر بعد')}>
          {status === 'in_review' ? t('قيد المراجعة') : t('مستخرج آلياً — لم يُراجَع')}
        </span>
      )}
      {sourceKind === 'dataset' && (
        <span className="badge" title={t('مأخوذ من قاعدة بيانات وسيطة لا من مصدر أصلي محقَّق')}>
          {t('مصدر ثانوي')}
        </span>
      )}
    </span>
  );
}
