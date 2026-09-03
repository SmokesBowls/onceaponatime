# Receipt Propagation Status and Next-Agent Handoff

Status: Active continuation plan

Repository: `/mnt/data-drive/onceaponatime`

Authoritative checkpoint: `7c99cf8fbfeaf1deb160197808ed6a34f6663425` (`feat: activate receipt-bearing Hermes Stage 2`)

A fresh agent must treat repository HEAD as authoritative and inspect current source before editing. Do not recover implementation assumptions from older conversations or from pre-Stage-1 versions of this document.

> **For Hermes:** Load `test-driven-development` and `architecture-boundary-contracts`. Execute one bounded RED → GREEN slice at a time, observe RED before production edits, and keep RED and GREEN in separate commits.

## Governing authority chain

```text
Onceaponatime-owned persistent truth
→ Onceaponatime-built authorized context
→ Hermes raw inference broker
→ admitted model output + exact execution receipt
→ Onceaponatime structural validation
→ Onceaponatime epistemic/domain validation
→ author review and optional edit
→ explicit acceptance/promotion
→ persistent state
```

Hermes attests execution. It does not attest narrative correctness, validation, human edits, acceptance, or canon.

The normative transport and authority contract is:

- `/mnt/data-drive/onceaponatime/HERMES_INFERENCE_CONTRACT.md`

## Current verified milestone

### Completed receipt vocabulary and provider boundary

The following are implemented in `app/src/types.ts` and `app/server/modelProvider.ts`:

- [x] One shared `InferenceReceipt` definition.
- [x] Generic `InferenceArtifact<T>`.
- [x] `Stage1PlanningArtifact = InferenceArtifact<BeatPlanStage1>`.
- [x] `Stage2RenderingArtifact = InferenceArtifact<string>`.
- [x] Production `createInferenceArtifact(value, receipt)` boundary.
- [x] Runtime freezing of the supplied receipt and artifact wrapper.
- [x] Exact receipt identity is retained within a runtime; receipts are not cloned or reconstructed.
- [x] `ReceiptBearingModelProvider` is separate from transitional `ModelProvider`.
- [x] Receipt-bearing calls require an operation label.
- [x] `HermesGenerateTextResult` requires `{ text, receipt }`.
- [x] `HermesProvider` satisfies the receipt-bearing interface and strictly admits the closed Hermes response envelope.

Current shared shape:

```text
InferenceReceipt
  readonly broker: "Hermes"
  readonly requestId
  readonly operation
  readonly actualProvider
  readonly actualModel
  readonly fallbackUsed
  readonly fallbackIndex
  readonly routeAttemptCount

InferenceArtifact<T>
  readonly value: T
  readonly receipt: InferenceReceipt
```

Relevant commits:

- `60ca887` — receipt-bearing interface RED
- `551ea07` — receipt-bearing interface GREEN

### Completed Hermes Stage 1 activation

The active Stage 1 path is:

```text
authorized GenerationContext + author direction
→ planNarrativeBeat(...)
→ getStage1ModelProvider(): ReceiptBearingModelProvider
→ HermesProvider
→ operation "onceaponatime.stage1.plan"
→ admitted { text, receipt }
→ JSON parse + Stage 1 structural normalization
→ createInferenceArtifact(normalizedPlan, exactReceipt)
→ frozen Stage1PlanningArtifact
```

Completed guarantees:

- [x] Stage 1 uses a dedicated Hermes selector, not transitional `getModelProvider()`.
- [x] The exact operation is `onceaponatime.stage1.plan`.
- [x] `planNarrativeBeat()` accepts `ReceiptBearingModelProvider` and returns `Stage1PlanningArtifact`.
- [x] Provider unavailability, provider rejection, and malformed model JSON terminate Stage 1.
- [x] The inference-failure route cannot produce deterministic plausible planning output.
- [x] Repository-wide search established no legitimate non-inference use for `generateLocalPlan()`; it was deleted.
- [x] Stage 1 normalization remains structural and forces `knowledge_verified` and `reveals_protected` to `false`.
- [x] Stage 1 tests prove `artifact.receipt === providerResult.receipt`, runtime freezing, context immutability, and rejection of transitional `ModelProvider`.

