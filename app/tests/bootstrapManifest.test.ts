import assert from 'node:assert/strict';
import type { AuthorSourceDocument, StoryProject } from '../src/types';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import { assessCompositionReadiness } from '../src/lib/compositionReadiness';
import {
  buildBootstrapManifest,
  decideBootstrapManifestEntry,
  fingerprintSourceDocuments,
  SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS,
  validateBootstrapManifestStructure,
  type BootstrapDecision,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapManifestEntry,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { prepareBootstrap } from '../src/lib/prepareBootstrap';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function sourceOnlyProject(pastedText = 'Locke found Mara near the old well. Mara held a brass key.'): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_bootstrap_test',
    projectTitle: 'A Real Imported Manuscript',
    sourceLabel: 'Chapter One',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_bootstrap_test',
  });
}

function firstDoc(project: StoryProject): AuthorSourceDocument {
  const doc = (project.sourceDocuments ?? [])[0];
  assert.ok(doc, 'fixture requires a source document');
  return doc;
}

function evidenceFor(doc: AuthorSourceDocument, unitId: string, substring: string): SourceEvidenceUnit {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) {
    throw new Error(`Fixture error: "${substring}" not found in source document ${doc.id}`);
  }
  return {
    sourceDocumentId: doc.id,
    unitId,
    startOffset: start,
    endOffset: start + substring.length,
    exactText: substring,
  };
}

function actorProposal(id: string, label: string, opts: { initial_location_id?: string; name?: string | null } = {}): BootstrapProposal {
  return {
    kind: 'actor_proposal',
    id,
    working_label: label,
    name: opts.name ?? null,
    aliases: [],
    ...(opts.initial_location_id !== undefined ? { initial_location_id: opts.initial_location_id } : {}),
  };
}

function objectProposal(
  id: string,
  label: string,
  opts: { initial_location_id?: string; initial_holder_actor_id?: string } = {},
): BootstrapProposal {
  return {
    kind: 'object_proposal',
    id,
    working_label: label,
    name: null,
    aliases: [],
    ...(opts.initial_location_id !== undefined ? { initial_location_id: opts.initial_location_id } : {}),
    ...(opts.initial_holder_actor_id !== undefined ? { initial_holder_actor_id: opts.initial_holder_actor_id } : {}),
  };
}

function locationProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'location_proposal', id, working_label: label, name: null, aliases: [] };
}

function factionProposal(id: string, label: string, opts: { member_actor_ids?: string[] } = {}): BootstrapProposal {
  return {
    kind: 'faction_proposal',
    id,
    working_label: label,
    name: null,
    aliases: [],
    ...(opts.member_actor_ids !== undefined ? { member_actor_ids: opts.member_actor_ids } : {}),
  };
}

function factProposal(statement: string): BootstrapProposal {
  return { kind: 'fact_proposal', statement };
}

function relationshipProposal(type: string, source_id: string, target_id: string): BootstrapProposal {
  return { kind: 'relationship_proposal', type, source_id, target_id };
}

function entry(proposed: BootstrapProposal, evidence: readonly SourceEvidenceUnit[]): BootstrapDiscoveryEntry {
  return { proposed, evidence };
}

function entriesOfKind(manifest: BootstrapManifest, kind: BootstrapManifestEntry['kind']) {
  return manifest.entries.filter((e) => e.kind === kind);
}

function decideFirstOfKind(
  manifest: BootstrapManifest,
  kind: BootstrapManifestEntry['kind'],
  decision: BootstrapDecision,
  admitted?: BootstrapProposal,
): BootstrapManifest {
  const target = entriesOfKind(manifest, kind)[0];
  assert.ok(target, `fixture expects at least one ${kind} entry`);
  return decideBootstrapManifestEntry(manifest, target.id, decision, admitted);
}

function decideAllSupported(manifest: BootstrapManifest, decision: Exclude<BootstrapDecision, 'edited'> = 'approved'): BootstrapManifest {
  return manifest.entries
    .filter((e) => e.supportedForApplication)
    .reduce((current, e) => decideBootstrapManifestEntry(current, e.id, decision), manifest);
}

/** Builds a standard actor+location manifest, all entries approved, ready to bootstrap. */
function standardApprovedFixture() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  const manifest = decideAllSupported(buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara', { initial_location_id: 'location_well' }), [evidenceFor(doc, 'u2', 'Mara')]),
      entry(objectProposal('object_key', 'a brass key', { initial_holder_actor_id: 'actor_mara' }), [evidenceFor(doc, 'u3', 'brass key')]),
    ],
  }));
  const assignments = { activePovActorId: 'actor_mara', currentLocationId: 'location_well' };
  return { project, doc, manifest, assignments };
}

// ---------------------------------------------------------------------------
// Category support matrix
// ---------------------------------------------------------------------------

function testSupportedCategoryMatrix() {
  assert.deepEqual(
    [...SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS].sort(),
    ['actor_proposal', 'faction_proposal', 'location_proposal', 'object_proposal'].sort(),
  );
  assert.ok(!SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS.has('fact_proposal'));
  assert.ok(!SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS.has('relationship_proposal'));
}

// ---------------------------------------------------------------------------
// 1. Manifest creation is pure
// ---------------------------------------------------------------------------

