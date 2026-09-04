import type {
  ActorEntity,
  CandidateGeneration,
  HistoryReceipt,
  MentionRecord,
  StoryProject,
  TemporalSnapshot,
} from '../types';
import {
  applyAdmittedPossessionChanges,
  createMentionedObject,
  type PromotionProposedEntity,
} from './promotionIntegrity';
import {
  expectedPromotionManifestId,
  fingerprintManifestAdmission,
  fingerprintReviewProse,
  isActorStateChange,
  isBeliefChange,
  isLocationChange,
  isPossessionChange,
  isPromotionProposedEntity,
  type PromotionManifest,
  type PromotionManifestEntry,
  type PromotionManifestKind,
  type PromotionManifestProposal,
  validatePromotionManifestStructure,
} from './promotionManifest';

export interface PromotionReceiptEntry {
  readonly entryId: string;
  readonly kind: PromotionManifestKind;
  readonly decision: PromotionManifestEntry['decision'];
  readonly supportedForApplication: boolean;
  readonly proposed: PromotionManifestProposal;
  readonly admitted: PromotionManifestProposal | null;
  readonly applied: boolean;
}

export interface PromotionReceipt {
  readonly id: string;
  readonly manifestId: string;
  readonly projectId: string;
  readonly candidateId: string;
  readonly boundReviewProse: string;
  readonly reviewProseFingerprint: string;
  readonly admissionFingerprint: string;
  readonly acceptedBeatId: string;
  readonly historyOperationId: string;
  readonly sourceMentions: readonly MentionRecord[];
  readonly entries: readonly PromotionReceiptEntry[];
  readonly appliedEntryIds: readonly string[];
  readonly unsupportedEntryIds: readonly string[];
}

export interface PreparedPromotion {
  nextProject: StoryProject;
  historyReceipt: HistoryReceipt;
  promotionReceipt: PromotionReceipt;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      deepFreeze(Reflect.get(value, key));
    }
    Object.freeze(value);
  }
  return value;
}

function failWrongProposal(entry: PromotionManifestEntry): never {
  throw new Error(`Malformed Promotion Manifest proposal kind for ${entry.id}`);
}

function admittedProposal(entry: PromotionManifestEntry): PromotionManifestProposal | undefined {
  if (!entry.supportedForApplication) {
    if (entry.decision === 'approved' || entry.decision === 'edited') {
      throw new Error(`Unsupported Promotion Manifest entry cannot be admitted: ${entry.id}`);
    }
    return undefined;
  }
  if (entry.decision === 'pending') {
    throw new Error(`Pending supported Promotion Manifest entry cannot promote: ${entry.id}`);
  }
  if (entry.decision === 'rejected') return undefined;
  if (entry.decision === 'approved') return entry.proposed;
  if (entry.admitted === undefined) {
    throw new Error(`Edited Promotion Manifest entry requires an admitted value: ${entry.id}`);
  }
  return entry.admitted;
}

function createAdmittedActor(
  entity: PromotionProposedEntity,
  currentLocationId: string,
): ActorEntity {
  return {
    id: entity.id,
    identity: {
      name: entity.name,
      working_label: entity.working_label,
      aliases: structuredClone(entity.aliases),
    },
    roles: { story: ['supporting'], scene: ['present'] },
    traits: {},
    current_state: {
      fatigue: 0.1,
      fear: 0.1,
      certainty: 0.5,
      emotion: 'neutral',
    },
    active_goals: [],
    current_location_id: currentLocationId,
    possessions: [],
    isPresent: true,
  };
}

function canonicalEntityIds(project: StoryProject): Set<string> {
  return new Set([
    ...project.actors.map((entity) => entity.id),
    ...project.objects.map((entity) => entity.id),
    ...project.locations.map((entity) => entity.id),
    ...project.factions.map((entity) => entity.id),
  ]);
}

function assertUniqueNewEntityId(project: StoryProject, entityId: string): void {
  if (canonicalEntityIds(project).has(entityId)) {
    throw new Error(`Entity admission precondition failed: duplicate entity ${entityId}`);
  }
}

