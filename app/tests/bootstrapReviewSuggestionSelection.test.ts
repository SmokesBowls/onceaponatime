import assert from 'node:assert/strict';
import type { AuthorSourceDocument, InferenceReceipt, StoryProject } from '../src/types';
import { createInferenceArtifact } from '../src/types';
import {
  buildBootstrapManifest,
  decideBootstrapManifestEntry,
  fingerprintBootstrapAdmission,
  validateBootstrapManifestStructure,
  type BootstrapDiscoveryConfidence,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapManifestEntry,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { prepareBootstrap, resolveAdmittedBootstrapProposal, type BootstrapReceiptEntry } from '../src/lib/prepareBootstrap';
import { decideBootstrapReviewEntry, selectBootstrapReviewSuggestion } from '../src/lib/bootstrapReview';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import {
  BOOTSTRAP_REFINEMENT_OPERATION,
  BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
  type BootstrapRefinementArtifact,
  type BootstrapRefinementCandidate,
  type BootstrapRefinementCandidateKind,
  type BootstrapRefinementEvidenceCitation,
  type BootstrapRefinementPayload,
} from '../src/lib/bootstrapRefinement';
import { mergeBootstrapRefinementArtifact } from '../src/lib/bootstrapRefinementMerge';

/**
 * B4c3 RED gate -- pure decision/identity/authority logic (RED gate items
 * 1-9, 12-14 in TODO.md's frozen B4c3 contract, fce0df9). UI presentation
 * (items 10, 11, 15) lives in bootstrapReviewWorkspaceSuggestionSelection.test.tsx.
 *
 * This file requires two pieces of new surface that do not exist yet on
 * `main`, both frozen in the contract:
 *
 * - `BootstrapManifestEntry.selectedRefinementCandidateDigest` and a new
 *   optional parameter of the same name on `decideBootstrapManifestEntry()`.
 * - `selectBootstrapReviewSuggestion()`, a new controller export from
 *   src/lib/bootstrapReview.ts.
 *
 * Everything else (buildBootstrapManifest, decideBootstrapReviewEntry,
 * mergeBootstrapRefinementArtifact, prepareBootstrap, fingerprintBootstrapAdmission)
 * is real, already-shipped B1/B2/B3/B4a/B4b/B4c1/B4c2 authority, exercised
 * here exactly as it already exists.
 */

const WELL_CONFIDENCE: BootstrapDiscoveryConfidence = {
  classification: 'corroborated',
  supportingUnitCount: 1,
  reasons: ['strong_place_preposition'],
};

function sourceOnlyProject(): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4c3_selection',
    projectTitle: 'B4c3 Selection Fixture',
    sourceLabel: 'Chapter One',
    pastedText: 'Locke found Mara near the old well. Isla stood by the gate. Ulric watched from the ridge.',
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4c3_selection',
  });
}

function firstDoc(project: StoryProject): AuthorSourceDocument {
  const doc = (project.sourceDocuments ?? [])[0];
  assert.ok(doc, 'fixture requires a source document');
  return doc;
}

function evidenceFor(doc: AuthorSourceDocument, unitId: string, substring: string): SourceEvidenceUnit {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found`);
  return { sourceDocumentId: doc.id, unitId, startOffset: start, endOffset: start + substring.length, exactText: substring };
}

function locationProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'location_proposal', id, working_label: label, name: null, aliases: [] };
}

function actorProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'actor_proposal', id, working_label: label, name: null, aliases: [] };
}

function discoveryEntry(
  proposed: BootstrapProposal,
  evidence: readonly SourceEvidenceUnit[],
  discoveryConfidence?: BootstrapDiscoveryConfidence,
): BootstrapDiscoveryEntry {
  return { proposed, evidence, ...(discoveryConfidence === undefined ? {} : { discoveryConfidence }) };
}

function pendingBaseline(): BootstrapManifest {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  return buildBootstrapManifest(project, {
    entries: [
      discoveryEntry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')], WELL_CONFIDENCE),
      discoveryEntry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
}

function baselineDoc(baseline: BootstrapManifest): AuthorSourceDocument {
  return baseline.boundSourceDocuments[0];
}

function originalEntry(baseline: BootstrapManifest, proposedId: string): BootstrapManifestEntry {
  const entry = baseline.entries.find((e) => 'id' in e.proposed && e.proposed.id === proposedId);
  assert.ok(entry, `baseline fixture must contain a proposal with id ${proposedId}`);
  return entry;
}

function evidenceCitationFor(doc: AuthorSourceDocument, substring: string): BootstrapRefinementEvidenceCitation {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found`);
  return { sourceDocumentId: doc.id, startOffset: start, endOffset: start + substring.length, exactText: substring };
}

