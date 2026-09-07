import type { AuthorSourceDocument } from '../types';
import {
  SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS,
  deepFreeze,
  expectedBootstrapManifestId,
  expectedEntryId,
  fingerprintEntrySources,
  isBootstrapEntityProposal,
  validateBootstrapManifestStructure,
  type BootstrapEntrySource,
  type BootstrapManifest,
  type BootstrapManifestEntry,
  type BootstrapManifestRefinementMetadata,
  type BootstrapProposal,
  type BootstrapProposalKind,
  type BootstrapRefinementProvenance,
  type BootstrapSuggestedRefinement,
  type SourceEvidenceUnit,
} from './bootstrapManifest';
import {
  BOOTSTRAP_REFINEMENT_OPERATION,
  type BootstrapRefinementArtifact,
  type BootstrapRefinementCandidate,
  type BootstrapRefinementEvidenceCitation,
} from './bootstrapRefinement';

/**
 * B4b -- Refinement Merge (pure, browser-safe).
 *
 * Consumes an exact baseline BootstrapManifest and an exact, already-validated
 * BootstrapRefinementArtifact (as B4a produces) and returns a new, combined
 * BootstrapManifest. Mutates neither argument. Calls no Hermes provider,
 * renders no UI, selects no suggestion, mutates no author decision, and never
 * touches prepareBootstrap.ts or StoryProject -- see TODO.md's "B4b --
 * Refinement Merge" contract.
 */