function validateProposedEntityIdentities(
  project: StoryProject,
  manifest: PromotionManifest,
): Map<string, string> {
  const existingIds = canonicalEntityIds(project);
  const originalOwners = new Map<string, string>();
  for (const entry of manifest.entries) {
    if (entry.kind !== 'entity_proposal') continue;
    if (!isPromotionProposedEntity(entry.proposed)) failWrongProposal(entry);
    if (existingIds.has(entry.proposed.id) || originalOwners.has(entry.proposed.id)) {
      throw new Error(`Entity proposal identity precondition failed: duplicate entity ${entry.proposed.id}`);
    }
    originalOwners.set(entry.proposed.id, entry.id);
  }

  const admittedIds = new Set<string>();
  const admittedIdByOriginalId = new Map<string, string>();
  for (const entry of manifest.entries) {
    if (entry.kind !== 'entity_proposal') continue;
    if (!isPromotionProposedEntity(entry.proposed)) failWrongProposal(entry);
    const admitted = admittedProposal(entry);
    if (admitted === undefined) continue;
    if (!isPromotionProposedEntity(admitted)) failWrongProposal(entry);
    const otherOriginalOwner = originalOwners.get(admitted.id);
    if (
      existingIds.has(admitted.id)
      || admittedIds.has(admitted.id)
      || (otherOriginalOwner !== undefined && otherOriginalOwner !== entry.id)
    ) {
      throw new Error(`Entity admission identity precondition failed: duplicate entity ${admitted.id}`);
    }
    admittedIds.add(admitted.id);
    admittedIdByOriginalId.set(entry.proposed.id, admitted.id);
  }
  return admittedIdByOriginalId;
}

function applyEntityProposal(
  draft: StoryProject,
  entry: PromotionManifestEntry,
  proposal: PromotionManifestProposal,
  descriptions: string[],
): void {
  if (!isPromotionProposedEntity(proposal)) failWrongProposal(entry);
  if (proposal.type === 'location') {
    throw new Error(`Unsupported Promotion Manifest entity proposal cannot be applied: ${entry.id}`);
  }
  assertUniqueNewEntityId(draft, proposal.id);
  if (proposal.type === 'actor') {
    draft.actors.push(createAdmittedActor(proposal, draft.currentPosition.location_id));
  } else {
    draft.objects.push(createMentionedObject(proposal, draft.currentPosition.location_id));
  }
  descriptions.push(`Admitted ${proposal.type} ${proposal.id}`);
}

function applyLocationChange(
  draft: StoryProject,
  entry: PromotionManifestEntry,
  proposal: PromotionManifestProposal,
  descriptions: string[],
): void {
  if (!isLocationChange(proposal)) failWrongProposal(entry);
  const actor = draft.actors.find((candidate) => candidate.id === proposal.entity_id);
  if (!actor) {
    throw new Error(`Location transition precondition failed: unknown actor ${proposal.entity_id}`);
  }
  if (actor.current_location_id !== proposal.from_location_id) {
    throw new Error(`Location transition precondition failed for ${proposal.entity_id}`);
  }
  if (!draft.locations.some((location) => location.id === proposal.to_location_id)) {
    throw new Error(`Location transition precondition failed: unknown destination ${proposal.to_location_id}`);
  }
  actor.current_location_id = proposal.to_location_id;
  descriptions.push(`${actor.identity.name || actor.id} relocated to ${proposal.to_location_id}`);
}

function applyPossessionChange(
  draft: StoryProject,
  entry: PromotionManifestEntry,
  proposal: PromotionManifestProposal,
  descriptions: string[],
): void {
  if (!isPossessionChange(proposal)) failWrongProposal(entry);
  if (proposal.to_actor_id !== null && !draft.actors.some((actor) => actor.id === proposal.to_actor_id)) {
    throw new Error(`Possession transition precondition failed: unknown recipient ${proposal.to_actor_id}`);
  }
  applyAdmittedPossessionChanges(draft.objects, [proposal], descriptions);
}

