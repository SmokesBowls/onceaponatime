import type { ActorEntity, FactionEntity, LocationEntity, ObjectEntity, StoryProject } from '../types';
import { assessCompositionReadiness } from './compositionReadiness';
import {
  deepFreeze,
  fingerprintBootstrapAdmission,
  isBootstrapEntityProposal,
  isBootstrapEntityProposalKind,
  sourceDocumentsAreIdentical,
  validateBootstrapManifestStructure,
  type BootstrapAssignments,
  type BootstrapEntityProposal,
  type BootstrapManifest,
  type BootstrapManifestEntry,
  type BootstrapProposal,
  type BootstrapProposalKind,
} from './bootstrapManifest';

type EntityKind = 'actor' | 'object' | 'location' | 'faction';

function entityKindFromProposalKind(kind: BootstrapProposalKind): EntityKind {
  switch (kind) {
    case 'actor_proposal': return 'actor';
    case 'object_proposal': return 'object';
    case 'location_proposal': return 'location';
    case 'faction_proposal': return 'faction';
    default:
      throw new Error(`Bootstrap Manifest entry kind has no application target: ${kind}`);
  }
}

export interface BootstrapReceiptEntry {
  readonly entryId: string;
  readonly kind: BootstrapProposalKind;
  readonly decision: BootstrapManifestEntry['decision'];
  readonly supportedForApplication: boolean;
  readonly proposed: BootstrapProposal;
  readonly admitted: BootstrapProposal | null;
  readonly applied: boolean;
}

export interface BootstrapReceipt {
  readonly id: string;
  readonly manifestId: string;
  readonly projectId: string;
  readonly boundSourceDocumentIds: readonly string[];
  readonly boundSourceFingerprint: string;
  readonly admissionFingerprint: string;
  readonly assignments: { readonly activePovActorId: string; readonly currentLocationId: string };
  readonly entries: readonly BootstrapReceiptEntry[];
  readonly appliedEntryIds: readonly string[];
  readonly unsupportedEntryIds: readonly string[];
  readonly resultingProjectFingerprint: string;
  readonly transactionTimestamp: number;
}

export interface PreparedBootstrap {
  readonly nextProject: StoryProject;
  readonly preBootstrapSnapshot: StoryProject;
  readonly bootstrapReceipt: BootstrapReceipt;
}

function failWrongProposal(entry: BootstrapManifestEntry): never {
  throw new Error(`Malformed Bootstrap Manifest proposal kind for ${entry.id}`);
}

/**
 * Deliberately stricter than src/lib/preparePromotion.ts::admittedProposal
 * here: Promotion Manifest lets an unsupported entry sit pending forever,
 * treating "never decided" the same as "rejected". B1 does not -- pending
 * means "the author has not decided", which is a different fact than
 * "explicitly do not admit", and bootstrap is establishing a project's
 * initial structured world, not reviewing an incremental delta against
 * already-canonical state. So every pending entry blocks commit here,
 * supported or unsupported; the only way an unsupported proposal becomes
 * harmless at commit time is an explicit `rejected`. This is a recorded,
 * deliberate cross-domain inconsistency with Promotion Manifest, not an
 * oversight -- see BOOTSTRAP_MANIFEST_ENGINEERING_REPORT.md.
 */
function admittedProposal(entry: BootstrapManifestEntry): BootstrapProposal | undefined {
  if (entry.decision === 'pending') {
    throw new Error(
      entry.supportedForApplication
        ? `Pending supported Bootstrap Manifest entry cannot bootstrap: ${entry.id}`
        : `Pending unsupported Bootstrap Manifest entry cannot bootstrap: ${entry.id} `
          + '(an unsupported proposal must be explicitly rejected, not merely left undecided)',
    );
  }
  if (!entry.supportedForApplication) {
    if (entry.decision === 'approved' || entry.decision === 'edited') {
      throw new Error(`Unsupported Bootstrap Manifest entry cannot be admitted: ${entry.id}`);
    }
    return undefined; // rejected: the only terminal, harmless decision for an unsupported entry
  }
  if (entry.decision === 'rejected') return undefined;
  if (entry.decision === 'approved') return entry.proposed;
  if (entry.admitted === undefined) {
    throw new Error(`Edited Bootstrap Manifest entry requires an admitted value: ${entry.id}`);
  }
  return entry.admitted;
}

