export type NarrativeDistance =
  | 'FRAGMENT'
  | 'BEAT'
  | 'EXCHANGE'
  | 'SEQUENCE'
  | 'SCENE'
  | 'CHAPTER';

export type OperatingMode =
  | 'CONTINUATION'
  | 'GENERATION'
  | 'TRANSFORMATION'
  | 'ANALYSIS';

export interface InferenceReceipt {
  readonly broker: 'Hermes';
  readonly requestId: string;
  readonly operation: string;
  readonly actualProvider: string;
  readonly actualModel: string;
  readonly fallbackUsed: boolean;
  readonly fallbackIndex: number;
  readonly routeAttemptCount: number;
}

export interface InferenceArtifact<T> {
  readonly value: T;
  readonly receipt: InferenceReceipt;
}

export function createInferenceArtifact<T>(
  value: T,
  receipt: InferenceReceipt,
): InferenceArtifact<T> {
  Object.freeze(receipt);
  return Object.freeze({ value, receipt });
}

export interface EntityIdentity {
  name: string | null;
  working_label: string;
  aliases: string[];
}

export type NarrativeRelationshipType =
  | 'mentions'
  | 'sees'
  | 'notices'
  | 'approaches'
  | 'touches'
  | 'uses'
  | 'carries'
  | 'holds'
  | 'owns'
  | 'possesses'
  | 'stands_beside'
  | 'is_located_near'
  | 'located_at'
  | 'associated_with'
  | 'rests_on';

export interface EntityClaim {
  id: string;
  claim: string; // e.g. "is made of stone", "is a well", "emits amber light"
  status: 'supported' | 'provisional' | 'unsupported' | 'contradicted';
  evidence_beats: number[];
  evidence_quotes: string[];
  evidence_count: number;
  confidence?: number;
  contradiction_notes?: string;
  first_seen_beat?: number;
  last_seen_beat?: number;
}

export interface ProvenanceRecord {
  id: string;
  project_id?: string;
  chapter?: string;
  beat: number;
  temporal_state: string; // e.g. "T1"
  pov_actor_id: string;
  source_text: string;
  entity_mention: string;
  claim_produced?: string;
  relationship_produced?: string;
  state_transformation_produced?: string;
  reliability_delta?: number;
  timestamp: number;
}

export interface EntityRelationship {
  id: string;
  type: NarrativeRelationshipType;
  source_id: string;
  target_id: string;
  status: 'supported' | 'provisional' | 'historical' | 'unsupported';
  established_beat: number;
  evidence_quote?: string;
}

export interface CodexEntity {
  id: string;
  working_label: string;
  canonical_label?: string | null;
  disambiguation_hint?: string | null; // e.g. "Gate guard at Crossroads (Beat 1)" vs "Carriage guard at River (Beat 15)"
  instance_index?: number; // 1, 2, 3...
  scope_location_id?: string | null;
  scope_beat_introduced?: number;
  is_generic_class?: boolean;
  entity_type: string; // 'actor' | 'creature' | 'object' | 'landmark' | 'structure' | 'location' | 'faction' | 'concept' | 'event' | 'phenomenon' | 'provisional'
  classification_confidence: 'provisional' | 'resolved';
  candidate_types?: string[]; // e.g. ['landmark', 'location', 'structure', 'object']
  reliability: number; // 0.0 to 1.0 (0% to 100%)
  salience: number; // 0.0 to 1.0
  mention_count: number;
  distinct_evidence_count: number;
  first_seen: string; // e.g. "Beat 1 (T1)"
  last_seen: string; // e.g. "Beat 3 (T3)"
  aliases: string[];
  claims: EntityClaim[];
  evidence: ProvenanceRecord[];
  relationships: EntityRelationship[];
  current_state?: Record<string, any>;
  current_holder_id?: string | null;
  current_location_id?: string | null;
  isPresent?: boolean;
  is_author_locked?: boolean;
}

/**
 * Deterministic Baseline Reliability Progression:
 * 1 distinct canonical evidence occurrence = 0%
 * 2 = 25%
 * 3 = 45%
 * 4 = 60%
 * 5 = 72%
 * 6 = 82%
 * 7 = 89%
 * 8 = 94%
 * 9 = 97%
 * 10+ = approach 100%
 */
