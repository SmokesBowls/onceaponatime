import assert from 'node:assert/strict';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import { buildBootstrapManifest, decideBootstrapManifestEntry } from '../src/lib/bootstrapManifest';
import { prepareBootstrap } from '../src/lib/prepareBootstrap';
import {
  buildPromotionManifest,
  decidePromotionManifestEntry,
} from '../src/lib/promotionManifest';
import { preparePromotion } from '../src/lib/preparePromotion';
import {
  createCandidateGeneration,
  createInferenceArtifact,
  type BeatPlanStage1,
  type CandidateGeneration,
  type InferenceReceipt,
  type StoryProject,
} from '../src/types';
import type { PromotionExtractionPayload } from '../src/lib/promotionIntegrity';

/**
 * Adversarial-review follow-up: a Bootstrap Manifest actor genuinely has no
 * current_state (see BOOTSTRAP_MANIFEST_ENGINEERING_REPORT.md). Both
 * preparePromotion.ts::applyActorStateChange (mutates it) and
 * ::buildTemporalSnapshot (reads it for every actor unconditionally, not
 * just ones a beat touches) previously assumed it always existed and would
 * have thrown the moment a bootstrap-produced project ever went through
 * ordinary story promotion. Proves that no longer happens.
 */

function receipt(operation: string, requestId: string): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId,
    operation,
    actualProvider: 'test-provider',
    actualModel: 'test-model',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
  });
}

function buildBootstrappedProject(): StoryProject {
  const project = createManuscriptIntakeProject({
    projectId: 'proj_interop_test',
    projectTitle: 'Interop Fixture',
    sourceLabel: 'Chapter One',
    pastedText: 'Mara stood at the old well.',
    importedAt: 1,
    sourceDocumentId: 'source_interop_test',
  });
  const doc = project.sourceDocuments![0];
  const evidence = (label: string) => {
    const start = doc.exactText.indexOf(label);
    return [{ sourceDocumentId: doc.id, unitId: label, startOffset: start, endOffset: start + label.length, exactText: label }];
  };
  let manifest = buildBootstrapManifest(project, {
    entries: [
      { proposed: { kind: 'location_proposal', id: 'location_well', working_label: 'the old well', name: null, aliases: [] }, evidence: evidence('old well') },
      { proposed: { kind: 'actor_proposal', id: 'actor_mara', working_label: 'Mara', name: null, aliases: [], initial_location_id: 'location_well' }, evidence: evidence('Mara') },
    ],
  });
  for (const e of manifest.entries) {
    manifest = decideBootstrapManifestEntry(manifest, e.id, 'approved');
  }
  const { nextProject } = prepareBootstrap(project, manifest, { activePovActorId: 'actor_mara', currentLocationId: 'location_well' }, 1);
  return nextProject;
}

function candidateFor(project: StoryProject, prose: string): CandidateGeneration {
  const plan: BeatPlanStage1 = {
    beat_type: 'action',
    primary_actor_id: project.activePovActorId,
    intended_action: 'Continue.',
    permitted_entities_involved: [project.activePovActorId],
    permitted_state_transitions: [],
    knowledge_verified: true,
    reveals_protected: true,
    threads_advanced: [],
    threads_resolved: [],
    distance_budget: 'BEAT',
  };
  return createCandidateGeneration({
    id: 'candidate-interop-001',
    timestamp: 1,
    operation: 'CONTINUATION',
    narrativeDistance: 'BEAT',
    prompt: 'Continue.',
    stage1Artifact: createInferenceArtifact(plan, receipt('onceaponatime.stage1.plan', 'stage1-interop')),
    stage2Artifact: createInferenceArtifact(prose, receipt('onceaponatime.stage2.render', 'stage2-interop')),
    validation: { passed: true, score: 100, diagnostics: [], verified: true, status: 'VERIFIED' },
    contextPackage: {},
    status: 'pending',
  });
}

function testActorStateChangeOnAStatelessBootstrapActorDoesNotCrash() {
  const project = buildBootstrappedProject();
  const mara = project.actors.find((a) => a.id === 'actor_mara');
  assert.equal(mara?.current_state, undefined, 'fixture sanity check');

  const candidate = candidateFor(project, 'Mara grew tired as she searched.');
  const extraction: PromotionExtractionPayload = {
    success: true,
    mentions: [],
    proposedNewEntities: [],
    stateChanges: {
      location_changes: [],
      possession_changes: [],
      actor_state_changes: [{ actor_id: 'actor_mara', fatigue_delta: 0.2, emotion: 'weary' }],
      belief_changes: [],
      thread_advancements: [],
      reveals_triggered: [],
    },
  };
  let manifest = buildPromotionManifest(project, candidate, extraction);
  manifest = decidePromotionManifestEntry(manifest, manifest.entries[0].id, 'approved');

  assert.doesNotThrow(() => preparePromotion(project, candidate, manifest),
    'accepting a real actor-state-change beat must not crash on a bootstrap actor with no prior current_state');

  const { nextProject } = preparePromotion(project, candidate, manifest);
  const updatedMara = nextProject.actors.find((a) => a.id === 'actor_mara');
  assert.ok(updatedMara?.current_state, 'current_state must now be materialized, since real evidence exists');
  assert.equal(updatedMara?.current_state?.emotion, 'weary');
  assert.ok(updatedMara!.current_state!.fatigue > 0);
}

function testAcceptingABeatThatDoesNotTouchAStatelessActorStillDoesNotCrash() {
  // buildTemporalSnapshot reads current_state for *every* actor
  // unconditionally, not just ones a given beat's state changes mention.
  const project = buildBootstrappedProject();
  const candidate = candidateFor(project, 'The well was silent.');
  const extraction: PromotionExtractionPayload = {
    success: true,
    mentions: [],
    proposedNewEntities: [],
    stateChanges: {
      location_changes: [],
      possession_changes: [],
      actor_state_changes: [], // Mara's own state is never touched by this beat.
      belief_changes: [],
      thread_advancements: [],
      reveals_triggered: [],
    },
  };
  const manifest = buildPromotionManifest(project, candidate, extraction);
  assert.doesNotThrow(() => preparePromotion(project, candidate, manifest));
  const { nextProject } = preparePromotion(project, candidate, manifest);
  // The untouched actor's own live current_state must remain genuinely
  // absent -- the historical-ledger fallback must not leak back into it.
  assert.equal(nextProject.actors.find((a) => a.id === 'actor_mara')?.current_state, undefined);
}

function run() {
  testActorStateChangeOnAStatelessBootstrapActorDoesNotCrash();
  testAcceptingABeatThatDoesNotTouchAStatelessActorStillDoesNotCrash();
  console.log('bootstrap/promotion interop regression passed');
}

run();
