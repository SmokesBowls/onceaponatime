import assert from 'node:assert/strict';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import {
  createCandidateGeneration,
  createInferenceArtifact,
  editCandidateStage2Prose,
  type BeatPlanStage1,
  type CandidateGeneration,
  type InferenceReceipt,
  type StoryProject,
} from '../src/types';
import {
  buildPromotionManifest,
  decidePromotionManifestEntry,
  type AdmissionDecision,
  type PromotionManifest,
  type PromotionManifestEntry,
} from '../src/lib/promotionManifest';
import { preparePromotion } from '../src/lib/preparePromotion';
import type {
  PromotionExtractionPayload,
  PromotionProposedEntity,
  PromotionStateChanges,
} from '../src/lib/promotionIntegrity';

function cloneProject(): StoryProject {
  return structuredClone(DEFAULT_PROJECTS[0]);
}

function receipt(operation: string, requestId: string): InferenceReceipt {
  return {
    broker: 'Hermes',
    requestId,
    operation,
    actualProvider: 'test-provider',
    actualModel: 'test-model',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
  };
}

function candidateFor(project: StoryProject, prose = 'Locke crossed into the adjoining chamber.'): CandidateGeneration {
  const plan: BeatPlanStage1 = {
    beat_type: 'action',
    primary_actor_id: project.activePovActorId,
    intended_action: 'Cross into the adjoining chamber.',
    permitted_entities_involved: [project.activePovActorId],
    permitted_state_transitions: [],
    knowledge_verified: true,
    reveals_protected: true,
    threads_advanced: [],
    threads_resolved: [],
    distance_budget: 'BEAT',
  };

  return createCandidateGeneration({
    id: 'candidate-promotion-manifest-001',
    timestamp: 1_725_000_200_000,
    operation: 'CONTINUATION',
    narrativeDistance: 'BEAT',
    prompt: 'Continue one beat.',
    stage1Artifact: createInferenceArtifact(plan, receipt('onceaponatime.stage1.plan', 'stage1-manifest-test')),
    stage2Artifact: createInferenceArtifact(prose, receipt('onceaponatime.stage2.render', 'stage2-manifest-test')),
    validation: {
      passed: true,
      score: 100,
      diagnostics: [],
      verified: true,
      status: 'VERIFIED',
    },
    contextPackage: {},
    status: 'pending',
  });
}

function emptyStateChanges(): PromotionStateChanges {
  return {
    location_changes: [],
    possession_changes: [],
    actor_state_changes: [],
    belief_changes: [],
    thread_advancements: [],
    reveals_triggered: [],
  };
}

function extraction(overrides: Partial<PromotionExtractionPayload> = {}): PromotionExtractionPayload {
  return {
    success: true,
    mentions: [],
    proposedNewEntities: [],
    stateChanges: emptyStateChanges(),
    ...overrides,
  };
}

function newObject(id = 'object_manifest_new'): PromotionProposedEntity {
  return {
    id,
    type: 'object',
    working_label: 'the glass compass',
    name: null,
    aliases: ['compass'],
  };
}

function mention(entityId: string, id = `mention_${entityId}`) {
  return {
    id,
    entity_id: entityId,
    passage_text: 'the glass compass',
    scene_id: 'scene-manifest-test',
    beat_index: 4,
    timestamp_label: 'T4: Beat 4',
    confidence: 0.9,
    evidence_notes: ['Exact mention extracted from review prose.'],
    extracted_relationships: [],
  };
}

function entriesOfKind(manifest: PromotionManifest, kind: PromotionManifestEntry['kind']) {
  return manifest.entries.filter((entry) => entry.kind === kind);
}

function decideAllSupported(
  manifest: PromotionManifest,
  decision: Exclude<AdmissionDecision, 'edited'> = 'approved',
): PromotionManifest {
  return manifest.entries
    .filter((entry) => entry.supportedForApplication)
    .reduce(
      (current, entry) => decidePromotionManifestEntry(current, entry.id, decision),
      manifest,
    );
}

function decideFirstKind(
  manifest: PromotionManifest,
  kind: PromotionManifestEntry['kind'],
  decision: AdmissionDecision,
  admitted?: PromotionManifestEntry['proposed'],
): PromotionManifest {
  const entry = manifest.entries.find((candidate) => candidate.kind === kind);
  assert.ok(entry, `expected ${kind} manifest entry`);
  return decidePromotionManifestEntry(manifest, entry.id, decision, admitted);
}

