# Onceaponatime — Storytelling Framework Proposal

## Status

Proposal only. This document defines the problem, governing principles, candidate architecture, and first proof targets. It does **not** prescribe a final implementation and it does **not** contain story-specific canon, character names, locations, lore, or identities.

---

## 1. Core Idea

Modern general-purpose language models already possess substantial storytelling ability. The larger problem is that an ungoverned model is usually asked to perform too many narrative responsibilities at once:

- remember the story,
- understand character identity,
- track who knows what,
- preserve continuity,
- control pacing,
- decide what happens next,
- determine what may be revealed,
- maintain point of view,
- rewrite existing prose without altering facts,
- and generate polished language.

The result is inconsistent behavior. A model may write excellent prose while simultaneously revealing information too early, changing an established fact, allowing a character to know something they should not know, skipping several narrative beats, inventing unnecessary characters, or treating a request for a small continuation as permission to finish an entire arc.

Onceaponatime proposes a **model-agnostic storytelling framework** around the language model.

The model provides generative intelligence.

The framework provides narrative organization, state, boundaries, context, operating modes, and validation.

The framework should make it possible for different capable models to occupy the same storytelling environment without requiring the story architecture to be redesigned for each model.

Conceptually:

```text
MODEL CAPABILITY
      ↓
STORY FRAMEWORK
      ↓
CONSISTENT STORYTELLING BEHAVIOR
```

The framework is the durable product. The model is a replaceable intelligence provider.

---

## 2. Absolute Identity-Neutrality Rule

The framework must contain **no hard-coded story identities**.

No framework component should know or care what human-facing name, title, alias, role label, or temporary description a project assigns to an entity.

No framework component should be written specifically for one novel, game, screenplay, campaign, genre, or fictional universe.

Story identities belong entirely to loaded project data.

### 2.1 Stable Internal Identity

A character should have a stable neutral identifier such as:

```text
actor_001
actor_002
actor_003
```

A location may use:

```text
location_001
location_002
```

Other examples:

```text
object_001
faction_001
event_001
fact_001
thread_001
reveal_001
scene_001
```

These identifiers are framework-facing identities.

Human-facing names and working labels are attributes attached to those identities.

A project may begin with only temporary labels:

```json
{
  "id": "actor_001",
  "identity": {
    "name": null,
    "working_label": "actor_a",
    "aliases": []
  }
}
```

Later the project may fill the character sheet with a human-facing name without changing the internal identity:

```json
{
  "id": "actor_001",
  "identity": {
    "name": "<project_supplied_name>",
    "working_label": "actor_a",
    "aliases": []
  }
}
```

Everything already associated with `actor_001` remains attached to the same entity. Naming the character does not create a new identity and does not require rewriting existing story state.

Temporary labels may be as neutral as `actor_a`, `actor_b`, and `actor_c`. A project may also temporarily use a role-like working label such as `villain_a`, but that working label is project data, not the entity's permanent framework identity.

### 2.2 Roles Are Not Identities

Narrative roles must not be permanently encoded into stable entity IDs.

Avoid permanent internal identities such as:

```text
hero_a
villain_a
mentor_a
love_interest_a
```

A role may change while the entity remains the same.

Instead:

```json
{
  "id": "actor_003",
  "roles": {
    "story": ["antagonist"],
    "scene": ["observer"]
  }
}
```

Later the same entity may become:

```json
{
  "id": "actor_003",
  "roles": {
    "story": ["ally"],
    "scene": ["participant"]
  }
}
```

`actor_003` remains `actor_003` throughout.

Identity and narrative function are separate concerns.

---

## 3. Author Language vs. Framework Language

The author should be able to speak naturally using whatever names, labels, aliases, or descriptions exist in the loaded project.

The framework resolves those references into stable entities before operating on story state.

Conceptually:

```text
PROJECT LANGUAGE
      ↓
ENTITY RESOLUTION
      ↓
actor_001 / actor_002 / object_004
      ↓
STORY STATE
```

