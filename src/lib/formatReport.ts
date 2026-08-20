import type { AnalysisResult } from '../types';
import { severityWeight } from './analyzeFlow';

/** Plain-text rendering of an analysis result, for the results page's copy-to-clipboard action. */
export function formatReportAsText(result: AnalysisResult): string {
  const lines: string[] = [];

  lines.push('Fintech UX Friction Analyzer — Friction Report');
  lines.push('');
  lines.push(`Friction Score: ${result.frictionScore}/100 (${result.riskLevel} risk)`);
  lines.push('');
  lines.push('Breakdown:');
  lines.push(`- Cognitive Load: ${result.breakdown.cognitiveLoad.score} — ${result.breakdown.cognitiveLoad.detail}`);
  lines.push(`- Number of Steps: ${result.breakdown.numberOfSteps.score} — ${result.breakdown.numberOfSteps.detail}`);
  lines.push(`- Error Risk: ${result.breakdown.errorRisk.score} — ${result.breakdown.errorRisk.detail}`);
  lines.push(`- User Effort: ${result.breakdown.userEffort.score} — ${result.breakdown.userEffort.detail}`);
  lines.push('');

  const sortedPoints = [...result.frictionPoints].sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
  );

  lines.push(`Friction Points (${sortedPoints.length}):`);
  if (sortedPoints.length === 0) {
    lines.push('- None detected.');
  } else {
    sortedPoints.forEach((p, i) => {
      const stepLabel = result.steps.find((s) => s.index === p.affectedStepIndex)?.label ?? '';
      lines.push(
        `${i + 1}. [${p.severity.toUpperCase()}] ${p.title} (Step ${p.affectedStepIndex + 1}: ${stepLabel})`,
      );
      lines.push(`   ${p.explanation}`);
    });
  }
  lines.push('');

  lines.push('Recommendations:');
  result.recommendations.forEach((rec) => lines.push(`- ${rec}`));

  return lines.join('\n');
}
