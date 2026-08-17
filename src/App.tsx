import { useRef, useState } from 'react';
import { Landing } from './components/Landing';
import { LoadingState } from './components/LoadingState';
import { ResultsView } from './components/ResultsView';
import { ErrorState } from './components/ErrorState';
import { ThemeToggle } from './components/ThemeToggle';
import { analyzeFlow } from './lib/analyzeFlow';
import { FlowAnalysisError } from './types';
import type { AnalysisResult } from './types';

type Status = 'idle' | 'loading' | 'results' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  EMPTY_FLOW:
    "We couldn't find any steps in that description. Try separating steps with an arrow, like: Open app → Login → Payments.",
  UNREADABLE_FLOW:
    "That doesn't look like a flow description yet. Add a few words for each step, such as \"Login\" or \"Enter amount\".",
  UNKNOWN: 'Something went wrong while analyzing this flow. Try simplifying the description and analyzing again.',
};

function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [flowText, setFlowText] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const timeoutRef = useRef<number | null>(null);

  function handleAnalyze(text: string) {
    setFlowText(text);
    setStatus('loading');

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      try {
        const analysis = analyzeFlow(text);
        setResult(analysis);
        setStatus('results');
      } catch (err) {
        if (err instanceof FlowAnalysisError) {
          setErrorMessage(ERROR_MESSAGES[err.code] ?? ERROR_MESSAGES.UNKNOWN);
        } else {
          setErrorMessage(ERROR_MESSAGES.UNKNOWN);
        }
        setStatus('error');
      }
    }, 1150);
  }

  function handleReset() {
    setResult(null);
    setFlowText('');
    setStatus('idle');
  }

  function handleRetry() {
    setStatus('idle');
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="16" cy="16" r="14" fill="none" stroke="var(--color-text-primary)" strokeWidth="2.2" />
              <path d="M16 16 L22.5 10.5" stroke="var(--color-brand)" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="16" cy="16" r="2.2" fill="var(--color-brand)" />
            </svg>
            <span className="text-sm font-semibold tracking-tight text-text-primary">Friction Analyzer</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1">
        {status === 'idle' && <Landing onAnalyze={handleAnalyze} initialValue={flowText} />}
        {status === 'loading' && <LoadingState />}
        {status === 'results' && result && <ResultsView result={result} onReset={handleReset} />}
        {status === 'error' && <ErrorState message={errorMessage} onRetry={handleRetry} />}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-text-muted">
          Friction Analyzer runs a deterministic, rule-based UX heuristic locally in your browser — it is not an AI
          model and does not send your flow anywhere.
        </div>
      </footer>
    </div>
  );
}

export default App;
