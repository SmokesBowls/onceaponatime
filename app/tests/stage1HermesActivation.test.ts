import assert from 'node:assert/strict';
import { compileGenerationContext } from '../server/contextCompiler';
import { planNarrativeBeat } from '../server/narrativePipeline';
import {
  getStage1ModelProvider,
  HermesProvider,
  type HermesGenerateTextResult,
  type ModelProvider,
  type ReceiptBearingGenerateTextParams,
  type ReceiptBearingModelProvider,
} from '../server/modelProvider';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import type { InferenceReceipt } from '../src/types';

const project = DEFAULT_PROJECTS[0];
const generationContext = compileGenerationContext({
  project,
  activePovActorId: project.activePovActorId,
  currentPosition: project.currentPosition,
  operation: 'CONTINUATION',
  narrativeDistance: 'BEAT',
});

function admittedReceipt(): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId: 'stage1-request-001',
    operation: 'onceaponatime.stage1.plan',
    actualProvider: 'openrouter',
    actualModel: 'actual/model-build-2026-09-01',
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
    name: 'receipt-bearing-stage1-test-provider',
    isAvailable: () => available,
    generateText: generate,
  };
}

function validPlanJson(): string {
  return JSON.stringify({
    beat_type: 'action',
    primary_actor_id: generationContext.activePovActor.id,
    intended_action: 'Cross the threshold.',
    permitted_entities_involved: [generationContext.activePovActor.id],
    permitted_state_transitions: [],
    knowledge_verified: true,
    reveals_protected: true,
    threads_advanced: [],
    threads_resolved: [],
    distance_budget: 'SCENE',
    plan_notes: 'Model claims verification it does not own.',
  });
}

function assertCompileTimeStage1Boundary() {
  const legacyProvider: ModelProvider = {
    name: 'legacy-receipt-optional-provider',
    isAvailable: () => true,
    generateText: async () => ({ text: validPlanJson() }),
  };

  // @ts-expect-error Stage 1 requires a receipt-bearing provider, not transitional ModelProvider.
  void planNarrativeBeat(generationContext, 'Advance one beat.', legacyProvider);
}

async function testStage1UsesHermesOperationAndReturnsImmutableArtifact() {
  const receipt = admittedReceipt();
  const operations: string[] = [];
  const provider = providerReturning(async (params) => {
    operations.push(params.operation);
    return Object.freeze({ text: validPlanJson(), receipt });
  });
  const contextBefore = JSON.stringify(generationContext);

  const artifact = await planNarrativeBeat(generationContext, 'Advance one beat.', provider);

  assert.deepEqual(operations, ['onceaponatime.stage1.plan']);
  assert.equal(artifact.receipt, receipt);
  assert.equal(Object.isFrozen(artifact), true);
  assert.equal(Object.isFrozen(artifact.receipt), true);
  assert.equal(artifact.value.knowledge_verified, false);
  assert.equal(artifact.value.reveals_protected, false);
  assert.equal(artifact.value.distance_budget, generationContext.narrativeDistance);
  assert.equal(JSON.stringify(generationContext), contextBefore);
}

async function testMalformedJsonFailsClosed() {
  const provider = providerReturning(async () => Object.freeze({
    text: '{not valid JSON',
    receipt: admittedReceipt(),
  }));

  await assert.rejects(
    () => planNarrativeBeat(generationContext, 'Advance one beat.', provider),
    /json|unexpected|property name/i,
  );
}

async function testUnavailableProviderFailsBeforeInference() {
  let generateCalls = 0;
  const provider = providerReturning(async () => {
    generateCalls += 1;
    return Object.freeze({ text: validPlanJson(), receipt: admittedReceipt() });
  }, false);

  await assert.rejects(
    () => planNarrativeBeat(generationContext, 'Advance one beat.', provider),
    /model provider.*unavailable/i,
  );
  assert.equal(generateCalls, 0);
}

async function testProviderRejectionFailsClosedWithoutLocalPlan() {
  const provider = providerReturning(async () => {
    throw new Error('broker rejected Stage 1 inference');
  });

  await assert.rejects(
    () => planNarrativeBeat(generationContext, 'Advance one beat.', provider),
    /broker rejected Stage 1 inference/i,
  );
}

function testDefaultStage1ProviderIsHermes() {
  const provider = getStage1ModelProvider();
  assert.equal(provider instanceof HermesProvider, true);
  assert.equal(provider.name, 'Hermes');
}

async function runStage1HermesActivationTests() {
  await testStage1UsesHermesOperationAndReturnsImmutableArtifact();
  await testMalformedJsonFailsClosed();
  await testUnavailableProviderFailsBeforeInference();
  await testProviderRejectionFailsClosedWithoutLocalPlan();
  testDefaultStage1ProviderIsHermes();
}

void assertCompileTimeStage1Boundary;
runStage1HermesActivationTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
