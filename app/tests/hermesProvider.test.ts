import assert from 'node:assert/strict';
import {
  HermesProvider,
  type GenerateTextParams,
} from '../server/modelProvider';

const params: GenerateTextParams = {
  operation: 'onceaponatime.stage1.plan',
  systemPrompt: 'Return a bounded plan.',
  userPrompt: 'Plan one beat.',
  jsonMode: true,
  temperature: 0.3,
};

function completedEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'hermes.inference.response.v1',
    request_id: 'request-001',
    status: 'completed',
    output: { text: '{"beat_type":"action"}' },
    execution: {
      provider: 'openrouter',
      model: 'actual/model-build-2026-09-01',
      fallback_used: true,
      fallback_index: 1,
      attempt_count: 2,
    },
    ...overrides,
  };
}

function providerReturning(payload: unknown, status = 200) {
  return new HermesProvider({
    baseUrl: 'http://127.0.0.1:8642',
    apiKey: 'test-api-key',
    fetchImpl: async () => new Response(JSON.stringify(payload), { status }),
    requestIdFactory: () => 'request-001',
  });
}

async function testClosedRequestAndImmutableReceipt() {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const provider = new HermesProvider({
    baseUrl: 'http://127.0.0.1:8642/',
    apiKey: 'test-api-key',
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify(completedEnvelope()), { status: 200 });
    },
    requestIdFactory: () => 'request-001',
  });

  const result = await provider.generateText(params);

  assert.equal(capturedUrl, 'http://127.0.0.1:8642/v1/inference');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(
    (capturedInit?.headers as Record<string, string>).Authorization,
    'Bearer test-api-key',
  );

  const body = JSON.parse(String(capturedInit?.body));
  assert.deepEqual(Object.keys(body).sort(), [
    'messages',
    'operation',
    'options',
    'request_id',
    'schema',
  ]);
  assert.equal('provider' in body, false);
  assert.equal('model' in body, false);
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'Return a bounded plan.' },
    { role: 'user', content: 'Plan one beat.' },
  ]);
  assert.deepEqual(body.options, {
    temperature: 0.3,
    response_format: 'json',
  });

  assert.deepEqual(result, {
    text: '{"beat_type":"action"}',
    receipt: {
      broker: 'Hermes',
      requestId: 'request-001',
      operation: 'onceaponatime.stage1.plan',
      actualProvider: 'openrouter',
      actualModel: 'actual/model-build-2026-09-01',
      fallbackUsed: true,
      fallbackIndex: 1,
      routeAttemptCount: 2,
    },
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.receipt), true);
  assert.throws(() => {
    (result.receipt as { actualModel: string }).actualModel = 'tampered';
  }, TypeError);
}

async function testRequestIdMismatchFailsClosed() {
  const provider = providerReturning(completedEnvelope({
    request_id: 'different-request',
  }));

  await assert.rejects(() => provider.generateText(params), /request.?id/i);
}

async function testInconsistentFallbackReceiptFailsClosed() {
  const provider = providerReturning(completedEnvelope({
    execution: {
      provider: 'openrouter',
      model: 'actual/model-build-2026-09-01',
      fallback_used: false,
      fallback_index: 1,
      attempt_count: 2,
    },
  }));

  await assert.rejects(() => provider.generateText(params), /fallback/i);
}

async function testMissingRuntimeIdentityFailsClosed() {
  const provider = providerReturning(completedEnvelope({
    execution: {
      provider: 'openrouter',
      model: '',
      fallback_used: false,
      fallback_index: 0,
      attempt_count: 1,
    },
  }));

  await assert.rejects(() => provider.generateText(params), /model|identity/i);
}

async function testUnknownStatusFailsClosed() {
  const provider = providerReturning(completedEnvelope({ status: 'partial' }));

  await assert.rejects(() => provider.generateText(params), /status|completed/i);
}

async function testFailedHttpResponseNeverReturnsPlausibleOutput() {
  const provider = providerReturning({
    schema: 'hermes.inference.response.v1',
    request_id: 'request-001',
    status: 'failed',
    output: { text: 'quietly fabricated paragraph' },
    error: {
      code: 'no_usable_model',
      message: 'No configured model is available.',
      retryable: false,
    },
  }, 503);

  await assert.rejects(
    () => provider.generateText(params),
    /no configured model|no_usable_model|503/i,
  );
}

async function runHermesProviderContractTests() {
  await testClosedRequestAndImmutableReceipt();
  await testRequestIdMismatchFailsClosed();
  await testInconsistentFallbackReceiptFailsClosed();
  await testMissingRuntimeIdentityFailsClosed();
  await testUnknownStatusFailsClosed();
  await testFailedHttpResponseNeverReturnsPlausibleOutput();
}

runHermesProviderContractTests().catch((error) => {
  console.error(error);
  process.exit(1);
});