A resolved event may look like:

```json
{
  "actor": "actor_001",
  "action": "give",
  "object": "object_004",
  "recipient": "actor_002"
}
```

The author should never be required to write `actor_001` in normal creative work unless they explicitly want to inspect or edit framework state.

This allows the human-facing story to remain expressive while the underlying state remains precise.

---

## 4. Primary Operating Families

The framework should initially distinguish at least four fundamentally different operations.

### 4.1 Generation

Create new material where no source prose must be preserved.

Examples:

- brainstorm possibilities,
- propose a scene,
- create dialogue possibilities,
- invent an unnamed supporting character,
- suggest complications.

Generation does not automatically become story truth.

### 4.2 Continuation

Advance existing narrative material.

The key question is:

> What happens next, and how far should the story advance?

Continuation must understand narrative distance. A request for the next beat must not become permission to complete a scene, chapter, or arc.

### 4.3 Transformation / Rewrite

Modify existing prose while preserving explicitly protected information.

The key question is:

> What may change, and what must remain invariant?

A rewrite should be governed by a transformation contract rather than by a vague instruction alone.

### 4.4 Analysis

Understand material without modifying story state.

Examples:

- identify themes,
- analyze pacing,
- inspect character consistency,
- locate contradictions,
- explain symbolism,
- critique dialogue,
- identify unresolved threads.

Analysis must not silently change canon or narrative state.

---

## 5. Narrative Distance

One common failure of general chat models is inappropriate narrative scale.

The framework should define explicit continuation distances such as:

```text
FRAGMENT   — a sensory/action fragment
BEAT       — one meaningful action/reaction change
EXCHANGE   — a short conversational exchange
SEQUENCE   — several connected beats
SCENE      — a complete scene
CHAPTER    — chapter-level continuation
ARC        — high-level planning only unless explicitly requested
```

When the author's instruction is ambiguous, the framework should prefer the smallest useful continuation rather than the largest possible completion.

For example:

```text
Author: "What happens next?"
Default interpretation: NEXT_BEAT
```

The framework should not treat every prompt as a request to resolve the current conflict.

---

## 6. Story State

The language model should not be the sole storage mechanism for story continuity.

The framework should maintain persistent machine-readable state outside the model's transient context.

A minimal story position might look like:

```json
{
  "position": {
    "book": null,
    "act": "act_001",
    "chapter": "chapter_003",
    "scene": "scene_002",
    "beat": "beat_004"
  },
  "pov_actor_id": "actor_001",
  "location_id": "location_002",
  "characters_present": [
    "actor_001",
    "actor_002"
  ],
  "active_threads": [
    "thread_003",
    "thread_008"
  ],
  "scene_status": "in_progress"
}
```

The exact schema is not yet locked. The important principle is that story position and continuity are explicit state rather than something the model must reconstruct from prose every time.

---

## 7. Character State

The framework should distinguish permanent or slowly changing character definition from immediate character condition.

Conceptually:

```text
WHO THIS ACTOR IS
        ≠
WHAT THIS ACTOR IS EXPERIENCING RIGHT NOW
```

Example:

```json
{
  "id": "actor_001",
  "traits": {
    "protective": 0.8,
    "trusting": 0.3
  },
  "current_state": {
    "fatigue": 0.6,
    "fear": 0.2,
    "certainty": 0.4
  },
  "active_goals": [
    "goal_002"
  ]
}
```

Numeric values are illustrative only. V1 should determine whether numeric, categorical, textual, or hybrid representation produces the most reliable behavior.

---

## 8. Knowledge Boundaries

Storytelling requires multiple simultaneous truths.

At minimum the framework must distinguish:

```text
WORLD TRUTH
AUTHOR KNOWLEDGE
READER KNOWLEDGE
ACTOR KNOWLEDGE
ACTOR BELIEF
```

