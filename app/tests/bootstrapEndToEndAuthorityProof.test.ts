import assert from 'node:assert/strict';
import {
  createInferenceArtifact,
  type AuthorSourceDocument,
  type InferenceReceipt,
  type StoryProject,
} from '../src/types';
import {
  buildBootstrapManifest,
  decideBootstrapManifestEntry,
  deepFreeze,
  isBootstrapEntityProposal,
  validateBootstrapManifestStructure,
  type BootstrapAssignments,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapManifestEntry,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
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
import { decideBootstrapReviewEntry, isBootstrapReviewComplete, selectBootstrapReviewSuggestion } from '../src/lib/bootstrapReview';
import { prepareBootstrap, type BootstrapReceiptEntry } from '../src/lib/prepareBootstrap';

/**
 * B4d RED gate: End-to-End Authority Proof.
 *
 * Frozen against TODO.md's "B4d -- End-to-End Authority Proof" contract
 * (9899868). Runs the real chain -- buildBootstrapManifest() ->
 * mergeBootstrapRefinementArtifact() -> selectBootstrapReviewSuggestion()/
 * decideBootstrapReviewEntry() -> prepareBootstrap() -- against one hand-built
 * BootstrapRefinementArtifact fixture (same shape B4a/B4b's own buildArtifact()
 * helpers already produce; no live Hermes call, matching established
 * convention). No new decision/authority function and no UI/React surface is
 * touched here -- this file only exercises functions that already exist.
 *
 * The frozen gate's only genuinely absent boundary is narrow: today's
 * BootstrapReceiptEntry (src/lib/prepareBootstrap.ts) carries no
 * refinementProvenance/selectedRefinementCandidateDigest fields at all, so
 * prepareBootstrap()'s receipt projection currently drops both. Every
 * assertion below that reads a receipt row's new field is written against a
 * local ExpectedReceiptEntry cast (never a change to the real, still-narrow
 * BootstrapReceiptEntry type) so this file type-checks cleanly at RED --
 * the resulting assertion failures are behavioral (the projected field is
 * genuinely absent), not import/type accidents.
 *
 * RED gate item 7 ("no production UI-code changes") is a change-scope
 * constraint on the GREEN implementation, not a runtime invariant of the
 * system -- BootstrapReviewWorkspace.tsx and StructuralReviewPanel.tsx
 * already legitimately reference `refinementProvenance`/
 * `selectedRefinementCandidateDigest` off BootstrapManifestEntry for
 * unrelated B4c UI, so a blanket string-ban would be both meaningless and
 * false. It is verified instead by keeping the GREEN diff scoped to
 * prepareBootstrap.ts alone (`git diff --stat` at commit time), per the
 * blueprint's own verification matrix -- not encoded as a test assertion
 * here.
 */

// ---------------------------------------------------------------------------
// Local, additive-only view of a receipt row -- casts land on this, never on
// the real (still-narrow) BootstrapReceiptEntry type.
// ---------------------------------------------------------------------------

interface ExpectedReceiptEntry extends BootstrapReceiptEntry {
  readonly refinementProvenance?: { readonly candidateDigest: string; readonly refinesBaselineEntryId?: string };
  readonly selectedRefinementCandidateDigest?: string;
}

function asExpected(row: BootstrapReceiptEntry): ExpectedReceiptEntry {
  return row as unknown as ExpectedReceiptEntry;
}

// ---------------------------------------------------------------------------
// Baseline fixture -- hand-built B2-shaped discovery, exactly like B4b's own
// pendingBaseline(), never produced by calling discoverBootstrap().
// ---------------------------------------------------------------------------

const BASELINE_TEXT = 'Keen entered Ironspire. Mara waited by the old gate.';
const TRANSACTION_TIMESTAMP = 1_700_000_500_000;

function sourceOnlyProject(pastedText: string = BASELINE_TEXT): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4d_test',
    projectTitle: 'B4d RED Fixture',
    sourceLabel: 'Chapter One',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4d_test',
  });
}

function firstDoc(project: StoryProject): AuthorSourceDocument {
  const doc = (project.sourceDocuments ?? [])[0];
  assert.ok(doc, 'fixture requires a source document');
  return doc;
}