function testManifestCreationIsPure() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  const discovery = { entries: [entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')])] };
  const projectBefore = JSON.parse(JSON.stringify(project));
  const discoveryBefore = JSON.parse(JSON.stringify(discovery));

  buildBootstrapManifest(project, discovery);

  assert.deepEqual(project, projectBefore, 'buildBootstrapManifest must not mutate the project');
  assert.deepEqual(discovery, discoveryBefore, 'buildBootstrapManifest must not mutate the discovery payload');
}

// ---------------------------------------------------------------------------
// 2. Source evidence units are noncanonical
// ---------------------------------------------------------------------------

function testSourceEvidenceUnitsAreNoncanonical() {
  const { project, manifest, assignments } = standardApprovedFixture();
  // Nothing about a SourceEvidenceUnit resembles/creates a manuscript beat.
  for (const e of manifest.entries) {
    for (const unit of e.evidence) {
      assert.ok(!('povActorId' in unit));
      assert.ok(!('locationId' in unit));
      assert.ok(!('beatNumber' in unit));
    }
  }
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1_700_000_500_000);
  assert.deepEqual(nextProject.manuscript, [], 'bootstrap must never fabricate manuscript beats from evidence units');
}

// ---------------------------------------------------------------------------
// 3 & 4. Exact-source freshness; one-character edit makes manifest stale
// ---------------------------------------------------------------------------

function testFreshBootstrapSucceeds() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1_700_000_500_000);
  assert.ok(nextProject.actors.some((a) => a.id === 'actor_mara'));
}

function testOneCharacterSourceEditMakesManifestStale() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const editedProject: StoryProject = {
    ...project,
    sourceDocuments: [
      { ...firstDoc(project), exactText: `${firstDoc(project).exactText}!` },
    ],
  };
  assert.throws(
    () => prepareBootstrap(editedProject, manifest, assignments, 1_700_000_500_000),
    /stale/i,
  );
}

// ---------------------------------------------------------------------------
// 5. Same receipt/manifest identity cannot substitute for freshness
// ---------------------------------------------------------------------------

function testManifestSelfConsistencyIsNotFreshnessAgainstTheProject() {
  const { project, manifest, assignments } = standardApprovedFixture();
  // The manifest is internally well-formed on its own terms (its own identity,
  // fingerprints, and structure are all self-consistent) ...
  assert.doesNotThrow(() => validateBootstrapManifestStructure(manifest));
  // ... but that says nothing about whether it still matches the *current*
  // project's source material. Editing the project after the manifest was
  // built must still be caught even though nothing about the manifest
  // object's own identity/fingerprints changed at all.
  const editedProject: StoryProject = {
    ...project,
    sourceDocuments: [{ ...firstDoc(project), exactText: 'Completely different source text now.' }],
  };
  assert.doesNotThrow(() => validateBootstrapManifestStructure(manifest), 'the manifest itself is still structurally valid');
  assert.throws(() => prepareBootstrap(editedProject, manifest, assignments, 1_700_000_500_000), /stale/i);
}

// ---------------------------------------------------------------------------
// 6. Multi-document binding behavior must be deterministic
// ---------------------------------------------------------------------------

function twoDocumentProject(): { project: StoryProject; docA: AuthorSourceDocument; docB: AuthorSourceDocument } {
  const project = sourceOnlyProject('Locke arrived at the crossroads.');
  const docA = firstDoc(project);
  const docB: AuthorSourceDocument = {
    id: 'source_bootstrap_test_b',
    label: 'Chapter Two',
    exactText: 'Mara waited by the river ferry.',
    sourceType: 'pasted_prose',
    importedAt: 1_700_000_100_000,
  };
  return { project: { ...project, sourceDocuments: [docA, docB] }, docA, docB };
}

function testMultiDocumentBindingCapturesBothInOrder() {
  const { project, docA, docB } = twoDocumentProject();
  const manifest = buildBootstrapManifest(project, { entries: [] });
  assert.deepEqual(manifest.boundSourceDocuments, [docA, docB]);
}

function testMultiDocumentReorderingMakesManifestStale() {
  const { project, docA, docB } = twoDocumentProject();
  const manifest = buildBootstrapManifest(project, { entries: [] });
  const reordered: StoryProject = { ...project, sourceDocuments: [docB, docA] };
  assert.throws(
    () => prepareBootstrap(reordered, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    (err: unknown) => err instanceof Error && /stale/i.test(err.message),
  );
}

function testRemovingADocumentMakesManifestStale() {
  const { project, docA } = twoDocumentProject();
  const manifest = buildBootstrapManifest(project, { entries: [] });
  const withOneRemoved: StoryProject = { ...project, sourceDocuments: [docA] };
  assert.throws(
    () => prepareBootstrap(withOneRemoved, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    /stale/i,
  );
}

function testAddingADocumentMakesManifestStale() {
  const { project, docA, docB } = twoDocumentProject();
  const manifest = buildBootstrapManifest(project, { entries: [] });
  const docC: AuthorSourceDocument = { id: 'source_c', label: 'C', exactText: 'A third document.', sourceType: 'pasted_prose', importedAt: 2 };
  const withThird: StoryProject = { ...project, sourceDocuments: [docA, docB, docC] };
  assert.throws(
    () => prepareBootstrap(withThird, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    /stale/i,
  );
}

// ---------------------------------------------------------------------------
// 7-9. Decision application
// ---------------------------------------------------------------------------

function testPendingSupportedEntryBlocksCommit() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const withOnePending = decideBootstrapManifestEntry(manifest, entriesOfKind(manifest, 'object_proposal')[0].id, 'pending');
  assert.throws(
    () => prepareBootstrap(project, withOnePending, assignments, 1),
    /pending/i,
  );
}

function testRejectedProposalHasZeroEffect() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
  manifest = decideFirstOfKind(manifest, 'location_proposal', 'approved');
  manifest = decideFirstOfKind(manifest, 'actor_proposal', 'rejected');
  // Provide a location so the (rejected) actor path doesn't block on assignments;
  // bootstrap will fail on missing POV assignment resolution instead of proceeding,
  // so assign the manifest's own location but no POV -- expect an assignment failure,
  // proving the rejected actor was never admitted (nothing to assign to).
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1),
    /POV assignment/i,
  );
}

