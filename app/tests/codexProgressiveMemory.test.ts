import {
  calculateReliability,
  classifyEntityTypes,
  detectEntityInteractions,
  extractClaimsFromProse,
  extractNovelEntityCandidates,
  mergeClaims,
  synthesizeCodex,
} from '../src/lib/codexEngine';
import {
  compileGenerationContext,
  compileStage2RenderingEnvelope,
} from '../server/contextCompiler';
import { StoryProject, CodexEntity } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runCodexTests() {
  console.log('\n=== RUNNING PROGRESSIVE NARRATIVE MEMORY & CODEX TESTS ===\n');

  // -------------------------------------------------------------
  // TEST 1: Exact Deterministic Reliability Progression
  // -------------------------------------------------------------
  console.log('--- TEST 1: Progressive Reliability Formula ---');
  assert(calculateReliability(0) === 0.0, '0 distinct evidence beats = 0% reliability');
  assert(calculateReliability(1) === 0.0, '1 distinct evidence beat (first mention) = 0% reliability');
  assert(calculateReliability(2) === 0.25, '2 distinct evidence beats = 25% reliability');
  assert(calculateReliability(3) === 0.45, '3 distinct evidence beats = 45% reliability');
  assert(calculateReliability(4) === 0.60, '4 distinct evidence beats = 60% reliability');
  assert(calculateReliability(5) === 0.72, '5 distinct evidence beats = 72% reliability');
  assert(calculateReliability(6) === 0.82, '6 distinct evidence beats = 82% reliability');
  assert(calculateReliability(7) === 0.89, '7 distinct evidence beats = 89% reliability');
  assert(calculateReliability(8) === 0.94, '8 distinct evidence beats = 94% reliability');
  assert(calculateReliability(9) === 0.97, '9 distinct evidence beats = 97% reliability');
  assert(calculateReliability(10) >= 0.97 && calculateReliability(10) <= 0.99, '10+ distinct evidence beats approach 99%');
  assert(calculateReliability(1, true) === 1.0, 'Author-locked entity is strictly 100% reliability');

  // -------------------------------------------------------------
  // TEST 2: Provisional Classification on First Appearance
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Provisional Classification on First Appearance ---');
  const wellClassification = classifyEntityTypes('abandoned stone well');
  assert(wellClassification.classificationConfidence === 'provisional', 'Stone well classification begins as provisional');
  assert(wellClassification.candidateTypes.includes('structure'), 'Candidate types include structure');
  assert(wellClassification.candidateTypes.includes('landmark'), 'Candidate types include landmark');
  assert(wellClassification.candidateTypes.includes('location'), 'Candidate types include location');
  assert(wellClassification.candidateTypes.includes('object'), 'Candidate types include object on first appearance');

  const resolvedClassification = classifyEntityTypes('abandoned stone well', [
    'stood anchored beside the road with a deep masonry shaft',
    'the deep stone shaft plunged into darkness',
  ]);
  assert(resolvedClassification.classificationConfidence === 'resolved', 'Classification resolves with spatial evidence');
  assert(resolvedClassification.primaryType === 'structure', 'Resolves to structure');

  // -------------------------------------------------------------
  // TEST 3: Mention is NOT Possession (Semantic Precision)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Mention is NOT Possession ---');
  const seeingText = 'The traveler saw an abandoned stone well beside the overgrown junction. A small brass device rested on the well, emitting a slow amber light.';
  
  const wellInteraction = detectEntityInteractions(seeingText, 'abandoned stone well');
  assert(!wellInteraction.isPossession, 'Seeing the well does NOT create possession');
  assert(wellInteraction.relationshipType === 'sees' || wellInteraction.relationshipType === 'mentions', 'Interaction is perception/mention');

  const deviceInteraction = detectEntityInteractions(seeingText, 'small brass device');
  assert(!deviceInteraction.isPossession, 'Device resting on the well is NOT held by traveler');
  assert(deviceInteraction.relationshipType === 'rests_on', 'Device relationship is rests_on');

  const pickupText = 'The traveler picked up the brass device and slipped it into his coat pocket.';
  const pickupInteraction = detectEntityInteractions(pickupText, 'brass device');
  assert(pickupInteraction.isPossession, 'Explicit pickup text correctly detects possession');
  assert(pickupInteraction.relationshipType === 'holds', 'Relationship is holds');

  const dropText = 'The traveler set down the brass device onto the cold stone altar.';
  const dropInteraction = detectEntityInteractions(dropText, 'brass device');
  assert(!dropInteraction.isPossession, 'Setting down does not constitute holding');
  assert(dropInteraction.isRelease, 'Setting down is a release');

  // -------------------------------------------------------------
  // TEST 4: Crossroads Regression Project Synthesized State
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: The Crossroads Project Regression Verification ---');
  const crossroadsProject: StoryProject = {
    id: 'proj_crossroads_test',
    title: 'The Crossroads Regression',
    description: 'Testing traveler well and brass device memory',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 1',
      scene: 'Scene 1',
      beat: 1,
      location_id: 'loc_crossroads',
      location_label: 'The Crossroads',
    },
    activePovActorId: 'actor_traveler',
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'The traveler saw an abandoned stone well beside the overgrown junction. A small brass device rested on the well, emitting a slow amber light across the damp masonry.',
        povActorId: 'actor_traveler',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000000000,
      },
    ],
    actors: [
      {
        id: 'actor_traveler',
        identity: { name: 'The Traveler', working_label: 'traveler', aliases: [] },
        roles: { story: ['protagonist'], scene: ['observer'] },
        traits: {},
        current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.2, emotion: 'watchful' },
        active_goals: ['Inspect junction'],
        current_location_id: 'loc_crossroads',
        possessions: [],
        isPresent: true,
      },
    ],
    objects: [
      {
        id: 'object_well',
        identity: { name: null, working_label: 'abandoned stone well', aliases: [] },
        current_holder_id: null,
        current_location_id: 'loc_crossroads',
        status: 'intact',
        salience: 0.7,
        isPresent: true,
      },
      {
        id: 'object_brass_device',
        identity: { name: null, working_label: 'small brass device', aliases: ['the device'] },
        current_holder_id: null,
        current_location_id: 'loc_crossroads',
        status: 'intact',
        salience: 0.85,
        isPresent: true,
      },
    ],
    locations: [
      {
        id: 'loc_crossroads',
        identity: { name: 'The Crossroads', working_label: 'the crossroads', aliases: [] },
        parent_location_id: null,
        connected_locations: [],
        description_summary: 'An overgrown junction.',
      },
    ],
    factions: [],
    facts: [],
    threads: [],
    reveals: [],
    mentions: [],
    knowledge: {
      world_truth: [],
      reader_knowledge: [],
      actor_knowledge: {
        actor_traveler: {
          known_facts: [],
          beliefs: [],
          forbidden_knowledge: [],
        },
      },
    },
    temporalHistory: [],
  };

  const synthesized = synthesizeCodex(crossroadsProject);
  const wellEnt = synthesized.find((e) => e.id === 'object_well');
  const deviceEnt = synthesized.find((e) => e.id === 'object_brass_device');

  assert(!!wellEnt, 'Well entity synthesized in codex');
  assert(wellEnt?.current_holder_id === null, 'Well current_holder_id is strictly null (NOT held by traveler)');
  assert(wellEnt?.reliability === 0.0, 'Well reliability is 0% on Beat 1 (1 mention)');
  assert(wellEnt?.distinct_evidence_count === 1, 'Well distinct evidence count is 1');
  assert(wellEnt?.classification_confidence === 'provisional', 'Well is provisional on first mention');

  assert(!!deviceEnt, 'Brass device synthesized in codex');
  assert(deviceEnt?.current_holder_id === null, 'Device current_holder_id is strictly null (NOT held by traveler)');
  assert(deviceEnt?.reliability === 0.0, 'Device reliability is 0% on Beat 1 (1 mention)');

  // -------------------------------------------------------------
  // TEST 5: Contradictory Observations Handling
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Contradictory Observations Handling ---');
  const beat4Claims = extractClaimsFromProse('The device emitted blue light in the dark.', 'device', 4);
  const beat19Claims = extractClaimsFromProse('The device pulsed with crimson light against the frost.', 'device', 19);

  const merged = mergeClaims(beat4Claims, beat19Claims);
  const glowClaims = merged.filter((c) => c.claim.startsWith('emits ') && c.claim.endsWith(' light'));

  assert(glowClaims.length === 2, 'Both contradictory glow observations preserved (not overwritten)');
  assert(glowClaims[0].status === 'contradicted', 'First glow claim marked as contradicted');
  assert(glowClaims[1].status === 'contradicted', 'Second glow claim marked as contradicted');
  assert(glowClaims[0].contradiction_notes !== undefined, 'Contradiction notes attached to first claim');
  assert(glowClaims[1].contradiction_notes !== undefined, 'Contradiction notes attached to second claim');

  // -------------------------------------------------------------
  // TEST 6: Stage 1 & Stage 2 Authorized Context Package Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Stage 1 & Stage 2 Generation Context Package Integration ---');
  const genContext = compileGenerationContext({
    project: crossroadsProject,
    activePovActorId: 'actor_traveler',
    currentPosition: crossroadsProject.currentPosition,
    operation: 'GENERATION',
    narrativeDistance: 'BEAT',
  });

  assert(Array.isArray(genContext.accumulatedCodexEntities), 'accumulatedCodexEntities present in GenerationContext');
  assert(Array.isArray(genContext.continuityConstraints), 'continuityConstraints present in GenerationContext');
  
  const hasInventoryConstraint = genContext.continuityConstraints?.some((c) => c.includes('is resting in the scene (current_holder_id: null)'));
  assert(hasInventoryConstraint, 'Continuity constraint explicitly prevents false holding of resting object');

  // -------------------------------------------------------------
  // TEST 7: Stage 2 Prose Renderer Approved Memory Delivery
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Stage 2 Prose Renderer Approved Memory Delivery ---');
  let capturedStage2UserPrompt = '';
  let capturedStage2SystemPrompt = '';

  const mockProvider = {
    name: 'receipt-bearing-stage2-memory-test-provider',
    isAvailable: () => true,
    generateText: async (params: { operation: string; systemPrompt: string; userPrompt: string }) => {
      capturedStage2SystemPrompt = params.systemPrompt;
      capturedStage2UserPrompt = params.userPrompt;
      return {
        text: 'The traveler observed the quiet well from the edge of the crossroads.',
        receipt: Object.freeze({
          broker: 'Hermes' as const,
          requestId: 'stage2-memory-prompt-test',
          operation: params.operation,
          actualProvider: 'test-provider',
          actualModel: 'test-model',
          fallbackUsed: false,
          fallbackIndex: 0,
          routeAttemptCount: 1,
        }),
      };
    },
  };

  const dummyPlan = {
    beat_type: 'observation' as const,
    primary_actor_id: 'actor_traveler',
    intended_action: 'Observe the stone well and resting brass device',
    permitted_entities_involved: ['actor_traveler', 'object_well', 'object_brass_device'],
    permitted_state_transitions: [],
    knowledge_verified: false,
    reveals_protected: false,
    threads_advanced: [],
    threads_resolved: [],
    distance_budget: 'BEAT' as const,
  };

  const { renderNarrativeProse } = await import('../server/narrativePipeline');
  const renderingEnvelope = compileStage2RenderingEnvelope(genContext, dummyPlan);
  await renderNarrativeProse(renderingEnvelope, dummyPlan, mockProvider);

  assert(capturedStage2UserPrompt.includes('ACCUMULATED STORY CODEX (AUTHORIZED NARRATIVE REALITY)'), 'Stage 2 user prompt contains ACCUMULATED STORY CODEX section');
  assert(capturedStage2UserPrompt.includes('CONTINUITY & INVENTORY CONSTRAINTS'), 'Stage 2 user prompt contains CONTINUITY & INVENTORY CONSTRAINTS section');
  assert(capturedStage2UserPrompt.includes('object_brass_device'), 'Stage 2 receives brass device codex entity');
  assert(capturedStage2UserPrompt.includes('current_holder_id: null'), 'Stage 2 receives resting holder status in continuity constraints');
  assert(capturedStage2SystemPrompt.includes('ACCUMULATED CODEX & AUTHORIZED STORY REALITY'), 'Stage 2 system prompt instructs model on authorized codex memory');
  assert(capturedStage2SystemPrompt.includes('PHYSICAL & SPATIAL CONTINUITY'), 'Stage 2 system prompt instructs model on physical continuity');

  // -------------------------------------------------------------
  // TEST 8: Grammatical Subject Determination for Possession Actions
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Grammatical Subject Determination for Possession Actions ---');
  const multiActorProject: StoryProject = {
    id: 'proj_multi_actor_test',
    title: 'Multi Actor Possession Test',
    description: 'Testing Mara picking up device in Tran POV beat',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 1',
      scene: 'Scene 1',
      beat: 1,
      location_id: 'loc_study',
      location_label: 'The Study',
    },
    activePovActorId: 'actor_tran',
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'Tran watched in silence as Mara picked up the brass device and slipped it into her pocket.',
        povActorId: 'actor_tran',
        locationId: 'loc_study',
        acceptedAt: 1725000000000,
      },
    ],
    actors: [
      {
        id: 'actor_tran',
        identity: { name: 'Tran', working_label: 'tran', aliases: [] },
        roles: { story: ['protagonist'], scene: ['observer'] },
        traits: {},
        current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.5, emotion: 'silent' },
        active_goals: ['Watch Mara'],
        current_location_id: 'loc_study',
        possessions: [],
        isPresent: true,
      },
      {
        id: 'actor_mara',
        identity: { name: 'Mara', working_label: 'mara', aliases: [] },
        roles: { story: ['antagonist'], scene: ['actor'] },
        traits: {},
        current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.9, emotion: 'determined' },
        active_goals: ['Acquire device'],
        current_location_id: 'loc_study',
        possessions: [],
        isPresent: true,
      },
    ],
    objects: [
      {
        id: 'object_brass_device',
        identity: { name: null, working_label: 'brass device', aliases: ['the device'] },
        current_holder_id: null,
        current_location_id: 'loc_study',
        status: 'intact',
        salience: 0.9,
        isPresent: true,
      },
    ],
    locations: [
      {
        id: 'loc_study',
        identity: { name: 'The Study', working_label: 'the study', aliases: [] },
        parent_location_id: null,
        connected_locations: [],
        description_summary: 'A quiet study.',
      },
    ],
    factions: [],
    facts: [],
    threads: [],
    reveals: [],
    mentions: [],
    knowledge: {
      world_truth: [],
      reader_knowledge: [],
      actor_knowledge: {
        actor_tran: {
          known_facts: [],
          beliefs: [],
          forbidden_knowledge: [],
        },
      },
    },
    temporalHistory: [],
  };

  const synthesizedMulti = synthesizeCodex(multiActorProject);
  const deviceInMulti = synthesizedMulti.find((e) => e.id === 'object_brass_device');

  assert(!!deviceInMulti, 'Device synthesized in multi-actor project codex');
  assert(
    deviceInMulti?.current_holder_id === 'actor_mara',
    `Device current_holder_id is correctly assigned to Mara (actor_mara), NOT POV actor Tran (actor_tran). Actual: ${deviceInMulti?.current_holder_id}`
  );

  // Test direct interaction parsing with known actors
  const interactionWithActors = detectEntityInteractions(
    'Tran watched in silence as Mara picked up the brass device and slipped it into her pocket.',
    'brass device',
    'Tran',
    [
      { id: 'actor_tran', name: 'Tran', working_label: 'tran' },
      { id: 'actor_mara', name: 'Mara', working_label: 'mara' },
    ]
  );
  assert(interactionWithActors.isPossession, 'Direct interaction detects possession');
  assert(interactionWithActors.actingSubjectId === 'actor_mara', 'Direct interaction detects actor_mara as acting subject');
  assert(interactionWithActors.actingSubjectLabel === 'Mara', 'Direct interaction detects Mara as acting subject label');

  // -------------------------------------------------------------
  // TEST 9: Reliability Rises from Distinct Information/Claims, NOT Passive Mentions
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Reliability Rises from Distinct Claims, NOT Passive Mentions ---');
  
  // Scenario A: 3 passive mentions with no new information
  const passiveMentionsProject: StoryProject = {
    ...crossroadsProject,
    id: 'proj_passive_test',
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'The brass device glowed.',
        povActorId: 'actor_traveler',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000000000,
      },
      {
        id: 'beat_02',
        beatNumber: 2,
        text: 'He looked again at the brass device.',
        povActorId: 'actor_traveler',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000001000,
      },
      {
        id: 'beat_03',
        beatNumber: 3,
        text: 'He walked past the brass device.',
        povActorId: 'actor_traveler',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000002000,
      },
    ],
  };

  const synthesizedPassive = synthesizeCodex(passiveMentionsProject);
  const passiveDevice = synthesizedPassive.find((e) => e.id === 'object_brass_device');

  assert(!!passiveDevice, 'Device exists in synthesized codex for passive mentions');
  assert(passiveDevice?.mention_count === 3, `Device has 3 mentions. Actual: ${passiveDevice?.mention_count}`);
  assert(
    passiveDevice?.distinct_evidence_count === 1,
    `Device distinct evidence count is strictly 1 after 3 passive mentions without new information. Actual: ${passiveDevice?.distinct_evidence_count}`
  );
  assert(
    passiveDevice?.reliability === 0.0,
    `Device reliability is strictly 0% (0.0) after 3 uninformative mentions. Actual: ${passiveDevice?.reliability}`
  );

  // Scenario B: Subsequent beats provide NEW distinct claims and corroborations
  const informativeProject: StoryProject = {
    ...crossroadsProject,
    id: 'proj_informative_test',
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'The brass device glowed with amber light.',
        povActorId: 'actor_traveler',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000000000,
      },
      {
        id: 'beat_02',
        beatNumber: 2,
        text: 'He touched the cold metal casing of the brass device and discovered three interlocking clockwork gears on the side.',
        povActorId: 'actor_traveler',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000001000,
      },
      {
        id: 'beat_03',
        beatNumber: 3,
        text: 'In the pitch darkness, the device glowed with amber light once more.',
        povActorId: 'actor_traveler',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000002000,
      },
    ],
  };

  const synthesizedInformative = synthesizeCodex(informativeProject);
  const informativeDevice = synthesizedInformative.find((e) => e.id === 'object_brass_device');

  assert(!!informativeDevice, 'Informative device exists in synthesized codex');
  assert(
    (informativeDevice?.distinct_evidence_count || 0) >= 3,
    `Informative device distinct evidence count rises with new claims and corroborations. Actual: ${informativeDevice?.distinct_evidence_count}`
  );
  assert(
    (informativeDevice?.reliability || 0) >= 0.45,
    `Informative device reliability rises to at least 45% (0.45) with new claims and corroborations. Actual: ${informativeDevice?.reliability}`
  );

  // -------------------------------------------------------------
  // TEST 10: Open-World Novel Entity Discovery from Raw Prose (No Pre-Populated Registries)
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Open-World Novel Entity Discovery from Raw Prose ---');
  
  const rawProseProject: StoryProject = {
    id: 'proj_open_world_test',
    title: 'The Moth and the Well',
    description: 'A traveler arrives at an uncharted ruins.',
    activePovActorId: 'actor_traveler',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 1',
      scene: 'Scene 1',
      beat: 2,
      location_id: 'loc_unknown',
      location_label: 'Unknown Ruins',
    },
    actors: [
      {
        id: 'actor_traveler',
        identity: {
          name: 'The Traveler',
          working_label: 'traveler',
          aliases: [],
        },
        roles: { story: ['protagonist'], scene: ['active'] },
        traits: {},
        current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.2, emotion: 'watchful' },
        active_goals: ['Explore'],
        current_location_id: 'loc_unknown',
        possessions: [],
        isPresent: true,
        is_author_locked: false,
      },
    ],
    objects: [], // STRICTLY EMPTY: No pre-created objects
    locations: [], // STRICTLY EMPTY: No pre-created locations
    factions: [], // STRICTLY EMPTY: No pre-created factions
    codexEntities: [], // STRICTLY EMPTY: No pre-existing codex records
    facts: [],
    threads: [],
    reveals: [],
    mentions: [],
    knowledge: {
      world_truth: [],
      reader_knowledge: [],
      actor_knowledge: {},
    },
    temporalHistory: [],
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'A silver moth landed on the window. In the courtyard, the stone well stood in silence.',
        povActorId: 'actor_traveler',
        locationId: 'loc_unknown',
        acceptedAt: 1725000000000,
      },
      {
        id: 'beat_02',
        beatNumber: 2,
        text: 'The silver moth fluttered into the air and circled the stone well.',
        povActorId: 'actor_traveler',
        locationId: 'loc_unknown',
        acceptedAt: 1725000001000,
      },
    ],
  };

  // Synthesize on Beat 1 only
  const beat1OnlyProject: StoryProject = {
    ...rawProseProject,
    manuscript: [rawProseProject.manuscript[0]],
  };
  const synthesizedBeat1 = synthesizeCodex(beat1OnlyProject);
  const mothBeat1 = synthesizedBeat1.find(
    (e) => e.working_label.toLowerCase().includes('moth') || e.id.includes('moth')
  );
  assert(!!mothBeat1, 'Prose-introduced "silver moth" is discovered on Beat 1');
  assert(mothBeat1?.classification_confidence === 'provisional', 'Discovered moth begins with provisional classification confidence on first encounter');
  assert(mothBeat1?.reliability === 0.0, 'Discovered moth starts at 0% reliability on first encounter');

  // Synthesize on full 2 beats
  const synthesizedRaw = synthesizeCodex(rawProseProject);
  
  const mothEntity = synthesizedRaw.find(
    (e) => e.working_label.toLowerCase().includes('moth') || e.id.includes('moth')
  );
  const wellEntity = synthesizedRaw.find(
    (e) => e.working_label.toLowerCase().includes('well') || e.id.includes('well')
  );

  assert(!!mothEntity, 'Prose-introduced "silver moth" is autonomously discovered as a codex entity without pre-populated registry');
  assert(mothEntity?.candidate_types.includes('creature') || mothEntity?.entity_type === 'creature', 'Discovered moth is classified with creature candidate type');
  assert(mothEntity?.mention_count === 2, `Discovered moth mention count tracks across beats (expected 2, got ${mothEntity?.mention_count})`);
  assert(mothEntity?.first_seen === 'Beat 1 (T1)', `Discovered moth first seen is Beat 1 (got ${mothEntity?.first_seen})`);

  assert(!!wellEntity, 'Prose-introduced "stone well" is autonomously discovered as a codex entity without pre-populated registry');
  assert(wellEntity?.candidate_types.includes('structure'), 'Discovered well candidate types include structure');
  assert(wellEntity?.mention_count === 2, `Discovered well mention count is 2 (got ${wellEntity?.mention_count})`);
  assert(wellEntity?.current_holder_id === null, 'Discovered well is not held by traveler');

  // -------------------------------------------------------------
  // TEST 11: Progressive Identity Evidence & Autonomous Alias Merging with Existing Actor
  // -------------------------------------------------------------
  console.log('\n--- TEST 11: Progressive Identity Evidence & Autonomous Alias Merging ---');

  const identityMergeProject: StoryProject = {
    id: 'proj_identity_merge',
    title: 'The Cloaked Companion',
    description: 'A story of unmasking and revealed identities.',
    activePovActorId: 'actor_traveler',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 1',
      scene: 'Scene 1',
      beat: 2,
      location_id: 'loc_courtyard',
      location_label: 'Ruined Courtyard',
    },
    actors: [
      {
        id: 'actor_traveler',
        identity: {
          name: 'The Traveler',
          working_label: 'traveler',
          aliases: [],
        },
        roles: { story: ['protagonist'], scene: ['active'] },
        traits: {},
        current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.2, emotion: 'watchful' },
        active_goals: ['Investigate'],
        current_location_id: 'loc_courtyard',
        possessions: [],
        isPresent: true,
        is_author_locked: false,
      },
      {
        id: 'actor_mara',
        identity: {
          name: 'Mara',
          working_label: 'Mara',
          aliases: [], // NO alias pre-attached
        },
        roles: { story: ['companion'], scene: ['active'] },
        traits: {},
        current_state: { fatigue: 0.0, fear: 0.0, certainty: 0.8, emotion: 'determined' },
        active_goals: ['Make contact'],
        current_location_id: 'loc_courtyard',
        possessions: [],
        isPresent: true,
        is_author_locked: false,
      },
    ],
    objects: [],
    locations: [],
    factions: [],
    codexEntities: [],
    facts: [],
    threads: [],
    reveals: [],
    mentions: [],
    knowledge: {
      world_truth: [],
      reader_knowledge: [],
      actor_knowledge: {},
    },
    temporalHistory: [],
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'A hooded woman stepped out from behind the crumbling archway and watched the traveler in silence.',
        povActorId: 'actor_traveler',
        locationId: 'loc_courtyard',
        acceptedAt: 1725000000000,
      },
      {
        id: 'beat_02',
        beatNumber: 2,
        text: 'The hooded woman pulled back her cloak. "My name is Mara," said the hooded woman.',
        povActorId: 'actor_traveler',
        locationId: 'loc_courtyard',
        acceptedAt: 1725000001000,
      },
    ],
  };

  // Beat 1: Hooded woman exists as provisional entity
  const synthesizedIdBeat1 = synthesizeCodex({
    ...identityMergeProject,
    manuscript: [identityMergeProject.manuscript[0]],
  });
  const provisionalHooded = synthesizedIdBeat1.find(
    (e) => e.working_label.toLowerCase().includes('hooded')
  );
  assert(!!provisionalHooded, 'Beat 1: Hooded woman enters memory as a provisional discovered entity');
  assert(provisionalHooded?.classification_confidence === 'provisional', 'Beat 1: Hooded woman begins with provisional classification confidence');

  // Beat 2: Identity disclosure occurs -> Autonomous merge into actor_mara
  const synthesizedIdBeat2 = synthesizeCodex(identityMergeProject);
  
  const resolvedMara = synthesizedIdBeat2.find((e) => e.id === 'actor_mara');
  assert(!!resolvedMara, 'Resolved Mara entity exists in synthesized codex');
  assert(
    resolvedMara?.aliases.some((a) => a.toLowerCase().includes('hooded woman')),
    `Mara's aliases autonomously absorbed "hooded woman". Actual aliases: [${resolvedMara?.aliases.join(', ')}]`
  );
  assert(
    resolvedMara?.classification_confidence === 'resolved',
    'Mara classification confidence is marked resolved'
  );
  
  const idResolutionClaim = resolvedMara?.claims.find(
    (c) => c.claim.includes('Identified as Mara') || c.claim.includes('formerly recognized as')
  );
  assert(!!idResolutionClaim, 'Identity resolution claim recorded with evidence snippet');
  assert(
    idResolutionClaim?.confidence !== undefined && idResolutionClaim.confidence >= 0.9,
    `Identity resolution claim persists numeric confidence value (Expected >= 0.9, Actual: ${idResolutionClaim?.confidence})`
  );
  
  // Provisional duplicate is cleanly removed
  const leftoverProvisional = synthesizedIdBeat2.find(
    (e) => e.id !== 'actor_mara' && e.working_label.toLowerCase() === 'hooded woman'
  );
  assert(!leftoverProvisional, 'Provisional entity is merged and does not persist as a duplicate dangling entity');

  // -------------------------------------------------------------
  // TEST 12: Open-World Identity Discovery & In-Place Resolution (No Prior Actor)
  // -------------------------------------------------------------
  console.log('\n--- TEST 12: Open-World Identity Discovery & In-Place Canonical Resolution ---');

  const openWorldIdentityProject: StoryProject = {
    ...identityMergeProject,
    actors: [identityMergeProject.actors[0]], // ONLY traveler, NO Mara in actor list
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'A masked stranger blocked the doorway.',
        povActorId: 'actor_traveler',
        locationId: 'loc_courtyard',
        acceptedAt: 1725000000000,
      },
      {
        id: 'beat_02',
        beatNumber: 2,
        text: 'The masked stranger, Locke, lowered his blade with a weary sigh.',
        povActorId: 'actor_traveler',
        locationId: 'loc_courtyard',
        acceptedAt: 1725000001000,
      },
    ],
  };

  const synthesizedOpenWorld = synthesizeCodex(openWorldIdentityProject);
  const resolvedLocke = synthesizedOpenWorld.find(
    (e) => e.working_label === 'Locke' || e.canonical_label === 'Locke'
  );

  assert(!!resolvedLocke, 'Provisional stranger in open-world prose autonomously resolves canonical label to "Locke"');
  assert(
    resolvedLocke?.aliases.some((a) => a.toLowerCase().includes('masked stranger')),
    `Resolved Locke entity retains "masked stranger" as an alias. Actual: [${resolvedLocke?.aliases.join(', ')}]`
  );
  assert(resolvedLocke?.classification_confidence === 'resolved', 'Locke classification is resolved');
  assert(resolvedLocke?.entity_type === 'actor', 'Locke entity type is resolved to actor');
  const lockeIdClaim = resolvedLocke?.claims.find((c) => c.claim.includes('Identified as Locke'));
  assert(!!lockeIdClaim, 'Locke has in-place identity claim');
  assert(
    lockeIdClaim?.confidence !== undefined && lockeIdClaim.confidence >= 0.9,
    `Locke in-place identity claim persists confidence value (Actual: ${lockeIdClaim?.confidence})`
  );

  // -------------------------------------------------------------
  // TEST 13: Universal Open-World Lexicon-Free Entity Extraction
  // -------------------------------------------------------------
  console.log('\n--- TEST 13: Universal Open-World Lexicon-Free Entity Extraction ---');

  const lexiconFreeProse = `
    A turquoise thaumatrope rested on the dais.
    Nearby, a luminous xenolith hummed with cold light.
    A six-legged myrmidon scuttled across the flagstones.
    Master Vane watched the sky from the terrace.
  `;

  const extractedOpenWorld = extractNovelEntityCandidates(lexiconFreeProse, new Set(['dais', 'terrace', 'flagstones', 'sky']));
  
  const thaumatrope = extractedOpenWorld.find((c) => c.workingLabel.includes('thaumatrope'));
  assert(!!thaumatrope, 'Discovers unlisted noun "turquoise thaumatrope" without core lexicon entry');
  assert(thaumatrope?.candidateTypes.includes('object'), 'Classifies thaumatrope as object candidate');

  const xenolith = extractedOpenWorld.find((c) => c.workingLabel.includes('xenolith'));
  assert(!!xenolith, 'Discovers unlisted noun "luminous xenolith" without core lexicon entry');

  const myrmidon = extractedOpenWorld.find((c) => c.workingLabel.includes('myrmidon'));
  assert(!!myrmidon, 'Discovers unlisted animate noun "six-legged myrmidon" without core lexicon entry');
  assert(myrmidon?.candidateTypes.includes('creature'), 'Classifies scuttling myrmidon with creature candidate type');

  const masterVane = extractedOpenWorld.find((c) => c.workingLabel === 'Master Vane');
  assert(!!masterVane, 'Discovers capitalized proper entity "Master Vane"');
  assert(masterVane?.candidateTypes.includes('actor'), 'Classifies Master Vane with actor candidate type');

  // -------------------------------------------------------------
  // TEST 14: Pronoun Coreference & Possession Attribution Safety
  // -------------------------------------------------------------
  console.log('\n--- TEST 14: Pronoun Coreference & Possession Attribution Safety ---');

  // Scenario A: Backward coreference ("Mara stepped forward. She picked up the brass device." in Tran's POV)
  const corefProjectMara: StoryProject = {
    ...crossroadsProject,
    actors: [
      {
        id: 'actor_tran',
        identity: { name: 'Tran', working_label: 'Tran', aliases: [] },
        roles: { story: ['protagonist'], scene: ['observer'] },
        traits: {},
        current_state: { fatigue: 0, fear: 0, certainty: 0, emotion: 'neutral' },
        active_goals: [],
        current_location_id: 'loc_crossroads',
        possessions: [],
        isPresent: true,
      },
      {
        id: 'actor_mara',
        identity: { name: 'Mara', working_label: 'Mara', aliases: [] },
        roles: { story: ['ally'], scene: ['actor'] },
        traits: {},
        current_state: { fatigue: 0, fear: 0, certainty: 0, emotion: 'neutral' },
        active_goals: [],
        current_location_id: 'loc_crossroads',
        possessions: [],
        isPresent: true,
      },
    ],
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'Mara stepped forward into the glow. She picked up the brass device and smiled.',
        povActorId: 'actor_tran',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000000000,
      },
    ],
  };

  const synthesizedMaraCoref = synthesizeCodex(corefProjectMara);
  const deviceMaraCoref = synthesizedMaraCoref.find((e) => e.working_label.toLowerCase().includes('device'));
  assert(!!deviceMaraCoref, 'Brass device exists in synthesized codex for coreference test');
  assert(
    deviceMaraCoref?.current_holder_id === 'actor_mara',
    `Pronoun "She" correctly resolves backward to Mara (actor_mara), NOT Tran (actor_tran). Actual: ${deviceMaraCoref?.current_holder_id}`
  );

  // Scenario B: Unresolved 3rd-person pronoun ("She picked up the brass device." in Tran's POV, NO female actor)
  const corefProjectUnresolvedShe: StoryProject = {
    ...crossroadsProject,
    actors: [
      {
        id: 'actor_tran',
        identity: { name: 'Tran', working_label: 'Tran', aliases: [] },
        roles: { story: ['protagonist'], scene: ['observer'] },
        traits: {},
        current_state: { fatigue: 0, fear: 0, certainty: 0, emotion: 'neutral' },
        active_goals: [],
        current_location_id: 'loc_crossroads',
        possessions: [],
        isPresent: true,
      },
    ],
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'She picked up the brass device and vanished into the fog.',
        povActorId: 'actor_tran',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000000000,
      },
    ],
  };

  const synthesizedUnresolved = synthesizeCodex(corefProjectUnresolvedShe);
  const deviceUnresolved = synthesizedUnresolved.find((e) => e.working_label.toLowerCase().includes('device'));
  assert(!!deviceUnresolved, 'Brass device exists in synthesized codex for unresolved pronoun test');
  assert(
    deviceUnresolved?.current_holder_id !== 'actor_tran',
    `Unresolved "She" does NOT falsely assign device to POV actor Tran. Actual: ${deviceUnresolved?.current_holder_id}`
  );

  // Scenario C: Explicit 1st-person ("I picked up the brass device." in Tran's POV)
  const firstPersonProject: StoryProject = {
    ...crossroadsProject,
    actors: [
      {
        id: 'actor_tran',
        identity: { name: 'Tran', working_label: 'Tran', aliases: [] },
        roles: { story: ['protagonist'], scene: ['observer'] },
        traits: {},
        current_state: { fatigue: 0, fear: 0, certainty: 0, emotion: 'neutral' },
        active_goals: [],
        current_location_id: 'loc_crossroads',
        possessions: [],
        isPresent: true,
      },
    ],
    manuscript: [
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'I reached down and picked up the brass device.',
        povActorId: 'actor_tran',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000000000,
      },
    ],
  };

  const synthesizedFirstPerson = synthesizeCodex(firstPersonProject);
  const deviceFirstPerson = synthesizedFirstPerson.find((e) => e.working_label.toLowerCase().includes('device'));
  assert(
    deviceFirstPerson?.current_holder_id === 'actor_tran',
    `Explicit 1st-person pickup correctly assigns device to POV actor Tran. Actual: ${deviceFirstPerson?.current_holder_id}`
  );

  // -------------------------------------------------------------
  // TEST 15: Occurrence & Identity Disambiguation Across Narrative
  // -------------------------------------------------------------
  console.log('\n--- TEST 15: Occurrence & Identity Disambiguation Across Narrative ---');

  const disambiguationProject: StoryProject = {
    id: 'proj_disambiguation_test',
    title: 'The Multi-Instance Disambiguation Novel',
    description: 'Testing multiple guards and distinct hooded women instances',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 1',
      scene: 'Scene 1',
      beat: 1,
      location_id: 'loc_crossroads',
      location_label: 'The Crossroads',
    },
    activePovActorId: 'actor_tran',
    actors: [
      {
        id: 'actor_tran',
        identity: { name: 'Tran', working_label: 'Tran', aliases: [] },
        roles: { story: ['protagonist'], scene: ['observer'] },
        traits: {},
        current_state: { fatigue: 0, fear: 0, certainty: 0, emotion: 'neutral' },
        active_goals: [],
        current_location_id: 'loc_crossroads',
        possessions: [],
        isPresent: true,
      },
      {
        id: 'actor_mara',
        identity: { name: 'Mara', working_label: 'Mara', aliases: [] },
        roles: { story: ['ally'], scene: ['actor'] },
        traits: {},
        current_state: { fatigue: 0, fear: 0, certainty: 0, emotion: 'neutral' },
        active_goals: [],
        current_location_id: 'loc_crossroads',
        possessions: [],
        isPresent: true,
      },
    ],
    locations: [
      {
        id: 'loc_crossroads',
        identity: { name: 'The Crossroads', working_label: 'Crossroads', aliases: [] },
        parent_location_id: null,
        connected_locations: [],
        description_summary: 'A quiet crossing',
      },
      {
        id: 'loc_river',
        identity: { name: 'The River Ferry', working_label: 'River Ferry', aliases: [] },
        parent_location_id: null,
        connected_locations: [],
        description_summary: 'A rushing river crossing',
      },
      {
        id: 'loc_dungeon',
        identity: { name: 'The Iron Dungeon', working_label: 'Iron Dungeon', aliases: [] },
        parent_location_id: null,
        connected_locations: [],
        description_summary: 'Dark subterranean cells',
      },
    ],
    objects: [],
    factions: [],
    facts: [],
    threads: [],
    reveals: [],
    mentions: [],
    knowledge: {
      world_truth: [],
      reader_knowledge: [],
      actor_knowledge: {},
    },
    temporalHistory: [],
    manuscript: [
      // Beat 1: First guard at crossroads
      {
        id: 'beat_01',
        beatNumber: 1,
        text: 'Tran arrived at the road. A guard stood by the ancient milestone, holding a spear.',
        povActorId: 'actor_tran',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000000000,
      },
      // Beat 2: Continuity with the same guard at crossroads
      {
        id: 'beat_02',
        beatNumber: 2,
        text: 'The guard nodded curtly and checked the wagon papers.',
        povActorId: 'actor_tran',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000100000,
      },
      // Beat 3: A hooded woman at crossroads reveals she is Mara
      {
        id: 'beat_03',
        beatNumber: 3,
        text: 'A hooded woman stepped out of the shadows. "My name is Mara," said the hooded woman with a soft smile.',
        povActorId: 'actor_tran',
        locationId: 'loc_crossroads',
        acceptedAt: 1725000200000,
      },
      // Beat 4: Distinct guards at a different location (River Ferry)
      {
        id: 'beat_04',
        beatNumber: 4,
        text: 'Down at the ferry, a guard inspected the boat ropes. Another guard watched the dark water from the dock.',
        povActorId: 'actor_tran',
        locationId: 'loc_river',
        acceptedAt: 1725000300000,
      },
      // Beat 5: A distinct, separate hooded woman at a completely different location (Dungeon)
      {
        id: 'beat_05',
        beatNumber: 5,
        text: 'Deep in the iron dungeon, a hooded woman whispered through the cell bars into the darkness.',
        povActorId: 'actor_tran',
        locationId: 'loc_dungeon',
        acceptedAt: 1725000400000,
      },
    ],
  };

  const synthesizedDisambiguation = synthesizeCodex(disambiguationProject);

  // 1. Verify guard instances
  const guardEntities = synthesizedDisambiguation.filter((e) => e.working_label.toLowerCase() === 'guard');
  assert(guardEntities.length === 3, `Discovers 3 distinct guard instances across scenes/occurrences (Actual: ${guardEntities.length})`);

  const guard1 = guardEntities.find((e) => e.id === 'ent_guard');
  const guard2 = guardEntities.find((e) => e.id === 'ent_guard_2');
  const guard3 = guardEntities.find((e) => e.id === 'ent_guard_3');

  assert(!!guard1, 'Guard 1 (ent_guard) exists');
  assert(!!guard2, 'Guard 2 (ent_guard_2) exists');
  assert(!!guard3, 'Guard 3 (ent_guard_3) exists');

  assert(guard1?.scope_location_id === 'loc_crossroads', 'Guard 1 scoped to Crossroads');
  assert(guard1?.instance_index === 1, 'Guard 1 has instance_index 1');
  assert(guard1?.mention_count === 2, `Guard 1 has 2 mentions via continuity (Actual: ${guard1?.mention_count})`);

  assert(guard2?.scope_location_id === 'loc_river', 'Guard 2 scoped to River Ferry');
  assert(guard2?.instance_index === 2, 'Guard 2 has instance_index 2');

  assert(guard3?.scope_location_id === 'loc_river', 'Guard 3 scoped to River Ferry ("another guard")');
  assert(guard3?.instance_index === 3, 'Guard 3 has instance_index 3');

  // 2. Verify hooded woman disambiguation and merge isolation
  const maraEntity = synthesizedDisambiguation.find((e) => e.id === 'actor_mara' || e.canonical_label === 'Mara');
  assert(!!maraEntity, 'Mara entity exists in codex');
  assert(
    maraEntity?.aliases.some((a) => a.toLowerCase().includes('hooded woman')),
    'Mara contains "hooded woman" alias from Beat 3 identity disclosure at Crossroads'
  );

  // The second hooded woman in Beat 5 at the dungeon MUST NOT collapse into Mara!
  const dungeonHoodedWoman = synthesizedDisambiguation.find((e) => e.id === 'ent_hooded_woman_2');
  assert(!!dungeonHoodedWoman, 'Second hooded woman at Iron Dungeon (ent_hooded_woman_2) exists as a distinct entity');
  assert(
    dungeonHoodedWoman?.scope_location_id === 'loc_dungeon',
    'Second hooded woman is correctly scoped to Iron Dungeon'
  );
  assert(
    dungeonHoodedWoman?.canonical_label !== 'Mara',
    'Second hooded woman is NOT falsely collapsed into Mara'
  );
  assert(
    dungeonHoodedWoman?.classification_confidence === 'provisional',
    'Second hooded woman remains provisional'
  );

  console.log('\n🎉 ALL PROGRESSIVE NARRATIVE MEMORY & CODEX TESTS PASSED!\n');
}

// Run tests if executed directly
if (process.argv[1]?.endsWith('codexProgressiveMemory.test.ts')) {
  await runCodexTests();
}
