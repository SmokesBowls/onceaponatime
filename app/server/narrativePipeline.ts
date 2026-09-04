import {
  GenerationContext,
  Stage2RenderingEnvelope,
  ValidationContext,
  BeatPlanStage1,
  ValidationReport,
  ValidationDiagnostic,
  OperatingMode,
  NarrativeDistance,
  MentionRecord,
  Stage1PlanningArtifact,
  Stage2RenderingArtifact,
  createInferenceArtifact,
} from '../src/types';
import {
  getModelProvider,
  getStage1ModelProvider,
  getStage2ModelProvider,
  ModelProvider,
  ReceiptBearingModelProvider,
} from './modelProvider';
import { detectEntityInteractions } from '../src/lib/codexEngine';

/**
 * STAGE 1: Beat Planner
 *
 * Input:
 * - authorized GenerationContext (strictly filtered by Context Compiler)
 * - authorPrompt
 * - operatingMode
 * - narrativeDistance
 *
 * Output: Structured JSON plan ONLY. Stage 1 MUST NOT produce prose.
 */
export async function planNarrativeBeat(
  generationContext: GenerationContext,
  authorPrompt: string,
  provider: ReceiptBearingModelProvider = getStage1ModelProvider()
): Promise<Stage1PlanningArtifact> {
  const povActor = generationContext.activePovActor;
  const distance = generationContext.narrativeDistance;
  const op = generationContext.operatingMode;

  const systemPrompt = `You are the Stage 1 Beat Planner of Onceaponatime, a model-agnostic narrative mechanics engine.
Your sole responsibility is to produce a structured, bounded narrative beat plan.

GOVERNING CONSTRAINTS:
1. STRICT DISTANCE BUDGET: The plan must advance narrative time ONLY by the requested distance budget (${distance}).
   - FRAGMENT: A single sensory or micro-action observation.
   - BEAT: Exactly ONE action/reaction pivot. Do NOT resolve the whole scene or scene conflict.
   - EXCHANGE: 2-4 lines of dialogue / immediate physical response.
   - SEQUENCE: 3-4 connected physical beats.
   - SCENE: A complete scene unit with entry, complication, and exit.
2. EPISTEMIC RIGIDITY: The POV actor (${povActor.identity.name || povActor.identity.working_label || povActor.id}) can ONLY act upon facts in knownFacts and sincereBeliefs.
3. FORESHADOWING: You may only use permitted foreshadowing cues (${JSON.stringify(generationContext.permittedForeshadowingCues)}).
4. NO PROSE: You must NOT write narrative story prose in this step. Output structured JSON only.`;

  const userPrompt = `TASK: Plan Stage 1 Beat for ${op} (Distance Budget: ${distance})

AUTHORIZED GENERATION CONTEXT:
${JSON.stringify(generationContext, null, 2)}

AUTHOR INTENT:
"${authorPrompt || 'Advance the story naturally according to the current POV and position.'}"

OUTPUT REQUIREMENTS:
Respond with valid JSON conforming to this exact schema:
{
  "beat_type": "observation" | "discovery" | "dialogue_exchange" | "obstacle" | "decision" | "action",
  "primary_actor_id": "${povActor.id}",
  "intended_action": "Concise summary of the planned beat action",
  "permitted_entities_involved": ["entity_ids involved in this beat"],
  "permitted_state_transitions": ["state changes that will occur"],
  "threads_advanced": ["thread_ids that make progress"],
  "threads_resolved": ["thread_ids resolved - ONLY if resolution is allowed"],
  "distance_budget": "${distance}",
  "plan_notes": "Rationale for respecting knowledge boundaries and distance"
}`;

  if (!provider.isAvailable()) {
    throw new Error(`Model provider "${provider.name}" is unavailable.`);
  }

  const { text, receipt } = await provider.generateText({
    operation: 'onceaponatime.stage1.plan',
    systemPrompt,
    userPrompt,
    jsonMode: true,
    temperature: 0.3,
  });

  const parsed = JSON.parse(text);
  const plan = validateAndNormalizePlan(parsed, generationContext);
  return createInferenceArtifact(plan, receipt);
}

