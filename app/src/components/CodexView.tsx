import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  BookOpen,
  Users,
  Package,
  MapPin,
  HelpCircle,
  Award,
  Layers,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  History,
  Tag,
  Eye,
  GitBranch,
} from 'lucide-react';
import { StoryProject, CodexEntity } from '../types';
import { synthesizeCodex } from '../lib/codexEngine';

interface CodexViewProps {
  project: StoryProject;
  onUpdateEntity?: (updatedEntity: CodexEntity) => void;
}

export const CodexView: React.FC<CodexViewProps> = ({ project, onUpdateEntity }) => {
  const [activeSection, setActiveSection] = useState<
    'all' | 'provisional' | 'resolved' | 'actors' | 'objects' | 'structures' | 'facts' | 'threads'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});

  // Synthesize rich Accumulated Codex from canonical project state
  const codexEntities = useMemo(() => {
    return synthesizeCodex(project);
  }, [project]);

  const toggleReceipts = (id: string) => {
    setExpandedReceipts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter entities based on active tab & search term
  const filteredEntities = useMemo(() => {
    return codexEntities.filter((ent) => {
      // Tab filter
      if (activeSection === 'provisional' && ent.classification_confidence !== 'provisional' && ent.reliability >= 0.5) {
        return false;
      }
      if (activeSection === 'resolved' && (ent.classification_confidence === 'provisional' || ent.reliability < 0.5)) {
        return false;
      }
      if (activeSection === 'actors' && ent.entity_type !== 'actor') {
        return false;
      }
      if (activeSection === 'objects' && ent.entity_type !== 'object' && ent.entity_type !== 'relic' && ent.entity_type !== 'mechanism') {
        return false;
      }
      if (activeSection === 'structures' && ent.entity_type !== 'structure' && ent.entity_type !== 'landmark' && ent.entity_type !== 'location') {
        return false;
      }

      // Search filter
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const matchLabel = ent.working_label.toLowerCase().includes(term);
      const matchCanon = ent.canonical_label?.toLowerCase().includes(term);
      const matchId = ent.id.toLowerCase().includes(term);
      const matchAliases = (ent.aliases || []).some((a) => a.toLowerCase().includes(term));
      const matchClaims = (ent.claims || []).some((c) => c.claim.toLowerCase().includes(term));
      const matchEvidence = (ent.evidence || []).some((e) => e.source_text.toLowerCase().includes(term));

      return matchLabel || matchCanon || matchId || matchAliases || matchClaims || matchEvidence;
    });
  }, [codexEntities, activeSection, searchTerm]);

  const provisionalCount = codexEntities.filter(
    (e) => e.classification_confidence === 'provisional' || e.reliability < 0.5
  ).length;
  const resolvedCount = codexEntities.filter(
    (e) => e.classification_confidence === 'resolved' && e.reliability >= 0.5
  ).length;

  const sections = [
    { id: 'all', label: `All Entities (${codexEntities.length})` },
    { id: 'provisional', label: `Provisional Memory (${provisionalCount})` },
    { id: 'resolved', label: `Resolved Lore (${resolvedCount})` },
    { id: 'actors', label: `Dramatis Personae (${project.actors.length})` },
    { id: 'objects', label: `Relics & Objects (${project.objects.length})` },
    { id: 'structures', label: `Landmarks & Places (${project.locations.length})` },
    { id: 'facts', label: `Established Lore (${project.facts.length})` },
    { id: 'threads', label: `Open Threads (${project.threads.length})` },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Banner */}
      <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[9px] uppercase tracking-[0.3em] font-sans text-[#736B63] block font-bold mb-1">
              Progressive Narrative Memory
            </span>
            <div className="flex items-center gap-2 text-[#1A1A1A] font-serif italic text-2xl sm:text-3xl font-light">
              <BookOpen className="h-6 w-6 text-[#1A1A1A]" />
              <span>Accumulated Story Codex</span>
            </div>
            <p className="text-xs text-[#5A554E] font-serif italic mt-1.5 max-w-3xl leading-relaxed">
              Every newly observed narrative element begins with provisional classification and 0% reliability on first mention. Entities progressively accrue corroborating claims, distinct evidence receipts, and structural resolution through canonical manuscript progression.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-[#FDFCF8] border border-[#1A1A1A]/20 px-4 py-2.5 rounded">
            <div className="text-center border-r border-[#1A1A1A]/15 pr-3">
              <span className="text-[9px] font-sans uppercase font-bold text-[#736B63] block">Provisional</span>
              <span className="text-lg font-mono font-bold text-[#966F33]">{provisionalCount}</span>
            </div>
            <div className="text-center pl-1">
              <span className="text-[9px] font-sans uppercase font-bold text-[#736B63] block">Resolved</span>
              <span className="text-lg font-mono font-bold text-[#2D5A27]">{resolvedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F2] p-2.5 rounded border border-[#1A1A1A]/30">
        <div className="flex flex-wrap gap-1">
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as any)}
              className={`px-3 py-1.5 rounded text-[11px] font-sans uppercase font-bold tracking-wider transition ${
                activeSection === sec.id
                  ? 'bg-[#1A1A1A] text-[#FDFCF8] shadow-sm'
                  : 'text-[#736B63] hover:text-[#1A1A1A] hover:bg-[#E5E2D9]'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-[#736B63]" />
          <input
            type="text"
            placeholder="Search Codex & receipts..."
            className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded pl-9 pr-3 py-1.5 text-xs text-[#1A1A1A] placeholder-[#8C827A] focus:outline-none focus:border-[#1A1A1A]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Codex Entities Grid */}
      {activeSection !== 'facts' && activeSection !== 'threads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEntities.map((ent) => {
            const isExpanded = !!expandedReceipts[ent.id];
            const reliabilityPct = Math.round(ent.reliability * 100);
            const hasContradiction = (ent.claims || []).some((c) => c.status === 'contradicted');

            return (
              <div
                key={ent.id}
                className="bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded p-5 space-y-4 shadow-sm hover:border-[#1A1A1A] transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-[#1A1A1A] font-bold bg-[#E5E2D9] px-2 py-0.5 rounded border border-[#1A1A1A]/20">
                          {ent.id}
                        </span>
                        <span
                          className={`text-[9px] font-sans font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            ent.classification_confidence === 'resolved'
                              ? 'bg-[#2D5A27]/10 text-[#2D5A27] border-[#2D5A27]/30'
                              : 'bg-[#966F33]/10 text-[#966F33] border-[#966F33]/30'
                          }`}
                        >
                          {ent.classification_confidence === 'resolved'
                            ? `Resolved (${ent.entity_type})`
                            : 'Provisional Memory'}
                        </span>
                        {ent.is_author_locked && (
                          <span className="text-[9px] font-sans font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#FDFCF8] flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" /> Author Locked
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-[#1A1A1A] font-serif italic mt-2 flex items-center gap-2">
                        {ent.canonical_label || ent.working_label}
                        {ent.instance_index && ent.instance_index > 1 && (
                          <span className="text-[11px] font-mono font-normal text-[#8C827A] not-italic bg-[#E5E2D9] px-1.5 py-0.5 rounded">
                            #{ent.instance_index}
                          </span>
                        )}
                      </h3>
                      {ent.disambiguation_hint && (
                        <p className="text-[11px] text-[#736B63] font-mono mt-0.5 flex items-center gap-1">
                          <span>📍 {ent.disambiguation_hint}</span>
                        </p>
                      )}
                      {ent.canonical_label && ent.working_label !== ent.canonical_label && (
                        <p className="text-[11px] text-[#736B63] font-serif italic mt-0.5">
                          Observed as: "{ent.working_label}"
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#736B63] font-sans uppercase font-bold tracking-wider block">
                        {ent.distinct_evidence_count} evidence {ent.distinct_evidence_count === 1 ? 'event' : 'events'}
                      </span>
                      <span className="text-[9px] text-[#8C827A] font-sans">
                        {ent.mention_count} total mentions
                      </span>
                    </div>
                  </div>

                  {/* Reliability Meter */}
                  <div className="bg-[#FDFCF8] p-3 rounded border border-[#1A1A1A]/15 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-sans">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#736B63]">
                        Codex Reliability
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          reliabilityPct === 100
                            ? 'text-[#2D5A27]'
                            : reliabilityPct >= 50
                            ? 'text-[#1A1A1A]'
                            : 'text-[#966F33]'
                        }`}
                      >
                        {reliabilityPct}% {ent.distinct_evidence_count <= 1 && !ent.is_author_locked ? '(Provisional - 1 mention)' : ''}
                      </span>
                    </div>
                    <div className="w-full bg-[#E5E2D9] h-2 rounded overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          reliabilityPct === 100
                            ? 'bg-[#2D5A27]'
                            : reliabilityPct >= 50
                            ? 'bg-[#1A1A1A]'
                            : 'bg-[#966F33]'
                        }`}
                        style={{ width: `${Math.max(4, reliabilityPct)}%` }}
                      />
                    </div>
                    {ent.candidate_types && ent.candidate_types.length > 1 && ent.classification_confidence === 'provisional' && (
                      <div className="text-[10px] font-sans text-[#736B63] pt-1">
                        <span className="font-bold">Candidate Types:</span>{' '}
                        {ent.candidate_types.map((t) => `[${t}]`).join(' ')}
                      </div>
                    )}
                  </div>

                  {/* Physical & Spatial Status */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-sans bg-[#FDFCF8] p-2.5 rounded border border-[#1A1A1A]/15">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#736B63] block">
                        Possession / Holder:
                      </span>
                      <span className={`font-medium ${ent.current_holder_id ? 'text-[#1A1A1A]' : 'text-[#736B63] italic'}`}>
                        {ent.current_holder_id ? `Held by ${ent.current_holder_id}` : 'Unheld / Resting'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#736B63] block">
                        Location:
                      </span>
                      <span className="font-medium text-[#1A1A1A]">
                        {ent.current_location_id || 'Crossroads / Current'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#736B63] block">
                        First Seen:
                      </span>
                      <span className="font-mono text-[11px] text-[#1A1A1A]">{ent.first_seen}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-[#736B63] block">
                        Last Seen:
                      </span>
                      <span className="font-mono text-[11px] text-[#1A1A1A]">{ent.last_seen}</span>
                    </div>
                  </div>

                  {/* Contradiction Warning */}
                  {hasContradiction && (
                    <div className="bg-[#966F33]/10 border border-[#966F33]/40 rounded p-2.5 text-xs text-[#966F33] space-y-1">
                      <div className="flex items-center gap-1 font-bold font-sans uppercase text-[10px]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Contradictory Observations Recorded</span>
                      </div>
                      <p className="text-[11px] font-serif italic text-[#736B63] leading-tight">
                        Conflicting evidence has been preserved in narrative memory without overwriting previous observations.
                      </p>
                    </div>
                  )}

                  {/* Accumulated Claims */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-sans uppercase font-bold tracking-wider text-[#736B63] block">
                      Canonical Claims ({ent.claims?.length || 0})
                    </span>
                    <div className="space-y-1">
                      {(ent.claims || []).map((claim) => (
                        <div
                          key={claim.id}
                          className={`p-2 rounded text-xs font-sans flex items-start justify-between gap-2 border ${
                            claim.status === 'contradicted'
                              ? 'bg-[#966F33]/5 border-[#966F33]/30 text-[#966F33]'
                              : 'bg-[#FDFCF8] border-[#1A1A1A]/10 text-[#1A1A1A]'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <span className="font-medium block">{claim.claim}</span>
                            {claim.contradiction_notes && (
                              <span className="text-[10px] text-[#966F33] font-serif italic block">
                                {claim.contradiction_notes}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {claim.confidence !== undefined && (
                              <span className="text-[9px] font-mono font-medium text-[#736B63] bg-[#EFECE6] px-1.5 py-0.5 rounded">
                                {Math.round(claim.confidence * 100)}% conf
                              </span>
                            )}
                            <span className="text-[9px] font-mono font-bold bg-[#E5E2D9] px-1.5 py-0.5 rounded text-[#1A1A1A] whitespace-nowrap">
                              Beat {claim.evidence_beats.join(', ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Traceable Provenance Receipts Drawer */}
                  {ent.evidence && ent.evidence.length > 0 && (
                    <div className="pt-2 border-t border-[#1A1A1A]/15">
                      <button
                        onClick={() => toggleReceipts(ent.id)}
                        className="w-full flex items-center justify-between text-left text-xs font-sans font-bold uppercase tracking-wider text-[#736B63] hover:text-[#1A1A1A] py-1 transition"
                      >
                        <span className="flex items-center gap-1.5">
                          <History className="h-3.5 w-3.5" />
                          Provenance Receipts ({ent.evidence.length})
                        </span>
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                          {ent.evidence.map((rec) => (
                            <div
                              key={rec.id}
                              className="bg-[#FDFCF8] p-2.5 rounded border border-[#1A1A1A]/15 text-xs font-sans space-y-1"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono text-[#736B63]">
                                <span className="font-bold text-[#1A1A1A]">Beat {rec.beat} ({rec.temporal_state})</span>
                                <span>POV: {rec.pov_actor_id}</span>
                              </div>
                              <p className="font-serif italic text-[#1A1A1A] text-[11px] leading-relaxed">
                                "{rec.source_text}"
                              </p>
                              <div className="flex items-center justify-between text-[9px] text-[#736B63] pt-0.5 border-t border-[#1A1A1A]/10">
                                <span>Relation: {rec.relationship_produced}</span>
                                <span>Claim: {rec.claim_produced}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Facts & Lore Tab */}
      {(activeSection === 'all' || activeSection === 'facts') && (
        <div className="space-y-4">
          <div className="border-b border-[#1A1A1A]/20 pb-2">
            <h3 className="text-lg font-serif italic text-[#1A1A1A] font-bold">Established World Truths & Lore</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.facts.map((fact) => (
              <div
                key={fact.id}
                className="bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded p-5 space-y-3 shadow-sm hover:border-[#1A1A1A] transition"
              >
                <div className="flex items-center justify-between font-sans text-[10px] uppercase font-bold">
                  <span className="text-[#1A1A1A] font-mono">{fact.id}</span>
                  <span className="text-[#2D5A27]">{(fact.confidence * 100).toFixed(0)}% Confidence</span>
                </div>

                <p className="text-sm font-serif italic text-[#1A1A1A] leading-relaxed">"{fact.statement}"</p>

                {fact.provenance?.evidence_quote && (
                  <div className="text-[10px] font-sans text-[#736B63] bg-[#FDFCF8] p-2 rounded border border-[#1A1A1A]/15">
                    Provenance: "{fact.provenance.evidence_quote}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open Narrative Threads Tab */}
      {(activeSection === 'all' || activeSection === 'threads') && (
        <div className="space-y-4">
          <div className="border-b border-[#1A1A1A]/20 pb-2">
            <h3 className="text-lg font-serif italic text-[#1A1A1A] font-bold">Open Narrative Threads</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {project.threads.map((thread) => (
              <div
                key={thread.id}
                className="bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded p-5 space-y-3 shadow-sm hover:border-[#1A1A1A] transition"
              >
                <div className="flex items-center justify-between font-sans text-[10px] uppercase font-bold">
                  <span className="text-[#1A1A1A] font-mono">{thread.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase ${
                      thread.status === 'open'
                        ? 'bg-[#966F33] text-[#FDFCF8]'
                        : 'bg-[#2D5A27] text-[#FDFCF8]'
                    }`}
                  >
                    {thread.status}
                  </span>
                </div>

                <h4 className="text-base font-bold font-serif italic text-[#1A1A1A]">{thread.label}</h4>

                <div className="text-[10px] font-sans uppercase font-bold tracking-wider text-[#736B63] flex items-center justify-between border-t border-[#1A1A1A]/15 pt-2">
                  <span>Importance: {thread.importance}</span>
                  <span>Resolution Allowed: {thread.resolution_allowed ? 'Yes' : 'No'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