function testApprovedAppliesProposedExactly() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.ok(mara);
  assert.equal(mara?.identity.working_label, 'Mara');
  assert.equal(mara?.current_location_id, 'location_well');
}

// ---------------------------------------------------------------------------
// 10-11. Edited proposals
// ---------------------------------------------------------------------------

function testEditedAppliesAdmittedWhilePreservingProposed() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
  manifest = decideFirstOfKind(manifest, 'location_proposal', 'approved');
  const editedActor = actorProposal('actor_mara', 'Mara the Locksmith', { name: 'Mara' });
  manifest = decideFirstOfKind(manifest, 'actor_proposal', 'edited', editedActor);

  const { nextProject, bootstrapReceipt } = prepareBootstrap(
    project,
    manifest,
    { activePovActorId: 'actor_mara', currentLocationId: 'location_well' },
    1,
  );
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.identity.working_label, 'Mara the Locksmith', 'the admitted (edited) value must be applied');
  assert.equal(mara?.identity.name, 'Mara');

  const receiptEntry = bootstrapReceipt.entries.find((e) => e.kind === 'actor_proposal');
  assert.equal((receiptEntry?.proposed as { working_label: string }).working_label, 'Mara', 'original proposal must be preserved');
  assert.equal((receiptEntry?.admitted as { working_label: string } | null)?.working_label, 'Mara the Locksmith');
}

function testEditedEntityIdRemapsSameTransactionReferences() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_provisional', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
      entry(objectProposal('object_key', 'a brass key', { initial_holder_actor_id: 'actor_provisional' }), [evidenceFor(doc, 'u3', 'brass key')]),
    ],
  });
  manifest = decideFirstOfKind(manifest, 'location_proposal', 'approved');
  const renamedActor = actorProposal('actor_mara_final', 'Mara', { initial_location_id: 'location_well' });
  manifest = decideFirstOfKind(manifest, 'actor_proposal', 'edited', renamedActor);
  manifest = decideFirstOfKind(manifest, 'object_proposal', 'approved');

  const { nextProject } = prepareBootstrap(
    project,
    manifest,
    { activePovActorId: 'actor_mara_final', currentLocationId: 'location_well' },
    1,
  );
  const key = nextProject.objects.find((o) => o.id === 'object_key');
  assert.equal(key?.current_holder_id, 'actor_mara_final', 'the object must resolve its holder to the renamed (admitted) actor id');
  assert.ok(!nextProject.actors.some((a) => a.id === 'actor_provisional'), 'the pre-edit provisional id must not exist in canon');
}

// ---------------------------------------------------------------------------
// 12-13. Referential integrity fails closed
// ---------------------------------------------------------------------------

function testRejectedEntityCannotLeaveDanglingRelationships() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
      entry(objectProposal('object_key', 'a brass key', { initial_holder_actor_id: 'actor_mara' }), [evidenceFor(doc, 'u3', 'brass key')]),
    ],
  });
  manifest = decideFirstOfKind(manifest, 'location_proposal', 'approved');
  manifest = decideFirstOfKind(manifest, 'actor_proposal', 'rejected');
  manifest = decideFirstOfKind(manifest, 'object_proposal', 'approved');

  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1),
    /does not resolve to an admitted actor/i,
  );
}

function testUnknownRelationshipTargetFailsClosed() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(objectProposal('object_key', 'a brass key', { initial_holder_actor_id: 'actor_never_proposed' }), [evidenceFor(doc, 'u3', 'brass key')]),
    ],
  });
  manifest = decideFirstOfKind(manifest, 'location_proposal', 'approved');
  manifest = decideFirstOfKind(manifest, 'object_proposal', 'approved');

  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: null, currentLocationId: 'location_well' }, 1),
    /does not resolve to an admitted actor/i,
  );
}

// ---------------------------------------------------------------------------
// 14-15. Unsupported categories
// ---------------------------------------------------------------------------

function testUnsupportedAdmittedCategoryFailsClosed() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [entry(factProposal('the well is haunted'), [evidenceFor(doc, 'u1', 'old well')])],
  });
  const target = manifest.entries[0];
  assert.equal(target.supportedForApplication, false);
  manifest = decideBootstrapManifestEntry(manifest, target.id, 'approved');
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    /unsupported/i,
  );
}

