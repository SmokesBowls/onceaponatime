import type { CandidateGeneration, MentionRecord, StoryProject } from '../types';
import type {
  PromotionExtractionPayload,
  PromotionProposedEntity,
  PromotionStateChanges,
} from './promotionIntegrity';
import {
  isPromotionMentionRecord,
  isPromotionProposedEntityRecord,
} from './promotionIntegrity';

export type AdmissionDecision = 'pending' | 'approved' | 'edited' | 'rejected';

export type PromotionManifestKind =
  | 'entity_proposal'
  | 'location_change'
  | 'possession_change'
  | 'actor_state_change'
  | 'belief_change'
  | 'thread_advancement'
  | 'reveal_change';

export type PromotionManifestProposal =
  | PromotionProposedEntity
  | PromotionStateChanges['location_changes'][number]
  | PromotionStateChanges['possession_changes'][number]
  | PromotionStateChanges['actor_state_changes'][number]
  | PromotionStateChanges['belief_changes'][number]
  | PromotionStateChanges['thread_advancements'][number]
  | PromotionStateChanges['reveals_triggered'][number];

export interface PromotionManifestEntry {
  readonly id: string;
  readonly kind: PromotionManifestKind;
  readonly sourceIndex: number;
  readonly proposed: PromotionManifestProposal;
  readonly decision: AdmissionDecision;
  readonly admitted?: PromotionManifestProposal;
  readonly evidence: readonly MentionRecord[];
  readonly supportedForApplication: boolean;
}

export interface PromotionManifest {
  readonly id: string;
  readonly projectId: string;
  readonly candidateId: string;
  readonly boundReviewProse: string;
  readonly reviewProseFingerprint: string;
  readonly sourceFingerprint: string;
  readonly sourceMentions: readonly MentionRecord[];
  readonly entries: readonly PromotionManifestEntry[];
}

