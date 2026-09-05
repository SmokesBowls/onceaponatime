import type { AuthorSourceDocument, StoryProject } from '../types';

/**
 * Bootstrap Manifest Domain Authority (B1).
 *
 * Governing rule (unchanged from Manuscript Intake):
 *
 *   author-supplied source text = authoritative source material
 *   machine-derived structure   = proposal, not truth
 *
 * Bootstrap admission is the only operation that may convert a reviewed set
 * of proposals into a source-only project's initial structured state
 * (actors/objects/locations/factions, plus the POV/location assignments
 * required to become composition-ready). This module defines the pure
 * domain vocabulary and authority; src/lib/prepareBootstrap.ts performs the
 * atomic application. Neither performs discovery (B2), renders UI (B3), or
 * calls a model provider (B4) -- see MANUSCRIPT_INTAKE_ENGINEERING_REPORT.md
 * and the B1-B4 phase breakdown this repository is following.
 */

// ---------------------------------------------------------------------------
// SourceEvidenceUnit
// ---------------------------------------------------------------------------

/**
 * Noncanonical bookkeeping only. A SourceEvidenceUnit is a stable pointer
 * into an AuthorSourceDocument's exact text -- never a manuscript beat,
 * scene, chapter boundary, or temporal event. It exists purely so a
 * proposal can cite exactly what text it was derived from.
 */
export interface SourceEvidenceUnit {
  readonly sourceDocumentId: string;
  readonly unitId: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly exactText: string;
}

// ---------------------------------------------------------------------------
// Bootstrap proposal categories
// ---------------------------------------------------------------------------

/**
 * Category support matrix for B1 (see MANUSCRIPT_INTAKE_ENGINEERING_REPORT.md
 * follow-up / BOOTSTRAP_MANIFEST_ENGINEERING_REPORT.md for the reasoning):
 *
 * SUPPORTED   actor_proposal, object_proposal, location_proposal,
 *             faction_proposal -- each maps onto real, unambiguous
 *             StoryProject entity fields, including the entity's own
 *             schema-backed initial relationships (an object's initial
 *             location/holder, a faction's initial members) where the type
 *             already has a real slot for that relationship. There is no
 *             separate generic "relationship_proposal" application target:
 *             StoryProject has no top-level relationship collection (only
 *             CodexEntity.relationships, a derived/read-only view, and
 *             MentionRecord.extracted_relationships, a narrower shape
 *             belonging to Promotion Manifest's mention pipeline).
 *
 * UNSUPPORTED fact_proposal, relationship_proposal -- kept unsupported
 *             deliberately, not from oversight:
 *             - relationship_proposal: no canonical StoryProject collection
 *               exists to admit a generic relationship into.
 *             - fact_proposal: project.facts[] membership alone is
 *               presented to the author as "Established Lore" by
 *               CodexView.tsx regardless of a fact's `status` field.
 *               Admitting a bootstrap-discovered fact there would silently
 *               claim epistemic settledness B1 does not have evidence for,
 *               and would say nothing about world-truth membership,
 *               POV knowledge, or belief ownership, all of which are
 *               separate KnowledgeBoundaries concerns this slice does not
 *               touch. Kept unsupported rather than fabricating epistemic
 *               meaning.
 */
export type BootstrapProposalKind =
  | 'actor_proposal'
  | 'object_proposal'
  | 'location_proposal'
  | 'faction_proposal'
  | 'fact_proposal'
  | 'relationship_proposal';

export const SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS: ReadonlySet<BootstrapProposalKind> = new Set([
  'actor_proposal',
  'object_proposal',
  'location_proposal',
  'faction_proposal',
]);

export interface BootstrapActorProposal {
  readonly kind: 'actor_proposal';
  readonly id: string;
  readonly working_label: string;
  readonly name: string | null;
  readonly aliases: string[];
  /** May reference another entity proposal in the same manifest (remapped if that entity is edited) or an already-canonical location. Absent = no initial location established. */
  readonly initial_location_id?: string;
}

export interface BootstrapObjectProposal {
  readonly kind: 'object_proposal';
  readonly id: string;
  readonly working_label: string;
  readonly name: string | null;
  readonly aliases: string[];
  readonly initial_location_id?: string;
  readonly initial_holder_actor_id?: string;
}

