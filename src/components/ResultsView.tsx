import { useState } from 'react';
import type { AnalysisResult, FrictionPoint, MetricBreakdown, Severity } from '../types';
import { RiskBadge, SeverityBadge } from './Badges';
import { ScoreGauge } from './ScoreGauge';
import { FlowVisualization } from './FlowVisualization';
import { severityWeight, CHECK_CATEGORIES } from '../lib/analyzeFlow';
import { formatReportAsText } from '../lib/formatReport';

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

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
      {metric.correlation && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-brand-text">
          <svg className="mt-0.5 h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6.3 9.7a2.9 2.9 0 0 0 4.1 0l1.9-1.9a2.9 2.9 0 0 0-4.1-4.1l-.7.6M9.7 6.3a2.9 2.9 0 0 0-4.1 0l-1.9 1.9a2.9 2.9 0 0 0 4.1 4.1l.7-.6"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{metric.correlation}</span>
        </p>
      )}
    </div>
  );
}

function ScoreProvenance({ points }: { points: FrictionPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="max-w-[260px] text-center text-xs leading-relaxed text-text-muted md:text-left">
        No friction points were detected — this score reflects a clean flow, not an aggregate of contributing
        issues.
      </p>
    );
  }

  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  points.forEach((p) => {
    counts[p.severity] += 1;
  });
  const summary = (['high', 'medium', 'low'] as Severity[])
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${s}`)
    .join(', ');

  return (
    <div className="max-w-[280px] text-center md:text-left">
      <p className="text-xs font-medium text-text-secondary">
        Based on {points.length} friction point{points.length === 1 ? '' : 's'} ({summary})
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {points.map((p) => (
          <li key={p.id} className="text-xs leading-relaxed text-text-muted">
            {p.title}
          </li>
        ))}
      </ul>
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
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const sortedPoints = [...result.frictionPoints].sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
  );

  function viewOnFlow(index: number) {
    setSelectedStep(index);
    const el = document.getElementById(`flow-step-${index}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatReportAsText(result));
      setCopyState('copied');
    } catch {
      setCopyState('error');
    } finally {
      window.setTimeout(() => setCopyState('idle'), 2200);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 md:py-16">
      <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-brand-text">Analysis complete</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary md:text-3xl">Friction report</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            aria-live="polite"
            className="press-feedback inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {copyState === 'idle' && (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <rect x="5.5" y="5.5" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <path
                    d="M3.5 10.5v-6a1.5 1.5 0 0 1 1.5-1.5h6"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                Copy report
              </>
            )}
            {copyState === 'copied' && (
              <>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3 8.5l3 3 7-7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Copied
              </>
            )}
            {copyState === 'error' && "Couldn't copy"}
          </button>
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
      </div>

      {result.lowCoverage && (
        <div
          role="status"
          className="mb-8 flex items-start gap-3 rounded-xl border border-warning-border bg-warning-bg p-4"
        >
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-warning-text"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 5v3.5M8 11h.007M2.5 13h11a1 1 0 0 0 .87-1.5l-5.5-9.5a1 1 0 0 0-1.74 0l-5.5 9.5A1 1 0 0 0 2.5 13Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="text-sm leading-relaxed text-warning-text">
            <span className="font-medium">Low analysis confidence.</span> Only {result.matchedStepCount} of{' '}
            {result.steps.length} steps matched a pattern this tool recognizes — this can happen with
            unrecognized wording or a language other than English. The score and findings below may be
            incomplete.
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 gap-10 rounded-2xl border border-border bg-surface p-6 md:grid-cols-[auto_1fr] md:gap-12 md:p-8">
        <div className="flex flex-col items-center gap-3 md:items-start">
          <ScoreGauge score={result.frictionScore} riskLevel={result.riskLevel} />
          <RiskBadge level={result.riskLevel} />
          {!result.lowCoverage && (
            <p className="tabular text-xs text-text-muted">
              {result.matchedStepCount} of {result.steps.length} steps matched a known pattern
            </p>
          )}
          <ScoreProvenance points={sortedPoints} />
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
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            This flow passed every check we ran — {joinWithAnd(CHECK_CATEGORIES)}. As optional additional
            diligence, consider validating it with a small usability test.
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
