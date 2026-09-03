import assert from 'node:assert/strict';
import {
  compileStage2RenderingEnvelope,
} from '../server/contextCompiler';
import { renderNarrativeProse } from '../server/narrativePipeline';
import type {
  BeatPlanStage1,
  GenerationContext,
  InferenceReceipt,
  Stage2RenderingEnvelope,
  StoryProject,
} from '../src/types';
import type {
  HermesGenerateTextResult,
  ReceiptBearingGenerateTextParams,
  ReceiptBearingModelProvider,
} from '../server/modelProvider';

const sentinels = {
  plannerGoal: 'PLANNER_ONLY_ACTIVE_GOAL_SENTINEL',
  openThread: 'OPEN_THREAD_SENTINEL',
  unrelatedEntity: 'UNRELATED_PRESENT_ENTITY_SENTINEL',
  unrelatedCodex: 'UNRELATED_CODEX_SENTINEL',
  unrelatedPossession: 'UNRELATED_POSSESSION_SENTINEL',
  unrelatedContinuity: 'UNRELATED_CONTINUITY_SENTINEL',
  collidingContinuity: 'COLLIDING_SCOPE_CONSTRAINT_SENTINEL',
  unrelatedHolderId: 'actor-unrelated-holder',
  unrelatedHolderName: 'UNRELATED_HOLDER_NAME_SENTINEL',
  unrelatedCodexLocation: 'UNRELATED_CODEX_LOCATION_SENTINEL',
  unrelatedCodexClaim: 'UNRELATED_CODEX_CLAIM_SENTINEL',
  storyPosition: 'PLANNING_STORY_POSITION_SENTINEL',
  approvedEntity: 'APPROVED_ENTITY_SENTINEL',
  approvedCodex: 'APPROVED_CODEX_SENTINEL',
  approvedPossession: 'APPROVED_POSSESSION_SENTINEL',
  approvedContinuity: 'APPROVED_CONTINUITY_SENTINEL',
  knownFact: 'AUTHORIZED_KNOWN_FACT_SENTINEL',
  belief: 'SINCERE_BELIEF_SENTINEL',
  location: 'CURRENT_LOCATION_DESCRIPTION_SENTINEL',
  recentProse: 'RECENT_PROSE_SENTINEL',
  foreshadowing: 'PERMITTED_FORESHADOWING_SENTINEL',
  rewrite: 'REWRITE_CONTRACT_SENTINEL',
};

