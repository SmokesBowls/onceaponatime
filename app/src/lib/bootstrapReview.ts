import type {
  BootstrapAssignments,
  BootstrapDecision,
  BootstrapManifest,
  BootstrapProposal,
  BootstrapProposalKind,
} from './bootstrapManifest';
import { decideBootstrapManifestEntry } from './bootstrapManifest';
import { resolveAdmittedBootstrapProposal } from './prepareBootstrap';

/**
 * B3c's controller layer over B1's existing authority (bootstrapManifest.ts,
 * prepareBootstrap.ts). Nothing here is a second decision/assignment
 * authority: every state transition still goes through
 * decideBootstrapManifestEntry(), and every "does this resolve" question is
 * answered by resolveAdmittedBootstrapProposal() -- the exact same
 * resolution prepareBootstrap() itself uses. This module never calls
 * prepareBootstrap() and never mutates canonical StoryProject state.
 */

export interface BootstrapReviewReadiness {
  readonly complete: boolean;
  readonly allEntriesDecided: boolean;
  readonly povAssigned: boolean;
  readonly povResolves: boolean;
  readonly currentLocationAssigned: boolean;
  readonly currentLocationResolves: boolean;
}

function resolvesToKind(manifest: BootstrapManifest, id: string, kind: BootstrapProposalKind): boolean {
  for (const entry of manifest.entries) {
    let admitted: BootstrapProposal | undefined;
    try {
      admitted = resolveAdmittedBootstrapProposal(entry);
    } catch {
      continue;
    }
    if (admitted !== undefined && admitted.kind === kind && 'id' in admitted && admitted.id === id) return true;
  }
  return false;
}

/**
 * "Complete" means only: every entry has an explicit decision, and both
 * assignments explicitly resolve to an admitted entry of the correct kind.
 * It is never a prediction of prepareBootstrap() success -- prepareBootstrap()
 * still owns deeper domain validation (POV/location coherence, possession
 * reciprocity, and whatever else it checks) this predicate never runs.
 */
export function assessBootstrapReviewReadiness(
  manifest: BootstrapManifest,
  assignments: BootstrapAssignments,
): BootstrapReviewReadiness {
  const allEntriesDecided = manifest.entries.every((entry) => entry.decision !== 'pending');
  const povAssigned = assignments.activePovActorId !== null;
  const currentLocationAssigned = assignments.currentLocationId !== null;
  const povResolves = povAssigned && resolvesToKind(manifest, assignments.activePovActorId as string, 'actor_proposal');
  const currentLocationResolves = currentLocationAssigned
    && resolvesToKind(manifest, assignments.currentLocationId as string, 'location_proposal');

  return {
    complete: allEntriesDecided && povAssigned && povResolves && currentLocationAssigned && currentLocationResolves,
    allEntriesDecided,
    povAssigned,
    povResolves,
    currentLocationAssigned,
    currentLocationResolves,
  };
}

export function isBootstrapReviewComplete(manifest: BootstrapManifest, assignments: BootstrapAssignments): boolean {
  return assessBootstrapReviewReadiness(manifest, assignments).complete;
}

/**
 * The B3c controller entry point for author decisions: applies a decision
 * through B1's existing decideBootstrapManifestEntry(), then -- never before,
 * and never as a separate step a caller could forget -- clears either
 * assignment if it was pointing at what THIS entry resolved to immediately
 * before the decision. Never remaps a stale assignment onto whatever the
 * entry resolves to afterward, even when a re-edit "looks like the same
 * person": the author must explicitly re-select.
 *
 * Defense in depth: refuses 'approved'/'edited' on an unsupported entry
 * itself, rather than relying solely on BootstrapReviewWorkspace never
 * rendering that control. prepareBootstrap()'s resolver already throws on
 * exactly this combination; failing here means this controller can never be
 * the one place a caller (present or future) slips past that rule.
 */
export function decideBootstrapReviewEntry(
  manifest: BootstrapManifest,
  assignments: BootstrapAssignments,
  entryId: string,
  decision: BootstrapDecision,
  admitted?: BootstrapProposal,
): { readonly manifest: BootstrapManifest; readonly assignments: BootstrapAssignments } {
  const previousEntry = manifest.entries.find((entry) => entry.id === entryId);
  if (previousEntry && !previousEntry.supportedForApplication && (decision === 'approved' || decision === 'edited')) {
    throw new Error(
      `Unsupported Bootstrap Manifest entry cannot be decided '${decision}': ${entryId} ` +
      "(only 'rejected' is valid for an unsupported entry)",
    );
  }
  let previousAdmittedId: string | undefined;
  if (previousEntry) {
    try {
      const resolved = resolveAdmittedBootstrapProposal(previousEntry);
      if (resolved !== undefined && 'id' in resolved) previousAdmittedId = resolved.id;
    } catch {
      // Nothing was admitted before this decision (pending, or an invalid
      // unsupported state) -- there is nothing an assignment could have been
      // pointing at yet.
    }
  }

  const nextManifest = decideBootstrapManifestEntry(manifest, entryId, decision, admitted);
  let nextAssignments = assignments;
  if (previousAdmittedId !== undefined) {
    if (nextAssignments.activePovActorId === previousAdmittedId) {
      nextAssignments = { ...nextAssignments, activePovActorId: null };
    }
    if (nextAssignments.currentLocationId === previousAdmittedId) {
      nextAssignments = { ...nextAssignments, currentLocationId: null };
    }
  }

  return { manifest: nextManifest, assignments: nextAssignments };
}

/** Every entry currently admitted (approved, or edited-and-approved) as the given kind. */
export function admittedEntityCandidates(
  manifest: BootstrapManifest,
  kind: 'actor_proposal' | 'location_proposal',
): ReadonlyArray<{ id: string; label: string }> {
  const candidates: Array<{ id: string; label: string }> = [];
  for (const entry of manifest.entries) {
    let admitted: BootstrapProposal | undefined;
    try {
      admitted = resolveAdmittedBootstrapProposal(entry);
    } catch {
      continue;
    }
    if (admitted !== undefined && (admitted.kind === 'actor_proposal' || admitted.kind === 'location_proposal') && admitted.kind === kind) {
      candidates.push({ id: admitted.id, label: admitted.working_label });
    }
  }
  return candidates;
}
