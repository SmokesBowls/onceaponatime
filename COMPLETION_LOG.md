# Onceaponatime — Completion Log

Status: living record. Update when a milestone closes; do not rewrite history that already shipped.

This is the chronological record of what has actually been built and verified, with commit
references. For forward-looking work see `TODO.md`. For the normative architecture see
`PROPOSAL.md`, `LITERARY_MECHANICS.md`, and `HERMES_INFERENCE_CONTRACT.md`.

---

## Foundation

- Storytelling framework proposal, identity-neutral entity model, literary mechanics
  (progressive entity discovery, alias resolution, reliability scoring) — `PROPOSAL.md`,
  `LITERARY_MECHANICS.md`.
- Initial Onceaponatime engine: narrative generation pipeline, epistemic knowledge
  boundaries, entity/thread knowledge boundaries, deterministic validation pipeline, Codex
  progressive-memory synthesis (`src/lib/codexEngine.ts`).

## Hermes inference boundary

- `HERMES_INFERENCE_CONTRACT.md` — normative transport/authority contract between
  Onceaponatime and the Hermes inference broker.
- Fail-closed narrative planning when no provider is available
  (`e2099ee`/`5eb6b90`).
- Receipt-bearing inference interfaces: `InferenceReceipt`, `InferenceArtifact<T>`
  (`551ea07`/`60ca887`).
- Hermes Stage 1 (planning) activation: dedicated selector, `onceaponatime.stage1.plan`
  operation, fail-closed on unavailable/malformed output (`19d2403`/`e058820`).
- Hermes Stage 2 (rendering) activation: dedicated selector, `onceaponatime.stage2.render`
  operation, exact receipt propagation, immutable-artifact/editable-review-copy split
  (`7c99cf8`/`32f8b91`).
- Stage 2 rendering envelope narrowing: `Stage2RenderingEnvelope` compiled from the
  approved Stage 1 plan instead of the full broad `GenerationContext` (`4e4f18c`/`dd10ff8`).
- `RECEIPT_PROPAGATION_HANDOFF.md` — governing authority chain and current transitional
  state (still transitional: validator/extraction/naked-benchmark on Gemini, not Hermes;
  see `TODO.md`).

## Promotion Manifest (author-governed canon admission for ongoing generation)

- Promotion integrity baseline (`d0c1670`/`f61c28d`).
- **Phase 1 — domain authority** (`src/lib/promotionManifest.ts`,
  `src/lib/preparePromotion.ts`): manifest/entry/decision vocabulary, atomic
  `preparePromotion()`, freshness binding to exact `stage2Prose`, referential integrity,
  entity-rename remapping (`7598930`/`3dece2e`).
- Independent adversarial review of Phase 1: confirmed 2 real defects (frozen aliases array
  aliased into canon; edited-entity-rename silently dropping its own mentions instead of
  remapping) and fixed both with permanent regression tests
  (`ae1a0a3`/`83040c7`/`fb3e009`, report in git history — superseded by later B1 findings
  as the canonical description of this defect class).
- Story Workbench silent-error fix: execution/promotion/revalidation failures are now
  author-visible instead of console-only (`b389945`).

**Not yet done:** Promotion Manifest Phase 2 (wiring into the live Workbench UI, review
panel, Accept/Reject flow) — never started, out of scope for every slice since. See
`TODO.md`.

## Author Manuscript Intake Baseline

- `AuthorSourceDocument` type, `StoryProject.sourceDocuments?`, `src/lib/manuscriptIntake.ts`
  (`1b6a196`/`9dc8d20`, report: `MANUSCRIPT_INTAKE_ENGINEERING_REPORT.md`).
- Replaces the old hardcoded fake-actor/fake-location "NEW" template with a real
  paste-or-blank intake modal. Schema limitation found and resolved without fabricating
  canon: `activePovActorId`/`currentPosition.location_id` have no "unset" representation,
  resolved with an empty-string sentinel rather than widening the type.

## Source-Only Project Gate

- `src/lib/compositionReadiness.ts`: `assessCompositionReadiness()`,
  `canDispatchFrameworkExecution()`, `describeBeatPosition()` (`377e081`/`fa3225d`).
- Gates Execute Pipeline / Compare-with-Naked-Model on real structural readiness (a
  resolvable POV actor and current location), not on whether `sourceDocuments` exists.
  Fixes the confirmed runtime crash (`POV Actor with ID '' not found in project.`),
  the fake "Beat #1" display, and demo-specific prompt suggestions leaking into
  unstructured projects.

## B1 — Bootstrap Manifest Domain Authority

- `src/lib/bootstrapManifest.ts`, `src/lib/prepareBootstrap.ts`: `SourceEvidenceUnit`,
  `BootstrapProposal` (actor/object/location/faction supported; fact/relationship
  deliberately unsupported), `BootstrapManifest`, `BootstrapAssignments`,
  `prepareBootstrap()` (`cda75e2`/`c4c5361`).
- Independent adversarial review against 10 specified attack vectors: 1 real defect found
  and fixed pre-commit (assignments must resolve an entity's final admitted id, not only
  its original proposed id); 0 further defects found in the dedicated post-GREEN review
  pass (`8aaebe7`).
- Pending-vs-rejected correction: every pending entry (supported *or* unsupported) now
  blocks commit; only an explicit `rejected` is harmless for an unsupported category —
  deliberately stricter than Promotion Manifest's own precedent (`a47e9ab`).