export interface BootstrapLocationProposal {
  readonly kind: 'location_proposal';
  readonly id: string;
  readonly working_label: string;
  readonly name: string | null;
  readonly aliases: string[];
  readonly description_summary?: string;
}

export interface BootstrapFactionProposal {
  readonly kind: 'faction_proposal';
  readonly id: string;
  readonly working_label: string;
  readonly name: string | null;
  readonly aliases: string[];
  readonly member_actor_ids?: string[];
}

/** Structurally defined but never applicable in B1 -- see the support matrix above. */
export interface BootstrapFactProposal {
  readonly kind: 'fact_proposal';
  readonly statement: string;
}

/** Structurally defined but never applicable in B1 -- see the support matrix above. */
export interface BootstrapRelationshipProposal {
  readonly kind: 'relationship_proposal';
  readonly type: string;
  readonly source_id: string;
  readonly target_id: string;
}

export type BootstrapProposal =
  | BootstrapActorProposal
  | BootstrapObjectProposal
  | BootstrapLocationProposal
  | BootstrapFactionProposal
  | BootstrapFactProposal
  | BootstrapRelationshipProposal;

export type BootstrapEntityProposal =
  | BootstrapActorProposal
  | BootstrapObjectProposal
  | BootstrapLocationProposal
  | BootstrapFactionProposal;

const ENTITY_PROPOSAL_KINDS: ReadonlySet<BootstrapProposalKind> = new Set([
  'actor_proposal',
  'object_proposal',
  'location_proposal',
  'faction_proposal',
]);

export function isBootstrapEntityProposalKind(kind: BootstrapProposalKind): boolean {
  return ENTITY_PROPOSAL_KINDS.has(kind);
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export type BootstrapDecision = 'pending' | 'approved' | 'edited' | 'rejected';

/**
 * Deterministic B2 review metadata. This explains why discovery surfaced a
 * candidate; it is never an admission decision or a canonical truth score.
 */
export type BootstrapDiscoveryClassification = 'ambiguous' | 'provisional' | 'corroborated';

export interface BootstrapDiscoveryConfidence {
  readonly classification: BootstrapDiscoveryClassification;
  readonly supportingUnitCount: number;
  readonly reasons: readonly string[];
}

// ---------------------------------------------------------------------------
// Manifest entry / manifest
// ---------------------------------------------------------------------------

export interface BootstrapManifestEntry {
  readonly id: string;
  readonly kind: BootstrapProposalKind;
  readonly sourceIndex: number;
  readonly proposed: BootstrapProposal;
  readonly decision: BootstrapDecision;
  readonly admitted?: BootstrapProposal;
  readonly evidence: readonly SourceEvidenceUnit[];
  /** Present only when supplied by discovery; manual/legacy entries remain honestly absent. */
  readonly discoveryConfidence?: BootstrapDiscoveryConfidence;
  readonly supportedForApplication: boolean;
}

export interface BootstrapManifest {
  readonly id: string;
  readonly projectId: string;
  /**
   * Exact, ordered snapshot of every AuthorSourceDocument this manifest was
   * built from -- whole-project coverage (see module docs: B1 binds to the
   * complete project.sourceDocuments array at build time, not a declared
   * subset; bootstrap's purpose is establishing a project's *initial*
   * structure from *all* currently available source material).
   */
  readonly boundSourceDocuments: readonly AuthorSourceDocument[];
  readonly boundSourceFingerprint: string;
  readonly entriesFingerprint: string;
  readonly entries: readonly BootstrapManifestEntry[];
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

/**
 * Explicit, reviewed bootstrap decisions -- never inferred. `null` means
 * "the author has not chosen yet", distinct from any real entity id.
 * prepareBootstrap() requires both to be non-null and to resolve to an
 * admitted entity of the correct kind; it never falls back to "the first
 * admitted actor/location" as a convenience default.
 */
export interface BootstrapAssignments {
  readonly activePovActorId: string | null;
  readonly currentLocationId: string | null;
}

// ---------------------------------------------------------------------------
// Fingerprinting (self-contained; mirrors src/lib/promotionManifest.ts's
// local helpers rather than sharing them, matching existing convention)
// ---------------------------------------------------------------------------

export function deepFreeze<T>(value: T): T {
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

function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot fingerprint a non-finite bootstrap manifest number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(Reflect.get(value, key))}`
    )).join(',')}}`;
  }
  throw new Error(`Cannot fingerprint unsupported bootstrap manifest value type: ${typeof value}`);
}

