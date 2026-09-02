import { StoryProject, RewriteContract } from '../types';

export const REWRITE_PRESETS: RewriteContract[] = [
  {
    presetName: 'Dark Suspense & Tension',
    modify: ['Atmosphere', 'Sensory tension', 'Sentence cadence', 'Shadow & auditory details'],
    preserve: ['Events', 'Event order', 'Actors present', 'Location', 'Outcome', 'Dialogue intent'],
    forbid: ['New major events', 'New actors', 'Premature conflict resolution', 'Changed knowledge state'],
  },
  {
    presetName: 'Poetic & Reflective',
    modify: ['Lyrical prose rhythm', 'Internal emotional resonance', 'Metaphorical depth'],
    preserve: ['Chronology', 'Physical actions', 'Spoken dialogue', 'Character possession state'],
    forbid: ['Hallucinated flashback canon', 'Altered character motivations', 'Unestablished lore'],
  },
  {
    presetName: 'Rapid Action & Minimalist',
    modify: ['Brisk sentence velocity', 'Kinetic verbs', 'Streamlined exposition'],
    preserve: ['Sequential beat structure', 'Damage/fatigue state', 'Spatial geometry', 'Ending state'],
    forbid: ['Teleportation', 'Skipping pivotal defensive beats', 'Instant victory'],
  },
  {
    presetName: 'Close Third Person Intimacy',
    modify: ['Subjective sensory filtering', 'Immediate POV cognitive reactions'],
    preserve: ['External world facts', 'Other actors non-verbal cues', 'Knowledge boundaries'],
    forbid: ['Omniscient narration', 'Mind-reading secondary actors', 'Revealing locked facts'],
  },
];