const generationContext: GenerationContext = {
  operatingMode: 'TRANSFORMATION',
  narrativeDistance: 'BEAT',
  storyPosition: {
    act: sentinels.storyPosition,
    chapter: 'Chapter 1',
    scene: 'Scene 1',
    beat: 1,
    location_id: 'location-approved',
    location_label: 'Threshold chamber',
  },
  activePovActor: {
    id: 'actor-pov',
    identity: {
      name: 'Mara',
      working_label: 'the watchful traveler',
      aliases: ['the traveler'],
    },
    roles: { story: ['protagonist'], scene: ['observer'] },
    traits: { observant: 0.9 },
    current_state: {
      fatigue: 0.2,
      fear: 0.3,
      certainty: 0.4,
      emotion: 'wary',
    },
    active_goals: [sentinels.plannerGoal],
    current_location_id: 'location-approved',
    possessions: ['object-approved', 'object-unrelated'],
  },
  knownFacts: [{
    id: 'fact-authorized',
    statement: sentinels.knownFact,
    status: 'established',
    provenance: { planningOnlyDetail: 'FACT_PROVENANCE_SENTINEL' },
  }],
  sincereBeliefs: [sentinels.belief],
  presentEntities: [
    {
      id: 'actor-pov',
      type: 'actor',
      label: 'Mara',
      name: 'Mara',
      aliases: [],
      currentState: { emotion: 'wary' },
    },
    {
      id: 'actor-approved',
      type: 'actor',
      label: sentinels.approvedEntity,
      name: null,
      aliases: [],
      roleOrStatus: 'witness',
      locationId: 'location-approved',
      currentState: { emotion: 'startled' },
    },
    {
      id: 'object-approved',
      type: 'object',
      label: sentinels.approvedPossession,
      name: null,
      aliases: [],
      locationId: 'location-approved',
      currentHolderId: null,
      currentState: { status: 'intact' },
    },
    {
      id: 'actor-unrelated',
      type: 'actor',
      label: sentinels.unrelatedEntity,
      name: null,
      aliases: [],
      locationId: 'location-approved',
    },
  ],
  currentLocation: {
    id: 'location-approved',
    name: null,
    working_label: 'the threshold chamber',
    description_summary: sentinels.location,
    connected_locations: ['UNRELATED_CONNECTED_LOCATION_SENTINEL'],
  },
  relevantPossessions: [
    {
      id: 'object-approved',
      label: sentinels.approvedPossession,
      holderId: sentinels.unrelatedHolderId,
      holderName: sentinels.unrelatedHolderName,
    },
    {
      id: 'object-unrelated',
      label: sentinels.unrelatedPossession,
      holderId: 'actor-pov',
      holderName: 'Mara',
    },
  ],
  relevantOpenThreads: [{
    id: 'thread-planner-only',
    label: sentinels.openThread,
    importance: 'major',
    resolution_allowed: false,
  }],
  permittedForeshadowingCues: [sentinels.foreshadowing],
  recentProse: sentinels.recentProse,
  accumulatedCodexEntities: [
    {
      id: 'actor-approved',
      label: sentinels.approvedCodex,
      type: 'actor',
      classification_confidence: 'resolved',
      reliability: 0.8,
      salience: 0.8,
      distinct_evidence_count: 2,
      current_holder_id: null,
      current_location_id: 'location-approved',
      supported_claims: ['APPROVED_CODEX_CLAIM_SENTINEL'],
      contradicted_claims: [],
      relationships: ['notices -> actor-pov', 'notices -> actor-unrelated'],
    },
    {
      id: 'actor-unrelated',
      label: sentinels.unrelatedCodex,
      type: 'actor',
      classification_confidence: 'resolved',
      reliability: 0.9,
      salience: 0.4,
      distinct_evidence_count: 3,
      current_holder_id: null,
      current_location_id: 'location-approved',
      supported_claims: ['UNRELATED_CODEX_CLAIM_SENTINEL'],
      contradicted_claims: [],
      relationships: [],
    },
    {
      id: 'object-approved',
      label: sentinels.approvedPossession,
      type: 'object',
      classification_confidence: 'resolved',
      reliability: 0.7,
      salience: 0.8,
      distinct_evidence_count: 2,
      current_holder_id: sentinels.unrelatedHolderId,
      current_location_id: sentinels.unrelatedCodexLocation,
      supported_claims: [sentinels.unrelatedCodexClaim],
      contradicted_claims: [sentinels.unrelatedCodexClaim],
      relationships: ['carried_by -> actor-unrelated-holder'],
    },
  ],
  continuityConstraints: [
    `[INVENTORY CONTINUITY] object-approved ${sentinels.approvedContinuity}`,
    `[INVENTORY CONTINUITY] object-unrelated ${sentinels.unrelatedContinuity}`,
    `[INVENTORY CONTINUITY] object-approved-shadow ${sentinels.collidingContinuity}`,
  ],
  rewriteContract: {
    presetName: sentinels.rewrite,
    modify: ['cadence'],
    preserve: ['events'],
    forbid: ['new revelations'],
  },
};

const approvedPlan: BeatPlanStage1 = {
  beat_type: 'action',
  primary_actor_id: 'actor-pov',
  intended_action: 'Mara crosses the threshold while actor-approved reacts.',
  permitted_entities_involved: ['actor-approved', 'object-approved'],
  permitted_state_transitions: [],
  knowledge_verified: false,
  reveals_protected: false,
  threads_advanced: [],
  threads_resolved: [],
  distance_budget: 'BEAT',
  plan_notes: 'Approved bounded beat.',
};

function admittedReceipt(): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId: 'stage2-envelope-request-001',
    operation: 'onceaponatime.stage2.render',
    actualProvider: 'openrouter',
    actualModel: 'actual/model-build-2026-09-02',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
  });
}

function providerCapturing(
  capture: (params: ReceiptBearingGenerateTextParams) => void,
): ReceiptBearingModelProvider {
  return {
    name: 'stage2-envelope-test-provider',
    isAvailable: () => true,
    async generateText(params): Promise<HermesGenerateTextResult> {
      capture(params);
      return Object.freeze({
        text: 'Mara crossed the threshold.',
        receipt: admittedReceipt(),
      });
    },
  };
}

function assertCompileTimeBoundaries() {
  const envelope = {} as Stage2RenderingEnvelope;
  void envelope;

  // @ts-expect-error Stage 2 must not accept the broad planning GenerationContext.
  void renderNarrativeProse(generationContext, approvedPlan, providerCapturing(() => undefined));

  const project = {} as StoryProject;
  // @ts-expect-error The Stage 2 compiler cannot regain canonical StoryProject authority.
  void compileStage2RenderingEnvelope(project, approvedPlan);
}

