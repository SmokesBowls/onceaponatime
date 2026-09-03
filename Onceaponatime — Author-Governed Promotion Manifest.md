# Onceaponatime — Author-Governed Promotion Manifest

You are working in the existing **Onceaponatime** repository.

Repository:

```text
/mnt/data-drive/onceaponatime
```

The application is under:

```text
/mnt/data-drive/onceaponatime/app
```

Current expected baseline:

```text
branch: main
HEAD: d0c1670
```

Current relevant commits:

```text
f61c28d test: require promotion integrity baseline
d0c1670 feat: enforce promotion integrity baseline
```

Do not assume the repository still exactly matches any line numbers or descriptions in this instruction. Inspect the current committed source first.

Do not begin by redesigning the application.

Do not migrate providers.

Do not add persistence.

Do not broaden this into the remaining roadmap.

This is a bounded RED → GREEN authority-layer build.

---

# 1. Mission

The current application has a promotion-integrity boundary, but it is still missing a higher authority boundary.

The author may approve prose, extraction may interpret that prose, and successful extraction may propose semantic state changes.

Those machine interpretations must **not automatically become canon**.

Implement an explicit, reviewable **Promotion Manifest** between extraction and atomic promotion.

The governing rule is:

```text
ACCEPTED PROSE
≠
MACHINE INTERPRETATION
≠
ADMITTED STORY STATE
```

The required flow is:

```text
candidate prose
      ↓
validation
      ↓
extraction
      ↓
PROPOSED PROMOTION MANIFEST
      ↓
author reviews semantic proposals
      ├── approve
      ├── edit
      └── reject
      ↓
ADMITTED MANIFEST
      ↓
pure atomic promotion transaction
      ↓
accepted manuscript + accepted story state
```

A machine interpretation is a proposal.

It becomes story reality only after explicit admission.

---

# 2. Governing Invariants

These are mandatory.

## 2.1 No semantic change without admission

The following must never enter accepted project state merely because extraction returned them:

```text
new entity proposals
location changes
possession changes
actor-state changes
belief changes
thread advancements
reveal changes
```

Every semantic proposal must have an explicit author decision before final promotion.

Allowed decisions:

```text
pending
approved
edited
rejected
```

`pending` is not admissible for final promotion.

If even one semantic proposal is still pending:

```text
Commit to Canon
```

must be unavailable and the transaction layer must independently reject the manifest if called anyway.

Do not depend only on disabled UI buttons for correctness.

---

## 2.2 Mention evidence is not semantic transformation

Mentions may remain evidence of what appeared in accepted prose.

For example:

```text
"She looked at the glass compass."
```

may establish:

```text
mention evidence:
object_017 appeared
```

It does not by itself establish:

```text
actor possesses object_017
actor believes something about object_017
actor moved object_017
object_017 belongs to actor
actor is curious
actor fatigue changed
```

The existing deterministic-fallback integrity guarantees must remain intact.

---

## 2.3 Proposed entities are semantic proposals

Creating a durable entity is a semantic action.

A newly proposed entity therefore requires author admission.

If approved, preserve the recently established invariant:

```text
new object current_holder_id = null
```

Do not allow entity creation itself to silently assign possession.

Possession requires its own admitted possession-change record.

---

## 2.4 Rejected means zero effect

If the author rejects a proposal:

```text
rejected proposal
→ no story-state mutation
```

The rejected proposal may remain visible in the promotion receipt/audit information if appropriate, but it must have no semantic effect.

---

## 2.5 Edited proposals preserve both forms

When the author edits a proposed semantic change, preserve:

```text
original machine proposal
```

separately from:

```text
author-admitted proposal
```

Do not overwrite the machine proposal and pretend the model originally produced the edited value.

Conceptually:

```text
entry:
  proposed: <machine result>
  decision: edited
  admitted: <author-approved replacement>
```

---

## 2.6 Promotion is atomic

Final promotion must include the manuscript addition and all admitted semantic changes in one transaction.

Either:

```text
everything succeeds
```

or:

```text
nothing changes
```

A stale holder, unknown object, invalid entity reference, malformed admitted value, stale candidate, or any other transaction failure must leave the complete active project byte-equivalent to its pre-promotion state.

No partial manuscript addition.

No partial Codex change.

No partial actor state.

