import React, { useEffect, useState } from 'react';
import {
  Play,
  Sparkles,
  ShieldCheck,
  Split,
  Trash2,
  Edit3,
  CheckCircle2,
  XCircle,
  Layers,
  FileEdit,
  ArrowRight,
  Eye,
  Lock,
  Compass,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Archive,
} from 'lucide-react';
import {
  StoryProject,
  NarrativeDistance,
  OperatingMode,
  RewriteContract,
  CandidateGeneration,
  ActorEntity,
} from '../types';
import { REWRITE_PRESETS } from '../data/defaultProjects';
import type { WorkbenchOperationError } from '../lib/workbenchErrors';
import {
  assessCompositionReadiness,
  NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE,
} from '../lib/compositionReadiness';
import { discoverBootstrap } from '../lib/bootstrapDiscovery';
import { buildBootstrapManifest, type BootstrapManifest } from '../lib/bootstrapManifest';
import { StructuralReviewPanel } from './StructuralReviewPanel';

/**
 * Compact, author-visible failure notice for the two Workbench operations that
 * previously failed silently (execution, promotion). Deliberately not a toast or
 * a general notification system: it is local state rendered inline, next to the
 * control whose operation actually failed.
 */
const WorkbenchErrorNotice: React.FC<{ message: string; dark?: boolean }> = ({ message, dark }) => (
  <div
    role="alert"
    className={`rounded p-4 space-y-1.5 text-xs font-sans border ${
      dark
        ? 'bg-[#8B263E]/25 border-[#E5A3B0]'
        : 'bg-[#8B263E]/10 border-[#8B263E]'
    }`}
  >
    <div
      className={`flex items-center gap-2 font-bold uppercase tracking-wider text-[11px] ${
        dark ? 'text-[#F3C6CF]' : 'text-[#8B263E]'
      }`}
    >
      <AlertTriangle className="h-4 w-4" />
      <span>Operation Failed</span>
    </div>
    <p className={dark ? 'text-white/80' : 'text-[#1A1A1A]'}>No story state was changed.</p>
    <p className={`font-serif italic ${dark ? 'text-[#F3C6CF]' : 'text-[#8B263E]'}`}>{message}</p>
  </div>
);

interface StoryEditorProps {
  project: StoryProject;
  onUpdateManuscript: (beats: StoryProject['manuscript']) => void;
  onSetPovActor: (actorId: string) => void;
  onSetLocation: (locationId: string, locationLabel: string) => void;
  onExecuteFramework: (params: {
    operation: OperatingMode;
    narrativeDistance: NarrativeDistance;
    authorPrompt: string;
    rewriteContract?: RewriteContract;
  }) => Promise<void>;
  onExecuteNaked: (prompt: string) => Promise<string>;
  candidate: CandidateGeneration | null;
  onAcceptCandidate: () => void;
  onRejectCandidate: () => void;
  onEditCandidateText: (text: string) => void;
  isGenerating: boolean;
  workbenchError: WorkbenchOperationError | null;
}

