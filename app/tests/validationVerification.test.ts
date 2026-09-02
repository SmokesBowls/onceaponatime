import { validateCandidateProse, planNarrativeBeat } from '../server/narrativePipeline';
import { compileGenerationContext, compileValidationContext } from '../server/contextCompiler';
import { StoryProject, GenerationContext, ValidationContext } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runValidationTests() {
  console.log('\n=== RUNNING VALIDATION INTEGRITY & ANTI-FAKE-SUCCESS TESTS ===\n');

  // Test Project Setup
  const testProject: StoryProject = {
    id: 'proj_val_01',
    title: 'Validation Test Project',
    description: 'Testing real validation checks without fake success',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 1',
      scene: 'Scene 1',
      beat: 1,
      location_id: 'loc_study',
      location_label: 'Private Study',
    },
    activePovActorId: 'actor_pov',
    actors: [
      {
        id: 'actor_pov',
        identity: { name: 'Evelyn Gray', working_label: 'Evelyn', aliases: [] },
        roles: { story: ['protagonist'], scene: ['scholar'] },
        traits: { perceptive: 0.8 },
        current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.6, emotion: 'curious' },
        active_goals: ['Read the codex'],
        current_location_id: 'loc_study',
        possessions: ['obj_lantern'],
        isPresent: true,
      },
      {
        id: 'actor_stranger',
        identity: { name: 'Veyran', working_label: 'the stranger', aliases: [] },
        roles: { story: ['infiltrator'], scene: ['bystander'] },
        traits: {},
        current_state: { fatigue: 0, fear: 0, certainty: 1, emotion: 'calm' },
        active_goals: [],
        current_location_id: 'loc_study',
        possessions: [],
        isPresent: true,
      },
    ],
    objects: [
      {
        id: 'obj_lantern',
        identity: { name: 'Brass Lantern', working_label: 'the lantern', aliases: [] },
        current_holder_id: 'actor_pov',
        current_location_id: 'loc_study',
        status: 'intact',
        salience: 0.5,
        isPresent: true,
      },
    ],
    locations: [
      {
        id: 'loc_study',
        identity: { name: 'Private Study', working_label: 'the study', aliases: [] },
        parent_location_id: null,
        connected_locations: [],
        description_summary: 'A quiet room lined with bookshelves.',
      },
    ],
    factions: [],
    facts: [
      {
        id: 'fact_secret_poison',
        statement: 'The council poisoned the water supply during the winter solstice',
        status: 'established',
        confidence: 1.0,
        provenance: {},
      },
    ],
    knowledge: {
      world_truth: ['fact_secret_poison'],
      reader_knowledge: [],
      actor_knowledge: {
        actor_pov: {
          known_facts: [],
          beliefs: ['The water tastes strange.'],
          forbidden_knowledge: ['fact_secret_poison'],
        },
      },
    },
    reveals: [
      {
        id: 'reveal_poison',
        fact_id: 'fact_secret_poison',
        label: 'The Solstice Poisoning',
        status: 'locked',
        allowed_before_unlock: ['a bitter taste in the wine'],
        forbidden_before_unlock: ['poisoned the water supply', 'winter solstice poisoning'],
      },
    ],
    threads: [
      {
        id: 'thread_unresolvable_01',
        label: 'Investigate the old archives',
        status: 'open',
        importance: 'major',
        introduced_in: 'Chapter 1',
        resolution_allowed: false, // NOT resolvable
        visible_to_actor_ids: ['actor_pov'],
      },
    ],
    manuscript: [],
    mentions: [],
    temporalHistory: [],
  };

  const genCtx: GenerationContext = compileGenerationContext({
    project: testProject,
    activePovActorId: 'actor_pov',
    currentPosition: testProject.currentPosition,
    operation: 'GENERATION',
    narrativeDistance: 'BEAT',
  });

  const valCtx: ValidationContext = compileValidationContext(
    testProject,
    'actor_pov',
    'BEAT'
  );

  // Mock Provider for deterministic testing (isAvailable = false)
  const offlineProvider = {
    name: 'offline_mock',
    isAvailable: () => false,
    generateText: async () => ({ text: '', providerName: 'offline_mock' }),
  };

  // -------------------------------------------------------------
  // TEST 1: STAGE 1 TRUTHFUL REVEAL & KNOWLEDGE VERIFICATION
  // -------------------------------------------------------------
  console.log('--- TEST 1: Stage 1 Plan Verification Truthfulness ---');

  // A. Local Stage 1 must NOT claim full epistemic knowledge verification or manufacture reveal verification
  const localPlan = await planNarrativeBeat(genCtx, 'Evelyn investigates the bookshelf.', offlineProvider);

  assert(
    localPlan.knowledge_verified === false,
    'Local Stage 1 plan sets knowledge_verified: false (does not claim unperformed epistemic verification)'
  );
  assert(
    localPlan.reveals_protected === false,
    'Local Stage 1 plan sets reveals_protected: false (does not manufacture reveals_protected: true)'
  );
  assert(
    Array.isArray(localPlan.threads_resolved) && localPlan.threads_resolved.length === 0,
    'threads_resolved is empty, yet reveals_protected is truthfully false rather than claimed true'
  );

  // B. Online / Normalized Stage 1 Plan must not claim knowledge_verified or reveals_protected
  const mockPlanWithEmptyResolved = {
    name: 'mock_online_planner',
    isAvailable: () => true,
    generateText: async () => ({
      text: JSON.stringify({
        beat_type: 'action',
        primary_actor_id: 'actor_pov',
        intended_action: 'Examines the ancient parchment on the desk',
        permitted_entities_involved: ['actor_pov', 'obj_lantern'],
        permitted_state_transitions: ['reads parchment'],
        threads_advanced: ['thread_unresolvable_01'],
        threads_resolved: [], // empty
        distance_budget: 'BEAT',
        plan_notes: 'Checking empty resolved threads',
      }),
      providerName: 'mock_online_planner',
    }),
  };

  const normalizedPlan = await planNarrativeBeat(genCtx, 'Examines parchment', mockPlanWithEmptyResolved);

  assert(
    normalizedPlan.knowledge_verified === false,
    'Normalized Stage 1 plan sets knowledge_verified: false'
  );
  assert(
    normalizedPlan.reveals_protected === false,
    'Normalized Stage 1 plan sets reveals_protected: false'
  );

  // -------------------------------------------------------------
  // TEST 2: FORBIDDEN KNOWLEDGE LEAKAGE MUST FAIL VALIDATION
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Forbidden Knowledge Leakage Validation Failure ---');

  const leakingProse = 'Evelyn realized with certainty that the council poisoned the water supply during the winter solstice.';
  const leakingReport = await validateCandidateProse(leakingProse, valCtx, undefined, offlineProvider);

  assert(leakingReport.passed === false, 'Leaking prose must have passed: false');
  assert(leakingReport.verified === false, 'Leaking prose must have verified: false');
  assert(leakingReport.status === 'UNVERIFIED', 'Leaking prose must have status: "UNVERIFIED"');
  assert(leakingReport.score < 70, `Score must be < 70 (got ${leakingReport.score})`);
  assert(
    leakingReport.diagnostics.some((d) => d.severity === 'FATAL' && (d.rule === 'KNOWLEDGE_LEAKAGE' || d.rule === 'LOCKED_REVEAL_PREMATURE_DISCLOSURE')),
    'Diagnostics must contain a FATAL constraint breach'
  );

  // -------------------------------------------------------------
  // TEST 3: LOCKED REVEAL PREMATURE DISCLOSURE MUST FAIL VALIDATION
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Locked Reveal Premature Disclosure Validation Failure ---');

  const revealLeakingProse = 'She uncovered evidence of the winter solstice poisoning hidden behind the desk.';
  const revealReport = await validateCandidateProse(revealLeakingProse, valCtx, undefined, offlineProvider);

  assert(revealReport.passed === false, 'Locked reveal disclosure must have passed: false');
  assert(revealReport.verified === false, 'Locked reveal disclosure must have verified: false');
  assert(revealReport.status === 'UNVERIFIED', 'Locked reveal disclosure must have status: "UNVERIFIED"');
  assert(
    revealReport.diagnostics.some((d) => d.severity === 'FATAL' && d.rule === 'LOCKED_REVEAL_PREMATURE_DISCLOSURE'),
    'Diagnostics must contain FATAL LOCKED_REVEAL_PREMATURE_DISCLOSURE'
  );

  // -------------------------------------------------------------
  // TEST 4: CLEAN PROSE WITH UNAVAILABLE MODEL PROVIDER
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Clean Prose with Unavailable Model Provider ---');

  const cleanProse = 'Evelyn lifted the brass lantern, its warm flame casting long amber shadows across the dusty study shelves.';
  const cleanReport = await validateCandidateProse(cleanProse, valCtx, undefined, offlineProvider);

  assert(cleanReport.passed === true, 'Clean prose has passed: true for available deterministic checks');
  assert(
    cleanReport.verified === false,
    'Clean prose with unavailable model provider does NOT return verified: true (must be verified: false)'
  );
  assert(
    cleanReport.status === 'UNVERIFIED',
    'Clean prose with unavailable model provider returns status: "UNVERIFIED" (not "VERIFIED")'
  );
  assert(
    cleanReport.diagnostics.some((d) => d.rule === 'PASSED_AVAILABLE_CHECKS'),
    'Diagnostics explicitly reports rule "PASSED_AVAILABLE_CHECKS"'
  );
  assert(
    !cleanReport.diagnostics.some((d) => d.severity === 'FATAL'),
    'Clean prose must have zero FATAL diagnostics'
  );

  console.log('\n🎉 ALL VALIDATION & STAGE 1 INTEGRITY TESTS PASSED TRUTHFULLY!\n');
}

runValidationTests().catch((err) => {
  console.error('Validation test run failed:', err);
  process.exit(1);
});
