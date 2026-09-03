# Onceaponatime — Phase 1: Promotion Manifest Domain Authority

You are working in the existing **Onceaponatime** repository.

Repository:

```text
/mnt/data-drive/onceaponatime
```

Application:

```text
/mnt/data-drive/onceaponatime/app
```

Expected starting baseline:

```text
branch: main
HEAD: d0c1670
```

Relevant baseline commits:

```text
f61c28d test: require promotion integrity baseline
d0c1670 feat: enforce promotion integrity baseline
```

Inspect Git before doing anything. If HEAD differs, report the actual state and continue from the current committed repository unless doing so would invalidate this bounded task.

---

# 1. Governing Feature Specification

This is **Phase 1** of the Author-Governed Promotion Manifest feature.

The complete future feature is:

```text
accepted prose
    ↓
extraction
    ↓
proposed promotion manifest
    ↓
author review
    ↓
admitted manifest
    ↓
pure atomic promotion
    ↓
canon
```

But this task implements **only the domain and authority layer**.

Do not activate it in React yet.

Do not change the author workflow yet.

Do not add the review panel yet.

Do not remove the current UI promotion path yet.

Phase 2 will activate this authority inside the application after Phase 1 has been independently reviewed.

The governing distinction is:

```text
ACCEPTED PROSE
≠
MACHINE INTERPRETATION
≠
ADMITTED STORY STATE
```

The purpose of this slice is to create a pure, testable authority vocabulary and transaction capable of enforcing that distinction.

---

# 2. Phase 1 Scope

Implement:

```text
PromotionManifest domain types
PromotionManifest builder
admission decisions
exact editable-prose freshness binding
entity/mention referential integrity
admission validation
pure preparePromotion(...)
atomic application of already-supported semantic transitions
promotion receipt
exact undo/pre-promotion snapshot
exhaustive pure tests
RED → GREEN commits
```

Do NOT implement:

```text
React activation
PromotionManifestPanel
Approve/Edit/Reject UI controls
Commit to Canon UI
candidate workflow changes
HTTP workflow changes
visible UI error handling
direct-mutation-path removal
provider migration
new story mechanics
persistence
full provenance
browser integration tests
```

Stop after the pure authority layer is implemented, tested, reviewed, and committed.

---

# 3. Inspect Before Editing

Inspect at minimum:

```text
PROPOSAL.md
LITERARY_MECHANICS.md

app/src/App.tsx
app/src/types.ts
app/src/lib/promotionIntegrity.ts
app/tests/promotionIntegrity.test.ts
app/package.json
```

Search for and understand:

```text
StoryProject
candidate types
candidate.stage2Prose
stage2Artifact
Stage 1 receipt
Stage 2 receipt
extraction response types
MentionRecord
proposed entities
location changes
possession changes
actor-state changes
belief changes
thread advancements
reveal changes
history snapshots
undo behavior
current promotion logic
all semantic mutation helpers
```

Before implementation, determine which extraction categories currently have mature application semantics and which do not.

Do not infer this from this prompt. Inspect the source.

---

# 4. Existing Baseline Must Remain Intact

The current promotion-integrity baseline already established important behavior.

Preserve it.

At minimum:

```text
newly mentioned/proposed objects begin with current_holder_id = null

mentions do not imply possession

possession changes require explicit possession-change records

possession from_actor_id is a real precondition

unknown objects fail

stale/mismatched prior holders fail

deterministic fallback preserves mention evidence

deterministic fallback fabricates no semantic state changes

promotion work occurs on an isolated project draft

transaction failure restores/preserves exact pre-promotion state
```

Do not weaken these guarantees.

Do not create duplicate competing implementations of them.

Reuse or refactor the existing authority helpers where appropriate.

---

# 5. RED First

Create a focused regression before implementing the new authority layer.

Preferred test file:

```text
app/tests/promotionManifest.test.ts
```

Add a focused package command if consistent with the repository:

```text
npm run test:promotion-manifest
```

The committed RED must fail against the current implementation because the Promotion Manifest authority does not exist.

At minimum the RED should establish the following required behavior.

---

# 6. Admission Decisions

Define an explicit admission decision vocabulary:

```text
pending
approved
edited
rejected
```

A semantic proposal must retain:

```text
original machine proposal
decision
optional admitted replacement
```

Conceptually:

```ts
{
  proposed: machineValue,
  decision: "edited",
  admitted: authorValue
}
```

Never overwrite the original proposal when editing.

The machine proposal and admitted value are different records of authority.

---

# 7. Required Manifest Categories