export function fingerprintSourceDocuments(documents: readonly AuthorSourceDocument[]): string {
  return fingerprintString(stableSerialize(documents), 'bootstrap-source');
}

/**
 * Exact, order-sensitive, field-by-field comparison of two source document
 * lists. This -- not the fingerprint above -- is the primary freshness
 * proof prepareBootstrap() uses: a 32-bit FNV-1a fingerprint is a
 * self-consistency/tamper marker on the manifest object, not a
 * collision-resistant identity claim, so it is never relied on alone to
 * decide staleness. Detects changed text, changed order, a removed
 * document, an added document, and a changed document identity/other field
 * -- every case listed as required, via one uniform check.
 */
export function sourceDocumentsAreIdentical(
  a: readonly AuthorSourceDocument[],
  b: readonly AuthorSourceDocument[],
): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (
      left.id !== right.id
      || left.label !== right.label
      || left.exactText !== right.exactText
      || left.sourceType !== right.sourceType
      || left.importedAt !== right.importedAt
    ) {
      return false;
    }
  }
  return true;
}

interface BootstrapEntrySource {
  readonly kind: BootstrapProposalKind;
  readonly sourceIndex: number;
  readonly proposed: BootstrapProposal;
  readonly evidence: readonly SourceEvidenceUnit[];
  readonly discoveryConfidence?: BootstrapDiscoveryConfidence;
}

function fingerprintEntrySources(entries: readonly BootstrapEntrySource[]): string {
  return fingerprintString(stableSerialize(entries.map((e) => ({
    kind: e.kind,
    sourceIndex: e.sourceIndex,
    proposed: e.proposed,
    evidence: e.evidence,
    ...(e.discoveryConfidence === undefined ? {} : { discoveryConfidence: e.discoveryConfidence }),
  }))), 'bootstrap-entries');
}

export function fingerprintBootstrapAdmission(manifest: BootstrapManifest): string {
  const admission = manifest.entries.map((entry) => (
    entry.decision === 'edited'
      ? { entryId: entry.id, decision: entry.decision, admitted: entry.admitted }
      : { entryId: entry.id, decision: entry.decision }
  ));
  return fingerprintString(stableSerialize(admission), 'bootstrap-admission');
}

export function expectedBootstrapManifestId(
  projectId: string,
  boundSourceFingerprint: string,
  entriesFingerprint: string,
): string {
  return `bootstrap-manifest:${projectId}:${boundSourceFingerprint}:${entriesFingerprint}`;
}

function expectedEntryId(manifestId: string, kind: BootstrapProposalKind, sourceIndex: number): string {
  return `${manifestId}:${kind}:${sourceIndex}`;
}

// ---------------------------------------------------------------------------
// Structural type guards
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
function isNonBlankString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}
function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

export function isSourceEvidenceUnit(value: unknown): value is SourceEvidenceUnit {
  return isRecord(value)
    && isNonBlankString(value.sourceDocumentId)
    && isNonBlankString(value.unitId)
    && Number.isInteger(value.startOffset) && Number(value.startOffset) >= 0
    && Number.isInteger(value.endOffset) && Number(value.endOffset) >= Number(value.startOffset)
    && isString(value.exactText);
}

export function isBootstrapActorProposal(value: unknown): value is BootstrapActorProposal {
  return isRecord(value)
    && value.kind === 'actor_proposal'
    && isNonBlankString(value.id)
    && isNonBlankString(value.working_label)
    && isNullableString(value.name)
    && isStringArray(value.aliases)
    && (value.initial_location_id === undefined || isNonBlankString(value.initial_location_id));
}

export function isBootstrapObjectProposal(value: unknown): value is BootstrapObjectProposal {
  return isRecord(value)
    && value.kind === 'object_proposal'
    && isNonBlankString(value.id)
    && isNonBlankString(value.working_label)
    && isNullableString(value.name)
    && isStringArray(value.aliases)
    && (value.initial_location_id === undefined || isNonBlankString(value.initial_location_id))
    && (value.initial_holder_actor_id === undefined || isNonBlankString(value.initial_holder_actor_id));
}

