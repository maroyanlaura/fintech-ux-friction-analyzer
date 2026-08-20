import { FlowAnalysisError } from '../types';
import type {
  AnalysisBreakdown,
  AnalysisResult,
  FlowStep,
  FrictionPoint,
  MetricBreakdown,
  RiskLevel,
  Severity,
} from '../types';

/**
 * Deterministic, rule-based UX heuristics — not a real AI/ML model.
 * Same input always produces the same output. See README for the full rule list.
 */

const OTP_RE = /\botp\b|one[- ]time (code|password|pin)|verification code|\b2fa\b|two[- ]factor|\bmfa\b/i;
const AUTH_RE = /\blog[ -]?in\b|sign[ -]?in|authenticate|\bpassword\b|biometric|face ?id|fingerprint|\bpin\b/i;
const PAYMENT_RE = /\bpay(ment)?\b|transfer|checkout|transaction|\bamount\b|send money|top[- ]?up|withdraw|deposit|recipient/i;
const SUCCESS_RE = /success|receipt|\bdone\b|complete(d)?|confirmation (screen|page|number)|thank you|reference number/i;
const ERROR_RECOVERY_RE = /\berror\b|retry|failed|try again|\bcancel\b|declin(e|ed)|fallback|support/i;
const EXTERNAL_DEP_RE = /\bbank\b|third[- ]party|redirect|external|partner|\bsms\b|\bemail\b|app store|browser|carrier/i;
const MANUAL_ENTRY_RE = /\benter\b|\binput\b|\bselect\b|\bchoose\b|\bfill\b|\btype\b|provide/i;
const CONFIRM_RE = /\breview\b|\bconfirm\b|\bsubmit\b/i;

function splitSteps(raw: string): string[] {
  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/->|=>|>>/g, '→')
    .trim();

  if (normalized.length === 0) return [];

  let parts: string[];

  if (normalized.includes('→')) {
    parts = normalized.split('→');
  } else if (normalized.includes('\n')) {
    parts = normalized.split('\n');
  } else if (/,/.test(normalized) && normalized.split(',').length >= 3) {
    parts = normalized.split(',');
  } else if (/\bthen\b/i.test(normalized)) {
    parts = normalized.split(/\bthen\b/i);
  } else {
    parts = normalized.split(/(?<=[.;])\s+/);
  }

  return parts
    .map((p) => p.replace(/^[\s\-–—•\d.)]+/, '').trim())
    .filter((p) => p.length > 0);
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function riskLevelFor(score: number): RiskLevel {
  if (score < 34) return 'Low';
  if (score < 67) return 'Medium';
  return 'High';
}