- **Truthfulness + state-coherence closeout** (`c7815f9`/`176ad10`): a full downstream
  audit found that forced schema defaults (`fatigue: 0`/`0.1`, `fear: 0`/`0.1`,
  `certainty: 0.5`, `emotion: 'neutral'`, object `status: 'intact'`) were leaking into the
  Stage 2 model prompt and the Relational Graph UI as if they were authored facts.
  `ActorEntity.current_state`, `ObjectEntity.status`, and the matching
  `GenerationContext`/`Stage2RenderingEnvelope` fields are now genuinely optional; absence
  is omitted from the model prompt entirely and shown as "Not Established" in the UI
  (`src/lib/entityStateDisplay.ts`) rather than defaulted. Found and fixed a real crash
  risk this exposed in already-shipped Promotion code (`preparePromotion.ts`/`App.tsx`
  mutating/reading `current_state` unconditionally). Added two state-coherence invariants
  inside `prepareBootstrap()`: possession reciprocity (`object.current_holder_id` and
  `actor.possessions` can no longer disagree) and POV/current-location coherence (the
  admitted POV actor's own location and the chosen scene location can no longer
  contradict each other).

**Pushed to `origin/main` at `c7815f9`.**

## B2 — Deterministic Bootstrap Discovery

- Frozen RED contract (`7de7497`) and synchronous GREEN implementation
  (`7008fd2`, `src/lib/bootstrapDiscovery.ts`).
- Deterministically processes every `AuthorSourceDocument`, splitting exact source text into
  deliberately non-semantic `SourceEvidenceUnit` paragraph blocks with stable,
  document-qualified offset identities. Repeated identical paragraphs remain distinct evidence;
  identical text in separate source documents cannot collide.
- Produces review-only actor/object/location/faction proposals without mutating source documents
  or canonical project state. Single-token names required by the real material are supported.
- Keeps detector snippets subordinate to exact source spans, excludes unsupported facts and
  generic relationships, and prevents Codex beat/reliability/canonical-prose semantics from
  crossing the B2 adapter boundary.
- Preserves ambiguous cross-kind observations as explicitly ambiguous review metadata rather
  than silently coercing or deleting the defensible candidate. Identity disclosures deduplicate
  provisional actors and retain aliases without automatically selecting a canonical name.
- Discovery confidence is deterministic review information only: classification, number of
  distinct supporting evidence units, and deterministic rule identifiers — never a truth score
  or admission decision.
- Focused B2 tests, adjacent regressions, canonical `npm test`, TypeScript lint, production build,
  `git diff --check`, targeted toxic probes, and final independent review all passed before the
  GREEN commit landed.

**Pushed to `origin/main` at `7008fd2`.**

## B3a — Lossless Bootstrap Review Metadata Handshake

- Frozen the review-metadata contract in `f5feb3d`, closed independent-review gaps in
  `5c164b0`, and completed count/classification/fingerprint invariants in `56cafd8`.
- GREEN (`c9faf14`) preserves B2 `discoveryConfidence` exactly into
  `BootstrapManifestEntry` when supplied while keeping it genuinely optional for legitimate
  manual/non-B2 entries.
- Classification, exact distinct supporting-unit count, and deterministic reason IDs are
  structurally validated and fully participate in manifest review-artifact identity.
- Discovery rationale remains immutable through approve/edit/reject transitions and has no
  admission, ranking, assignment, POV, location, or canonical-application authority.
- Focused and adjacent regressions, canonical `npm test`, TypeScript lint, production build,
  `git diff --check`, direct malformed/coercion probes, and final independent review passed.

**Pushed to `origin/main` at `c9faf14`.**

## B3b — Read-Only Structural Review Presentation

- Frozen the presentation contract in `b816516`; GREEN (`688fc39`) adds a
  `BEGIN STRUCTURAL REVIEW` action to `StoryEditor.tsx`, scoped to when substantive source
  text exists and composition readiness is not established, and a new read-only
  `StructuralReviewPanel.tsx`.
