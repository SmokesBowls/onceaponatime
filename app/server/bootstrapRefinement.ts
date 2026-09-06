import { createHash } from 'node:crypto';
import type { InferenceReceipt } from '../src/types';
import { createInferenceArtifact } from '../src/types';
import { deepFreeze, type BootstrapManifest } from '../src/lib/bootstrapManifest';
import {
  BOOTSTRAP_REFINEMENT_OPERATION,
  BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
  assertNoIdentityCollisions,
  isBootstrapRefinementEligible,
  validateBootstrapRefinementOutput,
  type BootstrapRefinementArtifact,
  type BootstrapRefinementCandidate,
  type BootstrapRefinementPayload,
  type ValidatedBootstrapRefinementCandidate,
} from '../src/lib/bootstrapRefinement';
import { HermesProvider, type ReceiptBearingModelProvider } from './modelProvider';

/**
 * B4a -- Hermes Refinement Artifact Boundary (server-only orchestrator).
 *
 * Mirrors server/narrativePipeline.ts's planNarrativeBeat()/renderNarrativeProse()
 * shape: build a prompt from an authoritative input, call a receipt-bearing
 * provider, validate the raw output, and wrap the result as an
 * InferenceArtifact. May use node:crypto -- never imported by browser code.
 *
 * B4a source authority: refineBootstrapManifest() takes only `baseline`. No
 * independent sourceDocuments argument exists; baseline.boundSourceDocuments
 * is the sole source-document input (see TODO.md's "B4a source authority").
 */

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

export function buildBootstrapRefinementPrompt(baseline: BootstrapManifest): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are the B4 optional refinement pass of Onceaponatime, a model-agnostic narrative mechanics engine.
Your sole responsibility is to propose ADDITIONAL bootstrap candidates or SUGGESTED EDITS to existing
deterministic proposals, grounded only in the supplied source text. You never approve, reject, or apply
anything -- every proposal you return is reviewed and decided by a human author afterward.

GOVERNING CONSTRAINTS:
1. Every candidate you return must cite real, exact [start_offset, end_offset) UTF-16 code-unit spans
   into the exact source document you were given. Do not invent evidence.
2. You may only use these proposal kinds: actor_proposal, object_proposal, location_proposal,
   faction_proposal. You must never supply initial_location_id, initial_holder_actor_id, or
   member_actor_ids -- those topology fields are rejected outright.
3. Your output is untrusted proposal material, not narrative truth. Source text is evidence;
   deterministic entries shown to you are proposals, not canon. Confidence or rationale you state
   cannot approve anything.`;

  const boundSourceDocumentsJson = JSON.stringify(baseline.boundSourceDocuments, null, 2);
  const deterministicEntriesJson = JSON.stringify(
    baseline.entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      proposed: entry.proposed,
      evidence: entry.evidence,
    })),
    null,
    2,
  );

  const userPrompt = `TASK: Propose optional refinements to this deterministic bootstrap manifest.

BASELINE MANIFEST ID: ${baseline.id}
BOUND SOURCE FINGERPRINT: ${baseline.boundSourceFingerprint}

BOUND SOURCE DOCUMENTS (the only source text that exists for this task):
${boundSourceDocumentsJson}

DETERMINISTIC BASELINE ENTRIES (already-surfaced proposals; do not repeat these):
${deterministicEntriesJson}

