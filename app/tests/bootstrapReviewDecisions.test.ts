import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildBootstrapManifest,
  decideBootstrapManifestEntry,
  type BootstrapAssignments,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { resolveAdmittedBootstrapProposal } from '../src/lib/prepareBootstrap';
import { assessBootstrapReviewReadiness, isBootstrapReviewComplete } from '../src/lib/bootstrapReview';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import type { StoryProject } from '../src/types';

/**
 * B3c RED gate -- pure decision/assignment/readiness logic only (RED gate
 * items 3-16, 19-21 in TODO.md). UI-presentation items (1, 2, 17, 18 --
 * control visibility, rerender stability, close/reopen lifecycle) are
 * deliberately not in this file: B3b's StructuralReviewPanel.tsx is frozen
 * authority-free, so B3c's interactive controls need a new component whose
 * shape is a separate design decision, not yet settled.
 *
 * Everything here is deliberately grounded in B1's real, already-shipped
 * authority (decideBootstrapManifestEntry, BootstrapAssignments) plus two
 * pieces of new surface this file requires to exist:
 *
 * - `resolveAdmittedBootstrapProposal()` exported from prepareBootstrap.ts
 *   (today's private `admittedProposal()`, renamed and exported so B3c's
 *   readiness predicate and B3d's real admission never diverge on what an
 *   entry's admitted proposal actually is).
 * - `assessBootstrapReviewReadiness()` / `isBootstrapReviewComplete()` in a
 *   new src/lib/bootstrapReview.ts. "Complete" here means only "every entry
 *   decided, both assignments explicit and resolved" -- it is never a
 *   prediction of prepareBootstrap() success; see the assertions guarding
 *   that distinction below.
 */

const CLASSIFICATION = 'corroborated' as const;

function sourceOnlyProject(): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b3c_review_decisions',
    projectTitle: 'B3c Review Decisions Fixture',
    sourceLabel: 'Chapter One',
    pastedText: 'Keen entered Ironspire.\n\nA locked chest sat in the corner.',
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b3c_review_decisions',
  });
}

function exactEvidence(project: StoryProject, unitId: string, text: string): SourceEvidenceUnit {
  const document = project.sourceDocuments?.[0];
  assert.ok(document, 'fixture requires one source document');
  const startOffset = document.exactText.indexOf(text);
  assert.notEqual(startOffset, -1, `fixture text must contain ${JSON.stringify(text)}`);
  return {
    sourceDocumentId: document.id,
    unitId,
    startOffset,
    endOffset: startOffset + text.length,
    exactText: text,
  };
}

function actorProposal(id: string, label: string): Extract<BootstrapProposal, { kind: 'actor_proposal' }> {
  return { kind: 'actor_proposal', id, working_label: label, name: null, aliases: [] };
}

function locationProposal(id: string, label: string): Extract<BootstrapProposal, { kind: 'location_proposal' }> {
  return { kind: 'location_proposal', id, working_label: label, name: null, aliases: [] };
}

function factProposal(statement: string): Extract<BootstrapProposal, { kind: 'fact_proposal' }> {
  return { kind: 'fact_proposal', statement };
}

/**
 * Builds a fresh manifest with three pending entries: a supported actor, a
 * supported location, and an unsupported fact -- every RED item below
 * decides some subset of these and re-derives readiness, never mutating the
 * manifest returned here.
 */
function freshManifest(): BootstrapManifest {
  const project = sourceOnlyProject();
  const keen = exactEvidence(project, 'unit-keen', 'Keen entered Ironspire.');
  const chest = exactEvidence(project, 'unit-chest', 'A locked chest sat in the corner.');

  const entries: BootstrapDiscoveryEntry[] = [
    {
      proposed: actorProposal('actor_keen', 'Keen'),
      evidence: [keen],
      discoveryConfidence: { classification: CLASSIFICATION, supportingUnitCount: 3, reasons: ['proper_name_match'] },
    },
    {
      proposed: locationProposal('location_ironspire', 'Ironspire'),
      evidence: [keen],
      discoveryConfidence: { classification: CLASSIFICATION, supportingUnitCount: 3, reasons: ['proper_name_match'] },
    },
    {
      proposed: factProposal('The chest is locked.'),
      evidence: [chest],
    },
  ];

  return buildBootstrapManifest(project, { entries });
}