Relevant commits:

- `e058820` — Stage 1 activation RED
- `19d2403` — Stage 1 activation GREEN

### Completed Hermes Stage 2 activation

The active Stage 2 path is:

```text
approved Stage 1 plan + current authorized GenerationContext
→ renderNarrativeProse(...)
→ getStage2ModelProvider(): ReceiptBearingModelProvider
→ HermesProvider
→ operation "onceaponatime.stage2.render"
→ admitted { text, receipt }
→ non-empty prose admission at the stage boundary
→ createInferenceArtifact(exactText, exactReceipt)
→ frozen Stage2RenderingArtifact
```

Completed guarantees:

- [x] Stage 2 uses a dedicated Hermes selector, not transitional `getModelProvider()`.
- [x] The exact operation is `onceaponatime.stage2.render`.
- [x] `renderNarrativeProse()` accepts `ReceiptBearingModelProvider` and returns `Stage2RenderingArtifact`.
- [x] The artifact value is the exact admitted non-empty prose; Stage 2 does not trim or rewrite it.
- [x] Provider unavailability, provider rejection, missing output, and empty/whitespace output terminate Stage 2.
- [x] The inference-failure route cannot produce deterministic plausible prose.
- [x] Repository-wide search established no legitimate non-inference use for `generateLocalProse()`; it was deleted.
- [x] Stage 1 and Stage 2 receipts remain distinct objects with distinct request IDs and operation labels when produced by separate inference calls.
- [x] Tests prove exact receipt identity within the server runtime, runtime freezing, fail-closed behavior, and rejection of transitional `ModelProvider`.

Relevant commits:

- `32f8b91` — Stage 2 activation RED
- `7c99cf8` — Stage 2 activation GREEN

## Active execution and receipt propagation

`POST /api/framework/execute` currently performs:

```text
compileGenerationContext(...)
→ Stage1PlanningArtifact
→ stage1Plan = stage1Artifact.value
→ Stage2RenderingArtifact
→ stage2Prose = stage2Artifact.value
→ compileValidationContext(...)
→ validateCandidateProse(stage2Artifact.value, validationContext, stage1Plan)
→ return complete Stage 1 and Stage 2 artifacts
```

Initial validation therefore consumes the original Stage 2 inference text through `stage2Artifact.value`. A successful Stage 2 render is not itself validation or canon.

The response returns:

```text
stage1: Stage1PlanningArtifact
stage2: Stage2RenderingArtifact
validation: ValidationReport
contextPackage: GenerationContext
```

### HTTP and browser immutability boundary

HTTP serialization necessarily breaks object identity across server and browser runtimes. The browser does not claim cross-process identity.

`app/src/App.tsx` reconstructs runtime immutability for each received artifact with `createInferenceArtifact(...)`, passing the exact deserialized receipt object instead of rebuilding its fields:

```text
received Stage 1 value + received Stage 1 receipt
→ browser-frozen Stage1PlanningArtifact

received Stage 2 value + received Stage 2 receipt
→ browser-frozen Stage2RenderingArtifact
```

Within the browser runtime, the reconstructed artifact retains the exact received receipt object.

### Immutable generated prose versus editable review prose

`CandidateGeneration` currently carries:

```text
stage1Artifact: Stage1PlanningArtifact
stage2Artifact: Stage2RenderingArtifact
stage2Prose: string
```

`createCandidateGeneration(...)` initializes:

```text
candidate.stage2Prose = candidate.stage2Artifact.value
```

`stage2Artifact` is immutable inference provenance for the original admitted model output. `stage2Prose` is the separate editable review and promotion copy.