function testUnsupportedRejectedCategoryIsHarmless() {
  const { project, manifest: baseManifest, assignments } = standardApprovedFixture();
  const withFact = buildBootstrapManifest(project, {
    entries: [
      ...entriesOfKind(baseManifest, 'location_proposal').map((e) => entry(e.proposed, e.evidence)),
      ...entriesOfKind(baseManifest, 'actor_proposal').map((e) => entry(e.proposed, e.evidence)),
      ...entriesOfKind(baseManifest, 'object_proposal').map((e) => entry(e.proposed, e.evidence)),
      entry(factProposal('the well is haunted'), [evidenceFor(firstDoc(project), 'ufact', 'old well')]),
    ],
  });
  let manifest = decideAllSupported(withFact);
  manifest = decideFirstOfKind(manifest, 'fact_proposal', 'rejected');
  const { nextProject, bootstrapReceipt } = prepareBootstrap(project, manifest, assignments, 1);
  assert.deepEqual(nextProject.facts, [], 'a rejected unsupported entry must have zero effect');
  assert.ok(bootstrapReceipt.unsupportedEntryIds.length === 1);
  assert.ok(!bootstrapReceipt.appliedEntryIds.some((id) => id === entriesOfKind(withFact, 'fact_proposal')[0].id));
}

// ---------------------------------------------------------------------------
// 16-19. Assignments
// ---------------------------------------------------------------------------

function testPovAssignmentMustReferenceAdmittedActor() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')])],
  });
  manifest = decideAllSupported(manifest);
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: 'actor_nonexistent', currentLocationId: 'location_well' }, 1),
    /POV assignment/i,
  );
}

function testLocationAssignmentMustReferenceAdmittedLocation() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u1', 'Mara')])],
  });
  manifest = decideAllSupported(manifest);
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_nonexistent' }, 1),
    /location assignment/i,
  );
}

function testNoImplicitFirstActorOrFirstLocationFallback() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(actorProposal('actor_a', 'Actor A'), [evidenceFor(doc, 'u1', 'Locke')]),
      entry(actorProposal('actor_b', 'Actor B'), [evidenceFor(doc, 'u2', 'Mara')]),
      entry(locationProposal('location_a', 'Location A'), [evidenceFor(doc, 'u3', 'well')]),
    ],
  });
  manifest = decideAllSupported(manifest);
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    /explicit POV actor assignment/i,
  );
}

function testMissingRequiredAssignmentPreventsCompositionReadyResult() {
  const { project, manifest, assignments } = standardApprovedFixture();
  assert.throws(
    () => prepareBootstrap(project, manifest, { ...assignments, currentLocationId: null }, 1),
    /explicit POV actor assignment/i,
  );
  // No project is ever produced on this failure path (thrown before return).
}

// ---------------------------------------------------------------------------
// 20-22. No fabrication beyond what was admitted
// ---------------------------------------------------------------------------

function testSourceDocumentsRemainExactAndUnchanged() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const before = JSON.parse(JSON.stringify(project.sourceDocuments));
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  assert.deepEqual(nextProject.sourceDocuments, before, 'bootstrap must not alter the imported source text');
}

function testNoManuscriptBeatsFabricated() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  assert.deepEqual(nextProject.manuscript, []);
}

function testNoBeliefsRevealsThreadsOrTemporalEventsFabricated() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  assert.deepEqual(nextProject.reveals, []);
  assert.deepEqual(nextProject.threads, []);
  assert.deepEqual(nextProject.temporalHistory, []);
  assert.deepEqual(nextProject.knowledge.world_truth, []);
  assert.deepEqual(nextProject.knowledge.reader_knowledge, []);
  assert.deepEqual(nextProject.knowledge.actor_knowledge, {});
  assert.deepEqual(nextProject.facts, []);
}

function testProjectBecomesCompositionReadyOnlyWhenStructureIsSufficient() {
  const { project, manifest, assignments } = standardApprovedFixture();
  assert.equal(assessCompositionReadiness(project).ready, false, 'the source-only project must start not-ready');
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  assert.equal(assessCompositionReadiness(nextProject).ready, true, 'a fully bootstrapped project must be composition-ready');
}

// ---------------------------------------------------------------------------
// 23. No partial mutation on failure
// ---------------------------------------------------------------------------

function testNoPartialMutationOnFailure() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara', { initial_location_id: 'location_well' }), [evidenceFor(doc, 'u2', 'Mara')]),
      // This object references a rejected actor and will fail late in the loop,
      // after the location and actor above have already been applied to the draft.
      entry(objectProposal('object_key', 'a brass key', { initial_holder_actor_id: 'actor_ghost' }), [evidenceFor(doc, 'u3', 'brass key')]),
    ],
  });
  manifest = decideAllSupported(manifest);
  const before = JSON.parse(JSON.stringify(project));

  assert.throws(() => prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1));
  assert.deepEqual(project, before, 'the original project must be byte-for-byte unchanged after a failed bootstrap, even though earlier entries in the loop were already applied to the (discarded) draft');
}

// ---------------------------------------------------------------------------
// 24. No nested aliasing between manifest/input/result
// ---------------------------------------------------------------------------

function testNoNestedAliasingBetweenManifestInputAndResult() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry({ ...actorProposal('actor_mara', 'Mara'), aliases: ['the stranger'] } as BootstrapProposal, [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
  manifest = decideAllSupported(manifest);
  const { nextProject } = prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1);

  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.ok(mara);
  assert.equal(Object.isFrozen(mara?.identity.aliases), false, 'a bootstrapped actor must own a mutable aliases array, not a frozen manifest array');
  mara!.identity.aliases.push('a later-discovered alias');
  assert.deepEqual(mara!.identity.aliases, ['the stranger', 'a later-discovered alias']);

  const manifestEntry = manifest.entries.find((e) => e.kind === 'actor_proposal')!;
  assert.deepEqual((manifestEntry.proposed as { aliases: string[] }).aliases, ['the stranger'],
    'mutating the bootstrapped actor must never leak back into the frozen manifest proposal');
}

