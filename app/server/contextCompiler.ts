import {
  StoryProject,
  StoryPosition,
  OperatingMode,
  NarrativeDistance,
  RewriteContract,
  GenerationContext,
  Stage2RenderingEnvelope,
  BeatPlanStage1,
  ValidationContext,
  KnowledgeBoundaries,
} from '../src/types';
import { synthesizeCodex } from '../src/lib/codexEngine';

/**
 * Dedicated Context Compiler for Onceaponatime Literary Mechanics
 *
 * CRITICAL RULE: Knowledge boundaries MUST be enforced by context exclusion,
 * not by prompt instructions.
 *
 * If a generation-stage model is not authorized to know a fact, that fact must
 * not appear anywhere in that model invocation:
 * - NOT in system instructions
 * - NOT in JSON context
 * - NOT under a "forbidden" field
 * - NOT as a locked reveal with instructions not to disclose it
 */

export interface CompileGenerationContextParams {
  project: StoryProject;
  activePovActorId: string;
  currentPosition: StoryPosition;
  operation: OperatingMode;
  narrativeDistance: NarrativeDistance;
  rewriteContract?: RewriteContract | null;
  recentBeatCount?: number;
}

/**
 * POV-Authorized Continuity Prose Extractor
 *
 * Epistemic rules:
 * - A manuscript beat is only included if it was experienced from the active POV's
 *   perspective (beat.povActorId === povActor.id).
 * - Even for candidate beats, if a beat contains information/strings forbidden
 *   to this POV (forbidden facts, locked reveals, unknown world truths, or secret
 *   canonical names unknown to this POV), the beat is excluded.
 */
function compilePovAuthorizedRecentProse(
  project: StoryProject,
  povActorId: string,
  actorKnowledge: KnowledgeBoundaries['actor_knowledge'][string],
  recentBeatCount: number
): string {
  const forbiddenPhrases: string[] = [];

  // A. Statements of forbidden facts for this actor
  const forbiddenFactIds = new Set(actorKnowledge.forbidden_knowledge || []);
  for (const f of project.facts) {
    if (forbiddenFactIds.has(f.id) && f.statement) {
      forbiddenPhrases.push(f.statement.toLowerCase().trim());
    }
  }

  // B. World truths not known by this actor
  const knownFactIds = new Set(actorKnowledge.known_facts || []);
  const worldTruthIds = new Set(project.knowledge.world_truth || []);
  for (const f of project.facts) {
    if (worldTruthIds.has(f.id) && !knownFactIds.has(f.id) && f.statement) {
      forbiddenPhrases.push(f.statement.toLowerCase().trim());
    }
  }

  // C. Locked reveals forbidden strings / secret fact statements
  for (const r of project.reveals) {
    if (r.status === 'locked') {
      const fact = project.facts.find((f) => f.id === r.fact_id);
      if (fact && !knownFactIds.has(fact.id) && fact.statement) {
        forbiddenPhrases.push(fact.statement.toLowerCase().trim());
      }
      if (Array.isArray(r.forbidden_before_unlock)) {
        for (const term of r.forbidden_before_unlock) {
          if (
            term &&
            term.trim().length > 0 &&
            term !== 'direct_explanation' &&
            term !== 'narrator_confirmation'
          ) {
            forbiddenPhrases.push(term.toLowerCase().trim());
          }
        }
      }
    }
  }

  // D. Canonical secret names and working labels of other actors unknown to this POV
  const knownEntitiesSet = new Set(actorKnowledge.known_entities || []);
  for (const a of project.actors) {
    if (a.id !== povActorId && !knownEntitiesSet.has(a.id)) {
      const perception = actorKnowledge.known_entity_perceptions?.[a.id];
      if (!perception?.perceived_name && a.identity.name) {
        forbiddenPhrases.push(a.identity.name.toLowerCase().trim());
      }
      if (!perception?.perceived_label && a.identity.working_label && a.identity.working_label !== 'unidentified person') {
        forbiddenPhrases.push(a.identity.working_label.toLowerCase().trim());
      }
    }
  }

  const candidateBeats = project.manuscript.slice(-Math.max(1, recentBeatCount * 2));
  const authorizedBeats: string[] = [];

  for (const beat of candidateBeats) {
    // 1. Perspective check: Beat must be from this POV actor
    if (beat.povActorId !== povActorId) {
      continue;
    }

    // 2. Secret leak check: Beat text must not contain any forbidden phrase
    const lowerText = beat.text.toLowerCase();
    const hasForbiddenPhrase = forbiddenPhrases.some((phrase) => {
      return phrase.length > 2 && lowerText.includes(phrase);
    });

    if (hasForbiddenPhrase) {
      continue;
    }

    authorizedBeats.push(beat.text);
  }

  return authorizedBeats.slice(-recentBeatCount).join('\n\n');
}

