# Onceaponatime — Post-B4 Story Orchestration Implementation Plan

## Status

Banked architecture for **after B4**. This document does **not** expand, compete with, or block B3c/B3d, and it is not part of the B4 bootstrap-refinement slice.

It records implementation-level lessons learned by instrumenting and reading Novella AI Novel Forge's actual generator source, then translates those lessons into Onceaponatime's stricter evidence/authority model.

Novella is treated as a behavioral/reference implementation, not as an authority and not as code to copy wholesale.

---

## 1. What the Novella inspection established

The useful finding is not prose quality. The useful finding is that Novella's long-form behavior comes from an orchestration layer around a relatively thin model call.

The inspected pipeline separates:

```text
prompt/context assembly
        ↓
model call
        ↓
rolling story-state update
        ↓
periodic continuity audit
        ↓
context compaction
        ↓
persistence
        ↓
autonomous continuation loop
```

Concrete observed mechanics:

- `buildWritePrompt` / `buildTask` compile a multi-layer prompt from Bible, style profile, author world/origin, name guide, plot-design slice, story-so-far slice, story state, task text, and trailing rules.
- The Bible is favored over verbatim story history when context becomes tight: the Bible is sent in full while the story slice receives the remaining budget.
- `storySoFarText` is effectively a rolling digest plus the last few unfolded story segments (currently up to eight at the inspected call sites).
- `updateStoryState` runs after generated material and rewrites a compact forward-looking state containing current act, current arc, escalation ladder, open threads, due-for-payoff-soon, established items, secrets, and next-beat direction.
- `performAudit` periodically checks continuity, knowledge, setups, repetition, timeline, secrets, and next-thread recommendations. It does not directly rewrite prose/Bible, but some results feed later planning.
- `maybeCompact` folds older prose into a digest when the model-facing context approaches its budget; original full prose remains persisted.
- Marathon mode maintains a one-sentence beat outline, consumes it chapter by chapter, extends the outline as runway shrinks, updates story state after each chapter, compacts when necessary, and runs periodic audits.
- Persistence keeps the complete story, Bible, plot design, digest, story state, marathon plan/counters, and audit report; in-flight runtime state is transient.
- The underlying Perchance AI provider remains behind the plugin boundary. The surrounding orchestration is nevertheless visible and portable as an architectural idea.

These observations confirm that a capable long-form system does not need the model itself to be the story database.

---

## 2. What Onceaponatime should preserve from that pattern

Onceaponatime should preserve the **separation of responsibilities**, not Novella's exact implementation.

Useful portable concepts:

1. explicit model-facing context compilation;
2. persistent current narrative state outside model context;
3. forward-looking pacing/planning state;
4. periodic advisory continuity review;
5. context-budget management and compaction;
6. autonomous plan → generate → update → persist loops;
7. durable project state that survives model/provider replacement;
8. observability at every important boundary.

These should sit on top of Onceaponatime's existing deterministic evidence, explicit author authority, receipts, knowledge boundaries, temporal state, and proposal-not-truth rules.

---

## 3. What Onceaponatime should *not* copy

The reference implementation exposes several places where Onceaponatime can be stricter.

### 3.1 Do not make free-text state authoritative merely because an LLM regenerated it

A model-written summary or state block is useful working memory, but it is not evidence and must not silently replace canonical structured state.

### 3.2 Do not use one lossy digest as the only long-range memory

Older prose may leave the active context window, but its accepted evidence, entities, relationships, temporal state, knowledge state, reveals, threads, and operation receipts must remain queryable independently of a prose digest.

### 3.3 Do not let prompt order stand in for authority

Authority must be represented structurally. A later prompt block must not outrank canon merely because it appears later in the assembled string.

### 3.4 Do not allow a periodic audit to establish truth

Audit findings are proposals/review findings. They may influence planning only through an explicit, inspectable boundary and must never auto-fix canon.

### 3.5 Do not conflate creative freedom, pacing distance, and prose style

The reference tool's controls demonstrate that these concerns can bleed into one another. Onceaponatime should keep them orthogonal.