export function calculateReliability(distinctEvidenceCount: number, isAuthorLocked: boolean = false): number {
  if (isAuthorLocked) return 1.0;
  if (distinctEvidenceCount <= 0) return 0.0;
  if (distinctEvidenceCount === 1) return 0.0;
  const progression: Record<number, number> = {
    2: 0.25,
    3: 0.45,
    4: 0.60,
    5: 0.72,
    6: 0.82,
    7: 0.89,
    8: 0.94,
    9: 0.97,
  };
  if (progression[distinctEvidenceCount] !== undefined) {
    return progression[distinctEvidenceCount];
  }
  const val = 0.97 + (distinctEvidenceCount - 9) * 0.004;
  return Math.min(0.99, Math.round(val * 100) / 100);
}

export interface ActorEntity {
  id: string; // e.g. "actor_001"
  identity: EntityIdentity;
  roles: {
    story: string[]; // e.g. ["antagonist", "detective"]
    scene: string[]; // e.g. ["interrogator", "observer"]
  };
  traits: Record<string, number | string>; // e.g. { protective: 0.8, trusting: 0.3 }
  /**
   * Absent means genuinely unestablished -- no fatigue/fear/certainty/emotion
   * evidence exists yet. Never fill this with a placeholder number/string to
   * satisfy a caller; 0/0.5/'neutral' are narrative claims a reader or a
   * generation model cannot distinguish from authored fact. Downstream
   * readers (GenerationContext, Stage2RenderingEnvelope, prompt rendering,
   * RelationalGraph.tsx) must all treat absence as "not established", never
   * substitute a default of their own.
   */
  current_state?: {
    fatigue: number;
    fear: number;
    certainty: number;
    emotion: string;
  };
  active_goals: string[];
  current_location_id: string;
  possessions: string[]; // object IDs
  isPresent: boolean;
  reliability?: number;
  salience?: number;
  classification_confidence?: 'provisional' | 'resolved';
  candidate_types?: string[];
  claims?: EntityClaim[];
  evidence?: ProvenanceRecord[];
  relationships?: EntityRelationship[];
  first_seen?: string;
  last_seen?: string;
  is_author_locked?: boolean;
}

export interface ObjectEntity {
  id: string; // e.g. "object_001"
  identity: EntityIdentity;
  current_holder_id: string | null; // actor_id or null
  current_location_id: string | null;
  /** Absent means genuinely unestablished physical condition -- see ActorEntity.current_state for the same convention and why. */
  status?: 'intact' | 'damaged' | 'destroyed' | 'missing';
  salience: number; // 0.0 to 1.0 based on mentions & connections
  isPresent: boolean;
  reliability?: number;
  classification_confidence?: 'provisional' | 'resolved';
  candidate_types?: string[];
  claims?: EntityClaim[];
  evidence?: ProvenanceRecord[];
  relationships?: EntityRelationship[];
  first_seen?: string;
  last_seen?: string;
  is_author_locked?: boolean;
}

export interface LocationEntity {
  id: string; // e.g. "location_001"
  identity: EntityIdentity;
  parent_location_id: string | null;
  connected_locations: string[];
  description_summary: string;
  reliability?: number;
  salience?: number;
  classification_confidence?: 'provisional' | 'resolved';
  candidate_types?: string[];
  claims?: EntityClaim[];
  evidence?: ProvenanceRecord[];
  relationships?: EntityRelationship[];
  first_seen?: string;
  last_seen?: string;
  is_author_locked?: boolean;
}

export interface FactionEntity {
  id: string; // e.g. "faction_001"
  identity: EntityIdentity;
  members: string[]; // actor IDs
  influence: string;
}

export interface FactEntity {
  id: string; // e.g. "fact_001"
  statement: string;
  status: 'established' | 'inferred' | 'suspected';
  confidence: number; // 0.0 to 1.0
  source_mention_id?: string;
  provenance: {
    chapter?: string;
    scene?: string;
    beat?: number;
    evidence_quote?: string;
  };
}

export interface ThreadEntity {
  id: string; // e.g. "thread_001"
  label: string;
  status: 'open' | 'complicated' | 'resolved';
  importance: 'minor' | 'major' | 'critical';
  introduced_in: string;
  resolution_allowed: boolean;
  author_only?: boolean; // If true, author-only thread hidden from generation context
  visible_to_actor_ids?: string[]; // Actor IDs permitted to be aware of this thread
}

