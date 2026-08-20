import { useState } from 'react';
import type { FormEvent } from 'react';
import { CHECK_CATEGORIES } from '../lib/analyzeFlow';

interface LandingProps {
  onAnalyze: (flowText: string) => void;
  initialValue?: string;
}

const PLACEHOLDER =
  'Open app → Login → Payments → Select recipient → Enter amount → Review → Confirm with OTP';

const EXAMPLES = [
  {
    label: 'P2P transfer',
    text: 'Open app → Login → Payments → Select recipient → Enter amount → Review → Confirm with OTP',
  },
  {
    label: 'Card payment',
    text: 'Login → Enter card details → Enter billing address → Review order → Pay → Redirect to bank for 3DS → Return to app',
  },
  {
    label: 'Account top-up',
    text: 'Open app → Biometric login → Dashboard → Add money → Select bank account → Enter amount → Confirm → OTP → Success',
  },
  {
    label: 'Download statement',
    text: 'Open app → Login → Select statement period → Choose export format',
  },
];

export function Landing({ onAnalyze, initialValue = '' }: LandingProps) {
  const [value, setValue] = useState(initialValue);
  const trimmedLength = value.trim().length;
  const canSubmit = trimmedLength >= 3;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onAnalyze(value);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-brand-text">
        UX audit for fintech flows
      </p>
      <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] text-text-primary md:text-5xl">
        Find friction before your users do.
      </h1>
      <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-text-secondary">
        Describe a user flow — the steps a customer takes to log in, pay, or move money — and get a
        friction score, a step-by-step breakdown, and specific fixes before it reaches engineering.
      </p>

      <form onSubmit={handleSubmit} className="mt-10">
        <label htmlFor="flow-input" className="mb-2 block text-sm font-medium text-text-primary">
          Describe the user flow
        </label>
        <textarea
          id="flow-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={6}
          className="w-full resize-y rounded-xl border border-border bg-surface p-4 text-base leading-relaxed text-text-primary placeholder:text-text-muted focus-visible:outline-none"
          style={{ fontSize: '16px' }}
        />
        <p className="mt-2 text-sm text-text-muted">
          Separate steps with an arrow (<span className="tabular">→</span> or <span className="tabular">-&gt;</span>
          ), one per line, or commas.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              onClick={() => setValue(ex.text)}
              className="press-feedback rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="press-feedback inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-sm font-semibold text-text-on-brand transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Analyze flow
          </button>
          {!canSubmit && trimmedLength > 0 && (
            <span className="text-sm text-text-muted">Add a bit more detail to analyze this flow.</span>
          )}
        </div>
      </form>

      <div className="mt-16 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-6 text-sm text-text-muted">
        <span>Friction score</span>
        <span aria-hidden="true">·</span>
        <span>Cognitive load, steps, error risk, effort</span>
        <span aria-hidden="true">·</span>
        <span>Flagged friction points</span>
        <span aria-hidden="true">·</span>
        <span>Actionable recommendations</span>
      </div>

      <div className="mt-8 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-medium text-text-primary">What we check</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-text-secondary">
          {CHECK_CATEGORIES.map((category) => (
            <li key={category} className="flex items-center gap-1.5">
              <span className="h-1 w-1 rounded-full bg-text-muted" aria-hidden="true" />
              {category}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
