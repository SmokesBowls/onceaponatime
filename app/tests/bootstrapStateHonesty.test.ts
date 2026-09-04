import assert from 'node:assert/strict';
import { compileGenerationContext, compileStage2RenderingEnvelope } from '../server/contextCompiler';
import { renderNarrativeProse } from '../server/narrativePipeline';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import { buildBootstrapManifest, decideBootstrapManifestEntry } from '../src/lib/bootstrapManifest';
import { prepareBootstrap } from '../src/lib/prepareBootstrap';
import type {
  AuthorSourceDocument,
  BeatPlanStage1,
  InferenceReceipt,
  StoryProject,
} from '../src/types';
import type {
  HermesGenerateTextResult,
  ReceiptBearingGenerateTextParams,
  ReceiptBearingModelProvider,
} from '../server/modelProvider';

/**
 * End-to-end proof that a bootstrapped entity's unestablished current_state/
 * status never reaches the Stage 1 GenerationContext dump or the Stage 2
 * rendering prompt as if it were an authored, concrete fact -- the actual
 * downstream leak the truthfulness audit found, not just the domain layer
 * in isolation.
 */

function admittedReceipt(operation: string): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId: 'bootstrap-state-honesty-request',
    operation,
    actualProvider: 'test-provider',
    actualModel: 'test-model',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
  });
}

function providerCapturing(
  capture: (params: ReceiptBearingGenerateTextParams) => void,
): ReceiptBearingModelProvider {
  return {
    name: 'bootstrap-state-honesty-test-provider',
    isAvailable: () => true,
    async generateText(params): Promise<HermesGenerateTextResult> {
      capture(params);
      return Object.freeze({ text: 'Mara studied the well.', receipt: admittedReceipt('onceaponatime.stage2.render') });
    },
  };
}

function buildBootstrappedProject(): StoryProject {
  const project = createManuscriptIntakeProject({
    projectId: 'proj_state_honesty',
    projectTitle: 'State Honesty Fixture',
    sourceLabel: 'Chapter One',
    pastedText: 'Mara found a brass key near the old well.',
    importedAt: 1,
    sourceDocumentId: 'source_state_honesty',
  });
  const doc = (project.sourceDocuments as AuthorSourceDocument[])[0];
  const evidence = (label: string) => {
    const start = doc.exactText.indexOf(label);
    return [{ sourceDocumentId: doc.id, unitId: label, startOffset: start, endOffset: start + label.length, exactText: label }];
  };

  let manifest = buildBootstrapManifest(project, {
    entries: [
      { proposed: { kind: 'location_proposal', id: 'location_well', working_label: 'the old well', name: null, aliases: [] }, evidence: evidence('old well') },
      { proposed: { kind: 'actor_proposal', id: 'actor_mara', working_label: 'Mara', name: null, aliases: [], initial_location_id: 'location_well' }, evidence: evidence('Mara') },
      { proposed: { kind: 'object_proposal', id: 'object_key', working_label: 'a brass key', name: null, aliases: [], initial_location_id: 'location_well', initial_holder_actor_id: 'actor_mara' }, evidence: evidence('brass key') },
    ],
  });
  for (const e of manifest.entries) {
    manifest = decideBootstrapManifestEntry(manifest, e.id, 'approved');
  }
  const { nextProject } = prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1);
  return nextProject;
}

async function testUnknownActorStateDoesNotAppearAsConcreteStateInStage2ModelContext() {
  const project = buildBootstrappedProject();
  const mara = project.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_state, undefined, 'fixture sanity check');

  const generationContext = compileGenerationContext({
    project,
    activePovActorId: project.activePovActorId,
    currentPosition: project.currentPosition,
    operation: 'CONTINUATION',
    narrativeDistance: 'BEAT',
  });
  assert.equal(generationContext.activePovActor.current_state, undefined,
    'GenerationContext (the entire object Stage 1 dumps verbatim into its prompt) must not carry a fabricated current_state');

  const plan: BeatPlanStage1 = {
    beat_type: 'action',
    primary_actor_id: 'actor_mara',
    intended_action: 'Examine the well.',
    permitted_entities_involved: ['actor_mara', 'object_key'],
    permitted_state_transitions: [],
    knowledge_verified: true,
    reveals_protected: true,
    threads_advanced: [],
    threads_resolved: [],
    distance_budget: 'BEAT',
  };
  const envelope = compileStage2RenderingEnvelope(generationContext, plan);
  assert.equal(envelope.pov.currentState, undefined, 'Stage2RenderingEnvelope must not carry a fabricated POV current state');

  let modelRequest = '';
  await renderNarrativeProse(envelope, plan, providerCapturing((params) => {
    modelRequest = `${params.systemPrompt || ''}\n${params.userPrompt || ''}`;
  }));

  assert.equal(modelRequest.includes('POV Current State'), false,
    'the prompt line must be omitted entirely, not rendered as "POV Current State: undefined"');
  assert.equal(modelRequest.includes('undefined'), false, 'no stray "undefined" text should leak into the prompt at all');
  assert.equal(modelRequest.includes('"certainty":0.5'), false);
  assert.equal(modelRequest.includes('"emotion":"neutral"'), false);
}

async function testUnknownObjectConditionDoesNotAppearAsConcreteStateInModelContext() {
  const project = buildBootstrappedProject();
  const key = project.objects.find((o) => o.id === 'object_key');
  assert.equal(key?.status, undefined, 'fixture sanity check');

  const generationContext = compileGenerationContext({
    project,
    activePovActorId: project.activePovActorId,
    currentPosition: project.currentPosition,
    operation: 'CONTINUATION',
    narrativeDistance: 'BEAT',
  });
  const keyEntity = generationContext.presentEntities.find((e) => e.id === 'object_key');
  assert.ok(keyEntity, 'the key must be present in the current scene for this to be a meaningful test');
  assert.equal(keyEntity?.roleOrStatus, undefined, 'an unestablished object status must not appear as roleOrStatus');

  const serialized = JSON.stringify(generationContext);
  assert.equal(serialized.includes('"intact"'), false,
    'the full Stage 1 context dump (which is embedded verbatim in the planning prompt) must not claim "intact" for an unestablished object');
}

function run() {
  return (async () => {
    await testUnknownActorStateDoesNotAppearAsConcreteStateInStage2ModelContext();
    await testUnknownObjectConditionDoesNotAppearAsConcreteStateInModelContext();
    console.log('bootstrap state honesty (downstream) regression passed');
  })();
}

run();
