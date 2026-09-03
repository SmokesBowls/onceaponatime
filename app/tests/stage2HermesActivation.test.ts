import assert from 'node:assert/strict';
import { compileGenerationContext } from '../server/contextCompiler';
import { planNarrativeBeat, renderNarrativeProse } from '../server/narrativePipeline';
import {
  getStage2ModelProvider,
  HermesProvider,
  type HermesGenerateTextResult,
  type ModelProvider,
  type ReceiptBearingGenerateTextParams,
  type ReceiptBearingModelProvider,
} from '../server/modelProvider';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import {
  createCandidateGeneration,
  editCandidateStage2Prose,
  type BeatPlanStage1,
  type CandidateGeneration,
  type InferenceReceipt,
} from '../src/types';

const project = DEFAULT_PROJECTS[0];
const generationContext = compileGenerationContext({
  project,
  activePovActorId: project.activePovActorId,
  currentPosition: project.currentPosition,
  operation: 'CONTINUATION',
  narrativeDistance: 'BEAT',
});

const approvedPlan: BeatPlanStage1 = {
  beat_type: 'action',
  primary_actor_id: generationContext.activePovActor.id,
  intended_action: 'Cross the threshold.',
  permitted_entities_involved: [generationContext.activePovActor.id],
  permitted_state_transitions: [],
  knowledge_verified: false,
  reveals_protected: false,
  threads_advanced: [],
  threads_resolved: [],
  distance_budget: generationContext.narrativeDistance,
  plan_notes: 'Approved Stage 1 plan.',
};

function admittedReceipt(
  operation: 'onceaponatime.stage1.plan' | 'onceaponatime.stage2.render',
  requestId: string,
): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId,
    operation,
    actualProvider: 'openrouter',
    actualModel: 'actual/model-build-2026-09-02',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
  });
}

function providerReturning(
  generate: (params: ReceiptBearingGenerateTextParams) => Promise<HermesGenerateTextResult>,
  available = true,
): ReceiptBearingModelProvider {
  return {
    name: 'receipt-bearing-stage2-test-provider',
    isAvailable: () => available,
    generateText: generate,
  };
}

function validPlanJson(): string {
  return JSON.stringify(approvedPlan);
}

function assertCompileTimeStage2Boundary() {
  const legacyProvider: ModelProvider = {
    name: 'legacy-receipt-optional-provider',
    isAvailable: () => true,
    generateText: async () => ({ text: 'Receiptless prose.' }),
  };

  // @ts-expect-error Stage 2 requires a receipt-bearing provider, not transitional ModelProvider.
  void renderNarrativeProse(generationContext, approvedPlan, legacyProvider);

  const stage1Receipt = admittedReceipt('onceaponatime.stage1.plan', 'stage1-compile-time');
  const stage1Artifact = Object.freeze({ value: approvedPlan, receipt: stage1Receipt });
  // @ts-expect-error Candidate generation must retain the immutable Stage 2 artifact.
  const candidateWithoutStage2Artifact: CandidateGeneration = {
    id: 'candidate-without-stage2-artifact',
    timestamp: 1,
    operation: 'CONTINUATION',
    narrativeDistance: 'BEAT',
    prompt: 'Advance.',
    stage1Artifact,
    stage2Prose: 'Receiptless editable prose.',
    validation: {
      passed: false,
      score: 0,
      verified: false,
      status: 'UNVERIFIED',
      diagnostics: [],
    },
    contextPackage: generationContext,
    status: 'pending',
  };
  void candidateWithoutStage2Artifact;
}

async function testStage2UsesHermesOperationAndReturnsExactImmutableArtifact() {
  const receipt = admittedReceipt('onceaponatime.stage2.render', 'stage2-request-001');
  const admittedProse = '  Exact admitted prose, including boundary whitespace.  ';
  const operations: string[] = [];
  const provider = providerReturning(async (params) => {
    operations.push(params.operation);
    return Object.freeze({ text: admittedProse, receipt });
  });

  const artifact = await renderNarrativeProse(generationContext, approvedPlan, provider);

  assert.deepEqual(operations, ['onceaponatime.stage2.render']);
  assert.equal(artifact.value, admittedProse);
  assert.equal(artifact.receipt, receipt);
  assert.equal(Object.isFrozen(artifact), true);
  assert.equal(Object.isFrozen(artifact.receipt), true);
}

async function testUnavailableProviderFailsBeforeInference() {
  let generateCalls = 0;
  const provider = providerReturning(async () => {
    generateCalls += 1;
    return Object.freeze({
      text: 'This must never be returned.',
      receipt: admittedReceipt('onceaponatime.stage2.render', 'unavailable-stage2'),
    });
  }, false);

  await assert.rejects(
    () => renderNarrativeProse(generationContext, approvedPlan, provider),
    /model provider.*unavailable/i,
  );
  assert.equal(generateCalls, 0);
}