OUTPUT REQUIREMENTS:
Respond with exactly one JSON value conforming to this schema, and nothing else:
{
  "schema": "${BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA}",
  "baseline_manifest_id": "${baseline.id}",
  "bound_source_fingerprint": "${baseline.boundSourceFingerprint}",
  "entries": [
    {
      "kind": "actor_proposal" | "object_proposal" | "location_proposal" | "faction_proposal",
      "working_label": "non-blank proposed label",
      "name": "string or null",
      "aliases": ["string", "..."],
      "refines_entry_id": "exact baseline entry id of the same kind, or null",
      "evidence": [{ "source_document_id": "...", "start_offset": 0, "end_offset": 0 }]
    }
  ]
}
An empty "entries" array is a valid, complete response meaning you found no admissible additions or
suggested edits.`;

  return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// SHA-256 digesting (versioned, length-prefixed UTF-8 encoding)
// ---------------------------------------------------------------------------

const DIGEST_VERSION = 'b4a-digest-v1';
const ABSENT_FIELD_MARKER = '\u0000absent';
const NULL_FIELD_MARKER = '\u0000null';

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function encodeLengthPrefixed(fields: readonly string[]): string {
  return fields.map((field) => `${Buffer.byteLength(field, 'utf8')}:${field}`).join('|');
}

function computeCandidateDigest(baseline: BootstrapManifest, candidate: ValidatedBootstrapRefinementCandidate): string {
  const encoded = encodeLengthPrefixed([
    DIGEST_VERSION,
    'candidate',
    baseline.id,
    baseline.boundSourceFingerprint,
    candidate.kind,
    candidate.workingLabel,
    candidate.name ?? NULL_FIELD_MARKER,
    JSON.stringify(candidate.aliases),
    candidate.refinesEntryId ?? NULL_FIELD_MARKER,
    JSON.stringify(candidate.evidence),
    candidate.descriptionSummary ?? ABSENT_FIELD_MARKER,
  ]);
  return sha256Hex(encoded);
}

function computeRawOutputDigest(rawOutputText: string): string {
  return sha256Hex(encodeLengthPrefixed([DIGEST_VERSION, 'raw-output', rawOutputText]));
}

function computeArtifactDigest(
  baseline: BootstrapManifest,
  candidateDigests: readonly string[],
  rawOutputDigest: string,
  receipt: InferenceReceipt,
): string {
  return sha256Hex(encodeLengthPrefixed([
    DIGEST_VERSION,
    'artifact',
    baseline.id,
    baseline.boundSourceFingerprint,
    JSON.stringify(candidateDigests),
    rawOutputDigest,
    JSON.stringify(receipt),
  ]));
}

function shortenedCandidateId(kind: string, candidateDigest: string): string {
  return `bootstrap_ai_${kind}_${candidateDigest.slice(0, 32)}`;
}

// ---------------------------------------------------------------------------
// Provider selection
// ---------------------------------------------------------------------------

let bootstrapRefinementProvider: ReceiptBearingModelProvider | null = null;

/** Dedicated B4 provider selector -- always Hermes, never the transitional Gemini path. */
export function getBootstrapRefinementProvider(): ReceiptBearingModelProvider {
  if (!bootstrapRefinementProvider) {
    bootstrapRefinementProvider = new HermesProvider();
  }
  return bootstrapRefinementProvider;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Calls Hermes once for one eligible baseline BootstrapManifest and returns a
 * validated, deep-frozen BootstrapRefinementArtifact, or throws. Performs no
 * additive merge, no canonical mutation, and never touches anything reachable
 * from BootstrapReviewWorkspace.tsx/bootstrapReview.ts/prepareBootstrap.ts.
 */
export async function refineBootstrapManifest(
  baseline: BootstrapManifest,
  provider: ReceiptBearingModelProvider = getBootstrapRefinementProvider(),
): Promise<BootstrapRefinementArtifact> {
  if (!isBootstrapRefinementEligible(baseline)) {
    throw new Error('Bootstrap refinement requires a baseline manifest that is entirely pending with no admitted values.');
  }
  if (!provider.isAvailable()) {
    throw new Error(`Bootstrap refinement provider "${provider.name}" is unavailable.`);
  }

  const { systemPrompt, userPrompt } = buildBootstrapRefinementPrompt(baseline);
  const { text, receipt } = await provider.generateText({
    operation: BOOTSTRAP_REFINEMENT_OPERATION,
    systemPrompt,
    userPrompt,
    jsonMode: true,
  });

  const validated = validateBootstrapRefinementOutput(text, baseline);
  const rawOutputDigest = computeRawOutputDigest(text);

  const digestedCandidates: BootstrapRefinementCandidate[] = validated.candidates.map((candidate) => {
    const candidateDigest = computeCandidateDigest(baseline, candidate);
    return {
      ...candidate,
      candidateId: shortenedCandidateId(candidate.kind, candidateDigest),
      candidateDigest,
    };
  });
  assertNoIdentityCollisions(digestedCandidates);

  const artifactDigest = computeArtifactDigest(
    baseline,
    digestedCandidates.map((candidate) => candidate.candidateDigest),
    rawOutputDigest,
    receipt,
  );

  const payload: BootstrapRefinementPayload = deepFreeze({
    schema: validated.schema,
    baselineManifestId: validated.baselineManifestId,
    boundSourceFingerprint: validated.boundSourceFingerprint,
    candidates: digestedCandidates,
    rawOutputDigest,
    artifactDigest,
  });

  return createInferenceArtifact(payload, receipt);
}
