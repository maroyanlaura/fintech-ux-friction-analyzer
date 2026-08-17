import type { RiskLevel, Severity } from '../types';

const SEVERITY_STYLE: Record<Severity, string> = {
  high: 'bg-danger-bg text-danger-text border-danger-border',
  medium: 'bg-warning-bg text-warning-text border-warning-border',
  low: 'bg-success-bg text-success-text border-success-border',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High severity',
  medium: 'Medium severity',
  low: 'Low severity',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEVERITY_STYLE[severity]}`}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

const RISK_STYLE: Record<RiskLevel, string> = {
  High: 'bg-danger-bg text-danger-text border-danger-border',
  Medium: 'bg-warning-bg text-warning-text border-warning-border',
  Low: 'bg-success-bg text-success-text border-success-border',
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${RISK_STYLE[level]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          level === 'High'
            ? 'bg-[var(--color-danger-solid)]'
            : level === 'Medium'
              ? 'bg-[var(--color-warning-solid)]'
              : 'bg-[var(--color-success-solid)]'
        }`}
        aria-hidden="true"
      />
      {level} risk
    </span>
  );
}
