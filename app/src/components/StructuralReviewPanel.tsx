import React from 'react';
import { Lock, X } from 'lucide-react';
import type { BootstrapManifest, BootstrapProposal } from '../lib/bootstrapManifest';
import { NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE } from '../lib/compositionReadiness';

interface StructuralReviewPanelProps {
  manifest: BootstrapManifest;
  onClose: () => void;
}

const LOCK_DETAIL = 'Structural review must establish at least one actor and one location before generation can run.';

const ProposalDetails: React.FC<{ proposal: BootstrapProposal }> = ({ proposal }) => {
  const details: Array<{ label: string; value: string }> = [];
  if ('id' in proposal) details.push({ label: 'Proposal ID', value: proposal.id });
  if ('name' in proposal && proposal.name !== null) {
    details.push({ label: 'Name', value: proposal.name });
  }
  if ('aliases' in proposal) {
    proposal.aliases.forEach((alias) => details.push({ label: 'Alias', value: alias }));
  }

  switch (proposal.kind) {
    case 'actor_proposal':
      if (proposal.initial_location_id !== undefined) {
        details.push({ label: 'Initial location ID', value: proposal.initial_location_id });
      }
      break;
    case 'object_proposal':
      if (proposal.initial_location_id !== undefined) {
        details.push({ label: 'Initial location ID', value: proposal.initial_location_id });
      }
      if (proposal.initial_holder_actor_id !== undefined) {
        details.push({ label: 'Initial holder actor ID', value: proposal.initial_holder_actor_id });
      }
      break;
    case 'location_proposal':
      if (proposal.description_summary !== undefined) {
        details.push({ label: 'Description summary', value: proposal.description_summary });
      }
      break;
    case 'faction_proposal':
      proposal.member_actor_ids?.forEach((memberId) => (
        details.push({ label: 'Member actor ID', value: memberId })
      ));
      break;
    case 'fact_proposal':
      details.push({ label: 'Statement', value: proposal.statement });
      break;
    case 'relationship_proposal':
      details.push(
        { label: 'Relationship type', value: proposal.type },
        { label: 'Source ID', value: proposal.source_id },
        { label: 'Target ID', value: proposal.target_id },
      );
      break;
  }

  if (details.length === 0) return null;
  return (
    <dl className="grid gap-1 font-mono text-[10px] text-[#5A554E]">
      {details.map((detail, index) => (
        <div key={`${detail.label}:${index}`} data-proposal-field={detail.label} className="flex flex-wrap gap-1">
          <dt>{detail.label}:</dt>
          <dd>{detail.value}</dd>
        </div>
      ))}
    </dl>
  );
};

/**
 * Read-only B3b presentation of an existing BootstrapManifest snapshot.
 * Decisions, assignments, and canonical admission belong to later slices.
 */
export const StructuralReviewPanel: React.FC<StructuralReviewPanelProps> = ({ manifest, onClose }) => (
  <section
    data-bootstrap-manifest-id={manifest.id}
    className="w-full rounded border border-[#1A1A1A]/20 bg-[#FDFCF8] text-left"
  >
    <header className="space-y-2 border-b border-[#1A1A1A]/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#5A554E] font-sans font-bold uppercase tracking-[0.15em] text-xs">
            <Lock className="h-3.5 w-3.5" />
            <span>Composition Pipeline Unavailable</span>
          </div>
          <h4 className="font-serif text-lg italic text-[#1A1A1A]">Read-Only Structural Review</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="CLOSE REVIEW"
          className="flex items-center gap-1.5 rounded border border-[#1A1A1A]/20 bg-[#E5E2D9] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A] hover:bg-[#D8D4C7]"
        >
          <X className="h-3.5 w-3.5" />
          <span>CLOSE REVIEW</span>
        </button>
      </div>
      <p className="text-xs font-serif italic text-[#5A554E]">
        {NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE}
      </p>
      <p className="text-[10px] font-sans uppercase tracking-wider text-[#8C827A]">{LOCK_DETAIL}</p>
      <p className="text-xs font-serif italic text-[#5A554E]">
        Discovery metadata is review assistance only. No author decisions or canonical changes have occurred.
      </p>
    </header>

    <div className="space-y-4 p-4">
      {manifest.entries.map((entry) => {
        const workingLabel = 'working_label' in entry.proposed
          ? entry.proposed.working_label
          : null;
        return (
          <article
            key={entry.id}
            data-bootstrap-entry-id={entry.id}
            className="space-y-3 rounded border border-[#1A1A1A]/15 bg-[#FAF8F2] p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="font-mono text-[10px] text-[#736B63]">{entry.kind}</div>
                {workingLabel !== null && (
                  <h5 className="font-serif text-base italic text-[#1A1A1A]">{workingLabel}</h5>
                )}
              </div>
              <span className="rounded bg-[#E5E2D9] px-2 py-1 font-sans text-[9px] font-bold uppercase tracking-wider text-[#5A554E]">
                Pending author review
              </span>
            </div>

            <ProposalDetails proposal={entry.proposed} />

            <div className="space-y-2">
              <div className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#736B63]">
                Exact source evidence
              </div>
              {entry.evidence.map((evidence, evidenceIndex) => (
                <div
                  key={`${evidence.unitId}:${evidenceIndex}`}
                  data-source-document-id={evidence.sourceDocumentId}
                  data-source-unit-id={evidence.unitId}
                  data-start-offset={evidence.startOffset}
                  data-end-offset={evidence.endOffset}
                  className="space-y-2 rounded border border-[#1A1A1A]/15 bg-white p-3"
                >
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-[#736B63]">
                    <span>Source document: {evidence.sourceDocumentId}</span>
                    <span>Evidence unit: {evidence.unitId}</span>
                    <span>Span: [{evidence.startOffset}, {evidence.endOffset})</span>
                  </div>
                  <p className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-[#1A1A1A]">
                    {evidence.exactText}
                  </p>
                </div>
              ))}
            </div>

            {entry.discoveryConfidence === undefined ? (
              <p className="font-serif text-xs italic text-[#736B63]">Discovery rationale not supplied</p>
            ) : (
              <div className="space-y-2 rounded border border-[#1A1A1A]/10 bg-[#E5E2D9]/45 p-3">
                <div className="font-sans text-[10px] font-bold uppercase tracking-wider text-[#736B63]">
                  Discovery rationale — review assistance
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-[#1A1A1A]">
                  <span data-discovery-classification={entry.discoveryConfidence.classification}>
                    Discovery classification: {entry.discoveryConfidence.classification}
                  </span>
                  <span data-supporting-unit-count={entry.discoveryConfidence.supportingUnitCount}>
                    Supporting units: {entry.discoveryConfidence.supportingUnitCount}
                  </span>
                </div>
                <ul className="space-y-1 font-mono text-[10px] text-[#5A554E]">
                  {entry.discoveryConfidence.reasons.map((reason) => (
                    <li key={reason} data-discovery-reason-id={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        );
      })}
    </div>
  </section>
);
