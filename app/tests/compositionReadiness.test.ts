import assert from 'node:assert/strict';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import {
  assessCompositionReadiness,
  canDispatchFrameworkExecution,
  describeBeatPosition,
} from '../src/lib/compositionReadiness';

function sourceOnlyProject() {
  return createManuscriptIntakeProject({
    projectId: 'proj_readiness_test',
    projectTitle: 'A Real Imported Manuscript',
    sourceLabel: 'Chapter One',
    pastedText: 'The author\'s real, unprocessed prose.',
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_readiness_test',
  });
}

// ---------------------------------------------------------------------------
// Composition readiness
// ---------------------------------------------------------------------------

function testSourceOnlyProjectIsNotCompositionReady() {
  const readiness = assessCompositionReadiness(sourceOnlyProject());
  assert.equal(readiness.ready, false, 'a freshly imported, source-only project must not be composition-ready');
  assert.equal(readiness.hasPovActor, false, 'there is no actor for activePovActorId (\'\') to resolve to');
  assert.equal(readiness.hasCurrentLocation, false, 'there is no location for currentPosition.location_id (\'\') to resolve to');
}

function testStructuredDemoProjectsAreCompositionReady() {
  for (const project of DEFAULT_PROJECTS) {
    const readiness = assessCompositionReadiness(project);
    assert.equal(readiness.ready, true, `${project.id} is a fully structured demo project and must be composition-ready`);
    assert.equal(readiness.hasPovActor, true, `${project.id} must resolve its activePovActorId to a real actor`);
    assert.equal(readiness.hasCurrentLocation, true, `${project.id} must resolve its currentPosition.location_id to a real location`);
  }
}

function testReadinessDoesNotInferFromSourceDocumentsPresence() {
  // A project can lack sourceDocuments and still be composition-ready (any
  // demo project), and a project can have sourceDocuments and still not be
  // ready (a fresh import). The predicate must not special-case sourceDocuments.
  const demo = DEFAULT_PROJECTS[0];
  assert.equal(demo.sourceDocuments, undefined);
  assert.equal(assessCompositionReadiness(demo).ready, true);

  const imported = sourceOnlyProject();
  assert.equal((imported.sourceDocuments ?? []).length, 1);
  assert.equal(assessCompositionReadiness(imported).ready, false);
}

function testProjectWithActorsButUnresolvedPovIsNotReady() {
  // Guards against relying on any accidental "fall back to the first actor"
  // leniency elsewhere in the pipeline: activePovActorId must actually
  // resolve to a real actor, not merely coexist with a non-empty actors array.
  const project = sourceOnlyProject();
  const withOrphanedActor = {
    ...project,
    actors: [
      {
        id: 'actor_orphan',
        identity: { name: null, working_label: 'an unrelated actor', aliases: [] },
        roles: { story: [], scene: [] },
        traits: {},
        current_state: { fatigue: 0, fear: 0, certainty: 0.5, emotion: 'neutral' },
        active_goals: [],
        current_location_id: '',
        possessions: [],
        isPresent: true,
      },
    ],
  };
  assert.equal(withOrphanedActor.activePovActorId, '');
  const readiness = assessCompositionReadiness(withOrphanedActor);
  assert.equal(readiness.hasPovActor, false,
    'an actor existing in the project does not make an unresolved activePovActorId ready');
  assert.equal(readiness.ready, false);
}

// ---------------------------------------------------------------------------
// Pure dispatch decision layer: proves a source-only project cannot dispatch
// POST /api/framework/execute. App.tsx's handleExecuteFramework calls this
// exact function before ever calling fetch; StoryEditor.tsx's Execute button
// is disabled by this exact function; there is no path for the two to
// disagree because both consult the same pure decision.
// ---------------------------------------------------------------------------

function testSourceOnlyProjectCannotDispatchFrameworkExecution() {
  assert.equal(canDispatchFrameworkExecution(sourceOnlyProject()), false);
}