These must not be treated as interchangeable.

An actor may sincerely believe something false.

A reader may know something the point-of-view actor does not.

The author may know information that neither the reader nor any current actor may access yet.

A model that receives all information indiscriminately can leak privileged knowledge into character behavior. The framework should therefore assemble context according to current authority and perspective.

Example:

```json
{
  "actor_id": "actor_002",
  "known_facts": [
    "fact_001",
    "fact_007"
  ],
  "beliefs": [
    "belief_004"
  ],
  "forbidden_knowledge": [
    "fact_011"
  ]
}
```

---

## 9. Reveal Control

Stories are partly systems for controlling information release.

A reveal should be able to exist independently from the prose that eventually delivers it.

Example concept:

```json
{
  "id": "reveal_001",
  "status": "locked",
  "fact_id": "fact_011",
  "allowed_before_unlock": [
    "foreshadow",
    "ambiguous_reference"
  ],
  "forbidden_before_unlock": [
    "direct_explanation",
    "narrator_confirmation",
    "actor_realization"
  ]
}
```

The framework should help a model foreshadow a truth without accidentally disclosing it.

---

## 10. Threads and Unresolved Narrative Work

The framework should maintain open narrative threads separately from prose.

Example:

```json
{
  "id": "thread_004",
  "status": "open",
  "introduced_in": "scene_002",
  "importance": "major",
  "resolution_allowed": false
}
```

Continuation logic can then advance, reference, complicate, or ignore a thread without automatically resolving it.

This is especially important for long-form fiction where unresolved information may remain active across many chapters.

---

## 11. Rewrite Contracts

Rewriting should be treated as a constrained transformation operation.

Example author request:

> Make this passage darker and more suspenseful, but do not change what happens.

The framework should derive a contract similar to:

```text
MODE
rewrite

MODIFY
- atmosphere
- sensory detail
- tension
- sentence rhythm

PRESERVE
- events
- event order
- actors present
- location
- outcome
- established facts
- dialogue intent

FORBID
- new major events
- new actors
- new lore
- changed outcome
- changed knowledge state
```

Different rewrite operations should have different default invariants.

Potential operations include:

```text
REPHRASE
POLISH
EXPAND
CONDENSE
INCREASE_TENSION
DECREASE_TENSION
MORE_DIALOGUE
LESS_DIALOGUE
MORE_DESCRIPTION
LESS_DESCRIPTION
SLOW_PACING
QUICKEN_PACING
CHANGE_POV
CHANGE_TENSE
STRENGTHEN_VOICE
REMOVE_REPETITION
```

These are candidate operation types, not a locked API.

The important principle is that `POLISH`, `EXPAND`, and `CHANGE_POV` should not all receive the same permissions.

---

## 12. Separate Narrative Planning from Prose Generation

The framework should investigate separating:

```text
WHAT SHOULD HAPPEN?
```

from:

```text
HOW SHOULD IT BE WRITTEN?
```

A continuation may first produce a proposed beat:

```json
{
  "beat_type": "discovery",
  "actor_id": "actor_001",
  "action": "notices evidence of recent disturbance",
  "threads_advanced": [
    "thread_004"
  ],
  "threads_resolved": [],
  "reveals": []
}
```

Only after the beat is accepted as a valid narrative move would a prose-generation stage render it in the requested voice and style.

Whether this two-stage approach is necessary for every operation should be determined experimentally. The framework should not add complexity where a simpler model instruction is already reliable.

---

## 13. Context Assembly

The model should not automatically receive every stored fact in the project.

A context assembler should select information relevant to the current operation.

Conceptually:

```text
AUTHOR REQUEST
      ↓
OPERATION CLASSIFICATION
      ↓
ENTITY RESOLUTION
      ↓
RELEVANT STORY STATE
      ↓
RELEVANT ACTOR STATE
      ↓
ALLOWED KNOWLEDGE
      ↓
ACTIVE THREADS / REVEALS
      ↓
STYLE / TRANSFORMATION CONTRACT
      ↓
MODEL
```