- The existing truthful lock heading, readiness message, and lock detail remain visible
  even inside the opened review surface (its own header re-asserts "Composition Pipeline
  Unavailable" plus "Discovery metadata is review assistance only") -- opening review never
  reads as "composition is now available."
- `BEGIN` creates exactly one deterministic snapshot by reading the existing B2 -> B3a
  `BootstrapManifest` path; `CLOSE` discards it. Neither mutates the project, changes
  composition readiness, nor calls `prepareBootstrap()`. Reopening unchanged source
  reproduces the identical manifest artifact and rendering.
- Every pending entry renders proposal kind, working label, and each separate
  `SourceEvidenceUnit` (exact text, source document ID, unit ID, exact `[start, end)` span)
  without React-side reinterpretation; optional discovery classification/support
  count/reason IDs render exactly from `discoveryConfidence` or state its honest absence.
- The surface exposes `CLOSE REVIEW` and no other control; a static scan of its reachable
  import graph confirms neither `StoryEditor.tsx` nor `StructuralReviewPanel.tsx` imports
  `prepareBootstrap()` or `decideBootstrapManifestEntry`.

**Pushed to `origin/main` at `688fc39`.**

## B2 correction — Discovery-Quality Grammatical-Role Admission

- Trying real, unedited manuscript prose through the newly working B3b review surface
  exposed that B2's admission boundary had two opposite failures, not one: Codex's
  `classifyEntityTypes()` promoted a candidate by testing whether a qualifying verb
  appeared *anywhere in its sentence* (false positives -- "sky", "achievements",
  "tension", "city's energy", "guards"/"people" as agents all wrongly promoted), while
  `observeSingleTokenNames()`'s narrow fixed-verb adjacency list meant real named actors
  and locations (Isla, Ulric, Keen, Ironspire, Falcon Ridge) were discovered *zero* times
  under natural verb choices. Frozen as a RED fixture using the exact supplied passage in
  `8163f21`.
- GREEN (`398033e`) replaces the admission boundary with positional role checks:
  `observeProperNounRoles()` inspects what specifically governs each proper-noun
  occurrence (spatial preposition, place-governing verb, stative-place predicate, or
  agentive-subject verb -- location checked before actor, so an unrelated Codex lexical
  collision like "falcon" -> creature can no longer silently veto "Falcon Ridge");
  `observeCommonNounRoles()` keeps Codex's noun-phrase/head-noun boundaries but discards
  its `primaryType` entirely, requiring both a semantic precondition (head noun is
  person/place/thing-shaped) and positional confirmation before promoting anything.
  `codexEngine.ts` and `codexProgressiveMemory.test.ts` were left untouched throughout.
- An independent adversarial review (fresh context, no exposure to the implementation
  reasoning) confirmed the core architecture is genuinely positional, then found and
  (before this commit) had fixed three real bugs: an appositive-embedded name inheriting
  an unrelated later verb in a compound predicate; several stance/motion verbs
  (`remained`/`stayed`/`continued`/`entered`/`left`/`approached`) being equally
  grammatical with an inanimate subject with no way to flag the resulting uncertainty
  (now split into a strong tier and an ambiguous tier -- a candidate confirmed solely by
  the ambiguous tier with no corroborating strong evidence anywhere in the document now
  carries `classification: 'ambiguous'` instead of false confidence); and an
  order-dependent dedup starvation inherited from calling Codex's candidate extractor once
  per paragraph instead of once per sentence.
- A further adversarial pass (compound subjects, possessive/appositive place-attribution,
  passive voice) found zero additional false positives; three real but safely-failing
  coverage gaps were recorded in `TODO.md` (`35b71d3`) rather than folded into this slice.
- Frozen fixture, original B2 suite, B3a, B3b, Bootstrap Manifest, Bootstrap State
  Honesty, Bootstrap/Promotion Interop, `codexProgressiveMemory.test.ts` standalone,
  canonical `npm test`, TypeScript lint, production build, and `git diff --check` all
  passed before and after the fix.

**Pushed to `origin/main` at `398033e`.**

## B3c — Author Decisions + Explicit Assignments

- Frozen the decision/readiness contract in `96035b7` (pure logic: approve/edit/reject,
  the six-branch review-completeness predicate, immutability, no confidence-based
  auto-deciding) and the workspace/lifecycle contract in `27e9892` (control visibility,
  POV/location selector scoping, the CLOSE-preserves/REOPEN-restores/source-change-stales
  session lifecycle) -- both against real, not-yet-existing surface named in advance.
- GREEN (`1a93177`) adds `src/lib/bootstrapReview.ts` (`assessBootstrapReviewReadiness()`/
  `isBootstrapReviewComplete()` -- "review complete" means only that every entry is
  decided and both assignments resolve to an admitted entry of the correct kind, never a
  prediction of `prepareBootstrap()` success; `decideBootstrapReviewEntry()`, the
  controller that applies a decision through B1's `decideBootstrapManifestEntry()` and
  clears -- never remaps -- an assignment that pointed at what the entry resolved to
  before the decision; `admittedEntityCandidates()`) and `src/components/
  BootstrapReviewWorkspace.tsx` (APPROVE/EDIT/REJECT, REJECT-only for unsupported
  entries, POV/current-location selects, a "Review Complete -- Ready to Apply" banner --
  wrapping the unmodified, still-read-only `StructuralReviewPanel.tsx` for evidence
  display rather than duplicating it).
- `StoryEditor.tsx` owns the mutable review session (manifest + assignments) separately
  from open/closed state, so `CLOSE` hides the workspace without discarding it; `BEGIN`
  only rebuilds when `sourceDocumentsAreIdentical()` (bootstrapManifest.ts's own
  documented primary freshness proof) says the bound source actually changed.
- `prepareBootstrap.ts`'s private `admittedProposal()` was exported as
  `resolveAdmittedBootstrapProposal()` so B3c's readiness/controller and B3d's real
  admission share one resolution function instead of risking drift -- recorded as an
  origin finding in `TODO.md` before GREEN.
- A fresh, independent adversarial review (no exposure to the implementation reasoning)
  targeted assignment invalidation, unsupported-entry controls, source changes, rerender
  stability, repeated decision changes, ID-changing edits, and any path into
  `prepareBootstrap()`. Found and this commit fixed two real, UI-reachable bugs before it
  landed: two entries independently edited to the same working label collided on id with
  no detection (fixed via a collision check at the id-minting site); the controller had
  no defense-in-depth against deciding an unsupported entry (fixed to throw, mirroring
  `resolveAdmittedBootstrapProposal()`'s own guard). Also fixed a doc-vs-implementation
  deviation the review caught: the staleness check compared only a fingerprint where the
  codebase's own documented convention calls for `sourceDocumentsAreIdentical()`.
- Two findings were judged contract holes rather than bugs to silently patch. One was
  judged real enough to close immediately rather than defer: a source change while the
  workspace stayed open (no CLOSE/REOPEN) went undetected until the next `BEGIN` --
  `prepareBootstrap()` would still have caught it at commit in B3d, but the review
  surface was temporarily misrepresenting what it was reviewing. Closed in `ec4431f`
  (frozen RED) / `217d04f` (GREEN, passed on first attempt): `StoryEditor` now derives
  staleness fresh on every render instead of only at `BEGIN`; while stale the artifact
  stays fully visible (never silently discarded) but every authority control is disabled
  and a "Source changed -- regenerate structural review before continuing." banner with
  an explicit regenerate action is the only way to replace it (never silently
  regenerated either). The other -- re-approving an entry after an earlier edit reverts
  to its original proposed value (pre-existing B1 semantics, now documented) -- stays
  deferred; recorded in `TODO.md`. A third, lower-priority note: the reachable-graph
  tests' `prepareBootstrap()` ban is a source-text regex a deliberately obscure re-export
  alias could evade -- nothing today does this.
- Focused decision and workspace/lifecycle tests, B3b presentation, B3a, both B2 suites,
  Bootstrap Manifest, Bootstrap State Honesty, Bootstrap/Promotion Interop, canonical
  `npm test`, TypeScript lint, production build, and `git diff --check` all passed after
  the adversarial-review fixes and again after the staleness closeout.

**Pushed to `origin/main`** (including the staleness closeout through `217d04f`).

## B3d — Atomic Canonical Admission

- Implemented the contract frozen in `50d0e4b` against the committed RED gate in `abe4301`
  without changing `tests/bootstrapApply.test.tsx`.
- `StoryEditor.tsx` now exposes APPLY only for a complete, fresh B3c review, passes the exact
  current manifest and assignments with one click-time timestamp, replaces mutable review controls
  with an applying status while the operation is in flight, and uses an immediate ref guard to
  prevent a second invocation.
- `App.tsx` is the single real `prepareBootstrap()` call site. It passes the current canonical
  project unchanged, performs one full-project `updateActiveProject(nextProject)` only after
  preparation returns successfully, and returns the authority-produced receipt unchanged.
- Success retires the consumed in-memory review session and renders every receipt field from the
  exact returned object. Failure retains the review artifact and routes the thrown message through
  the existing `WorkbenchOperationError` / `WorkbenchErrorNotice` surface with source
  `bootstrap`; no canonical write happens on the failure path.
- Composition readiness remains a projection of the resulting canonical project. No unlocked
  flag, duplicate admission validator, partial entity-write path, or B4/AI behavior was added.
- The required `StoryEditor` callback boundary was propagated into the older B3b/B3c test-fixture
  builders with fail-closed callbacks; the frozen B3d RED file itself remains byte-identical to
  `abe4301`. Async completion is scoped to its originating project/session, and project selection
  clears stale operation errors rather than showing one project's failure on another project.
- Fresh independent spec review passed all 15 B3d requirements. Adversarial code-quality review
  found and drove fixes for the required callback boundary, in-flight review mutation, late
  cross-project completion, cross-project error leakage, and render-phase ref mutation under React
  concurrent rendering; the final re-review reported no remaining critical or important issues.
- Fresh verification passed: focused B3d apply contract; adjacent B3b/B3c, Bootstrap Manifest,
  and composition-readiness contracts; canonical `npm test`; `tsc --noEmit`; production build;
  and `git diff --check`. A self-cleaning ad-hoc React verifier also drove the two review-found
  async cases: review authority controls are unavailable in flight, and a late completion from
  project A neither clears project B's new review session nor displays project A's receipt.

**Committed at `14d86e2`; not yet pushed to `origin/main`.**

## B4a -- Hermes Refinement Artifact Boundary

B4 was split into four independently frozen/RED/GREEN increments (B4a/B4b/B4c/B4d) rather than
one monolithic RED gate, for the same reason B3c was split into decision-logic and workspace/
lifecycle: a single failure would otherwise be hard to localize. B4a is the first increment --
see `TODO.md`'s "B4 split into four increments" and "B4a -- Hermes Refinement Artifact Boundary"
sections for the full contract.

- Frozen the split/scope decision and B4a's own contract in `014e7f2`, then a tiny prose
  correction in `f44d909`: writing the RED gate had already settled on
  `refineBootstrapManifest(baseline, provider?)` with no independent `sourceDocuments` argument
  (since `BootstrapManifest.boundSourceDocuments` is already the exact bound source) -- a
  stronger boundary than the master contract's prose, which still described a two-argument
  signature. Corrected the prose to match before GREEN so there was no discrepancy between what
  was frozen in tests and what was frozen in docs.
- RED (`83ab7b1`) froze `tests/bootstrapRefinementArtifact.test.ts` against two not-yet-existing
  modules -- genuine `ERR_MODULE_NOT_FOUND` RED, matching the B2/B3d precedent -- covering all 15
  points of B4a's contract via injected fake `ReceiptBearingModelProvider`s, no live network call.
- GREEN (`ded2db7`) adds `src/lib/bootstrapRefinement.ts` (pure, browser-safe: types, eligibility,
  a real recursive-descent duplicate-key-detecting JSON parser, closed structural/UTF-16
  coordinate validation, identity-collision detection) and `server/bootstrapRefinement.ts`
  (server-only: prompt construction from `baseline`/`baseline.boundSourceDocuments` alone,
  SHA-256 digesting, `refineBootstrapManifest()` shaped like `planNarrativeBeat()`/
  `renderNarrativeProse()`). Neither file is reachable from B2/B3/B3d (confirmed by RED's static
  reachable-import-graph scan). No additive merge, UI, live HTTP route, or idempotency/retry
  transport was added -- all explicitly deferred to B4b/B4c.
- A fresh, independent adversarial review (no exposure to the implementation reasoning) found and
  this same commit fixed two real bugs before landing: a fixed-key-count check made
  `description_summary` effectively required on every `location_proposal` candidate rather than
  genuinely optional, rejecting an entire refinement output whenever a location candidate
  legitimately omitted it (fixed via a required-vs-optional key check instead of an exact-count
  one); and the hand-rolled JSON parser built parsed objects as plain `{}` literals, so a
  `"__proto__"` key silently reassigned the object's prototype instead of becoming a real own
  property -- invisible to `Object.keys()`/`hasOwnProperty`, evading both duplicate-key detection
  and every downstream exact-key-set check (fixed via `Object.create(null)` for every parsed
  object). Both fixes were verified against the reviewer's exact repro cases.
- Verified: full `npm test`, `tsc --noEmit`, production build, and `git diff --check` all pass. No
  control-byte corruption in either new file (checked byte-for-byte after every edit -- an
  authoring failure mode this slice hit twice while writing escape sequences, caught before any
  gate ran).

**Pushed to `origin/main`** (at `ded2db7`, confirmed synced via a pull/push that happened outside this
log between B4a and B4b).

## B4b -- Refinement Merge

- Frozen the split/scope decision and B4a's contract together in `014e7f2`, a tiny prose correction in
  `f44d909`, then B4b's own narrowed contract in `831a5a4` -- incorporating four hardening
  clarifications before freezing: the baseline-binding requirement (merge only into the exact baseline
  the artifact was produced against, re-checked at merge time, never trusted from B4a), explicit
  baseline-entry field preservation (naming `discoveryConfidence` specifically -- AI refinement must
  never acquire or fabricate B2 detector rationale), exact-identity-only suggestion targeting (never
  label/alias/fuzzy matching), and a clean provenance-ownership split (one manifest-level
  `refinementMetadata` record plus per-entry digest linkage only, never a copied receipt per entry).
- RED (`b81f037`) froze `tests/bootstrapRefinementMerge.test.ts` against two not-yet-existing/
  not-yet-exported boundaries (the whole `src/lib/bootstrapRefinementMerge.ts` module, and
  `bootstrapManifest.ts`'s then-private `expectedEntryId()`) -- genuine `ERR_MODULE_NOT_FOUND`/type
  RED matching the B2/B3d/B4a precedent, covering all 14 points of the frozen RED gate plus the
  baseline-proposal-id collision rule from its prose, against hand-built fixtures (no Hermes call, no
  B4a invocation).
- GREEN (`de787b0`) extends `bootstrapManifest.ts` (the new provenance/metadata types and optional
  fields, the newly-exported `expectedEntryId()`/`fingerprintEntrySources()`, extended structural
  validation, and a fix so `decideBootstrapManifestEntry()` preserves the new fields on the entry
  actually being decided, not just untouched ones) and adds `src/lib/bootstrapRefinementMerge.ts`
  (`mergeBootstrapRefinementArtifact()`). Resolved a real circular dependency in the process (a
  suggestion's provenance names its target's *rebased* id, which needs the manifest id, which needs
  the entries fingerprint, which would include that same reference) by excluding
  `refinesBaselineEntryId` from what gets hashed for suggestions -- lossless, since which entry a
  suggestion targets is already implied by which entry's array it lives in. Also discovered and fixed
  that a zero-candidate merge's rebased entries are byte-identical in content to the baseline's own, so
  without a distinguishing artifact-binding folded into the entries fingerprint, the combined
  manifest's id collided with its baseline's -- defeating "already-merged rejects a stale artifact"
  precisely in that case; fixed via an optional `refinementBinding` parameter on
  `fingerprintEntrySources()` that every existing B1/B2 caller omits (exact prior hash unchanged).
- A fresh, independent adversarial review (no exposure to the implementation reasoning), asked
  specifically to attack replay/double-merge behavior, provenance drift, exact-entry preservation,
  malformed `refinementMetadata`, wrong-kind suggestion targets, evidence citation tampering, and
  fingerprint collisions, found and this commit fixed two real issues before landing: merging a
  *different*, correctly-bound second artifact onto an already-combined manifest silently succeeded
  and dropped every earlier entry's own provenance/suggestions (closed per the master B4 contract's own
  "AI-on-AI iterative refinement is out of scope" rule, both in the merge function and in B4a's
  `isBootstrapRefinementEligible()` for defense in depth); and `validateBootstrapManifestStructure()`
  accepted a nonsensical entry-level `refinementProvenance.refinesBaselineEntryId` that only ever
  belongs inside a `suggestedRefinement`'s own provenance. Both fixes verified against the reviewer's
  exact repro cases. One further observation (intra-artifact duplicate `candidateId` not re-checked by
  B4b) was confirmed to already match the frozen contract's explicit scoping -- collision among
  candidates is B4a's job -- so no change was made for it.
- Verified: full `npm test`, `tsc --noEmit`, production build, and `git diff --check` all pass. No
  control-byte corruption in any touched file (checked byte-for-byte after every edit -- the same
  authoring failure mode B4a hit, caught immediately each time here).

**Pushed to `origin/main`** (at `de787b0`).

## B4a hardening -- baseline structural validation

Found while surveying real integration surfaces for B4c (where a baseline manifest first arrives as
raw, potentially hostile browser JSON): `refineBootstrapManifest()` (shipped in B4a, `ded2db7`) never
called `validateBootstrapManifestStructure(baseline)` itself. Every B4a RED fixture was already
structurally valid by construction, so nothing caught it -- but an authority boundary must never
assume its caller handed it a valid manifest.

- RED (`71c5aed`): `tests/bootstrapRefinementBaselineValidation.test.ts` -- a structurally malformed
  baseline (tampered evidence `exactText`) must reject before the provider is ever invoked (call count
  0); a baseline that is both malformed *and* ineligible (a decided entry) must fail on structural
  validation first, proving check ordering; a genuinely valid baseline still reaches the provider
  exactly once. Genuinely red: the malformed case reached the provider once instead of zero times.
- GREEN (`b24d806`): adds `validateBootstrapManifestStructure(baseline)` as the function's first check,
  before `isBootstrapRefinementEligible()` and before the provider is ever touched.
- Verified: full `npm test`, `tsc --noEmit`, production build, and `git diff --check` all pass.

**Pushed to `origin/main`** (at `b24d806`).

## B4c1 -- REFINE transport + lifecycle

- Drafted against the real current surfaces (`StoryEditor.tsx`'s review-session state and
  re-entrancy-guard pattern, `BootstrapReviewWorkspace.tsx`'s closed prop list, `App.tsx`'s existing
  fetch/`createInferenceArtifact` client pattern, `server.ts`'s route registration order, every
  existing route's plain `express.json()` shape), then revised per three corrections before freezing
  (`efc19eb`): duplicate-key HTTP detection is retained rather than dropped to match older routes
  (explicitly deferred from B4a into B4c, never abandoned); the operation boundary narrows to the
  server running only B4a and returning the artifact, with the client-side B4b merge happening inside
  `App.tsx`'s own `try/catch` (closing a real gap where a merge failure after a successful fetch would
  have escaped the existing error path); and the lifecycle rules became explicit, load-bearing RED
  requirements. A frozen, deliberately-non-taxonomic 400/500 HTTP meaning was pinned alongside it.
- RED (`573f985`) froze two files: `tests/bootstrapRefineLifecycle.test.tsx` (`StoryEditor`'s own
  contract with a mocked `onRefineBootstrap`, genuinely red via a behavioral assertion -- no REFINE
  control existed yet -- not a missing-module placeholder) and `tests/bootstrapRefineTransport.test.ts`
  (the route's transport logic, extracted into a directly-testable `handleBootstrapRefineRequest()`
  mirroring how `server/narrativePipeline.ts` already separates orchestration from `server.ts`'s thin
  routes, since this codebase has no live-HTTP integration test infrastructure).
- GREEN (`fbf06ec`) adds `server/bootstrapRefineRoute.ts` and wires `server.ts`'s new route ahead of
  the app-wide `express.json()`; `App.tsx`'s `handleRefineBootstrap()`; `StoryEditor.tsx`'s REFINE
  state/handler/eligibility expression/button; `BootstrapReviewWorkspace.tsx`'s new `isRefining` prop
  freezing every control; and `workbenchErrors.ts`'s new `'bootstrap-refine'` source. Along the way,
  `isBootstrapRefinementEligible()` was moved from `bootstrapRefinement.ts` to `bootstrapManifest.ts`
  (with a compatibility re-export left behind) because B4a's own already-shipped reachable-import-graph
  test bans `StoryEditor.tsx` from importing `bootstrapRefinement.ts` by module name -- moving the
  predicate to its more natural home let `StoryEditor.tsx` use it without duplicating the logic inline
  or touching that frozen test. A genuine bug in the RED file's own fixture (a `projectId` override
  that was silently ignored, so the late-completion-on-project-switch test never actually switched
  projects) was found and fixed during GREEN, disclosed rather than silently patched.
- A fresh, independent adversarial review (no exposure to the implementation reasoning), asked
  specifically to attack the deliberately-not-unit-tested client seam (HTTP success -> artifact
  reconstruction -> a client-side merge throw -> the same visible refine failure), traced that path
  line by line and found it sound -- every merge failure is a plain synchronous exception inside the
  same `try` as the fetch, caught by the identical `catch`, no unhandled-rejection or bypass path. It
  found and this same commit fixed two real, non-exploitable hardening gaps in
  `BootstrapReviewWorkspace.tsx`: SAVE EDIT/CANCEL/the edit-label input had no `disabled` attribute at
  all (only a passive `useEffect` closed the form after the fact -- fixed with direct `disabled`
  attributes plus switching that effect to `useLayoutEffect`); and REGENERATE REVIEW had no
  `isRefining` guard, unlike CLOSE (fixed, plus a defense-in-depth guard on
  `regenerateReviewSession()` itself). Both were confirmed inert against actual data mutation under
  the app's current reachable UI, closed for consistency ahead of B4c2 adding more surface area.
- Verified: full `npm test`, `tsc --noEmit`, production build, and `git diff --check` all pass.

**Pushed to `origin/main`** (at `fbf06ec`).

## B4b hardening -- suggestion-evidence preservation

Found while inspecting the real manifest shape B4c2 (rendering) would need to consume, before
drafting that contract: `BootstrapSuggestedRefinement` carried only `suggested`/`provenance` -- no
`evidence` field -- even though `mergeBootstrapRefinementArtifact()` already computes the correct,
re-validated `SourceEvidenceUnit[]` for every candidate, additions and suggestions alike. An
addition's own entry kept its copy; a suggestion's construction silently dropped it. "Suggestion
evidence is rendered separately from baseline evidence" was unsatisfiable by any UI as a result.
Closed as its own small slice before B4c2's contract, mirroring the B4a hardening precedent
(`71c5aed`/`b24d806`) rather than folded into B4c2's presentation work.

- RED (`288d5d1`): `tests/bootstrapRefinementMergeSuggestionEvidence.test.ts`, genuinely red at both
  runtime and type-check (10 "Property 'evidence' does not exist" errors). Covers evidence surviving
  the merge exactly; the target entry's own evidence staying byte-for-byte unchanged; suggestion
  evidence staying structurally separate from baseline evidence even citing an identical span;
  tampered suggestion evidence failing structural validation; a changed suggestion evidence span
  changing manifest identity; additions' existing evidence behavior unchanged; and input immutability.
- GREEN (`c50ce9e`): adds the `evidence` field; extracts a shared `assertValidEvidence()` helper
  (verbatim logic, not weakened) applied to both entry-level and suggestion-level evidence;
  extends `fingerprintEntrySources()`'s suggestion projection to include it; and carries the
  already-computed, already-validated evidence forward in both places
  `bootstrapRefinementMerge.ts` constructs a suggestion -- no new extraction, no new derivation.
- A fresh, independent adversarial review traced the multi-candidate/multi-suggestion wiring by hand
  and found no possible evidence/proposal cross-contamination, confirmed the fingerprinting change
  doesn't reintroduce the circular-dependency bug `refinesBaselineEntryId`'s exclusion was built to
  avoid, and confirmed no new derivation logic anywhere. No findings.
- Verified: full `npm test`, `tsc --noEmit`, production build, and `git diff --check` all pass.

**Pushed to `origin/main`** (at `c50ce9e`).

## B4c2 -- render AI additions/suggestions in review

Re-checked against the now-complete manifest shape (`BootstrapSuggestedRefinement.evidence` landed
above) before freezing, per instruction. Its one real blocker was already resolved; nothing else
outstanding.

- Frozen (`85c4021`) with four explicit details pinned before RED: evidence labels preserve
  epistemic origin ("Original proposal"/"Original source evidence"/"B2 discovery rationale/
  confidence" for a deterministic entry; "Suggested values"/"AI supporting evidence"/"Refinement
  provenance" for its suggestions, own container, never visually merged with the entry's own
  blocks); an AI-added entry never renders a generic "confidence unavailable" placeholder for its
  absent `discoveryConfidence` -- that field is intentionally inapplicable, not a detector gap; a
  new frozen RED point requiring B4c2 be strictly projection-only (rendering never mutates the
  manifest or any entry field, asserted by reference/deep-equality before and after a render pass);
  and the pre-existing hardcoded `"Pending author review"` badge quirk stays explicitly out of this
  slice, logged separately rather than fixed as a drive-by.
- RED (`4809f08`) froze `tests/bootstrapStructuralReviewRefinementPresentation.test.tsx` against all
  12 points. `StructuralReviewPanel` is a pure, stateless function of `(manifest, onClose)`, so
  eleven of the twelve points test it directly via `react-test-renderer` with no `StoryEditor`/
  `BootstrapReviewWorkspace` tree at all; only the "APPROVE still decides the real entry" case
  exercises the real, unchanged decision path. Genuinely red behaviorally (no missing-module
  placeholder) with `tsc --noEmit` clean, since neither component needed a new prop.
- GREEN (`2ac1c7f`) touches exactly one file, `StructuralReviewPanel.tsx` -- no
  `BootstrapReviewWorkspace.tsx`, no `StoryEditor.tsx`, no manifest schema change. Passed all 12 RED
  points on the first real run.
- A fresh, independent adversarial review, asked specifically to attack visual/semantic origin
  confusion, evidence leakage, misplacement, and any interactive affordance sneaking into an
  AI-related block, found the confidence-fallback branch structurally unreachable for an AI-added
  entry (verified even against a hand-built manifest violating B4b's own mutual-exclusivity
  guarantee), evidence genuinely non-leaking across both blocks, suggestions correctly scoped to
  their exact target entry, and zero interactive elements anywhere outside the pre-existing CLOSE
  REVIEW button. It found and this same commit fixed two real, low-severity gaps: a shared
  provenance component rendered the identical "Refinement provenance" heading for both an AI-added
  entry's own provenance and a suggestion's, contradicting the frozen contract's two distinct label
  texts (fixed by parametrizing the heading); and the suggestions container guarded only on
  `!== undefined`, not non-empty, so a hand-built manifest with an empty array (never produced by
  the real merge path) would render an empty "AI suggestions" heading with nothing beneath it
  (fixed with an explicit `.length > 0` guard). Neither was a data leak, mutation, or interactivity
  issue.
- Verified: full `npm test`, `tsc --noEmit`, production build, and `git diff --check` all pass.

**Committed at `2ac1c7f`; pushed to `origin/main`.**

**Not yet done at the time:** B4c3 (suggestion selection, undesigned), B4d (End-to-End Authority
Proof). See `TODO.md`.

## B4c3 -- explicit author selection of a suggested edit

Drafted from a real-surfaces-only inspection (no implementation until the contract was reviewed
and frozen), then settled across two review passes: the mechanism itself (`decision = 'edited'`,
`admitted = suggestion.suggested`, plus one new orthogonal `selectedRefinementCandidateDigest`
field) needed zero changes to `resolveAdmittedBootstrapProposal()`, `prepareBootstrap()`, or
`decideBootstrapReviewEntry()`'s assignment-clearing logic; fingerprint scope (pure review state,
excluded from both `entriesFingerprint` and `fingerprintBootstrapAdmission()`, no new
`reviewStateFingerprint` invented); UI placement (`StructuralReviewPanel.tsx` stays permanently
read-only, `BootstrapReviewWorkspace.tsx` gains the compact selection control); and a tightened
controller boundary (`entry.refinementProvenance === undefined` added to the validity iff rule so
a suggestion can only ever be selected against a genuine deterministic/B2 baseline entry, enforced
at B4c3's own boundary rather than merely inherited from B4a/B4b construction; exact-one-match
counting replacing first-match resolution, so a duplicated `candidateDigest` fails closed).