export function isBootstrapLocationProposal(value: unknown): value is BootstrapLocationProposal {
  return isRecord(value)
    && value.kind === 'location_proposal'
    && isNonBlankString(value.id)
    && isNonBlankString(value.working_label)
    && isNullableString(value.name)
    && isStringArray(value.aliases)
    && (value.description_summary === undefined || isString(value.description_summary));
}

export function isBootstrapFactionProposal(value: unknown): value is BootstrapFactionProposal {
  return isRecord(value)
    && value.kind === 'faction_proposal'
    && isNonBlankString(value.id)
    && isNonBlankString(value.working_label)
    && isNullableString(value.name)
    && isStringArray(value.aliases)
    && (value.member_actor_ids === undefined || isStringArray(value.member_actor_ids));
}

export function isBootstrapFactProposal(value: unknown): value is BootstrapFactProposal {
  return isRecord(value) && value.kind === 'fact_proposal' && isNonBlankString(value.statement);
}

export function isBootstrapRelationshipProposal(value: unknown): value is BootstrapRelationshipProposal {
  return isRecord(value)
    && value.kind === 'relationship_proposal'
    && isNonBlankString(value.type)
    && isNonBlankString(value.source_id)
    && isNonBlankString(value.target_id);
}

export function isProposalForKind(kind: BootstrapProposalKind, proposal: unknown): proposal is BootstrapProposal {
  switch (kind) {
    case 'actor_proposal': return isBootstrapActorProposal(proposal);
    case 'object_proposal': return isBootstrapObjectProposal(proposal);
    case 'location_proposal': return isBootstrapLocationProposal(proposal);
    case 'faction_proposal': return isBootstrapFactionProposal(proposal);
    case 'fact_proposal': return isBootstrapFactProposal(proposal);
    case 'relationship_proposal': return isBootstrapRelationshipProposal(proposal);
  }
}

export function isBootstrapEntityProposal(value: BootstrapProposal): value is BootstrapEntityProposal {
  return isBootstrapEntityProposalKind(value.kind as BootstrapProposalKind);
}

// ---------------------------------------------------------------------------
// Discovery payload (B1's consumed input shape; B2 will be what produces one)
// ---------------------------------------------------------------------------

export interface BootstrapDiscoveryEntry {
  readonly proposed: BootstrapProposal;
  readonly evidence: readonly SourceEvidenceUnit[];
  readonly discoveryConfidence?: BootstrapDiscoveryConfidence;
}