function validateAndNormalizePlan(
  plan: any,
  ctx: GenerationContext
): BeatPlanStage1 {
  const povId = ctx.activePovActor.id;
  const distance = ctx.narrativeDistance;

  // 1. Primary Actor Check (Authorization check)
  const primaryActorId = typeof plan?.primary_actor_id === 'string' ? plan.primary_actor_id : povId;
  const presentEntityIds = new Set([povId, ...ctx.presentEntities.map((e) => e.id)]);
  const isPrimaryActorValid = presentEntityIds.has(primaryActorId);

  // 2. Permitted Entities Involved Check (Authorization check)
  const rawEntities = Array.isArray(plan?.permitted_entities_involved)
    ? plan.permitted_entities_involved
    : [povId];
  const authorizedEntityIds = new Set([
    povId,
    ...ctx.presentEntities.map((e) => e.id),
    ...ctx.relevantPossessions.map((p) => p.id),
  ]);
  const entitiesValid = rawEntities.every((id: string) => typeof id === 'string' && authorizedEntityIds.has(id));

  // 3. Threads Verification (Default-Deny check)
  const rawAdvancedThreads = Array.isArray(plan?.threads_advanced) ? plan.threads_advanced : [];
  const rawResolvedThreads = Array.isArray(plan?.threads_resolved) ? plan.threads_resolved : [];
  const authorizedThreadIds = new Set(ctx.relevantOpenThreads.map((t) => t.id));
  const resolvableThreadIds = new Set(
    ctx.relevantOpenThreads.filter((t) => t.resolution_allowed).map((t) => t.id)
  );

  const intendedAction = typeof plan?.intended_action === 'string' ? plan.intended_action : 'Advance immediate narrative beat';

  // Stage 1 structural checks filter unauthorized IDs, but Stage 1 must NOT claim full epistemic knowledge verification
  // or reveal verification (which is performed at Candidate Validation).
  const knowledgeVerified = false;
  const revealsProtected = false;

  return {
    beat_type: typeof plan?.beat_type === 'string' ? plan.beat_type : 'action',
    primary_actor_id: isPrimaryActorValid ? primaryActorId : povId,
    intended_action: intendedAction,
    permitted_entities_involved: entitiesValid ? rawEntities : [povId],
    permitted_state_transitions: Array.isArray(plan?.permitted_state_transitions)
      ? plan.permitted_state_transitions
      : [],
    knowledge_verified: knowledgeVerified,
    reveals_protected: revealsProtected,
    threads_advanced: rawAdvancedThreads.filter((tId: string) => authorizedThreadIds.has(tId)),
    threads_resolved: rawResolvedThreads.filter((tId: string) => resolvableThreadIds.has(tId)),
    distance_budget: distance,
    plan_notes: typeof plan?.plan_notes === 'string' ? plan.plan_notes : 'Validated Stage 1 Plan',
  };
}

/**
 * STAGE 2: Prose Renderer
 *
 * Input:
 * - a rendering-only envelope compiled from authorized GenerationContext
 * - the APPROVED Stage 1 Beat Plan
 * - recent authorized prose
 *
 * Output: Immutable rendering artifact containing prose and inference provenance.
 */