let candidateSequence = 0;

function buildCandidate(
  kind: BootstrapRefinementCandidateKind,
  workingLabel: string,
  evidence: readonly BootstrapRefinementEvidenceCitation[],
  refinesEntryId: string | null,
): BootstrapRefinementCandidate {
  candidateSequence += 1;
  const digest = candidateSequence.toString(16).padStart(64, '0');
  return {
    kind, workingLabel, name: null, aliases: [], refinesEntryId, evidence,
    candidateId: `bootstrap_ai_${kind}_${digest.slice(0, 32)}`,
    candidateDigest: digest,
  };
}

function admittedReceipt(): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes', requestId: 'r1', operation: BOOTSTRAP_REFINEMENT_OPERATION,
    actualProvider: 'x', actualModel: 'y', fallbackUsed: false, fallbackIndex: 0, routeAttemptCount: 1,
  });
}

function buildArtifact(baseline: BootstrapManifest, candidates: readonly BootstrapRefinementCandidate[]): BootstrapRefinementArtifact {
  const payload: BootstrapRefinementPayload = {
    schema: BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
    baselineManifestId: baseline.id,
    boundSourceFingerprint: baseline.boundSourceFingerprint,
    candidates,
    rawOutputDigest: '1'.repeat(64),
    artifactDigest: '2'.repeat(64),
  };
  return createInferenceArtifact(payload, admittedReceipt());
}

/**
 * A combined manifest with: one AI addition (Ulric), a target entry (the
 * well) carrying two suggestions, and an unaffected entry (Mara, no
 * suggestions at all).
 */
function combinedFixture(): {
  combined: BootstrapManifest;
  additionEntry: BootstrapManifestEntry;
  targetEntry: BootstrapManifestEntry;
  digestA: string;
  digestB: string;
  unaffectedEntry: BootstrapManifestEntry;
} {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const wellOriginal = originalEntry(baseline, 'location_well');
  const maraOriginal = originalEntry(baseline, 'actor_mara');

  const addition = buildCandidate('actor_proposal', 'Ulric', [evidenceCitationFor(doc, 'Ulric')], null);
  const suggestionA = buildCandidate('location_proposal', 'the ancient well', [evidenceCitationFor(doc, 'Isla')], wellOriginal.id);
  const suggestionB = buildCandidate('location_proposal', "the villagers' well", [evidenceCitationFor(doc, 'Locke')], wellOriginal.id);

  const combined = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [addition, suggestionA, suggestionB]));
  const entryIdMap = combined.refinementMetadata!.entryIdMap;
  const rebasedIds = new Set(Object.values(entryIdMap));

  const additionEntry = combined.entries.find((e) => !rebasedIds.has(e.id))!;
  const targetEntry = combined.entries.find((e) => e.id === entryIdMap[wellOriginal.id])!;
  const unaffectedEntry = combined.entries.find((e) => e.id === entryIdMap[maraOriginal.id])!;

  assert.equal(targetEntry.suggestedRefinements?.length, 2, 'fixture sanity: target entry must carry exactly two suggestions');
  return {
    combined,
    additionEntry,
    targetEntry,
    digestA: suggestionA.candidateDigest,
    digestB: suggestionB.candidateDigest,
    unaffectedEntry,
  };
}

function noAssignments() {
  return { activePovActorId: null, currentLocationId: null };
}

// ---------------------------------------------------------------------------
// 1. USE THIS SUGGESTION commits immediately with the exact stated shape.
// ---------------------------------------------------------------------------

