export type Severity = 'low' | 'medium' | 'high';
export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface FlowStep {
  index: number;
  label: string;
}

export interface FrictionPoint {
  id: string;
  severity: Severity;
  title: string;
  explanation: string;
  affectedStepIndex: number;
}

export interface MetricBreakdown {
  label: string;
  score: number;
  detail: string;
}

export interface AnalysisBreakdown {
  cognitiveLoad: MetricBreakdown;
  numberOfSteps: MetricBreakdown;
  errorRisk: MetricBreakdown;
  userEffort: MetricBreakdown;
}

export interface AnalysisResult {
  rawInput: string;
  steps: FlowStep[];
  frictionScore: number;
  riskLevel: RiskLevel;
  breakdown: AnalysisBreakdown;
  frictionPoints: FrictionPoint[];
  recommendations: string[];
  matchedStepCount: number;
  lowCoverage: boolean;
}

export class FlowAnalysisError extends Error {
  code: 'EMPTY_FLOW' | 'UNREADABLE_FLOW';

  constructor(code: 'EMPTY_FLOW' | 'UNREADABLE_FLOW', message: string) {
    super(message);
    this.code = code;
    this.name = 'FlowAnalysisError';
  }
}