export async function renderNarrativeProse(
  renderingEnvelope: Stage2RenderingEnvelope,
  approvedPlan: BeatPlanStage1,
  provider: ReceiptBearingModelProvider = getStage2ModelProvider()
): Promise<Stage2RenderingArtifact> {
  const pov = renderingEnvelope.pov;
  const distance = approvedPlan.distance_budget;
  const op = renderingEnvelope.operatingMode;

  const systemPrompt = `You are the Stage 2 Prose Renderer of Onceaponatime.
Your sole responsibility is to render the approved Stage 1 Beat Plan into literary prose.

STRICT RENDERING DIRECTIVES:
1. FAITHFUL TRANSLATION: Render ONLY the intended action described in the Approved Plan: "${approvedPlan.intended_action}".
2. NO INDEPENDENT PLOT ADVANCEMENT: Do NOT invent plot twists, unapproved character actions, or resolve major conflicts not specified in the plan.
3. DISTANCE BOUNDARY (${distance}):
   - FRAGMENT: 1 sensory sentence or micro-action.
   - BEAT: 1-3 sentences focusing on one action/reaction change.
   - EXCHANGE: 2-4 lines of dialogue with gestures.
   - SEQUENCE: 1-2 rich paragraphs.
   - SCENE: A full scene passage.
4. POV RESTRICTION: Maintain close perspective of ${pov.displayName}.
5. REWRITE PRESERVATION: If rewrite contract is present, follow modify/preserve/forbid constraints strictly.
6. PHYSICAL & SPATIAL CONTINUITY: Respect all continuity constraints strictly. If an object is resting or held by another character, do NOT narrate the POV actor holding or carrying it unless an explicit pickup beat was planned.
7. ACCUMULATED CODEX & AUTHORIZED STORY REALITY: Use only the scoped identities, classifications, reliability scores, relationships, and physical-state references supplied below. Describe provisional elements with observational restraint matching their reliability.`;

  // Format rich Codex entities for prose rendering
  const codexFormatted = renderingEnvelope.codexEntities.map((ent) => {
    const rels = (ent.relationships || []).map((r) => `    - ${r}`).join('\n');
    const holder = ent.currentHolderStatus === 'approved'
      ? `held by ${ent.currentHolderId}`
      : ent.currentHolderStatus === 'absent' ? 'unheld / resting' : 'holder outside approved scope';
    const location = ent.currentLocationStatus === 'approved'
      ? ent.currentLocationId
      : ent.currentLocationStatus === 'absent' ? 'unknown' : 'outside approved scope';
    return `* [${ent.id}] "${ent.displayName}" (${ent.type}, ${ent.classificationConfidence}, ${Math.round(ent.reliability * 100)}% reliability)
  Holder: ${holder} | Location: ${location}${rels ? `\n  Relationships:\n${rels}` : ''}`;
  }).join('\n\n');

  // Format continuity constraints
  const continuityFormatted = renderingEnvelope.continuityConstraints.length > 0
    ? renderingEnvelope.continuityConstraints.map((constraint) => {
        if (constraint.holderStatus === 'approved') {
          return `- [INVENTORY CONTINUITY] "${constraint.entityDisplayName}" (${constraint.entityId}) is carried by ${constraint.holderDisplayName || constraint.holderId}.`;
        }
        if (constraint.holderStatus === 'outside_approved_scope') {
          return `- [INVENTORY CONTINUITY] "${constraint.entityDisplayName}" (${constraint.entityId}) is carried by someone outside approved scope.`;
        }
        return `- [INVENTORY CONTINUITY] "${constraint.entityDisplayName}" (${constraint.entityId}) is unheld / resting (current_holder_id: null).`;
      }).join('\n')
    : 'None (standard physical continuity applies)';

  const rewriteContractFormatted = renderingEnvelope.rewriteContract
    ? JSON.stringify(renderingEnvelope.rewriteContract, null, 2)
    : 'None';

  // Omit the POV Current State line entirely when unestablished, rather than
  // render `undefined`/an empty object as if it were an authored fact. Never
  // substitute a placeholder value here.
  const povCurrentStateLine = pov.currentState
    ? `\n- POV Current State: ${JSON.stringify(pov.currentState)}`
    : '';

  const userPrompt = `TASK: Render Prose for ${op}

APPROVED STAGE 1 PLAN:
${JSON.stringify(approvedPlan, null, 2)}

CONTINUITY & INVENTORY CONSTRAINTS:
${continuityFormatted}

ACCUMULATED STORY CODEX (AUTHORIZED NARRATIVE REALITY):
${codexFormatted || 'No accumulated codex entities in scope.'}

AUTHORIZED RENDERING EVIDENCE:
- Active POV: ${pov.displayName} (${pov.id})
- POV Traits: ${JSON.stringify(pov.traits)}${povCurrentStateLine}
- Current Location: ${renderingEnvelope.currentLocation
  ? `${renderingEnvelope.currentLocation.displayName} (${renderingEnvelope.currentLocation.id}): ${renderingEnvelope.currentLocation.description}`
  : 'Local area'}
- Involved Entities: ${renderingEnvelope.involvedEntities.map((e) => `${e.displayName} (${e.id})`).join(', ') || 'None'}
- Relevant Possessions: ${renderingEnvelope.relevantPossessions.map((p) => {
  const holder = p.holderStatus === 'approved'
    ? p.holderDisplayName || p.holderId
    : p.holderStatus === 'absent' ? 'nobody' : 'someone outside approved scope';
  return `${p.displayName} (held by ${holder})`;
}).join(', ') || 'None'}
- Known Facts: ${renderingEnvelope.knownFacts.map((f) => `"${f.statement}"`).join('; ') || 'None'}
- Sincere Beliefs: ${renderingEnvelope.sincereBeliefs.join('; ') || 'None'}
- Permitted Foreshadowing Cues: ${renderingEnvelope.permittedForeshadowingCues.join('; ') || 'None'}

REWRITE CONTRACT:
${rewriteContractFormatted}

RECENT MANUSCRIPT PROSE:
"""
${renderingEnvelope.recentProse || '(Opening of manuscript)'}
"""

OUTPUT:
Write ONLY the high-craft narrative prose adhering strictly to the plan and authorized memory.`;

  if (!provider.isAvailable()) {
    throw new Error(`Model provider "${provider.name}" is unavailable.`);
  }

  const { text, receipt } = await provider.generateText({
    operation: 'onceaponatime.stage2.render',
    systemPrompt,
    userPrompt,
    jsonMode: false,
    temperature: 0.6,
  });

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Stage 2 inference output must be a non-empty prose string.');
  }

  return createInferenceArtifact(text, receipt);
}

