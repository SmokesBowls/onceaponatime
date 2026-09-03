import assert from 'node:assert/strict';
import { extractMentionsAndState } from '../server/narrativePipeline';
import type { ModelProvider } from '../server/modelProvider';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import {
  applyAdmittedPossessionChanges,
  createMentionedObject,
  readPromotionExtractionResponse,
  restorePromotionSnapshot,
} from '../src/lib/promotionIntegrity';

const unavailableProvider: ModelProvider = {
  name: 'unavailable-test-provider',
  isAvailable: () => false,
  async generateText() {
    throw new Error('unavailable provider must not be called');
  },
};

const extractionParams = {
  prose: '',
  sceneId: 'scene-test',
  beatIndex: 2,
  locationId: 'location-test',
  povActorId: 'actor-pov',
  existingActors: [{
    id: 'actor-pov',
    identity: { name: 'Mara', working_label: 'the traveler', aliases: [] },
  }],
  existingObjects: [{
    id: 'object-lantern',
    identity: { name: 'Brass Lantern', working_label: 'the brass lantern', aliases: ['lantern'] },
    current_holder_id: null,
  }],
  existingLocations: [{
    id: 'location-test',
    identity: { name: 'Atrium', working_label: 'the atrium', aliases: [] },
  }],
};

const emptyStateChanges = {
  location_changes: [],
  possession_changes: [],
  actor_state_changes: [],
  belief_changes: [],
  thread_advancements: [],
  reveals_triggered: [],
};

function responseStub(options: {
  ok: boolean;
  status?: number;
  payload?: unknown;
  jsonError?: Error;
  onJson?: () => void;
}) {
  return {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    async json() {
      options.onJson?.();
      if (options.jsonError) throw options.jsonError;
      return options.payload;
    },
  };
}

async function testMentionFallbackProducesEvidenceWithoutSemanticChanges() {
  const mentionOnlyProse = [
    'Mara mentioned the brass lantern.',
    'Mara saw the brass lantern.',
    'Mara noticed the brass lantern.',
    'Mara approached the brass lantern.',
    'The brass lantern was introduced beside the doorway.',
  ];

  for (const prose of mentionOnlyProse) {
    const result = await extractMentionsAndState(
      { ...extractionParams, prose },
      unavailableProvider,
    );

    assert.equal(
      result.mentions.some((mention) => mention.entity_id === 'object-lantern'),
      true,
      `fallback preserves deterministic object mention evidence for: ${prose}`,
    );
    assert.deepEqual(
      result.stateChanges,
      emptyStateChanges,
      `fallback invents no semantic state for: ${prose}`,
    );
  }
}

function testMentionedObjectsStartUnheldUntilExplicitPossessionAdmission() {
  const object = createMentionedObject({
    id: 'object-new',
    type: 'object',
    working_label: 'a glass compass',
    name: null,
    aliases: ['compass'],
  }, 'location-test');

  assert.equal(object.current_holder_id, null);

  const descriptions: string[] = [];
  applyAdmittedPossessionChanges([object], [], descriptions);
  assert.equal(object.current_holder_id, null, 'entity creation and empty changes cannot invent possession');
  assert.deepEqual(descriptions, []);

  applyAdmittedPossessionChanges([object], [{
    object_id: object.id,
    from_actor_id: null,
    to_actor_id: 'actor-pov',
  }], descriptions);
  assert.equal(object.current_holder_id, 'actor-pov', 'an explicit admitted possession change may establish a holder');
}

async function testExtractionFailuresAreNotSuccessfulEmptyExtractions() {
  let non2xxJsonCalls = 0;
  await assert.rejects(
    readPromotionExtractionResponse(responseStub({
      ok: false,
      status: 503,
      payload: { mentions: [], stateChanges: emptyStateChanges },
      onJson: () => { non2xxJsonCalls += 1; },
    })),
    /503/,
  );
  assert.equal(non2xxJsonCalls, 0, 'non-2xx response is rejected before consuming its payload');

  await assert.rejects(
    readPromotionExtractionResponse(responseStub({
      ok: true,
      jsonError: new Error('invalid JSON'),
    })),
    /malformed/i,
  );

  await assert.rejects(
    readPromotionExtractionResponse(responseStub({
      ok: true,
      payload: { success: false, error: 'extractor refused result' },
    })),
    /extractor refused result/,
  );

  await assert.rejects(
    readPromotionExtractionResponse(responseStub({
      ok: true,
      payload: { success: true, mentions: [], proposedNewEntities: [] },
    })),
    /malformed/i,
  );
}

async function testFailedExtractionRestoresExactPrePromotionProject() {
  const prePromotionProject = structuredClone(DEFAULT_PROJECTS[0]);
  const before = JSON.stringify(prePromotionProject);
  let projects = [structuredClone(prePromotionProject)];

  projects[0].objects.push(createMentionedObject({
    id: 'object-should-rollback',
    type: 'object',
    working_label: 'rollback sentinel',
    name: null,
    aliases: [],
  }, prePromotionProject.currentPosition.location_id));

  try {
    await readPromotionExtractionResponse(responseStub({
      ok: false,
      status: 502,
      payload: { success: false },
    }));
    assert.fail('failed extraction must abort promotion');
  } catch {
    projects = restorePromotionSnapshot(projects, prePromotionProject.id, prePromotionProject);
  }

  assert.equal(JSON.stringify(projects[0]), before, 'failed promotion restores the exact pre-promotion StoryProject');
}

async function runPromotionIntegrityTests() {
  await testMentionFallbackProducesEvidenceWithoutSemanticChanges();
  testMentionedObjectsStartUnheldUntilExplicitPossessionAdmission();
  await testExtractionFailuresAreNotSuccessfulEmptyExtractions();
  await testFailedExtractionRestoresExactPrePromotionProject();
}

runPromotionIntegrityTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
