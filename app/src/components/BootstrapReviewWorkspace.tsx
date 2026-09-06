import React, { useState } from 'react';
import { CheckCircle2, Edit3, XCircle } from 'lucide-react';
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
  readonly onDecide: (entryId: string, decision: BootstrapDecision, admitted?: BootstrapProposal) => void;
  readonly onAssignPovActor: (actorId: string | null) => void;
  readonly onAssignCurrentLocation: (locationId: string | null) => void;
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
  onDecide,
  onAssignPovActor,
  onAssignCurrentLocation,
  onClose,
}) => {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

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
                      onClick={() => onDecide(entry.id, 'approved')}
                      className="flex items-center gap-1 rounded bg-[#1A1A1A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FDFCF8] hover:bg-[#333333]"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      APPROVE
                    </button>
                    <button
                      type="button"
                      onClick={() => beginEdit(entry)}
                      className="flex items-center gap-1 rounded border border-[#1A1A1A]/30 bg-[#FDFCF8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:bg-white"
                    >
                      <Edit3 className="h-3 w-3" />
                      EDIT
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => onDecide(entry.id, 'rejected')}
                  className="flex items-center gap-1 rounded border border-[#8B263E]/40 bg-[#FDFCF8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8B263E] hover:bg-[#8B263E]/10"
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
                  onChange={(event) => setEditLabel(event.target.value)}
                  className="min-w-[10rem] flex-1 rounded border border-[#1A1A1A]/30 bg-white px-2 py-1 text-xs text-[#1A1A1A]"
                  placeholder="Working label"
                />
                <button
                  type="button"
                  onClick={() => saveEdit(entry.id, entry.proposed)}
                  className="rounded bg-[#1A1A1A] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FDFCF8] hover:bg-[#333333]"
                >
                  SAVE EDIT
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingEntryId(null); setEditLabel(''); }}
                  className="rounded border border-[#1A1A1A]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5A554E] hover:bg-[#E5E2D9]"
                >
                  CANCEL
                </button>
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
            value={assignments.activePovActorId ?? ''}
            onChange={(event) => onAssignPovActor(event.target.value || null)}
            className="w-full rounded border border-[#1A1A1A]/30 bg-white px-2 py-1.5 text-xs font-serif italic text-[#1A1A1A]"
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
            value={assignments.currentLocationId ?? ''}
            onChange={(event) => onAssignCurrentLocation(event.target.value || null)}
            className="w-full rounded border border-[#1A1A1A]/30 bg-white px-2 py-1.5 text-xs font-serif italic text-[#1A1A1A]"
          >
            <option value="">-- not selected --</option>
            {locationCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
        </label>
      </div>

      {readiness.complete && (
        <div
          data-role="review-complete"
          className="rounded border border-[#2D5A27]/40 bg-[#2D5A27]/10 p-3 text-center text-[11px] font-bold uppercase tracking-wider text-[#2D5A27]"
        >
          Review Complete — Ready to Apply
        </div>
      )}

      <StructuralReviewPanel manifest={manifest} onClose={onClose} />
    </div>
  );
};