function testSelectionCommitsImmediatelyWithExactShape() {
  const { combined, targetEntry, digestA } = combinedFixture();
  const suggestionA = targetEntry.suggestedRefinements!.find((s) => s.provenance.candidateDigest === digestA)!;

  const { manifest: nextManifest } = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA);
  const decidedEntry = nextManifest.entries.find((e) => e.id === targetEntry.id)!;

  assert.equal(decidedEntry.decision, 'edited');
  assert.deepEqual(decidedEntry.admitted, suggestionA.suggested, 'admitted must be verbatim, not reconstructed');
  assert.equal(decidedEntry.selectedRefinementCandidateDigest, digestA);
}

// ---------------------------------------------------------------------------
// 2. selecting a different suggestion on the same entry replaces atomically.
// ---------------------------------------------------------------------------

function testSelectingADifferentSuggestionReplacesAtomically() {
  const { combined, targetEntry, digestA, digestB } = combinedFixture();

  const afterA = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA);
  const afterB = selectBootstrapReviewSuggestion(afterA.manifest, afterA.assignments, targetEntry.id, digestB);
  const decidedEntry = afterB.manifest.entries.find((e) => e.id === targetEntry.id)!;

  assert.equal(decidedEntry.selectedRefinementCandidateDigest, digestB, 'the new selection must replace the old one, not layer alongside it');
  const suggestionB = targetEntry.suggestedRefinements!.find((s) => s.provenance.candidateDigest === digestB)!;
  assert.deepEqual(decidedEntry.admitted, suggestionB.suggested);
}

// ---------------------------------------------------------------------------
// 3. manual edit clears the selection, even if the typed values match.
// ---------------------------------------------------------------------------

function testManualEditClearsSelectionEvenWhenValuesMatch() {
  const { combined, targetEntry, digestA } = combinedFixture();
  const selected = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA);
  const decidedEntry = selected.manifest.entries.find((e) => e.id === targetEntry.id)!;

  const reEdited = decideBootstrapReviewEntry(
    selected.manifest,
    selected.assignments,
    targetEntry.id,
    'edited',
    decidedEntry.admitted, // exact same value the suggestion produced
  );
  const reEditedEntry = reEdited.manifest.entries.find((e) => e.id === targetEntry.id)!;

  assert.equal(
    reEditedEntry.selectedRefinementCandidateDigest,
    undefined,
    'an ordinary edit must clear the selection digest even when the admitted value happens to match the suggestion',
  );
}

// ---------------------------------------------------------------------------
// 4. REJECT and APPROVE both clear the selection.
// ---------------------------------------------------------------------------

function testRejectAndApproveBothClearSelection() {
  const { combined, targetEntry, digestA } = combinedFixture();

  const selectedForReject = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA);
  const rejected = decideBootstrapReviewEntry(selectedForReject.manifest, selectedForReject.assignments, targetEntry.id, 'rejected');
  const rejectedEntry = rejected.manifest.entries.find((e) => e.id === targetEntry.id)!;
  assert.equal(rejectedEntry.selectedRefinementCandidateDigest, undefined);

  const selectedForApprove = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA);
  const approved = decideBootstrapReviewEntry(selectedForApprove.manifest, selectedForApprove.assignments, targetEntry.id, 'approved');
  const approvedEntry = approved.manifest.entries.find((e) => e.id === targetEntry.id)!;
  assert.equal(approvedEntry.selectedRefinementCandidateDigest, undefined);
  assert.deepEqual(approvedEntry.proposed, targetEntry.proposed, 'fixture sanity: approve reverts to the original proposed value (pre-existing quirk, untouched)');
  assert.deepEqual(resolveAdmittedBootstrapProposal(approvedEntry), targetEntry.proposed);
}

// ---------------------------------------------------------------------------
// 5. a candidateDigest not on the named entry is rejected, including one
// that is real on a different entry.
// ---------------------------------------------------------------------------

