import type { ValidationReport } from '../types';

/**
 * Extracts a useful, author-facing message from a caught error/rejection of
 * unknown shape. Framework execution and promotion both fail closed with a
 * real Error carrying a specific reason (see HERMES_INFERENCE_CONTRACT.md);
 * this only has to stay honest when something throws a non-Error value.
 */
export function describeOperationFailure(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  if (typeof err === 'string' && err.trim().length > 0) return err;
  return 'An unknown error occurred.';
}

export type WorkbenchOperationSource = 'execute' | 'promote';

export interface WorkbenchOperationError {
  readonly source: WorkbenchOperationSource;
  readonly message: string;
}

/** Wraps a caught error into the compact, author-visible Workbench error state. */
export function workbenchOperationError(
  source: WorkbenchOperationSource,
  err: unknown,
): WorkbenchOperationError {
  return { source, message: describeOperationFailure(err) };
}

/**
 * Builds the ValidationReport a candidate must carry when its revalidation
 * request fails. This must never resemble a passing/verified result: an
 * author who just edited the candidate's prose must not see the *previous*
 * validation verdict presented as if it still applied to the new text.
 */
export function revalidationFailureReport(
  err: unknown,
  previous: ValidationReport,
): ValidationReport {
  const reason = describeOperationFailure(err);
  return {
    passed: false,
    score: 0,
    verified: false,
    status: 'UNVERIFIED',
    diagnostics: [
      {
        severity: 'FATAL',
        rule: 'REVALIDATION_FAILED',
        message: `Revalidation failed: ${reason}`,
        remedy: 'Edit the prose again or retry. The previous validation result no longer applies to this text.',
      },
    ],
    notes: `Revalidation could not complete. The prior result (${previous.status}, `
      + `${previous.score}/100) is stale and must not be trusted for the current text.`,
  };
}