async function testCompilerConstructsNarrowEnvelopeWithoutMutatingAuthorizedContext() {
  const contextBefore = JSON.stringify(generationContext);
  const envelope = compileStage2RenderingEnvelope(generationContext, approvedPlan);
  const serializedEnvelope = JSON.stringify(envelope);

  assert.notEqual(envelope, generationContext);
  assert.equal(JSON.stringify(generationContext), contextBefore);
  assert.equal('storyPosition' in envelope, false);
  assert.equal('relevantOpenThreads' in envelope, false);
  assert.equal('active_goals' in envelope, false);
  const approvedPossession = envelope.relevantPossessions.find(({ id }) => id === 'object-approved');
  assert.equal(approvedPossession?.holderStatus, 'outside_approved_scope');
  assert.equal(approvedPossession?.holderId, null);
  assert.equal(approvedPossession?.holderDisplayName, null);
  const approvedObjectCodex = envelope.codexEntities.find(({ id }) => id === 'object-approved');
  assert.equal(approvedObjectCodex?.currentHolderStatus, 'outside_approved_scope');
  assert.equal(approvedObjectCodex?.currentHolderId, null);
  assert.equal(approvedObjectCodex?.currentLocationStatus, 'outside_approved_scope');
  assert.equal(approvedObjectCodex?.currentLocationId, null);
  assert.deepEqual(approvedObjectCodex?.relationships, []);
  assert.deepEqual(envelope.continuityConstraints, [{
    kind: 'inventory',
    entityId: 'object-approved',
    entityDisplayName: sentinels.approvedPossession,
    holderId: null,
    holderDisplayName: null,
    holderStatus: 'outside_approved_scope',
  }]);

  for (const excluded of [
    sentinels.plannerGoal,
    sentinels.openThread,
    sentinels.unrelatedEntity,
    sentinels.unrelatedCodex,
    sentinels.unrelatedPossession,
    sentinels.approvedContinuity,
    sentinels.unrelatedContinuity,
    sentinels.collidingContinuity,
    sentinels.unrelatedHolderId,
    sentinels.unrelatedHolderName,
    sentinels.unrelatedCodexLocation,
    sentinels.unrelatedCodexClaim,
    sentinels.storyPosition,
    'UNRELATED_CONNECTED_LOCATION_SENTINEL',
    'FACT_PROVENANCE_SENTINEL',
    'UNRELATED_CODEX_CLAIM_SENTINEL',
    'notices -> actor-unrelated',
  ]) {
    assert.equal(serializedEnvelope.includes(excluded), false, `envelope excluded ${excluded}`);
  }

  for (const retained of [
    sentinels.approvedEntity,
    sentinels.approvedCodex,
    sentinels.approvedPossession,
    sentinels.knownFact,
    sentinels.belief,
    sentinels.location,
    sentinels.recentProse,
    sentinels.foreshadowing,
    sentinels.rewrite,
    'notices -> actor-pov',
  ]) {
    assert.equal(serializedEnvelope.includes(retained), true, `envelope retained ${retained}`);
  }
}

async function testStage2RequestContainsOnlyEnvelopeEvidenceAndMutatesNoInput() {
  const generationContextBefore = JSON.stringify(generationContext);
  const envelope = compileStage2RenderingEnvelope(generationContext, approvedPlan);
  const envelopeBefore = JSON.stringify(envelope);
  let modelRequest = '';

  const artifact = await renderNarrativeProse(
    envelope,
    approvedPlan,
    providerCapturing((params) => {
      modelRequest = `${params.systemPrompt || ''}\n${params.userPrompt || ''}`;
    }),
  );

  assert.equal(artifact.value, 'Mara crossed the threshold.');
  assert.equal(artifact.receipt.operation, 'onceaponatime.stage2.render');
  assert.equal(JSON.stringify(envelope), envelopeBefore);
  assert.equal(JSON.stringify(generationContext), generationContextBefore);
  assert.equal(modelRequest.includes('FULL AUTHORIZED GENERATION CONTEXT'), false);
  assert.equal(modelRequest.includes(JSON.stringify(generationContext)), false);

  for (const excluded of [
    sentinels.plannerGoal,
    sentinels.openThread,
    sentinels.unrelatedEntity,
    sentinels.unrelatedCodex,
    sentinels.unrelatedPossession,
    sentinels.approvedContinuity,
    sentinels.unrelatedContinuity,
    sentinels.collidingContinuity,
    sentinels.unrelatedHolderId,
    sentinels.unrelatedHolderName,
    sentinels.unrelatedCodexLocation,
    sentinels.unrelatedCodexClaim,
    sentinels.storyPosition,
  ]) {
    assert.equal(modelRequest.includes(excluded), false, `request excluded ${excluded}`);
  }

  for (const retained of [
    sentinels.approvedEntity,
    sentinels.approvedCodex,
    sentinels.approvedPossession,
    sentinels.knownFact,
    sentinels.belief,
    sentinels.location,
    sentinels.recentProse,
    sentinels.foreshadowing,
    sentinels.rewrite,
    'notices -> actor-pov',
    'someone outside approved scope',
  ]) {
    assert.equal(modelRequest.includes(retained), true, `request retained ${retained}`);
  }
}

async function runStage2RenderingEnvelopeTests() {
  await testCompilerConstructsNarrowEnvelopeWithoutMutatingAuthorizedContext();
  await testStage2RequestContainsOnlyEnvelopeEvidenceAndMutatesNoInput();
}

void assertCompileTimeBoundaries;
runStage2RenderingEnvelopeTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