This should reduce context pollution while making important constraints more visible to the model.

---

## 14. Validation

Generated prose should not automatically become accepted story state.

The framework should be capable of checking candidate output for violations such as:

- actor knowledge leakage,
- impossible location changes,
- reappearance of unavailable objects,
- unauthorized new entities,
- changed established facts,
- premature thread resolution,
- forbidden reveals,
- point-of-view violations,
- character behavior outside allowed bounds,
- chronology errors,
- continuation beyond the requested narrative distance,
- rewrite operations altering protected information.

Conceptually:

```text
MODEL OUTPUT
     ↓
CANDIDATE
     ↓
VALIDATION
  ↙       ↘
PASS      FAIL
 ↓          ↓
AUTHOR    REVISION /
REVIEW    REJECTION
```

The validator is not intended to judge whether prose is artistically beautiful. It protects structural and narrative contracts that can be expressed as framework state.

---

## 15. Proposal Is Not Truth

A foundational rule should be:

```text
GENERATED MATERIAL ≠ ACCEPTED STORY STATE
```

The model proposes.

The framework evaluates structural constraints.

The author remains the final authority over acceptance unless an explicitly configured autonomous workflow says otherwise.

This allows brainstorming, alternate versions, rewrites, and experimental branches without contaminating the accepted story.

---

## 16. Revision, Undo, and Branching

Story operations should eventually support deterministic revision history.

A generation or accepted rewrite may produce a receipt describing which narrative state changed.

Conceptually:

```text
operation_014
- changed scene_004
- changed actor_001.current_state
- advanced thread_003
- added event_028
```

Undo should restore previous accepted state rather than asking the model to reconstruct an earlier version from memory.

A `WHAT_IF` or experimental operation should be able to create a temporary branch without changing the main accepted continuity.

---

## 17. Model-Agnostic Adapter

The storytelling framework should not depend permanently on one model provider.

Conceptually:

```text
STORY FRAMEWORK
      ↓
MODEL ADAPTER
      ↓
AVAILABLE LANGUAGE MODEL
```

The adapter should normalize, where practical:

- message/context packaging,
- generation settings,
- response extraction,
- structured-output requests,
- provider-specific token/context constraints,
- failure reporting.

A model may still perform better or worse at a given operation. The framework should make those differences measurable rather than hiding them.

---

## 18. Behavioral Reference: Perchance

Two existing Perchance tools are useful behavioral benchmarks:

- https://perchance.org/story-ai
- https://perchance.org/ai-rewriter

They are references because they demonstrate that relatively focused storytelling and rewriting experiences can produce behavior that is often more useful than generic chatbot continuation.

They are **not** implementation specifications and should not be copied verbatim.

The research question is:

> What surrounding guidance or interaction pattern causes these tools to perform well, and which failure modes remain unsolved?

The project should compare observed behavior rather than assume Perchance's internal implementation.

---

## 19. Benchmark Method

Before building a large architecture, establish behavioral tests.

### Test 1 — Narrative Distance

Give an unfinished situation and request what happens next.

Measure whether the system advances one appropriate beat or prematurely resolves the larger conflict.

### Test 2 — Character Consistency

Establish a strong actor trait and present a situation where violating it would be narratively convenient.

Measure whether characterization remains coherent.

### Test 3 — Knowledge Separation

Give `actor_001` a fact that `actor_002` does not know.

Continue repeatedly and test whether `actor_002` improperly gains that knowledge.

### Test 4 — False Belief

Set world truth to one state while `actor_001` sincerely believes another.

Measure whether prose can preserve the false belief without changing world truth.

### Test 5 — Delayed Reveal

Lock a major fact and allow only foreshadowing.

Measure whether the system leaks the answer.

### Test 6 — Object Continuity