/**
 * CANDIDATE VALIDATOR
 *
 * Runs after Stage 2 returns prose.
 * Compares candidate prose against governing ValidationContext.
 *
 * Checks:
 * - Knowledge leakage (actor acting on forbidden knowledge)
 * - Locked reveal disclosure
 * - Spatial / entity presence continuity
 * - Possession continuity
 * - Narrative distance violations
 * - Rewrite invariant violations
 */
export async function validateCandidateProse(
  candidateProse: string,
  validationContext: ValidationContext,
  stage1Plan?: BeatPlanStage1,
  provider: ModelProvider = getModelProvider()
): Promise<ValidationReport> {
  const diagnostics: ValidationDiagnostic[] = [];
  let score = 100;
  const lowerProse = candidateProse.toLowerCase();

  // 1. Deterministic Knowledge Leakage Check
  for (const fk of validationContext.forbiddenFacts) {
    // Check for statement keywords / distinctive phrases
    const words = fk.statement.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
    let matchCount = 0;
    for (const w of words) {
      if (lowerProse.includes(w)) matchCount++;
    }
    if (words.length > 0 && matchCount >= Math.min(3, words.length)) {
      diagnostics.push({
        severity: 'FATAL',
        rule: 'KNOWLEDGE_LEAKAGE',
        message: `Candidate prose mentions or reflects forbidden fact [${fk.id}]: "${fk.statement}".`,
        remedy: 'Omit explicit revelation; restrict narration to authorized POV knowledge only.',
      });
      score -= 40;
    }
  }

  // 2. Deterministic Locked Reveal Check
  for (const lr of validationContext.lockedReveals) {
    if (lr.status === 'locked') {
      for (const forbiddenTerm of lr.forbiddenBeforeUnlock) {
        if (forbiddenTerm.length > 3 && lowerProse.includes(forbiddenTerm.toLowerCase())) {
          diagnostics.push({
            severity: 'FATAL',
            rule: 'LOCKED_REVEAL_PREMATURE_DISCLOSURE',
            message: `Candidate prose prematurely reveals locked secret [${lr.id}] via term "${forbiddenTerm}".`,
            remedy: 'Mask with ambiguous sensory foreshadowing rather than naming secret entities.',
          });
          score -= 50;
        }
      }
      if (lr.factStatement) {
        const secretWords = lr.factStatement.toLowerCase().split(/\s+/).filter((w) => w.length > 5);
        let secretMatch = 0;
        for (const sw of secretWords) {
          if (lowerProse.includes(sw)) secretMatch++;
        }
        if (secretWords.length > 0 && secretMatch >= Math.min(3, secretWords.length)) {
          diagnostics.push({
            severity: 'FATAL',
            rule: 'LOCKED_REVEAL_PREMATURE_DISCLOSURE',
            message: `Candidate prose explains protected reveal truth: "${lr.factStatement}".`,
            remedy: 'Locked reveals must remain unconfirmed until unlock conditions are fulfilled.',
          });
          score -= 50;
        }
      }
    }
  }

  // 3. Deterministic Narrative Distance Check
  const wordCount = candidateProse.split(/\s+/).filter(Boolean).length;
  if (validationContext.narrativeDistance === 'FRAGMENT' && wordCount > 40) {
    diagnostics.push({
      severity: 'WARNING',
      rule: 'DISTANCE_OVERFLOW',
      message: `Prose length (${wordCount} words) exceeds FRAGMENT budget (expected ~1-25 words).`,
      remedy: 'Trim to a single micro-sensory or reactive clause.',
    });
    score -= 15;
  } else if (validationContext.narrativeDistance === 'BEAT' && wordCount > 90) {
    diagnostics.push({
      severity: 'WARNING',
      rule: 'DISTANCE_OVERFLOW',
      message: `Prose length (${wordCount} words) exceeds single BEAT budget (expected ~20-60 words).`,
      remedy: 'Focus exclusively on the single action/reaction change.',
    });
    score -= 10;
  }

  // 4. Model-Assisted Deep Semantic Check (if model is available)
  if (provider.isAvailable()) {
    try {
      const valSystemPrompt = `You are the Candidate Validator in Onceaponatime.
Your sole job is to rigorously evaluate whether the candidate prose violates narrative constraints.

EVALUATION CHECKLIST:
1. KNOWLEDGE LEAKAGE: Did the POV actor (${validationContext.povActorLabel}) express, think, or act upon any forbidden knowledge?
2. LOCKED REVEALS: Did the prose prematurely disclose locked secrets?
3. NARRATIVE DISTANCE (${validationContext.narrativeDistance}): Did the prose overstep its boundary?
4. ENTITY & POSSESSION CONTINUITY: Did absent entities appear without entering? Did an actor use an unheld object?
5. REWRITE INVARIANTS: If rewrite contract is active, were preserved elements kept and forbidden changes avoided?

Return structured JSON with diagnostics.`;

      const valUserPrompt = `CANDIDATE PROSE TO VALIDATE:
"""
${candidateProse}
"""

GOVERNING VALIDATION CONTEXT:
${JSON.stringify(validationContext, null, 2)}

STAGE 1 PLAN:
${JSON.stringify(stage1Plan || {}, null, 2)}

OUTPUT FORMAT:
{
  "passed": boolean,
  "score": number (0-100),
  "diagnostics": [
    {
      "severity": "FATAL" | "WARNING" | "INFO",
      "rule": "string (e.g. KNOWLEDGE_LEAKAGE, DISTANCE_EXCEEDED, REVEAL_LEAK, CONTINUITY_BREACH)",
      "message": "string",
      "remedy": "string"
    }
  ],
  "notes": "string summary"
}`;

      const { text } = await provider.generateText({
        systemPrompt: valSystemPrompt,
        userPrompt: valUserPrompt,
        jsonMode: true,
        temperature: 0.1,
      });

      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.diagnostics)) {
        for (const d of parsed.diagnostics) {
          if (d && d.rule && d.message && d.severity) {
            // Avoid duplicate fatal rule reports
            if (!diagnostics.some((existing) => existing.rule === d.rule && existing.severity === d.severity)) {
              diagnostics.push(d);
              if (d.severity === 'FATAL') score -= 30;
              if (d.severity === 'WARNING') score -= 10;
            }
          }
        }
      }

      const finalScore = Math.max(0, Math.min(100, typeof parsed.score === 'number' ? Math.min(score, parsed.score) : score));
      const finalPassed = finalScore >= 70 && !diagnostics.some((d) => d.severity === 'FATAL');

      if (diagnostics.length === 0) {
        diagnostics.push({
          severity: 'INFO',
          rule: 'VALIDATION_PASSED',
          message: 'All epistemic boundaries, distance budgets, and relational invariants verified.',
        });
      }

      return {
        passed: finalPassed,
        score: finalScore,
        diagnostics,
        verified: finalPassed,
        status: finalPassed ? 'VERIFIED' : 'UNVERIFIED',
        notes: parsed.notes || (finalPassed ? 'Full model & deterministic verification completed.' : 'Verification failed: constraint violations detected.'),
      };
    } catch (err: any) {
      console.warn('[Validator] Model validation failed, returning deterministic report:', err?.message || err);
    }
  }

  // Pure Deterministic Evaluation (Offline / Incomplete Validator)
  // Deterministic validation checks knowledge leakage, locked reveal disclosure, and narrative distance,
  // but cannot check full model-assisted categories (e.g. entity continuity, possession continuity, rewrite invariants).
  // Therefore, offline validation must not claim verified: true or status: 'VERIFIED'.
  const finalScore = Math.max(0, Math.min(100, score));
  const finalPassed = finalScore >= 70 && !diagnostics.some((d) => d.severity === 'FATAL');

  if (diagnostics.length === 0) {
    diagnostics.push({
      severity: 'INFO',
      rule: 'PASSED_AVAILABLE_CHECKS',
      message: 'All available deterministic checks passed (knowledge boundaries, locked reveals, and distance limits).',
    });
  }

  return {
    passed: finalPassed,
    score: finalScore,
    diagnostics,
    verified: false, // Offline/incomplete validation must NOT overclaim full verification
    status: 'UNVERIFIED',
    notes: finalPassed
      ? 'Passed available deterministic checks (offline validation). Full verification requires model-assisted validation.'
      : 'Deterministic validation detected constraint violations.',
  };
}