No partial object state.

No partial thread state.

No partial reveal state.

---

## 2.7 activeProject must remain untouched until commit

Generating the manifest must not mutate `activeProject`.

Reviewing the manifest must not mutate `activeProject`.

Editing manifest proposals must not mutate `activeProject`.

Rejecting proposals must not mutate `activeProject`.

Only the final successful atomic transaction may produce the next project.

There should be one final React state commit of the completed project.

---

## 2.8 Stale manifests may not promote

A manifest is tied to the exact validated candidate from which it was extracted.

If candidate prose changes after the manifest is created, that manifest is stale.

It must not be promotable.

The stale manifest must either be discarded automatically or visibly marked invalid and require:

```text
revalidation
→ re-extraction
→ new manifest
```

before promotion.

Use an existing candidate revision, receipt identity, fingerprint, or hashing facility if one already exists.

If none exists, implement the smallest deterministic mechanism necessary.

Do not add a new external cryptography dependency merely for this.

At minimum the transaction must be able to prove:

```text
manifest source candidate
==
candidate currently being promoted
```

---

# 3. Inspect Before Editing

Before changing source, inspect at minimum:

```text
PROPOSAL.md
LITERARY_MECHANICS.md

app/src/App.tsx
app/src/types.ts
app/src/lib/promotionIntegrity.ts
app/tests/promotionIntegrity.test.ts
app/package.json
```

Also locate:

```text
candidate types
extraction response types
history/undo code
promotion callback
entity creation helpers
location-change application
possession-change application
actor-state application
belief application
thread advancement
reveal application
candidate editing/revalidation
all callers capable of promoting a candidate
```

Search the entire application for every path capable of applying extracted semantic state.

Do not secure one path while leaving another bypass.

Report what you found before deciding final file boundaries.

---

# 4. RED First

Before implementing the new authority layer, create a committed regression that proves the current system lacks it.

Add a focused test suite.

Preferred path:

```text
app/tests/promotionManifest.test.ts
```

If current project conventions make another location more appropriate, use the established convention and explain why.

Add a focused package script if appropriate:

```text
test:promotion-manifest
```

The RED must fail against the current committed implementation for the correct architectural reason.

At minimum prove:

### RED A — unreviewed change cannot enter canon

Given an extraction proposal containing a legitimate semantic change:

```text
location change
or
belief change
or
actor state change
```

attempting promotion without explicit admission must fail.

The current implementation should reproduce the missing authority boundary.

### RED B — pending manifest cannot commit

A manifest containing a semantic entry with:

```text
decision: pending
```

must be rejected.

### RED C — rejected change has no effect

A rejected semantic proposal must not alter resulting project state.

### RED D — edited change uses author value

For:

```text
machine proposal: X
author edit: Y
```

the resulting project must contain:

```text
Y
```

and not `X`.

The original machine proposal must remain available in the manifest/receipt.

### RED E — mixed decisions

A manifest containing:

```text
approved A
rejected B
edited C
```

must apply exactly:

```text
A
C-as-edited
```

and not B.

### RED F — transaction failure is atomic

If one admitted transition fails a precondition, the complete promotion must fail and the original project must remain unchanged.

Use a real integrity condition such as stale possession state if appropriate.

### RED G — input immutability

The pure promotion function must never mutate:

```text
currentProject
candidate
manifest
```

### RED H — stale manifest rejection

A manifest generated from candidate revision/text A must not promote candidate revision/text B.

---

# 5. Commit the RED

Once the focused regression fails for the correct reason, commit the RED before implementing GREEN.

Suggested commit message:

```text
test: require author-admitted promotion manifest
```

Record in the final report:

```text
RED commit hash
exact failing command
exact relevant failure
exit code
```

Do not manufacture a RED after GREEN exists.

---

# 6. Promotion Manifest Contract

Implement a typed manifest contract.

Preferred new module:

```text
app/src/lib/promotionManifest.ts
```

Reuse existing extraction/state-change record shapes wherever possible.

Do not create a second incompatible narrative-state schema.

The manifest should wrap the existing proposal shapes with authority metadata.

A conceptual shape is:

```ts
type AdmissionDecision =
  | "pending"
  | "approved"
  | "edited"
  | "rejected";

interface PromotionManifestEntry<T> {
  id: string;

  kind:
    | "entity_proposal"
    | "location_change"
    | "possession_change"
    | "actor_state_change"
    | "belief_change"
    | "thread_advancement"
    | "reveal";

  proposed: T;

  decision: AdmissionDecision;

  admitted?: T;

  evidence: PromotionEvidence[];
}
```

This shape is illustrative.

Adapt it to the real types after inspection.

Requirements:

```text
stable entry ID
semantic category
original proposed payload
author decision
optional admitted edited payload
evidence references where available
```

Do not use `any`.

Do not use unsafe casts merely to satisfy TypeScript.

Do not silently discard malformed entries.

---

# 7. Evidence

The manifest must make the basis of the proposal inspectable.

Use actual evidence already available from extraction or mention records.

Possible evidence representation:

```text
source text snippet
mention ID
scene/beat position
actor/object references
```

Do not fabricate evidence.

If the current extraction does not provide direct evidence for a semantic proposal:

```text
evidence: []
```

is acceptable for this bounded slice.

The UI must make absence of direct evidence visible.

Do not invent quotations.

Do not redesign or migrate the model provider merely to obtain richer evidence in this slice.

---

# 8. Pure Promotion Authority

Create a pure, independently testable promotion transaction.

Preferred file:

```text
app/src/lib/preparePromotion.ts
```

Preferred conceptual API:

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

Adapt names/types to the actual codebase.

This function must contain the authoritative transition logic.

It must:

```text
never mutate inputs
verify candidate/manifest freshness
reject pending semantic entries
validate edited admitted payloads
ignore rejected semantic entries
apply approved semantic entries
apply edited semantic entries using admitted values
preserve original proposals for audit
enforce all existing transition preconditions
deep-isolate all mutation work
produce the complete next project
produce the exact undo/history snapshot or receipt
produce an explicit promotion receipt
throw on any invalid transaction
```

The final function must be callable without:

```text
React
DOM
HTTP
browser state
```

`App.tsx` must not remain the narrative authority.

React should orchestrate the transaction.

The pure function should decide whether the transaction is valid and what the resulting project is.

---

# 9. Reuse Existing Promotion Integrity

Do not weaken or duplicate the protections already implemented in:

```text
app/src/lib/promotionIntegrity.ts
```

Preserve at minimum:

```text
new objects begin unheld
possession changes require explicit admitted records
from_actor_id preconditions are enforced
unknown objects fail
stale/mismatched prior holders fail
failed transitions do not fabricate state
```

If helpers need to move to support `preparePromotion`, preserve their existing behavior and tests.

Do not fork two subtly different implementations of possession or state admission.

There should be one authority path.

---

# 10. App.tsx Becomes Orchestration

Refactor only the necessary portion of:

```text
app/src/App.tsx
```

Do not perform a broad component rewrite.

The desired responsibility boundary is:

```text
App.tsx
  - request execution
  - request validation
  - request extraction
  - hold candidate
  - hold promotion manifest
  - display review UI
  - collect author decisions
  - call preparePromotion(...)
  - commit returned nextProject
  - surface failure
```

It should not independently reproduce the semantic transition rules handled by `preparePromotion`.

Search for and remove/bypass any direct semantic-application route that would allow machine extraction to enter canon without a manifest.

---

# 11. Author Review UI

Add a focused author-facing manifest component.

Preferred path:

```text
app/src/components/PromotionManifestPanel.tsx
```

Use the existing visual language of the application.

Do not redesign the whole UI.

The panel must clearly distinguish:

```text
EVIDENCE / MENTIONS

PROPOSED ENTITIES

PROPOSED STATE CHANGES
```

Semantic changes should be grouped by type:

```text
Entities
Locations
Possession
Actor State
Beliefs
Threads
Reveals
```

For every semantic entry provide explicit controls:

```text
Approve
Edit
Reject
```

An approved entry uses the machine proposal unchanged.

A rejected entry has no semantic effect.

An edited entry stores the machine proposal unchanged and creates a separately validated admitted value.

Do not implement editing as an unrestricted raw JSON box.

Reuse known project IDs and typed controls where reasonable.

Keep the UI bounded.

---

# 12. Final Commit Control

There must be a distinct final author action such as:

```text
Commit to Canon
```

or equivalent existing terminology.

It must not be possible while semantic entries remain pending.