- Frozen (`fce0df9`) with the full authority-semantics/fingerprint-scope/placement/controller-
  boundary contract pinned, including the explicit iff rule for
  `selectedRefinementCandidateDigest` and a 15-point RED gate sketch.
- RED (`5c81f55`, roadmap synced `fab965e`) froze two new files:
  `tests/bootstrapReviewSuggestionSelection.test.ts` (pure decision/identity/authority logic,
  gate items 1-9, 12-14) and `tests/bootstrapReviewWorkspaceSuggestionSelection.test.tsx` (UI
  presentation, gate items 10, 11, 15). Genuinely red via missing-module `SyntaxError` in both,
  confirmed via `tsc --noEmit` that every resulting error traced only to the frozen contract's new
  surface. Two RED-fixture bugs were found and fixed pre-GREEN and during GREEN respectively,
  each disclosed in its own commit (`f60d719`, `a518ae5`) rather than folded silently into a later
  commit.
- GREEN (`c8ed87d`) touches `bootstrapManifest.ts` (`selectedRefinementCandidateDigest` field,
  extended `decideBootstrapManifestEntry()` signature, independent `validateBootstrapManifestStructure()`
  re-derivation, a shared `matchingSuggestions()` helper so the two enforcement points cannot
  drift), `bootstrapReview.ts` (new `selectBootstrapReviewSuggestion()` controller, with its own
  independent `refinementProvenance`/exact-one-match/kind/id checks -- never trusting a
  caller-supplied proposal+digest pair), `BootstrapReviewWorkspace.tsx` (the new required
  `onSelectSuggestion` prop and a compact per-suggestion row whose marker is derived purely from
  manifest state), and `StoryEditor.tsx` (wiring, mirroring the existing `isStale`/`isRefining`
  defense in depth). `StructuralReviewPanel.tsx` is untouched, exactly as frozen. Passed both RED
  gates on the first real run; one already-shipped B4c2 test needed a no-op prop added to keep
  compiling against the new required prop (mechanical ripple, no assertion changed).