function evidenceFor(doc: AuthorSourceDocument, unitId: string, substring: string): SourceEvidenceUnit {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found in source document ${doc.id}`);
  return { sourceDocumentId: doc.id, unitId, startOffset: start, endOffset: start + substring.length, exactText: substring };
}

function locationProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'location_proposal', id, working_label: label, name: null, aliases: [] };
}

function actorProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'actor_proposal', id, working_label: label, name: null, aliases: [] };
}

function discoveryEntry(proposed: BootstrapProposal, evidence: readonly SourceEvidenceUnit[]): BootstrapDiscoveryEntry {
  return { proposed, evidence };
}

/** Two baseline entries: actor Keen and location Ironspire. Neither carries refinementProvenance or selectedRefinementCandidateDigest -- both originate purely from B2. */
function pendingBaseline(project: StoryProject): BootstrapManifest {
  const doc = firstDoc(project);
  return buildBootstrapManifest(project, {
    entries: [
      discoveryEntry(actorProposal('actor_keen', 'Keen'), [evidenceFor(doc, 'u1', 'Keen')]),
      discoveryEntry(locationProposal('location_ironspire', 'Ironspire'), [evidenceFor(doc, 'u2', 'Ironspire')]),
    ],
  });
}

function originalEntry(baseline: BootstrapManifest, proposedId: string): BootstrapManifestEntry {
  const entry = baseline.entries.find((e) => isBootstrapEntityProposal(e.proposed) && e.proposed.id === proposedId);
  assert.ok(entry, `baseline fixture must contain a proposal with id ${proposedId}`);
  return entry;
}

// ---------------------------------------------------------------------------
// Hand-built BootstrapRefinementArtifact -- one addition (Mara), one
// suggestion (renaming Ironspire) -- never produced by refineBootstrapManifest().
// ---------------------------------------------------------------------------

function admittedReceipt(): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId: 'b4d-request-001',
    operation: BOOTSTRAP_REFINEMENT_OPERATION,
    actualProvider: 'openrouter',
    actualModel: 'actual/model-build-2026-09-01',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
  });
}

function evidenceCitationFor(doc: AuthorSourceDocument, substring: string): BootstrapRefinementEvidenceCitation {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found in source document ${doc.id}`);
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
    kind,
    workingLabel,
    name: null,
    aliases: [],
    refinesEntryId,
    evidence,
    candidateId: `bootstrap_ai_${kind}_${digest.slice(0, 32)}`,
    candidateDigest: digest,
  };
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
  return createInferenceArtifact(deepFreeze(payload), admittedReceipt());
}

// ---------------------------------------------------------------------------
// Shared fixture: one project, one baseline, one merged manifest, one
// addition candidate (Mara), one suggestion candidate (renamed Ironspire).
// ---------------------------------------------------------------------------

interface Fixture {
  readonly project: StoryProject;
  readonly baseline: BootstrapManifest;
  readonly combined: BootstrapManifest;
  readonly addition: BootstrapRefinementCandidate;
  readonly suggestion: BootstrapRefinementCandidate;
  readonly rebasedKeenId: string;
  readonly rebasedLocationId: string;
  readonly additionEntryId: string;
}

function buildFixture(): Fixture {
  const project = sourceOnlyProject();
  const baseline = pendingBaseline(project);
  const doc = firstDoc(project);
  const keenOriginal = originalEntry(baseline, 'actor_keen');
  const locationOriginal = originalEntry(baseline, 'location_ironspire');

  const addition = buildCandidate('actor_proposal', 'Mara', [evidenceCitationFor(doc, 'Mara')], null);
  const suggestion = buildCandidate(
    'location_proposal',
    'Ironspire, the ruined citadel',
    [evidenceCitationFor(doc, 'Ironspire')],
    locationOriginal.id,
  );

  const artifact = buildArtifact(baseline, [addition, suggestion]);
  const combined = mergeBootstrapRefinementArtifact(baseline, artifact);
  validateBootstrapManifestStructure(combined);

  const entryIdMap = combined.refinementMetadata!.entryIdMap;
  const rebasedKeenId = entryIdMap[keenOriginal.id];
  const rebasedLocationId = entryIdMap[locationOriginal.id];
  assert.ok(rebasedKeenId && rebasedLocationId, 'entryIdMap must cover both baseline entries');

  const rebasedIds = new Set(Object.values(entryIdMap));
  const additionEntry = combined.entries.find((e) => !rebasedIds.has(e.id));
  assert.ok(additionEntry, 'combined manifest must contain the Mara addition as a new entry');

  return { project, baseline, combined, addition, suggestion, rebasedKeenId, rebasedLocationId, additionEntryId: additionEntry!.id };
}

