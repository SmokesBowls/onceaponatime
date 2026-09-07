import { parseJsonNoDuplicateKeys } from '../src/lib/bootstrapRefinement';
import type { BootstrapManifest } from '../src/lib/bootstrapManifest';
import type { BootstrapRefinementArtifact } from '../src/lib/bootstrapRefinement';
import { refineBootstrapManifest } from './bootstrapRefinement';

/**
 * B4c1 -- the /api/bootstrap/refine route's transport/envelope logic,
 * extracted from server.ts's route registration so it is directly testable
 * without live-HTTP integration machinery (mirroring how
 * server/narrativePipeline.ts already separates orchestration from
 * server.ts's thin routes).
 *
 * Frozen HTTP meaning (TODO.md's B4c1 contract):
 *   400 = the server could not admit the request into the bootstrap-
 *         refinement operation boundary at all (malformed envelope/transport).
 *   500 = the request entered that boundary, but refinement did not
 *         successfully produce an artifact (structural/eligibility/
 *         provider/model failure -- refineBootstrapManifest()'s own thrown
 *         reason is the truth, not the code).
 *
 * Never imports or calls the B4b merge function -- merge is client-side
 * only (App.tsx), per the frozen contract.
 */

export type BootstrapRefineRouteResponseBody =
  | { readonly success: true; readonly artifact: BootstrapRefinementArtifact }
  | { readonly success: false; readonly error: string };

export interface BootstrapRefineRouteResult {
  readonly status: number;
  readonly body: BootstrapRefineRouteResponseBody;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeFailure(err: unknown): string {
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  if (typeof err === 'string' && err.trim().length > 0) return err;
  return 'Bootstrap refinement failed for an unknown reason.';
}

export async function handleBootstrapRefineRequest(
  rawBody: Buffer | string,
  refine: (baseline: BootstrapManifest) => Promise<BootstrapRefinementArtifact> = refineBootstrapManifest,
): Promise<BootstrapRefineRouteResult> {
  let text: string;
  try {
    text = typeof rawBody === 'string' ? rawBody : new TextDecoder('utf-8', { fatal: true }).decode(rawBody);
  } catch {
    return { status: 400, body: { success: false, error: 'Request body is not valid UTF-8.' } };
  }

  let parsed: unknown;
  try {
    parsed = parseJsonNoDuplicateKeys(text);
  } catch (err) {
    return { status: 400, body: { success: false, error: describeFailure(err) } };
  }

  if (!isRecord(parsed) || Object.keys(parsed).length !== 1 || !('baseline' in parsed)) {
    return {
      status: 400,
      body: { success: false, error: 'Bootstrap refinement request body must contain exactly one key: "baseline".' },
    };
  }

  try {
    const artifact = await refine(parsed.baseline as BootstrapManifest);
    return { status: 200, body: { success: true, artifact } };
  } catch (err) {
    return { status: 500, body: { success: false, error: describeFailure(err) } };
  }
}