The Promotion Manifest should be able to represent semantic proposals already returned by extraction, including as applicable:

```text
entity proposals
location changes
possession changes
actor-state changes
belief changes
thread advancements
reveals
```

Use the actual current extraction types.

Do not invent a second incompatible narrative schema merely for the manifest.

Do not use `any`.

Do not use unchecked casts to bypass type safety.

---

# 8. IMPORTANT FRESHNESS RULE

Do **not** use Stage 1 or Stage 2 inference receipt identity as proof that a Promotion Manifest matches the current editable candidate prose.

Stage 1 and Stage 2 receipts attest inference artifacts.

They do not necessarily attest the current review text after human editing.

In particular:

```text
candidate.stage2Prose
```

may change while:

```text
candidate.stage2Artifact
candidate.stage2Artifact.receipt
```

remain unchanged.

Therefore:

```text
Stage 1 receipt ID ≠ editable prose freshness proof
Stage 2 receipt ID ≠ editable prose freshness proof
```

Manifest freshness must bind to the exact current:

```text
candidate.stage2Prose
```

or to a deterministic candidate revision/fingerprint derived directly from that exact review text.

If:

```text
candidate.stage2Prose
```

changes by even one meaningful character after manifest creation, the old manifest is stale even when every Stage 1/Stage 2 receipt remains identical.

Implement the smallest deterministic mechanism necessary.

Prefer existing standard-library/browser/runtime facilities already available to the project.

Do not add an external hashing dependency solely for this.

The pure promotion authority must be able to prove:

```text
manifest-bound review prose
==
candidate.stage2Prose currently being promoted
```

before any canonical transition can succeed.

---

# 9. ENTITY / MENTION REFERENTIAL INTEGRITY

A canonical `MentionRecord` may reference only:

```text
an entity that already exists in the project

OR

a proposed entity admitted by the same Promotion Manifest transaction
```

This is mandatory.

Example:

Extraction proposes:

```text
object_017
```

and produces:

```text
mention → object_017
```

If the proposed creation of:

```text
object_017
```

is rejected, that entity-linked mention must not enter canonical:

```text
project.mentions
```

because it would reference an entity that does not exist.

The rejected machine mention may remain available inside:

```text
Promotion Manifest
promotion receipt/audit information
```

but not as canonical entity-linked evidence.

Do not:

```text
silently create the rejected entity

rewrite the mention to another entity without evidence

drop the rejection decision

allow a dangling entity_id
```

Referential integrity must be checked before the transaction succeeds.

The same principle applies to newly proposed actors, objects, locations, factions, or other entity classes represented in the current project schema.

---

# 10. DO NOT INVENT NEW SEMANTIC APPLICATION RULES

The Promotion Manifest may represent every semantic proposal category extraction currently returns.

However:

```text
preparePromotion()
```

may apply a proposal category only through an existing, well-defined story-state transition rule.

For example, if the current implementation already has authoritative semantics for:

```text
location changes
possession changes
actor-state changes
belief changes
```

those may be moved/reused inside the pure authority.

But if extraction also returns:

```text
thread_advancements
reveals_triggered
```

and the current application does not yet have equivalent mature authoritative transition semantics for them:

DO NOT INVENT THOSE SEMANTICS IN THIS SLICE.

Instead, represent such entries truthfully as something like:

```text
supported_for_application: false
```

or another clean typed equivalent.

They may remain:

```text
reviewable
inspectable
receipted
auditable
```

but they must not fabricate a new story-state transition system merely because the manifest contains them.

Fail closed if a caller attempts to admit an unsupported category for canonical application.

Report every unsupported category discovered.

This slice governs **existing semantic mutation**.

It does not create new literary mechanics.

---

# 11. Promotion Manifest Domain Model

Preferred new module:

```text
app/src/lib/promotionManifest.ts
```

Adapt location if repository conventions strongly indicate another path.

The module should provide typed domain structures and pure helpers.

A conceptual shape might resemble:

```ts
type AdmissionDecision =
  | "pending"
  | "approved"
  | "edited"
  | "rejected";

interface PromotionManifestEntry<T> {
  id: string;
  kind: PromotionManifestKind;

  proposed: T;

  decision: AdmissionDecision;

  admitted?: T;

  evidence: PromotionEvidence[];

  supportedForApplication: boolean;
}
```

This is illustrative.

Use the actual codebase types.

Important invariants:

```text
stable manifest identity

stable entry identity

original proposal retained

decision explicit

edited admitted value separate

evidence explicit where actually available

unsupported state explicit

freshness binding explicit

candidate identity/reference explicit where appropriate
```