export function mergeBootstrapRefinementArtifact(
  baseline: BootstrapManifest,
  artifact: BootstrapRefinementArtifact,
): BootstrapManifest {
  // ---------------------------------------------------------------------
  // Baseline binding -- merge only into the exact baseline the artifact was
  // produced against, re-checked here rather than trusted from B4a.
  // ---------------------------------------------------------------------
  validateBootstrapManifestStructure(baseline);
  if (artifact.receipt.operation !== BOOTSTRAP_REFINEMENT_OPERATION) {
    throw new Error('Bootstrap refinement merge requires an artifact whose receipt operation is onceaponatime.bootstrap.refine.');
  }
  if (artifact.value.baselineManifestId !== baseline.id) {
    throw new Error('Bootstrap refinement merge requires an artifact produced against this exact baseline manifest.');
  }
  if (artifact.value.boundSourceFingerprint !== baseline.boundSourceFingerprint) {
    throw new Error('Bootstrap refinement merge requires an artifact produced against this exact bound source.');
  }
  if (baseline.refinementMetadata !== undefined) {
    // Per the master B4 contract's "at most one successful refinement artifact may be merged into
    // one baseline manifest... AI-on-AI iterative refinement is out of scope": an already-combined
    // manifest is never itself eligible as a merge target, regardless of which artifact is offered.
    // Without this, a *different*, correctly-bound second artifact would silently pass the identity
    // checks above and overwrite refinementMetadata while dropping every earlier entry's own
    // refinementProvenance/suggestedRefinements (the rebase pass below only carries forward what the
    // baseline entries themselves currently hold, which does not include a prior merge's additions).
    throw new Error(
      'Bootstrap refinement merge requires a baseline manifest that has not already been merged '
      + '-- AI-on-AI iterative refinement is out of scope.',
    );
  }
  for (const entry of baseline.entries) {
    if (entry.decision !== 'pending' || entry.admitted !== undefined) {
      throw new Error(
        'Bootstrap refinement merge requires a baseline manifest that is entirely pending with no admitted values '
        + '-- author review having begun, or a prior merge, makes this baseline ineligible.',
      );
    }
  }

  // ---------------------------------------------------------------------
  // Re-resolve every candidate's evidence against the ACTUAL current
  // baseline source, never trusting the artifact's embedded exactText.
  // ---------------------------------------------------------------------
  const revalidated = artifact.value.candidates.map((candidate) => ({
    candidate,
    evidence: candidate.evidence.map((citation) => revalidateCitation(citation, baseline.boundSourceDocuments)),
  }));

  // ---------------------------------------------------------------------
  // Resolve suggestion targets against the ORIGINAL baseline entry ids
  // (exact identity + matching kind only -- never label/alias/fuzzy).
  // ---------------------------------------------------------------------
  for (const { candidate } of revalidated) {
    if (candidate.refinesEntryId === null) continue;
    const target = baseline.entries.find((entry) => entry.id === candidate.refinesEntryId);
    if (!target || target.kind !== candidate.kind) {
      throw new Error(
        `Bootstrap refinement merge: suggestion targets a missing or wrong-kind baseline entry: ${candidate.refinesEntryId}`,
      );
    }
  }

  // ---------------------------------------------------------------------
  // An addition's derived proposal id must not collide with any existing
  // baseline proposal id. (Collision among candidates themselves is
  // already B4a's job via assertNoIdentityCollisions; re-derived here only
  // against the baseline, never re-checked among candidates.)
  // ---------------------------------------------------------------------
  const baselineProposalIds = new Set(
    baseline.entries
      .filter((entry) => isBootstrapEntityProposal(entry.proposed))
      .map((entry) => (entry.proposed as { id: string }).id),
  );
  for (const { candidate } of revalidated) {
    if (candidate.refinesEntryId === null && baselineProposalIds.has(candidate.candidateId)) {
      throw new Error(
        `Bootstrap refinement merge: addition id collides with an existing baseline proposal id: ${candidate.candidateId}`,
      );
    }
  }

  // ---------------------------------------------------------------------
  // Phase 1: assemble entry sources (content only) in order -- rebased
  // baseline entries first (original order), then AI additions (candidate
  // order). Suggestions attach to their baseline target's own assembled
  // entry. A suggestion's refinesBaselineEntryId is set to the ORIGINAL
  // baseline entry id for now (fingerprintEntrySources ignores this field
  // entirely, so this placeholder never affects manifest identity); it is
  // rewritten to the real rebased id in phase 2 below, once known.
  // ---------------------------------------------------------------------
  interface Assembled extends BootstrapEntrySource {
    readonly originalBaselineEntryId?: string;
  }

  const suggestionsByTargetId = new Map<string, BootstrapSuggestedRefinement[]>();
  for (const { candidate, evidence } of revalidated) {
    if (candidate.refinesEntryId === null) continue;
    const targetOriginal = baseline.entries.find((entry) => entry.id === candidate.refinesEntryId)!;
    const suggestion: BootstrapSuggestedRefinement = {
      suggested: buildProposalFromCandidate(candidate, requireEntityProposalId(targetOriginal.proposed)),
      // The already re-validated evidence for this exact candidate (see the revalidated array
      // above) -- never the target entry's own evidence, and never re-derived here.
      evidence,
      provenance: { candidateDigest: candidate.candidateDigest, refinesBaselineEntryId: candidate.refinesEntryId },
    };
    const existing = suggestionsByTargetId.get(candidate.refinesEntryId) ?? [];
    suggestionsByTargetId.set(candidate.refinesEntryId, [...existing, suggestion]);
  }

  const assembled: Assembled[] = baseline.entries.map((entry) => ({
    originalBaselineEntryId: entry.id,
    kind: entry.kind,
    sourceIndex: entry.sourceIndex,
    proposed: entry.proposed,
    evidence: entry.evidence,
    ...(entry.discoveryConfidence === undefined ? {} : { discoveryConfidence: entry.discoveryConfidence }),
    ...(suggestionsByTargetId.has(entry.id) ? { suggestedRefinements: suggestionsByTargetId.get(entry.id) } : {}),
  }));

  const nextSourceIndexByKind = new Map<BootstrapProposalKind, number>();
  for (const entry of baseline.entries) {
    const current = nextSourceIndexByKind.get(entry.kind) ?? 0;
    nextSourceIndexByKind.set(entry.kind, Math.max(current, entry.sourceIndex + 1));
  }

  const additionEntries: Assembled[] = [];
  const additionCandidateByIndex = new Map<number, BootstrapRefinementCandidate>();
  for (const { candidate, evidence } of revalidated) {
    if (candidate.refinesEntryId !== null) continue;
    const sourceIndex = nextSourceIndexByKind.get(candidate.kind) ?? 0;
    nextSourceIndexByKind.set(candidate.kind, sourceIndex + 1);
    const entry: Assembled = {
      kind: candidate.kind,
      sourceIndex,
      proposed: buildProposalFromCandidate(candidate, candidate.candidateId),
      evidence,
      refinementProvenance: { candidateDigest: candidate.candidateDigest },
    };
    additionCandidateByIndex.set(additionEntries.length, candidate);
    additionEntries.push(entry);
  }

  const allSources: Assembled[] = [...assembled, ...additionEntries];

  // ---------------------------------------------------------------------
  // Manifest identity, computed exactly like B1's own buildBootstrapManifest:
  // entriesFingerprint over content, then the manifest id, then every entry
  // id via the exact same exported expectedEntryId() rule.
  // ---------------------------------------------------------------------
  const entriesFingerprint = fingerprintEntrySources(allSources, {
    baselineManifestId: baseline.id,
    artifactDigest: artifact.value.artifactDigest,
    rawOutputDigest: artifact.value.rawOutputDigest,
  });
  const manifestId = expectedBootstrapManifestId(baseline.projectId, baseline.boundSourceFingerprint, entriesFingerprint);

  // ---------------------------------------------------------------------
  // Phase 2: assign real entry ids, rewrite suggestion refinesBaselineEntryId
  // to the now-known rebased target id, and build the immutable entry-id map.
  // ---------------------------------------------------------------------
  const entryIdMap: Record<string, string> = {};
  const finalEntries: BootstrapManifestEntry[] = [];

  for (const source of assembled) {
    const id = expectedEntryId(manifestId, source.kind, source.sourceIndex);
    entryIdMap[source.originalBaselineEntryId!] = id;
    const suggestedRefinements = source.suggestedRefinements;
    finalEntries.push({
      id,
      kind: source.kind,
      sourceIndex: source.sourceIndex,
      proposed: source.proposed,
      decision: 'pending',
      evidence: source.evidence,
      ...(source.discoveryConfidence === undefined ? {} : { discoveryConfidence: source.discoveryConfidence }),
      supportedForApplication: SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS.has(source.kind),
      ...(suggestedRefinements === undefined ? {} : {
        suggestedRefinements: suggestedRefinements.map((s) => ({
          suggested: s.suggested,
          evidence: s.evidence,
          provenance: { candidateDigest: s.provenance.candidateDigest, refinesBaselineEntryId: id },
        })),
      }),
    });
  }

  additionEntries.forEach((source, index) => {
    const id = expectedEntryId(manifestId, source.kind, source.sourceIndex);
    const candidate = additionCandidateByIndex.get(index)!;
    const refinementProvenance: BootstrapRefinementProvenance = { candidateDigest: candidate.candidateDigest };
    finalEntries.push({
      id,
      kind: source.kind,
      sourceIndex: source.sourceIndex,
      proposed: source.proposed,
      decision: 'pending',
      evidence: source.evidence,
      supportedForApplication: true,
      refinementProvenance,
    });
  });

  const refinementMetadata: BootstrapManifestRefinementMetadata = {
    baselineManifestId: baseline.id,
    entryIdMap,
    artifactDigest: artifact.value.artifactDigest,
    rawOutputDigest: artifact.value.rawOutputDigest,
    receipt: artifact.receipt,
  };

  return deepFreeze({
    id: manifestId,
    projectId: baseline.projectId,
    boundSourceDocuments: baseline.boundSourceDocuments,
    boundSourceFingerprint: baseline.boundSourceFingerprint,
    entriesFingerprint,
    entries: finalEntries,
    refinementMetadata,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function revalidateCitation(
  citation: BootstrapRefinementEvidenceCitation,
  boundSourceDocuments: readonly AuthorSourceDocument[],
): SourceEvidenceUnit {
  const document = boundSourceDocuments.find((doc) => doc.id === citation.sourceDocumentId);
  if (!document) {
    throw new Error(`Bootstrap refinement merge: evidence citation references an unbound source document: ${citation.sourceDocumentId}`);
  }
  if (
    !Number.isSafeInteger(citation.startOffset) || citation.startOffset < 0
    || !Number.isSafeInteger(citation.endOffset) || citation.endOffset <= citation.startOffset
    || citation.endOffset > document.exactText.length
  ) {
    throw new Error('Bootstrap refinement merge: evidence citation has an invalid offset range into its source document.');
  }
  const actualSlice = document.exactText.slice(citation.startOffset, citation.endOffset);
  if (actualSlice !== citation.exactText) {
    throw new Error(
      `Bootstrap refinement merge: evidence citation exactText does not match the bound source document at `
      + `[${citation.startOffset}, ${citation.endOffset}).`,
    );
  }
  return {
    sourceDocumentId: citation.sourceDocumentId,
    // "b4:" distinguishes a B4-originated unit from a B2 unit that happens to cite the identical
    // span, purely for clarity -- no B1/B2 machinery keys off this prefix.
    unitId: `source-unit:b4:${encodeURIComponent(citation.sourceDocumentId)}:${citation.startOffset}:${citation.endOffset}`,
    startOffset: citation.startOffset,
    endOffset: citation.endOffset,
    exactText: citation.exactText,
  };
}

function requireEntityProposalId(proposed: BootstrapProposal): string {
  if (!isBootstrapEntityProposal(proposed)) {
    throw new Error('Bootstrap refinement merge: suggestion target is not an entity proposal.');
  }
  return proposed.id;
}

/**
 * Builds a full BootstrapProposal from a validated candidate. `id` is the
 * candidate's own derived id for an addition, or the exact existing target
 * proposal id for a suggestion -- never a new id -- so a chosen suggestion
 * keeps referring to the same canonical entity id as anything else in the
 * manifest that might reference it. Never includes a topology field
 * (initial_location_id/initial_holder_actor_id/member_actor_ids); B4a's own
 * validation already guarantees candidates never carry one.
 */
function buildProposalFromCandidate(candidate: BootstrapRefinementCandidate, id: string): BootstrapProposal {
  const base = {
    id,
    working_label: candidate.workingLabel,
    name: candidate.name,
    aliases: [...candidate.aliases],
  };
  switch (candidate.kind) {
    case 'actor_proposal':
      return { kind: 'actor_proposal', ...base };
    case 'object_proposal':
      return { kind: 'object_proposal', ...base };
    case 'location_proposal':
      return {
        kind: 'location_proposal',
        ...base,
        ...(candidate.descriptionSummary === undefined ? {} : { description_summary: candidate.descriptionSummary }),
      };
    case 'faction_proposal':
      return { kind: 'faction_proposal', ...base };
  }
}
