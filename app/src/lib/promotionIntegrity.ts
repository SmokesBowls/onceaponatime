import type { MentionRecord, ObjectEntity, StoryProject } from '../types';

export interface PromotionProposedEntity {
  id: string;
  type: 'actor' | 'object' | 'location';
  working_label: string;
  name: string | null;
  aliases: string[];
  initial_location_id?: string;
}

export interface PromotionStateChanges {
  location_changes: Array<{ entity_id: string; from_location_id: string; to_location_id: string }>;
  possession_changes: Array<{ object_id: string; from_actor_id: string | null; to_actor_id: string | null }>;
  actor_state_changes: Array<{ actor_id: string; fatigue_delta?: number; emotion?: string }>;
  belief_changes: Array<{ actor_id: string; new_belief: string }>;
  thread_advancements: Array<{ thread_id: string; notes: string }>;
  reveals_triggered: Array<{ reveal_id: string; new_status: 'foreshadowed' | 'unlocked' }>;
}

export interface PromotionExtractionPayload {
  success: true;
  mentions: MentionRecord[];
  proposedNewEntities: PromotionProposedEntity[];
  stateChanges: PromotionStateChanges;
}

interface PromotionExtractionResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonBlankString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNonBlankStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonBlankString);
}

export function isPromotionMentionRecord(value: unknown): value is MentionRecord {
  if (!isRecord(value)) return false;
  return isNonBlankString(value.id)
    && isNonBlankString(value.entity_id)
    && isNonBlankString(value.passage_text)
    && isNonBlankString(value.scene_id)
    && Number.isInteger(value.beat_index)
    && Number(value.beat_index) >= 0
    && isNonBlankString(value.timestamp_label)
    && typeof value.confidence === 'number'
    && Number.isFinite(value.confidence)
    && value.confidence >= 0
    && value.confidence <= 1
    && isStringArray(value.evidence_notes)
    && Array.isArray(value.extracted_relationships)
    && value.extracted_relationships.every((relationship) => (
      isRecord(relationship)
      && ['located_at', 'possessed_by', 'known_by', 'used_during'].includes(String(relationship.type))
      && isNonBlankString(relationship.target_id)
    ));
}

export function isPromotionProposedEntityRecord(value: unknown): value is PromotionProposedEntity {
  if (!isRecord(value)) return false;
  return isNonBlankString(value.id)
    && ['actor', 'object', 'location'].includes(String(value.type))
    && isNonBlankString(value.working_label)
    && (value.name === null || isNonBlankString(value.name))
    && isNonBlankStringArray(value.aliases)
    && (value.initial_location_id === undefined || isNonBlankString(value.initial_location_id));
}

function hasValidStateChanges(value: unknown): value is PromotionStateChanges {
  if (!isRecord(value)) return false;
  return Array.isArray(value.location_changes)
    && value.location_changes.every((change) => (
      isRecord(change)
      && isNonBlankString(change.entity_id)
      && isNonBlankString(change.from_location_id)
      && isNonBlankString(change.to_location_id)
    ))
    && Array.isArray(value.possession_changes)
    && value.possession_changes.every((change) => (
      isRecord(change)
      && isNonBlankString(change.object_id)
      && (change.from_actor_id === null || isNonBlankString(change.from_actor_id))
      && (change.to_actor_id === null || isNonBlankString(change.to_actor_id))
    ))
    && Array.isArray(value.actor_state_changes)
    && value.actor_state_changes.every((change) => (
      isRecord(change)
      && isNonBlankString(change.actor_id)
      && (change.fatigue_delta === undefined
        || (typeof change.fatigue_delta === 'number' && Number.isFinite(change.fatigue_delta)))
      && (change.emotion === undefined || isNonBlankString(change.emotion))
    ))
    && Array.isArray(value.belief_changes)
    && value.belief_changes.every((change) => (
      isRecord(change)
      && isNonBlankString(change.actor_id)
      && isNonBlankString(change.new_belief)
    ))
    && Array.isArray(value.thread_advancements)
    && value.thread_advancements.every((change) => (
      isRecord(change)
      && isNonBlankString(change.thread_id)
      && isNonBlankString(change.notes)
    ))
    && Array.isArray(value.reveals_triggered)
    && value.reveals_triggered.every((change) => (
      isRecord(change)
      && isNonBlankString(change.reveal_id)
      && ['foreshadowed', 'unlocked'].includes(String(change.new_status))
    ));
}

export async function readPromotionExtractionResponse(
  response: PromotionExtractionResponse,
): Promise<PromotionExtractionPayload> {
  if (!response.ok) {
    throw new Error(`Mention extraction HTTP failure (${response.status})`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Malformed mention extraction response: invalid JSON');
  }

  if (!isRecord(payload)) {
    throw new Error('Malformed mention extraction response: expected an object');
  }

  if (payload.success !== true) {
    const detail = typeof payload.error === 'string' ? `: ${payload.error}` : '';
    throw new Error(`Mention extraction failed${detail}`);
  }

  if (
    !Array.isArray(payload.mentions)
    || !payload.mentions.every(isPromotionMentionRecord)
    || !Array.isArray(payload.proposedNewEntities)
    || !payload.proposedNewEntities.every(isPromotionProposedEntityRecord)
    || !hasValidStateChanges(payload.stateChanges)
  ) {
    throw new Error('Malformed mention extraction response: incomplete extraction payload');
  }

  return payload as unknown as PromotionExtractionPayload;
}

export function createMentionedObject(
  entity: PromotionProposedEntity,
  currentLocationId: string,
): ObjectEntity {
  return {
    id: entity.id,
    identity: {
      name: entity.name || null,
      working_label: entity.working_label || 'discovered object',
      aliases: entity.aliases || [],
    },
    current_holder_id: null,
    current_location_id: currentLocationId,
    status: 'intact',
    salience: 0.6,
    isPresent: true,
  };
}

export function applyAdmittedPossessionChanges(
  objects: ObjectEntity[],
  changes: PromotionStateChanges['possession_changes'],
  descriptions: string[],
): void {
  for (const change of changes) {
    const object = objects.find((candidate) => candidate.id === change.object_id);
    if (!object) {
      throw new Error(`Possession transition precondition failed: unknown object ${change.object_id}`);
    }
    if (object.current_holder_id !== change.from_actor_id) {
      throw new Error(`Possession transition precondition failed for ${change.object_id}`);
    }
    object.current_holder_id = change.to_actor_id;
    descriptions.push(
      `Possession of ${object.identity.name || object.id} transferred to ${change.to_actor_id || 'unheld'}`,
    );
  }
}

export function restorePromotionSnapshot(
  projects: StoryProject[],
  activeProjectId: string,
  prePromotionSnapshot: StoryProject,
): StoryProject[] {
  return projects.map((project) => (
    project.id === activeProjectId ? prePromotionSnapshot : project
  ));
}