export interface BootstrapDiscoveryPayload {
  readonly entries: readonly BootstrapDiscoveryEntry[];
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function createEntry(manifestId: string, sourceIndex: number, discoveryEntry: BootstrapDiscoveryEntry): BootstrapManifestEntry {
  return {
    id: expectedEntryId(manifestId, discoveryEntry.proposed.kind, sourceIndex),
    kind: discoveryEntry.proposed.kind,
    sourceIndex,
    proposed: structuredClone(discoveryEntry.proposed),
    decision: 'pending',
    evidence: structuredClone(discoveryEntry.evidence),
    ...(discoveryEntry.discoveryConfidence === undefined
      ? {}
      : { discoveryConfidence: structuredClone(discoveryEntry.discoveryConfidence) }),
    supportedForApplication: SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS.has(discoveryEntry.proposed.kind),
  };
}

/**
 * Builds a BootstrapManifest bound to the exact, whole, current
 * project.sourceDocuments state and the given discovery payload. Pure: does
 * not mutate `project` or `discovery`.
 */
export function buildBootstrapManifest(
  project: StoryProject,
  discovery: BootstrapDiscoveryPayload,
): BootstrapManifest {
  const boundSourceDocuments = structuredClone(project.sourceDocuments ?? []);
  const boundSourceFingerprint = fingerprintSourceDocuments(boundSourceDocuments);

  const entrySources = discovery.entries.map((entry) => ({
    kind: entry.proposed.kind,
    sourceIndex: 0, // placeholder, replaced below once grouped
    proposed: entry.proposed,
    evidence: entry.evidence,
    ...(entry.discoveryConfidence === undefined ? {} : { discoveryConfidence: entry.discoveryConfidence }),
  }));
  // sourceIndex is scoped per-kind (mirrors promotionManifest.ts's per-category indexing).
  const indexByKind = new Map<BootstrapProposalKind, number>();
  for (const source of entrySources) {
    const next = indexByKind.get(source.kind) ?? 0;
    source.sourceIndex = next;
    indexByKind.set(source.kind, next + 1);
  }

  const entriesFingerprint = fingerprintEntrySources(entrySources);
  const id = expectedBootstrapManifestId(project.id, boundSourceFingerprint, entriesFingerprint);

  const entries = discovery.entries.map((discoveryEntry, i) => (
    createEntry(id, entrySources[i].sourceIndex, discoveryEntry)
  ));

  return deepFreeze({
    id,
    projectId: project.id,
    boundSourceDocuments,
    boundSourceFingerprint,
    entriesFingerprint,
    entries,
  });
}

// ---------------------------------------------------------------------------
// Decision transitions
// ---------------------------------------------------------------------------

export function decideBootstrapManifestEntry(
  manifest: BootstrapManifest,
  entryId: string,
  decision: BootstrapDecision,
  admitted?: BootstrapProposal,
): BootstrapManifest {
  const target = manifest.entries.find((entry) => entry.id === entryId);
  if (!target) {
    throw new Error(`Unknown Bootstrap Manifest entry: ${entryId}`);
  }
  if (decision === 'edited') {
    if (admitted === undefined) {
      throw new Error(`Edited Bootstrap Manifest entry ${entryId} requires a separate admitted value`);
    }
    if (!isProposalForKind(target.kind, admitted)) {
      throw new Error(`Edited Bootstrap Manifest entry ${entryId} has an admitted value of the wrong kind`);
    }
  } else if (admitted !== undefined) {
    throw new Error('Only an edited Bootstrap Manifest entry may carry an admitted value');
  }

  const entries = manifest.entries.map((entry): BootstrapManifestEntry => {
    if (entry.id !== entryId) return structuredClone(entry);
    return {
      id: entry.id,
      kind: entry.kind,
      sourceIndex: entry.sourceIndex,
      proposed: structuredClone(entry.proposed),
      decision,
      evidence: structuredClone(entry.evidence),
      ...(entry.discoveryConfidence === undefined
        ? {}
        : { discoveryConfidence: structuredClone(entry.discoveryConfidence) }),
      supportedForApplication: entry.supportedForApplication,
      ...(decision === 'edited' && admitted !== undefined ? { admitted: structuredClone(admitted) } : {}),
    };
  });

  return deepFreeze({ ...structuredClone(manifest), entries });
}

// ---------------------------------------------------------------------------
// Structural validation
// ---------------------------------------------------------------------------

export function validateBootstrapManifestStructure(manifest: BootstrapManifest): void {
  if (!manifest.id || !manifest.projectId) {
    throw new Error('Malformed Bootstrap Manifest identity');
  }
  const calculatedBoundSourceFingerprint = fingerprintSourceDocuments(manifest.boundSourceDocuments);
  if (manifest.boundSourceFingerprint !== calculatedBoundSourceFingerprint) {
    throw new Error('Malformed Bootstrap Manifest source fingerprint');
  }

  const boundDocIds = new Set<string>();
  for (const doc of manifest.boundSourceDocuments) {
    if (!isNonBlankString(doc.id) || typeof doc.exactText !== 'string') {
      throw new Error('Malformed Bootstrap Manifest bound source document');
    }
    if (boundDocIds.has(doc.id)) {
      throw new Error(`Malformed Bootstrap Manifest: duplicate bound source document ${doc.id}`);
    }
    boundDocIds.add(doc.id);
  }

  const entrySources = manifest.entries.map((entry) => ({
    kind: entry.kind,
    sourceIndex: entry.sourceIndex,
    proposed: entry.proposed,
    evidence: entry.evidence,
    ...(entry.discoveryConfidence === undefined ? {} : { discoveryConfidence: entry.discoveryConfidence }),
  }));
  const calculatedEntriesFingerprint = fingerprintEntrySources(entrySources);
  if (manifest.entriesFingerprint !== calculatedEntriesFingerprint) {
    throw new Error('Malformed Bootstrap Manifest entries fingerprint');
  }
  if (manifest.id !== expectedBootstrapManifestId(
    manifest.projectId,
    manifest.boundSourceFingerprint,
    manifest.entriesFingerprint,
  )) {
    throw new Error('Malformed Bootstrap Manifest stable identity');
  }

  const entryIds = new Set<string>();
  for (const entry of manifest.entries) {
    if (entryIds.has(entry.id)) {
      throw new Error(`Malformed Bootstrap Manifest: duplicate entry ${entry.id}`);
    }
    entryIds.add(entry.id);
    if (!Number.isInteger(entry.sourceIndex) || entry.sourceIndex < 0) {
      throw new Error(`Malformed Bootstrap Manifest source index for ${entry.id}`);
    }
    if (entry.id !== expectedEntryId(manifest.id, entry.kind, entry.sourceIndex)) {
      throw new Error(`Malformed Bootstrap Manifest entry identity: ${entry.id}`);
    }
    if (!isProposalForKind(entry.kind, entry.proposed)) {
      throw new Error(`Malformed Bootstrap Manifest proposal: ${entry.id}`);
    }
    if (entry.supportedForApplication !== SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS.has(entry.kind)) {
      throw new Error(`Malformed Bootstrap Manifest application support: ${entry.id}`);
    }
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
      throw new Error(`Malformed Bootstrap Manifest: entry ${entry.id} must cite at least one evidence unit`);
    }
    for (const unit of entry.evidence) {
      if (!isSourceEvidenceUnit(unit)) {
        throw new Error(`Malformed Bootstrap Manifest evidence unit on entry ${entry.id}`);
      }
      if (!boundDocIds.has(unit.sourceDocumentId)) {
        throw new Error(
          `Malformed Bootstrap Manifest: entry ${entry.id} cites evidence from an unbound source document ${unit.sourceDocumentId}`,
        );
      }
      const sourceDoc = manifest.boundSourceDocuments.find((doc) => doc.id === unit.sourceDocumentId);
      const actualSlice = sourceDoc?.exactText.slice(unit.startOffset, unit.endOffset);
      if (actualSlice !== unit.exactText) {
        throw new Error(
          `Malformed Bootstrap Manifest: entry ${entry.id} evidence exactText does not match the bound source document at [${unit.startOffset}, ${unit.endOffset})`,
        );
      }
    }
    if (entry.discoveryConfidence !== undefined) {
      const confidence = entry.discoveryConfidence;
      if (!isRecord(confidence)) {
        throw new Error(`Malformed Bootstrap Manifest discovery confidence on entry ${entry.id}`);
      }
      if (
        typeof confidence.classification !== 'string'
        || !['ambiguous', 'provisional', 'corroborated'].includes(confidence.classification)
      ) {
        throw new Error(`Malformed Bootstrap Manifest discovery confidence classification on entry ${entry.id}`);
      }
      if (!Number.isInteger(confidence.supportingUnitCount) || Number(confidence.supportingUnitCount) <= 0) {
        throw new Error(`Malformed Bootstrap Manifest discovery confidence supportingUnitCount on entry ${entry.id}`);
      }
      const distinctEvidenceUnitCount = new Set(entry.evidence.map((unit) => unit.unitId)).size;
      if (confidence.supportingUnitCount !== distinctEvidenceUnitCount) {
        throw new Error(
          `Malformed Bootstrap Manifest discovery confidence supportingUnitCount on entry ${entry.id}: `
          + `expected ${distinctEvidenceUnitCount} distinct evidence units`,
        );
      }
      if (
        !Array.isArray(confidence.reasons)
        || confidence.reasons.length === 0
        || !confidence.reasons.every((reason) => (
          typeof reason === 'string' && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(reason)
        ))
      ) {
        throw new Error(`Malformed Bootstrap Manifest discovery confidence reasons on entry ${entry.id}`);
      }
    }
    if (!['pending', 'approved', 'edited', 'rejected'].includes(entry.decision)) {
      throw new Error(`Malformed Bootstrap Manifest decision: ${entry.id}`);
    }
    if (entry.decision === 'edited') {
      if (entry.admitted === undefined || !isProposalForKind(entry.kind, entry.admitted)) {
        throw new Error(`Malformed edited Bootstrap Manifest entry: ${entry.id}`);
      }
    } else if (entry.admitted !== undefined) {
      throw new Error(`Malformed Bootstrap Manifest entry carries an unauthorized admitted value: ${entry.id}`);
    }
  }
}
