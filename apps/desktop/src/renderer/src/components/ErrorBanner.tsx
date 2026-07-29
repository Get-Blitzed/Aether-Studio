import type { OpenAppError } from "../state/appStore";

interface ErrorBannerProps {
  error: OpenAppError;
  onDismiss: () => void;
}

export function ErrorBanner({ error, onDismiss }: ErrorBannerProps): JSX.Element {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-cream"
    >
      <div className="flex-1">
        <p className="font-semibold text-red-300">{error.title}</p>
        <p className="mt-1 text-silver">{error.detail}</p>
        {error.code && <p className="mt-1 text-xs text-silver/60">Code: {error.code}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded px-2 py-1 text-xs text-silver hover:bg-hairline/10 focus-visible:outline-none"
        aria-label="Dismiss error"
      >
        Dismiss
      </button>
    </div>
  );
}