function canonicalKindIndex(project: StoryProject): Map<string, EntityKind> {
  const index = new Map<string, EntityKind>();
  for (const actor of project.actors) index.set(actor.id, 'actor');
  for (const object of project.objects) index.set(object.id, 'object');
  for (const location of project.locations) index.set(location.id, 'location');
  for (const faction of project.factions) index.set(faction.id, 'faction');
  return index;
}

interface BootstrapIdentities {
  readonly proposedIds: ReadonlySet<string>;
  readonly admittedIdByOriginalId: ReadonlyMap<string, string>;
  readonly admittedKindByOriginalId: ReadonlyMap<string, EntityKind>;
  /** Final admitted id -> kind. Lets a reference (including an assignment) name an already-admitted id directly, not only the pre-edit proposed id it may have started as. */
  readonly admittedKindByAdmittedId: ReadonlyMap<string, EntityKind>;
}

/**
 * Resolves every entity-kind proposal's admission outcome up front, before
 * anything is applied to a draft. Mirrors
 * src/lib/preparePromotion.ts::validateProposedEntityIdentities, generalized
 * across all four supported entity kinds (an actor's initial_location_id,
 * an object's initial_holder_actor_id, and a faction's member_actor_ids can
 * each reference any of them).
 */
function resolveBootstrapIdentities(
  manifest: BootstrapManifest,
  canonicalKindById: ReadonlyMap<string, EntityKind>,
): BootstrapIdentities {
  const originalOwners = new Map<string, string>();
  const proposedIds = new Set<string>();
  for (const entry of manifest.entries) {
    if (!isBootstrapEntityProposalKind(entry.kind)) continue;
    if (!isBootstrapEntityProposal(entry.proposed)) failWrongProposal(entry);
    const proposedId = entry.proposed.id;
    proposedIds.add(proposedId);
    if (canonicalKindById.has(proposedId) || originalOwners.has(proposedId)) {
      throw new Error(`Bootstrap entity proposal identity precondition failed: duplicate entity ${proposedId}`);
    }
    originalOwners.set(proposedId, entry.id);
  }

  const admittedIdByOriginalId = new Map<string, string>();
  const admittedKindByOriginalId = new Map<string, EntityKind>();
  const admittedKindByAdmittedId = new Map<string, EntityKind>();
  const admittedIds = new Set<string>();
  for (const entry of manifest.entries) {
    if (!isBootstrapEntityProposalKind(entry.kind)) continue;
    const admitted = admittedProposal(entry);
    if (admitted === undefined) continue;
    if (!isBootstrapEntityProposal(admitted)) failWrongProposal(entry);
    if (!isBootstrapEntityProposal(entry.proposed)) failWrongProposal(entry);
    const originalId = entry.proposed.id;
    const otherOriginalOwner = originalOwners.get(admitted.id);
    if (
      canonicalKindById.has(admitted.id)
      || admittedIds.has(admitted.id)
      || (otherOriginalOwner !== undefined && otherOriginalOwner !== entry.id)
    ) {
      throw new Error(`Bootstrap entity admission identity precondition failed: duplicate entity ${admitted.id}`);
    }
    admittedIds.add(admitted.id);
    admittedIdByOriginalId.set(originalId, admitted.id);
    admittedKindByOriginalId.set(originalId, entityKindFromProposalKind(entry.kind));
    admittedKindByAdmittedId.set(admitted.id, entityKindFromProposalKind(entry.kind));
  }

  return { proposedIds, admittedIdByOriginalId, admittedKindByOriginalId, admittedKindByAdmittedId };
}

type ResolvedEntityReference =
  | { readonly status: 'admitted'; readonly id: string; readonly entityKind: EntityKind }
  | { readonly status: 'rejected' }
  | { readonly status: 'unknown' };

/**
 * Resolves any id referenced by an admitted proposal or by the bootstrap
 * assignments (an actor's initial_location_id, an object's
 * initial_holder_actor_id, a faction member, the POV/location assignment)
 * to its final admitted id and kind. An id that was proposed in this
 * manifest but not admitted resolves to 'rejected' -- distinct from
 * 'unknown', which is an id that was never proposed and is not already
 * canonical either. Both are refused by every caller; there is no silent
 * drop for a reference that was explicitly set.
 */