- A fresh, independent adversarial review, asked specifically to attack authority bypass,
  entry-scoping bypass, the `refinementProvenance` guard, the exact-one-match guard,
  `stableSerialize()`-as-deep-equality edge cases, fingerprint/identity leakage, UI authority
  leakage, and the `prepareBootstrap()`/`BootstrapReceiptEntry` boundary, found **no production
  authority bypass** -- every claimed guard holds independently at every claimed enforcement
  point. It found and this session fixed two real test-integrity gaps: one RED assertion's
  hand-built fixture still carried a mismatched proposal `id`, so an unrelated defense-in-depth
  check (not the guard the test's own comment claimed) was positioned to catch it first (fixed by
  matching `id` too, then verified by temporarily deleting the guard under test and confirming the
  test still correctly fails closed via a legitimate, contract-required redundant check elsewhere
  -- not dead code); and `validateBootstrapManifestStructure()` only rejected a duplicated
  suggestion `candidateDigest` when a selection happened to be present, not unconditionally (fixed,
  with a new assertion added for the previously-uncovered unselected case). One review claim was
  checked by hand and found not to hold against the actual code (entry-scoping is proven correctly;
  the exact-one-match check runs and throws before the kind check the claim pointed to ever
  evaluates) -- not acted on, and the reasoning recorded in the fix commit (`463e9d0`) rather than
  silently dropped.
- Verified: full `npm test`, `tsc --noEmit`, production build, and `git diff --check` all pass,
  both before and after the adversarial-review fixes.

**Committed at `463e9d0`; pushed to `origin/main` (`6894214`).**

Also runtime-proven live in the app the same day: a real B2 discovery pass (`Keen` as `actor_proposal`,
`Ironspire` as `location_proposal`, each with exact evidence and B2 rationale intact) followed by a real
`REFINE WITH HERMES` call through the now-connected local Hermes gateway (Codex OAuth -> `gpt-5.6-sol`),
producing a genuine B4b-merged manifest with three AI-added entries (`locked chest`, `eastern gate`,
`ancient walls`), each correctly marked `AI-added`/`AI proposal`/`AI supporting evidence`/`AI refinement
provenance` with exact evidence offsets, still `Pending author review`, with the original B2 entries
unchanged. Confirms B4c1/B4b/B4c2 end to end outside the test suite. This run happened to return only
additions, not a `suggestedRefinements[]` entry, so B4c3's `USE THIS SUGGESTION` path is shipped and
test-proven but not yet visually exercised live -- see TODO.md for the plan to try a fresh session.

**Not yet done:** B4d (End-to-End Authority Proof). See `TODO.md`.