The manifest screen should make it obvious that:

```text
reviewing != committed
```

The user must be able to cancel the manifest without changing canonical project state.

If extraction produces no semantic proposals, display that fact clearly.

For example:

```text
No semantic state changes proposed.
```

The author may then commit the accepted prose/evidence through the normal atomic promotion.

---

# 13. Candidate Editing and Revalidation

Preserve the existing candidate editing/revalidation behavior.

But enforce freshness.

If the prose changes after extraction/manifest creation:

```text
old manifest becomes invalid
```

Do not let a manifest describing old prose commit against new prose.

The required flow becomes:

```text
edit candidate
→ invalidate prior validation/extraction/manifest as appropriate
→ revalidate
→ re-extract
→ create fresh manifest
→ review
→ commit
```

Do not silently reuse stale machine interpretations.

---

# 14. Promotion Receipt

The pure transaction must expose what actually happened.

Do not attempt the entire future provenance architecture in this slice.

But create enough receipt information to answer:

```text
which manifest was committed?
which candidate was committed?
which entries were approved?
which entries were edited?
which entries were rejected?
what semantic transformations were actually applied?
```

Preserve original proposed values for edited entries.

Do not falsely claim complete Stage 1/Stage 2/extraction provenance if it has not yet been implemented.

This is a promotion receipt, not the final provenance system.

---

# 15. Undo

Existing undo/history behavior must continue to work.

A successful canonical promotion must be reversible as one operation:

```text
manuscript addition
+
entity creation
+
location changes
+
possession changes
+
actor-state changes
+
belief changes
+
thread changes
+
reveal changes
```

Undo must restore the exact pre-promotion project.

Do not create a situation where prose is undone but semantic state remains, or semantic state is undone while prose remains.

---

# 16. Fail Closed

Every failure path must preserve canonical state.

Examples:

```text
invalid manifest
pending decision
malformed edited value
stale candidate
unknown entity
stale possession holder
invalid relationship
transaction exception
```

Result:

```text
promotion fails
active project unchanged
author remains on reviewable candidate/manifest
```

Do not convert failed promotion into a successful empty semantic patch.

Do not automatically retry by weakening validation.

---

# 17. User-Visible Failure

Do not leave this authority boundary dependent only on:

```text
console.error(...)
```

If final promotion fails, provide a visible error state in the author workflow.

At minimum show:

```text
Promotion failed.
Canon was not changed.
<useful error reason>
```

Preserve the candidate and manifest so the author can correct the problem.

Do not discard their work merely because the transaction failed.

This is not a request for a full notification framework.

Keep it local to this workflow.

---

# 18. GREEN Tests

Expand the focused regression until it proves at minimum:

```text
1. unreviewed semantic proposal cannot promote

2. pending manifest cannot promote

3. approved proposal applies

4. rejected proposal does not apply

5. edited proposal applies admitted value

6. original machine proposal survives an edit for audit

7. mixed approved/rejected/edited entries apply exactly the admitted subset

8. new approved object begins current_holder_id === null

9. object mention does not create possession

10. possession changes still enforce from_actor_id

11. stale possession aborts complete transaction

12. transaction failure leaves original project byte-equivalent

13. project input is not mutated

14. candidate input is not mutated

15. manifest input is not mutated

16. stale manifest cannot promote modified candidate prose

17. no semantic proposal means no fabricated semantic changes

18. undo snapshot represents the true pre-promotion project
```

Add higher-level coverage for the application workflow if the current test stack supports it without a large dependency migration.

At minimum prove structurally that:

```text
extraction result
→ manifest

not

extraction result
→ direct activeProject semantic mutation
```

If React/browser testing infrastructure already exists, add a test proving:

```text
manifest review occurs before final project commit
```

Do not introduce a large browser-testing framework solely for this slice unless genuinely necessary.

---

# 19. Independent Adversarial Review

After GREEN, conduct a fresh source review specifically looking for bypasses.

Review questions:

```text
Can any successful extraction still mutate canon without author admission?

Can any semantic entry with decision=pending reach accepted state?

Can rejected changes leak into state?

Can edited changes overwrite the original machine proposal?

Can App.tsx bypass preparePromotion?

Can stale candidate text reuse an old manifest?

Can activeProject mutate before final commit?

Can one failed transition leave earlier transitions applied?

Can possession bypass from-holder validation?

Can a proposed object receive a holder without explicit possession admission?

Can undo restore prose but not semantic state, or vice versa?
```

