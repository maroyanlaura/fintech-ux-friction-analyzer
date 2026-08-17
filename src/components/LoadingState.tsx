import { useEffect, useState } from 'react';

const PHASES = [
  'Parsing flow steps…',
  'Checking authentication patterns…',
  'Scoring cognitive load and effort…',
  'Compiling recommendations…',
];

export function LoadingState() {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhaseIndex((i) => Math.min(i + 1, PHASES.length - 1));
    }, 280);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col items-start px-6 py-24 md:py-32"
      role="status"
      aria-live="polite"
    >
      <div className="mb-6 h-1 w-40 overflow-hidden rounded-full bg-sunken">
        <div className="h-full w-full origin-left animate-[scan_1.1s_ease-in-out_infinite] bg-brand" />
      </div>
      <p className="tabular text-sm text-text-muted">{PHASES[phaseIndex]}</p>
      <p className="mt-1 text-xs text-text-muted">Running rule-based analysis locally — no external AI call.</p>

      <style>{`
        @keyframes scan {
          0% { transform: scaleX(0.08); }
          50% { transform: scaleX(0.9); }
          100% { transform: scaleX(0.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[scan_1\\.1s_ease-in-out_infinite\\] { animation: none; transform: scaleX(0.5); }
        }
      `}</style>
    </div>
  );
}