function testStructuredDemoProjectsCanDispatchFrameworkExecution() {
  for (const project of DEFAULT_PROJECTS) {
    assert.equal(canDispatchFrameworkExecution(project), true, `${project.id} must be able to dispatch execution`);
  }
}

function testDispatchDecisionAgreesExactlyWithReadinessAssessment() {
  const projects = [sourceOnlyProject(), ...DEFAULT_PROJECTS];
  for (const project of projects) {
    assert.equal(canDispatchFrameworkExecution(project), assessCompositionReadiness(project).ready);
  }
}

// ---------------------------------------------------------------------------
// Demo-specific author-direction suggestion chips: StoryEditor.tsx gates its
// hardcoded quickPrompts block on composition readiness. Proven here at the
// same pure decision layer used for dispatch, since there is no React/DOM
// test harness in this repository to assert on rendered output directly.
// ---------------------------------------------------------------------------

function testQuickPromptSuggestionsAreNotOfferedForASourceOnlyProject() {
  assert.equal(assessCompositionReadiness(sourceOnlyProject()).ready, false,
    'StoryEditor.tsx must not render its demo-specific quick-prompt suggestion chips '
    + 'when composition readiness is false');
}

function testQuickPromptSuggestionsRemainAvailableForStructuredDemoProjects() {
  for (const project of DEFAULT_PROJECTS) {
    assert.equal(assessCompositionReadiness(project).ready, true);
  }
}

// ---------------------------------------------------------------------------
// Beat position display: no fabricated "Beat #1" when zero manuscript beats
// have actually been accepted into canon.
// ---------------------------------------------------------------------------

function testNoFakeBeatNumberIsDisplayedForAProjectWithZeroManuscriptBeats() {
  const project = sourceOnlyProject();
  assert.equal(project.manuscript.length, 0);
  assert.equal(project.currentPosition.beat, 1,
    'currentPosition.beat is still 1 internally (a "next beat" pointer) -- the display must not surface it as a claim');
  assert.equal(describeBeatPosition(project), 'No beats yet');
}

function testRealBeatNumberIsDisplayedOnceManuscriptBeatsExist() {
  for (const project of DEFAULT_PROJECTS) {
    assert.ok(project.manuscript.length > 0, `${project.id} fixture must have accepted beats for this test to be meaningful`);
    assert.equal(describeBeatPosition(project), `Beat #${project.currentPosition.beat}`);
  }
}

function testBeatDisplayTransitionsHonestlyAsBeatsAreAccepted() {
  const project = sourceOnlyProject();
  assert.equal(describeBeatPosition(project), 'No beats yet');

  const withOneBeat = {
    ...project,
    manuscript: [
      { id: 'beat_1', beatNumber: 1, text: 'The first canonical beat.', povActorId: 'actor_x', locationId: 'location_x', acceptedAt: Date.now() },
    ],
    currentPosition: { ...project.currentPosition, beat: 2 },
  };
  assert.equal(describeBeatPosition(withOneBeat), 'Beat #2');
}

function run() {
  testSourceOnlyProjectIsNotCompositionReady();
  testStructuredDemoProjectsAreCompositionReady();
  testReadinessDoesNotInferFromSourceDocumentsPresence();
  testProjectWithActorsButUnresolvedPovIsNotReady();
  testSourceOnlyProjectCannotDispatchFrameworkExecution();
  testStructuredDemoProjectsCanDispatchFrameworkExecution();
  testDispatchDecisionAgreesExactlyWithReadinessAssessment();
  testQuickPromptSuggestionsAreNotOfferedForASourceOnlyProject();
  testQuickPromptSuggestionsRemainAvailableForStructuredDemoProjects();
  testNoFakeBeatNumberIsDisplayedForAProjectWithZeroManuscriptBeats();
  testRealBeatNumberIsDisplayedOnceManuscriptBeatsExist();
  testBeatDisplayTransitionsHonestlyAsBeatsAreAccepted();
  console.log('composition readiness gate regression passed');
}

run();
