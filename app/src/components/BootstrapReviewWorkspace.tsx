import React, { useLayoutEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Edit3, RefreshCw, XCircle } from 'lucide-react';
import type {
  BootstrapAssignments,
  BootstrapDecision,
  BootstrapManifest,
  BootstrapProposal,
} from '../lib/bootstrapManifest';
import { admittedEntityCandidates, assessBootstrapReviewReadiness } from '../lib/bootstrapReview';
import { StructuralReviewPanel } from './StructuralReviewPanel';

export interface BootstrapReviewWorkspaceProps {
  readonly manifest: BootstrapManifest;
  readonly assignments: BootstrapAssignments;
  /**
   * True when `manifest` was built from source documents that no longer
   * match the project's current ones. The artifact stays visible (closing
   * it would destroy author work already done) but every authority control
   * is disabled -- neither silently discarding nor silently regenerating
   * the session is acceptable; only an explicit `onRegenerate` may replace
   * it.
   */
  readonly isStale: boolean;
  /**
   * True while a B4c1 REFINE request is in flight. Freezes every authority
   * control exactly like `isStale` does (APPROVE/EDIT/REJECT, the two
   * assignment selects) plus CLOSE, which `isStale` does not touch --
   * closing the workspace while its own manifest is about to be replaced
   * out from under it is not safe either. Never true at the same time as
   * `isStale` under correct caller gating (REFINE is never offered on a
   * stale session), but each is checked independently regardless.
   */
  readonly isRefining: boolean;
  readonly onDecide: (entryId: string, decision: BootstrapDecision, admitted?: BootstrapProposal) => void;
  /**
   * B4c3's "USE THIS SUGGESTION" authority -- the only new entry point this
   * component gains. Wired to selectBootstrapReviewSuggestion(), which
   * resolves the actual trusted suggestion from (entryId, candidateDigest)
   * itself; this component never constructs a BootstrapProposal for it the
   * way SAVE EDIT's saveEdit() does.
   */
  readonly onSelectSuggestion: (entryId: string, candidateDigest: string) => void;
  readonly onAssignPovActor: (actorId: string | null) => void;
  readonly onAssignCurrentLocation: (locationId: string | null) => void;
  readonly onRegenerate: () => void;
  readonly onClose: () => void;
}

const DECISION_LABEL: Record<BootstrapDecision, string> = {
  pending: 'Pending author review',
  approved: 'Approved',
  edited: 'Edited & approved',
  rejected: 'Rejected',
};

/**
 * B3c's author-facing decision authority. Wraps the existing, permanently
 * read-only StructuralReviewPanel for evidence/rationale display rather than
 * duplicating it -- this component adds APPROVE/EDIT/REJECT and the POV/
 * current-location assignment controls around it. It never calls
 * prepareBootstrap() and never mutates canonical StoryProject state; every
 * decision goes through the onDecide callback into bootstrapReview.ts's
 * controller, which is the only thing that calls B1's
 * decideBootstrapManifestEntry().
 */