---

## 4. Proposed post-B4 orchestration components

Names below are conceptual. They are not frozen APIs.

### 4.1 `NarrativeContextCompiler`

Builds the model-facing package for one operation.

Inputs may include:

```text
AUTHOR REQUEST
OPERATION TYPE
AUTHORITY MODE
CREATIVE INITIATIVE
NARRATIVE DISTANCE
SCENE MODE
STYLE PROFILE
RELEVANT BIBLE / CODEX
CURRENT TEMPORAL STATE
ALLOWED KNOWLEDGE
LOCKED / AVAILABLE REVEALS
ACTIVE THREADS
PACING STATE
RELEVANT RECENT PROSE
RELEVANT HISTORICAL EVIDENCE
VALIDATION CONTRACT
MODEL-ADAPTER LIMITS
```

The compiler should return both the payload and a trace explaining why each block was included, excluded, or truncated.

### 4.2 `NarrativeContextSelector`

Chooses which accepted material is relevant under a token/context budget.

It must prefer **structured durable memory** over lossy prose summaries for factual continuity.

Candidate selection tiers:

```text
1. explicit author constraints for this operation
2. canonical entities/facts/state directly relevant to the operation
3. current knowledge/reveal boundaries
4. current pacing/thread obligations
5. recent accepted prose
6. relevant older evidence retrieved by entity/thread/state links
7. derived summaries/digests as compression aids
```

A derived digest is never a replacement for the evidence that produced it.

### 4.3 `PacingState` (post-B4 schema addition)

This is the already-banked structured pacing-state idea made concrete.

It describes dramatic progression, not world truth.

Candidate fields:

```text
current_act
current_arc
arc_position
escalation_state
active_plot_obligations
open_threads
payoffs_approaching
payoffs_due
planned_reveals_available
planned_reveals_locked
next_beat_constraints
```

The exact schema must be designed separately and must not be folded into entity truth/state.

### 4.4 `NarrativeStateUpdateProposal`

After accepted prose, a model or deterministic extractor may propose state changes, but it must not rewrite canonical state wholesale.

A proposal should identify:

```text
field/entity/thread affected
previous accepted value/state
proposed new value/state
narrative scope / effective point
source evidence or accepted-operation receipt
reason
proposal origin
confidence/review metadata where appropriate
```

The authority layer decides whether the proposal becomes accepted state.

This preserves the existing distinction between:

```text
supporting evidence
state transition
same-scope contradiction
open ambiguity
```

### 4.5 `ContinuityAuditProposal`

Periodic or on-demand review over already-accepted material.

Candidate finding classes:

```text
continuity contradiction
knowledge leakage
location/possession mismatch
unresolved setup
premature payoff/reveal
repetition pattern
timeline inconsistency
pacing concern
stale/open thread
possible forgotten state transition
```

Each finding must point to evidence/state. The audit does not mutate canon.

### 4.6 `ContextCompactor`

Reduces model-facing context without deleting canonical history.

Rules:

- original accepted prose remains durable;
- source evidence remains durable;
- canonical structured state remains durable;
- receipts/provenance remain durable;
- summaries/digests are derived, replaceable artifacts;
- compaction only changes what is sent to the model, not what the project knows;
- every compaction decision should be traceable.

### 4.7 `StoryRunPlanner`

Maintains a bounded plan for autonomous continuation.

It may propose a short runway of beats rather than a complete immutable novel outline.

A plan entry should be able to reference:

```text
beat intent
threads advanced
threads not allowed to resolve
available reveals
narrative distance
scene mode
pacing obligation
```

Planning output remains proposal/planning state, not world truth.

### 4.8 `AutonomousRunController`

Coordinates hands-free continuation without bypassing authority.

Conceptual loop:

```text
select/plan next bounded beat
        ↓
compile model context
        ↓
generate candidate prose
        ↓
validate candidate
        ↓
review/accept OR configured autonomous acceptance policy
        ↓
atomic canonical apply + receipt
        ↓
propose structured state/pacing updates
        ↓
apply only through authority boundary
        ↓
persist
        ↓
compact model context if needed
        ↓
periodic advisory audit
        ↓
extend plan when runway becomes short
        ↓
repeat
```

