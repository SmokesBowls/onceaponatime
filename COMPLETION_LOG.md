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

**Not yet pushed to `origin/main`** (local commits `8163f21`/`398033e`/`35b71d3`).

**Not yet done:** B3c author decisions and assignments, B3d atomic admission, and B4
optional AI refinement. See `TODO.md`.
