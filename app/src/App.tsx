import React, { useState } from 'react';
import { Header } from './components/Header';
import { StoryEditor } from './components/StoryEditor';
import { RelationalGraph } from './components/RelationalGraph';
import { KnowledgeMatrix } from './components/KnowledgeMatrix';
import { TemporalTimeline } from './components/TemporalTimeline';
import { CodexView } from './components/CodexView';
import { BenchmarkRunner } from './components/BenchmarkRunner';
import { LiteraryMechanicsGuide } from './components/LiteraryMechanicsGuide';
import { DEFAULT_PROJECTS } from './data/defaultProjects';
import {
  StoryProject,
  CandidateGeneration,
  OperatingMode,
  NarrativeDistance,
  RewriteContract,
  HistoryReceipt,
  RevealEntity,
  FactEntity,
  createInferenceArtifact,
  createCandidateGeneration,
  editCandidateStage2Prose,
} from './types';
import {
  applyAdmittedPossessionChanges,
  createMentionedObject,
  readPromotionExtractionResponse,
  restorePromotionSnapshot,
} from './lib/promotionIntegrity';
import {
  revalidationFailureReport,
  workbenchOperationError,
  type WorkbenchOperationError,
} from './lib/workbenchErrors';

export default function App() {
  const [projects, setProjects] = useState<StoryProject[]>(DEFAULT_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(DEFAULT_PROJECTS[0].id);
  const [activeTab, setActiveTab] = useState<string>('workbench');
  const [candidate, setCandidate] = useState<CandidateGeneration | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [historyStack, setHistoryStack] = useState<HistoryReceipt[]>([]);
  const [workbenchError, setWorkbenchError] = useState<WorkbenchOperationError | null>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || projects[0];

  // Helper to update current project state
  const updateActiveProject = (updated: Partial<StoryProject>) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? { ...p, ...updated } : p))
    );
  };

  // Push history snapshot for deterministic undo
  const pushHistorySnapshot = (summary: string, changes: string[]) => {
    const receipt: HistoryReceipt = {
      operation_id: `op_${Date.now()}`,
      timestamp: Date.now(),
      summary,
      changes,
      snapshot: JSON.parse(JSON.stringify(activeProject)),
    };
    setHistoryStack((prev) => [receipt, ...prev]);
  };

  // Undo / Rollback
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const [lastReceipt, ...remaining] = historyStack;
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProjectId ? lastReceipt.snapshot : p))
    );
    setHistoryStack(remaining);
    setCandidate(null);
    setWorkbenchError(null);
  };

  // New Blank Project Creation
  const handleNewProject = () => {
    const newId = `proj_${Date.now()}`;
    const newProject: StoryProject = {
      id: newId,
      title: 'Untitled Narrative Project',
      description: 'A newly initialized story project with neutral entity registry.',
      currentPosition: {
        act: 'Act I',
        chapter: 'Chapter 1: The Inciting Incident',
        scene: 'Scene 1',
        beat: 1,
        location_id: 'location_001',
        location_label: 'The Crossroads',
      },
      activePovActorId: 'actor_001',
      manuscript: [],
      actors: [
        {
          id: 'actor_001',
          identity: {
            name: null,
            working_label: 'the traveler',
            aliases: [],
          },
          roles: {
            story: ['protagonist'],
            scene: ['observer'],
          },
          traits: { observant: 0.8 },
          current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.5, emotion: 'curious' },
          active_goals: ['Investigate the strange signal'],
          current_location_id: 'location_001',
          possessions: [],
          isPresent: true,
        },
      ],
      objects: [],
      locations: [
        {
          id: 'location_001',
          identity: {
            name: 'The Crossroads',
            working_label: 'the quiet crossroads',
            aliases: [],
          },
          parent_location_id: null,
          connected_locations: [],
          description_summary: 'An open junction where ancient paths converge.',
        },
      ],
      factions: [],
      facts: [],
      threads: [],
      reveals: [],
      mentions: [],
      knowledge: {
        world_truth: [],
        reader_knowledge: [],
        actor_knowledge: {
          actor_001: { known_facts: [], beliefs: [], forbidden_knowledge: [] },
        },
      },
      temporalHistory: [],
    };

    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newId);
    setCandidate(null);
    setHistoryStack([]);
    setWorkbenchError(null);
  };

  // Framework Pipeline Execution
  const handleExecuteFramework = async (params: {
    operation: OperatingMode;
    narrativeDistance: NarrativeDistance;
    authorPrompt: string;
    rewriteContract?: RewriteContract;
  }) => {
    setIsGenerating(true);
    setWorkbenchError(null);
    try {
      const response = await fetch('/api/framework/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: activeProject,
          operation: params.operation,
          narrativeDistance: params.narrativeDistance,
          authorPrompt: params.authorPrompt,
          rewriteContract: params.rewriteContract,
          activePovActorId: activeProject.activePovActorId,
          currentPosition: activeProject.currentPosition,
        }),
      });

      const data = await response.json();

      if (!data.success && data.error) {
        throw new Error(data.error);
      }

      const stage1Artifact = createInferenceArtifact(data.stage1.value, data.stage1.receipt);
      const stage2Artifact = createInferenceArtifact(data.stage2.value, data.stage2.receipt);

      // Formulate candidate generation for author review
      const newCandidate = createCandidateGeneration({
        id: `cand_${Date.now()}`,
        timestamp: Date.now(),
        operation: params.operation,
        narrativeDistance: params.narrativeDistance,
        prompt: params.authorPrompt,
        stage1Artifact,
        stage2Artifact,
        validation: data.validation || {
          passed: false,
          score: 0,
          verified: false,
          status: 'UNVERIFIED',
          diagnostics: [
            {
              severity: 'FATAL',
              rule: 'VALIDATION_MISSING',
              message: 'Validation report was not returned from the pipeline.',
            },
          ],
          notes: 'Unverified generation',
        },
        contextPackage: data.contextPackage,
        status: 'pending',
      });

      setCandidate(newCandidate);
    } catch (err) {
      console.error('Execution error:', err);
      setWorkbenchError(workbenchOperationError('execute', err));
    } finally {
      setIsGenerating(false);
    }
  };

  // Naked Execution for Benchmark Comparison
  const handleExecuteNaked = async (prompt: string): Promise<string> => {
    const recentProse = activeProject.manuscript
      .slice(-3)
      .map((b) => b.text)
      .join('\n\n');

    const res = await fetch('/api/benchmark/naked-execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proseContext: recentProse,
        authorPrompt: prompt,
      }),
    });
    const data = await res.json();
    return data.prose || 'No response from naked model.';
  };

  // Accept Candidate and Promote to Story Canon Transactionally
  const handleAcceptCandidate = async () => {
    if (!candidate) return;
    setWorkbenchError(null);

    // Snapshot pre-promotion project state for atomic rollback
    const preSnapshot: StoryProject = JSON.parse(JSON.stringify(activeProject));
    const operationId = `op_${Date.now()}`;
    const newBeatNumber = activeProject.manuscript.length + 1;
    const newBeatId = `beat_${Date.now()}`;

    try {
      // 1. Call real mention and state change extraction pipeline
      const extractionRes = await fetch('/api/framework/extract-mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prose: candidate.stage2Prose,
          sceneId: activeProject.currentPosition.scene,
          beatIndex: newBeatNumber,
          locationId: activeProject.currentPosition.location_id,
          povActorId: activeProject.activePovActorId,
          existingActors: activeProject.actors.map((a) => ({
            id: a.id,
            identity: a.identity,
          })),
          existingObjects: activeProject.objects.map((o) => ({
            id: o.id,
            identity: o.identity,
            current_holder_id: o.current_holder_id,
          })),
          existingLocations: activeProject.locations.map((l) => ({
            id: l.id,
            identity: l.identity,
          })),
        }),
      });

      const extractionData = await readPromotionExtractionResponse(extractionRes);
      const extractedMentions = extractionData.mentions;
      const stateChanges = extractionData.stateChanges;

      // 2. Compute state transformations
      const promotionDraft: StoryProject = JSON.parse(JSON.stringify(activeProject));
      const updatedActors = promotionDraft.actors;
      const updatedObjects = promotionDraft.objects;
      const updatedLocations = promotionDraft.locations;
      const updatedThreads = promotionDraft.threads;
      const updatedReveals = promotionDraft.reveals;
      const updatedKnowledge = promotionDraft.knowledge;

      // Handle proposed new entities
      if (Array.isArray(extractionData.proposedNewEntities)) {
        for (const newEnt of extractionData.proposedNewEntities) {
          if (newEnt.type === 'actor' && !updatedActors.some((a) => a.id === newEnt.id)) {
            updatedActors.push({
              id: newEnt.id,
              identity: {
                name: newEnt.name || null,
                working_label: newEnt.working_label || 'unknown actor',
                aliases: newEnt.aliases || [],
              },
              roles: { story: ['supporting'], scene: ['present'] },
              traits: {},
              current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.5, emotion: 'neutral' },
              active_goals: [],
              current_location_id: activeProject.currentPosition.location_id,
              possessions: [],
              isPresent: true,
            });
          } else if (newEnt.type === 'object' && !updatedObjects.some((o) => o.id === newEnt.id)) {
            updatedObjects.push(createMentionedObject(
              newEnt,
              activeProject.currentPosition.location_id,
            ));
          }
        }
      }

      const appliedChangeDescriptions: string[] = [];

      // Apply location changes
      for (const locChange of stateChanges.location_changes || []) {
        const actor = updatedActors.find((a) => a.id === locChange.entity_id);
        if (actor && locChange.to_location_id) {
          actor.current_location_id = locChange.to_location_id;
          appliedChangeDescriptions.push(`${actor.identity.name || actor.id} relocated to ${locChange.to_location_id}`);
        }
      }

      // Apply possession changes
      applyAdmittedPossessionChanges(
        updatedObjects,
        stateChanges.possession_changes,
        appliedChangeDescriptions,
      );

      // Apply actor state updates (fatigue, emotion)
      for (const stChange of stateChanges.actor_state_changes || []) {
        const actor = updatedActors.find((a) => a.id === stChange.actor_id);
        if (actor) {
          if (typeof stChange.fatigue_delta === 'number') {
            actor.current_state.fatigue = Math.min(1.0, Math.max(0.0, actor.current_state.fatigue + stChange.fatigue_delta));
          }
          if (stChange.emotion) {
            actor.current_state.emotion = stChange.emotion;
            appliedChangeDescriptions.push(`${actor.identity.name || actor.id} emotional state updated to "${stChange.emotion}"`);
          }
        }
      }

      // Apply belief changes
      for (const belChange of stateChanges.belief_changes || []) {
        if (belChange.actor_id && belChange.new_belief) {
          if (!updatedKnowledge.actor_knowledge[belChange.actor_id]) {
            updatedKnowledge.actor_knowledge[belChange.actor_id] = { known_facts: [], beliefs: [], forbidden_knowledge: [] };
          }
          updatedKnowledge.actor_knowledge[belChange.actor_id].beliefs.push(belChange.new_belief);
          appliedChangeDescriptions.push(`New belief formed by ${belChange.actor_id}: "${belChange.new_belief}"`);
        }
      }

      // Apply thread advancements from Stage 1 plan & extraction
      const threadsAdvanced = candidate.stage1Artifact.value.threads_advanced || [];
      for (const thId of threadsAdvanced) {
        const th = updatedThreads.find((t) => t.id === thId);
        if (th) {
          appliedChangeDescriptions.push(`Advanced open thread: ${th.label}`);
        }
      }

      // 3. Construct new manuscript beat
      const newBeat = {
        id: newBeatId,
        beatNumber: newBeatNumber,
        text: candidate.stage2Prose,
        povActorId: activeProject.activePovActorId,
        locationId: activeProject.currentPosition.location_id,
        acceptedAt: Date.now(),
      };

      // 4. Construct location & possession state maps for the chronological receipt
      const entityLocationsMap: Record<string, string> = {};
      for (const a of updatedActors) entityLocationsMap[a.id] = a.current_location_id;
      for (const o of updatedObjects) if (o.current_location_id) entityLocationsMap[o.id] = o.current_location_id;

      const objectPossessionsMap: Record<string, string | null> = {};
      for (const o of updatedObjects) objectPossessionsMap[o.id] = o.current_holder_id;

      const actorStatesMap: Record<string, { fatigue: number; emotion: string }> = {};
      for (const a of updatedActors) {
        actorStatesMap[a.id] = {
          fatigue: a.current_state.fatigue,
          emotion: a.current_state.emotion,
        };
      }

      const affectedEntityIds = Array.from(
        new Set([
          activeProject.activePovActorId,
          ...extractedMentions.map((m) => m.entity_id),
          ...(candidate.stage1Artifact.value.permitted_entities_involved || []),
        ])
      );

      // 5. Generate Real Chronological Receipt
      const newReceipt = {
        time_index: `T${newBeatNumber}`,
        operation_id: operationId,
        timestamp: Date.now(),
        label: `Beat #${newBeatNumber}: ${candidate.stage1Artifact.value.intended_action || 'Canonized Beat'}`,
        beat_ref: `Beat ${newBeatNumber}`,
        previous_story_position: { ...activeProject.currentPosition },
        resulting_story_position: {
          ...activeProject.currentPosition,
          beat: newBeatNumber + 1,
        },
        accepted_beat_id: newBeatId,
        pov_actor_id: activeProject.activePovActorId,
        location_id: activeProject.currentPosition.location_id,
        affected_entity_ids: affectedEntityIds,
        applied_state_changes: appliedChangeDescriptions.length > 0 ? appliedChangeDescriptions : ['Beat integrated into story canon.'],
        thread_changes: threadsAdvanced,
        reveal_changes: [],
        mention_ids: extractedMentions.map((m) => m.id),
        entity_locations: entityLocationsMap,
        object_possessions: objectPossessionsMap,
        actor_states: actorStatesMap,
        unlocked_reveals: updatedReveals.filter((r) => r.status === 'unlocked').map((r) => r.id),
      };

      // Push history undo snapshot
      pushHistorySnapshot(`Accepted Beat #${newBeatNumber} (${candidate.narrativeDistance})`, [
        `Canonized Beat #${newBeatNumber}`,
        `Extracted ${extractedMentions.length} entity mentions`,
        `Committed Chronological Receipt T${newBeatNumber}`,
      ]);

      // Atomic commit to active project
      updateActiveProject({
        manuscript: [...activeProject.manuscript, newBeat],
        currentPosition: {
          ...activeProject.currentPosition,
          beat: newBeatNumber + 1,
        },
        actors: updatedActors,
        objects: updatedObjects,
        locations: updatedLocations,
        threads: updatedThreads,
        reveals: updatedReveals,
        knowledge: updatedKnowledge,
        mentions: [...activeProject.mentions, ...extractedMentions],
        temporalHistory: [...activeProject.temporalHistory, newReceipt],
      });

      setCandidate(null);
    } catch (err) {
      console.error('[Transactional Promotion Failed]', err);
      // Restore pre-promotion snapshot; the candidate/review text is left untouched
      // (it was never cleared on this path) so the author's work is not lost.
      setProjects((prev) => restorePromotionSnapshot(prev, activeProjectId, preSnapshot));
      setWorkbenchError(workbenchOperationError('promote', err));
    }
  };

  const handleRejectCandidate = () => {
    setCandidate(null);
    setWorkbenchError(null);
  };

  const handleEditCandidateText = async (text: string) => {
    if (!candidate) return;
    const updatedCandidate = editCandidateStage2Prose(candidate, text);
    setCandidate(updatedCandidate);

    // Re-run validation asynchronously on edit
    try {
      const res = await fetch('/api/framework/validate-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: activeProject,
          candidateProse: text,
          stage1Plan: candidate.stage1Artifact.value,
          narrativeDistance: candidate.narrativeDistance,
          povActorId: activeProject.activePovActorId,
        }),
      });
      const valReport = await res.json();
      setCandidate((prev) => (prev ? { ...prev, validation: valReport } : null));
    } catch (e) {
      console.warn('Revalidation error:', e);
      // The prose was already updated above; the old validation verdict no longer
      // applies to it, so it must not be left looking trustworthy.
      setCandidate((prev) => (
        prev ? { ...prev, validation: revalidationFailureReport(e, prev.validation) } : null
      ));
    }
  };

  // Entity Merging Mechanic
  const handleMergeEntities = (primaryId: string, secondaryId: string, entityType: 'actor' | 'object') => {
    pushHistorySnapshot(`Merged ${secondaryId} into ${primaryId}`, [
      `Migrated all mentions of ${secondaryId} to ${primaryId}`,
    ]);

    // Migrate mentions
    const updatedMentions = activeProject.mentions.map((m) =>
      m.entity_id === secondaryId ? { ...m, entity_id: primaryId } : m
    );

    if (entityType === 'actor') {
      const remainingActors = activeProject.actors.filter((a) => a.id !== secondaryId);
      updateActiveProject({ actors: remainingActors, mentions: updatedMentions });
    } else {
      const remainingObjects = activeProject.objects.filter((o) => o.id !== secondaryId);
      updateActiveProject({ objects: remainingObjects, mentions: updatedMentions });
    }
  };

  // Entity Splitting Mechanic
  const handleSplitEntity = (entityId: string, mentionIdsToMove: string[], newWorkingLabel: string) => {
    const newEntityId = `${entityId.split('_')[0]}_${String(Date.now()).slice(-3)}`;
    pushHistorySnapshot(`Split ${entityId} into new entity ${newEntityId}`, [
      `Created ${newEntityId} ("${newWorkingLabel}")`,
      `Moved ${mentionIdsToMove.length} mentions`,
    ]);

    const updatedMentions = activeProject.mentions.map((m) =>
      mentionIdsToMove.includes(m.id) ? { ...m, entity_id: newEntityId } : m
    );

    if (entityId.startsWith('actor')) {
      const newActor = {
        id: newEntityId,
        identity: { name: null, working_label: newWorkingLabel, aliases: [] },
        roles: { story: ['supporting'], scene: ['participant'] },
        traits: {},
        current_state: { fatigue: 0.1, fear: 0.1, certainty: 0.5, emotion: 'neutral' },
        active_goals: [],
        current_location_id: activeProject.currentPosition.location_id,
        possessions: [],
        isPresent: true,
      };
      updateActiveProject({
        actors: [...activeProject.actors, newActor],
        mentions: updatedMentions,
      });
    } else {
      const newObj = {
        id: newEntityId,
        identity: { name: null, working_label: newWorkingLabel, aliases: [] },
        current_holder_id: null,
        current_location_id: activeProject.currentPosition.location_id,
        status: 'intact' as const,
        salience: 0.5,
        isPresent: true,
      };
      updateActiveProject({
        objects: [...activeProject.objects, newObj],
        mentions: updatedMentions,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#1A1A1A] font-serif selection:bg-[#E5E2D9] selection:text-[#1A1A1A] flex flex-col justify-between">
      <div>
        {/* Top Header & Masthead */}
        <Header
          projects={projects}
          activeProject={activeProject}
          onSelectProject={setActiveProjectId}
          onNewProject={handleNewProject}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          undoCount={historyStack.length}
          onUndo={handleUndo}
        />

        {/* Main Tab Routing */}
        <main className="pb-12">
          {activeTab === 'workbench' && (
            <StoryEditor
              project={activeProject}
              onUpdateManuscript={(beats) => updateActiveProject({ manuscript: beats })}
              onSetPovActor={(actorId) => updateActiveProject({ activePovActorId: actorId })}
              onSetLocation={(locId, locLabel) =>
                updateActiveProject({
                  currentPosition: {
                    ...activeProject.currentPosition,
                    location_id: locId,
                    location_label: locLabel,
                  },
                })
              }
              onExecuteFramework={handleExecuteFramework}
              onExecuteNaked={handleExecuteNaked}
              candidate={candidate}
              onAcceptCandidate={handleAcceptCandidate}
              onRejectCandidate={handleRejectCandidate}
              onEditCandidateText={handleEditCandidateText}
              isGenerating={isGenerating}
              workbenchError={workbenchError}
            />
          )}

          {activeTab === 'graph' && (
            <RelationalGraph
              project={activeProject}
              onUpdateEntity={(cat, list) => updateActiveProject({ [cat]: list })}
              onAddMention={(m) => updateActiveProject({ mentions: [...activeProject.mentions, m] })}
              onMergeEntities={handleMergeEntities}
              onSplitEntity={handleSplitEntity}
            />
          )}

          {activeTab === 'knowledge' && (
            <KnowledgeMatrix
              project={activeProject}
              onUpdateKnowledge={(k) => updateActiveProject({ knowledge: k })}
              onUpdateReveals={(revs) => updateActiveProject({ reveals: revs })}
              onAddFact={(f) => updateActiveProject({ facts: [...activeProject.facts, f] })}
            />
          )}

          {activeTab === 'timeline' && <TemporalTimeline project={activeProject} />}

          {activeTab === 'codex' && <CodexView project={activeProject} />}

          {activeTab === 'benchmark' && <BenchmarkRunner />}

          {activeTab === 'mechanics' && <LiteraryMechanicsGuide />}
        </main>
      </div>

      {/* Editorial Aesthetic Nav / Archive Footer */}
      <footer className="border-t border-[#1A1A1A] bg-[#FDFCF8] py-6 px-4 sm:px-8 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] uppercase tracking-[0.25em] font-sans font-bold text-[#5A554E]">
          <div className="flex items-center gap-6 flex-wrap">
            <span className="text-[#1A1A1A]">Onceaponatime</span>
            <span className="opacity-40">|</span>
            <span>Issue No. 04</span>
            <span className="opacity-40">|</span>
            <span>The Narrative Archive</span>
            <span className="opacity-40">|</span>
            <span>Literary Mechanics v1.0</span>
          </div>
          <div>© Storyteller Press & Research Folio</div>
        </div>
      </footer>
    </div>
  );
}