function applyActorStateChange(
  draft: StoryProject,
  entry: PromotionManifestEntry,
  proposal: PromotionManifestProposal,
  descriptions: string[],
): void {
  if (!isActorStateChange(proposal)) failWrongProposal(entry);
  const actor = draft.actors.find((candidate) => candidate.id === proposal.actor_id);
  if (!actor) {
    throw new Error(`Actor-state transition precondition failed: unknown actor ${proposal.actor_id}`);
  }
  if (proposal.fatigue_delta !== undefined) {
    actor.current_state.fatigue = Math.min(
      1,
      Math.max(0, actor.current_state.fatigue + proposal.fatigue_delta),
    );
    descriptions.push(`${actor.identity.name || actor.id} fatigue changed by ${proposal.fatigue_delta}`);
  }
  if (proposal.emotion !== undefined) {
    actor.current_state.emotion = proposal.emotion;
    descriptions.push(`${actor.identity.name || actor.id} emotional state updated to "${proposal.emotion}"`);
  }
}

function applyBeliefChange(
  draft: StoryProject,
  entry: PromotionManifestEntry,
  proposal: PromotionManifestProposal,
  descriptions: string[],
): void {
  if (!isBeliefChange(proposal)) failWrongProposal(entry);
  if (!draft.actors.some((actor) => actor.id === proposal.actor_id)) {
    throw new Error(`Belief transition precondition failed: unknown actor ${proposal.actor_id}`);
  }
  const knowledge = draft.knowledge.actor_knowledge[proposal.actor_id]
    ?? { known_facts: [], beliefs: [], forbidden_knowledge: [] };
  knowledge.beliefs.push(proposal.new_belief);
  draft.knowledge.actor_knowledge[proposal.actor_id] = knowledge;
  descriptions.push(`New belief formed by ${proposal.actor_id}: "${proposal.new_belief}"`);
}

function applySupportedEntry(
  draft: StoryProject,
  entry: PromotionManifestEntry,
  proposal: PromotionManifestProposal,
  descriptions: string[],
): void {
  switch (entry.kind) {
    case 'entity_proposal':
      applyEntityProposal(draft, entry, proposal, descriptions);
      return;
    case 'location_change':
      applyLocationChange(draft, entry, proposal, descriptions);
      return;
    case 'possession_change':
      applyPossessionChange(draft, entry, proposal, descriptions);
      return;
    case 'actor_state_change':
      applyActorStateChange(draft, entry, proposal, descriptions);
      return;
    case 'belief_change':
      applyBeliefChange(draft, entry, proposal, descriptions);
      return;
    case 'thread_advancement':
    case 'reveal_change':
      throw new Error(`Unsupported Promotion Manifest entry cannot be applied: ${entry.id}`);
  }
}

type ResolvedMentionId =
  | { readonly status: 'admitted'; readonly id: string }
  | { readonly status: 'rejected' }
  | { readonly status: 'unknown' };

/**
 * Resolves a source-extraction entity id to its canonical id.
 *
 * A source mention or relationship always carries the *original* id a proposal was
 * extracted under. If that proposal was admitted under a different id (an "edited"
 * entity-identity correction), references to the original id must follow the entity
 * to its admitted id rather than going dangling or being silently dropped.
 */
function resolveCanonicalMentionId(
  id: string,
  availableIds: ReadonlySet<string>,
  proposedIds: ReadonlySet<string>,
  admittedIdByOriginalId: ReadonlyMap<string, string>,
): ResolvedMentionId {
  if (proposedIds.has(id)) {
    const admittedId = admittedIdByOriginalId.get(id);
    return admittedId === undefined ? { status: 'rejected' } : { status: 'admitted', id: admittedId };
  }
  return availableIds.has(id) ? { status: 'admitted', id } : { status: 'unknown' };
}

