import type { ReviewStatus, SourceInfo } from '@isnad/shared';

/**
 * Principle 3: unreviewed data shows a visible badge, and a fact resting only on
 * a dataset is labelled «مصدر ثانوي» until a reviewer adds a primary citation.
 */
export function ReviewBadge({ status, sourceKind }: { status: ReviewStatus; sourceKind?: SourceInfo['kind'] | undefined }) {
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {status !== 'reviewed' && (
        <span className="badge" title="استُخرجت هذه المعلومة آليًا ولم يراجعها محرر بعد">
          {status === 'in_review' ? 'قيد المراجعة' : 'مستخرج آلياً — لم يُراجَع'}
        </span>
      )}
      {sourceKind === 'dataset' && (
        <span className="badge" title="مأخوذ من قاعدة بيانات وسيطة لا من مصدر أصلي محقَّق">
          مصدر ثانوي
        </span>
      )}
    </span>
  );
}