export function compileGenerationContext(
  params: CompileGenerationContextParams
): GenerationContext {
  const {
    project,
    activePovActorId,
    currentPosition,
    operation,
    narrativeDistance,
    rewriteContract = null,
    recentBeatCount = 3,
  } = params;

  // 1. Identify the POV Actor
  const povActor = project.actors.find((a) => a.id === activePovActorId) || project.actors[0];
  if (!povActor) {
    throw new Error(`POV Actor with ID '${activePovActorId}' not found in project.`);
  }

  // 2. Fetch Epistemic Permissions for POV Actor
  const actorKnowledge = project.knowledge.actor_knowledge[povActor.id] || {
    known_facts: [],
    beliefs: [],
    forbidden_knowledge: [],
  };

  const knownFactIdSet = new Set<string>(actorKnowledge.known_facts || []);

  // 3. Compile ONLY facts explicitly known by this POV Actor
  // (Exclude all forbidden knowledge and hidden world truth)
  const knownFacts = project.facts
    .filter((f) => knownFactIdSet.has(f.id))
    .map((f) => ({
      id: f.id,
      statement: f.statement,
      status: f.status,
      provenance: f.provenance,
    }));

  // 4. Sincere Beliefs (beliefs the actor holds, which may differ from world truth)
  const sincereBeliefs = [...(actorKnowledge.beliefs || [])];

  // 5. Filter Currently Perceptible / Local Entities with Strict Epistemic Boundaries
  const presentActors = project.actors.filter(
    (a) => a.isPresent && a.current_location_id === currentPosition.location_id
  );
  const presentActorIdSet = new Set(presentActors.map((a) => a.id));

  const presentObjects = project.objects.filter((o) => {
    if (!o.isPresent) return false;
    if (o.current_location_id === currentPosition.location_id) return true;
    if (o.current_holder_id && presentActorIdSet.has(o.current_holder_id)) return true;
    return false;
  });

  // Current Location info
  const currentLocationEntity = project.locations.find(
    (l) => l.id === currentPosition.location_id
  );

  const currentLocation = currentLocationEntity
    ? {
        id: currentLocationEntity.id,
        name: currentLocationEntity.identity.name,
        working_label: currentLocationEntity.identity.working_label,
        description_summary: currentLocationEntity.description_summary,
        connected_locations: currentLocationEntity.connected_locations,
      }
    : null;

  const knownEntitiesSet = new Set(actorKnowledge.known_entities || []);

  // Normalized present entities list for the generator (epistemically filtered)
  const presentEntities: GenerationContext['presentEntities'] = [
    ...presentActors.map((a) => {
      // POV Actor knows their own canonical identity, roles, traits, and state
      if (a.id === povActor.id) {
        return {
          id: a.id,
          type: 'actor' as const,
          label: a.identity.working_label || a.identity.name || a.id,
          name: a.identity.name,
          aliases: a.identity.aliases || [],
          roleOrStatus: a.roles?.scene?.[0] || a.roles?.story?.[0] || 'character',
          locationId: a.current_location_id,
          currentHolderId: null,
          traitsOrDescription: a.traits,
          currentState: a.current_state,
        };
      }

      // Other present actors: filter strictly according to POV actor's knowledge
      const perception = actorKnowledge.known_entity_perceptions?.[a.id];
      const isCanonicalKnown = knownEntitiesSet.has(a.id) || (perception?.perceived_name !== undefined && perception?.perceived_name !== null);

      const perceivedLabel =
        perception?.perceived_label ||
        (isCanonicalKnown
          ? (a.identity.working_label || a.identity.name || a.id)
          : 'unidentified person');

      const perceivedName =
        perception?.perceived_name !== undefined
          ? perception.perceived_name
          : (isCanonicalKnown ? a.identity.name : null);

      const perceivedAliases = isCanonicalKnown ? (a.identity.aliases || []) : [];

      const perceivedRole =
        perception?.perceived_role ||
        (isCanonicalKnown
          ? (a.roles?.scene?.[0] || a.roles?.story?.[0] || 'character')
          : 'present character');

      const perceivedTraits =
        perception?.perceived_traits ||
        (isCanonicalKnown ? a.traits : {});

      return {
        id: a.id,
        type: 'actor' as const,
        label: perceivedLabel,
        name: perceivedName,
        aliases: perceivedAliases,
        roleOrStatus: perceivedRole,
        locationId: a.current_location_id,
        currentHolderId: null,
        traitsOrDescription: perceivedTraits,
        currentState: {
          fatigue: a.current_state?.fatigue,
          emotion: isCanonicalKnown ? a.current_state?.emotion : 'observant',
        },
      };
    }),
    ...presentObjects.map((o) => {
      const holder = project.actors.find((a) => a.id === o.current_holder_id);
      const isCanonicalKnown = knownEntitiesSet.has(o.id);
      const perception = actorKnowledge.known_entity_perceptions?.[o.id];

      const perceivedLabel =
        perception?.perceived_label ||
        (isCanonicalKnown
          ? (o.identity.working_label || o.identity.name || o.id)
          : 'unidentified object');

      const perceivedName =
        perception?.perceived_name !== undefined
          ? perception.perceived_name
          : (isCanonicalKnown ? o.identity.name : null);

      const perceivedAliases = isCanonicalKnown ? (o.identity.aliases || []) : [];

      let holderLabel = 'unheld';
      if (holder) {
        if (holder.id === povActor.id) {
          holderLabel = holder.identity.name || holder.identity.working_label;
        } else {
          const hPerception = actorKnowledge.known_entity_perceptions?.[holder.id];
          const isHolderKnown = knownEntitiesSet.has(holder.id) || (hPerception?.perceived_name !== undefined && hPerception?.perceived_name !== null);
          holderLabel =
            hPerception?.perceived_label ||
            (isHolderKnown
              ? (holder.identity.name || holder.identity.working_label)
              : 'unidentified person');
        }
      }

      return {
        id: o.id,
        type: 'object' as const,
        label: perceivedLabel,
        name: perceivedName,
        aliases: perceivedAliases,
        roleOrStatus: o.status,
        locationId: o.current_location_id,
        currentHolderId: o.current_holder_id,
        traitsOrDescription: {
          salience: o.salience,
          holder: holderLabel,
        },
        currentState: { status: o.status },
      };
    }),
  ];

  // 6. Relevant Possessions (Epistemically filtered)
  const relevantPossessions = presentObjects.map((o) => {
    const holder = project.actors.find((a) => a.id === o.current_holder_id);
    const oPerception = actorKnowledge.known_entity_perceptions?.[o.id];
    const isObjectKnown = knownEntitiesSet.has(o.id);
    const objectLabel =
      oPerception?.perceived_label ||
      (isObjectKnown ? (o.identity.working_label || o.identity.name) : 'unidentified object');

    let holderDisplayName: string | null = null;
    if (holder) {
      if (holder.id === povActor.id) {
        holderDisplayName = holder.identity.name || holder.identity.working_label;
      } else {
        const hPerception = actorKnowledge.known_entity_perceptions?.[holder.id];
        const isHolderKnown = knownEntitiesSet.has(holder.id) || (hPerception?.perceived_name !== undefined && hPerception?.perceived_name !== null);
        holderDisplayName =
          hPerception?.perceived_label ||
          (isHolderKnown
            ? (holder.identity.name || holder.identity.working_label)
            : 'unidentified person');
      }
    }

    return {
      id: o.id,
      label: objectLabel,
      holderId: o.current_holder_id,
      holderName: holderDisplayName,
    };
  });

  // 7. Relevant Open Threads (Epistemically filtered: DEFAULT-DENY)
  // An open thread enters GenerationContext ONLY IF explicitly authorized via:
  // - thread.visible_to_actor_ids containing povActor.id, OR
  // - actorKnowledge.known_threads containing thread.id.
  // No implicit or default visibility.
  const relevantOpenThreads = project.threads
    .filter((t) => {
      // Must be open
      if (t.status !== 'open') return false;
      // Author-only threads are strictly excluded
      if (t.author_only === true) return false;

      // Check explicit authorization
      const isVisibleInThreadList = Array.isArray(t.visible_to_actor_ids) && t.visible_to_actor_ids.includes(povActor.id);
      const isKnownInActorKnowledge = Array.isArray(actorKnowledge.known_threads) && actorKnowledge.known_threads.includes(t.id);

      return isVisibleInThreadList || isKnownInActorKnowledge;
    })
    .map((t) => ({
      id: t.id,
      label: t.label,
      importance: t.importance,
      resolution_allowed: t.resolution_allowed,
    }));

  // 8. REAL REVEAL LOCKBOX:
  // The generator must NEVER receive the protected truth of a LOCKED reveal.
  // A locked reveal may optionally contain separate pre-authored permitted foreshadowing cues.
  // The generation context may receive permitted_cues strings only.
  // It must NOT receive fact_id, fact statements, or protected reveal text!
  const permittedForeshadowingCues: string[] = [];

  for (const r of project.reveals) {
    if (r.status === 'locked' || r.status === 'foreshadowed') {
      // Include ONLY allowed before unlock cues (sensory / atmosphere / hints)
      if (Array.isArray(r.allowed_before_unlock)) {
        for (const cue of r.allowed_before_unlock) {
          if (cue && typeof cue === 'string' && cue.trim().length > 0) {
            // Filter out generic tags and pass only tangible foreshadowing cues
            if (cue !== 'foreshadow' && cue !== 'ambiguous_sensory') {
              permittedForeshadowingCues.push(cue);
            }
          }
        }
      }
    }
  }

  // 9. POV-Authorized Continuity Prose
  const recentProse = compilePovAuthorizedRecentProse(
    project,
    povActor.id,
    actorKnowledge,
    recentBeatCount
  );

  // 10. Progressive Memory Codex Synthesis (Epistemically bounded)
  const fullCodex = synthesizeCodex(project);
  const accumulatedCodexEntities = fullCodex
    .filter((ent) => {
      // Include if present at current location, or known to POV actor
      if (ent.current_location_id === currentPosition.location_id) return true;
      if (knownEntitiesSet.has(ent.id)) return true;
      if (ent.id === povActor.id) return true;
      return false;
    })
    .map((ent) => {
      const isCanonicalKnown = knownEntitiesSet.has(ent.id) || ent.id === povActor.id;
      const perception = actorKnowledge.known_entity_perceptions?.[ent.id];
      const fallbackLabel = ent.entity_type === 'actor' ? 'unidentified person' : (ent.entity_type === 'object' ? 'unidentified object' : 'unidentified entity');
      const perceivedLabel =
        perception?.perceived_label ||
        (isCanonicalKnown
          ? (ent.canonical_label || ent.working_label)
          : fallbackLabel);

      // Filter claims to ensure no secret canonical names or working labels leak to unauthorized POV
      const supportedClaims = (ent.claims || [])
        .filter((c) => c.status === 'supported')
        .map((c) => {
          let text = c.claim;
          if (!isCanonicalKnown) {
            if (ent.canonical_label && text.includes(ent.canonical_label)) {
              text = text.replace(new RegExp(ent.canonical_label, 'g'), perceivedLabel);
            }
            if (ent.working_label && text.includes(ent.working_label)) {
              text = text.replace(new RegExp(ent.working_label, 'g'), perceivedLabel);
            }
          }
          return text;
        });

      const contradictedClaims = (ent.claims || [])
        .filter((c) => c.status === 'contradicted')
        .map((c) => {
          let text = `${c.claim} (${c.contradiction_notes || 'conflicting observations'})`;
          if (!isCanonicalKnown) {
            if (ent.canonical_label && text.includes(ent.canonical_label)) {
              text = text.replace(new RegExp(ent.canonical_label, 'g'), perceivedLabel);
            }
            if (ent.working_label && text.includes(ent.working_label)) {
              text = text.replace(new RegExp(ent.working_label, 'g'), perceivedLabel);
            }
          }
          return text;
        });

      const rels = (ent.relationships || [])
        .map((r) => `${r.type} -> ${r.target_id}`);

      return {
        id: ent.id,
        label: perceivedLabel,
        type: ent.entity_type,
        classification_confidence: ent.classification_confidence,
        reliability: ent.reliability,
        salience: ent.salience,
        distinct_evidence_count: ent.distinct_evidence_count,
        current_holder_id: ent.current_holder_id,
        current_location_id: ent.current_location_id,
        supported_claims: supportedClaims,
        contradicted_claims: contradictedClaims,
        relationships: rels,
      };
    });

  // 11. Continuity Constraints (Preventing False Holdings & Spatial Violations)
  const continuityConstraints: string[] = [];
  for (const obj of presentObjects) {
    const objLabel = obj.identity.working_label || obj.identity.name || obj.id;
    if (!obj.current_holder_id) {
      continuityConstraints.push(
        `[INVENTORY CONTINUITY] "${objLabel}" (${obj.id}) is resting in the scene (current_holder_id: null). It is NOT held by ${povActor.identity.name || 'POV Actor'}. Do NOT place it in hands or inventory unless an explicit pickup beat occurs.`
      );
    } else if (obj.current_holder_id !== povActor.id) {
      const holder = project.actors.find((a) => a.id === obj.current_holder_id);
      const hPerception = holder ? actorKnowledge.known_entity_perceptions?.[holder.id] : undefined;
      const isHolderKnown = holder ? (knownEntitiesSet.has(holder.id) || (hPerception?.perceived_name !== undefined && hPerception?.perceived_name !== null)) : false;
      const holderLabel = hPerception?.perceived_label || (isHolderKnown && holder ? (holder.identity.name || holder.identity.working_label) : 'an unidentified person');

      continuityConstraints.push(
        `[INVENTORY CONTINUITY] "${objLabel}" (${obj.id}) is carried by ${holderLabel}. It is NOT available in ${povActor.identity.name || 'POV Actor'}'s inventory.`
      );
    }
  }

  return {
    operatingMode: operation,
    narrativeDistance,
    storyPosition: currentPosition,
    activePovActor: {
      id: povActor.id,
      identity: povActor.identity,
      roles: povActor.roles,
      traits: povActor.traits,
      current_state: povActor.current_state,
      active_goals: povActor.active_goals,
      current_location_id: povActor.current_location_id,
      possessions: povActor.possessions,
    },
    knownFacts,
    sincereBeliefs,
    presentEntities,
    currentLocation,
    relevantPossessions,
    relevantOpenThreads,
    permittedForeshadowingCues,
    recentProse,
    accumulatedCodexEntities,
    continuityConstraints,
    rewriteContract: operation === 'TRANSFORMATION' ? rewriteContract : null,
  };
}

