import { Fragment, useState } from 'react';
import type { FlowStep, FrictionPoint, Severity } from '../types';
import { SeverityBadge } from './Badges';

interface FlowVisualizationProps {
  steps: FlowStep[];
  frictionPoints: FrictionPoint[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

const SEVERITY_DOT: Record<Severity, string> = {
  high: 'bg-[var(--color-danger-solid)]',
  medium: 'bg-[var(--color-warning-solid)]',
  low: 'bg-[var(--color-success-solid)]',
};

const SEVERITY_RING: Record<Severity, string> = {
  high: 'border-[var(--color-danger-solid)]',
  medium: 'border-[var(--color-warning-solid)]',
  low: 'border-[var(--color-success-solid)]',
};

function worstSeverity(points: FrictionPoint[]): Severity | null {
  if (points.some((p) => p.severity === 'high')) return 'high';
  if (points.some((p) => p.severity === 'medium')) return 'medium';
  if (points.some((p) => p.severity === 'low')) return 'low';
  return null;
}

export function FlowVisualization({ steps, frictionPoints, selectedIndex, onSelect }: FlowVisualizationProps) {
  const [internalSelected, setInternalSelected] = useState<number>(steps[0]?.index ?? 0);
  const selected = selectedIndex ?? internalSelected;
  const setSelected = onSelect ?? setInternalSelected;

  const pointsByStep = new Map<number, FrictionPoint[]>();
  for (const p of frictionPoints) {
    const list = pointsByStep.get(p.affectedStepIndex) ?? [];
    list.push(p);
    pointsByStep.set(p.affectedStepIndex, list);
  }

  const selectedPoints = pointsByStep.get(selected) ?? [];

  return (
    <div>
      <div className="flex flex-col gap-0 overflow-x-visible md:flex-row md:items-center md:overflow-x-auto md:pb-2">
        {steps.map((step, i) => {
          const stepPoints = pointsByStep.get(step.index) ?? [];
          const severity = worstSeverity(stepPoints);
          const isSelected = selected === step.index;

          return (
            <Fragment key={step.index}>
              <button
                type="button"
                id={`flow-step-${step.index}`}
                onClick={() => setSelected(step.index)}
                aria-pressed={isSelected}
                className={[
                  'press-feedback group relative flex min-h-[64px] w-full shrink-0 flex-col justify-center gap-1 rounded-xl border bg-surface px-4 py-3 text-left transition-colors md:w-[168px]',
                  isSelected
                    ? severity
                      ? `${SEVERITY_RING[severity]} border-2 shadow-[0_0_0_3px_var(--color-bg-page)]`
                      : 'border-2 border-brand'
                    : 'border-border hover:border-border-strong',
                ].join(' ')}
              >
                <div className="flex items-center gap-2">
                  <span className="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] text-text-muted">
                    {i + 1}
                  </span>
                  {severity && (
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[severity]}`}
                      aria-label={`${severity} severity friction detected`}
                    />
                  )}
                </div>
                <span className="text-sm font-medium leading-snug text-text-primary">{step.label}</span>
                {stepPoints.length > 0 && (
                  <span className="text-xs text-text-muted">
                    {stepPoints.length} issue{stepPoints.length > 1 ? 's' : ''}
                  </span>
                )}
              </button>

              {i < steps.length - 1 && (
                <div
                  className="flex h-6 w-full shrink-0 items-center justify-center md:h-auto md:w-8"
                  aria-hidden="true"
                >
                  <svg
                    className="h-4 w-4 rotate-90 text-text-muted md:rotate-0"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path d="M4 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-sunken p-5">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          <span className="tabular">Step {selected + 1}</span>
          <span aria-hidden="true">·</span>
          <span>{steps.find((s) => s.index === selected)?.label}</span>
        </div>

        {selectedPoints.length === 0 ? (
          <p className="text-sm text-text-secondary">No friction detected at this step.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {selectedPoints.map((p) => (
              <li key={p.id}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={p.severity} />
                  <span className="font-medium text-text-primary">{p.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">{p.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