const NO_ASSIGNMENTS: BootstrapAssignments = { activePovActorId: null, currentLocationId: null };

function finalAssignments(): BootstrapAssignments {
  return { activePovActorId: 'actor_keen', currentLocationId: 'location_ironspire' };
}

// ---------------------------------------------------------------------------
// Item 1 + 2: full pipeline run produces the exact expected receipt shape,
// additively over every pre-existing field.
// ---------------------------------------------------------------------------

function testFullPipelineProducesExpectedReceiptShape(): void {
  const fx = buildFixture();

  const step1 = decideBootstrapReviewEntry(fx.combined, NO_ASSIGNMENTS, fx.rebasedKeenId, 'approved');
  const step2 = decideBootstrapReviewEntry(step1.manifest, step1.assignments, fx.additionEntryId, 'approved');
  const step3 = selectBootstrapReviewSuggestion(step2.manifest, step2.assignments, fx.rebasedLocationId, fx.suggestion.candidateDigest);

  const finalManifest = step3.manifest;
  const assignments = finalAssignments();
  assert.equal(isBootstrapReviewComplete(finalManifest, assignments), true, 'fixture review must be complete before APPLY');

  const prepared = prepareBootstrap(fx.project, finalManifest, assignments, TRANSACTION_TIMESTAMP);
  const receipt = prepared.bootstrapReceipt;
  assert.equal(receipt.entries.length, 3, 'receipt must contain exactly Keen, Ironspire, and the Mara addition');

  const rowFor = (entryId: string): ExpectedReceiptEntry => {
    const row = receipt.entries.find((e) => e.entryId === entryId);
    assert.ok(row, `receipt must contain a row for ${entryId}`);
    return asExpected(row!);
  };

  const keenRow = rowFor(fx.rebasedKeenId);
  const locationRow = rowFor(fx.rebasedLocationId);
  const maraRow = rowFor(fx.additionEntryId);

  // -- Item 1: exact expected shape per row --------------------------------
  assert.equal('refinementProvenance' in maraRow, true, 'the addition row must carry refinementProvenance');
  assert.equal(maraRow.refinementProvenance!.candidateDigest, fx.addition.candidateDigest);
  assert.equal('selectedRefinementCandidateDigest' in maraRow, false, 'an addition row must never carry selectedRefinementCandidateDigest');

  assert.equal('selectedRefinementCandidateDigest' in locationRow, true, 'the suggestion-target row must carry selectedRefinementCandidateDigest');
  assert.equal(locationRow.selectedRefinementCandidateDigest, fx.suggestion.candidateDigest);
  assert.equal('refinementProvenance' in locationRow, false, 'a suggestion-target row must never carry refinementProvenance');

  assert.equal('refinementProvenance' in keenRow, false, 'the untouched B2 entry row must carry neither new field');
  assert.equal('selectedRefinementCandidateDigest' in keenRow, false, 'the untouched B2 entry row must carry neither new field');

  // -- Item 2: every pre-existing field is byte-identical to what today's
  //    (pre-B4d) receipt already produces for the same decided manifest --
  //    proving this is a strictly additive projection, not a reshaped one.
  const keenOriginal = originalEntry(fx.baseline, 'actor_keen');
  const locationOriginal = originalEntry(fx.baseline, 'location_ironspire');
  const suggestedProposal = fx.combined.entries.find((e) => e.id === fx.rebasedLocationId)!.suggestedRefinements![0].suggested;

  assert.equal(keenRow.kind, 'actor_proposal');
  assert.equal(keenRow.decision, 'approved');
  assert.equal(keenRow.supportedForApplication, true);
  assert.deepEqual(keenRow.proposed, keenOriginal.proposed);
  assert.deepEqual(keenRow.admitted, keenOriginal.proposed);
  assert.equal(keenRow.applied, true);

  assert.equal(locationRow.kind, 'location_proposal');
  assert.equal(locationRow.decision, 'edited');
  assert.equal(locationRow.supportedForApplication, true);
  assert.deepEqual(locationRow.proposed, locationOriginal.proposed, 'a suggestion must never rewrite its target\'s proposed value');
  assert.deepEqual(locationRow.admitted, suggestedProposal);
  assert.equal(locationRow.applied, true);

  assert.equal(maraRow.kind, 'actor_proposal');
  assert.equal(maraRow.decision, 'approved');
  assert.equal(maraRow.supportedForApplication, true);
  assert.ok(isBootstrapEntityProposal(maraRow.proposed) && maraRow.proposed.id === fx.addition.candidateId);
  assert.deepEqual(maraRow.admitted, maraRow.proposed);
  assert.equal(maraRow.applied, true);
}