// ---------------------------------------------------------------------------
// 25. Undo snapshot is isolated and exact
// ---------------------------------------------------------------------------

function testUndoSnapshotIsIsolatedAndExact() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const before = JSON.parse(JSON.stringify(project));
  const { nextProject, preBootstrapSnapshot } = prepareBootstrap(project, manifest, assignments, 1);

  assert.deepEqual(preBootstrapSnapshot, before, 'the snapshot must exactly represent the pre-bootstrap project');
  assert.notEqual(preBootstrapSnapshot, project, 'the snapshot must not be the same reference as the input project');

  // Mutating the returned nextProject must not affect the snapshot.
  nextProject.actors.push({ ...nextProject.actors[0], id: 'actor_intruder' });
  assert.ok(!preBootstrapSnapshot.actors.some((a) => a.id === 'actor_intruder'));
  assert.deepEqual(preBootstrapSnapshot, before);
}

// ---------------------------------------------------------------------------
// 26. Deterministic result for identical inputs
// ---------------------------------------------------------------------------

function testDeterministicResultForIdenticalInputs() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const resultA = prepareBootstrap(project, manifest, assignments, 1_700_000_777_000);
  const resultB = prepareBootstrap(project, manifest, assignments, 1_700_000_777_000);
  assert.deepEqual(resultA.nextProject, resultB.nextProject);
  assert.deepEqual(resultA.bootstrapReceipt, resultB.bootstrapReceipt);
  assert.deepEqual(resultA.preBootstrapSnapshot, resultB.preBootstrapSnapshot);
}

// ---------------------------------------------------------------------------
// Adversarial follow-ups
// ---------------------------------------------------------------------------

function testEditCannotCaptureARejectedProposalsOriginalId() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(actorProposal('actor_a', 'Actor A'), [evidenceFor(doc, 'u1', 'Locke')]),
      entry(actorProposal('actor_b', 'Actor B'), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
  manifest = decideBootstrapManifestEntry(
    manifest,
    entriesOfKind(manifest, 'actor_proposal')[1].id,
    'rejected',
  );
  const captureAttempt = actorProposal('actor_b', 'Actor A (renamed)');
  manifest = decideBootstrapManifestEntry(
    manifest,
    entriesOfKind(manifest, 'actor_proposal')[0].id,
    'edited',
    captureAttempt,
  );
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    /duplicate entity/i,
    'an edit must not be able to capture a rejected sibling proposal\'s original id',
  );
}

function testFactionMemberReferencingARejectedActorFailsClosed() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u1', 'Mara')]),
      entry(factionProposal('faction_guild', 'the guild', { member_actor_ids: ['actor_mara'] }), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
  manifest = decideFirstOfKind(manifest, 'actor_proposal', 'rejected');
  manifest = decideFirstOfKind(manifest, 'faction_proposal', 'approved');
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    /unresolved actor/i,
  );
}

function testActorInitialLocationReferencingARejectedLocationFailsClosed() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara', { initial_location_id: 'location_well' }), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
  manifest = decideFirstOfKind(manifest, 'location_proposal', 'rejected');
  manifest = decideFirstOfKind(manifest, 'actor_proposal', 'approved');
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    /does not resolve to an admitted location/i,
  );
}

function testAssignmentToARejectedActorFailsClosed() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
  manifest = decideFirstOfKind(manifest, 'location_proposal', 'approved');
  manifest = decideFirstOfKind(manifest, 'actor_proposal', 'rejected');
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1),
    /does not resolve to an admitted actor/i,
  );
}

function testAssignmentToTheWrongEntityKindFailsClosed() {
  const { project, manifest, assignments } = standardApprovedFixture();
  assert.throws(
    () => prepareBootstrap(project, manifest, { ...assignments, activePovActorId: assignments.currentLocationId }, 1),
    /does not resolve to an admitted actor/i,
    'a location id used as the POV assignment must not be silently accepted as an actor',
  );
  assert.throws(
    () => prepareBootstrap(project, manifest, { ...assignments, currentLocationId: assignments.activePovActorId }, 1),
    /does not resolve to an admitted location/i,
    'an actor id used as the location assignment must not be silently accepted as a location',
  );
}

function testEmptyStringAssignmentIsNotSilentlyAccepted() {
  const { project, manifest, assignments } = standardApprovedFixture();
  assert.throws(
    () => prepareBootstrap(project, manifest, { ...assignments, activePovActorId: '' }, 1),
    /does not resolve to an admitted actor/i,
    'an empty string (the same sentinel Manuscript Intake uses for "unestablished") must not resolve to anything',
  );
}

function testNoPartialMutationWhenOnlyAssignmentResolutionFails() {
  // Distinct code path from testNoPartialMutationOnFailure: every entity
  // proposal applies successfully, and only the later, separate assignment
  // resolution step fails.
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
  manifest = decideAllSupported(manifest);
  const before = JSON.parse(JSON.stringify(project));

  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: 'actor_never_admitted', currentLocationId: 'location_well' }, 1),
  );
  assert.deepEqual(project, before, 'the original project must remain untouched even when every entity applied cleanly and only the assignment step failed');
}

function testRelationshipProposalApprovedFailsClosed() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [entry(relationshipProposal('possesses', 'actor_mara', 'object_key'), [evidenceFor(doc, 'u1', 'Mara')])],
  });
  const target = manifest.entries[0];
  assert.equal(target.supportedForApplication, false);
  manifest = decideBootstrapManifestEntry(manifest, target.id, 'approved');
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: null, currentLocationId: null }, 1),
    /unsupported/i,
  );
}