function testDigestMustBeScopedToTheNamedEntry() {
  const { combined, targetEntry, additionEntry } = combinedFixture();

  assert.throws(
    () => selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, 'not-a-real-digest'),
    'selectBootstrapReviewSuggestion must reject an unknown digest',
  );

  // additionEntry has no suggestedRefinements of its own (it is itself an
  // addition) -- confirm the digest-not-on-this-entry rejection uses a real
  // digest that exists on a *different* entry, not merely a nonexistent one.
  const otherEntry = combined.entries.find((e) => e.id !== targetEntry.id && e.id !== additionEntry.id)!;
  const realDigestElsewhere = targetEntry.suggestedRefinements![0].provenance.candidateDigest;
  assert.throws(
    () => selectBootstrapReviewSuggestion(combined, noAssignments(), otherEntry.id, realDigestElsewhere),
    'a digest real on one entry must not resolve when named against a different entry',
  );

  assert.throws(
    () => decideBootstrapManifestEntry(
      combined,
      targetEntry.id,
      'edited',
      targetEntry.suggestedRefinements![0].suggested,
      'not-a-real-digest',
    ),
    'decideBootstrapManifestEntry must independently reject an unknown digest',
  );
}

// ---------------------------------------------------------------------------
// 6. decideBootstrapManifestEntry rejects a hand-supplied (admitted, digest)
// pair where admitted does not match the named suggestion.
// ---------------------------------------------------------------------------

function testDecideRejectsMismatchedAdmittedAndDigest() {
  const { combined, targetEntry, digestA } = combinedFixture();
  const wrongAdmitted = locationProposal('location_forged', 'A forged value');

  assert.throws(
    () => decideBootstrapManifestEntry(combined, targetEntry.id, 'edited', wrongAdmitted, digestA),
    'admitted must deep-equal the exact suggestion named by the digest, never merely accepted alongside it',
  );
}

// ---------------------------------------------------------------------------
// 7. validateBootstrapManifestStructure independently rejects every way a
// hand-tampered manifest could violate the selectedRefinementCandidateDigest
// iff rule.
// ---------------------------------------------------------------------------

function withTamperedEntry(manifest: BootstrapManifest, entryId: string, patch: Partial<BootstrapManifestEntry>): BootstrapManifest {
  const entries = manifest.entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry));
  return { ...manifest, entries } as BootstrapManifest;
}

function testStructuralValidationRejectsEveryTamperedDigestState() {
  const { combined, targetEntry, digestA } = combinedFixture();
  const selected = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA);
  const validSelectedEntry = selected.manifest.entries.find((e) => e.id === targetEntry.id)!;

  // Sanity: the legitimately-produced manifest passes.
  assert.doesNotThrow(() => validateBootstrapManifestStructure(selected.manifest));

  // (a) digest present without decision === 'edited'.
  const notEdited = withTamperedEntry(selected.manifest, targetEntry.id, { decision: 'approved', admitted: undefined });
  assert.throws(() => validateBootstrapManifestStructure(notEdited), /Malformed Bootstrap Manifest/i);

  // (b) digest names a suggestion that does not exist on this entry.
  const wrongDigest = withTamperedEntry(selected.manifest, targetEntry.id, {
    selectedRefinementCandidateDigest: 'not-a-real-digest',
  });
  assert.throws(() => validateBootstrapManifestStructure(wrongDigest), /Malformed Bootstrap Manifest/i);

  // (c) digest present on an entry with refinementProvenance !== undefined (an AI-added entry).
  const { additionEntry } = combinedFixture();
  const additionWithDigest = withTamperedEntry(combined, additionEntry.id, {
    decision: 'edited',
    admitted: additionEntry.proposed,
    selectedRefinementCandidateDigest: 'irrelevant-digest',
  });
  assert.throws(() => validateBootstrapManifestStructure(additionWithDigest), /Malformed Bootstrap Manifest/i);

  // (d) digest matches more than one attached suggestion (duplicated digest).
  const duplicated = withTamperedEntry(selected.manifest, targetEntry.id, {
    suggestedRefinements: [
      validSelectedEntry.suggestedRefinements![0],
      { ...validSelectedEntry.suggestedRefinements![1], provenance: { ...validSelectedEntry.suggestedRefinements![1].provenance, candidateDigest: digestA } },
    ],
  });
  assert.throws(() => validateBootstrapManifestStructure(duplicated), /Malformed Bootstrap Manifest/i);
}

