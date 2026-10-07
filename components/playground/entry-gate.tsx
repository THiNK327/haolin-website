'use client';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import type { AccessDecision, VerificationProps } from '../../lib/playground/types';

type GateState = AccessDecision | { status: 'checking' } | { status: 'error'; message: string };
interface EntryGateProps {
  toolId: string;
  checkAccess: (signal: AbortSignal) => Promise<AccessDecision>;
  verificationProviders: Partial<Record<string, ComponentType<VerificationProps>>>;
  children: ReactNode;
}

/** Input components are NOT mounted until access is granted. Not a security boundary:
 * the backend must validate sessions and limits independently on every request. */
export function EntryGate({ toolId, checkAccess, verificationProviders, children }: EntryGateProps) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ state: GateState; toolId: string; checkAccess: EntryGateProps['checkAccess']; attempt: number } | null>(null);
  // A changed tool, checker, or retry invalidates the old grant during render,
  // not one effect later. An old allowed state cannot briefly expose new inputs.
  const state: GateState = result && result.toolId === toolId && result.checkAccess === checkAccess && result.attempt === attempt
    ? result.state : { status: 'checking' };
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    Promise.resolve().then(() => checkAccess(controller.signal)).then(decision => {
      if (!controller.signal.aborted) setResult({ state: decision, toolId, checkAccess, attempt });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ state: { status: 'error', message: error instanceof Error ? error.message : 'Access could not be confirmed.' }, toolId, checkAccess, attempt });
    });
    return () => controller.abort();
  }, [toolId, checkAccess, attempt]);

  const recheck = () => {
    setResult(null);
    setAttempt(value => value + 1);
  };
  if (state.status === 'allowed') return <>{children}</>;
  if (state.status === 'checking') return <div className="tool-notice" role="status"><h2>Checking access</h2><p>This happens before you enter or upload any data.</p></div>;
  if (state.status === 'verification-required') {
    const Verification = Object.prototype.hasOwnProperty.call(verificationProviders, state.method) ? verificationProviders[state.method] : undefined;
    return <div className="tool-notice"><h2>Verify to continue</h2><p>Complete this step first. Your workspace will open afterward.</p>{Verification
      ? <Verification toolId={toolId} onComplete={recheck}/>
      : <p role="alert">Verification is not available for this tool yet. Please explore the examples instead.</p>}</div>;
  }
  return <div className="tool-notice" role="alert"><h2>{state.status === 'denied' ? 'Interactive access unavailable' : 'Unable to open the workspace'}</h2><p>{state.message}</p>{state.status === 'error' && <button type="button" className="button secondary" onClick={recheck}>Retry access check</button>}</div>;
}