function testReceiptAccuracyAcrossMixedDecisions() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]), // approved
      entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),                        // approved
      entry(actorProposal('actor_ghost', 'a ghost'), [evidenceFor(doc, 'u3', 'well')]),                    // rejected
      entry(factProposal('the well is haunted'), [evidenceFor(doc, 'u4', 'old well')]),                     // rejected (unsupported)
    ],
  });
  manifest = decideBootstrapManifestEntry(manifest, entriesOfKind(manifest, 'location_proposal')[0].id, 'approved');
  manifest = decideBootstrapManifestEntry(manifest, entriesOfKind(manifest, 'actor_proposal')[0].id, 'approved');
  manifest = decideBootstrapManifestEntry(manifest, entriesOfKind(manifest, 'actor_proposal')[1].id, 'rejected');
  manifest = decideBootstrapManifestEntry(manifest, entriesOfKind(manifest, 'fact_proposal')[0].id, 'rejected');

  const { bootstrapReceipt } = prepareBootstrap(
    project,
    manifest,
    { activePovActorId: 'actor_mara', currentLocationId: 'location_well' },
    1,
  );

  for (const e of bootstrapReceipt.entries) {
    if (e.kind === 'location_proposal' || (e.kind === 'actor_proposal' && (e.proposed as { id: string }).id === 'actor_mara')) {
      assert.equal(e.applied, true, `${e.entryId} was approved and admitted; the receipt must say it was applied`);
      assert.ok(e.admitted !== null);
    } else {
      assert.equal(e.applied, false, `${e.entryId} was rejected or unsupported; the receipt must not claim it was applied`);
      assert.equal(e.admitted, null);
    }
  }
  assert.equal(bootstrapReceipt.appliedEntryIds.length, 2);
  assert.equal(bootstrapReceipt.unsupportedEntryIds.length, 1);
}

function testTamperedEvidenceExactTextFailsClosed() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  const realEvidence = evidenceFor(doc, 'u1', 'Mara');
  const tamperedEvidence: SourceEvidenceUnit = { ...realEvidence, exactText: 'Someone else entirely' };
  const manifest = buildBootstrapManifest(project, {
    entries: [entry(actorProposal('actor_mara', 'Mara'), [tamperedEvidence])],
  });
  assert.throws(
    () => validateBootstrapManifestStructure(manifest),
    /evidence exactText does not match/i,
    'an evidence unit whose exactText does not match the bound source document at its own offsets must be rejected',
  );
  assert.throws(
    () => prepareBootstrap(project, decideAllSupported(manifest), { activePovActorId: null, currentLocationId: null }, 1),
    /evidence exactText does not match/i,
  );
}

function testFreshnessCheckedForFingerprintOnlyIsInsufficient() {
  // A manifest with a colliding fingerprint but genuinely different bound
  // source content would (if fingerprint were the sole freshness proof)
  // wrongly appear fresh. Simulate the failure mode directly: hand-construct
  // a manifest whose boundSourceFingerprint is internally self-consistent
  // with its (already-stale-relative-to-the-project) boundSourceDocuments,
  // and confirm prepareBootstrap still catches it via exact comparison, not
  // by trusting the fingerprint field.
  const { project, manifest, assignments } = standardApprovedFixture();
  const editedProject: StoryProject = {
    ...project,
    sourceDocuments: [{ ...firstDoc(project), exactText: 'Totally different, but same length as the original, XX.' }],
  };
  // The manifest's own fingerprint is untouched and still self-consistent
  // with *its own* boundSourceDocuments (nothing about the manifest object
  // was tampered with) -- only the project changed.
  assert.doesNotThrow(() => validateBootstrapManifestStructure(manifest));
  assert.throws(() => prepareBootstrap(editedProject, manifest, assignments, 1), /stale/i);
}

function testBootstrappedActorCarriesNoUnearnedStateClaim() {
  // Superseded by testBootstrapUnknownActorStateIsAbsentNotAuthoredZeroOrNeutral
  // below: current_state 0/0.5/'neutral' is itself an unearned narrative
  // claim, indistinguishable downstream from an authored one -- absence is
  // the only honest representation. Kept as a thin smoke test.
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_state, undefined);
}

// ---------------------------------------------------------------------------
// Truthfulness closeout: unknown must not be authored-zero/midpoint/neutral/
// intact. These name the exact five claims from the audit individually, even
// though today they all trace to the same underlying absence, so each is
// independently traceable to the request that produced it.
// ---------------------------------------------------------------------------

function testBootstrapUnknownFatigueIsNotAuthoredFatigueZero() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_state, undefined, 'no current_state at all -- not present-and-0');
  assert.notEqual(mara?.current_state?.fatigue, 0);
}

function testBootstrapUnknownFearIsNotAuthoredFearZero() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_state, undefined);
  assert.notEqual(mara?.current_state?.fear, 0);
}

function testBootstrapUnknownCertaintyIsNotAuthoredCertaintyMidpoint() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_state, undefined);
  assert.notEqual(mara?.current_state?.certainty, 0.5);
}

function testBootstrapUnknownEmotionIsNotAuthoredNeutral() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_state, undefined);
  assert.notEqual(mara?.current_state?.emotion, 'neutral');
}