// ---------------------------------------------------------------------------
// 8. selecting a suggestion on an AI-added entry rejects everywhere, even on
// a hand-built manifest that attaches suggestedRefinements to it.
// ---------------------------------------------------------------------------

function testSelectionOnAiAddedEntryRejectsEverywhere() {
  const { combined, additionEntry, targetEntry } = combinedFixture();
  assert.notEqual(additionEntry.refinementProvenance, undefined, 'fixture sanity: additionEntry must be an AI addition');

  // A hand-built manifest attaching a well-formed suggestion to the AI-added
  // entry -- constructed to have exactly the shape a legitimate suggestion
  // would, so the rejection can only come from the refinementProvenance
  // guard, not from some unrelated malformation.
  const borrowedSuggestion = targetEntry.suggestedRefinements![0];
  const handBuilt = withTamperedEntry(combined, additionEntry.id, {
    suggestedRefinements: [{
      ...borrowedSuggestion,
      suggested: { ...borrowedSuggestion.suggested, kind: additionEntry.kind } as BootstrapProposal,
      provenance: { ...borrowedSuggestion.provenance, refinesBaselineEntryId: additionEntry.id },
    }],
  });

  assert.throws(
    () => selectBootstrapReviewSuggestion(handBuilt, noAssignments(), additionEntry.id, borrowedSuggestion.provenance.candidateDigest),
    'selectBootstrapReviewSuggestion must refuse to select against an AI-added entry',
  );
  assert.throws(
    () => decideBootstrapManifestEntry(
      handBuilt,
      additionEntry.id,
      'edited',
      borrowedSuggestion.suggested,
      borrowedSuggestion.provenance.candidateDigest,
    ),
    'decideBootstrapManifestEntry must independently refuse the same thing',
  );

  const forciblyDecided = withTamperedEntry(handBuilt, additionEntry.id, {
    decision: 'edited',
    admitted: borrowedSuggestion.suggested,
    selectedRefinementCandidateDigest: borrowedSuggestion.provenance.candidateDigest,
  });
  assert.throws(
    () => validateBootstrapManifestStructure(forciblyDecided),
    /Malformed Bootstrap Manifest/i,
    'validateBootstrapManifestStructure must independently refuse a selection recorded against an AI-added entry',
  );
}

// ---------------------------------------------------------------------------
// 9. two suggestions sharing a candidateDigest reject rather than resolving
// to the first match.
// ---------------------------------------------------------------------------

function testDuplicateDigestOnSameEntryFailsClosed() {
  const { combined, targetEntry, digestA } = combinedFixture();
  const [first, second] = targetEntry.suggestedRefinements!;
  const duplicated = withTamperedEntry(combined, targetEntry.id, {
    suggestedRefinements: [first, { ...second, provenance: { ...second.provenance, candidateDigest: digestA } }],
  });

  assert.throws(
    () => selectBootstrapReviewSuggestion(duplicated, noAssignments(), targetEntry.id, digestA),
    'selecting a digest that matches two attached suggestions must fail closed, never silently resolve to the first',
  );
}

// ---------------------------------------------------------------------------
// 12. fingerprintBootstrapAdmission is identical regardless of provenance.
// ---------------------------------------------------------------------------

function testAdmissionFingerprintIgnoresSelectionProvenance() {
  const { combined, targetEntry, digestA } = combinedFixture();
  const suggestionA = targetEntry.suggestedRefinements!.find((s) => s.provenance.candidateDigest === digestA)!;

  const viaSelection = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA).manifest;
  const viaManualEdit = decideBootstrapManifestEntry(combined, targetEntry.id, 'edited', suggestionA.suggested);

  assert.notEqual(
    viaSelection.entries.find((e) => e.id === targetEntry.id)!.selectedRefinementCandidateDigest,
    viaManualEdit.entries.find((e) => e.id === targetEntry.id)!.selectedRefinementCandidateDigest,
    'fixture sanity: the two paths must differ in provenance',
  );
  assert.equal(
    fingerprintBootstrapAdmission(viaSelection),
    fingerprintBootstrapAdmission(viaManualEdit),
    'two paths admitting the exact same canonical value must produce the same admission identity regardless of how it was chosen',
  );
}

