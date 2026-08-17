interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start px-6 py-24 md:py-32">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-danger-border bg-danger-bg">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M8 5v3.5M8 11h.007M2.5 13h11a1 1 0 0 0 .87-1.5l-5.5-9.5a1 1 0 0 0-1.74 0l-5.5 9.5A1 1 0 0 0 2.5 13Z"
            stroke="var(--color-danger-text)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-text-primary">Couldn't analyze this flow</h1>
      <p className="mt-3 max-w-[52ch] text-base leading-relaxed text-text-secondary">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="press-feedback mt-8 inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-sm font-semibold text-text-on-brand transition-colors hover:bg-brand-hover"
      >
        Edit flow description
      </button>
    </div>
  );
}
