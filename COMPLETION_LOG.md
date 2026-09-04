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

**Not yet done:** B2 (deterministic discovery), B3 (structural review UI), B4 (optional AI
refinement). See `TODO.md`.