export function analyzeFlow(rawInput: string): AnalysisResult {
  const letterCount = (rawInput.match(/[a-zA-Z]/g) || []).length;

  if (rawInput.trim().length === 0) {
    throw new FlowAnalysisError('EMPTY_FLOW', 'The flow description is empty.');
  }
  if (letterCount < 3) {
    throw new FlowAnalysisError(
      'UNREADABLE_FLOW',
      'The flow description does not contain enough readable text to analyze.',
    );
  }

  const stepLabels = splitSteps(rawInput);
  if (stepLabels.length === 0) {
    throw new FlowAnalysisError('EMPTY_FLOW', 'No steps could be parsed from the flow description.');
  }

  const steps: FlowStep[] = stepLabels.map((label, index) => ({ index, label }));

  const otpSteps = steps.filter((s) => OTP_RE.test(s.label));
  const authSteps = steps.filter((s) => AUTH_RE.test(s.label) || OTP_RE.test(s.label));
  const paymentSteps = steps.filter((s) => PAYMENT_RE.test(s.label));
  const manualEntrySteps = steps.filter((s) => MANUAL_ENTRY_RE.test(s.label));
  const externalDepSteps = steps.filter((s) => EXTERNAL_DEP_RE.test(s.label));
  const confirmSteps = steps.filter((s) => CONFIRM_RE.test(s.label));
  const hasErrorRecovery = steps.some((s) => ERROR_RECOVERY_RE.test(s.label));
  const hasSuccessFeedback = steps.some((s) => SUCCESS_RE.test(s.label));

  const frictionPoints: FrictionPoint[] = [];
  let ruleCounter = 0;
  const nextId = () => `fp-${++ruleCounter}`;

  // Rule: flow length
  if (steps.length >= 7) {
    frictionPoints.push({
      id: nextId(),
      severity: 'high',
      title: `Flow has ${steps.length} steps`,
      explanation:
        'Completion rates drop sharply past 5-6 steps in a single task. Each additional step is another point where a user can hesitate or abandon.',
      affectedStepIndex: steps.length - 1,
    });
  } else if (steps.length >= 5) {
    frictionPoints.push({
      id: nextId(),
      severity: 'medium',
      title: `Flow has ${steps.length} steps`,
      explanation:
        'This is within a workable range, but every step still costs attention. Check whether any can be combined or made optional.',
      affectedStepIndex: steps.length - 1,
    });
  }

  // Rule: OTP usage
  otpSteps.forEach((step) => {
    const highStakes = paymentSteps.length > 0 && !hasErrorRecovery;
    frictionPoints.push({
      id: nextId(),
      severity: highStakes ? 'high' : 'medium',
      title: 'OTP step introduces drop-off risk',
      explanation:
        'One-time codes depend on carrier delivery speed, spam filtering, and the user having their phone on hand. Any delay or typo strands the user mid-flow with no stated recovery path.',
      affectedStepIndex: step.index,
    });
  });

  // Rule: repeated authentication
  if (authSteps.length >= 2) {
    frictionPoints.push({
      id: nextId(),
      severity: 'medium',
      title: 'User authenticates more than once',
      explanation: `"${authSteps[0].label}" and "${authSteps[authSteps.length - 1].label}" both require proving identity. Repeated authentication within one task reads as redundant and increases perceived effort.`,
      affectedStepIndex: authSteps[authSteps.length - 1].index,
    });
  }

  // Rule: unclear / missing confirmation
  if (paymentSteps.length > 0 && !hasSuccessFeedback) {
    const anchor = confirmSteps.length > 0 ? confirmSteps[confirmSteps.length - 1] : steps[steps.length - 1];
    frictionPoints.push({
      id: nextId(),
      severity: 'high',
      title: 'No explicit success confirmation',
      explanation:
        'The flow includes a transaction but no step communicates that it succeeded (a receipt, reference number, or confirmation screen). Users left without confirmation often retry the payment, causing duplicate transactions.',
      affectedStepIndex: anchor.index,
    });
  }

  // Rule: missing error recovery on payment steps
  if (paymentSteps.length > 0 && !hasErrorRecovery) {
    const anchor = confirmSteps.length > 0 ? confirmSteps[confirmSteps.length - 1] : paymentSteps[paymentSteps.length - 1];
    frictionPoints.push({
      id: nextId(),
      severity: 'high',
      title: 'No visible path when the transaction fails',
      explanation:
        'Money-movement steps are present but nothing in the flow addresses a decline, timeout, or network failure. Silent failure on a payment is one of the highest-cost gaps in a fintech flow.',
      affectedStepIndex: anchor.index,
    });
  }

  // Rule: external dependency
  if (externalDepSteps.length > 0) {
    const step = externalDepSteps[0];
    frictionPoints.push({
      id: nextId(),
      severity: 'medium',
      title: 'Flow depends on an external system',
      explanation: `"${step.label}" hands control to something outside this product (a bank, carrier, or third party). Latency and failures there are outside your control but still land on your abandonment rate.`,
      affectedStepIndex: step.index,
    });
  }

  // Rule: manual entry load
  if (manualEntrySteps.length >= 3) {
    const step = manualEntrySteps[manualEntrySteps.length - 1];
    frictionPoints.push({
      id: nextId(),
      severity: manualEntrySteps.length >= 4 ? 'medium' : 'low',
      title: `Manual input required at ${manualEntrySteps.length} points`,
      explanation:
        'Each manual field is a chance for error and a moment of typing effort. Consider pre-filling from history, defaults, or device data where possible.',
      affectedStepIndex: step.index,
    });
  }

  // ---- Correlation between breakdown metrics (explanatory only, does not affect scores) ----
  // Reuses the same significance thresholds as the friction-point rules above, so a
  // correlation is only surfaced when its driver was already judged noteworthy.
  const correlationNotes = buildCorrelationNotes({
    stepDriver: steps.length >= 5,
    authDriver: authSteps.length >= 2,
    manualDriver: manualEntrySteps.length >= 3,
    otpDriver: otpSteps.length >= 1,
  });

  // ---- Breakdown metrics (0-100, higher = more friction) ----
  const numberOfStepsScore = clamp((steps.length / 10) * 100);

  const cognitiveLoadScore = clamp(
    numberOfStepsScore * 0.4 +
      manualEntrySteps.length * 9 +
      (authSteps.length >= 2 ? 18 : 0) +
      (otpSteps.length > 0 ? 10 : 0),
  );

  const errorRiskScore = clamp(
    (paymentSteps.length > 0 ? 22 : 0) +
      otpSteps.length * 16 +
      (paymentSteps.length > 0 && !hasErrorRecovery ? 26 : 0) +
      (externalDepSteps.length > 0 ? 14 : 0) +
      (paymentSteps.length > 0 && !hasSuccessFeedback ? 14 : 0),
  );

  const userEffortScore = clamp(
    numberOfStepsScore * 0.35 + manualEntrySteps.length * 11 + (authSteps.length >= 2 ? 14 : 0),
  );

  const breakdown: AnalysisBreakdown = {
    cognitiveLoad: metric(
      'Cognitive Load',
      cognitiveLoadScore,
      `${manualEntrySteps.length} manual decision${manualEntrySteps.length === 1 ? '' : 's'}, ${authSteps.length} identity check${authSteps.length === 1 ? '' : 's'}.`,
      correlationNotes.cognitiveLoad,
    ),
    numberOfSteps: metric(
      'Number of Steps',
      numberOfStepsScore,
      `${steps.length} step${steps.length === 1 ? '' : 's'} from start to completion.`,
      correlationNotes.numberOfSteps,
    ),
    errorRisk: metric(
      'Error Risk',
      errorRiskScore,
      hasErrorRecovery
        ? 'Flow references error handling.'
        : paymentSteps.length > 0
          ? 'No error or retry path stated for the transaction.'
          : 'No transaction step detected.',
      correlationNotes.errorRisk,
    ),
    userEffort: metric(
      'User Effort',
      userEffortScore,
      `${manualEntrySteps.length} field${manualEntrySteps.length === 1 ? '' : 's'} to fill, ${otpSteps.length} code${otpSteps.length === 1 ? '' : 's'} to retrieve.`,
      correlationNotes.userEffort,
    ),
  };

  const frictionScore = clamp(
    breakdown.cognitiveLoad.score * 0.25 +
      breakdown.numberOfSteps.score * 0.2 +
      breakdown.errorRisk.score * 0.3 +
      breakdown.userEffort.score * 0.25,
  );

  const recommendations = buildRecommendations(frictionPoints);

  return {
    rawInput,
    steps,
    frictionScore,
    riskLevel: riskLevelFor(frictionScore),
    breakdown,
    frictionPoints,
    recommendations,
  };
}

