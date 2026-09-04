# Phase 1 — Promotion Manifest Domain Authority: Final Engineering Report

Status: Phase 1 complete and independently reviewed.

This closes the checklist in `Onceaponatime — Phase 1_ Promotion Manifest Domain Authority.md` §27–§32, which the interrupted session that wrote the domain layer never reached.

## Baseline

```text
Starting HEAD (review begins):    7598930 ("2")
Prior baseline (per brief):       d0c1670 feat: enforce promotion integrity baseline
Files inspected:
  app/src/lib/promotionManifest.ts
  app/src/lib/preparePromotion.ts
  app/src/lib/promotionIntegrity.ts
  app/tests/promotionManifest.test.ts
  app/src/types.ts (StoryProject/ActorEntity/ObjectEntity/MentionRecord shapes)
Existing semantic mutation categories found:
  entity_proposal, location_change, possession_change,
  actor_state_change, belief_change, thread_advancement, reveal_change
Categories with authoritative application semantics:
  entity_proposal (actor/object only), location_change, possession_change, actor_state_change, belief_change
Categories without application semantics (correctly unsupported, fail-closed on approve/edit):
  entity_proposal (type: location), thread_advancement, reveal_change
```

`git status` at the start of this review was clean; HEAD `7598930` already contained a working, tested, lint-clean, build-clean domain layer. It had not, however, been adversarially reviewed, and the GREEN commit carries no message describing what it did (`"2"`).

## Review method

Not a re-read of the intent document. The committed source at HEAD was attacked directly, targeting: stale-prose freshness bypass, receipt-identity substitution, rejected-entity dangling mentions, unsupported-category admission, edited-proposal mutation of the original proposal, possession precondition bypass, partial mutation before failure, input aliasing / shallow-copy mutation, nondeterministic transaction metadata, and receipt/canonical-state inconsistency. Each candidate defect was proven or disproven by executing a standalone repro script against the real `preparePromotion`/`buildPromotionManifest` functions (not by reasoning about the code alone), then, once confirmed, folded into a permanent RED regression test before the fix, and re-run GREEN after.

## Findings

Eight of ten attack vectors found no defect — freshness binding uses direct string equality (not just the FNV-1a fingerprint) so there is no plausible bypass; rejection of a proposed entity correctly drops its mentions rather than admitting them; approving/editing an unsupported category correctly fails the whole transaction closed (matches brief §19 exactly); the original `proposed` value is never mutated by an edit; possession/location/actor preconditions are enforced against actual prior state; the whole transaction operates on a `structuredClone` draft and the caller's `project` is never touched even under a mid-loop throw, so atomicity holds; transaction/receipt ids are pure functions of input state (no `Date.now()`/`Math.random()`); and the promotion receipt's `applied`/`appliedEntryIds`/`unsupportedEntryIds` are derived from the same control-flow that performs the mutation, so they cannot drift from canonical state.

Two confirmed, reproduced defects, both under "input aliasing" and its consequences:

### Finding 1 — Frozen array aliased into mutable canon (Severity: High)

`promotionIntegrity.ts::createMentionedObject` built a newly-admitted object entity's `identity.aliases` as `entity.aliases || []` — since `entity` is a `Promotion Manifest` entry's `proposed`/`admitted` value and the manifest is deep-frozen, this assigned the *same frozen array* into `nextProject.objects[i].identity.aliases`. `createAdmittedActor` (the actor equivalent, two functions away) already did this correctly via `structuredClone`. Any later call into `codexEngine.ts`'s alias-merge mechanic (`targetEnt.aliases.push(...)`, used for the app's core "progressive alias absorption" behavior described in `LITERARY_MECHANICS.md`) against a promoted *object* entity would throw `TypeError` at runtime, because you cannot push onto a frozen array. Actors were unaffected; only objects.

Reproduced live: built a manifest proposing an object with `aliases: ['compass']`, approved it, called `preparePromotion`, confirmed `Object.isFrozen(admittedObject.identity.aliases) === true`, and confirmed `.push()` threw.

**Fix:** `aliases: entity.aliases ? [...entity.aliases] : []` — a real shallow copy instead of a reference passthrough.

### Finding 2 — Edited entity-identity rename silently dropped its own evidence (Severity: Medium)

The domain layer deliberately allows an "edited" `entity_proposal` decision to admit an entity under a *different* id than the machine originally proposed (an existing test, `testEditedEntityIdentityCannotCaptureRejectedProposalEvidence`, already defends the resulting id-collision case, confirming this was intentional, not an oversight). But `canonicalizeMentions` matched source mentions against the *admitted* id only when it happened to equal the *original proposed* id; on a genuine rename it fell into neither the "admit" nor the "unknown entity" branch and was silently `continue`d — dropped. The entity was correctly promoted into canon; every mention of it, and every relationship pointing at it, vanished without a trace or an error.

Reproduced live: proposed `object_provisional_007`, one sourced mention pointing at it, edited the admission to `object_device_final`; the resulting project contained the entity but zero mentions of it.