No autonomous mode may create a second hidden canon-write path.

### 4.9 `NarrativeTrace`

The Novella instrumentation proved the value of making orchestration visible.

Onceaponatime should eventually expose a first-class diagnostic trace for development and benchmarking rather than relying on temporary `console.log` instrumentation.

A generation trace may record:

```text
operation id
model adapter
context budget
selected context blocks
excluded/truncated blocks and reasons
authority mode
creative initiative
narrative distance
scene mode
model request fingerprint
candidate response fingerprint
validation result
state-update proposals
accepted transaction receipt
compaction decisions
audit findings
```

Debug trace data is observational only and must never itself become story truth.

---

## 5. Orthogonal generation controls

The inspection reinforces that the author should not have one overloaded "creativity" control.

At minimum keep these independent:

```text
AUTHORITY MODE
What established material is binding and what kind of invention is allowed?

CREATIVE INITIATIVE
How strongly should the model explore the space it is allowed to use?

NARRATIVE DISTANCE
How far may this operation advance the story?

SCENE MODE
What kind of scene is being constructed (dialogue, action, discovery, reflection, mixed, etc.)?

STYLE PROFILE
How should the prose sound?
```

A high creative-initiative setting must never silently enlarge narrative distance.

Example:

```text
Bible + Creative
initiative 5
narrative distance = current scene
scene mode = dialogue
```

permits substantial invention inside the current scene without consuming future arcs or major locked payoffs.

---

## 6. Context authority is different from context order

The compiler may serialize context in whatever order performs best for a selected model, but semantic authority should remain explicit.

Candidate precedence:

```text
EXPLICIT AUTHOR CONSTRAINTS
        >
ACCEPTED CANON / TEMPORAL STATE
        >
KNOWLEDGE + REVEAL BOUNDARIES
        >
ACCEPTED OPERATION CONTRACT
        >
PACING / PLANNING STATE
        >
DERIVED INTERPRETATIONS / SUMMARIES
        >
MODEL INVENTION
```

Style and scene-mode instructions operate on expression/construction and do not gain factual authority merely by being later in the prompt.

If two authoritative layers conflict, context compilation should fail or surface the conflict rather than silently choosing whichever text appears last.

---

## 7. Long-context policy

Onceaponatime should treat the context window as a cache, not as the database.

### Durable

- accepted source documents and prose;
- evidence units;
- canonical entities/facts/relationships;
- temporal state history;
- knowledge/reveal state;
- pacing/thread state once that schema exists;
- accepted-operation receipts;
- author edits and provenance.

### Derived / replaceable

- prose digests;
- model-generated summaries;
- relevance indexes;
- cached context packages;
- audit reports;
- model suggestions.

The model may receive recent prose plus compact historical material, but retrieval from durable structured memory must be able to reintroduce old details when they become relevant again.

---

## 8. State-update policy

Onceaponatime should not adopt a "rewrite the current story-state text after every chapter" authority model.

Instead:

```text
ACCEPTED PROSE / SOURCE
        ↓
EXTRACT / PROPOSE CHANGES
        ↓
compare to current accepted state
        ↓
classify
  - support
  - new fact/state
  - transition
  - contradiction
  - ambiguity
        ↓
authority/review boundary
        ↓
atomic accepted update + provenance
```

A model may help interpret the change, but it never gains authority merely by producing the new state string.

---

## 9. Advisory audit policy

The continuity audit remains a reviewer.

It may:

- report suspected problems;
- point to evidence;
- propose a repair operation;
- propose a pacing/thread action;
- propose that an old ambiguity may now be resolvable.

It may not:

- rewrite accepted prose automatically;
- edit the Bible directly;
- establish a fact;
- close a thread;
- unlock a reveal;
- change entity/knowledge/pacing state directly.

If an autonomous workflow is eventually allowed to consume audit advice, that permission must be explicit and still pass through the same validation/transaction authority used by ordinary operations.