function entryFor(manifest: BootstrapManifest, proposalId: string) {
  const entry = manifest.entries.find((candidate) => 'id' in candidate.proposed && candidate.proposed.id === proposalId);
  assert.ok(entry, `fixture manifest must contain proposal ${proposalId}`);
  return entry;
}

function assignments(povActorId: string | null, currentLocationId: string | null): BootstrapAssignments {
  return { activePovActorId: povActorId, currentLocationId };
}

// ---------------------------------------------------------------------------
// 3-4. Approve/reject use B1's existing decision transition unchanged.
// ---------------------------------------------------------------------------

function testApprovePreservesProposalAndResolves() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  const decided = decideBootstrapManifestEntry(manifest, keenEntry.id, 'approved');
  const decidedEntry = decided.entries.find((entry) => entry.id === keenEntry.id)!;

  assert.deepEqual(decidedEntry.proposed, keenEntry.proposed, 'approve must not alter the proposal');
  assert.equal(decidedEntry.admitted, undefined, 'approve carries no separate admitted value');
  assert.deepEqual(
    resolveAdmittedBootstrapProposal(decidedEntry),
    keenEntry.proposed,
    'an approved entry resolves to its original proposed value',
  );
}

function testRejectProducesNoAdmittedProposal() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  const decided = decideBootstrapManifestEntry(manifest, keenEntry.id, 'rejected');
  const decidedEntry = decided.entries.find((entry) => entry.id === keenEntry.id)!;

  assert.equal(resolveAdmittedBootstrapProposal(decidedEntry), undefined);
}

// ---------------------------------------------------------------------------
// 5. Edit requires same-kind validity and preserves evidence/discovery.
// ---------------------------------------------------------------------------

function testEditRequiresSameKindAndPreservesEvidenceAndDiscovery() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  const editedProposal = actorProposal('actor_keen_the_scholar', 'Keen the Scholar');

  const decided = decideBootstrapManifestEntry(manifest, keenEntry.id, 'edited', editedProposal);
  const decidedEntry = decided.entries.find((entry) => entry.id === keenEntry.id)!;

  assert.deepEqual(decidedEntry.evidence, keenEntry.evidence, 'edit must not alter preserved evidence');
  assert.deepEqual(
    decidedEntry.discoveryConfidence,
    keenEntry.discoveryConfidence,
    'edit must not rewrite discovery rationale',
  );
  assert.deepEqual(decidedEntry.admitted, editedProposal);
  assert.deepEqual(resolveAdmittedBootstrapProposal(decidedEntry), editedProposal);

  const wrongKindProposal = locationProposal('location_impostor', 'Impostor');
  assert.throws(
    () => decideBootstrapManifestEntry(manifest, keenEntry.id, 'edited', wrongKindProposal as unknown as BootstrapProposal),
    'edit must reject a proposal of a different supported kind',
  );
}

// ---------------------------------------------------------------------------
// 6. An unsupported entry left pending is not harmless; only reject clears it.
// ---------------------------------------------------------------------------

function testUnsupportedEntryLeftPendingBlocksCompletenessOnlyRejectClearsIt() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  const ironspireEntry = entryFor(manifest, 'location_ironspire');
  const factEntry = manifest.entries.find((entry) => entry.kind === 'fact_proposal')!;
  assert.equal(factEntry.supportedForApplication, false);

  let working = decideBootstrapManifestEntry(manifest, keenEntry.id, 'approved');
  working = decideBootstrapManifestEntry(working, ironspireEntry.id, 'approved');
  const povAssignments = assignments('actor_keen', 'location_ironspire');

  const stillPending = assessBootstrapReviewReadiness(working, povAssignments);
  assert.equal(stillPending.allEntriesDecided, false, 'an unsupported entry left pending must not be treated as decided');
  assert.equal(stillPending.complete, false);

  const rejected = decideBootstrapManifestEntry(working, factEntry.id, 'rejected');
  const nowComplete = assessBootstrapReviewReadiness(rejected, povAssignments);
  assert.equal(nowComplete.allEntriesDecided, true);
  assert.equal(nowComplete.complete, true);
}

