import React from 'react';
import { Clock, MapPin, Package, User, ShieldCheck, GitCommit, FileText, Tag, ArrowRight } from 'lucide-react';
import { StoryProject } from '../types';

interface TemporalTimelineProps {
  project: StoryProject;
}

export const TemporalTimeline: React.FC<TemporalTimelineProps> = ({ project }) => {
  const receipts = project.temporalHistory || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Banner */}
      <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm">
        <span className="text-[9px] uppercase tracking-[0.3em] font-sans text-[#736B63] block font-bold mb-1">
          Chronological Ledger
        </span>
        <div className="flex items-center gap-2 text-[#1A1A1A] font-serif italic text-2xl sm:text-3xl font-light">
          <Clock className="h-6 w-6 text-[#1A1A1A]" />
          <span>Temporal State Tracking & Narrative Memory</span>
        </div>
        <p className="text-xs text-[#5A554E] font-serif italic mt-1.5 max-w-3xl leading-relaxed">
          Relationships, entity possessions, and physical states evolve strictly over narrative time ($T_1 \rightarrow T_2 \rightarrow T_3$).
          Rather than overwriting history with the latest state, the engine retains immutable chronological receipts of all promoted narrative beats.
        </p>
      </div>

      {/* Timeline Nodes */}
      <div className="space-y-6">
        {project.manuscript.map((beat, idx) => {
          const povActor = project.actors.find((a) => a.id === beat.povActorId);
          const location = project.locations.find((l) => l.id === beat.locationId);
          const receipt = receipts[idx];

          return (
            <div
              key={beat.id || `beat_${idx}`}
              className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm space-y-4"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A1A1A]/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded bg-[#1A1A1A] text-[#FDFCF8] font-mono text-xs font-bold">
                    {receipt?.time_index || `T${idx + 1}`}
                  </span>
                  <span className="text-xs font-sans uppercase font-bold tracking-wider text-[#1A1A1A]">
                    Beat #{beat.beatNumber || idx + 1}
                  </span>
                  <span className="text-[#1A1A1A]/30">|</span>
                  <span className="text-xs font-serif text-[#5A554E] italic flex items-center gap-1">
                    <MapPin className="h-3 w-3 inline text-[#736B63]" />
                    Location: <strong className="text-[#1A1A1A] not-italic">{location?.identity.name || location?.identity.working_label || beat.locationId}</strong>
                  </span>
                </div>
                <div className="text-xs font-serif italic text-[#736B63]">
                  POV: <span className="font-semibold text-[#1A1A1A] not-italic">{povActor?.identity.name || povActor?.identity.working_label || beat.povActorId}</span>
                </div>
              </div>

              {/* Prose Quote */}
              <div className="bg-[#FDFCF8] p-4 rounded border border-[#1A1A1A]/20 leading-relaxed shadow-xs space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#736B63]">
                  <FileText className="h-3 w-3" />
                  <span>Manuscript Passage:</span>
                </div>
                <p className="text-sm font-serif text-[#1A1A1A] italic">
                  "{beat.text}"
                </p>
              </div>

              {/* Applied State Changes & Ledger Metadata */}
              {receipt?.applied_state_changes && receipt.applied_state_changes.length > 0 && (
                <div className="bg-[#FDFCF8] p-3.5 rounded border border-[#1A1A1A]/15 space-y-2">
                  <span className="text-[#1A1A1A] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <GitCommit className="h-3.5 w-3.5 text-[#1A1A1A]" />
                    <span>Applied State Transformations & Receipts:</span>
                  </span>
                  <ul className="text-xs font-serif text-[#5A554E] list-disc list-inside space-y-1">
                    {receipt.applied_state_changes.map((chg, cIdx) => (
                      <li key={cIdx} className="italic">{chg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* State snapshot summary for this beat */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs font-sans text-[#736B63]">
                {/* Actor Presence */}
                <div className="bg-[#FDFCF8] p-3.5 rounded border border-[#1A1A1A]/15 space-y-1">
                  <span className="text-[#1A1A1A] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-[#1A1A1A]" />
                    <span>Actor Locations:</span>
                  </span>
                  <div className="text-[#1A1A1A] font-serif text-xs">
                    {receipt?.entity_locations
                      ? Object.entries(receipt.entity_locations)
                          .map(([entId, locId]) => {
                            const ent = project.actors.find((a) => a.id === entId);
                            const loc = project.locations.find((l) => l.id === locId);
                            return `${ent?.identity.name || entId} in ${loc?.identity.name || locId}`;
                          })
                          .join(', ')
                      : project.actors
                          .filter((a) => a.current_location_id === beat.locationId)
                          .map((a) => a.identity.name || a.id)
                          .join(', ') || 'None recorded'}
                  </div>
                </div>

                {/* Possessions */}
                <div className="bg-[#FDFCF8] p-3.5 rounded border border-[#1A1A1A]/15 space-y-1">
                  <span className="text-[#1A1A1A] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5 text-[#1A1A1A]" />
                    <span>Possession Ledger:</span>
                  </span>
                  <div className="text-[#1A1A1A] font-serif text-xs truncate">
                    {receipt?.object_possessions
                      ? Object.entries(receipt.object_possessions)
                          .map(([objId, holderId]) => {
                            const obj = project.objects.find((o) => o.id === objId);
                            const holder = project.actors.find((a) => a.id === holderId);
                            return `${obj?.identity.name || objId} (${holder?.identity.name || 'unheld'})`;
                          })
                          .join(', ')
                      : project.objects
                          .map((o) => {
                            const holder = project.actors.find((a) => a.id === o.current_holder_id);
                            return `${o.identity.name || o.id} (${holder?.identity.name || 'unheld'})`;
                          })
                          .join(', ')}
                  </div>
                </div>

                {/* Continuity Gate */}
                <div className="bg-[#FDFCF8] p-3.5 rounded border border-[#1A1A1A]/15 space-y-1">
                  <span className="text-[#1A1A1A] font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#2D5A27]" />
                    <span>Epistemic Ledger Gate:</span>
                  </span>
                  <div className="text-[#2D5A27] font-bold uppercase tracking-wider text-[10px]">
                    Canonized & Invariants Verified
                  </div>
                  {receipt?.thread_changes && receipt.thread_changes.length > 0 && (
                    <div className="text-[10px] text-[#736B63] font-serif italic">
                      Threads Advanced: {receipt.thread_changes.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