If your environment supports a genuinely independent reviewer/subagent, use one after implementation.

If it does not, perform a dedicated second-pass source audit and state explicitly that it was not independent.

Do not treat a review of an earlier intermediate version as evidence about the final source.

---

# 20. Verification

After implementation run the focused new suite first.

From the actual package root, run:

```bash
npm run test:promotion-manifest
```

if that script was added.

Then preserve the existing promotion-integrity proof:

```bash
npm run test:promotion-integrity
```

Then run the canonical project verification:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Also run any existing focused suites that are not included by `npm test` and that cover the modified boundaries.

Inspect `package.json` rather than guessing.

Do not claim a test passed unless it was actually executed in the final source state.

---

# 21. GREEN Commit

After:

```text
focused tests pass
canonical tests pass
lint passes
build passes
git diff --check passes
final source review passes
```

commit the implementation.

Suggested commit message:

```text
feat: require author-admitted promotion manifest
```

Do not squash the RED commit into GREEN.

The repository history should preserve:

```text
RED test
→ GREEN implementation
```

---

# 22. Explicit Non-Goals

Do not implement these in this slice:

```text
Gemini → Hermes extraction migration
validation provider migration
Stage 1 redesign
Stage 2 redesign
rendering-envelope redesign
full inference provenance
full validation provenance
persistent project save/load
IndexedDB
database storage
autosave
crash recovery
schema migration system
temporal event ledger
confidence scoring
new retrieval architecture
entity merge/split redesign
benchmark redesign
capability routing
README overhaul
deployment architecture
new story canon schema beyond what is minimally required
live model inference for verification
```

Do not “helpfully” continue into the next roadmap item.

Finish this authority boundary cleanly.

---

# 23. Do Not Push

You may create the RED and GREEN commits.

Do not push them.

Final Git state should be reported as something similar to:

```text
main...origin/main [ahead 2]
```

depending on the actual commit count.

The human will push after review.

---

# 24. Final Report

When complete, provide a precise engineering report containing:

## Baseline

```text
starting HEAD
starting git status
files inspected
existing promotion path discovered
```

## RED

```text
RED commit hash
test added
exact failure reproduced
exit code
why the failure proved the missing authority boundary
```

## Implementation

List every changed/created file and its exact responsibility.

Example:

```text
app/src/lib/promotionManifest.ts
- manifest contract
- admission decisions
- manifest validation

app/src/lib/preparePromotion.ts
- pure atomic transaction
- precondition enforcement
- receipt construction

app/src/components/PromotionManifestPanel.tsx
- author review controls

app/src/App.tsx
- orchestration only
```

Use the real files, not this example if implementation differs.

## Behavioral Proof

Explicitly confirm:

```text
machine interpretation no longer equals canon

pending semantic proposals cannot commit

approved proposals apply

rejected proposals do not apply

edited proposals preserve original + admitted forms

stale manifests cannot promote changed prose

activeProject is unchanged during review

failed promotion is atomic

undo restores exact pre-promotion state

possession-integrity baseline remains intact
```

## Review

Provide the final adversarial review result.

If defects were found during review:

```text
state them
fix them
rerun tests
perform a fresh review
```

Do not dismiss a finding as stale unless you can prove the review inspected an earlier source state and then obtain/review the corrected state.

## Verification

List every command actually executed and whether it passed.

Include relevant build output.

## Git

Report:

```text
RED commit
GREEN commit
current HEAD
git status --short --branch
whether working tree is clean
whether anything was pushed
```

---

# 25. Success Condition

This slice is complete only when the following statement is true:

> Onceaponatime may use a model to interpret accepted prose, but no machine-proposed semantic transformation becomes durable story reality until the author has explicitly admitted it, and the complete admitted change set is then applied as one immutable, auditable, reversible transaction.

That is the authority boundary being built.

Do not stop at displaying a manifest.

Do not stop at adding buttons.

Do not stop at a pure helper that the application can bypass.

The proof is end-to-end:

```text
machine proposal
      ↓
reviewable manifest
      ↓
author admission
      ↓
single pure authority
      ↓
atomic canon
```