Do not fabricate evidence.

If the current extraction has no evidence for a proposal:

```text
evidence: []
```

is preferable to invented evidence.

---

# 12. Manifest Builder

Create a pure builder that converts the current extraction result into a Promotion Manifest.

Conceptually:

```ts
buildPromotionManifest(
  candidate,
  extraction,
  project
): PromotionManifest
```

Exact signature may differ.

The builder must:

```text
bind manifest freshness to exact current candidate.stage2Prose

preserve all machine proposals

preserve available mention evidence

represent entity proposals

represent semantic state proposals

identify application-supported vs unsupported categories

start semantic entries in decision=pending unless there is a compelling existing authority reason not to

perform no StoryProject mutation
```

Building a manifest is not promotion.

Building a manifest is not admission.

Building a manifest is not canon.

---

# 13. Pure Promotion Authority

Create a pure authority function.

Preferred module:

```text
app/src/lib/preparePromotion.ts
```

Conceptual API:

```ts
preparePromotion(
  project,
  candidate,
  manifest
): {
  nextProject,
  historyReceipt,
  promotionReceipt
}
```

Adapt exact names and types after inspecting current architecture.

The function must not depend on:

```text
React
DOM
HTTP
browser component state
```

It must be executable directly from tests.

---

# 14. preparePromotion() Authority Rules

`preparePromotion()` must:

```text
never mutate project input

never mutate candidate input

never mutate manifest input

verify manifest freshness against exact candidate.stage2Prose

validate manifest structure

reject semantic entries still marked pending

reject malformed edited entries

reject admitted unsupported semantic categories

ignore rejected semantic effects

apply approved supported proposals

apply edited supported proposals using admitted value

retain original machine proposal in receipt/audit data

enforce entity/mention referential integrity

enforce all existing state-transition preconditions

preserve null initial holder for newly admitted objects

require explicit possession admission for possession

perform all work against an isolated project draft

produce a complete nextProject or throw

produce exact pre-promotion history/undo state

produce an explicit promotion receipt
```

There must be no partial-success result.

---

# 15. What “Rejected” Means

A rejected semantic proposal has zero canonical effect.

Example:

```text
machine proposal:
actor_002 location_001 → location_003

decision:
rejected
```

Result:

```text
actor_002 remains at location_001
```

The rejected proposal may remain in the promotion receipt.

That is audit history, not story truth.

---

# 16. What “Approved” Means

An approved semantic proposal applies the original machine proposal exactly, subject to normal transition validation.

Example:

```text
proposed:
object_004
from_actor_id: actor_001
to_actor_id: actor_002

decision:
approved
```

The existing possession preconditions must still pass.

Approval does not override structural integrity.

If the project says the current holder is actually:

```text
actor_003
```

the entire promotion fails.

---

# 17. What “Edited” Means

An edited semantic proposal applies the separately admitted value.

Example:

```text
proposed:
actor_002 → location_004

decision:
edited

admitted:
actor_002 → location_005
```

Canonical result:

```text
location_005
```

Promotion receipt retains:

```text
machine proposed location_004
author admitted location_005
```

Do not mutate the original proposal into `location_005`.

---

# 18. Pending Is Not Canon

Any application-supported semantic entry that remains:

```text
decision: pending
```

must cause `preparePromotion()` to reject the transaction.

Phase 2 will provide UI for resolving pending entries.

Phase 1 must establish the domain rule now.

Do not rely on future UI enforcement.

---

# 19. Unsupported Categories

If a semantic category currently lacks authoritative application semantics:

```text
supportedForApplication: false
```

or equivalent.

If its decision remains:

```text
pending
```

the manifest may remain a review object.

If a caller attempts to mark the unsupported proposal:

```text
approved
```

or:

```text
edited
```

for canonical application:

```text
preparePromotion() must fail closed
```

with a clear typed/error reason.

Do not silently ignore an author-approved unsupported transition.

That would falsely imply the author's decision was applied.

Do not implement the missing semantic rule.

Report it for a later bounded slice.

---

# 20. Atomicity

Promotion must remain one transaction.

Conceptually:

```text
preProject
   ↓
isolated draft
   ↓
manuscript promotion
mentions
entity admissions
supported semantic transitions
   ↓
validate complete result
   ↓
nextProject
```

If any admitted operation fails:

```text
throw
```

and:

```text
preProject remains byte-equivalent
```

No partial state.

No partial manuscript.

No partial entity creation.

No partial mention persistence.

No partial possession.