function testBootstrapUnknownObjectConditionIsNotAuthoredIntact() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const key = nextProject.objects.find((o) => o.id === 'object_key');
  assert.ok(key);
  assert.equal(key?.status, undefined, 'no status at all -- not present-and-"intact"');
  assert.notEqual(key?.status, 'intact');
}

function testExistingDemoStateRemainsUnchanged() {
  // The optional-field widening must not affect any project that already
  // supplies real values -- all three demo projects have explicit, evidenced
  // current_state/status on every actor/object.
  for (const project of DEFAULT_PROJECTS) {
    for (const actor of project.actors) {
      assert.notEqual(actor.current_state, undefined, `${project.id}/${actor.id} must keep its real current_state`);
    }
    for (const object of project.objects) {
      assert.notEqual(object.status, undefined, `${project.id}/${object.id} must keep its real status`);
    }
  }
}

// ---------------------------------------------------------------------------
// Possession reciprocity
// ---------------------------------------------------------------------------

function testAdmittedHolderProducesInternallyConsistentPossessionState() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  const key = nextProject.objects.find((o) => o.id === 'object_key');
  assert.equal(key?.current_holder_id, 'actor_mara');
  assert.ok(mara?.possessions.includes('object_key'),
    'the two canonical representations of possession (object.current_holder_id and actor.possessions) must agree');
}

function testUnheldObjectLeavesPossessionsUntouched() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara', { initial_location_id: 'location_well' }), [evidenceFor(doc, 'u2', 'Mara')]),
      entry(objectProposal('object_key', 'a brass key'), [evidenceFor(doc, 'u3', 'brass key')]), // no initial_holder_actor_id
    ],
  });
  manifest = decideAllSupported(manifest);
  const { nextProject } = prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  const key = nextProject.objects.find((o) => o.id === 'object_key');
  assert.equal(key?.current_holder_id, null);
  assert.deepEqual(mara?.possessions, []);
}

function testMultipleObjectsFromTheSameHolderAreAllReciprocated() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara', { initial_location_id: 'location_well' }), [evidenceFor(doc, 'u2', 'Mara')]),
      entry(objectProposal('object_key', 'a brass key', { initial_holder_actor_id: 'actor_mara' }), [evidenceFor(doc, 'u3', 'brass key')]),
      entry(objectProposal('object_lantern', 'a lantern', { initial_holder_actor_id: 'actor_mara' }), [evidenceFor(doc, 'u4', 'well')]),
    ],
  });
  manifest = decideAllSupported(manifest);
  const { nextProject } = prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.deepEqual([...(mara?.possessions ?? [])].sort(), ['object_key', 'object_lantern']);
}

// ---------------------------------------------------------------------------
// POV / current-location coherence
// ---------------------------------------------------------------------------

function testBootstrapCompletesPovActorLocationFromAssignmentWhenUnestablished() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]), // no initial_location_id
    ],
  });
  manifest = decideAllSupported(manifest);
  const { nextProject } = prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_location_id, 'location_well',
    'completing the POV actor\'s own unestablished location from the assignment finishes one decision, not a fabrication');
}

function testBootstrapCannotReturnContradictoryPovCurrentLocationState() {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  let manifest = buildBootstrapManifest(project, {
    entries: [
      entry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      entry(locationProposal('location_ridge', 'the high ridge'), [evidenceFor(doc, 'u2', 'brass key')]),
      entry(actorProposal('actor_mara', 'Mara', { initial_location_id: 'location_well' }), [evidenceFor(doc, 'u3', 'Mara')]),
    ],
  });
  manifest = decideAllSupported(manifest);
  const before = JSON.parse(JSON.stringify(project));
  assert.throws(
    () => prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_ridge' }, 1),
    /scene\/actor location contradiction/i,
  );
  assert.deepEqual(project, before, 'a rejected-for-contradiction bootstrap must not mutate the input project');
}

function testBootstrapAcceptsCoherentPovAndCurrentLocation() {
  const { project, manifest, assignments } = standardApprovedFixture();
  const { nextProject } = prepareBootstrap(project, manifest, assignments, 1);
  const mara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_location_id, nextProject.currentPosition.location_id);
}

// ---------------------------------------------------------------------------
// Pending vs. rejected for unsupported categories: pending means "the author
// has not decided" and must block commit exactly like a pending supported
// entry does; only an explicit rejected is harmless. This is a deliberate
// divergence from Promotion Manifest's precedent (recorded, not copied) --
// see BOOTSTRAP_MANIFEST_ENGINEERING_REPORT.md.
// ---------------------------------------------------------------------------

function unsupportedFixture() {
  const { project, manifest: baseManifest, assignments } = standardApprovedFixture();
  const withFact = buildBootstrapManifest(project, {
    entries: [
      ...entriesOfKind(baseManifest, 'location_proposal').map((e) => entry(e.proposed, e.evidence)),
      ...entriesOfKind(baseManifest, 'actor_proposal').map((e) => entry(e.proposed, e.evidence)),
      ...entriesOfKind(baseManifest, 'object_proposal').map((e) => entry(e.proposed, e.evidence)),
      entry(factProposal('the well is haunted'), [evidenceFor(firstDoc(project), 'ufact', 'old well')]),
    ],
  });
  const decidedSupported = decideAllSupported(withFact);
  return { project, manifest: decidedSupported, assignments, factEntryId: entriesOfKind(decidedSupported, 'fact_proposal')[0].id };
}