export const BootstrapReviewWorkspace: React.FC<BootstrapReviewWorkspaceProps> = ({
  manifest,
  assignments,
  isStale,
  isRefining,
  onDecide,
  onSelectSuggestion,
  onAssignPovActor,
  onAssignCurrentLocation,
  onRegenerate,
  onClose,
}) => {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const controlsDisabled = isStale || isRefining;

  // A stray in-progress edit form must not survive into the stale or
  // refining state. SAVE EDIT/CANCEL/the label input now carry their own
  // disabled={controlsDisabled} directly (belt-and-suspenders -- this alone
  // used to be the only thing covering them), but useLayoutEffect (not the
  // passive useEffect this used to be) still closes the form itself in the
  // exact same commit controlsDisabled flips, matching StoryEditor.tsx's own
  // synchronous-reset convention rather than leaving a stale form visible
  // for one committed-but-not-yet-effected render.
  useLayoutEffect(() => {
    if (controlsDisabled) setEditingEntryId(null);
  }, [controlsDisabled]);

  const readiness = assessBootstrapReviewReadiness(manifest, assignments);
  const actorCandidates = admittedEntityCandidates(manifest, 'actor_proposal');
  const locationCandidates = admittedEntityCandidates(manifest, 'location_proposal');

  const beginEdit = (entry: BootstrapManifest['entries'][number]) => {
    setEditingEntryId(entry.id);
    setEditLabel('working_label' in entry.proposed ? entry.proposed.working_label : '');
  };

  /**
   * Two entries independently editable to the same working label would
   * otherwise silently derive the same id (e.g. two actors both renamed to
   * "Renamed Hero") -- readiness has no way to detect that, and it is
   * exactly the kind of manifest prepareBootstrap()'s own duplicate-entity
   * check exists to reject at commit time. Disambiguating here, at the one
   * place a new id is minted, is cheaper and more honest than letting the
   * author discover the collision only when B3d later fails.
   */
  const uniqueEditedId = (baseId: string, entryIdBeingEdited: string): string => {
    const taken = new Set<string>();
    for (const entry of manifest.entries) {
      if (entry.id === entryIdBeingEdited) continue;
      const current = entry.admitted ?? entry.proposed;
      if ('id' in current) taken.add(current.id);
    }
    if (!taken.has(baseId)) return baseId;
    let suffix = 2;
    while (taken.has(`${baseId}_${suffix}`)) suffix += 1;
    return `${baseId}_${suffix}`;
  };

  const saveEdit = (entryId: string, original: BootstrapProposal) => {
    if (!('working_label' in original) || editLabel.trim().length === 0) return;
    const baseId = `${original.kind.replace('_proposal', '')}_${editLabel.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_')}`;
    const id = uniqueEditedId(baseId, entryId);
    onDecide(entryId, 'edited', { ...original, id, working_label: editLabel.trim() } as BootstrapProposal);
    setEditingEntryId(null);
    setEditLabel('');
  };

  return (
    <div data-bootstrap-workspace-id={manifest.id} className="w-full space-y-4">
      <div className="space-y-3">
        {manifest.entries.map((entry) => (
          <div
            key={entry.id}
            data-bootstrap-entry-id={entry.id}
            data-decision={entry.decision}
            className="rounded border border-[#1A1A1A]/20 bg-[#FDFCF8] p-3 space-y-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`rounded px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-wider ${
                  entry.decision === 'pending'
                    ? 'bg-[#E5E2D9] text-[#5A554E]'
                    : entry.decision === 'rejected'
                    ? 'bg-[#8B263E]/15 text-[#8B263E]'
                    : 'bg-[#2D5A27]/15 text-[#2D5A27]'
                }`}
              >
                {DECISION_LABEL[entry.decision]}
              </span>

              <div className="flex items-center gap-1.5">
                {entry.supportedForApplication && (
                  <>
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => onDecide(entry.id, 'approved')}
                      className="flex items-center gap-1 rounded bg-[#1A1A1A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FDFCF8] hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      APPROVE
                    </button>
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => beginEdit(entry)}
                      className="flex items-center gap-1 rounded border border-[#1A1A1A]/30 bg-[#FDFCF8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Edit3 className="h-3 w-3" />
                      EDIT
                    </button>
                  </>
                )}
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => onDecide(entry.id, 'rejected')}
                  className="flex items-center gap-1 rounded border border-[#8B263E]/40 bg-[#FDFCF8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8B263E] hover:bg-[#8B263E]/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <XCircle className="h-3 w-3" />
                  REJECT
                </button>
              </div>
            </div>

            {editingEntryId === entry.id && (
              <div className="flex flex-wrap items-center gap-2 border-t border-[#1A1A1A]/10 pt-2">
                <input
                  data-role="edit-working-label"
                  value={editLabel}
                  disabled={controlsDisabled}
                  onChange={(event) => setEditLabel(event.target.value)}
                  className="min-w-[10rem] flex-1 rounded border border-[#1A1A1A]/30 bg-white px-2 py-1 text-xs text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
                  placeholder="Working label"
                />
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => saveEdit(entry.id, entry.proposed)}
                  className="rounded bg-[#1A1A1A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FDFCF8] hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  SAVE EDIT
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => { setEditingEntryId(null); setEditLabel(''); }}
                  className="rounded border border-[#1A1A1A]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5A554E] hover:bg-[#E5E2D9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  CANCEL
                </button>
              </div>
            )}

            {entry.suggestedRefinements && entry.suggestedRefinements.length > 0 && (
              <div className="space-y-1.5 border-t border-[#1A1A1A]/10 pt-2">
                <span className="text-[9px] font-sans font-bold uppercase tracking-wider text-[#736B63]">AI suggestions</span>
                {entry.suggestedRefinements.map((suggestion) => {
                  const candidateDigest = suggestion.provenance.candidateDigest;
                  const isSelected = entry.selectedRefinementCandidateDigest === candidateDigest;
                  const label = 'working_label' in suggestion.suggested ? suggestion.suggested.working_label : candidateDigest;
                  return (
                    <div
                      key={candidateDigest}
                      data-suggestion-candidate-digest={candidateDigest}
                      data-suggestion-selected={isSelected ? 'true' : 'false'}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#1A1A1A]/15 bg-white px-2 py-1.5"
                    >
                      <span className="text-[11px] font-serif italic text-[#1A1A1A]">
                        {label} <span className="font-sans not-italic text-[9px] text-[#736B63]">digest {candidateDigest.slice(0, 8)}…</span>
                      </span>
                      {isSelected ? (
                        <span className="rounded bg-[#2D5A27]/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#2D5A27]">
                          SELECTED
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={controlsDisabled}
                          onClick={() => onSelectSuggestion(entry.id, candidateDigest)}
                          className="rounded border border-[#1A1A1A]/30 bg-[#FDFCF8] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          USE THIS SUGGESTION
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-[#1A1A1A]/10 pt-3 sm:grid-cols-2">
        <label className="space-y-1 text-[10px] font-sans font-bold uppercase tracking-wider text-[#736B63]">
          <span>POV Actor</span>
          <select
            data-role="pov-select"
            disabled={controlsDisabled}
            value={assignments.activePovActorId ?? ''}
            onChange={(event) => onAssignPovActor(event.target.value || null)}
            className="w-full rounded border border-[#1A1A1A]/30 bg-white px-2 py-1.5 text-xs font-serif italic text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <option value="">-- not selected --</option>
            {actorCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-[10px] font-sans font-bold uppercase tracking-wider text-[#736B63]">
          <span>Current Location</span>
          <select
            data-role="current-location-select"
            disabled={controlsDisabled}
            value={assignments.currentLocationId ?? ''}
            onChange={(event) => onAssignCurrentLocation(event.target.value || null)}
            className="w-full rounded border border-[#1A1A1A]/30 bg-white px-2 py-1.5 text-xs font-serif italic text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <option value="">-- not selected --</option>
            {locationCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
        </label>
      </div>

      {isStale ? (
        <div
          data-role="review-stale"
          className="space-y-2 rounded border border-[#966F33]/50 bg-[#966F33]/10 p-3 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#7A5A29]">
            <AlertTriangle className="h-4 w-4" />
            <span>Source changed — regenerate structural review before continuing.</span>
          </div>
          <button
            type="button"
            disabled={isRefining}
            onClick={onRegenerate}
            className="mx-auto flex items-center gap-1.5 rounded bg-[#1A1A1A] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#FDFCF8] hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3" />
            REGENERATE REVIEW
          </button>
        </div>
      ) : readiness.complete && (
        <div
          data-role="review-complete"
          className="rounded border border-[#2D5A27]/40 bg-[#2D5A27]/10 p-3 text-center text-[11px] font-bold uppercase tracking-wider text-[#2D5A27]"
        >
          Review Complete — Ready to Apply
        </div>
      )}

      <StructuralReviewPanel manifest={manifest} onClose={() => { if (!isRefining) onClose(); }} />
    </div>
  );
};