export interface RevealEntity {
  id: string; // e.g. "reveal_001"
  fact_id: string;
  label: string;
  status: 'locked' | 'foreshadowed' | 'unlocked';
  allowed_before_unlock: string[]; // e.g. ["foreshadow", "ambiguous_sensory"]
  forbidden_before_unlock: string[]; // e.g. ["direct_explanation", "narrator_confirmation"]
}

export interface MentionRecord {
  id: string; // e.g. "mention_001"
  entity_id: string;
  passage_text: string;
  scene_id: string;
  beat_index: number;
  timestamp_label: string;
  confidence: number;
  evidence_notes: string[];
  extracted_relationships: Array<{
    type: 'located_at' | 'possessed_by' | 'known_by' | 'used_during';
    target_id: string;
  }>;
}

export interface KnowledgeBoundaries {
  world_truth: string[]; // Array of fact IDs true in world
  reader_knowledge: string[]; // Facts the reader has observed
  actor_knowledge: Record<
    string,
    {
      known_facts: string[]; // facts this actor knows
      beliefs: string[]; // beliefs (may differ from world truth)
      forbidden_knowledge: string[]; // facts actor MUST NOT know
      known_entity_perceptions?: Record<
        string,
        {
          perceived_label: string; // e.g. "the hooded stranger"
          perceived_name?: string | null; // null if real name is unknown to POV
          perceived_role?: string | null; // e.g. "unidentified patron"
          perceived_traits?: Record<string, any>;
        }
      >;
      known_entities?: string[]; // IDs of entities whose canonical names are known
      known_threads?: string[]; // IDs of threads this actor is aware of
    }
  >;
}

export interface TemporalSnapshot {
  time_index: string; // "T1", "T2", "T3"
  operation_id?: string;
  timestamp?: number;
  label: string;
  beat_ref: string;
  previous_story_position?: StoryPosition;
  resulting_story_position?: StoryPosition;
  accepted_beat_id?: string;
  pov_actor_id?: string;
  location_id?: string;
  affected_entity_ids?: string[];
  applied_state_changes?: string[];
  thread_changes?: string[];
  reveal_changes?: string[];
  mention_ids?: string[];
  entity_locations: Record<string, string>; // entity_id -> location_id
  object_possessions: Record<string, string | null>; // object_id -> actor_id | null
  actor_states: Record<string, { fatigue: number; emotion: string }>;
  unlocked_reveals: string[];
}

export interface RewriteContract {
  presetName: string;
  modify: string[];
  preserve: string[];
  forbid: string[];
}

export interface GenerationContext {
  operatingMode: OperatingMode;
  narrativeDistance: NarrativeDistance;
  storyPosition: StoryPosition;
  activePovActor: {
    id: string;
    identity: EntityIdentity;
    roles: { story: string[]; scene: string[] };
    traits: Record<string, number | string>;
    current_state?: { fatigue: number; fear: number; certainty: number; emotion: string };
    active_goals: string[];
    current_location_id: string;
    possessions: string[];
  };
  knownFacts: Array<{
    id: string;
    statement: string;
    status: string;
    provenance?: any;
  }>;
  sincereBeliefs: string[];
  presentEntities: Array<{
    id: string;
    type: 'actor' | 'object' | 'location';
    label: string;
    name: string | null;
    aliases: string[];
    roleOrStatus?: string;
    locationId?: string | null;
    currentHolderId?: string | null;
    traitsOrDescription?: any;
    currentState?: any;
  }>;
  currentLocation: {
    id: string;
    name: string | null;
    working_label: string;
    description_summary: string;
    connected_locations: string[];
  } | null;
  relevantPossessions: Array<{
    id: string;
    label: string;
    holderId: string | null;
    holderName: string | null;
  }>;
  relevantOpenThreads: Array<{
    id: string;
    label: string;
    importance: string;
    resolution_allowed: boolean;
  }>;
  permittedForeshadowingCues: string[];
  recentProse: string;
  accumulatedCodexEntities?: Array<{
    id: string;
    label: string;
    type: string;
    classification_confidence: string;
    reliability: number;
    salience: number;
    distinct_evidence_count: number;
    current_holder_id: string | null;
    current_location_id: string | null;
    supported_claims: string[];
    contradicted_claims: string[];
    relationships: string[];
  }>;
  continuityConstraints?: string[];
  rewriteContract: RewriteContract | null;
}