// ---------------------------------------------------------------------------
// 7. Confidence never substitutes for an explicit decision.
// ---------------------------------------------------------------------------

function testHighConfidenceNeverAutoDecidesAnEntry() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  assert.equal(keenEntry.decision, 'pending');
  assert.equal(keenEntry.discoveryConfidence?.classification, 'corroborated');

  const readiness = assessBootstrapReviewReadiness(manifest, assignments(null, null));
  assert.equal(readiness.allEntriesDecided, false, 'corroborated confidence must not stand in for a decision');
  assert.equal(readiness.complete, false);
}

function testReadinessSourceNeverReferencesDiscoveryConfidence() {
  const path = fileURLToPath(new URL('../src/lib/bootstrapReview.ts', import.meta.url));
  const source = readFileSync(path, 'utf8');
  for (const forbidden of ['discoveryConfidence', 'supportingUnitCount', 'corroborated', 'classification']) {
    assert.ok(
      !source.includes(forbidden),
      `bootstrapReview.ts must never consult ${forbidden} -- readiness cannot be confidence-derived`,
    );
  }
}

// ---------------------------------------------------------------------------
// 8-9. POV/current-location resolution: only an actually-admitted entry of
// the correct kind counts, and re-editing/rejecting stales a stored id
// rather than silently remapping it.
// ---------------------------------------------------------------------------

function testPovAndLocationOnlyResolveThroughActuallyAdmittedCorrectKindEntries() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  const ironspireEntry = entryFor(manifest, 'location_ironspire');

  const pendingReadiness = assessBootstrapReviewReadiness(manifest, assignments('actor_keen', 'location_ironspire'));
  assert.equal(pendingReadiness.povResolves, false, 'a pending actor must not resolve as an admitted POV');
  assert.equal(pendingReadiness.currentLocationResolves, false);

  const rejectedManifest = decideBootstrapManifestEntry(
    decideBootstrapManifestEntry(manifest, keenEntry.id, 'rejected'),
    ironspireEntry.id,
    'rejected',
  );
  const rejectedReadiness = assessBootstrapReviewReadiness(rejectedManifest, assignments('actor_keen', 'location_ironspire'));
  assert.equal(rejectedReadiness.povResolves, false, 'a rejected entry must never resolve as admitted');
  assert.equal(rejectedReadiness.currentLocationResolves, false);

  const approvedManifest = decideBootstrapManifestEntry(
    decideBootstrapManifestEntry(manifest, keenEntry.id, 'approved'),
    ironspireEntry.id,
    'approved',
  );
  const wrongKindReadiness = assessBootstrapReviewReadiness(
    approvedManifest,
    assignments('location_ironspire', 'actor_keen'), // POV/location swapped on purpose
  );
  assert.equal(wrongKindReadiness.povResolves, false, 'a location id must never resolve as an admitted POV');
  assert.equal(wrongKindReadiness.currentLocationResolves, false, 'an actor id must never resolve as an admitted location');

  const unknownIdReadiness = assessBootstrapReviewReadiness(approvedManifest, assignments('actor_does_not_exist', 'location_ironspire'));
  assert.equal(unknownIdReadiness.povResolves, false, 'an id absent from the manifest must never resolve');

  const correctReadiness = assessBootstrapReviewReadiness(approvedManifest, assignments('actor_keen', 'location_ironspire'));
  assert.equal(correctReadiness.povResolves, true);
  assert.equal(correctReadiness.currentLocationResolves, true);
}