function testBuilderIsPureStableAndBindsExactEditableProse() {
  const project = cloneProject();
  const candidate = candidateFor(project);
  const payload = extraction({
    mentions: [mention('object_manifest_new')],
    proposedNewEntities: [newObject()],
  });
  const projectBefore = structuredClone(project);
  const candidateBefore = structuredClone(candidate);

  const first = buildPromotionManifest(project, candidate, payload);
  const second = buildPromotionManifest(project, candidate, payload);

  assert.deepEqual(project, projectBefore, 'manifest builder must not mutate project');
  assert.deepEqual(candidate, candidateBefore, 'manifest builder must not mutate candidate');
  assert.deepEqual(first, second, 'manifest and entry identities must be stable for the same inputs');
  assert.equal(first.boundReviewProse, candidate.stage2Prose);
  assert.equal(first.candidateId, candidate.id);
  assert.equal(first.projectId, project.id);
  assert.equal(first.entries.every((entry) => entry.decision === 'pending'), true);
  assert.equal(entriesOfKind(first, 'entity_proposal').length, 1);
  assert.deepEqual(entriesOfKind(first, 'entity_proposal')[0].evidence, [mention('object_manifest_new')]);
}

function testReceiptIdentityCannotSubstituteForEditableProseFreshness() {
  const project = cloneProject();
  const original = candidateFor(project);
  const manifest = buildPromotionManifest(project, original, extraction());
  const edited = editCandidateStage2Prose(original, `${original.stage2Prose} One character changed.`);

  assert.equal(edited.stage2Artifact, original.stage2Artifact, 'editing review prose retains the immutable Stage 2 artifact');
  assert.equal(edited.stage2Artifact.receipt, original.stage2Artifact.receipt);
  assert.throws(
    () => preparePromotion(project, edited, manifest),
    /stale|freshness|review prose/i,
    'the old manifest must be stale despite unchanged inference receipt identity',
  );
}

function testPendingSupportedEntriesCannotPromote() {
  const project = cloneProject();
  const candidate = candidateFor(project);
  const manifest = buildPromotionManifest(project, candidate, extraction({
    proposedNewEntities: [newObject()],
  }));

  assert.throws(() => preparePromotion(project, candidate, manifest), /pending/i);
}

function testApprovedRejectedAndEditedSupportedEntriesApplyExactly() {
  const project = cloneProject();
  const candidate = candidateFor(project);
  const actor = project.actors[0];
  const rejectedActor = project.actors[1];
  const destination = project.locations.find((location) => location.id !== actor.current_location_id);
  assert.ok(destination, 'fixture requires a second location');

  const payload = extraction({
    stateChanges: {
      ...emptyStateChanges(),
      location_changes: [{
        entity_id: actor.id,
        from_location_id: actor.current_location_id,
        to_location_id: destination.id,
      }],
      actor_state_changes: [{ actor_id: rejectedActor.id, emotion: 'machine-proposed alarm' }],
      belief_changes: [{ actor_id: actor.id, new_belief: 'machine-proposed belief' }],
    },
  });

  let manifest = buildPromotionManifest(project, candidate, payload);
  manifest = decideFirstKind(manifest, 'location_change', 'approved');
  manifest = decideFirstKind(manifest, 'actor_state_change', 'rejected');
  manifest = decideFirstKind(manifest, 'belief_change', 'edited', {
    actor_id: actor.id,
    new_belief: 'author-admitted belief',
  });

  const manifestBefore = structuredClone(manifest);
  const projectBefore = structuredClone(project);
  const candidateBefore = structuredClone(candidate);
  const result = preparePromotion(project, candidate, manifest);

  assert.equal(result.nextProject.actors.find((item) => item.id === actor.id)?.current_location_id, destination.id);
  assert.equal(
    result.nextProject.actors.find((item) => item.id === rejectedActor.id)?.current_state.emotion,
    rejectedActor.current_state.emotion,
    'rejected actor-state proposal has zero effect',
  );
  assert.equal(
    result.nextProject.knowledge.actor_knowledge[actor.id].beliefs.includes('author-admitted belief'),
    true,
  );
  assert.equal(
    result.nextProject.knowledge.actor_knowledge[actor.id].beliefs.includes('machine-proposed belief'),
    false,
  );
  assert.deepEqual(project, projectBefore, 'preparePromotion must not mutate project input');
  assert.deepEqual(candidate, candidateBefore, 'preparePromotion must not mutate candidate input');
  assert.deepEqual(manifest, manifestBefore, 'preparePromotion must not mutate manifest input');

  const editedDecision = result.promotionReceipt.entries.find((entry) => entry.kind === 'belief_change');
  assert.ok(editedDecision);
  assert.equal(editedDecision.decision, 'edited');
  assert.deepEqual(editedDecision.proposed, { actor_id: actor.id, new_belief: 'machine-proposed belief' });
  assert.deepEqual(editedDecision.admitted, { actor_id: actor.id, new_belief: 'author-admitted belief' });
  assert.equal(editedDecision.applied, true);
  assert.equal(result.promotionReceipt.entries.find((entry) => entry.kind === 'actor_state_change')?.applied, false);
}