Remove `object_001` from an actor's possession.

Continue across multiple scenes and measure whether it reappears without an event returning it.

### Test 7 — Location Continuity

Separate actors into different locations.

Measure whether they remain spatially consistent.

### Test 8 — Role Change

Change `actor_003` from antagonist to ally.

Measure whether identity remains stable while role changes.

### Test 9 — Unnamed Actor

Create `actor_004` without a name, establish state and relationships, then name the actor later.

Measure whether all prior state remains attached correctly.

### Test 10 — Rewrite Invariants

Provide a simple event sequence and request a tonal rewrite.

Measure whether expression changes while events, order, participants, and outcome remain intact.

---

## 20. Engineering Discipline: Three Levels of Responsibility

Not every storytelling problem requires a new subsystem.

Each observed behavior should be classified as one of three kinds:

### A. Model Can Handle It

If a clear instruction reliably produces the desired behavior across capable models, leave the task primarily with the model.

Example:

```text
Write in close third person.
```

### B. Framework Must Help

If the model can perform the task but needs reliable context, the framework should retrieve and organize that context.

Example:

```text
Remember that actor_001 received object_004 in scene_002.
```

### C. Framework Must Enforce It

If a violation would damage continuity or author intent, the framework should validate or reject it rather than relying entirely on model obedience.

Example:

```text
actor_002 may not reveal fact_011 because actor_002 does not know fact_011.
```

This discipline is intended to prevent unnecessary overengineering.

---

## 21. Candidate V1 Proof

V1 should be deliberately small.

The first proof should demonstrate that a generic model placed inside the framework behaves more reliably than the same model used directly.

Minimum candidate capabilities:

1. Stable neutral entity identities.
2. Exact current story position.
3. Actor-specific knowledge boundaries.
4. Locked/unlocked reveal state.
5. Explicit narrative-distance control.
6. Continuation mode.
7. Rewrite mode with preservation constraints.
8. Candidate-output validation.
9. Accept/reject without automatic canonization.
10. Deterministic state update after acceptance.

A minimal conceptual file/state layout might eventually resemble:

```text
project/
├── entities/
│   ├── actors/
│   ├── locations/
│   ├── objects/
│   └── factions/
├── state/
│   ├── story_state.json
│   ├── knowledge_state.json
│   ├── thread_state.json
│   └── reveal_state.json
├── operations/
│   ├── continuation
│   └── rewrite
└── history/
```

This structure is illustrative, not final.

---

## 22. V1 Success Condition

Use the same source material and same underlying model in two conditions:

```text
A. Naked model
B. Model through Onceaponatime framework
```

The framework version should measurably improve:

- continuity,
- knowledge discipline,
- reveal discipline,
- character consistency,
- requested narrative distance,
- rewrite preservation,
- recoverability of accepted state.

The objective is not to prove that one language model is the best storyteller.

The objective is to prove that a storytelling framework can make capable models behave more consistently as storytellers.

---

## 23. Non-Goals for Initial Proposal

This proposal does not yet attempt to define:

- a final UI,
- a final programming language,
- a final storage engine,
- a single required language model,
- autonomous publication,
- a genre-specific ruleset,
- story-specific canon,
- game-engine integration,
- image generation,
- voice generation,
- final schemas for every narrative concept.

Those decisions should follow behavioral testing rather than precede it.

---

## 24. Governing Principle

Onceaponatime should remain a framework for storytelling rather than a framework for one story.

The engine should understand relationships such as:

```text
actor_001 knows fact_004
actor_002 possesses object_006
actor_003 is currently an antagonist
scene_008 occurs at location_002
reveal_003 remains locked
thread_005 remains unresolved
```

It should not require any particular character name, fictional world, genre, plot, or existing project to make those relationships meaningful.

**Names are project data. Working labels are project data. Roles are mutable state. Stable identities are framework references. Storytelling behavior is framework responsibility.**