/**
 * ENTITY MENTION & STATE CHANGE EXTRACTOR
 *
 * Triggered after candidate is promoted to story canon.
 *
 * Input:
 * - accepted prose
 * - sceneId, beatIndex, locationId, povActorId
 * - existing entities
 *
 * Output: Real mentions, proposed new entities with neutral persistent IDs, and state changes.
 */
export interface ExtractMentionsParams {
  prose: string;
  sceneId: string;
  beatIndex: number;
  locationId: string;
  povActorId: string;
  existingActors: Array<{ id: string; identity: { name: string | null; working_label: string; aliases: string[] } }>;
  existingObjects: Array<{ id: string; identity: { name: string | null; working_label: string; aliases: string[] }; current_holder_id: string | null }>;
  existingLocations: Array<{ id: string; identity: { name: string | null; working_label: string; aliases: string[] } }>;
}

export interface ExtractionResult {
  mentions: MentionRecord[];
  proposedNewEntities: Array<{
    id: string;
    type: 'actor' | 'object' | 'location';
    working_label: string;
    name: string | null;
    aliases: string[];
    initial_location_id?: string;
  }>;
  stateChanges: {
    location_changes: Array<{ entity_id: string; from_location_id: string; to_location_id: string }>;
    possession_changes: Array<{ object_id: string; from_actor_id: string | null; to_actor_id: string | null }>;
    actor_state_changes: Array<{ actor_id: string; fatigue_delta?: number; emotion?: string }>;
    belief_changes: Array<{ actor_id: string; new_belief: string }>;
    thread_advancements: Array<{ thread_id: string; notes: string }>;
    reveals_triggered: Array<{ reveal_id: string; new_status: 'foreshadowed' | 'unlocked' }>;
  };
}