function canonicalizeMentions(
  draft: StoryProject,
  manifest: PromotionManifest,
  admittedIdByOriginalId: ReadonlyMap<string, string>,
): MentionRecord[] {
  const availableIds = canonicalEntityIds(draft);
  const proposedIds = new Set(
    manifest.entries
      .filter((entry) => entry.kind === 'entity_proposal' && isPromotionProposedEntity(entry.proposed))
      .map((entry) => {
        if (!isPromotionProposedEntity(entry.proposed)) failWrongProposal(entry);
        return entry.proposed.id;
      }),
  );
  const existingMentionIds = new Set(draft.mentions.map((mention) => mention.id));
  const admitted: MentionRecord[] = [];

  for (const sourceMention of manifest.sourceMentions) {
    const resolvedSubject = resolveCanonicalMentionId(
      sourceMention.entity_id,
      availableIds,
      proposedIds,
      admittedIdByOriginalId,
    );
    if (resolvedSubject.status === 'unknown') {
      throw new Error(`Mention referential integrity failed: unknown entity ${sourceMention.entity_id}`);
    }
    if (resolvedSubject.status === 'rejected') continue;
    if (existingMentionIds.has(sourceMention.id)) {
      throw new Error(`Mention referential integrity failed: duplicate mention ${sourceMention.id}`);
    }

    const resolvedRelationships = sourceMention.extracted_relationships.map((relationship) => {
      const resolvedTarget = resolveCanonicalMentionId(
        relationship.target_id,
        availableIds,
        proposedIds,
        admittedIdByOriginalId,
      );
      if (resolvedTarget.status !== 'admitted') {
        throw new Error(`Mention referential integrity failed: unknown relationship target ${relationship.target_id}`);
      }
      return resolvedTarget.id === relationship.target_id
        ? relationship
        : { ...relationship, target_id: resolvedTarget.id };
    });

    existingMentionIds.add(sourceMention.id);
    admitted.push({
      ...structuredClone(sourceMention),
      entity_id: resolvedSubject.id,
      extracted_relationships: resolvedRelationships,
    });
  }
  return admitted;
}

function buildTemporalSnapshot(
  project: StoryProject,
  draft: StoryProject,
  candidate: CandidateGeneration,
  acceptedMentions: readonly MentionRecord[],
  appliedDescriptions: readonly string[],
  operationId: string,
  beatId: string,
  beatNumber: number,
): TemporalSnapshot {
  const entityLocations: Record<string, string> = {};
  for (const actor of draft.actors) entityLocations[actor.id] = actor.current_location_id;
  for (const object of draft.objects) {
    if (object.current_location_id !== null) entityLocations[object.id] = object.current_location_id;
  }

  const objectPossessions: Record<string, string | null> = {};
  for (const object of draft.objects) objectPossessions[object.id] = object.current_holder_id;

  const actorStates: Record<string, { fatigue: number; emotion: string }> = {};
  for (const actor of draft.actors) {
    actorStates[actor.id] = {
      fatigue: actor.current_state.fatigue,
      emotion: actor.current_state.emotion,
    };
  }

  const affectedEntityIds = Array.from(new Set([
    project.activePovActorId,
    ...acceptedMentions.map((mention) => mention.entity_id),
  ]));

  return {
    time_index: `T${beatNumber}`,
    operation_id: operationId,
    timestamp: candidate.timestamp,
    label: `Beat #${beatNumber}: ${candidate.stage1Artifact.value.intended_action || 'Canonized Beat'}`,
    beat_ref: `Beat ${beatNumber}`,
    previous_story_position: structuredClone(project.currentPosition),
    resulting_story_position: {
      ...structuredClone(project.currentPosition),
      beat: beatNumber + 1,
    },
    accepted_beat_id: beatId,
    pov_actor_id: project.activePovActorId,
    location_id: project.currentPosition.location_id,
    affected_entity_ids: affectedEntityIds,
    applied_state_changes: appliedDescriptions.length > 0
      ? [...appliedDescriptions]
      : ['Beat integrated into story canon.'],
    thread_changes: [],
    reveal_changes: [],
    mention_ids: acceptedMentions.map((mention) => mention.id),
    entity_locations: entityLocations,
    object_possessions: objectPossessions,
    actor_states: actorStates,
    unlocked_reveals: draft.reveals
      .filter((reveal) => reveal.status === 'unlocked')
      .map((reveal) => reveal.id),
  };
}