`editCandidateStage2Prose(...)` changes only `stage2Prose` and preserves the exact Stage 2 artifact and receipt references. Post-edit revalidation and promotion operate on `stage2Prose`; the Stage 2 receipt must never be described as attesting human-edited prose.

## Current transitional Gemini uses

`getModelProvider()` still returns `GeminiProvider`. This is intentional and remains separate from the dedicated Hermes Stage 1 and Stage 2 selectors.

Current uses of the transitional general provider are:

- `/api/health` general-provider reporting.
- `validateCandidateProse()` model-assisted validation.
- `extractMentionsAndState()` model-assisted extraction.
- `/api/benchmark/naked-execute` naked benchmark inference.

Additional transitional behavior remains:

- Gemini owns its direct model candidate/fallback list inside `GeminiProvider`.
- Validator model failure falls back to an explicitly unverified deterministic report.
- Extraction model failure falls back to deterministic extraction.
- Naked benchmark unavailability or failure still produces fabricated illustrative prose. This must be removed in a later bounded slice; it is not acceptable as truthful inference success.
- Hermes operation labels are still audit labels. Hermes does not yet map operations to capability policies.

Do not confuse the general health-provider result with the active Stage 1 and Stage 2 provider selections. Both active narrative inference stages now use dedicated Hermes selectors.

## Current epistemic boundary

`compileGenerationContext()` already performs substantial epistemic filtering, including:

- POV-known facts rather than unrestricted world truth;
- POV-filtered entity identities and neutral unknown-entity labels;
- default-deny thread visibility;
- reveal lockbox behavior;
- POV-authorized recent prose;
- bounded Codex entities and continuity constraints.

This means the next slice is not justified by a known secret leak.

However, Stage 2 currently receives the same broad `GenerationContext` used by Stage 1. `renderNarrativeProse()` also serializes it under the literal prompt heading:

```text
FULL AUTHORIZED GENERATION CONTEXT:
${JSON.stringify(generationContext, null, 2)}
```

The context is authorized, but it is broader than the rendering worker needs. “Epistemically safe” and “appropriately scoped to Stage 2” are different properties.

## Next bounded slice: Stage 2 epistemically filtered rendering envelope / context narrowing

Target architecture:

```text
broad authorized planning GenerationContext
→ Stage 1 planning
→ approved Stage 1 plan
→ Onceaponatime compiles a smaller Stage 2 rendering envelope
→ Stage 2 rendering
```

The next slice should establish a purpose-specific, typed rendering envelope compiled by Onceaponatime from the approved Stage 1 plan and already-authorized generation context. Stage 2 should receive only information needed to render that approved plan faithfully.

Before implementation, inspect at least:

- `app/server/contextCompiler.ts`
- `app/server/narrativePipeline.ts`
- `app/server.ts`
- `app/src/types.ts`
- `app/tests/epistemicContextCompiler.test.ts`
- `app/tests/stage1HermesActivation.test.ts`
- `app/tests/stage2HermesActivation.test.ts`
- `app/tests/codexProgressiveMemory.test.ts`

Required direction for the slice:

- RED first; commit RED and GREEN separately.
- Define the rendering-envelope contract before changing Stage 2 prompts.
- Keep the broad authorized `GenerationContext` for Stage 1.
- Compile the rendering envelope inside Onceaponatime after Stage 1 approval.
- Preserve only approved-plan requirements and authorized sensory, spatial, continuity, style/rewrite, and recent-prose material needed for rendering.
- Prove excluded broad planning fields are absent from the Stage 2 provider prompt.
- Prove required rendering facts and continuity constraints remain present.
- Remove the full `GenerationContext` serialization from the Stage 2 prompt.
- Preserve `onceaponatime.stage2.render`, exact Stage 2 receipt propagation, fail-closed rendering, and the immutable-artifact/editable-review-copy split.
- Do not narrow the validator’s governing `ValidationContext`; validation remains independently authoritative and may require information the renderer must not receive.
- Stop rather than invent a schema if the approved plan cannot identify which authorized facts/entities the renderer needs.

