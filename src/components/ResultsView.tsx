import { useState } from 'react';
import type { AnalysisResult, FrictionPoint, MetricBreakdown } from '../types';
import { RiskBadge, SeverityBadge } from './Badges';
import { ScoreGauge } from './ScoreGauge';
import { FlowVisualization } from './FlowVisualization';
import { severityWeight } from '../lib/analyzeFlow';

interface ResultsViewProps {
  result: AnalysisResult;
  onReset: () => void;
}

function MetricBar({ metric }: { metric: MetricBreakdown }) {
  const tone = metric.score >= 67 ? 'danger' : metric.score >= 34 ? 'warning' : 'success';
  const barColor =
    tone === 'danger'
      ? 'bg-[var(--color-danger-solid)]'
      : tone === 'warning'
        ? 'bg-[var(--color-warning-solid)]'
        : 'bg-[var(--color-success-solid)]';

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">{metric.label}</span>
        <span className="tabular text-sm text-text-secondary">{metric.score}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${metric.score}%`, transition: 'width 700ms var(--ease-out-smooth)' }}
        />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{metric.detail}</p>
    </div>
  );
}

function FrictionPointCard({ point, stepLabel, onView }: { point: FrictionPoint; stepLabel: string; onView: () => void }) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <SeverityBadge severity={point.severity} />
        <span className="text-xs text-text-muted">
          Step {point.affectedStepIndex + 1} · {stepLabel}
        </span>
      </div>
      <h3 className="mb-1.5 font-semibold text-text-primary">{point.title}</h3>
      <p className="mb-3 text-sm leading-relaxed text-text-secondary">{point.explanation}</p>
      <button
        type="button"
        onClick={onView}
        className="press-feedback text-sm font-medium text-brand-text hover:underline"
      >
        View on flow →
      </button>
    </li>
  );
}

export function ResultsView({ result, onReset }: ResultsViewProps) {
  const [selectedStep, setSelectedStep] = useState<number>(result.steps[0]?.index ?? 0);

  const sortedPoints = [...result.frictionPoints].sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
  );

  function viewOnFlow(index: number) {
    setSelectedStep(index);
    const el = document.getElementById(`flow-step-${index}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 md:py-16">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand-text">Analysis complete</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary md:text-3xl">Friction report</h1>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="press-feedback inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.2h-3.2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Analyze another flow
        </button>
      </div>

      <section className="grid grid-cols-1 gap-10 rounded-2xl border border-border bg-surface p-6 md:grid-cols-[auto_1fr] md:gap-12 md:p-8">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <ScoreGauge score={result.frictionScore} riskLevel={result.riskLevel} />
          <RiskBadge level={result.riskLevel} />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <MetricBar metric={result.breakdown.cognitiveLoad} />
          <MetricBar metric={result.breakdown.numberOfSteps} />
          <MetricBar metric={result.breakdown.errorRisk} />
          <MetricBar metric={result.breakdown.userEffort} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">Flow visualization</h2>
        <p className="mb-5 text-sm text-text-secondary">
          Click any step to see whether it has a detected issue.
        </p>
        <FlowVisualization
          steps={result.steps}
          frictionPoints={result.frictionPoints}
          selectedIndex={selectedStep}
          onSelect={setSelectedStep}
        />
      </section>

      <section className="mt-12">
        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          Friction points{' '}
          <span className="tabular text-base font-normal text-text-muted">({sortedPoints.length})</span>
        </h2>
        {sortedPoints.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            No friction points were detected for this flow based on the current rule set.
          </p>
        ) : (
          <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {sortedPoints.map((p) => (
              <FrictionPointCard
                key={p.id}
                point={p}
                stepLabel={result.steps.find((s) => s.index === p.affectedStepIndex)?.label ?? ''}
                onView={() => viewOnFlow(p.affectedStepIndex)}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 mb-4 rounded-2xl border border-brand-subtle-border bg-brand-subtle p-6 md:p-8">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Recommendations</h2>
        <ul className="flex flex-col gap-3">
          {result.recommendations.map((rec, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-text-primary">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-text"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8.5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