export function preparePromotion(
  project: StoryProject,
  candidate: CandidateGeneration,
  manifest: PromotionManifest,
): PreparedPromotion {
  validatePromotionManifestStructure(manifest);
  if (manifest.projectId !== project.id) {
    throw new Error('Promotion Manifest project identity does not match the target project');
  }
  if (manifest.candidateId !== candidate.id) {
    throw new Error('Promotion Manifest candidate identity does not match the candidate');
  }
  if (manifest.boundReviewProse !== candidate.stage2Prose) {
    throw new Error('Stale Promotion Manifest: bound review prose does not match current editable prose');
  }
  if (manifest.reviewProseFingerprint !== fingerprintReviewProse(candidate.stage2Prose)) {
    throw new Error('Stale Promotion Manifest: review-prose freshness fingerprint mismatch');
  }
  if (manifest.id !== expectedPromotionManifestId(
    project.id,
    candidate.id,
    candidate.stage2Prose,
    manifest.sourceFingerprint,
  )) {
    throw new Error('Stale Promotion Manifest identity');
  }
  const admittedIdByOriginalId = validateProposedEntityIdentities(project, manifest);

  const admissionFingerprint = fingerprintManifestAdmission(manifest);
  const operationId = `promotion:${manifest.id}:${admissionFingerprint}`;
  if (project.temporalHistory.some((snapshot) => (
    typeof snapshot.operation_id === 'string'
    && snapshot.operation_id.startsWith(`promotion:${manifest.id}:`)
  ))) {
    throw new Error(`Promotion Manifest has already been promoted: ${manifest.id}`);
  }

  const prePromotionSnapshot = structuredClone(project);
  const draft = structuredClone(project);
  const appliedDescriptions: string[] = [];
  const appliedEntryIds: string[] = [];
  const unsupportedEntryIds = manifest.entries
    .filter((entry) => !entry.supportedForApplication)
    .map((entry) => entry.id);
  const admittedByEntry = new Map<string, PromotionManifestProposal>();

  for (const entry of manifest.entries) {
    const proposal = admittedProposal(entry);
    if (proposal === undefined) continue;
    applySupportedEntry(draft, entry, proposal, appliedDescriptions);
    appliedEntryIds.push(entry.id);
    admittedByEntry.set(entry.id, structuredClone(proposal));
  }

  const admittedMentions = canonicalizeMentions(draft, manifest, admittedIdByOriginalId);
  const beatNumber = project.manuscript.length + 1;
  const beatId = `beat:${manifest.id}:${admissionFingerprint}:${beatNumber}`;
  draft.manuscript.push({
    id: beatId,
    beatNumber,
    text: candidate.stage2Prose,
    povActorId: project.activePovActorId,
    locationId: project.currentPosition.location_id,
    acceptedAt: candidate.timestamp,
  });
  draft.mentions.push(...admittedMentions);
  draft.currentPosition = {
    ...draft.currentPosition,
    beat: beatNumber + 1,
  };
  const temporalSnapshot = buildTemporalSnapshot(
    project,
    draft,
    candidate,
    admittedMentions,
    appliedDescriptions,
    operationId,
    beatId,
    beatNumber,
  );
  draft.temporalHistory.push(temporalSnapshot);

  const receiptEntries: PromotionReceiptEntry[] = manifest.entries.map((entry) => ({
    entryId: entry.id,
    kind: entry.kind,
    decision: entry.decision,
    supportedForApplication: entry.supportedForApplication,
    proposed: structuredClone(entry.proposed),
    admitted: admittedByEntry.has(entry.id)
      ? structuredClone(admittedByEntry.get(entry.id) ?? null)
      : null,
    applied: appliedEntryIds.includes(entry.id),
  }));
  const historyReceipt: HistoryReceipt = {
    operation_id: operationId,
    timestamp: candidate.timestamp,
    summary: `Accepted Beat #${beatNumber} (${candidate.narrativeDistance})`,
    changes: [
      `Canonized Beat #${beatNumber}`,
      `Admitted ${admittedMentions.length} entity mentions`,
      `Applied ${appliedEntryIds.length} Promotion Manifest entries`,
      `Committed Chronological Receipt T${beatNumber}`,
    ],
    snapshot: prePromotionSnapshot,
  };
  const promotionReceipt: PromotionReceipt = deepFreeze({
    id: `promotion-receipt:${manifest.id}:${admissionFingerprint}`,
    manifestId: manifest.id,
    projectId: project.id,
    candidateId: candidate.id,
    boundReviewProse: manifest.boundReviewProse,
    reviewProseFingerprint: manifest.reviewProseFingerprint,
    admissionFingerprint,
    acceptedBeatId: beatId,
    historyOperationId: operationId,
    sourceMentions: structuredClone(manifest.sourceMentions),
    entries: receiptEntries,
    appliedEntryIds,
    unsupportedEntryIds,
  });

  return {
    nextProject: draft,
    historyReceipt,
    promotionReceipt,
  };
}
