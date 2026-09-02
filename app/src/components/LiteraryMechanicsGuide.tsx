import React, { useState } from 'react';
import {
  BookOpen,
  GitBranch,
  Search,
  Layers,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ChevronRight,
  HelpCircle,
  FileCode,
} from 'lucide-react';

export const LiteraryMechanicsGuide: React.FC = () => {
  const [selectedSection, setSelectedSection] = useState<number>(0);

  const mechanics = [
    {
      num: 1,
      title: 'Governing Principle',
      short: 'The framework must not merely remember what has been written. It must progressively identify, relate, qualify, and retrieve what the story has established.',
      detail:
        'The durable product is the story framework. The model is a replaceable intelligence provider. The framework governs narrative organization, state, boundaries, context, operating modes, and validation.',
    },
    {
      num: 2,
      title: 'First-Pass Entity Recognition',
      short: 'Assigns neutral IDs (e.g. object_001, actor_001) upon first appearance without hard-coding story lore.',
      detail:
        '"an old iron key" → object_001. At this stage, the system knows very little and records only what the text explicitly establishes.',
    },
    {
      num: 3,
      title: 'Mention Tracking',
      short: 'Retains every meaningful occurrence of an entity with passage citations, scene index, and context.',
      detail:
        'Not merely "object_001 exists", but a structured trail: mention_001 (Chapter 1), mention_014 (Chapter 2), mention_037 (Chapter 4).',
    },
    {
      num: 4,
      title: 'Subsequent-Pass Entity Resolution',
      short: 'Compares subsequent mentions against existing entities rather than naively generating duplicate entities.',
      detail:
        'Pass 1: "an old iron key" → object_001. Pass 2: "the key beneath the glass" → candidate object_001. Pass 3: "the iron key in actor_002\'s hand" → object_001 strongly reinforced.',
    },
    {
      num: 5,
      title: 'Relational Accumulation',
      short: 'Repeated mentions teach the framework how an entity relates to actors, locations, events, and threads.',
      detail:
        'object_001: located_at → location_003, possessed_by → actor_002, used_during → event_017. The graph becomes relational rather than merely descriptive.',
    },
    {
      num: 6,
      title: 'Temporal State Tracking ($T1 \\rightarrow T2 \\rightarrow T3$)',
      short: 'Preserves chronological state history rather than overwriting with latest state.',
      detail:
        'T1: object_001 at location_003. T2: object_001 missing. T3: object_001 possessed by actor_002. Prevents phantom teleportation.',
    },
    {
      num: 7,
      title: 'Evidence Accumulation',
      short: 'Every interpretation retains the exact textual evidence that produced it.',
      detail:
        'Claim: mention_037 refers to object_001. Evidence: same physical description, prior location reference, same associated actor.',
    },
    {
      num: 8,
      title: 'Confidence Scoring (Reversible)',
      short: 'Interpretations accumulate confidence as compatible evidence appears, yet remain reversible.',
      detail:
        'Applies independently: entity identity confidence (99%), attribute confidence (85%), relationship confidence (60%), inference confidence (40%).',
    },
    {
      num: 9,
      title: 'Established Fact vs. Inference',
      short: 'Inference cannot silently become story canon without explicit textual confirmation.',
      detail:
        'Established: actor_002 possesses object_001. Inferred: actor_002 stole object_001. The framework keeps inferred hypotheses distinct from canon facts.',
    },
    {
      num: 10,
      title: 'Contradiction Detection',
      short: 'New candidate prose is validated against existing relational state before acceptance.',
      detail:
        'Existing state: object_001 was destroyed in scene_002. New candidate: actor_004 picks up object_001. Triggers immediate diagnostic flag.',
    },
    {
      num: 11,
      title: 'Entity Splitting & Merging',
      short: 'Enables graph correction without losing mention history when entities diverge or merge.',
      detail:
        'Splitting: When one working entity turns out to be two. Merging: When two distinct labels are revealed to be the same identity.',
    },
    {
      num: 12,
      title: 'Narrative Salience Engine',
      short: 'Ranks importance based on mention frequency, connected actors, and active thread involvement.',
      detail:
        'High salience does not mean "true"; it signifies high narrative weight in the ongoing story arc.',
    },
    {
      num: 13,
      title: 'Codex Accumulation',
      short: 'The human-readable Codex is synthesized from the graph rather than manually authored.',
      detail:
        'Mentions + entities + relationships + state changes + evidence + confidence produce the author-facing Codex.',
    },
    {
      num: 14,
      title: 'Codex & Relational Retrieval',
      short: 'Packages only relevant entities, knowledge boundaries, and active threads to prevent context pollution.',
      detail:
        'When actor_001 enters location_005, context assembly retrieves location details, objects present, associated actors, and known facts.',
    },
    {
      num: 15,
      title: 'Knowledge Ownership & Epistemic Boundaries',
      short: 'Isolates World Truth, Reader Knowledge, Actor Knowledge, and Sincere Beliefs.',
      detail:
        'Prevents an actor from accidentally speaking or acting on privileged world knowledge they have never observed.',
    },
    {
      num: 16,
      title: 'Provenance Tracking',
      short: 'Every Codex fact links back to its exact chapter, scene, and beat source.',
      detail:
        'Provides instant traceable citations from high-level continuity conclusions back to the source prose.',
    },
    {
      num: 17,
      title: 'Accepted-State Promotion Pipeline',
      short: 'Draft generations are candidates until reviewed, validated, and promoted by the author.',
      detail:
        'Generated prose → candidate interpretation → validation → author accepts → update relational state → update Codex.',
    },
    {
      num: 18,
      title: 'Transactional Reversal & Undo History',
      short: 'Undoing accepted prose deterministically rolls back all graph mutations and mentions.',
      detail:
        'Undo restores previous accepted story state without asking the model to guess previous states from memory.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Banner */}
      <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm">
        <span className="text-[9px] uppercase tracking-[0.3em] font-sans text-[#736B63] block font-bold mb-1">
          Architectural Blueprint
        </span>
        <div className="flex items-center gap-2 text-[#1A1A1A] font-serif italic text-2xl sm:text-3xl font-light">
          <HelpCircle className="h-6 w-6 text-[#1A1A1A]" />
          <span>Onceaponatime Literary Mechanics Architecture</span>
        </div>
        <p className="text-xs text-[#5A554E] font-serif italic mt-1.5 max-w-3xl leading-relaxed">
          The 18 core architectural mechanics governing how the framework progressively identifies, relates, qualifies, and retrieves what the story has established.
        </p>
      </div>

      {/* Grid: Mechanics List (5 cols) & Detail View (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 bg-[#FAF8F2] border border-[#1A1A1A] rounded p-4 space-y-2 max-h-[640px] overflow-y-auto shadow-sm">
          {mechanics.map((m, idx) => (
            <button
              key={m.num}
              onClick={() => setSelectedSection(idx)}
              className={`w-full text-left p-3.5 rounded border transition ${
                selectedSection === idx
                  ? 'bg-[#1A1A1A] border-[#1A1A1A] text-[#FDFCF8] shadow-sm'
                  : 'bg-[#FDFCF8] border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#E5E2D9]'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className={selectedSection === idx ? 'text-[#D8D4C7] font-bold' : 'text-[#736B63] font-bold'}>Section {m.num}</span>
                <ChevronRight className={`h-3.5 w-3.5 ${selectedSection === idx ? 'text-[#FDFCF8]' : 'text-[#736B63]'}`} />
              </div>
              <div className="text-sm font-bold font-serif italic mt-1 leading-snug">{m.title}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-7 bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 space-y-5 shadow-sm">
          <div className="border-b border-[#1A1A1A]/20 pb-4">
            <span className="text-[10px] font-sans font-bold text-[#1A1A1A] uppercase tracking-wider bg-[#E5E2D9] px-2 py-0.5 rounded border border-[#1A1A1A]/20">
              Mechanic #{mechanics[selectedSection].num}
            </span>
            <h3 className="text-2xl font-bold text-[#1A1A1A] font-serif italic mt-2">
              {mechanics[selectedSection].title}
            </h3>
          </div>

          <div className="bg-[#FDFCF8] p-4 rounded border border-[#1A1A1A]/20 text-sm font-serif text-[#1A1A1A] leading-relaxed italic shadow-xs">
            "{mechanics[selectedSection].short}"
          </div>

          <div className="space-y-2 text-xs text-[#1A1A1A] font-sans leading-relaxed">
            <span className="font-sans font-bold text-[#736B63] uppercase tracking-wider text-[10px] block">Detailed Operational Flow:</span>
            <p className="bg-[#FDFCF8] p-4 rounded border border-[#1A1A1A]/15 font-serif text-sm italic leading-relaxed text-[#5A554E]">
              {mechanics[selectedSection].detail}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