// ---------------------------------------------------------------------------
// Item 3: a rejected AI-added entry's row still carries refinementProvenance
// (historical record of origin) with admitted: null, applied: false.
// ---------------------------------------------------------------------------

function testRejectedAiAdditionStillCarriesProvenance(): void {
  const fx = buildFixture();

  const step1 = decideBootstrapReviewEntry(fx.combined, NO_ASSIGNMENTS, fx.rebasedKeenId, 'approved');
  const step2 = decideBootstrapReviewEntry(step1.manifest, step1.assignments, fx.additionEntryId, 'rejected');
  const step3 = selectBootstrapReviewSuggestion(step2.manifest, step2.assignments, fx.rebasedLocationId, fx.suggestion.candidateDigest);

  const assignments = finalAssignments();
  assert.equal(isBootstrapReviewComplete(step3.manifest, assignments), true, 'a rejected entry still counts as decided');

  const prepared = prepareBootstrap(fx.project, step3.manifest, assignments, TRANSACTION_TIMESTAMP);
  const maraRow = asExpected(prepared.bootstrapReceipt.entries.find((e) => e.entryId === fx.additionEntryId)!);

  assert.equal(maraRow.decision, 'rejected');
  assert.equal('refinementProvenance' in maraRow, true, 'refinement provenance describes origin, never grants admission');
  assert.equal(maraRow.refinementProvenance!.candidateDigest, fx.addition.candidateDigest);
  assert.equal(maraRow.admitted, null);
  assert.equal(maraRow.applied, false);
}

// ---------------------------------------------------------------------------
// Item 4: a manifest with any entry still 'pending' still makes
// prepareBootstrap() throw exactly as before -- no new bypass.
// ---------------------------------------------------------------------------

function testPendingEntryStillThrows(): void {
  const fx = buildFixture();
  // fx.combined is entirely pending -- untouched.
  assert.throws(
    () => prepareBootstrap(fx.project, fx.combined, finalAssignments(), TRANSACTION_TIMESTAMP),
    'a fully pending combined manifest must still be refused by prepareBootstrap()',
  );

  // Also confirm a *partially* decided manifest (one entry still pending) throws.
  const step1 = decideBootstrapReviewEntry(fx.combined, NO_ASSIGNMENTS, fx.rebasedKeenId, 'approved');
  assert.throws(
    () => prepareBootstrap(fx.project, step1.manifest, finalAssignments(), TRANSACTION_TIMESTAMP),
    'a partially decided manifest (Ironspire/Mara still pending) must still be refused by prepareBootstrap()',
  );
}

// ---------------------------------------------------------------------------
// Item 5: receipt id / admissionFingerprint are unaffected by whether the
// admitted entry carries selectedRefinementCandidateDigest -- two otherwise
// identical decision paths (one through selectBootstrapReviewSuggestion, one
// hand-decided with the identical admitted value but no digest) must
// produce the exact same receipt identity.
// ---------------------------------------------------------------------------