No partial location changes.

---

# 21. Exact Canonical Commit Boundary

This phase does not activate React.

However, design the API so Phase 2 can perform exactly one final canonical StoryProject state commit after `preparePromotion()` succeeds.

The eventual rule will be:

```text
There must be exactly one final canonical-project state commit
(setProjects/updateActiveProject equivalent)
for a successful promotion.
```

Do not interpret this as meaning all React state must update once.

Future:

```text
manifest UI state
candidate UI state
error state
history UI state
review state
```

may update separately.

Those are not canonical `StoryProject` mutation.

Phase 1 only needs to make one returned `nextProject` possible.

---

# 22. Promotion Receipt

Implement a bounded promotion receipt.

It is not the final provenance architecture.

It should answer at minimum:

```text
which candidate review text/fingerprint did this manifest bind to?

which manifest was processed?

which entries were approved?

which entries were rejected?

which entries were edited?

what was originally proposed for edited entries?

what was ultimately admitted?

which supported semantic transitions were actually applied?

which unsupported entries remained unapplied?

what pre-promotion project/history snapshot corresponds to this transaction?
```

Use existing receipt conventions where appropriate.

Do not pretend this receipt contains full Stage 1/Stage 2/validation/extraction provenance if it does not.

Do not fabricate provider provenance.

---

# 23. Undo / History Snapshot

A successful `preparePromotion()` result must provide or preserve the exact data needed to restore the pre-promotion project.

The pre-promotion snapshot must reflect the actual untouched input project.

Do not shallow-copy entity arrays and mutate shared entity objects.

Add a regression specifically guarding against this previous class of bug.

---

# 24. Required Focused Tests

The Phase 1 focused suite must prove at minimum:

```text
1. manifest builder does not mutate project

2. manifest builder does not mutate candidate

3. manifest binds to exact candidate.stage2Prose

4. Stage 2 receipt identity alone cannot satisfy freshness

5. editing candidate.stage2Prose makes old manifest stale even when stage2Artifact and its receipt are unchanged

6. pending supported semantic proposal cannot promote

7. approved supported proposal applies

8. rejected proposal has zero semantic effect

9. edited proposal applies admitted value

10. edited proposal preserves original machine value

11. mixed approved/rejected/edited entries apply exactly admitted effects

12. new admitted object begins with current_holder_id === null

13. mention alone does not produce possession

14. explicit possession still enforces from_actor_id

15. stale possession precondition aborts whole transaction

16. failed transaction leaves original project byte-equivalent

17. preparePromotion does not mutate project input

18. preparePromotion does not mutate candidate input

19. preparePromotion does not mutate manifest input

20. rejected new entity cannot leave a canonical MentionRecord referencing that rejected entity

21. admitted new entity may have canonical mentions referencing it

22. canonical mentions may reference already-existing entities

23. no dangling canonical entity IDs are produced

24. unsupported semantic category is represented honestly

25. unsupported semantic category cannot be admitted/applied

26. preparePromotion does not invent thread/reveal transition behavior when no current authoritative rule exists

27. promotion receipt records approved/rejected/edited decisions

28. promotion receipt preserves proposed and admitted forms for edited entries

29. history snapshot is exact pre-promotion state

30. complete resulting project is deterministic for the same inputs
```

Add any additional adversarial tests revealed by source inspection.

---

# 25. RED Commit

The initial regression must be committed while failing for the intended reason.

Suggested commit:

```text
test: require promotion manifest authority
```

Record:

```text
RED commit hash
exact focused command
relevant failing output
exit code
```

Do not create a fake retrospective RED.

---

# 26. GREEN Implementation

After the RED is committed:

Implement only the domain/pure-authority layer.

Preferred likely files:

```text
app/src/lib/promotionManifest.ts
app/src/lib/preparePromotion.ts
app/src/types.ts
app/src/lib/promotionIntegrity.ts
app/tests/promotionManifest.test.ts
app/package.json
```

These are not mandatory exact boundaries.

Use the smallest coherent file set after inspecting the code.

Do not alter `App.tsx` except if an import/type compilation issue absolutely requires a trivial compatibility adjustment.

No activation wiring belongs in this phase.

---

# 27. Independent Adversarial Review

After GREEN, perform a fresh review of the final source.

Specifically ask:

```text
Can receipt identity incorrectly validate edited prose freshness?

Can candidate.stage2Prose change while a manifest still promotes?

Can rejected entity creation leave canonical mentions pointing to a nonexistent entity?

Can a mention force creation of a rejected entity?

Can unsupported thread/reveal semantics accidentally mutate StoryProject?

Can approval bypass existing possession preconditions?

Can edited entries overwrite original proposals?

Can pending entries promote?

Can one failed admitted transition leave earlier state mutations behind?

Can preparePromotion mutate any input?

Is the history snapshot actually pre-promotion?

Did this phase accidentally activate React/UI behavior?

Did this phase invent new story mechanics?
```

If an independent reviewer/subagent is available, use one.

If a review finds a real issue, fix it and perform a fresh post-fix review.

Do not dismiss a valid review solely because another test suite is green.

---

# 28. Verification

Run the focused suite first.

If added:

```bash
npm run test:promotion-manifest
```

Then preserve the previous promotion-integrity baseline:

```bash
npm run test:promotion-integrity
```

Inspect `package.json` and run all relevant existing focused suites affected by the changes.

Then run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Every claimed verification must be executed against the final source state.

---

# 29. GREEN Commit

After all tests, lint, build, diff check, and final review pass:

Commit GREEN.

Suggested commit:

```text
feat: add pure promotion manifest authority
```

Preserve separate:

```text
RED
GREEN
```

commits.

Do not squash.

---

# 30. DO NOT PUSH

Do not push.

Final expected Git relationship will likely resemble:

```text
main...origin/main [ahead 2]
```

Report actual state.

The human will review and push.

---

# 31. Explicit Phase 1 Non-Goals

Do NOT implement:

```text
PromotionManifestPanel.tsx

Approve button

Edit button

Reject button

Prepare Promotion button

Review Semantic Changes button

Commit to Canon button

React manifest state

React stale-manifest invalidation

App.tsx extraction-flow activation

removal of current promotion route

visible author-facing promotion errors

browser-level transaction tests

HTTP restructuring

typed endpoint clients

persistence

Save/Open

autosave

crash recovery

schema migrations

full provenance chain

Hermes extraction migration

Gemini removal

Stage 1 redesign

Stage 2 redesign

validation redesign

benchmark changes

confidence scoring

entity merge/split redesign

temporal event ledger

new thread application semantics

new reveal application semantics

retrieval redesign

README overhaul
```

If one of these appears necessary, stop and report why instead of silently widening the slice.

---

# 32. Final Engineering Report

Provide:

## Baseline

```text
starting HEAD
git status
files inspected
existing semantic mutation categories found
which categories currently have authoritative application semantics
which categories do not
```

## RED

```text
commit hash
exact failure
command
exit code
architectural reason for failure
```

## Domain Contract

Describe:

```text
PromotionManifest
entry identity
admission decisions
freshness binding
entity/mention referential integrity
unsupported-category representation
```

## Pure Authority

Describe:

```text
preparePromotion()
input immutability
atomicity
existing transition-rule reuse
receipt output
history/undo output
```

## Freshness Proof

Explicitly confirm:

```text
Stage 1/Stage 2 receipt identity is NOT used as editable-prose freshness proof.

Manifest freshness binds to exact candidate.stage2Prose or a deterministic fingerprint derived from it.

Changing candidate.stage2Prose invalidates the old manifest even if the immutable inference artifact and receipt remain unchanged.
```

## Referential Integrity Proof

Explicitly confirm:

```text
A canonical MentionRecord cannot reference a rejected/nonexistent proposed entity.

Rejected machine evidence may remain in manifest/audit data without entering canonical project.mentions.

No rejected entity is silently created to satisfy a mention.
```

## Unsupported Semantics

List every proposal category whose application semantics are not currently authoritative.

Explicitly state that no new transition semantics were invented.

## Verification

List every command actually executed and result.

## Review

Provide final adversarial-review result.

## Git

Report:

```text
RED commit
GREEN commit
HEAD
git status --short --branch
working tree clean/dirty
pushed: yes/no
```

---

# 33. Stop Condition

Phase 1 is complete when this statement is true:

> Onceaponatime has a pure, immutable Promotion Manifest authority capable of representing machine-proposed semantic changes, binding them to the exact editable candidate prose, validating explicit admission decisions, preserving entity/mention referential integrity, reusing only existing semantic transition rules, atomically producing the next StoryProject, and recording exactly what was proposed versus admitted—without yet activating that authority in the React author workflow.

Then stop.

Do not begin Phase 2.

Phase 2 will separately perform:

```text
Candidate review
      ↓
Prepare Promotion / Review Semantic Changes
      ↓
Promotion Manifest review
      ↓
Approve / Edit / Reject
      ↓
Commit to Canon
```

after this pure authority has been reviewed.