function resolveEntityReference(
  id: string,
  identities: BootstrapIdentities,
  canonicalKindById: ReadonlyMap<string, EntityKind>,
): ResolvedEntityReference {
  // An id may directly name an entity already admitted under that exact id
  // (including one that was renamed via an edit -- its post-edit id, not its
  // pre-edit proposed id). Checked first: admitted-id uniqueness is enforced
  // globally against both canonical and proposed ids in resolveBootstrapIdentities,
  // so this can never collide ambiguously with the proposed-id case below.
  const directKind = identities.admittedKindByAdmittedId.get(id);
  if (directKind !== undefined) {
    return { status: 'admitted', id, entityKind: directKind };
  }
  if (identities.proposedIds.has(id)) {
    const admittedId = identities.admittedIdByOriginalId.get(id);
    if (admittedId === undefined) return { status: 'rejected' };
    return { status: 'admitted', id: admittedId, entityKind: identities.admittedKindByOriginalId.get(id)! };
  }
  const canonicalKind = canonicalKindById.get(id);
  if (canonicalKind === undefined) return { status: 'unknown' };
  return { status: 'admitted', id, entityKind: canonicalKind };
}

function requireResolvedReference(
  id: string,
  expectedKind: EntityKind,
  identities: BootstrapIdentities,
  canonicalKindById: ReadonlyMap<string, EntityKind>,
  describeFailure: (resolved: ResolvedEntityReference) => string,
): string {
  const resolved = resolveEntityReference(id, identities, canonicalKindById);
  if (resolved.status !== 'admitted' || resolved.entityKind !== expectedKind) {
    throw new Error(describeFailure(resolved));
  }
  return resolved.id;
}

function applyActorProposal(
  draft: StoryProject,
  proposal: Extract<BootstrapEntityProposal, { kind: 'actor_proposal' }>,
  identities: BootstrapIdentities,
  canonicalKindById: ReadonlyMap<string, EntityKind>,
  descriptions: string[],
): void {
  const locationId = proposal.initial_location_id === undefined
    ? ''
    : requireResolvedReference(
      proposal.initial_location_id,
      'location',
      identities,
      canonicalKindById,
      (resolved) => `Bootstrap actor ${proposal.id} initial_location_id does not resolve to an admitted location `
        + `(${proposal.initial_location_id}, resolved as ${resolved.status}${'entityKind' in resolved ? ` ${resolved.entityKind}` : ''})`,
    );

  const actor: ActorEntity = {
    id: proposal.id,
    identity: {
      name: proposal.name,
      working_label: proposal.working_label,
      aliases: [...proposal.aliases],
    },
    roles: { story: [], scene: [] },
    traits: {},
    // current_state is omitted entirely, not defaulted. Any number/string here
    // -- 0, 0.5, 'neutral', anything -- is a narrative claim about this
    // actor's fatigue/fear/certainty/emotion that the source text gives no
    // evidence for, and it would reach the writing model verbatim (see
    // narrativePipeline.ts's "POV Current State" prompt line and the full
    // GenerationContext dump in Stage 1). Absence is the only honest
    // representation until real state evidence exists (a later slice).
    active_goals: [],
    current_location_id: locationId,
    possessions: [],
    isPresent: true,
  };
  draft.actors.push(actor);
  descriptions.push(`Admitted actor ${proposal.id}`);
}