function testEditedDecisionRequiresSeparateAdmittedValue() {
  const project = cloneProject();
  const candidate = candidateFor(project);
  const manifest = buildPromotionManifest(project, candidate, extraction({
    stateChanges: {
      ...emptyStateChanges(),
      belief_changes: [{ actor_id: project.activePovActorId, new_belief: 'machine proposal' }],
    },
  }));

  assert.throws(
    () => decideFirstKind(manifest, 'belief_change', 'edited'),
    /edited|admitted/i,
  );
}

function testEntityAdmissionMentionIntegrityAndNeutralPossession() {
  const project = cloneProject();
  const candidate = candidateFor(project, 'Locke noticed the glass compass.');
  const entity = newObject();
  const payload = extraction({
    mentions: [mention(entity.id), mention(project.activePovActorId, 'mention_existing_actor')],
    proposedNewEntities: [entity],
  });

  const pending = buildPromotionManifest(project, candidate, payload);
  const approved = decideFirstKind(pending, 'entity_proposal', 'approved');
  const approvedResult = preparePromotion(project, candidate, approved);
  const admittedObject = approvedResult.nextProject.objects.find((object) => object.id === entity.id);

  assert.ok(admittedObject);
  assert.equal(admittedObject.current_holder_id, null, 'newly admitted object begins unheld');
  assert.equal(approvedResult.nextProject.mentions.some((item) => item.entity_id === entity.id), true);
  assert.equal(approvedResult.nextProject.mentions.some((item) => item.entity_id === project.activePovActorId), true);

  const rejected = decideFirstKind(pending, 'entity_proposal', 'rejected');
  const rejectedResult = preparePromotion(project, candidate, rejected);
  assert.equal(rejectedResult.nextProject.objects.some((object) => object.id === entity.id), false);
  assert.equal(
    rejectedResult.nextProject.mentions.some((item) => item.entity_id === entity.id),
    false,
    'rejected entity cannot leave a dangling canonical mention',
  );
  assert.equal(
    rejectedResult.promotionReceipt.sourceMentions.some((item) => item.entity_id === entity.id),
    true,
    'rejected machine evidence remains available in audit data',
  );
}

function testUnknownMentionCannotEnterCanon() {
  const project = cloneProject();
  const candidate = candidateFor(project);
  const manifest = buildPromotionManifest(project, candidate, extraction({
    mentions: [mention('object_never_proposed')],
  }));

  assert.throws(() => preparePromotion(project, candidate, manifest), /mention|entity|referential/i);
}

function testMentionAloneDoesNotProducePossessionAndExplicitPossessionChecksPriorHolder() {
  const project = cloneProject();
  const candidate = candidateFor(project);
  const entity = newObject();
  const payload = extraction({
    mentions: [mention(entity.id)],
    proposedNewEntities: [entity],
    stateChanges: {
      ...emptyStateChanges(),
      possession_changes: [{ object_id: entity.id, from_actor_id: null, to_actor_id: project.activePovActorId }],
    },
  });

  let manifest = buildPromotionManifest(project, candidate, payload);
  manifest = decideFirstKind(manifest, 'entity_proposal', 'approved');
  manifest = decideFirstKind(manifest, 'possession_change', 'rejected');
  assert.equal(
    preparePromotion(project, candidate, manifest).nextProject.objects.find((object) => object.id === entity.id)?.current_holder_id,
    null,
  );

  manifest = decideFirstKind(manifest, 'possession_change', 'approved');
  assert.equal(
    preparePromotion(project, candidate, manifest).nextProject.objects.find((object) => object.id === entity.id)?.current_holder_id,
    project.activePovActorId,
  );

  const stalePayload = extraction({
    stateChanges: {
      ...emptyStateChanges(),
      possession_changes: [{
        object_id: project.objects[0].id,
        from_actor_id: 'actor_incorrect_holder',
        to_actor_id: project.activePovActorId,
      }],
    },
  });
  const staleManifest = decideAllSupported(buildPromotionManifest(project, candidate, stalePayload));
  const before = structuredClone(project);
  assert.throws(() => preparePromotion(project, candidate, staleManifest), /precondition/i);
  assert.deepEqual(project, before, 'stale possession aborts the transaction without input mutation');
}

