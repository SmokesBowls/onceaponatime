import assert from 'node:assert/strict';
import {
  createInferenceArtifact,
  type BeatPlanStage1,
  type InferenceReceipt,
  type Stage1PlanningArtifact,
  type Stage2RenderingArtifact,
} from '../src/types';
import {
  type HermesGenerateTextResult,
  type ReceiptBearingGenerateTextParams,
  type ReceiptBearingModelProvider,
} from '../server/modelProvider';

const admittedReceipt: InferenceReceipt = {
  broker: 'Hermes',
  requestId: 'request-interfaces-001',
  operation: 'onceaponatime.stage1.plan',
  actualProvider: 'openrouter',
  actualModel: 'actual/model-build-2026-09-01',
  fallbackUsed: false,
  fallbackIndex: 0,
  routeAttemptCount: 1,
};

const provider: ReceiptBearingModelProvider = {
  name: 'receipt-bearing-test-provider',
  isAvailable: () => true,
  async generateText(params) {
    assert.equal(params.operation, admittedReceipt.operation);
    return { text: '{"beat_type":"action"}', receipt: admittedReceipt };
  },
};

const plan: BeatPlanStage1 = {
  beat_type: 'action',
  primary_actor_id: 'actor_001',
  intended_action: 'Cross the threshold.',
  knowledge_verified: true,
  reveals_protected: true,
  threads_advanced: [],
  threads_resolved: [],
  distance_budget: 'BEAT',
};

function assertCompileTimeReceiptBoundaries() {
  // @ts-expect-error Receipt-bearing provider success cannot omit its receipt.
  const providerResultWithoutReceipt: HermesGenerateTextResult = { text: 'receiptless' };
  // @ts-expect-error Stage 1 inference artifacts cannot omit their receipt.
  const stage1WithoutReceipt: Stage1PlanningArtifact = { value: plan };
  // @ts-expect-error Stage 2 inference artifacts cannot omit their receipt.
  const stage2WithoutReceipt: Stage2RenderingArtifact = { value: 'receiptless prose' };
  // @ts-expect-error Receipt-bearing provider calls must supply an operation label.
  const paramsWithoutOperation: ReceiptBearingGenerateTextParams = { userPrompt: 'Plan one beat.' };

  void providerResultWithoutReceipt;
  void stage1WithoutReceipt;
  void stage2WithoutReceipt;
  void paramsWithoutOperation;
}

async function runReceiptBearingInterfaceTests() {
  const providerResult = await provider.generateText({
    operation: 'onceaponatime.stage1.plan',
    userPrompt: 'Plan one beat.',
    jsonMode: true,
  });

  const stage1Artifact = createInferenceArtifact(plan, providerResult.receipt);
  const stage2Artifact = createInferenceArtifact('Rendered prose.', providerResult.receipt);

  assert.equal(stage1Artifact.receipt, providerResult.receipt);
  assert.equal(stage2Artifact.receipt, providerResult.receipt);
  assert.equal(Object.isFrozen(providerResult.receipt), true);
  assert.equal(Object.isFrozen(stage1Artifact), true);
  assert.equal(Object.isFrozen(stage2Artifact), true);
  assert.throws(() => {
    (stage1Artifact as { value: BeatPlanStage1 }).value = { ...plan, beat_type: 'tampered' };
  }, TypeError);
  assert.throws(() => {
    (providerResult.receipt as { actualModel: string }).actualModel = 'tampered';
  }, TypeError);
}

void assertCompileTimeReceiptBoundaries;
runReceiptBearingInterfaceTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
