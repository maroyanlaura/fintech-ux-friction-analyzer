import type { RiskLevel } from '../types';

interface ScoreGaugeProps {
  score: number;
  riskLevel: RiskLevel;
}

const SWEEP_START = 135;
const SWEEP_DEGREES = 270;
const CX = 70;
const CY = 78;
const R_TRACK = 56;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, startDeg);
  const end = polarToCartesian(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function angleForFraction(fraction: number) {
  return SWEEP_START + fraction * SWEEP_DEGREES;
}

const RISK_TOKEN: Record<RiskLevel, string> = {
  Low: 'var(--color-success-solid)',
  Medium: 'var(--color-warning-solid)',
  High: 'var(--color-danger-solid)',
};

export function ScoreGauge({ score, riskLevel }: ScoreGaugeProps) {
  const fraction = Math.max(0, Math.min(1, score / 100));
  const color = RISK_TOKEN[riskLevel];
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative" role="img" aria-label={`UX friction score ${score} out of 100, ${riskLevel} risk`}>
      <svg viewBox="0 0 140 108" width="220" height="170" className="max-w-full">
        <path
          d={describeArc(CX, CY, R_TRACK, SWEEP_START, SWEEP_START + SWEEP_DEGREES)}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={describeArc(CX, CY, R_TRACK, SWEEP_START, angleForFraction(fraction))}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 700ms var(--ease-out-smooth)' }}
        />
        {ticks.map((t) => {
          const angle = angleForFraction(t);
          const outer = polarToCartesian(CX, CY, R_TRACK + 9, angle);
          const inner = polarToCartesian(CX, CY, R_TRACK - 1, angle);
          return (
            <line
              key={t}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--color-text-muted)"
              strokeWidth="1.5"
              opacity="0.5"
            />
          );
        })}
        {(() => {
          const needleAngle = angleForFraction(fraction);
          const tip = polarToCartesian(CX, CY, R_TRACK - 14, needleAngle);
          return (
            <g style={{ transition: 'transform 700ms var(--ease-out-smooth)' }}>
              <line x1={CX} y1={CY} x2={tip.x} y2={tip.y} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
              <circle cx={CX} cy={CY} r="4.5" fill={color} />
              <circle cx={CX} cy={CY} r="2" fill="var(--color-bg-surface)" />
            </g>
          );
        })()}
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <span className="tabular text-4xl font-semibold leading-none text-text-primary">{score}</span>
        <span className="mt-1 text-xs text-text-muted">out of 100</span>
      </div>
    </div>
  );
}