export async function extractMentionsAndState(
  params: ExtractMentionsParams,
  provider: ModelProvider = getModelProvider()
): Promise<ExtractionResult> {
  const { prose, sceneId, beatIndex, locationId, povActorId, existingActors, existingObjects, existingLocations } = params;

  if (provider.isAvailable()) {
    try {
      const systemPrompt = `You are the Entity & State Mention Extraction Engine in Onceaponatime.
Your task is to analyze accepted narrative prose and extract:
1. Entity Mentions: Identify every actor, object, location mentioned in the text.
   - Resolve to EXISTING entity IDs whenever possible.
   - For newly introduced entities, assign a NEUTRAL persistent ID (e.g. actor_004, object_004, location_003).
2. Relationships & State Changes:
   - Identify location movements, object pickups/transfers, emotion/fatigue changes, or new beliefs.`;

      const userPrompt = `PROSE TO ANALYZE:
"""
${prose}
"""

CURRENT SCENE METADATA:
- Scene ID: ${sceneId}
- Beat Index: ${beatIndex}
- Active Location: ${locationId}
- POV Actor: ${povActorId}

EXISTING ENTITY REGISTRY:
- Actors: ${JSON.stringify(existingActors)}
- Objects: ${JSON.stringify(existingObjects)}
- Locations: ${JSON.stringify(existingLocations)}

OUTPUT SCHEMA:
{
  "mentions": [
    {
      "entity_id": "existing_id or newly proposed neutral ID",
      "passage_text": "exact phrase quoted from prose",
      "confidence": number (0.0 to 1.0),
      "evidence_notes": ["evidence explanation"],
      "extracted_relationships": [
        { "type": "located_at" | "possessed_by" | "known_by" | "used_during", "target_id": "entity_id" }
      ]
    }
  ],
  "proposedNewEntities": [
    {
      "id": "actor_xxx or object_xxx or location_xxx",
      "type": "actor" | "object" | "location",
      "working_label": "string descriptive label",
      "name": "string or null",
      "aliases": ["string"]
    }
  ],
  "stateChanges": {
    "location_changes": [
      { "entity_id": "string", "from_location_id": "string", "to_location_id": "string" }
    ],
    "possession_changes": [
      { "object_id": "string", "from_actor_id": "string or null", "to_actor_id": "string or null" }
    ],
    "actor_state_changes": [
      { "actor_id": "string", "fatigue_delta": number, "emotion": "string" }
    ],
    "belief_changes": [
      { "actor_id": "string", "new_belief": "string" }
    ],
    "thread_advancements": [],
    "reveals_triggered": []
  }
}`;

      const { text } = await provider.generateText({
        systemPrompt,
        userPrompt,
        jsonMode: true,
        temperature: 0.2,
      });

      const parsed = JSON.parse(text);
      const mentions: MentionRecord[] = (parsed.mentions || []).map((m: any, idx: number) => ({
        id: `mention_${Date.now()}_${idx}`,
        entity_id: m.entity_id || povActorId,
        passage_text: m.passage_text || prose.slice(0, 80),
        scene_id: sceneId,
        beat_index: beatIndex,
        timestamp_label: `T${beatIndex}: Beat ${beatIndex}`,
        confidence: typeof m.confidence === 'number' ? m.confidence : 0.95,
        evidence_notes: Array.isArray(m.evidence_notes) ? m.evidence_notes : ['Mention extracted from canonical prose.'],
        extracted_relationships: Array.isArray(m.extracted_relationships) ? m.extracted_relationships : [
          { type: 'located_at', target_id: locationId },
        ],
      }));

      const rawPossessionChanges = Array.isArray(parsed.stateChanges?.possession_changes)
        ? parsed.stateChanges.possession_changes
        : [];
      const povActor = existingActors.find((a) => a.id === povActorId);
      const povActorLabel = povActor ? (povActor.identity.name || povActor.identity.working_label) : undefined;
      const knownActorsList = existingActors.map((a) => ({
        id: a.id,
        name: a.identity.name,
        working_label: a.identity.working_label,
        aliases: a.identity.aliases || [],
      }));

      const verifiedPossessionChanges = rawPossessionChanges.filter((pc: any) => {
        const obj = existingObjects.find((o) => o.id === pc.object_id);
        const objLabel = obj?.identity.working_label || obj?.identity.name || pc.object_id;
        const interaction = detectEntityInteractions(prose, objLabel, povActorLabel, knownActorsList);
        return interaction.isPossession || interaction.isRelease;
      });

      return {
        mentions: mentions.length > 0 ? mentions : generateDeterministicMentions(params),
        proposedNewEntities: Array.isArray(parsed.proposedNewEntities) ? parsed.proposedNewEntities : [],
        stateChanges: {
          location_changes: Array.isArray(parsed.stateChanges?.location_changes) ? parsed.stateChanges.location_changes : [],
          possession_changes: verifiedPossessionChanges,
          actor_state_changes: Array.isArray(parsed.stateChanges?.actor_state_changes) ? parsed.stateChanges.actor_state_changes : [],
          belief_changes: Array.isArray(parsed.stateChanges?.belief_changes) ? parsed.stateChanges.belief_changes : [],
          thread_advancements: Array.isArray(parsed.stateChanges?.thread_advancements) ? parsed.stateChanges.thread_advancements : [],
          reveals_triggered: Array.isArray(parsed.stateChanges?.reveals_triggered) ? parsed.stateChanges.reveals_triggered : [],
        },
      };
    } catch (err: any) {
      console.warn('[Mention Extractor] Model extraction failed, deploying deterministic extraction:', err?.message || err);
    }
  }

  // Deterministic mention extraction fallback
  return {
    mentions: generateDeterministicMentions(params),
    proposedNewEntities: [],
    stateChanges: {
      location_changes: [],
      possession_changes: [],
      actor_state_changes: [],
      belief_changes: [],
      thread_advancements: [],
      reveals_triggered: [],
    },
  };
}