async function testProviderRejectionFailsClosedWithoutLocalProse() {
  const provider = providerReturning(async () => {
    throw new Error('broker rejected Stage 2 inference');
  });

  await assert.rejects(
    () => renderNarrativeProse(generationContext, approvedPlan, provider),
    /broker rejected Stage 2 inference/i,
  );
}

async function testEmptyOrMalformedProviderOutputFailsClosed() {
  const receipt = admittedReceipt('onceaponatime.stage2.render', 'invalid-stage2-output');
  const emptyProvider = providerReturning(async () => Object.freeze({ text: '   ', receipt }));
  const malformedProvider = providerReturning(async () => ({ receipt } as HermesGenerateTextResult));

  await assert.rejects(
    () => renderNarrativeProse(generationContext, approvedPlan, emptyProvider),
    /stage 2.*non-empty|stage 2.*malformed/i,
  );
  await assert.rejects(
    () => renderNarrativeProse(generationContext, approvedPlan, malformedProvider),
    /stage 2.*non-empty|stage 2.*malformed/i,
  );
}

async function testStageReceiptsRemainDistinct() {
  const stage1Receipt = admittedReceipt('onceaponatime.stage1.plan', 'stage1-request-distinct');
  const stage2Receipt = admittedReceipt('onceaponatime.stage2.render', 'stage2-request-distinct');
  const stage1Provider = providerReturning(async () => Object.freeze({
    text: validPlanJson(),
    receipt: stage1Receipt,
  }));
  const stage2Provider = providerReturning(async () => Object.freeze({
    text: 'The threshold yielded beneath a careful hand.',
    receipt: stage2Receipt,
  }));

  const stage1Artifact = await planNarrativeBeat(generationContext, 'Cross the threshold.', stage1Provider);
  const stage2Artifact = await renderNarrativeProse(generationContext, stage1Artifact.value, stage2Provider);

  assert.notEqual(stage1Artifact.receipt, stage2Artifact.receipt);
  assert.equal(stage1Artifact.receipt.operation, 'onceaponatime.stage1.plan');
  assert.equal(stage2Artifact.receipt.operation, 'onceaponatime.stage2.render');
  assert.equal(stage1Artifact.receipt.requestId, 'stage1-request-distinct');
  assert.equal(stage2Artifact.receipt.requestId, 'stage2-request-distinct');
}

async function testEditableReviewCopyCannotRewriteInferenceProvenance() {
  const stage1Receipt = admittedReceipt('onceaponatime.stage1.plan', 'candidate-stage1');
  const stage2Receipt = admittedReceipt('onceaponatime.stage2.render', 'candidate-stage2');
  const stage1Artifact = Object.freeze({ value: approvedPlan, receipt: stage1Receipt });
  const stage2Artifact = await renderNarrativeProse(
    generationContext,
    approvedPlan,
    providerReturning(async () => Object.freeze({
      text: 'Original admitted inference prose.',
      receipt: stage2Receipt,
    })),
  );

  const candidate = createCandidateGeneration({
    id: 'candidate-stage2-provenance',
    timestamp: 1,
    operation: 'CONTINUATION',
    narrativeDistance: 'BEAT',
    prompt: 'Advance.',
    stage1Artifact,
    stage2Artifact,
    validation: {
      passed: false,
      score: 0,
      verified: false,
      status: 'UNVERIFIED',
      diagnostics: [],
    },
    contextPackage: generationContext,
    status: 'pending',
  });

  assert.equal(candidate.stage2Prose, candidate.stage2Artifact.value);
  assert.equal(candidate.stage2Artifact, stage2Artifact);

  const editedCandidate = editCandidateStage2Prose(candidate, 'Human-edited review prose.');

  assert.equal(editedCandidate.stage2Prose, 'Human-edited review prose.');
  assert.equal(editedCandidate.stage2Artifact, stage2Artifact);
  assert.equal(editedCandidate.stage2Artifact.value, 'Original admitted inference prose.');
  assert.equal(editedCandidate.stage2Artifact.receipt, stage2Receipt);
  assert.equal(candidate.stage2Prose, 'Original admitted inference prose.');
}

function testDefaultStage2ProviderIsHermes() {
  const provider: ReceiptBearingModelProvider = getStage2ModelProvider();
  assert.equal(provider instanceof HermesProvider, true);
  assert.equal(provider.name, 'Hermes');
}

async function runStage2HermesActivationTests() {
  await testStage2UsesHermesOperationAndReturnsExactImmutableArtifact();
  await testUnavailableProviderFailsBeforeInference();
  await testProviderRejectionFailsClosedWithoutLocalProse();
  await testEmptyOrMalformedProviderOutputFailsClosed();
  await testStageReceiptsRemainDistinct();
  await testEditableReviewCopyCannotRewriteInferenceProvenance();
  testDefaultStage2ProviderIsHermes();
}

void assertCompileTimeStage2Boundary;
runStage2HermesActivationTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