export type Stage2ScopedReferenceStatus = 'approved' | 'outside_approved_scope' | 'absent';

export interface Stage2RenderingEntity {
  id: string;
  type: 'actor' | 'location' | 'object';
  displayName: string;
}

export interface Stage2RenderingPossession {
  id: string;
  displayName: string;
  holderId: string | null;
  holderDisplayName: string | null;
  holderStatus: Stage2ScopedReferenceStatus;
}

export interface Stage2RenderingCodexEvidence {
  id: string;
  displayName: string;
  type: string;
  classificationConfidence: string;
  reliability: number;
  currentHolderId: string | null;
  currentHolderStatus: Stage2ScopedReferenceStatus;
  currentLocationId: string | null;
  currentLocationStatus: Stage2ScopedReferenceStatus;
  relationships: string[];
}

export interface Stage2RenderingContinuityConstraint {
  kind: 'inventory';
  entityId: string;
  entityDisplayName: string;
  holderId: string | null;
  holderDisplayName: string | null;
  holderStatus: Stage2ScopedReferenceStatus;
}

export interface Stage2RenderingEnvelope {
  operatingMode: OperatingMode;
  pov: {
    id: string;
    displayName: string;
    traits: Record<string, number | string>;
    /** Absent means unestablished; narrativePipeline.ts must omit the "POV Current State" prompt line entirely rather than render it as e.g. "undefined". */
    currentState?: {
      fatigue: number;
      fear: number;
      certainty: number;
      emotion: string;
    };
  };
  currentLocation: {
    id: string;
    displayName: string;
    description: string;
  } | null;
  involvedEntities: Stage2RenderingEntity[];
  relevantPossessions: Stage2RenderingPossession[];
  knownFacts: Array<{
    id: string;
    statement: string;
    status: string;
  }>;
  sincereBeliefs: string[];
  recentProse: string;
  codexEntities: Stage2RenderingCodexEvidence[];
  continuityConstraints: Stage2RenderingContinuityConstraint[];
  rewriteContract: RewriteContract | null;
  permittedForeshadowingCues: string[];
}

export interface ValidationContext {
  povActorId: string;
  povActorLabel: string;
  forbiddenFacts: Array<{ id: string; statement: string }>;
  lockedReveals: Array<{
    id: string;
    factStatement?: string;
    allowedBeforeUnlock: string[];
    forbiddenBeforeUnlock: string[];
    status: string;
  }>;
  worldTruthFacts: Array<{ id: string; statement: string }>;
  presentEntityIds: string[];
  displacedEntityIds: string[];
  objectHolders: Record<string, string | null>;
  openThreads: Array<{ id: string; label: string; resolution_allowed: boolean }>;
  narrativeDistance: NarrativeDistance;
  rewriteContract: RewriteContract | null;
}

export interface BeatPlanStage1 {
  beat_type: string;
  primary_actor_id: string;
  intended_action: string;
  permitted_entities_involved?: string[];
  permitted_state_transitions?: string[];
  knowledge_verified: boolean;
  reveals_protected: boolean;
  threads_advanced: string[];
  threads_resolved: string[];
  distance_budget: NarrativeDistance;
  plan_notes?: string;
}

export type Stage1PlanningArtifact = InferenceArtifact<BeatPlanStage1>;
export type Stage2RenderingArtifact = InferenceArtifact<string>;

export interface ValidationDiagnostic {
  severity: 'FATAL' | 'WARNING' | 'INFO';
  rule: string;
  message: string;
  remedy?: string;
}

export interface ValidationReport {
  passed: boolean;
  score: number;
  diagnostics: ValidationDiagnostic[];
  verified: boolean;
  status: 'VERIFIED' | 'UNVERIFIED';
  notes?: string;
}