function testRejectingOrReEditingAnAssignedEntryStalesTheAssignmentRatherThanRemapping() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  const ironspireEntry = entryFor(manifest, 'location_ironspire');
  const approved = decideBootstrapManifestEntry(
    decideBootstrapManifestEntry(manifest, keenEntry.id, 'approved'),
    ironspireEntry.id,
    'approved',
  );
  const povAssignments = assignments('actor_keen', 'location_ironspire');
  assert.equal(assessBootstrapReviewReadiness(approved, povAssignments).povResolves, true);

  const rejectedAfter = decideBootstrapManifestEntry(approved, keenEntry.id, 'rejected');
  assert.equal(
    assessBootstrapReviewReadiness(rejectedAfter, povAssignments).povResolves,
    false,
    'rejecting the assigned entry must stale the assignment, not leave it silently true',
  );

  const renamedProposal = actorProposal('actor_keen_renamed', 'Keen');
  const reEdited = decideBootstrapManifestEntry(approved, keenEntry.id, 'edited', renamedProposal);
  assert.equal(
    assessBootstrapReviewReadiness(reEdited, povAssignments).povResolves,
    false,
    'the pre-edit id must not silently keep resolving once the entry is admitted under a new id',
  );
  assert.equal(
    assessBootstrapReviewReadiness(reEdited, assignments('actor_keen_renamed', 'location_ironspire')).povResolves,
    true,
    'the author must explicitly re-point the assignment at the new admitted id',
  );
}

// ---------------------------------------------------------------------------
// 11-16. The six-branch readiness predicate itself.
// ---------------------------------------------------------------------------

function testReadinessBranches() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  const ironspireEntry = entryFor(manifest, 'location_ironspire');
  const factEntry = manifest.entries.find((entry) => entry.kind === 'fact_proposal')!;

  const fullyDecided = decideBootstrapManifestEntry(
    decideBootstrapManifestEntry(
      decideBootstrapManifestEntry(manifest, keenEntry.id, 'approved'),
      ironspireEntry.id,
      'approved',
    ),
    factEntry.id,
    'rejected',
  );

  // 11. any pending entry -> incomplete
  assert.equal(
    assessBootstrapReviewReadiness(manifest, assignments('actor_keen', 'location_ironspire')).complete,
    false,
  );

  // 12. POV unassigned -> incomplete
  assert.equal(assessBootstrapReviewReadiness(fullyDecided, assignments(null, 'location_ironspire')).complete, false);
  assert.equal(assessBootstrapReviewReadiness(fullyDecided, assignments(null, 'location_ironspire')).povAssigned, false);

  // 13. current location unassigned -> incomplete
  assert.equal(assessBootstrapReviewReadiness(fullyDecided, assignments('actor_keen', null)).complete, false);
  assert.equal(assessBootstrapReviewReadiness(fullyDecided, assignments('actor_keen', null)).currentLocationAssigned, false);

  // 14. assignment resolves to a rejected entry -> incomplete
  const withRejectedActor = decideBootstrapManifestEntry(fullyDecided, keenEntry.id, 'rejected');
  assert.equal(
    assessBootstrapReviewReadiness(withRejectedActor, assignments('actor_keen', 'location_ironspire')).complete,
    false,
  );

  // 15. assignment resolves to the wrong kind, or to an unknown id -> incomplete
  assert.equal(
    assessBootstrapReviewReadiness(fullyDecided, assignments('location_ironspire', 'location_ironspire')).complete,
    false,
  );
  assert.equal(
    assessBootstrapReviewReadiness(fullyDecided, assignments('actor_unknown', 'location_ironspire')).complete,
    false,
  );

  // 16. every branch clear -> complete, and only then
  const readyReadiness = assessBootstrapReviewReadiness(fullyDecided, assignments('actor_keen', 'location_ironspire'));
  assert.equal(readyReadiness.complete, true);
  assert.equal(isBootstrapReviewComplete(fullyDecided, assignments('actor_keen', 'location_ironspire')), true);

  // The result must never claim more than review completeness -- no field
  // resembling a receipt, admission verdict, or success prediction.
  assert.deepEqual(
    Object.keys(readyReadiness).sort(),
    ['allEntriesDecided', 'complete', 'currentLocationAssigned', 'currentLocationResolves', 'povAssigned', 'povResolves'].sort(),
  );
}