function applyObjectProposal(
  draft: StoryProject,
  proposal: Extract<BootstrapEntityProposal, { kind: 'object_proposal' }>,
  identities: BootstrapIdentities,
  canonicalKindById: ReadonlyMap<string, EntityKind>,
  descriptions: string[],
): void {
  const locationId = proposal.initial_location_id === undefined
    ? null
    : requireResolvedReference(
      proposal.initial_location_id,
      'location',
      identities,
      canonicalKindById,
      (resolved) => `Bootstrap object ${proposal.id} initial_location_id does not resolve to an admitted location `
        + `(${proposal.initial_location_id}, resolved as ${resolved.status}${'entityKind' in resolved ? ` ${resolved.entityKind}` : ''})`,
    );
  const holderId = proposal.initial_holder_actor_id === undefined
    ? null
    : requireResolvedReference(
      proposal.initial_holder_actor_id,
      'actor',
      identities,
      canonicalKindById,
      (resolved) => `Bootstrap object ${proposal.id} initial_holder_actor_id does not resolve to an admitted actor `
        + `(${proposal.initial_holder_actor_id}, resolved as ${resolved.status}${'entityKind' in resolved ? ` ${resolved.entityKind}` : ''})`,
    );

  const object: ObjectEntity = {
    id: proposal.id,
    identity: {
      name: proposal.name,
      working_label: proposal.working_label,
      aliases: [...proposal.aliases],
    },
    current_holder_id: holderId,
    current_location_id: locationId,
    // status is omitted entirely, not defaulted to 'intact'. Object condition
    // is an unambiguous in-world physical claim -- unlike current_state's
    // certainty/emotion, there is no defensible "neutral" reading of a
    // condition enum, and this value is what RelationalGraph.tsx shows the
    // author verbatim as "STATUS: <value>" and what the generation context
    // exposes as an involved entity's roleOrStatus.
    salience: 0.5,
    isPresent: true,
  };
  draft.objects.push(object);
  descriptions.push(`Admitted object ${proposal.id}`);
}

function applyLocationProposal(
  draft: StoryProject,
  proposal: Extract<BootstrapEntityProposal, { kind: 'location_proposal' }>,
  descriptions: string[],
): void {
  const location: LocationEntity = {
    id: proposal.id,
    identity: {
      name: proposal.name,
      working_label: proposal.working_label,
      aliases: [...proposal.aliases],
    },
    parent_location_id: null,
    connected_locations: [],
    description_summary: proposal.description_summary ?? '',
  };
  draft.locations.push(location);
  descriptions.push(`Admitted location ${proposal.id}`);
}

function applyFactionProposal(
  draft: StoryProject,
  proposal: Extract<BootstrapEntityProposal, { kind: 'faction_proposal' }>,
  identities: BootstrapIdentities,
  canonicalKindById: ReadonlyMap<string, EntityKind>,
  descriptions: string[],
): void {
  const members = (proposal.member_actor_ids ?? []).map((memberId) => requireResolvedReference(
    memberId,
    'actor',
    identities,
    canonicalKindById,
    (resolved) => `Bootstrap faction ${proposal.id} member_actor_ids references an unresolved actor `
      + `(${memberId}, resolved as ${resolved.status}${'entityKind' in resolved ? ` ${resolved.entityKind}` : ''})`,
  ));

  const faction: FactionEntity = {
    id: proposal.id,
    identity: {
      name: proposal.name,
      working_label: proposal.working_label,
      aliases: [...proposal.aliases],
    },
    members,
    influence: '',
  };
  draft.factions.push(faction);
  descriptions.push(`Admitted faction ${proposal.id}`);
}

function applyEntityProposal(
  draft: StoryProject,
  entry: BootstrapManifestEntry,
  proposal: BootstrapProposal,
  identities: BootstrapIdentities,
  canonicalKindById: ReadonlyMap<string, EntityKind>,
  descriptions: string[],
): void {
  if (!isBootstrapEntityProposal(proposal)) failWrongProposal(entry);
  switch (proposal.kind) {
    case 'actor_proposal':
      applyActorProposal(draft, proposal, identities, canonicalKindById, descriptions);
      return;
    case 'object_proposal':
      applyObjectProposal(draft, proposal, identities, canonicalKindById, descriptions);
      return;
    case 'location_proposal':
      applyLocationProposal(draft, proposal, descriptions);
      return;
    case 'faction_proposal':
      applyFactionProposal(draft, proposal, identities, canonicalKindById, descriptions);
      return;
  }
}

/**
 * StoryProject represents "actor holds object" twice: ObjectEntity.current_holder_id
 * (actor id) and ActorEntity.possessions (object ids), read independently
 * downstream (RelationalGraph.tsx and contextCompiler.ts's
 * GenerationContext.activePovActor.possessions both read possessions[]
 * directly; nothing derives it from current_holder_id). Applying an admitted
 * object's initial_holder_actor_id only ever wrote the first side, leaving
 * the two representations of one fact in contradiction. This closes that
 * gap for every object in the resulting draft, additively (only ever adds a
 * missing id, never removes one), after all entity proposals have been
 * applied so every admitted actor/object already exists in `draft`.
 *
 * Note: src/lib/preparePromotion.ts's applyAdmittedPossessionChanges has the
 * same one-sided gap for ordinary (non-bootstrap) possession transfers.
 * That is a recorded, separate defect -- out of scope for B1, not
 * reproduced here on purpose.
 */