/**
 * Compile the rendering-only evidence Stage 2 needs from already-authorized
 * generation context. This boundary must never regain access to StoryProject.
 */
export function compileStage2RenderingEnvelope(
  generationContext: GenerationContext,
  approvedPlan: BeatPlanStage1
): Stage2RenderingEnvelope {
  const approvedEntityIds = new Set([
    generationContext.activePovActor.id,
    approvedPlan.primary_actor_id,
    ...(approvedPlan.permitted_entities_involved || []),
  ]);

  const involvedEntities = generationContext.presentEntities
    .filter((entity) => approvedEntityIds.has(entity.id))
    .map((entity) => ({
      id: entity.id,
      type: entity.type,
      displayName: entity.label,
    }));

  const relevantPossessions = generationContext.relevantPossessions
    .filter((possession) => approvedEntityIds.has(possession.id))
    .map((possession) => {
      const holderIsApproved = possession.holderId !== null
        && approvedEntityIds.has(possession.holderId);
      return {
        id: possession.id,
        displayName: possession.label,
        holderId: holderIsApproved ? possession.holderId : null,
        holderDisplayName: holderIsApproved ? possession.holderName : null,
        holderStatus: possession.holderId === null
          ? 'absent' as const
          : holderIsApproved ? 'approved' as const : 'outside_approved_scope' as const,
      };
    });

  const codexEntities = (generationContext.accumulatedCodexEntities || [])
    .filter((entity) => approvedEntityIds.has(entity.id))
    .map((entity) => {
      const holderIsApproved = entity.current_holder_id !== null
        && approvedEntityIds.has(entity.current_holder_id);
      const allowedLocationIds = new Set([
        ...approvedEntityIds,
        ...(generationContext.currentLocation ? [generationContext.currentLocation.id] : []),
      ]);
      const locationIsApproved = entity.current_location_id !== null
        && allowedLocationIds.has(entity.current_location_id);

      return {
        id: entity.id,
        displayName: entity.label,
        type: entity.type,
        classificationConfidence: entity.classification_confidence,
        reliability: entity.reliability,
        currentHolderId: holderIsApproved ? entity.current_holder_id : null,
        currentHolderStatus: entity.current_holder_id === null
          ? 'absent' as const
          : holderIsApproved ? 'approved' as const : 'outside_approved_scope' as const,
        currentLocationId: locationIsApproved ? entity.current_location_id : null,
        currentLocationStatus: entity.current_location_id === null
          ? 'absent' as const
          : locationIsApproved ? 'approved' as const : 'outside_approved_scope' as const,
        relationships: entity.relationships.filter((relationship) => {
          const [, targetId] = relationship.split(' -> ');
          return Boolean(targetId && approvedEntityIds.has(targetId));
        }),
      };
    });

  const continuityConstraints = relevantPossessions.map((possession) => ({
    kind: 'inventory' as const,
    entityId: possession.id,
    entityDisplayName: possession.displayName,
    holderId: possession.holderId,
    holderDisplayName: possession.holderDisplayName,
    holderStatus: possession.holderStatus,
  }));

  return {
    operatingMode: generationContext.operatingMode,
    pov: {
      id: generationContext.activePovActor.id,
      displayName: generationContext.activePovActor.identity.name
        || generationContext.activePovActor.identity.working_label
        || generationContext.activePovActor.id,
      traits: { ...generationContext.activePovActor.traits },
      // `{...undefined}` silently evaluates to `{}` in JS, which would turn
      // "unestablished" into an empty-but-present object -- indistinguishable
      // from "established, with no fields" rather than "not established at
      // all". Preserve absence explicitly instead.
      currentState: generationContext.activePovActor.current_state
        ? { ...generationContext.activePovActor.current_state }
        : undefined,
    },
    currentLocation: generationContext.currentLocation
      ? {
          id: generationContext.currentLocation.id,
          displayName: generationContext.currentLocation.name
            || generationContext.currentLocation.working_label,
          description: generationContext.currentLocation.description_summary,
        }
      : null,
    involvedEntities,
    relevantPossessions,
    knownFacts: generationContext.knownFacts.map((fact) => ({
      id: fact.id,
      statement: fact.statement,
      status: fact.status,
    })),
    sincereBeliefs: [...generationContext.sincereBeliefs],
    recentProse: generationContext.recentProse,
    codexEntities,
    continuityConstraints,
    rewriteContract: generationContext.rewriteContract
      ? {
          presetName: generationContext.rewriteContract.presetName,
          modify: [...generationContext.rewriteContract.modify],
          preserve: [...generationContext.rewriteContract.preserve],
          forbid: [...generationContext.rewriteContract.forbid],
        }
      : null,
    permittedForeshadowingCues: [...generationContext.permittedForeshadowingCues],
  };
}