// ---------------------------------------------------------------------------
// 19-20. Immutability and pure projection.
// ---------------------------------------------------------------------------

function testDecisionAndReadinessAreNonMutating() {
  const manifest = freshManifest();
  const manifestBefore = structuredClone(manifest);
  const keenEntry = entryFor(manifest, 'actor_keen');

  decideBootstrapManifestEntry(manifest, keenEntry.id, 'approved');
  assert.deepEqual(manifest, manifestBefore, 'decideBootstrapManifestEntry must not mutate its input manifest');

  const povAssignments = assignments('actor_keen', 'location_ironspire');
  const assignmentsBefore = structuredClone(povAssignments);
  assessBootstrapReviewReadiness(manifest, povAssignments);
  assert.deepEqual(manifest, manifestBefore, 'assessBootstrapReviewReadiness must not mutate its input manifest');
  assert.deepEqual(povAssignments, assignmentsBefore, 'assessBootstrapReviewReadiness must not mutate its input assignments');
}

function testReadinessNeverAutoSelectsOrRepairsAnything() {
  const manifest = freshManifest();
  const keenEntry = entryFor(manifest, 'actor_keen');
  const ironspireEntry = entryFor(manifest, 'location_ironspire');
  const onlyOneAdmittedActor = decideBootstrapManifestEntry(
    decideBootstrapManifestEntry(manifest, keenEntry.id, 'approved'),
    ironspireEntry.id,
    'approved',
  );

  // Exactly one admitted actor exists, POV is unassigned -- a pure projection
  // must report incomplete, never auto-fill the lone candidate.
  const readiness = assessBootstrapReviewReadiness(onlyOneAdmittedActor, assignments(null, 'location_ironspire'));
  assert.equal(readiness.povAssigned, false);
  assert.equal(readiness.complete, false);

  const first = assessBootstrapReviewReadiness(onlyOneAdmittedActor, assignments(null, 'location_ironspire'));
  const second = assessBootstrapReviewReadiness(onlyOneAdmittedActor, assignments(null, 'location_ironspire'));
  assert.deepEqual(first, second, 'repeated readiness assessment of unchanged input must be deterministic');
}

// ---------------------------------------------------------------------------
// 21. No reachable call into prepareBootstrap() from the readiness module.
// ---------------------------------------------------------------------------

function testReadinessModuleNeverCallsPrepareBootstrap() {
  const path = fileURLToPath(new URL('../src/lib/bootstrapReview.ts', import.meta.url));
  const source = readFileSync(path, 'utf8');
  // Strip comments before checking: bootstrapReview.ts's docs legitimately
  // discuss prepareBootstrap() in prose (why completeness isn't a success
  // prediction) -- only an actual call in code is forbidden.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(
    !/\bprepareBootstrap\s*\(/.test(code),
    'bootstrapReview.ts may import resolveAdmittedBootstrapProposal but must never call prepareBootstrap() itself -- ' +
    'review completeness must never be established by actually attempting admission',
  );
}

function run() {
  testApprovePreservesProposalAndResolves();
  testRejectProducesNoAdmittedProposal();
  testEditRequiresSameKindAndPreservesEvidenceAndDiscovery();
  testUnsupportedEntryLeftPendingBlocksCompletenessOnlyRejectClearsIt();
  testHighConfidenceNeverAutoDecidesAnEntry();
  testReadinessSourceNeverReferencesDiscoveryConfidence();
  testPovAndLocationOnlyResolveThroughActuallyAdmittedCorrectKindEntries();
  testRejectingOrReEditingAnAssignedEntryStalesTheAssignmentRatherThanRemapping();
  testReadinessBranches();
  testDecisionAndReadinessAreNonMutating();
  testReadinessNeverAutoSelectsOrRepairsAnything();
  testReadinessModuleNeverCallsPrepareBootstrap();
  console.log('B3c review decisions/readiness contract regression passed');
}

run();