function synchronizePossessionReciprocity(draft: StoryProject, descriptions: string[]): void {
  for (const object of draft.objects) {
    if (object.current_holder_id === null) continue;
    const holder = draft.actors.find((actor) => actor.id === object.current_holder_id);
    if (!holder) {
      // Unreachable given every current_holder_id was already proven to
      // resolve to an admitted or pre-existing actor before being written;
      // fail closed rather than leave a one-sided, contradictory possession
      // claim in the resulting project if that invariant is ever violated.
      throw new Error(
        `Bootstrap possession coherence failed: object ${object.id} claims holder ${object.current_holder_id}, `
        + 'but no such actor exists in the resulting project',
      );
    }
    if (!holder.possessions.includes(object.id)) {
      holder.possessions.push(object.id);
      descriptions.push(`Synchronized possession: ${holder.id} canonically holds ${object.id}`);
    }
  }
}

/**
 * The active POV actor's own current_location_id and the transaction's
 * chosen currentLocationId are two representations of the same fact --
 * "where the story is currently happening, and to whom". If the POV actor
 * has no admitted location yet ('' from Manuscript Intake's convention),
 * completing it to match the assignment finishes the single decision the
 * author already made by choosing both the POV actor and the scene location
 * together; it is not a new, separately-unearned claim. If the actor
 * already has a *different* admitted location, that is a genuine
 * contradiction bootstrap must never silently resolve by picking one side.
 */
function enforcePovActorLocationCoherence(
  draft: StoryProject,
  povActorId: string,
  currentLocationId: string,
): void {
  const povActor = draft.actors.find((actor) => actor.id === povActorId);
  if (!povActor) {
    // Unreachable: povActorId was already proven to resolve to an admitted actor.
    throw new Error(`Bootstrap POV coherence failed: assigned POV actor ${povActorId} is not present in the resulting project`);
  }
  if (povActor.current_location_id === '') {
    povActor.current_location_id = currentLocationId;
    return;
  }
  if (povActor.current_location_id !== currentLocationId) {
    throw new Error(
      `Bootstrap scene/actor location contradiction: the current location assignment is ${currentLocationId}, `
      + `but the admitted POV actor ${povActorId} has its own location ${povActor.current_location_id}. `
      + 'Resolve this explicitly -- edit the actor\'s initial_location_id or choose a different location assignment -- '
      + 'rather than let bootstrap silently pick one.',
    );
  }
}

/**
 * Atomically converts a decided BootstrapManifest into a project's initial
 * structured state. Pure: never mutates `project`, `manifest`, or any
 * evidence/proposal object reachable from them; on any failure the caller's
 * `project` remains byte-for-byte/structurally untouched, because every
 * mutation happens on an isolated structuredClone draft that is discarded
 * (never returned) when this function throws.
 *
 * `transactionTimestamp` must be supplied by the caller -- this function
 * never calls Date.now(), Math.random(), or any other nondeterministic
 * facility, so identical inputs (including the timestamp) always produce an
 * identical result.
 */