The next slice must not be combined with capability routing, provider selection, validator/extraction migration, promotion gating, or persistence changes.

## Non-blocking review follow-ups

The independent Stage 2 review passed with no security or logic errors and identified two useful follow-up proofs:

- [ ] Add HTTP integration coverage for the `/api/framework/execute` Stage 2 artifact round-trip, including server response shape, validation input, and browser-side re-freezing.
- [ ] Add explicit proof that Stage 2 rendering does not mutate its input `GenerationContext`.

These may be included only when they fit naturally within a bounded test slice; they are not permission to broaden unrelated production changes.

## Future milestones — preserve as separate slices

- [ ] Validation carries both Stage 1 and Stage 2 provenance without rewriting either receipt.
- [ ] Promotion rejects candidates missing required Stage 1 or Stage 2 provenance.
- [ ] Accepted artifacts retain receipt identities durably; receipts are never regenerated from configuration or logs.
- [ ] Hermes maps operation names to capability policies while keeping provider/model selection internal to Hermes.
- [ ] Validator inference migrates away from transitional Gemini.
- [ ] Extraction inference migrates away from transitional Gemini.
- [ ] Benchmark inference migrates away from transitional Gemini where appropriate.
- [ ] Fabricated naked-benchmark success output is removed and failures are reported truthfully.
- [ ] Live model/provider evaluation occurs only after architecture, capability policy, provenance, and benchmark boundaries are ready.
- [ ] Current model names, prices, limits, revisions, availability, latency, and provider controls are verified live before configuration claims.

Keep these distinctions explicit:

```text
Stage 1 receipt = planning inference provenance
Stage 2 receipt = original rendering inference provenance
validation       = separate narrative authority
human edit       = separate transformation
promotion        = separate authority
persistent state = separate durable record
```

## Current tests and verification commands

Focused tests:

```text
app/tests/hermesProvider.test.ts
app/tests/receiptBearingInterfaces.test.ts
app/tests/stage1HermesActivation.test.ts
app/tests/stage2HermesActivation.test.ts
app/tests/failClosedProvider.test.ts
app/tests/epistemicContextCompiler.test.ts
app/tests/validationVerification.test.ts
app/tests/codexProgressiveMemory.test.ts
```

Run from `/mnt/data-drive/onceaponatime/app`:

```bash
npm run test:hermes-provider
npm run test:receipt-interfaces
npm run test:stage1-hermes
npm run test:stage2-hermes
npm run test:fail-closed
npx tsx tests/epistemicContextCompiler.test.ts
npx tsx tests/validationVerification.test.ts
npm run lint
npm test
npm run build
```

Then run from the repository root:

```bash
git diff --check
git status --short --branch --untracked-files=all
```

The canonical `npm test` script includes HermesProvider, Stage 1, Stage 2, fail-closed, epistemic-context, validation, and progressive-memory tests. `test:receipt-interfaces` remains a separate focused command and must be run explicitly when receipt interfaces or artifact construction change.

## Stop conditions and red lines

Stop and report rather than widening a slice if:

- the change would require modifying the Hermes HTTP schema;
- a receipt would need to be synthesized, copied, or reconstructed;
- Stage 2 context narrowing would weaken or reuse the independent validation context;
- required rendering data cannot be selected without new narrative-authority rules;
- a passing test would require restoring deterministic inference fallback prose or plans;
- context narrowing would change Stage 1 authorization or activate unrelated Gemini migrations;
- promotion or persistence redesign becomes necessary to complete the rendering-envelope boundary.

Never:

- infer the actual provider/model from configuration;
- treat an operation label as a model selector inside Onceaponatime;
- expose provider/model selection to Onceaponatime callers;
- treat valid model output as verified or canonical;
- claim a Stage 2 receipt attests later human edits;
- push unless the user explicitly asks.
