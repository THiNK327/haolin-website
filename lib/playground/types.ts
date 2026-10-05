/** Public display capabilities, not authorization rules. The server enforces access. */
export type ModeStatus = 'available' | 'planned' | 'hidden';
export type ToolMode = 'example' | 'interactive';
export interface PlaygroundTool {
  id: string;
  title: string;
  description: string;
  category: string;
  modes: {
    example: ModeStatus;
    interactive: { status: ModeStatus; runtime: 'browser' | 'server' };
  };
  sourceUrl?: string;
}
export type AccessDecision =
  | { status: 'allowed' }
  | { status: 'verification-required'; method: string }
  | { status: 'denied'; message: string };
export interface VerificationProps {
  toolId: string;
  /** Rechecks access with the server; this callback never grants access itself. */
  onComplete: () => void;
}
export interface WorkspaceProps {
  toolId: string;
  run: (input: FormData, signal?: AbortSignal) => Promise<unknown>;
}