/**
 * Compile Validation Context for Candidate Validator
 *
 * The Candidate Validator runs after Stage 2 prose rendering.
 * Unlike the Generator, the Validator is authorized to inspect governing state
 * (forbidden knowledge, locked reveals, displaced entities, world truth)
 * strictly to detect violations and contradictions.
 */
export function compileValidationContext(
  project: StoryProject,
  povActorId: string,
  narrativeDistance: NarrativeDistance,
  rewriteContract?: RewriteContract | null
): ValidationContext {
  const povActor = project.actors.find((a) => a.id === povActorId) || project.actors[0];
  const povActorKnowledge = project.knowledge.actor_knowledge[povActor?.id || ''] || {
    known_facts: [],
    beliefs: [],
    forbidden_knowledge: [],
  };

  const forbiddenFactIdSet = new Set(povActorKnowledge.forbidden_knowledge || []);
  const forbiddenFacts = project.facts
    .filter((f) => forbiddenFactIdSet.has(f.id))
    .map((f) => ({ id: f.id, statement: f.statement }));

  const lockedReveals = project.reveals
    .filter((r) => r.status === 'locked')
    .map((r) => {
      const fact = project.facts.find((f) => f.id === r.fact_id);
      return {
        id: r.id,
        factStatement: fact?.statement,
        allowedBeforeUnlock: r.allowed_before_unlock || [],
        forbiddenBeforeUnlock: r.forbidden_before_unlock || [],
        status: r.status,
      };
    });

  const worldTruthSet = new Set(project.knowledge.world_truth || []);
  const worldTruthFacts = project.facts
    .filter((f) => worldTruthSet.has(f.id))
    .map((f) => ({ id: f.id, statement: f.statement }));

  const presentActorIds = project.actors
    .filter((a) => a.isPresent && a.current_location_id === project.currentPosition.location_id)
    .map((a) => a.id);

  const displacedActorIds = project.actors
    .filter((a) => a.current_location_id !== project.currentPosition.location_id)
    .map((a) => a.id);

  const displacedObjectIds = project.objects
    .filter((o) => {
      if (o.current_location_id === project.currentPosition.location_id) return false;
      if (o.current_holder_id && presentActorIds.includes(o.current_holder_id)) return false;
      return true;
    })
    .map((o) => o.id);

  const objectHolders: Record<string, string | null> = {};
  for (const obj of project.objects) {
    objectHolders[obj.id] = obj.current_holder_id;
  }

  const openThreads = project.threads
    .filter((t) => t.status === 'open')
    .map((t) => ({
      id: t.id,
      label: t.label,
      resolution_allowed: t.resolution_allowed,
    }));

  return {
    povActorId: povActor?.id || 'actor_001',
    povActorLabel: povActor?.identity.name || povActor?.identity.working_label || 'POV Actor',
    forbiddenFacts,
    lockedReveals,
    worldTruthFacts,
    presentEntityIds: presentActorIds,
    displacedEntityIds: [...displacedActorIds, ...displacedObjectIds],
    objectHolders,
    openThreads,
    narrativeDistance,
    rewriteContract: rewriteContract || null,
  };
}