---

## 10. Autonomous planning policy

A long-running writer should not be handed permission to "finish the story" merely because it is autonomous.

The run controller should maintain a bounded runway and replenish it as needed.

Narrative distance remains enforced per generated operation even inside a marathon-like run.

This allows:

```text
chapter-sized generation
+
scene/beat-level planning constraints
+
arc-level pacing awareness
```

without letting one call consume multiple future arcs accidentally.

---

## 11. Failure and resume requirements

A long-running orchestration layer must be resumable without reconstructing truth from the model.

Persist enough state to resume:

```text
accepted canonical project revision
current pacing/plan position
remaining bounded plan entries
last completed operation/receipt
pending audit findings
context-compaction metadata
run target/counters
```

In-flight model streams/promises are transient. A reload should resume from the last accepted transaction, never from half-applied candidate state.

---

## 12. Behavioral proof targets

These tests should be added only when the corresponding post-B4 components become active.

### Test A — Context precedence

Introduce conflicting low-authority derived text against explicit author/canonical state. Verify the compiler does not allow the derived text to win merely because of serialization order.

### Test B — High initiative, bounded narrative distance

Use creative initiative 5 with narrative distance = one scene. Verify rich invention occurs inside the scene without consuming later arc beats or locked reveals.

### Test C — Scene mode is not style authority

Hold factual state and narrative distance fixed while switching action/dialogue/reflection scene modes. Verify construction changes without factual permissions changing.

### Test D — Structured memory survives compaction

Force old prose out of the active context window. Later make an old object/relationship/state relevant again. Verify the selector restores the correct structured fact/evidence without relying on a lossy digest alone.

### Test E — State update remains a proposal

Have a model propose an incorrect state change after accepted prose. Verify canonical state is unchanged until the normal authority boundary accepts a valid evidence-backed update.

### Test F — Audit cannot mutate canon

Run an audit that identifies a real contradiction and suggests a repair. Verify the audit report exists but canonical project state/prose remain byte-for-byte unchanged.

### Test G — Autonomous run cannot bypass authority

Run multiple planned continuations. Verify every accepted chapter/state change is attributable to the normal validation/transaction path and has receipts; there is no special marathon write bypass.

### Test H — Compaction does not delete history

Trigger repeated context compaction. Verify original prose, evidence, provenance, and receipts remain durable and recoverable.

### Test I — Resume from accepted boundary

Interrupt/reload an autonomous run between generations. Verify resume starts from the last accepted transaction and does not duplicate or partially apply the interrupted operation.

### Test J — Model-adapter swap

Run the same compiled story operation through two model adapters. Verify provider differences affect generation quality but not authority, persistence, state ownership, or transaction semantics.

### Test K — Context trace truthfulness

Verify every included/excluded/truncated context block has a traceable reason and token/budget accounting, and that traces cannot mutate story state.

---

## 13. Suggested post-B4 implementation order

Do not start these while B3d/B4 are active. When the authority foundation is ready, an incremental sequence could be:

```text
O1 — Context compiler + trace
        ↓
O2 — Structured pacing-state schema
        ↓
O3 — Evidence-backed state-update proposals
        ↓
O4 — Advisory continuity audit
        ↓
O5 — Context selector + compaction policy
        ↓
O6 — Bounded story-run planner
        ↓
O7 — Autonomous run controller + resume
```

Each slice should receive its own RED contract before production changes, following the same discipline used by B1–B3d.

---

## 14. Governing implementation rule

The external reference demonstrates that a small amount of orchestration can make a generic model behave like a long-form writing system.

Onceaponatime's advantage should be that the orchestration remains **inspectable and governed**:

```text
THE MODEL WRITES / INTERPRETS / PROPOSES
THE FRAMEWORK STORES / SCOPES / VALIDATES / TRANSACTS
THE AUTHOR DEFINES AUTHORITY
```

The context window is temporary.

The model is replaceable.

Accepted narrative state, evidence, provenance, and authority are the durable system.
