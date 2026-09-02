import React, { useState } from 'react';
import {
  Brain,
  Lock,
  Unlock,
  ShieldAlert,
  Eye,
  CheckCircle,
  AlertOctagon,
  Plus,
  HelpCircle,
  Sparkles,
  Info,
} from 'lucide-react';
import { StoryProject, RevealEntity, FactEntity } from '../types';

interface KnowledgeMatrixProps {
  project: StoryProject;
  onUpdateKnowledge: (knowledge: StoryProject['knowledge']) => void;
  onUpdateReveals: (reveals: RevealEntity[]) => void;
  onAddFact: (fact: FactEntity) => void;
}

export const KnowledgeMatrix: React.FC<KnowledgeMatrixProps> = ({
  project,
  onUpdateKnowledge,
  onUpdateReveals,
  onAddFact,
}) => {
  const [selectedActorId, setSelectedActorId] = useState<string>(project.actors[0]?.id || 'actor_001');
  const [newFactStatement, setNewFactStatement] = useState('');
  const [newFactStatus, setNewFactStatus] = useState<'established' | 'inferred' | 'suspected'>('established');
  const [showAddFact, setShowAddFact] = useState(false);

  const activeActor = project.actors.find((a) => a.id === selectedActorId);
  const actorEpistemics = project.knowledge.actor_knowledge[selectedActorId] || {
    known_facts: [],
    beliefs: [],
    forbidden_knowledge: [],
  };

  const handleToggleForbiddenFact = (factId: string) => {
    const isCurrentlyForbidden = actorEpistemics.forbidden_knowledge.includes(factId);
    let updatedForbidden = [...actorEpistemics.forbidden_knowledge];
    let updatedKnown = [...actorEpistemics.known_facts];

    if (isCurrentlyForbidden) {
      updatedForbidden = updatedForbidden.filter((id) => id !== factId);
      updatedKnown.push(factId);
    } else {
      updatedForbidden.push(factId);
      updatedKnown = updatedKnown.filter((id) => id !== factId);
    }

    const updatedKnowledge = {
      ...project.knowledge,
      actor_knowledge: {
        ...project.knowledge.actor_knowledge,
        [selectedActorId]: {
          ...actorEpistemics,
          known_facts: updatedKnown,
          forbidden_knowledge: updatedForbidden,
        },
      },
    };
    onUpdateKnowledge(updatedKnowledge);
  };

  const handleToggleRevealStatus = (revealId: string) => {
    const updated = project.reveals.map((r) => {
      if (r.id === revealId) {
        const nextStatus: RevealEntity['status'] =
          r.status === 'locked' ? 'foreshadowed' : r.status === 'foreshadowed' ? 'unlocked' : 'locked';
        return { ...r, status: nextStatus };
      }
      return r;
    });
    onUpdateReveals(updated);
  };

  const handleCreateFact = () => {
    if (!newFactStatement.trim()) return;
    const factId = `fact_${String(project.facts.length + 1).padStart(3, '0')}`;
    const newFact: FactEntity = {
      id: factId,
      statement: newFactStatement,
      status: newFactStatus,
      confidence: newFactStatus === 'established' ? 1.0 : newFactStatus === 'inferred' ? 0.75 : 0.4,
      provenance: {
        chapter: project.currentPosition.chapter,
        scene: project.currentPosition.scene,
        beat: project.currentPosition.beat,
      },
    };
    onAddFact(newFact);

    // Also add to world truth
    onUpdateKnowledge({
      ...project.knowledge,
      world_truth: [...project.knowledge.world_truth, factId],
    });

    setNewFactStatement('');
    setShowAddFact(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm">
        <span className="text-[9px] uppercase tracking-[0.3em] font-sans text-[#736B63] block font-bold mb-1">
          Epistemic Architecture
        </span>
        <div className="flex items-center gap-2 text-[#1A1A1A] font-serif italic font-normal text-2xl sm:text-3xl">
          <Brain className="h-6 w-6 text-[#1A1A1A]" />
          <span>Epistemic Boundaries & Knowledge Ownership</span>
        </div>
        <p className="text-xs text-[#5A554E] font-serif italic mt-1.5 max-w-3xl leading-relaxed">
          Storytelling requires multiple simultaneous perspectives. The engine strictly isolates{' '}
          <strong className="text-[#1A1A1A] not-italic font-bold">World Truth</strong> from{' '}
          <strong className="text-[#1A1A1A] not-italic font-bold">Reader Knowledge</strong>,{' '}
          <strong className="text-[#1A1A1A] not-italic font-bold">Actor Knowledge</strong>, and{' '}
          <strong className="text-[#966F33] not-italic font-bold">Sincere (False) Beliefs</strong> to prevent premature disclosure.
        </p>
      </div>

      {/* Main Grid: Epistemic Matrix (7 cols) & Reveal Lockbox (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Per-Actor Knowledge & Epistemic Matrix (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 space-y-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A1A1A]/20 pb-4">
              <div>
                <h3 className="text-sm font-bold text-[#1A1A1A] font-sans uppercase tracking-wider">
                  Actor Perspective Filter
                </h3>
                <p className="text-xs text-[#5A554E] font-serif italic">Select an actor to inspect and configure their epistemic boundary.</p>
              </div>

              {/* Actor Selector */}
              <div className="flex items-center gap-2">
                <select
                  className="bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded px-3 py-1.5 text-xs text-[#1A1A1A] font-serif focus:outline-none focus:border-[#1A1A1A]"
                  value={selectedActorId}
                  onChange={(e) => setSelectedActorId(e.target.value)}
                >
                  {project.actors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.id}: {a.identity.name || a.identity.working_label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actor Epistemic Status */}
            <div className="space-y-5">
              {/* Sincere Beliefs (May differ from world truth) */}
              <div className="bg-[#FDFCF8] border border-[#1A1A1A]/20 rounded p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-sans">
                  <span className="text-[#1A1A1A] font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#1A1A1A]" />
                    <span>Sincere Subjective Beliefs ({actorEpistemics.beliefs.length}):</span>
                  </span>
                  <span className="text-[#736B63] text-[10px] uppercase font-bold">Drives authentic character choices</span>
                </div>
                {actorEpistemics.beliefs.length === 0 ? (
                  <p className="text-xs text-[#736B63] font-serif italic">No subjective false beliefs registered.</p>
                ) : (
                  <ul className="space-y-2">
                    {actorEpistemics.beliefs.map((b, i) => (
                      <li
                        key={i}
                        className="text-xs text-[#1A1A1A] font-serif italic bg-[#E5E2D9]/60 border border-[#1A1A1A]/15 px-3 py-2 rounded"
                      >
                        "{b}"
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Fact Knowledge Grid for Actor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-sans font-bold text-[#1A1A1A] uppercase tracking-wider">
                    All World Facts & Access Controls:
                  </span>
                  <button
                    onClick={() => setShowAddFact(!showAddFact)}
                    className="text-xs text-[#1A1A1A] hover:text-[#736B63] flex items-center gap-1 font-sans uppercase font-bold tracking-wider"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add World Fact</span>
                  </button>
                </div>

                {/* Add Fact Inline Form */}
                {showAddFact && (
                  <div className="p-4 rounded bg-[#FDFCF8] border border-[#1A1A1A]/40 space-y-3 text-xs shadow-sm">
                    <input
                      type="text"
                      placeholder="e.g. The safe was unlocked with a duplicated brass key..."
                      className="w-full bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded p-2 text-xs text-[#1A1A1A] font-serif"
                      value={newFactStatement}
                      onChange={(e) => setNewFactStatement(e.target.value)}
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-sans text-xs">
                        <span className="text-[#736B63] uppercase text-[10px] font-bold">Status:</span>
                        <select
                          className="bg-[#FAF8F2] border border-[#1A1A1A]/30 rounded px-2 py-1 text-xs text-[#1A1A1A] font-serif"
                          value={newFactStatus}
                          onChange={(e) => setNewFactStatus(e.target.value as any)}
                        >
                          <option value="established">Established Fact (100%)</option>
                          <option value="inferred">Inferred Claim (75%)</option>
                          <option value="suspected">Suspected Rumor (40%)</option>
                        </select>
                      </div>
                      <button
                        onClick={handleCreateFact}
                        className="px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#333333] text-[#FDFCF8] font-sans uppercase tracking-wider font-bold text-xs rounded"
                      >
                        Save Fact
                      </button>
                    </div>
                  </div>
                )}

                {/* Facts List */}
                <div className="space-y-2.5">
                  {project.facts.map((fact) => {
                    const isKnown = actorEpistemics.known_facts.includes(fact.id);
                    const isForbidden = actorEpistemics.forbidden_knowledge.includes(fact.id);

                    return (
                      <div
                        key={fact.id}
                        className={`p-3.5 rounded border text-xs transition flex items-start justify-between gap-3 shadow-xs ${
                          isForbidden
                            ? 'bg-[#8B263E]/10 border-[#8B263E]/40 text-[#1A1A1A]'
                            : isKnown
                            ? 'bg-[#2D5A27]/10 border-[#2D5A27]/40 text-[#1A1A1A]'
                            : 'bg-[#FDFCF8] border-[#1A1A1A]/15 text-[#1A1A1A]'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-sans text-[10px] uppercase font-bold">
                            <span className="text-[#1A1A1A] font-mono">{fact.id}</span>
                            <span className="text-[#736B63] bg-[#E5E2D9] px-1.5 py-0.5 rounded">
                              {fact.status}
                            </span>
                            <span className="text-[#736B63]">
                              Confidence: {(fact.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <p className="font-serif italic leading-relaxed text-[#1A1A1A] text-sm">{fact.statement}</p>
                        </div>

                        <button
                          onClick={() => handleToggleForbiddenFact(fact.id)}
                          className={`shrink-0 px-3 py-1.5 rounded text-[10px] font-sans uppercase tracking-wider font-bold transition ${
                            isForbidden
                              ? 'bg-[#8B263E] hover:bg-[#721F32] text-[#FDFCF8]'
                              : isKnown
                              ? 'bg-[#2D5A27] hover:bg-[#23471E] text-[#FDFCF8]'
                              : 'bg-[#E5E2D9] hover:bg-[#D8D4C7] text-[#1A1A1A]'
                          }`}
                        >
                          {isForbidden ? 'FORBIDDEN (Leak Guard)' : isKnown ? 'KNOWN TO ACTOR' : 'UNKNOWN'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Reveal Lockbox & Foreshadowing Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-3">
              <div className="flex items-center gap-2 text-[#1A1A1A] font-sans uppercase font-bold text-xs tracking-wider">
                <Lock className="h-4 w-4" />
                <span>Reveal Lockbox</span>
              </div>
              <span className="text-[10px] font-sans uppercase tracking-wider font-bold text-[#736B63]">Release Policies</span>
            </div>

            <p className="text-xs text-[#5A554E] font-serif italic leading-relaxed">
              Stories are controlled systems for information release. Locked reveals permit subtle sensory foreshadowing
              while blocking premature explanation or realization.
            </p>

            <div className="space-y-3">
              {project.reveals.map((reveal) => {
                const isLocked = reveal.status === 'locked';
                const isForeshadowed = reveal.status === 'foreshadowed';

                return (
                  <div
                    key={reveal.id}
                    className="p-4 rounded bg-[#FDFCF8] border border-[#1A1A1A]/20 space-y-3 text-xs shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="font-bold text-[#1A1A1A]">{reveal.id}</span>
                        <span className="text-[#736B63]">Ref: {reveal.fact_id}</span>
                      </div>
                      <button
                        onClick={() => handleToggleRevealStatus(reveal.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-sans uppercase tracking-wider font-bold flex items-center gap-1.5 transition ${
                          isLocked
                            ? 'bg-[#8B263E] text-[#FDFCF8]'
                            : isForeshadowed
                            ? 'bg-[#966F33] text-[#FDFCF8]'
                            : 'bg-[#2D5A27] text-[#FDFCF8]'
                        }`}
                      >
                        {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        <span>{reveal.status.toUpperCase()}</span>
                      </button>
                    </div>

                    <p className="font-serif text-[#1A1A1A] font-bold text-sm italic">{reveal.label}</p>

                    {/* Allowed Foreshadowing vs Forbidden Disclosure */}
                    <div className="space-y-2 font-sans text-[10px] border-t border-[#1A1A1A]/10 pt-2.5">
                      <div>
                        <span className="text-[#2D5A27] font-bold uppercase tracking-wider">ALLOWED BEFORE UNLOCK:</span>
                        <div className="text-[#5A554E] font-serif italic mt-0.5">{reveal.allowed_before_unlock.join(', ')}</div>
                      </div>
                      <div>
                        <span className="text-[#8B263E] font-bold uppercase tracking-wider">FORBIDDEN BEFORE UNLOCK:</span>
                        <div className="text-[#5A554E] font-serif italic mt-0.5">{reveal.forbidden_before_unlock.join(', ')}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