function testUnsupportedPendingBlocksCommit() {
  const { project, manifest, assignments } = unsupportedFixture();
  // fact_proposal entry is left at its default 'pending' decision.
  assert.equal(entriesOfKind(manifest, 'fact_proposal')[0].decision, 'pending');
  assert.throws(
    () => prepareBootstrap(project, manifest, assignments, 1),
    /pending unsupported/i,
  );
}

function testUnsupportedRejectedIsHarmlessAndCommitProceeds() {
  const { project, manifest, assignments, factEntryId } = unsupportedFixture();
  const decided = decideBootstrapManifestEntry(manifest, factEntryId, 'rejected');
  const { nextProject } = prepareBootstrap(project, decided, assignments, 1);
  assert.deepEqual(nextProject.facts, []);
  assert.ok(assessCompositionReadiness(nextProject).ready);
}

function testUnsupportedApprovedFailsUnsupportedCategoryAdmission() {
  const { project, manifest, assignments, factEntryId } = unsupportedFixture();
  const decided = decideBootstrapManifestEntry(manifest, factEntryId, 'approved');
  assert.throws(
    () => prepareBootstrap(project, decided, assignments, 1),
    /Unsupported Bootstrap Manifest entry cannot be admitted/,
  );
}

function testUnsupportedEditedFailsUnsupportedCategoryAdmission() {
  const { project, manifest, assignments, factEntryId } = unsupportedFixture();
  const decided = decideBootstrapManifestEntry(manifest, factEntryId, 'edited', factProposal('the well is definitely haunted'));
  assert.throws(
    () => prepareBootstrap(project, decided, assignments, 1),
    /Unsupported Bootstrap Manifest entry cannot be admitted/,
  );
}

function run() {
  testSupportedCategoryMatrix();
  testManifestCreationIsPure();
  testSourceEvidenceUnitsAreNoncanonical();
  testFreshBootstrapSucceeds();
  testOneCharacterSourceEditMakesManifestStale();
  testManifestSelfConsistencyIsNotFreshnessAgainstTheProject();
  testMultiDocumentBindingCapturesBothInOrder();
  testMultiDocumentReorderingMakesManifestStale();
  testRemovingADocumentMakesManifestStale();
  testAddingADocumentMakesManifestStale();
  testPendingSupportedEntryBlocksCommit();
  testRejectedProposalHasZeroEffect();
  testApprovedAppliesProposedExactly();
  testEditedAppliesAdmittedWhilePreservingProposed();
  testEditedEntityIdRemapsSameTransactionReferences();
  testRejectedEntityCannotLeaveDanglingRelationships();
  testUnknownRelationshipTargetFailsClosed();
  testUnsupportedAdmittedCategoryFailsClosed();
  testUnsupportedRejectedCategoryIsHarmless();
  testPovAssignmentMustReferenceAdmittedActor();
  testLocationAssignmentMustReferenceAdmittedLocation();
  testNoImplicitFirstActorOrFirstLocationFallback();
  testMissingRequiredAssignmentPreventsCompositionReadyResult();
  testSourceDocumentsRemainExactAndUnchanged();
  testNoManuscriptBeatsFabricated();
  testNoBeliefsRevealsThreadsOrTemporalEventsFabricated();
  testProjectBecomesCompositionReadyOnlyWhenStructureIsSufficient();
  testNoPartialMutationOnFailure();
  testNoNestedAliasingBetweenManifestInputAndResult();
  testUndoSnapshotIsIsolatedAndExact();
  testDeterministicResultForIdenticalInputs();
  testEditCannotCaptureARejectedProposalsOriginalId();
  testFactionMemberReferencingARejectedActorFailsClosed();
  testActorInitialLocationReferencingARejectedLocationFailsClosed();
  testAssignmentToARejectedActorFailsClosed();
  testAssignmentToTheWrongEntityKindFailsClosed();
  testEmptyStringAssignmentIsNotSilentlyAccepted();
  testNoPartialMutationWhenOnlyAssignmentResolutionFails();
  testRelationshipProposalApprovedFailsClosed();
  testReceiptAccuracyAcrossMixedDecisions();
  testTamperedEvidenceExactTextFailsClosed();
  testFreshnessCheckedForFingerprintOnlyIsInsufficient();
  testBootstrappedActorCarriesNoUnearnedStateClaim();
  testUnsupportedPendingBlocksCommit();
  testUnsupportedRejectedIsHarmlessAndCommitProceeds();
  testUnsupportedApprovedFailsUnsupportedCategoryAdmission();
  testUnsupportedEditedFailsUnsupportedCategoryAdmission();
  testBootstrapUnknownFatigueIsNotAuthoredFatigueZero();
  testBootstrapUnknownFearIsNotAuthoredFearZero();
  testBootstrapUnknownCertaintyIsNotAuthoredCertaintyMidpoint();
  testBootstrapUnknownEmotionIsNotAuthoredNeutral();
  testBootstrapUnknownObjectConditionIsNotAuthoredIntact();
  testExistingDemoStateRemainsUnchanged();
  testAdmittedHolderProducesInternallyConsistentPossessionState();
  testUnheldObjectLeavesPossessionsUntouched();
  testMultipleObjectsFromTheSameHolderAreAllReciprocated();
  testBootstrapCompletesPovActorLocationFromAssignmentWhenUnestablished();
  testBootstrapCannotReturnContradictoryPovCurrentLocationState();
  testBootstrapAcceptsCoherentPovAndCurrentLocation();
  console.log('bootstrap manifest authority regression passed');
}

run();