export function prepareBootstrap(
  project: StoryProject,
  manifest: BootstrapManifest,
  assignments: BootstrapAssignments,
  transactionTimestamp: number,
): PreparedBootstrap {
  validateBootstrapManifestStructure(manifest);
  if (manifest.projectId !== project.id) {
    throw new Error('Bootstrap Manifest project identity does not match the target project');
  }
  if (!sourceDocumentsAreIdentical(project.sourceDocuments ?? [], manifest.boundSourceDocuments)) {
    throw new Error('Stale Bootstrap Manifest: bound source documents do not match the current project\'s source material');
  }

  const canonicalKindById = canonicalKindIndex(project);
  const identities = resolveBootstrapIdentities(manifest, canonicalKindById);

  const preBootstrapSnapshot = structuredClone(project);
  const draft = structuredClone(project);
  const appliedDescriptions: string[] = [];
  const appliedEntryIds: string[] = [];
  const unsupportedEntryIds = manifest.entries
    .filter((entry) => !entry.supportedForApplication)
    .map((entry) => entry.id);
  const admittedByEntry = new Map<string, BootstrapProposal>();

  for (const entry of manifest.entries) {
    const proposal = admittedProposal(entry);
    if (proposal === undefined) continue;
    applyEntityProposal(draft, entry, proposal, identities, canonicalKindById, appliedDescriptions);
    appliedEntryIds.push(entry.id);
    admittedByEntry.set(entry.id, structuredClone(proposal));
  }

  synchronizePossessionReciprocity(draft, appliedDescriptions);

  if (assignments.activePovActorId === null || assignments.currentLocationId === null) {
    throw new Error('Bootstrap requires an explicit POV actor assignment and current location assignment; neither is inferred');
  }
  const povActorId = requireResolvedReference(
    assignments.activePovActorId,
    'actor',
    identities,
    canonicalKindById,
    (resolved) => `Bootstrap POV assignment does not resolve to an admitted actor `
      + `(${assignments.activePovActorId}, resolved as ${resolved.status}${'entityKind' in resolved ? ` ${resolved.entityKind}` : ''})`,
  );
  const currentLocationId = requireResolvedReference(
    assignments.currentLocationId,
    'location',
    identities,
    canonicalKindById,
    (resolved) => `Bootstrap location assignment does not resolve to an admitted location `
      + `(${assignments.currentLocationId}, resolved as ${resolved.status}${'entityKind' in resolved ? ` ${resolved.entityKind}` : ''})`,
  );

  draft.activePovActorId = povActorId;
  const assignedLocation = draft.locations.find((location) => location.id === currentLocationId);
  if (!assignedLocation) {
    // Unreachable given requireResolvedReference above already proved the id
    // resolves to a location kind that now exists in draft; defensive only.
    throw new Error(`Bootstrap location assignment resolved to ${currentLocationId} but it is not present in the resulting project`);
  }
  enforcePovActorLocationCoherence(draft, povActorId, currentLocationId);

  draft.currentPosition = {
    ...draft.currentPosition,
    location_id: currentLocationId,
    location_label: assignedLocation.identity.name || assignedLocation.identity.working_label,
  };

  const readiness = assessCompositionReadiness(draft);
  if (!readiness.ready) {
    // Unreachable given the two requireResolvedReference calls above; a
    // defensive proof that bootstrap only ever produces a composition-ready
    // result, never a partial one.
    throw new Error('Bootstrap did not produce a composition-ready project');
  }

  const admissionFingerprint = fingerprintBootstrapAdmission(manifest);
  const receiptEntries: BootstrapReceiptEntry[] = manifest.entries.map((entry) => ({
    entryId: entry.id,
    kind: entry.kind,
    decision: entry.decision,
    supportedForApplication: entry.supportedForApplication,
    proposed: structuredClone(entry.proposed),
    admitted: admittedByEntry.has(entry.id) ? structuredClone(admittedByEntry.get(entry.id)!) : null,
    applied: appliedEntryIds.includes(entry.id),
  }));

  const bootstrapReceipt: BootstrapReceipt = deepFreeze({
    id: `bootstrap-receipt:${manifest.id}:${admissionFingerprint}`,
    manifestId: manifest.id,
    projectId: project.id,
    boundSourceDocumentIds: manifest.boundSourceDocuments.map((doc) => doc.id),
    boundSourceFingerprint: manifest.boundSourceFingerprint,
    admissionFingerprint,
    assignments: { activePovActorId: povActorId, currentLocationId },
    entries: receiptEntries,
    appliedEntryIds,
    unsupportedEntryIds,
    resultingProjectFingerprint: fingerprintResultingProject(draft),
    transactionTimestamp,
  });

  return { nextProject: draft, preBootstrapSnapshot, bootstrapReceipt };
}

function fingerprintResultingProject(project: StoryProject): string {
  let hash = 0x811c9dc5;
  const text = JSON.stringify({
    activePovActorId: project.activePovActorId,
    location_id: project.currentPosition.location_id,
    actorIds: project.actors.map((a) => a.id).sort(),
    objectIds: project.objects.map((o) => o.id).sort(),
    locationIds: project.locations.map((l) => l.id).sort(),
    factionIds: project.factions.map((f) => f.id).sort(),
  });
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `resulting-project-fnv1a32-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