export const DEFAULT_PROJECTS: StoryProject[] = [
  {
    id: 'proj_clockmaker',
    title: "The Clockmaker's Vault",
    description: 'A noir mystery of mechanical contrivances, locked secrets, and strict knowledge boundaries.',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 2: The Gearbox Enigma',
      scene: 'Scene 3: The Basement Laboratory',
      beat: 4,
      location_id: 'location_001',
      location_label: 'The Subterranean Vault Workshop',
    },
    activePovActorId: 'actor_001',
    manuscript: [
      {
        id: 'beat_001',
        beatNumber: 1,
        text: 'The heavy iron door swung inward with the slow groan of unoiled hinges. Master Locke stepped over the threshold, his lantern casting ribbed shadows across workbenches cluttered with brass escapements and dormant clockwork limbs.',
        povActorId: 'actor_001',
        locationId: 'location_001',
        acceptedAt: 1725000000000,
      },
      {
        id: 'beat_002',
        beatNumber: 2,
        text: 'Across the chamber, Mara kept one hand resting on the hilt of her pry-bar. "The regulator is still warm," she murmured, nodding toward the central pendulum. "Someone was here before the streetlamps were lit."',
        povActorId: 'actor_001',
        locationId: 'location_001',
        acceptedAt: 1725000050000,
      },
      {
        id: 'beat_003',
        beatNumber: 3,
        text: 'Locke bent down near the shattered glass display. The velvet cushion was empty; the Astrolabe of Solace was gone, leaving only three copper filings on the polished mahogany.',
        povActorId: 'actor_001',
        locationId: 'location_001',
        acceptedAt: 1725000100000,
      },
    ],
    actors: [
      {
        id: 'actor_001',
        identity: {
          name: 'Master Locke',
          working_label: 'the horologist investigator',
          aliases: ['Locke', 'The Watchmaker'],
        },
        roles: {
          story: ['protagonist', 'investigator'],
          scene: ['examiner', 'POV'],
        },
        traits: {
          methodical: 0.9,
          cautious: 0.85,
          physical_combat: 0.2,
        },
        current_state: {
          fatigue: 0.35,
          fear: 0.2,
          certainty: 0.4,
          emotion: 'perplexed and hyper-alert',
        },
        active_goals: ['Locate the Astrolabe of Solace', 'Identify how the vault was breached from within'],
        current_location_id: 'location_001',
        possessions: ['object_002'], // Lantern
        isPresent: true,
      },
      {
        id: 'actor_002',
        identity: {
          name: 'Mara Vane',
          working_label: 'the locksmith companion',
          aliases: ['Mara', 'The Wirecutter'],
        },
        roles: {
          story: ['companion', 'locksmith'],
          scene: ['security_overwatch'],
        },
        traits: {
          pragmatic: 0.8,
          suspicious: 0.7,
          agility: 0.85,
        },
        current_state: {
          fatigue: 0.25,
          fear: 0.15,
          certainty: 0.6,
          emotion: 'vigilant',
        },
        active_goals: ['Guard the sole exit', 'Ensure no traps remain primed'],
        current_location_id: 'location_001',
        possessions: ['object_003'], // Pry-bar & Tension Pick
        isPresent: true,
      },
      {
        id: 'actor_003',
        identity: {
          name: 'The Gilded Automaton',
          working_label: 'the hooded courier',
          aliases: ['Unit-09', 'The Hooded Shadow'],
        },
        roles: {
          story: ['antagonist'],
          scene: ['escaped_target'],
        },
        traits: {
          silent: 0.95,
          relentless: 0.9,
        },
        current_state: {
          fatigue: 0.0,
          fear: 0.0,
          certainty: 0.9,
          emotion: 'mechanical determination',
        },
        active_goals: ['Deliver the Astrolabe to the Docks'],
        current_location_id: 'location_002', // Spatially separated in City Conduit!
        possessions: ['object_001'], // Holds the Astrolabe
        isPresent: false,
      },
    ],
    objects: [
      {
        id: 'object_001',
        identity: {
          name: 'The Astrolabe of Solace',
          working_label: 'the missing brass relic',
          aliases: ['The Solace Device', 'The Relic'],
        },
        current_holder_id: 'actor_003',
        current_location_id: 'location_002',
        status: 'missing',
        salience: 0.95,
        isPresent: false,
      },
      {
        id: 'object_002',
        identity: {
          name: "Locke's Bullseye Lantern",
          working_label: 'the brass lantern',
          aliases: ['Lantern'],
        },
        current_holder_id: 'actor_001',
        current_location_id: 'location_001',
        status: 'intact',
        salience: 0.4,
        isPresent: true,
      },
      {
        id: 'object_003',
        identity: {
          name: "Mara's Tension Pick",
          working_label: 'the tempered pry-bar',
          aliases: ['Pick', 'Pry-bar'],
        },
        current_holder_id: 'actor_002',
        current_location_id: 'location_001',
        status: 'intact',
        salience: 0.35,
        isPresent: true,
      },
    ],
    locations: [
      {
        id: 'location_001',
        identity: {
          name: 'The Subterranean Vault Workshop',
          working_label: 'the subterranean vault',
          aliases: ['The Vault', 'Basement Lab'],
        },
        parent_location_id: null,
        connected_locations: ['location_002'],
        description_summary: 'A reinforced damp masonry cellar lined with ticking escapements and high stone workbenches.',
      },
      {
        id: 'location_002',
        identity: {
          name: 'The East Steam Conduit',
          working_label: 'the subterranean canal pipe',
          aliases: ['The Conduit', 'City Pipe Route'],
        },
        parent_location_id: null,
        connected_locations: ['location_001'],
        description_summary: 'An echoing industrial runoff tunnel leading directly to the foggy river harbor.',
      },
    ],
    factions: [
      {
        id: 'faction_001',
        identity: {
          name: 'The Clockmakers Guild',
          working_label: 'the guild masters',
          aliases: ['Guild of Chronometry'],
        },
        members: ['actor_001'],
        influence: 'Dominant civil authority over timekeeping and vault fabrication.',
      },
    ],
    facts: [
      {
        id: 'fact_001',
        statement: 'The vault display case was shattered from the inside, indicating internal activation.',
        status: 'established',
        confidence: 0.98,
        provenance: {
          chapter: 'Chapter 2',
          scene: 'Scene 3',
          beat: 3,
          evidence_quote: 'The velvet cushion was empty... glass lay scattered outward.',
        },
      },
      {
        id: 'fact_002',
        statement: 'Actor_003 carries the Astrolabe toward the East Steam Conduit.',
        status: 'established',
        confidence: 1.0,
        provenance: {
          chapter: 'Chapter 2',
          scene: 'Scene 1',
        },
      },
      {
        id: 'fact_003',
        statement: 'The Astrolabe contains an encoded cipher revealing the Lord Mayor as the patron.',
        status: 'established',
        confidence: 1.0,
        provenance: {
          chapter: 'World Secret Archive',
        },
      },
    ],
    threads: [
      {
        id: 'thread_001',
        label: 'Recover the Astrolabe of Solace before midnight chimes',
        status: 'open',
        importance: 'critical',
        introduced_in: 'Chapter 1: Beat 1',
        resolution_allowed: false,
      },
      {
        id: 'thread_002',
        label: 'Determine who possessed the master bypass key to the display cylinder',
        status: 'open',
        importance: 'major',
        introduced_in: 'Chapter 2: Beat 3',
        resolution_allowed: false,
      },
    ],
    reveals: [
      {
        id: 'reveal_001',
        fact_id: 'fact_003',
        label: 'The Lord Mayor is the clandestine patron of the heist',
        status: 'locked',
        allowed_before_unlock: ['foreshadow', 'faint crest impression on velvet wax', 'subtle scent of pipe tobacco'],
        forbidden_before_unlock: ['direct_explanation', 'naming the Mayor', 'actor_realization'],
      },
    ],
    mentions: [
      {
        id: 'mention_001',
        entity_id: 'object_001',
        passage_text: 'the Astrolabe of Solace was gone, leaving only three copper filings',
        scene_id: 'scene_003',
        beat_index: 3,
        timestamp_label: 'T1: Scene 3 Beat 3',
        confidence: 0.98,
        evidence_notes: ['Exact physical mention of missing target relic in display.'],
        extracted_relationships: [{ type: 'located_at', target_id: 'location_001' }],
      },
      {
        id: 'mention_002',
        entity_id: 'actor_001',
        passage_text: 'Master Locke stepped over the threshold, his lantern casting ribbed shadows',
        scene_id: 'scene_003',
        beat_index: 1,
        timestamp_label: 'T1: Scene 3 Beat 1',
        confidence: 1.0,
        evidence_notes: ['Protagonist entry into vault.'],
        extracted_relationships: [
          { type: 'located_at', target_id: 'location_001' },
          { type: 'possessed_by', target_id: 'object_002' },
        ],
      },
    ],
    knowledge: {
      world_truth: ['fact_001', 'fact_002', 'fact_003'],
      reader_knowledge: ['fact_001'],
      actor_knowledge: {
        actor_001: {
          known_facts: ['fact_001'],
          beliefs: ['The thief must have escaped through the roof hatch (FALSE BELIEF)'],
          forbidden_knowledge: ['fact_002', 'fact_003'],
        },
        actor_002: {
          known_facts: ['fact_001'],
          beliefs: ['Mara believes Locke is holding back information about the guild key'],
          forbidden_knowledge: ['fact_003'],
        },
        actor_003: {
          known_facts: ['fact_002', 'fact_003'],
          beliefs: ['Target waypoint will be guarded at the docks'],
          forbidden_knowledge: [],
        },
      },
    },
    temporalHistory: [
      {
        time_index: 'T1',
        label: 'Vault Discovery',
        beat_ref: 'Beat 3',
        entity_locations: {
          actor_001: 'location_001',
          actor_002: 'location_001',
          actor_003: 'location_002',
          object_001: 'location_002',
          object_002: 'location_001',
        },
        object_possessions: {
          object_001: 'actor_003',
          object_002: 'actor_001',
          object_003: 'actor_002',
        },
        actor_states: {
          actor_001: { fatigue: 0.35, emotion: 'perplexed' },
          actor_002: { fatigue: 0.25, emotion: 'vigilant' },
        },
        unlocked_reveals: [],
      },
    ],
  },
  {
    id: 'proj_archives',
    title: 'Whispers in the Sunken Archive',
    description: 'An academic espionage story exploring forgotten codices and strict point-of-view isolation.',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 1: The Index of Redacted Scholars',
      scene: 'Scene 2: The Scriptorium Gallery',
      beat: 2,
      location_id: 'location_010',
      location_label: 'The Scriptorium Gallery',
    },
    activePovActorId: 'actor_010',
    manuscript: [
      {
        id: 'beat_101',
        beatNumber: 1,
        text: 'The reading lamps flickered as a sea-breeze surged through the high clerestory windows. Scribe Aaron smoothed the brittle vellum scroll with gloved fingertips.',
        povActorId: 'actor_010',
        locationId: 'location_010',
        acceptedAt: 1725000000000,
      },
      {
        id: 'beat_102',
        beatNumber: 2,
        text: 'Beside the catalog podium, the curator was nowhere to be found. Only his ledger remained open, ink still wet on the entry for the forbidden 7th Folio.',
        povActorId: 'actor_010',
        locationId: 'location_010',
        acceptedAt: 1725000050000,
      },
    ],
    actors: [
      {
        id: 'actor_010',
        identity: {
          name: 'Scribe Aaron',
          working_label: 'the pale archivist',
          aliases: ['Aaron', 'The Junior Scribe'],
        },
        roles: {
          story: ['protagonist'],
          scene: ['reader_investigator'],
        },
        traits: { erudite: 0.9, timid: 0.7 },
        current_state: { fatigue: 0.2, fear: 0.4, certainty: 0.3, emotion: 'apprehensive curiosity' },
        active_goals: ['Decipher the margin notes before sunrise'],
        current_location_id: 'location_010',
        possessions: ['object_010'],
        isPresent: true,
      },
    ],
    objects: [
      {
        id: 'object_010',
        identity: {
          name: 'The Redacted Scroll',
          working_label: 'the brittle parchment',
          aliases: ['Scroll 44'],
        },
        current_holder_id: 'actor_010',
        current_location_id: 'location_010',
        status: 'intact',
        salience: 0.75,
        isPresent: true,
      },
    ],
    locations: [
      {
        id: 'location_010',
        identity: {
          name: 'The Scriptorium Gallery',
          working_label: 'the gallery',
          aliases: ['The Scriptorium'],
        },
        parent_location_id: null,
        connected_locations: [],
        description_summary: 'A vaulted library hall bathed in green lamp-light.',
      },
    ],
    factions: [],
    facts: [
      {
        id: 'fact_010',
        statement: 'The 7th Folio contains maps to the flooded pre-cataclysm vaults.',
        status: 'established',
        confidence: 1.0,
        provenance: { chapter: 'Prologue' },
      },
    ],
    threads: [
      {
        id: 'thread_010',
        label: 'Find who tore the signature page from the catalog',
        status: 'open',
        importance: 'major',
        introduced_in: 'Scene 1',
        resolution_allowed: false,
      },
    ],
    reveals: [
      {
        id: 'reveal_010',
        fact_id: 'fact_010',
        label: 'The entire library is built upon the hull of an ancient ship',
        status: 'locked',
        allowed_before_unlock: ['subtle creaking of wooden ribs', 'salt taste in the air'],
        forbidden_before_unlock: ['direct reveal of ship origin'],
      },
    ],
    mentions: [],
    knowledge: {
      world_truth: ['fact_010'],
      reader_knowledge: [],
      actor_knowledge: {
        actor_010: {
          known_facts: [],
          beliefs: ['Aaron believes the curator went to get fresh candles'],
          forbidden_knowledge: ['fact_010'],
        },
      },
    },
    temporalHistory: [],
  },
  {
    id: 'proj_crossroads',
    title: 'The Crossroads of Ash',
    description: 'A solitary traveler arrives at an overgrown crossroads where an abandoned stone well holds an unexplained brass relic.',
    currentPosition: {
      act: 'Act I',
      chapter: 'Chapter 1: The Ash Road',
      scene: 'Scene 1: The Crossroads',
      beat: 2,
      location_id: 'location_crossroads',
      location_label: 'The Crossroads',
    },
    activePovActorId: 'actor_traveler',
    manuscript: [
      {
        id: 'beat_crossroads_01',
        beatNumber: 1,
        text: 'The traveler saw an abandoned stone well beside the overgrown junction. A small brass device rested on the well, emitting a slow amber light across the damp masonry.',
        povActorId: 'actor_traveler',
        locationId: 'location_crossroads',
        acceptedAt: 1725000000000,
      },
    ],
    actors: [
      {
        id: 'actor_traveler',
        identity: {
          name: 'The Traveler',
          working_label: 'the solitary traveler',
          aliases: ['Traveler'],
        },
        roles: {
          story: ['protagonist', 'wanderer'],
          scene: ['observer', 'POV'],
        },
        traits: {
          cautious: 0.85,
          observant: 0.9,
        },
        current_state: {
          fatigue: 0.3,
          fear: 0.1,
          certainty: 0.2,
          emotion: 'watchful and hesitant',
        },
        active_goals: ['Reach the northern boundary', 'Investigate the amber signal'],
        current_location_id: 'location_crossroads',
        possessions: [], // Traveler is NOT holding the well or the device!
        isPresent: true,
      },
    ],
    objects: [
      {
        id: 'object_well',
        identity: {
          name: null,
          working_label: 'abandoned stone well',
          aliases: ['the stone well', 'the well'],
        },
        current_holder_id: null, // NOT held by traveler!
        current_location_id: 'location_crossroads',
        status: 'intact',
        salience: 0.7,
        isPresent: true,
      },
      {
        id: 'object_brass_device',
        identity: {
          name: null,
          working_label: 'small brass device',
          aliases: ['the brass device', 'the device'],
        },
        current_holder_id: null, // NOT held by traveler! Rested on the well.
        current_location_id: 'location_crossroads',
        status: 'intact',
        salience: 0.85,
        isPresent: true,
      },
    ],
    locations: [
      {
        id: 'location_crossroads',
        identity: {
          name: 'The Crossroads',
          working_label: 'the overgrown crossroads',
          aliases: ['The Junction', 'Crossroads of Ash'],
        },
        parent_location_id: null,
        connected_locations: [],
        description_summary: 'A deserted four-way wagon trail flanked by tangled briars and weathered distance markers.',
      },
    ],
    factions: [],
    facts: [
      {
        id: 'fact_crossroads_01',
        statement: 'A small brass device rests atop an abandoned stone well at the Crossroads.',
        status: 'established',
        confidence: 0.95,
        provenance: {
          chapter: 'Chapter 1',
          scene: 'Scene 1',
          beat: 1,
          evidence_quote: 'A small brass device rested on the well, emitting a slow amber light.',
        },
      },
    ],
    threads: [
      {
        id: 'thread_crossroads_01',
        label: 'Discover who left the amber brass device on the stone well',
        status: 'open',
        importance: 'major',
        introduced_in: 'Chapter 1: Beat 1',
        resolution_allowed: false,
      },
    ],
    reveals: [],
    mentions: [
      {
        id: 'mention_crossroads_01',
        entity_id: 'actor_traveler',
        passage_text: 'The traveler saw an abandoned stone well',
        scene_id: 'scene_001',
        beat_index: 1,
        timestamp_label: 'T1: Scene 1 Beat 1',
        confidence: 1.0,
        evidence_notes: ['POV character entry at the crossroads.'],
        extracted_relationships: [{ type: 'located_at', target_id: 'location_crossroads' }],
      },
      {
        id: 'mention_crossroads_02',
        entity_id: 'object_well',
        passage_text: 'saw an abandoned stone well beside the overgrown junction',
        scene_id: 'scene_001',
        beat_index: 1,
        timestamp_label: 'T1: Scene 1 Beat 1',
        confidence: 0.95,
        evidence_notes: ['Well spotted by traveler (Perception only, NOT possession).'],
        extracted_relationships: [
          { type: 'located_at', target_id: 'location_crossroads' },
        ],
      },
      {
        id: 'mention_crossroads_03',
        entity_id: 'object_brass_device',
        passage_text: 'A small brass device rested on the well, emitting a slow amber light',
        scene_id: 'scene_001',
        beat_index: 1,
        timestamp_label: 'T1: Scene 1 Beat 1',
        confidence: 0.95,
        evidence_notes: ['Device resting on well (Spatial resting, NOT held by traveler).'],
        extracted_relationships: [
          { type: 'located_at', target_id: 'location_crossroads' },
        ],
      },
    ],
    knowledge: {
      world_truth: ['fact_crossroads_01'],
      reader_knowledge: ['fact_crossroads_01'],
      actor_knowledge: {
        actor_traveler: {
          known_facts: ['fact_crossroads_01'],
          beliefs: ['The device was placed there recently.'],
          forbidden_knowledge: [],
        },
      },
    },
    temporalHistory: [
      {
        time_index: 'T1',
        label: 'Arrival at Crossroads',
        beat_ref: 'Beat 1',
        entity_locations: {
          actor_traveler: 'location_crossroads',
          object_well: 'location_crossroads',
          object_brass_device: 'location_crossroads',
        },
        object_possessions: {
          object_well: null,
          object_brass_device: null,
        },
        actor_states: {
          actor_traveler: { fatigue: 0.3, emotion: 'watchful' },
        },
        unlocked_reveals: [],
      },
    ],
  },
];