function testUnsupportedCategoriesAreHonestAndCannotApply() {
  const project = cloneProject();
  const candidate = candidateFor(project);
  const payload = extraction({
    proposedNewEntities: [{
      id: 'location_manifest_new',
      type: 'location',
      working_label: 'the uncharted annex',
      name: null,
      aliases: [],
    }],
    stateChanges: {
      ...emptyStateChanges(),
      thread_advancements: [{ thread_id: project.threads[0].id, notes: 'Machine says advanced.' }],
      reveals_triggered: [{ reveal_id: project.reveals[0].id, new_status: 'unlocked' }],
    },
  });
  const manifest = buildPromotionManifest(project, candidate, payload);

  for (const kind of ['entity_proposal', 'thread_advancement', 'reveal_change'] as const) {
    const entry = entriesOfKind(manifest, kind)[0];
    assert.ok(entry);
    assert.equal(entry.supportedForApplication, false, `${kind} must be represented as unsupported`);
  }

  const result = preparePromotion(project, candidate, manifest);
  assert.equal(result.nextProject.locations.some((location) => location.id === 'location_manifest_new'), false);
  assert.deepEqual(result.nextProject.threads, project.threads);
  assert.deepEqual(result.nextProject.reveals, project.reveals);
  assert.equal(result.promotionReceipt.unsupportedEntryIds.length, 3);

  for (const kind of ['entity_proposal', 'thread_advancement', 'reveal_change'] as const) {
    const approved = decideFirstKind(manifest, kind, 'approved');
    assert.throws(() => preparePromotion(project, candidate, approved), /unsupported/i);
  }
}

function testAtomicFailureHistoryReceiptAndDeterminism() {
  const project = cloneProject();
  const candidate = candidateFor(project);
  const actor = project.actors[0];
  const destination = project.locations.find((location) => location.id !== actor.current_location_id);
  assert.ok(destination);
  const payload = extraction({
    stateChanges: {
      ...emptyStateChanges(),
      location_changes: [{
        entity_id: actor.id,
        from_location_id: actor.current_location_id,
        to_location_id: destination.id,
      }],
      possession_changes: [{
        object_id: project.objects[0].id,
        from_actor_id: 'actor_stale_holder',
        to_actor_id: actor.id,
      }],
    },
  });
  const manifest = decideAllSupported(buildPromotionManifest(project, candidate, payload));
  const originalBytes = JSON.stringify(project);

  assert.throws(() => preparePromotion(project, candidate, manifest), /precondition/i);
  assert.equal(JSON.stringify(project), originalBytes, 'failure leaves the original project byte-equivalent');

  const validPayload = extraction({ mentions: [mention(project.activePovActorId, 'mention_deterministic')] });
  const validManifest = buildPromotionManifest(project, candidate, validPayload);
  const first = preparePromotion(project, candidate, validManifest);
  const second = preparePromotion(project, candidate, validManifest);

  assert.deepEqual(first, second, 'same inputs produce the same complete project and receipts');
  assert.deepEqual(first.historyReceipt.snapshot, project, 'history snapshot is exact pre-promotion state');
  assert.notEqual(first.historyReceipt.snapshot, project, 'history snapshot is isolated from the input object');
  assert.equal(first.nextProject.manuscript.at(-1)?.text, candidate.stage2Prose);
  assert.equal(first.nextProject.currentPosition.beat, project.currentPosition.beat + 1);
  assert.equal(first.promotionReceipt.boundReviewProse, candidate.stage2Prose);
  assert.equal(first.promotionReceipt.manifestId, validManifest.id);
}

function run() {
  testBuilderIsPureStableAndBindsExactEditableProse();
  testReceiptIdentityCannotSubstituteForEditableProseFreshness();
  testPendingSupportedEntriesCannotPromote();
  testApprovedRejectedAndEditedSupportedEntriesApplyExactly();
  testEditedDecisionRequiresSeparateAdmittedValue();
  testEntityAdmissionMentionIntegrityAndNeutralPossession();
  testUnknownMentionCannotEnterCanon();
  testMentionAloneDoesNotProducePossessionAndExplicitPossessionChecksPriorHolder();
  testUnsupportedCategoriesAreHonestAndCannotApply();
  testAtomicFailureHistoryReceiptAndDeterminism();
  console.log('promotion manifest authority regression passed');
}

run();