// ---------------------------------------------------------------------------
// 13. entriesFingerprint / manifest id are unaffected by any decision.
// ---------------------------------------------------------------------------

function testManifestIdentityUnaffectedByAnyNumberOfDecisions() {
  const { combined, targetEntry, digestA, digestB } = combinedFixture();
  const idBefore = combined.id;
  const entriesFingerprintBefore = combined.entriesFingerprint;

  let working = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA);
  working = selectBootstrapReviewSuggestion(working.manifest, working.assignments, targetEntry.id, digestB);
  working = { manifest: decideBootstrapReviewEntry(working.manifest, working.assignments, targetEntry.id, 'rejected').manifest, assignments: working.assignments };
  working = selectBootstrapReviewSuggestion(working.manifest, working.assignments, targetEntry.id, digestA);

  assert.equal(working.manifest.id, idBefore, 'manifest id must stay byte-identical through any number of selection/decision calls');
  assert.equal(working.manifest.entriesFingerprint, entriesFingerprintBefore);
}

// ---------------------------------------------------------------------------
// 14. prepareBootstrap()/BootstrapReceiptEntry are untouched by this slice.
// ---------------------------------------------------------------------------

function testPrepareBootstrapAndReceiptEntryCarryNoNewField() {
  const { combined, targetEntry, digestA } = combinedFixture();
  const suggestionA = targetEntry.suggestedRefinements!.find((s) => s.provenance.candidateDigest === digestA)!;

  let manifest = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA).manifest;
  // Decide every other entry so the manifest is complete enough to admit.
  for (const entry of manifest.entries) {
    if (entry.id === targetEntry.id) continue;
    if (!entry.supportedForApplication) {
      manifest = decideBootstrapManifestEntry(manifest, entry.id, 'rejected');
    } else {
      manifest = decideBootstrapManifestEntry(manifest, entry.id, 'approved');
    }
  }

  const project = sourceOnlyProject();
  const maraEntry = manifest.entries.find((e) => 'id' in e.proposed && e.proposed.id === 'actor_mara')!;
  const decidedTargetEntry = manifest.entries.find((e) => e.id === targetEntry.id)!;
  const admittedActor = resolveAdmittedBootstrapProposal(maraEntry) as { id: string };
  const admittedLocation = resolveAdmittedBootstrapProposal(decidedTargetEntry) as { id: string };
  const assignments = { activePovActorId: admittedActor.id, currentLocationId: admittedLocation.id };

  const prepared = prepareBootstrap(project, manifest, assignments, 1_700_000_001_000);
  const receiptEntry = prepared.bootstrapReceipt.entries.find((e) => e.entryId === targetEntry.id)!;

  assert.deepEqual(
    Object.keys(receiptEntry).sort(),
    (['entryId', 'kind', 'decision', 'supportedForApplication', 'proposed', 'admitted', 'applied'] as const).slice().sort(),
    'BootstrapReceiptEntry must carry no new selection-provenance field -- that is B4d\'s job',
  );
  assert.deepEqual(receiptEntry.admitted, suggestionA.suggested, 'the receipt must still faithfully admit the selected value itself');

  // Type-level proof this file compiles against the real, unexpanded shape.
  const typedEntry: BootstrapReceiptEntry = receiptEntry;
  assert.equal('selectedRefinementCandidateDigest' in typedEntry, false);
}

function run() {
  testSelectionCommitsImmediatelyWithExactShape();
  testSelectingADifferentSuggestionReplacesAtomically();
  testManualEditClearsSelectionEvenWhenValuesMatch();
  testRejectAndApproveBothClearSelection();
  testDigestMustBeScopedToTheNamedEntry();
  testDecideRejectsMismatchedAdmittedAndDigest();
  testStructuralValidationRejectsEveryTamperedDigestState();
  testSelectionOnAiAddedEntryRejectsEverywhere();
  testDuplicateDigestOnSameEntryFailsClosed();
  testAdmissionFingerprintIgnoresSelectionProvenance();
  testManifestIdentityUnaffectedByAnyNumberOfDecisions();
  testPrepareBootstrapAndReceiptEntryCarryNoNewField();
  console.log('B4c3 suggestion selection authority/identity contract regression passed');
}

run();