interface PromotionManifestEntrySource {
  readonly kind: PromotionManifestKind;
  readonly sourceIndex: number;
  readonly proposed: PromotionManifestProposal;
  readonly evidence: readonly MentionRecord[];
  readonly supportedForApplication: boolean;
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

function fingerprintString(value: string, label: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${label}-fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}-${value.length}`;
}

export function fingerprintReviewProse(prose: string): string {
  return fingerprintString(prose, 'review-prose');
}

function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot fingerprint a non-finite manifest number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(Reflect.get(value, key))}`
    )).join(',')}}`;
  }
  throw new Error(`Cannot fingerprint unsupported manifest value type: ${typeof value}`);
}

function fingerprintManifestSource(
  sourceMentions: readonly MentionRecord[],
  entries: readonly PromotionManifestEntrySource[],
): string {
  const source = {
    sourceMentions,
    entries: entries.map((entry) => ({
      kind: entry.kind,
      sourceIndex: entry.sourceIndex,
      proposed: entry.proposed,
      evidence: entry.evidence,
      supportedForApplication: entry.supportedForApplication,
    })),
  };
  return fingerprintString(stableSerialize(source), 'manifest-source');
}

export function fingerprintManifestAdmission(manifest: PromotionManifest): string {
  const admission = manifest.entries.map((entry) => (
    entry.decision === 'edited'
      ? { entryId: entry.id, decision: entry.decision, admitted: entry.admitted }
      : { entryId: entry.id, decision: entry.decision }
  ));
  return fingerprintString(stableSerialize(admission), 'manifest-admission');
}

export function expectedPromotionManifestId(
  projectId: string,
  candidateId: string,
  boundReviewProse: string,
  sourceFingerprint: string,
): string {
  return `promotion-manifest:${projectId}:${candidateId}:${fingerprintReviewProse(boundReviewProse)}:${sourceFingerprint}`;
}

function expectedEntryId(
  manifestId: string,
  kind: PromotionManifestKind,
  sourceIndex: number,
): string {
  return `${manifestId}:${kind}:${sourceIndex}`;
}

function evidenceForEntity(
  entity: PromotionProposedEntity,
  mentions: readonly MentionRecord[],
): MentionRecord[] {
  return mentions.filter((mention) => mention.entity_id === entity.id).map((mention) => structuredClone(mention));
}

function applicationSupport(kind: PromotionManifestKind, proposed: PromotionManifestProposal): boolean {
  if (kind === 'entity_proposal') {
    return isPromotionProposedEntity(proposed) && (proposed.type === 'actor' || proposed.type === 'object');
  }
  return kind === 'location_change'
    || kind === 'possession_change'
    || kind === 'actor_state_change'
    || kind === 'belief_change';
}

function createEntrySource(
  kind: PromotionManifestKind,
  sourceIndex: number,
  proposed: PromotionManifestProposal,
  evidence: readonly MentionRecord[] = [],
): PromotionManifestEntrySource {
  return {
    kind,
    sourceIndex,
    proposed: structuredClone(proposed),
    evidence: structuredClone(evidence),
    supportedForApplication: applicationSupport(kind, proposed),
  };
}

function createEntry(manifestId: string, source: PromotionManifestEntrySource): PromotionManifestEntry {
  return {
    id: expectedEntryId(manifestId, source.kind, source.sourceIndex),
    ...structuredClone(source),
    decision: 'pending',
  };
}

export function buildPromotionManifest(
  project: StoryProject,
  candidate: CandidateGeneration,
  extraction: PromotionExtractionPayload,
): PromotionManifest {
  const boundReviewProse = candidate.stage2Prose;
  const sourceMentions = structuredClone(extraction.mentions);
  const entrySources: PromotionManifestEntrySource[] = [
    ...extraction.proposedNewEntities.map((proposal, index) => (
      createEntrySource('entity_proposal', index, proposal, evidenceForEntity(proposal, sourceMentions))
    )),
    ...extraction.stateChanges.location_changes.map((proposal, index) => (
      createEntrySource('location_change', index, proposal)
    )),
    ...extraction.stateChanges.possession_changes.map((proposal, index) => (
      createEntrySource('possession_change', index, proposal)
    )),
    ...extraction.stateChanges.actor_state_changes.map((proposal, index) => (
      createEntrySource('actor_state_change', index, proposal)
    )),
    ...extraction.stateChanges.belief_changes.map((proposal, index) => (
      createEntrySource('belief_change', index, proposal)
    )),
    ...extraction.stateChanges.thread_advancements.map((proposal, index) => (
      createEntrySource('thread_advancement', index, proposal)
    )),
    ...extraction.stateChanges.reveals_triggered.map((proposal, index) => (
      createEntrySource('reveal_change', index, proposal)
    )),
  ];
  const sourceFingerprint = fingerprintManifestSource(sourceMentions, entrySources);
  const id = expectedPromotionManifestId(
    project.id,
    candidate.id,
    boundReviewProse,
    sourceFingerprint,
  );
  const entries = entrySources.map((source) => createEntry(id, source));

  return deepFreeze({
    id,
    projectId: project.id,
    candidateId: candidate.id,
    boundReviewProse,
    reviewProseFingerprint: fingerprintReviewProse(boundReviewProse),
    sourceFingerprint,
    sourceMentions,
    entries,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function isPromotionProposedEntity(value: unknown): value is PromotionProposedEntity {
  return isPromotionProposedEntityRecord(value);
}

export function isLocationChange(value: unknown): value is PromotionStateChanges['location_changes'][number] {
  return isRecord(value)
    && isString(value.entity_id)
    && isString(value.from_location_id)
    && isString(value.to_location_id);
}

export function isPossessionChange(value: unknown): value is PromotionStateChanges['possession_changes'][number] {
  return isRecord(value)
    && isString(value.object_id)
    && isNullableString(value.from_actor_id)
    && isNullableString(value.to_actor_id);
}

export function isActorStateChange(value: unknown): value is PromotionStateChanges['actor_state_changes'][number] {
  return isRecord(value)
    && isString(value.actor_id)
    && (value.fatigue_delta === undefined
      || (typeof value.fatigue_delta === 'number' && Number.isFinite(value.fatigue_delta)))
    && (value.emotion === undefined || isString(value.emotion))
    && (value.fatigue_delta !== undefined || value.emotion !== undefined);
}

export function isBeliefChange(value: unknown): value is PromotionStateChanges['belief_changes'][number] {
  return isRecord(value) && isString(value.actor_id) && isString(value.new_belief);
}

export function isThreadAdvancement(value: unknown): value is PromotionStateChanges['thread_advancements'][number] {
  return isRecord(value) && isString(value.thread_id) && isString(value.notes);
}

export function isRevealChange(value: unknown): value is PromotionStateChanges['reveals_triggered'][number] {
  return isRecord(value)
    && isString(value.reveal_id)
    && (value.new_status === 'foreshadowed' || value.new_status === 'unlocked');
}

export function isProposalForKind(
  kind: PromotionManifestKind,
  proposal: unknown,
): proposal is PromotionManifestProposal {
  switch (kind) {
    case 'entity_proposal': return isPromotionProposedEntity(proposal);
    case 'location_change': return isLocationChange(proposal);
    case 'possession_change': return isPossessionChange(proposal);
    case 'actor_state_change': return isActorStateChange(proposal);
    case 'belief_change': return isBeliefChange(proposal);
    case 'thread_advancement': return isThreadAdvancement(proposal);
    case 'reveal_change': return isRevealChange(proposal);
  }
}

export function decidePromotionManifestEntry(
  manifest: PromotionManifest,
  entryId: string,
  decision: AdmissionDecision,
  admitted?: PromotionManifestProposal,
): PromotionManifest {
  const target = manifest.entries.find((entry) => entry.id === entryId);
  if (!target) {
    throw new Error(`Unknown Promotion Manifest entry: ${entryId}`);
  }
  if (decision === 'edited') {
    if (admitted === undefined) {
      throw new Error(`Edited Promotion Manifest entry ${entryId} requires a separate admitted value`);
    }
    if (!isProposalForKind(target.kind, admitted)) {
      throw new Error(`Edited Promotion Manifest entry ${entryId} has an admitted value of the wrong kind`);
    }
  } else if (admitted !== undefined) {
    throw new Error(`Only an edited Promotion Manifest entry may carry an admitted value`);
  }

  const entries = manifest.entries.map((entry): PromotionManifestEntry => {
    if (entry.id !== entryId) return structuredClone(entry);
    const updated: PromotionManifestEntry = {
      id: entry.id,
      kind: entry.kind,
      sourceIndex: entry.sourceIndex,
      proposed: structuredClone(entry.proposed),
      decision,
      evidence: structuredClone(entry.evidence),
      supportedForApplication: entry.supportedForApplication,
      ...(decision === 'edited' && admitted !== undefined ? { admitted: structuredClone(admitted) } : {}),
    };
    return updated;
  });

  return deepFreeze({
    ...structuredClone(manifest),
    entries,
  });
}

export function validatePromotionManifestStructure(manifest: PromotionManifest): void {
  if (!manifest.id || !manifest.projectId || !manifest.candidateId) {
    throw new Error('Malformed Promotion Manifest identity');
  }
  if (manifest.reviewProseFingerprint !== fingerprintReviewProse(manifest.boundReviewProse)) {
    throw new Error('Malformed Promotion Manifest review-prose fingerprint');
  }
  const calculatedSourceFingerprint = fingerprintManifestSource(manifest.sourceMentions, manifest.entries);
  if (manifest.sourceFingerprint !== calculatedSourceFingerprint) {
    throw new Error('Malformed Promotion Manifest source fingerprint');
  }
  if (manifest.id !== expectedPromotionManifestId(
    manifest.projectId,
    manifest.candidateId,
    manifest.boundReviewProse,
    manifest.sourceFingerprint,
  )) {
    throw new Error('Malformed Promotion Manifest stable identity');
  }

  const entryIds = new Set<string>();
  const mentionIds = new Set<string>();
  for (const mention of manifest.sourceMentions) {
    if (!isPromotionMentionRecord(mention)) {
      throw new Error('Malformed Promotion Manifest source mention');
    }
    if (mentionIds.has(mention.id)) {
      throw new Error(`Malformed Promotion Manifest: duplicate source mention ${mention.id}`);
    }
    mentionIds.add(mention.id);
  }
  for (const entry of manifest.entries) {
    if (entryIds.has(entry.id)) {
      throw new Error(`Malformed Promotion Manifest: duplicate entry ${entry.id}`);
    }
    entryIds.add(entry.id);
    if (!Number.isInteger(entry.sourceIndex) || entry.sourceIndex < 0) {
      throw new Error(`Malformed Promotion Manifest source index for ${entry.id}`);
    }
    if (entry.id !== expectedEntryId(manifest.id, entry.kind, entry.sourceIndex)) {
      throw new Error(`Malformed Promotion Manifest entry identity: ${entry.id}`);
    }
    if (!isProposalForKind(entry.kind, entry.proposed)) {
      throw new Error(`Malformed Promotion Manifest proposal: ${entry.id}`);
    }
    if (!Array.isArray(entry.evidence) || !entry.evidence.every(isPromotionMentionRecord)) {
      throw new Error(`Malformed Promotion Manifest evidence: ${entry.id}`);
    }
    if (entry.supportedForApplication !== applicationSupport(entry.kind, entry.proposed)) {
      throw new Error(`Malformed Promotion Manifest application support: ${entry.id}`);
    }
    if (!['pending', 'approved', 'edited', 'rejected'].includes(entry.decision)) {
      throw new Error(`Malformed Promotion Manifest decision: ${entry.id}`);
    }
    if (entry.decision === 'edited') {
      if (entry.admitted === undefined || !isProposalForKind(entry.kind, entry.admitted)) {
        throw new Error(`Malformed edited Promotion Manifest entry: ${entry.id}`);
      }
    } else if (entry.admitted !== undefined) {
      throw new Error(`Malformed Promotion Manifest entry carries an unauthorized admitted value: ${entry.id}`);
    }
  }
}