function generateDeterministicMentions(params: ExtractMentionsParams): MentionRecord[] {
  const { prose, sceneId, beatIndex, locationId, povActorId, existingActors, existingObjects } = params;
  const mentions: MentionRecord[] = [];
  const lower = prose.toLowerCase();

  // Check POV actor mention
  mentions.push({
    id: `mention_${Date.now()}_0`,
    entity_id: povActorId,
    passage_text: prose.slice(0, 100) + (prose.length > 100 ? '...' : ''),
    scene_id: sceneId,
    beat_index: beatIndex,
    timestamp_label: `T${beatIndex}: Beat ${beatIndex}`,
    confidence: 1.0,
    evidence_notes: ['POV character focal action.'],
    extracted_relationships: [{ type: 'located_at', target_id: locationId }],
  });

  // Match secondary actors
  for (const a of existingActors) {
    if (a.id === povActorId) continue;
    const nameMatch = a.identity.name && lower.includes(a.identity.name.toLowerCase());
    const labelMatch = a.identity.working_label && lower.includes(a.identity.working_label.toLowerCase());
    if (nameMatch || labelMatch) {
      mentions.push({
        id: `mention_${Date.now()}_actor_${a.id}`,
        entity_id: a.id,
        passage_text: nameMatch ? a.identity.name! : a.identity.working_label,
        scene_id: sceneId,
        beat_index: beatIndex,
        timestamp_label: `T${beatIndex}: Beat ${beatIndex}`,
        confidence: 0.95,
        evidence_notes: ['Secondary character mentioned in dialogue or scene interaction.'],
        extracted_relationships: [{ type: 'located_at', target_id: locationId }],
      });
    }
  }

  // Match objects
  for (const o of existingObjects) {
    const nameMatch = o.identity.name && lower.includes(o.identity.name.toLowerCase());
    const labelMatch = o.identity.working_label && lower.includes(o.identity.working_label.toLowerCase());
    if (nameMatch || labelMatch) {
      mentions.push({
        id: `mention_${Date.now()}_obj_${o.id}`,
        entity_id: o.id,
        passage_text: nameMatch ? o.identity.name! : o.identity.working_label,
        scene_id: sceneId,
        beat_index: beatIndex,
        timestamp_label: `T${beatIndex}: Beat ${beatIndex}`,
        confidence: 0.95,
        evidence_notes: ['Object referenced in scene prose.'],
        extracted_relationships: [
          { type: 'located_at', target_id: locationId },
          ...(o.current_holder_id ? [{ type: 'possessed_by' as const, target_id: o.current_holder_id }] : []),
        ],
      });
    }
  }

  return mentions;
}
