import { AlertCircle, Info, X } from 'lucide-react';

export interface StatusFeedback {
  type: 'info' | 'warning' | 'error';
  message: string;
}

export function ApiStatusBanner({
  feedback,
  onDismiss,
}: {
  feedback: StatusFeedback | null;
  onDismiss?: () => void;
}) {
  if (!feedback) return null;

  const styles =
    feedback.type === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : feedback.type === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]';

  const Icon = feedback.type === 'info' ? Info : AlertCircle;

  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed ${styles}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{feedback.message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notice"
          className="rounded p-0.5 opacity-70 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
