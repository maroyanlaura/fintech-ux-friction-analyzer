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

const ANY_PATTERN_RE = [
  OTP_RE,
  AUTH_RE,
  PAYMENT_RE,
  MANUAL_ENTRY_RE,
  EXTERNAL_DEP_RE,
  CONFIRM_RE,
  ERROR_RECOVERY_RE,
  SUCCESS_RE,
];

/** Categories of issues this tool checks for. Kept in sync with the rules below — update this alongside any new/changed rule. */
export const CHECK_CATEGORIES: string[] = [
  'Flow length',
  'OTP / one-time code usage',
  'Repeated authentication',
  'Missing success confirmation',
  'Missing error recovery',
  'External system dependencies',
  'Manual entry load',
];

/** Minimum proportion of steps that must match at least one known pattern before we treat the analysis as confident. */
const MIN_COVERAGE_RATIO = 0.5;

/** A step only counts as genuinely satisfying a rule if it has real content beyond the matched trigger words — prevents a step like "error retry cancel fallback support" from counting as real error handling. */
const MIN_NON_TRIGGER_WORDS = 2;

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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Words in `label` consumed by matches of `regex` don't count toward its "real content." */
function nonTriggerWordCount(label: string, regex: RegExp): number {
  const totalWords = wordCount(label);
  if (totalWords === 0) return 0;
  const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
  const matches = label.match(globalRegex) || [];
  const matchedWords = matches.reduce((sum, m) => sum + wordCount(m), 0);
  return Math.max(0, totalWords - matchedWords);
}

/** A step "genuinely" satisfies a rule only if it matches AND has enough content beyond the trigger words themselves. */
function isSubstantiveMatch(label: string, regex: RegExp): boolean {
  return regex.test(label) && nonTriggerWordCount(label, regex) >= MIN_NON_TRIGGER_WORDS;
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
  const hasErrorRecovery = steps.some((s) => isSubstantiveMatch(s.label, ERROR_RECOVERY_RE));
  const hasSuccessFeedback = steps.some((s) => isSubstantiveMatch(s.label, SUCCESS_RE));

  const matchedStepCount = steps.filter((s) => ANY_PATTERN_RE.some((re) => re.test(s.label))).length;
  const lowCoverage = matchedStepCount / steps.length < MIN_COVERAGE_RATIO;

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
    ),
    numberOfSteps: metric(
      'Number of Steps',
      numberOfStepsScore,
      `${steps.length} step${steps.length === 1 ? '' : 's'} from start to completion.`,
    ),
    errorRisk: metric(
      'Error Risk',
      errorRiskScore,
      hasErrorRecovery
        ? 'Flow references error handling.'
        : paymentSteps.length > 0
          ? 'No error or retry path stated for the transaction.'
          : 'No transaction step detected.',
    ),
    userEffort: metric(
      'User Effort',
      userEffortScore,
      `${manualEntrySteps.length} field${manualEntrySteps.length === 1 ? '' : 's'} to fill, ${otpSteps.length} code${otpSteps.length === 1 ? '' : 's'} to retrieve.`,
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
    matchedStepCount,
    lowCoverage,
  };
}

function metric(label: string, score: number, detail: string): MetricBreakdown {
  return { label, score, detail };
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
    add(
      'This flow passed all currently automated checks. As optional additional diligence, consider validating it with a small usability test.',
    );
  }

  return recs;
}

export function severityWeight(s: Severity): number {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}