**Fix:** replaced the ad hoc id matching in `canonicalizeMentions` with `resolveCanonicalMentionId`, a single three-way resolver (`admitted` / `rejected` / `unknown`) applied uniformly to both a mention's own `entity_id` and every `extracted_relationships[].target_id`. A rename now remaps both the mention and any relationship that names the renamed entity to its admitted id; a genuinely rejected/unsupported proposal still drops its mentions silently (correct — that was never a defect); a truly unknown entity id still throws (`Mention referential integrity failed: unknown entity`/`unknown relationship target`, unchanged).

An initial attempt at Finding 2 forbade identity-changing edits outright at the `decidePromotionManifestEntry`/`validatePromotionManifestStructure` layer. That was reverted: it passed the new repro but broke `testEditedEntityIdentityCannotCaptureRejectedProposalEvidence`, an existing, already-passing test built specifically around identity-changing edits being legal. Removing the capability would have been a bigger, uninvited redesign decision, not a bounded fix of the actual defect (evidence loss), so the remap approach was used instead.

## Freshness proof

Confirmed by direct inspection and by the untouched existing test `testReceiptIdentityCannotSubstituteForEditableProseFreshness`: `preparePromotion` rejects on `manifest.boundReviewProse !== candidate.stage2Prose` using plain string equality — Stage 1/Stage 2 inference-receipt identity is never consulted for freshness, and is not touched by this review's fixes.

## Referential integrity proof

Now stronger than at baseline. A canonical `MentionRecord` cannot reference a rejected or nonexistent proposed entity (unchanged, already correct); rejected machine evidence remains in `manifest.sourceMentions`/receipt data for audit but never enters `project.mentions` (unchanged); no rejected entity is silently created to satisfy a mention (unchanged); and — new as of this review — an *admitted-but-renamed* entity's mentions and relationships are correctly remapped rather than either dangling or disappearing.

## Unsupported semantics

No new transition semantics were invented. `thread_advancement` and `reveal_change` still cannot be applied under any decision; the location-typed `entity_proposal` case is still unsupported. Both fixes operate strictly on identity/reference plumbing for the already-supported categories.

## Verification

### RED proof (isolated, not the working tree)

Before either regression test was committed, RED was proven in a disposable `git worktree`
checked out at `7598930` (the pre-fix commit) with *only* the test-file diff applied via
`git apply` — the two production files were left byte-identical to `7598930`, confirmed with
`git diff --stat`/`git status --short` inside the worktree before running anything.
`node_modules` was symlinked in rather than reinstalled; no other state was shared with the
main working tree. Running the suite there failed on the first new test with exit 1, tracing
into the pre-fix `preparePromotion.ts::canonicalizeMentions`:

```text
Error: Mention referential integrity failed: unknown relationship target object_manifest_provisional
    at canonicalizeMentions (.../red-proof-wt/app/src/lib/preparePromotion.ts:325:15)
    at preparePromotion (.../red-proof-wt/app/src/lib/preparePromotion.ts:450:28)
    at testEditedEntityIdentityRemapsItsSourceMentionsRatherThanDroppingThem (.../promotionManifest.test.ts:391:27)
```

The worktree and its symlink were removed afterward; the main working tree was untouched
throughout. This superseded an earlier, less rigorous proof (a same-repo `git stash` of the
two production files) run during initial defect discovery.

### GREEN proof (against commit ae1a0a3)

```text
cd app
npm run test:promotion-manifest     -> "promotion manifest authority regression passed"
npm run test:promotion-integrity    -> clean, no output = pass
npm test                            -> exit 0, all suites pass (incl. both new regression tests)
npm run lint                        -> tsc --noEmit, clean
npm run build                       -> vite build + esbuild bundle, clean
git diff --check ae1a0a3~1 ae1a0a3  -> exit 0, no whitespace errors
```

## Review

Adversarial review performed by a fresh agent instance (no memory of the interrupted authoring session), against the ten attack vectors specified for this task. Two real defects found and fixed as above; eight vectors held. A second read of the corrected source (specifically re-checking for sibling instances of the aliasing pattern in Finding 1) found none.

## Git

```text
Baseline HEAD (review begins):  7598930 "2"
RED commit:                     83040c7 test: cover promotion manifest review defects
GREEN commit:                   ae1a0a3 fix: preserve promoted entity evidence and alias isolation
Docs commit (this report):      docs: close Phase 1 promotion manifest review
Working tree: clean at each of the three commits above.
Pushed: no
```

## Stop condition

Per the Phase 1 brief's §33 statement, Phase 1 is now genuinely complete: the pure Promotion Manifest authority represents machine-proposed semantic changes, binds them to exact editable candidate prose, validates explicit admission decisions, preserves entity/mention referential integrity (including through identity-changing edits), reuses only existing semantic transition rules, atomically produces the next `StoryProject`, and records exactly what was proposed versus admitted — without activating that authority in the React author workflow. Phase 2 has not been started.