function metric(label: string, score: number, detail: string, correlation?: string): MetricBreakdown {
  return { label, score, detail, correlation };
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

type MetricKey = 'cognitiveLoad' | 'numberOfSteps' | 'errorRisk' | 'userEffort';

const METRIC_LABEL: Record<MetricKey, string> = {
  cognitiveLoad: 'Cognitive Load',
  numberOfSteps: 'Number of Steps',
  errorRisk: 'Error Risk',
  userEffort: 'User Effort',
};

/**
 * Builds a per-metric explanatory note describing when that metric's score moves together
 * with another displayed metric because they are driven by the same underlying factor in
 * the flow (e.g. the same step count, or the same OTP step). Purely explanatory — it does
 * not read or alter any metric's calculated score.
 */
function buildCorrelationNotes(drivers: {
  stepDriver: boolean;
  authDriver: boolean;
  manualDriver: boolean;
  otpDriver: boolean;
}): Record<MetricKey, string | undefined> {
  const links = new Map<MetricKey, Map<MetricKey, Set<string>>>();

  const link = (a: MetricKey, b: MetricKey, reason: string) => {
    if (!links.has(a)) links.set(a, new Map());
    if (!links.get(a)!.has(b)) links.get(a)!.set(b, new Set());
    links.get(a)!.get(b)!.add(reason);

    if (!links.has(b)) links.set(b, new Map());
    if (!links.get(b)!.has(a)) links.get(b)!.set(a, new Set());
    links.get(b)!.get(a)!.add(reason);
  };

  // Number of Steps feeds directly into both Cognitive Load and User Effort's formulas,
  // so a notably long flow (the same threshold used for the "Flow has N steps" friction
  // point) moves all three together.
  if (drivers.stepDriver) {
    link('numberOfSteps', 'cognitiveLoad', 'step count');
    link('numberOfSteps', 'userEffort', 'step count');
    link('cognitiveLoad', 'userEffort', 'step count');
  }
  // Repeated authentication (the same threshold as the "authenticates more than once"
  // friction point) adds to both Cognitive Load and User Effort.
  if (drivers.authDriver) {
    link('cognitiveLoad', 'userEffort', 'repeated authentication');
  }
  // A high manual-entry load (the same threshold as the "manual input required" friction
  // point) adds to both Cognitive Load and User Effort.
  if (drivers.manualDriver) {
    link('cognitiveLoad', 'userEffort', 'manual entry load');
  }
  // An OTP step adds to both Cognitive Load and Error Risk.
  if (drivers.otpDriver) {
    link('cognitiveLoad', 'errorRisk', 'the OTP step');
  }

  const notes: Record<MetricKey, string | undefined> = {
    cognitiveLoad: undefined,
    numberOfSteps: undefined,
    errorRisk: undefined,
    userEffort: undefined,
  };

  for (const [key, others] of links) {
    const clauses = [...others].map(
      ([otherKey, reasons]) => `${METRIC_LABEL[otherKey]} (${[...reasons].join(', ')})`,
    );
    if (clauses.length > 0) {
      notes[key] = `Shares underlying drivers with ${joinWithAnd(clauses)}.`;
    }
  }

  return notes;
}

function buildRecommendations(points: FrictionPoint[]): string[] {
  const recs: string[] = [];
  const seen = new Set<string>();
  const add = (text: string) => {
    if (!seen.has(text)) {
      seen.add(text);
      recs.push(text);
    }
  };

  for (const p of points) {
    switch (true) {
      case p.title.startsWith('Flow has'):
        add('Combine or remove steps — look for review screens or confirmations that can merge with the step before them.');
        break;
      case p.title === 'OTP step introduces drop-off risk':
        add('Show expected OTP delivery time and a visible "Resend code" option after 30 seconds.');
        break;
      case p.title === 'User authenticates more than once':
        add('Persist the session between authentication steps, or combine them into a single identity check.');
        break;
      case p.title === 'No explicit success confirmation':
        add('Add an explicit success screen with a reference number immediately after the transaction completes.');
        break;
      case p.title === 'No visible path when the transaction fails':
        add('Design an explicit failure state with a clear retry or cancel action — never let a payment fail silently.');
        break;
      case p.title === 'Flow depends on an external system':
        add('Set expectations before handing off to an external system, and design an explicit return path back into the flow.');
        break;
      case p.title.startsWith('Manual input required'):
        add('Pre-fill fields from history or device data (e.g. recent recipients, saved amounts) to reduce manual entry.');
        break;
    }
  }

  if (recs.length === 0) {
    add('No major friction points detected. Validate this flow with a small usability test before shipping.');
  }

  return recs;
}

export function severityWeight(s: Severity): number {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}