export interface CandidateGeneration {
  id: string;
  timestamp: number;
  operation: OperatingMode;
  narrativeDistance: NarrativeDistance;
  prompt: string;
  stage1Artifact: Stage1PlanningArtifact;
  stage2Artifact: Stage2RenderingArtifact;
  stage2Prose: string;
  validation: ValidationReport;
  contextPackage: any;
  status: 'pending' | 'accepted' | 'rejected';
}

export function createCandidateGeneration(
  candidate: Omit<CandidateGeneration, 'stage2Prose'>,
): CandidateGeneration {
  return {
    ...candidate,
    stage2Prose: candidate.stage2Artifact.value,
  };
}

export function editCandidateStage2Prose(
  candidate: CandidateGeneration,
  stage2Prose: string,
): CandidateGeneration {
  return {
    ...candidate,
    stage2Prose,
  };
}

export interface HistoryReceipt {
  operation_id: string;
  timestamp: number;
  summary: string;
  changes: string[];
  snapshot: StoryProject;
}

export interface StoryPosition {
  act: string;
  chapter: string;
  scene: string;
  beat: number;
  location_id: string;
  location_label: string;
}

/**
 * How an AuthorSourceDocument entered the project. Only 'pasted_prose' is
 * produced by the current Manuscript Intake baseline; 'uploaded_file' is
 * reserved for a later slice and is not yet emitted anywhere.
 */
export type AuthorSourceDocumentType = 'pasted_prose' | 'uploaded_file';

/**
 * Author-supplied source material, preserved exactly as entered.
 *
 * Governing authority rule (see PROPOSAL.md and
 * MANUSCRIPT_INTAKE_ENGINEERING_REPORT.md):
 *
 *   author-supplied prose             = authoritative source material
 *   machine-derived actors/objects/
 *   locations/facts/POV/beat
 *   boundaries/relationships/
 *   knowledge/state                   = proposals, not truth
 *
 * An AuthorSourceDocument is exactly the first kind. It is never split into
 * manuscript beats, never used to infer povActorId/locationId, and never
 * itself interpreted into actors/objects/locations/facts/knowledge -- doing
 * so would require inventing narrative claims the author never made. It
 * exists so unstructured, unreviewed author prose has somewhere honest to
 * live in a StoryProject instead of being forced into fields that assert
 * story truth (`manuscript[].povActorId`, `manuscript[].locationId`, etc).
 */
export interface AuthorSourceDocument {
  readonly id: string; // e.g. "source_001"
  readonly label: string; // author-supplied chapter/source title
  readonly exactText: string; // preserved byte-for-byte as entered; see src/lib/manuscriptIntake.ts
  readonly sourceType: AuthorSourceDocumentType;
  readonly importedAt: number; // epoch ms
}

export interface StoryProject {
  id: string;
  title: string;
  description: string;
  currentPosition: StoryPosition;
  activePovActorId: string;
  manuscript: Array<{
    id: string;
    beatNumber: number;
    text: string;
    povActorId: string;
    locationId: string;
    acceptedAt: number;
  }>;
  actors: ActorEntity[];
  objects: ObjectEntity[];
  locations: LocationEntity[];
  factions: FactionEntity[];
  facts: FactEntity[];
  threads: ThreadEntity[];
  reveals: RevealEntity[];
  mentions: MentionRecord[];
  knowledge: KnowledgeBoundaries;
  temporalHistory: TemporalSnapshot[];
  codexEntities?: CodexEntity[];
  /**
   * Author-authoritative imported source material. Additive and optional
   * (following the same precedent as codexEntities above) so every existing
   * StoryProject -- all three DEFAULT_PROJECTS -- remains valid untouched.
   * Absent/undefined means "no imported source material", equivalent to [].
   */
  sourceDocuments?: AuthorSourceDocument[];
}

export interface BenchmarkTestCase {
  id: string;
  title: string;
  category: string;
  description: string;
  setupSummary: string;
  prompt: string;
  requestedDistance: NarrativeDistance;
  constraints: {
    forbiddenRevealId?: string;
    forbiddenKnowledgeFactId?: string;
    protectedInvariants?: string[];
    displacedObjectId?: string;
    isolatedActorId?: string;
  };
  nakedModelBehavior: {
    flawName: string;
    explanation: string;
    sampleViolationOutput: string;
  };
  frameworkBehavior: {
    remedyName: string;
    explanation: string;
    sampleCompliantOutput: string;
  };
}