export const StoryEditor: React.FC<StoryEditorProps> = ({
  project,
  onUpdateManuscript,
  onSetPovActor,
  onSetLocation,
  onExecuteFramework,
  onExecuteNaked,
  candidate,
  onAcceptCandidate,
  onRejectCandidate,
  onEditCandidateText,
  isGenerating,
  workbenchError,
}) => {
  const [operation, setOperation] = useState<OperatingMode>('CONTINUATION');
  const [distance, setDistance] = useState<NarrativeDistance>('BEAT');
  const [promptText, setPromptText] = useState('');
  const [selectedRewritePreset, setSelectedRewritePreset] = useState<RewriteContract>(REWRITE_PRESETS[0]);
  const [showContractDetails, setShowContractDetails] = useState(false);
  const [showContextPackage, setShowContextPackage] = useState(false);
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [editingBeatContent, setEditingBeatContent] = useState('');
  const [nakedComparisonText, setNakedComparisonText] = useState<string | null>(null);
  const [isNakedLoading, setIsNakedLoading] = useState(false);
  const [structuralReviewSnapshot, setStructuralReviewSnapshot] = useState<BootstrapManifest | null>(null);

  const readiness = assessCompositionReadiness(project);
  const hasSubstantiveSource = (project.sourceDocuments ?? []).some(
    (document) => document.exactText.trim().length > 0,
  );

  useEffect(() => {
    setStructuralReviewSnapshot(null);
  }, [project.id]);

  const hasAnyActors = project.actors.length > 0;
  const hasAnyLocations = project.locations.length > 0;

  const narrativeDistances: Array<{ id: NarrativeDistance; label: string; desc: string }> = [
    { id: 'FRAGMENT', label: 'Fragment', desc: '1 sensory or micro-action detail' },
    { id: 'BEAT', label: 'Beat (Default)', desc: '1 action/reaction change' },
    { id: 'EXCHANGE', label: 'Exchange', desc: '2-4 dialogue & gesture lines' },
    { id: 'SEQUENCE', label: 'Sequence', desc: '3-4 connected narrative beats' },
    { id: 'SCENE', label: 'Scene', desc: 'Full complete scene unit' },
  ];

  const quickPrompts = [
    'Inspect the lock mechanism for internal tampering',
    'Whisper a cautious warning to my companion',
    'Hear an anomalous sound from the corridor',
    'Find a dropped clue with subtle fragrance',
  ];

  const handleStartEditBeat = (id: string, text: string) => {
    setEditingBeatId(id);
    setEditingBeatContent(text);
  };

  const handleSaveEditBeat = (id: string) => {
    const updated = project.manuscript.map((b) => (b.id === id ? { ...b, text: editingBeatContent } : b));
    onUpdateManuscript(updated);
    setEditingBeatId(null);
  };

  const handleDeleteBeat = (id: string) => {
    const updated = project.manuscript.filter((b) => b.id !== id);
    onUpdateManuscript(updated);
  };

  const handleRunFramework = () => {
    onExecuteFramework({
      operation,
      narrativeDistance: distance,
      authorPrompt: promptText,
      rewriteContract: operation === 'TRANSFORMATION' ? selectedRewritePreset : undefined,
    });
  };

  const handleRunNakedComparison = async () => {
    setIsNakedLoading(true);
    try {
      const fullPrompt = promptText || 'What happens next?';
      const nakedResult = await onExecuteNaked(fullPrompt);
      setNakedComparisonText(nakedResult);
    } catch (e) {
      console.error(e);
    } finally {
      setIsNakedLoading(false);
    }
  };

  const handleBeginStructuralReview = () => {
    setStructuralReviewSnapshot(buildBootstrapManifest(project, discoverBootstrap(project)));
  };

  const activePov = project.actors.find((a) => a.id === activePovActorId(project));
  function activePovActorId(p: StoryProject) {
    return p.activePovActorId;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Manuscript Feed & Literary Prose (7 cols) */}
      <div className="lg:col-span-7 space-y-8">
        {/* Author-Supplied Source Material (Manuscript Intake) */}
        {project.sourceDocuments && project.sourceDocuments.length > 0 && (
          <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#1A1A1A]/20 pb-4">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-[#1A1A1A]" />
                <div>
                  <span className="text-[10px] uppercase tracking-[0.3em] font-sans text-[#736B63] mb-1 block font-bold">
                    Author-Supplied Source Material
                  </span>
                  <p className="text-xs text-[#5A554E] font-serif italic">
                    Preserved exactly as entered. Not yet interpreted, structured, or
                    converted into story state.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-sans uppercase tracking-widest text-[#5A554E] bg-[#E5E2D9] px-2.5 py-1 rounded font-bold whitespace-nowrap">
                Authoritative / Unstructured
              </span>
            </div>

            <div className="space-y-4">
              {project.sourceDocuments.map((doc) => (
                <article key={doc.id} className="bg-[#FDFCF8] border border-[#1A1A1A]/20 rounded p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5A554E] mb-3 border-b border-[#1A1A1A]/10 pb-2">
                    <span className="font-serif italic text-sm text-[#1A1A1A]">{doc.label}</span>
                    <span className="font-sans text-[10px] uppercase tracking-wider text-[#8C827A]">
                      Imported {new Date(doc.importedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[#1A1A1A] text-sm sm:text-base font-serif leading-relaxed whitespace-pre-wrap">
                    {doc.exactText}
                  </p>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Manuscript Header Banner */}
        <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#1A1A1A]/20 pb-4 mb-5">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] font-sans text-[#736B63] mb-1 block font-bold">
                Manuscript Chronicle
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif italic text-[#1A1A1A] font-light">
                {project.title}
              </h2>
              <p className="text-xs text-[#5A554E] font-serif italic mt-1">{project.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-sans uppercase tracking-widest text-[#5A554E] bg-[#E5E2D9] px-2.5 py-1 rounded font-bold">
                {project.currentPosition.chapter}
              </span>
            </div>
          </div>

          {/* Manuscript Beats Feed */}
          <div className="space-y-6">
            {project.manuscript.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-[#1A1A1A]/20 rounded bg-[#FDFCF8] text-[#736B63]">
                <Bookmark className="h-8 w-8 mx-auto mb-2 text-[#A09A90]" />
                <p className="text-base font-serif italic">No story beats composed in this folio yet.</p>
                <p className="text-xs font-sans mt-1 uppercase tracking-wider text-[#8C827A]">
                  Use the Narrative Engine on the right to compose the opening beat.
                </p>
              </div>
            ) : (
              project.manuscript.map((beat, idx) => {
                const beatActor = project.actors.find((a) => a.id === beat.povActorId);
                const isEditing = editingBeatId === beat.id;
                const formattedNum = String(idx + 1).padStart(2, '0');

                return (
                  <article
                    key={beat.id}
                    className="group relative bg-[#FDFCF8] border border-[#1A1A1A]/20 rounded p-5 transition-all hover:border-[#1A1A1A] shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-[#5A554E] mb-3 border-b border-[#1A1A1A]/10 pb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-sans text-[10px] uppercase tracking-widest font-bold bg-[#1A1A1A] text-[#FDFCF8] px-2 py-0.5 rounded">
                          Beat {formattedNum}
                        </span>
                        <span className="font-sans text-[11px] text-[#5A554E] font-semibold">
                          POV: <span className="font-serif italic text-[#1A1A1A]">{beatActor?.identity.name || beatActor?.identity.working_label || beat.povActorId}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEditBeat(beat.id, beat.text)}
                          className="p-1 hover:text-[#1A1A1A] text-[#736B63] transition"
                          title="Edit Beat Prose"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteBeat(beat.id)}
                          className="p-1 hover:text-[#8B263E] text-[#736B63] transition"
                          title="Delete Beat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="space-y-3 mt-2">
                        <textarea
                          rows={4}
                          className="w-full bg-[#FAF8F2] border border-[#1A1A1A] rounded p-3 text-sm text-[#1A1A1A] focus:outline-none font-serif leading-relaxed"
                          value={editingBeatContent}
                          onChange={(e) => setEditingBeatContent(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingBeatId(null)}
                            className="px-3 py-1 rounded bg-[#E5E2D9] text-xs font-sans uppercase tracking-wider font-semibold text-[#1A1A1A] hover:bg-[#D8D4C7]"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEditBeat(beat.id)}
                            className="px-3 py-1 rounded bg-[#1A1A1A] hover:bg-[#333333] text-xs font-sans uppercase tracking-wider font-bold text-[#FDFCF8]"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4 items-start">
                        <div className="w-px self-stretch bg-[#1A1A1A]/20 my-1" />
                        <p className="text-[#1A1A1A] text-base sm:text-lg font-serif leading-relaxed">
                          {beat.text}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>

        {/* Live Candidate Review / Editorial Proof Card */}
        {candidate && (
          <div className="bg-[#1A1A1A] text-[#FDFCF8] rounded p-6 shadow-xl space-y-5 border border-[#1A1A1A]">
            <div className="flex items-center justify-between border-b border-white/20 pb-4">
              <div>
                <span className="text-[9px] uppercase tracking-[0.3em] font-sans text-white/60 block mb-0.5">
                  Editorial Proof Review
                </span>
                <h3 className="font-serif italic text-lg sm:text-xl text-[#FDFCF8]">
                  Candidate Generation ({candidate.narrativeDistance})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-sans uppercase tracking-wider font-bold px-2.5 py-1 rounded ${
                    candidate.validation.passed
                      ? 'bg-[#2D5A27] text-[#FDFCF8]'
                      : 'bg-[#8B263E] text-[#FDFCF8]'
                  }`}
                >
                  Continuity: {candidate.validation.score}/100 ({candidate.validation.passed ? 'PASSED' : 'CHECK'})
                </span>
              </div>
            </div>

            {/* Stage 1 Plan Summary */}
            {candidate.stage1Artifact && (
              <div className="bg-white/10 rounded p-4 text-xs font-sans space-y-2 text-white/90 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[11px] uppercase tracking-wider text-[#E5E2D9] flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Stage 1 Narrative Plan:</span>
                  </div>
                  {candidate.contextPackage && (
                    <button
                      type="button"
                      onClick={() => setShowContextPackage((prev) => !prev)}
                      className="text-[10px] text-[#E5E2D9] hover:underline font-mono uppercase tracking-wider"
                    >
                      {showContextPackage ? 'Hide Context Package' : 'Inspect Authorized Context Package'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="text-white/50 uppercase text-[10px]">Beat Type:</span> {candidate.stage1Artifact.value.beat_type}
                  </div>
                  <div>
                    <span className="text-white/50 uppercase text-[10px]">Primary Actor:</span> {candidate.stage1Artifact.value.primary_actor_id}
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-white/50 uppercase text-[10px]">Intended Action:</span> {candidate.stage1Artifact.value.intended_action}
                  </div>
                </div>

                {showContextPackage && candidate.contextPackage && (
                  <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
                    <div className="text-[10px] uppercase tracking-widest text-[#E5E2D9] font-bold">
                      Knowledge Boundaries (Enforced by Context Exclusion):
                    </div>
                    <div className="bg-[#FAF8F2] text-[#1A1A1A] p-3 rounded text-[11px] font-mono max-h-48 overflow-y-auto space-y-1.5">
                      <div>
                        <strong>Authorized Known Facts ({candidate.contextPackage.knownFacts?.length || 0}):</strong>
                        <ul className="list-disc list-inside text-[10px] mt-0.5">
                          {candidate.contextPackage.knownFacts?.map((f: any) => (
                            <li key={f.id}>{f.statement}</li>
                          )) || <li>None</li>}
                        </ul>
                      </div>
                      <div>
                        <strong>Permitted Foreshadowing Cues ({candidate.contextPackage.permittedForeshadowingCues?.length || 0}):</strong>
                        <ul className="list-disc list-inside text-[10px] mt-0.5">
                          {candidate.contextPackage.permittedForeshadowingCues?.map((c: string, idx: number) => (
                            <li key={idx}>{c}</li>
                          )) || <li>None</li>}
                        </ul>
                      </div>
                      <div className="text-[9px] text-[#5A554E] italic font-serif pt-1">
                        * Note: Hidden world truth and locked reveals were strictly excluded prior to model invocation.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stage 2 Rendered Text (Editable before accepting) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="uppercase tracking-wider text-[10px] text-white/70 font-bold">Proposed Literary Prose:</span>
                <span className="text-white/40 italic font-serif text-[11px]">Directly editable prior to canonization</span>
              </div>
              <textarea
                rows={4}
                className="w-full bg-[#FAF8F2] text-[#1A1A1A] rounded p-4 text-base font-serif leading-relaxed border border-[#1A1A1A] focus:outline-none"
                value={candidate.stage2Prose}
                onChange={(e) => onEditCandidateText(e.target.value)}
              />
            </div>

            {/* Diagnostics List */}
            {candidate.validation.diagnostics.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-sans uppercase tracking-widest text-white/60 font-bold">
                  Continuity & Boundary Validation:
                </span>
                <div className="space-y-1.5">
                  {candidate.validation.diagnostics.map((diag, i) => (
                    <div
                      key={i}
                      className={`text-xs px-3.5 py-2 rounded flex items-start gap-2.5 font-sans ${
                        diag.severity === 'FATAL'
                          ? 'bg-[#8B263E]/80 text-[#FDFCF8]'
                          : diag.severity === 'WARNING'
                          ? 'bg-[#966F33]/80 text-[#FDFCF8]'
                          : 'bg-white/10 text-white/90'
                      }`}
                    >
                      {diag.severity === 'FATAL' ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-white mt-0.5" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 shrink-0 text-white mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold uppercase tracking-wider text-[10px]">{diag.rule}:</span> {diag.message}
                        {diag.remedy && <div className="text-[11px] text-white/70 mt-0.5 italic font-serif">Remedy: {diag.remedy}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Promotion Failure Notice */}
            {workbenchError && workbenchError.source === 'promote' && (
              <WorkbenchErrorNotice message={workbenchError.message} dark />
            )}

            {/* Action Buttons: Accept vs Reject */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/20">
              <button
                onClick={onRejectCandidate}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-xs font-sans uppercase tracking-wider font-bold text-white/80 transition"
              >
                <XCircle className="h-4 w-4 text-red-300" />
                <span>Reject Candidate</span>
              </button>

              <button
                onClick={onAcceptCandidate}
                className="flex items-center gap-2 px-5 py-2.5 rounded bg-[#FDFCF8] hover:bg-[#E5E2D9] text-xs font-sans uppercase tracking-widest font-bold text-[#1A1A1A] transition shadow-md"
              >
                <CheckCircle2 className="h-4 w-4 text-[#2D5A27]" />
                <span>Promote to Story Canon</span>
              </button>
            </div>
          </div>
        )}

        {/* Naked Comparison Viewer (if run) */}
        {nakedComparisonText && (
          <div className="bg-[#E5E2D9] border border-[#1A1A1A]/30 rounded p-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-sans">
              <span className="uppercase tracking-widest font-bold text-[#1A1A1A]">
                Unconstrained Model Output (No Framework):
              </span>
              <button onClick={() => setNakedComparisonText(null)} className="text-[#736B63] hover:text-[#1A1A1A] text-xs font-bold font-sans uppercase">
                Close
              </button>
            </div>
            <p className="text-sm sm:text-base text-[#1A1A1A] italic font-serif leading-relaxed bg-[#FDFCF8] p-4 rounded border border-[#1A1A1A]/20">
              {nakedComparisonText}
            </p>
            <p className="text-[11px] text-[#5A554E] font-sans">
              * Notice how unconstrained models frequently hallucinate facts or leak locked reveals without the Onceaponatime framework boundaries.
            </p>
          </div>
        )}
      </div>

      {/* Right Column: Narrative Engine Controls & Boundaries (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#FAF8F2] border border-[#1A1A1A] rounded p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-[#1A1A1A]/20 pb-3">
            <div>
              <span className="text-[9px] uppercase tracking-[0.3em] font-sans text-[#736B63] block font-bold">
                Composition Engine
              </span>
              <h3 className="font-serif italic text-xl text-[#1A1A1A]">
                Narrative Controls
              </h3>
            </div>
            <span className="text-[10px] font-sans uppercase tracking-widest bg-[#E5E2D9] text-[#1A1A1A] px-2 py-0.5 rounded font-bold">
              Two-Stage Pipeline
            </span>
          </div>

          {/* Operation Family Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-sans uppercase tracking-[0.2em] font-bold text-[#736B63]">
              Operating Mode:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'CONTINUATION', label: 'Continuation', desc: 'Advance story by distance' },
                { id: 'GENERATION', label: 'Generation', desc: 'Brainstorm new scene/beat' },
                { id: 'TRANSFORMATION', label: 'Rewrite', desc: 'Constrained transformation' },
                { id: 'ANALYSIS', label: 'Analysis', desc: 'Inspect continuity' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setOperation(m.id as OperatingMode)}
                  className={`p-3 rounded border text-left transition ${
                    operation === m.id
                      ? 'bg-[#1A1A1A] text-[#FDFCF8] border-[#1A1A1A] shadow-sm'
                      : 'bg-[#FDFCF8] border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#E5E2D9]/50'
                  }`}
                >
                  <div className="text-xs font-bold font-sans uppercase tracking-wider">{m.label}</div>
                  <div className={`text-[10px] truncate ${operation === m.id ? 'text-white/70' : 'text-[#736B63]'}`}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Narrative Distance Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-sans uppercase tracking-[0.2em] font-bold text-[#736B63]">
                Narrative Distance:
              </label>
              <span className="text-[10px] text-[#5A554E] font-serif italic">
                {narrativeDistances.find((d) => d.id === distance)?.desc}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {narrativeDistances.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDistance(d.id)}
                  className={`px-3 py-1.5 rounded text-xs font-sans uppercase tracking-wider border transition ${
                    distance === d.id
                      ? 'bg-[#1A1A1A] text-[#FDFCF8] font-bold border-[#1A1A1A] shadow-sm'
                      : 'bg-[#FDFCF8] border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#E5E2D9]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* POV & Spatial Location Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1A1A1A]/15">
            <div>
              <label className="text-[10px] font-sans uppercase tracking-wider font-bold text-[#736B63] flex items-center gap-1 mb-1">
                <Eye className="h-3 w-3 text-[#1A1A1A]" />
                <span>POV Actor:</span>
              </label>
              {hasAnyActors ? (
                <select
                  className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded px-2.5 py-1.5 text-xs text-[#1A1A1A] font-serif italic focus:outline-none focus:border-[#1A1A1A]"
                  value={project.activePovActorId}
                  onChange={(e) => onSetPovActor(e.target.value)}
                >
                  {project.actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.identity.name || actor.identity.working_label} ({actor.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-[#E5E2D9]/50 border border-[#1A1A1A]/20 rounded px-2.5 py-1.5 text-xs text-[#736B63] font-serif italic">
                  Unassigned / Not established
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-sans uppercase tracking-wider font-bold text-[#736B63] flex items-center gap-1 mb-1">
                <Compass className="h-3 w-3 text-[#1A1A1A]" />
                <span>Current Location:</span>
              </label>
              {hasAnyLocations ? (
                <select
                  className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded px-2.5 py-1.5 text-xs text-[#1A1A1A] font-serif italic focus:outline-none focus:border-[#1A1A1A]"
                  value={project.currentPosition.location_id}
                  onChange={(e) => {
                    const loc = project.locations.find((l) => l.id === e.target.value);
                    onSetLocation(e.target.value, loc?.identity.name || loc?.identity.working_label || e.target.value);
                  }}
                >
                  {project.locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.identity.name || loc.identity.working_label} ({loc.id})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-[#E5E2D9]/50 border border-[#1A1A1A]/20 rounded px-2.5 py-1.5 text-xs text-[#736B63] font-serif italic">
                  Not established
                </div>
              )}
            </div>
          </div>

          {/* Transformation / Rewrite Contract Panel (Only in TRANSFORMATION mode) */}
          {operation === 'TRANSFORMATION' && (
            <div className="bg-[#E5E2D9] border border-[#1A1A1A]/40 rounded p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-sans font-bold uppercase tracking-wider text-[#1A1A1A]">
                  <FileEdit className="h-3.5 w-3.5" />
                  <span>Rewrite Contract:</span>
                </div>
                <button
                  onClick={() => setShowContractDetails(!showContractDetails)}
                  className="text-[#5A554E] hover:text-[#1A1A1A] text-xs flex items-center gap-1 font-sans font-semibold"
                >
                  <span>{showContractDetails ? 'Hide Rules' : 'Inspect Rules'}</span>
                  {showContractDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {REWRITE_PRESETS.map((preset) => (
                  <button
                    key={preset.presetName}
                    onClick={() => setSelectedRewritePreset(preset)}
                    className={`px-3 py-1.5 rounded text-xs text-left font-sans border transition ${
                      selectedRewritePreset.presetName === preset.presetName
                        ? 'bg-[#1A1A1A] text-[#FDFCF8] font-bold border-[#1A1A1A]'
                        : 'bg-[#FDFCF8] border-[#1A1A1A]/20 text-[#1A1A1A] hover:bg-[#D8D4C7]'
                    }`}
                  >
                    {preset.presetName}
                  </button>
                ))}
              </div>

              {showContractDetails && (
                <div className="mt-2 text-xs space-y-1.5 border-t border-[#1A1A1A]/20 pt-2 font-sans">
                  <div>
                    <span className="text-[#2D5A27] font-bold uppercase text-[10px]">ALLOWED TO MODIFY:</span>{' '}
                    <span className="text-[#1A1A1A]">{selectedRewritePreset.modify.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-[#1A1A1A] font-bold uppercase text-[10px]">STRICTLY PRESERVE:</span>{' '}
                    <span className="text-[#5A554E]">{selectedRewritePreset.preserve.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-[#8B263E] font-bold uppercase text-[10px]">FORBIDDEN:</span>{' '}
                    <span className="text-[#8B263E]">{selectedRewritePreset.forbid.join(', ')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Author Prompt / Narrative Intent */}
          <div className="space-y-2">
            <label className="text-[10px] font-sans uppercase tracking-[0.2em] font-bold text-[#736B63]">
              Author Direction / Intent:
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Locke searches the drawer and listens for movement in the adjoining vault..."
              className="w-full bg-[#FDFCF8] border border-[#1A1A1A]/30 rounded p-3 text-sm text-[#1A1A1A] font-serif focus:border-[#1A1A1A] focus:outline-none"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
            {/* Quick Starters -- only meaningful once the project has established
                actors/locations of its own; these are illustrative demo prompts,
                not suggestions grounded in an imported project's own content. */}
            {readiness.ready && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPromptText(qp)}
                    className="text-[10px] font-sans uppercase tracking-wider px-2 py-0.5 rounded bg-[#E5E2D9] hover:bg-[#D8D4C7] text-[#5A554E] hover:text-[#1A1A1A] border border-[#1A1A1A]/10 transition"
                  >
                    + {qp}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Execution Buttons */}
          <div className="space-y-3 pt-3 border-t border-[#1A1A1A]/15">
            {/* Execution Failure Notice */}
            {workbenchError && workbenchError.source === 'execute' && (
              <WorkbenchErrorNotice message={workbenchError.message} />
            )}

            {readiness.ready ? (
              <button
                onClick={handleRunFramework}
                disabled={isGenerating}
                className="w-full py-3.5 rounded bg-[#1A1A1A] hover:bg-[#333333] text-[#FDFCF8] font-sans font-bold uppercase tracking-[0.15em] text-xs flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <span className="h-4 w-4 border-2 border-[#FDFCF8] border-t-transparent rounded-full animate-spin" />
                    <span>Enforcing Epistemic Boundaries...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-[#FDFCF8]" />
                    <span>Execute Onceaponatime Pipeline</span>
                  </>
                )}
              </button>
            ) : structuralReviewSnapshot !== null ? (
              <StructuralReviewPanel
                manifest={structuralReviewSnapshot}
                onClose={() => setStructuralReviewSnapshot(null)}
              />
            ) : (
              <div className="w-full py-3.5 px-4 rounded bg-[#E5E2D9]/60 border border-[#1A1A1A]/20 text-center space-y-1.5">
                <div className="flex items-center justify-center gap-2 text-[#5A554E] font-sans font-bold uppercase tracking-[0.15em] text-xs">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Composition Pipeline Unavailable</span>
                </div>
                <p className="text-[#5A554E] font-serif italic text-xs">
                  {NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE}
                </p>
                <p className="text-[#8C827A] font-sans text-[10px] uppercase tracking-wider">
                  Structural review must establish at least one actor and one location before generation can run.
                </p>
                {hasSubstantiveSource && (
                  <button
                    type="button"
                    onClick={handleBeginStructuralReview}
                    className="mt-2 inline-flex items-center justify-center rounded border border-[#1A1A1A]/30 bg-[#FDFCF8] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#1A1A1A] transition hover:bg-white"
                  >
                    BEGIN STRUCTURAL REVIEW
                  </button>
                )}
              </div>
            )}

            <button
              onClick={handleRunNakedComparison}
              disabled={isNakedLoading || isGenerating || !readiness.ready}
              title={readiness.ready ? undefined : NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE}
              className="w-full py-2.5 rounded bg-[#E5E2D9] hover:bg-[#D8D4C7] text-[#1A1A1A] text-xs font-sans uppercase tracking-wider font-bold flex items-center justify-center gap-1.5 border border-[#1A1A1A]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNakedLoading ? (
                <span>Querying Naked Model...</span>
              ) : (
                <>
                  <Split className="h-3.5 w-3.5 text-[#1A1A1A]" />
                  <span>Compare with Naked Model (Unconstrained)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Epistemic Boundary Summary Card */}
        <div className="bg-[#FAF8F2] border border-[#1A1A1A]/20 rounded p-5 text-xs font-sans space-y-3 text-[#5A554E]">
          <div className="text-[#1A1A1A] font-bold uppercase tracking-wider text-[11px] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#2D5A27]" />
            <span>Active Boundary Protection</span>
          </div>
          <p className="text-xs font-serif italic text-[#1A1A1A]">
            POV Actor <strong className="font-sans not-italic font-bold">{activePov?.identity.name || activePov?.id}</strong> is
            forbidden from accessing {activePov?.id ? (project.knowledge.actor_knowledge[activePov.id]?.forbidden_knowledge?.length || 0) : 0} secret facts.
          </p>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold pt-1">
            <span className="px-2.5 py-1 rounded bg-[#E5E2D9] text-[#1A1A1A]">
              Locked Reveals: {project.reveals.filter((r) => r.status === 'locked').length}
            </span>
            <span className="px-2.5 py-1 rounded bg-[#E5E2D9] text-[#1A1A1A]">
              Open Threads: {project.threads.filter((t) => t.status === 'open').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