function testReceiptIdentityUnaffectedBySelectionProvenance(): void {
  const fx = buildFixture();
  const assignments = finalAssignments();

  // Path A: through selectBootstrapReviewSuggestion() -- carries selectedRefinementCandidateDigest.
  const a1 = decideBootstrapReviewEntry(fx.combined, NO_ASSIGNMENTS, fx.rebasedKeenId, 'approved');
  const a2 = decideBootstrapReviewEntry(a1.manifest, a1.assignments, fx.additionEntryId, 'approved');
  const a3 = selectBootstrapReviewSuggestion(a2.manifest, a2.assignments, fx.rebasedLocationId, fx.suggestion.candidateDigest);
  const receiptA = prepareBootstrap(fx.project, a3.manifest, assignments, TRANSACTION_TIMESTAMP).bootstrapReceipt;

  // Path B: identical admitted value, decided directly -- no selectedRefinementCandidateDigest.
  const suggestedProposal = fx.combined.entries.find((e) => e.id === fx.rebasedLocationId)!.suggestedRefinements![0].suggested;
  const b1 = decideBootstrapReviewEntry(fx.combined, NO_ASSIGNMENTS, fx.rebasedKeenId, 'approved');
  const b2 = decideBootstrapReviewEntry(b1.manifest, b1.assignments, fx.additionEntryId, 'approved');
  const manifestB = decideBootstrapManifestEntry(b2.manifest, fx.rebasedLocationId, 'edited', suggestedProposal);
  const receiptB = prepareBootstrap(fx.project, manifestB, assignments, TRANSACTION_TIMESTAMP).bootstrapReceipt;

  // Confirm the two paths really do differ in provenance presence, so the
  // identity match below is not trivially true.
  const locationRowA = asExpected(receiptA.entries.find((e) => e.entryId === fx.rebasedLocationId)!);
  const locationRowB = asExpected(receiptB.entries.find((e) => e.entryId === fx.rebasedLocationId)!);
  assert.equal('selectedRefinementCandidateDigest' in locationRowA, true);
  assert.equal('selectedRefinementCandidateDigest' in locationRowB, false);

  assert.equal(receiptA.id, receiptB.id, 'receipt id must be unaffected by selection provenance');
  assert.equal(receiptA.admissionFingerprint, receiptB.admissionFingerprint, 'admissionFingerprint must be unaffected by selection provenance');
}

// ---------------------------------------------------------------------------
// Item 6: a manifest that never went through refinement at all produces a
// receipt byte-identical to today's -- zero-refinement callers see no change.
// ---------------------------------------------------------------------------

function testZeroRefinementBaselineReceiptCarriesNeitherField(): void {
  const project = sourceOnlyProject();
  const baseline = pendingBaseline(project);

  const d1 = decideBootstrapReviewEntry(baseline, NO_ASSIGNMENTS, originalEntry(baseline, 'actor_keen').id, 'approved');
  const d2 = decideBootstrapReviewEntry(d1.manifest, d1.assignments, originalEntry(baseline, 'location_ironspire').id, 'approved');
  assert.equal(baseline.refinementMetadata, undefined, 'this baseline must never have gone through B4 refinement');

  const prepared = prepareBootstrap(project, d2.manifest, finalAssignments(), TRANSACTION_TIMESTAMP);
  for (const row of prepared.bootstrapReceipt.entries) {
    const expected = asExpected(row);
    assert.equal('refinementProvenance' in expected, false, `zero-refinement row ${row.entryId} must not carry refinementProvenance`);
    assert.equal('selectedRefinementCandidateDigest' in expected, false, `zero-refinement row ${row.entryId} must not carry selectedRefinementCandidateDigest`);
  }
}

async function run() {
  testFullPipelineProducesExpectedReceiptShape();
  testRejectedAiAdditionStillCarriesProvenance();
  testPendingEntryStillThrows();
  testReceiptIdentityUnaffectedBySelectionProvenance();
  testZeroRefinementBaselineReceiptCarriesNeitherField();
  console.log('B4d end-to-end authority proof RED gate passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
