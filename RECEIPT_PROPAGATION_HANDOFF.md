# Receipt Propagation Completion Checklist and Next-Agent Handoff

Status: Active continuation plan

Repository: `/mnt/data-drive/onceaponatime`

> **For Hermes:** Load `test-driven-development` and `architecture-boundary-contracts` before implementation. Execute one bounded RED → GREEN slice at a time. Do not skip the observed RED failure and do not combine the stages below.

## Goal

Carry the exact immutable Hermes execution receipt with every inference-derived candidate so execution metadata is never reconstructed later and no receiptless model output can enter narrative validation or promotion.

The governing chain is:

```text
inference
→ transport/receipt admission
→ structural validation
→ epistemic/domain validation
→ verified candidate
→ explicit acceptance/promotion
→ persistent state
```

The next implementation slice is the additive receipt-bearing interface migration only. It must not make Hermes the default, activate the new interface in `/api/framework/execute`, add operation-aware model routing, change Stage 2 context isolation, or configure research-candidate models.

This boundary matters because the current active pipeline defaults to `GeminiProvider`, which cannot honestly produce a Hermes broker receipt. Requiring a Hermes receipt on that active path without changing the provider would make normal execution unusable; fabricating a Hermes receipt for Gemini would be worse. Therefore the next slice defines and proves the receipt-bearing interfaces additively. Activation and default-provider migration must be one later, separately reviewed vertical slice.

## Normative and research inputs

Read these before editing:

- Normative boundary: `/mnt/data-drive/onceaponatime/HERMES_INFERENCE_CONTRACT.md`
- Raw research trail: `/home/mytruelove/Documents/deep research perchance raw findings.md`
- Architectural synthesis: `/home/mytruelove/Documents/deep research thoughts perchance.md`

Evidence rule:

- Treat the stateless authority split, specialized capability policies, epistemic isolation, and benchmark separation as architectural direction.
- Treat current model names, provider prices, context limits, availability, revisions, and latency as candidates requiring live verification.
- Treat inferred Perchance model ancestry, quantization, hardware, runtime, and sampling values according to their stated evidence level; do not hard-code them as facts.

## Current verified state

### Onceaponatime

Relevant commits:

- `169450d` — raw Hermes inference authority contract
- `be72f4e` — route-attempt receipt semantics
- `fdcd2a5` — focused HermesProvider RED
- `fe11aaf` — strict Hermes transport and immutable receipt admission GREEN

Current implementation:

- `app/server/modelProvider.ts` exports `HermesProvider`.
- `HermesProvider` sends no provider or model selection.
- A completed response is admitted only after strict schema, correlation, output, identity, fallback, and route-attempt validation.
- `InferenceReceipt` and the returned `{ text, receipt }` are frozen at runtime.
- `getModelProvider()` still returns `GeminiProvider`; this is intentional at the current checkpoint.
- `GenerateTextParams.operation` and `GenerateTextResult.receipt` remain optional only for temporary compatibility with the legacy provider path.

Fresh focused verification at this checkpoint:

```text
npm run test:hermes-provider  PASS
npm run lint                  PASS
npm test                      PASS
npm run build                 PASS
```

### Hermes

Relevant commits in `/home/mytruelove/.hermes/hermes-agent`:

- `fbba00829` — raw broker receipt RED
- `ca204d109` — raw broker contract core GREEN
- `9d033d43b` — endpoint/configuration RED
- `c26849bd3` — `POST /v1/inference` GREEN

Important limitation: `operation` is currently an audit label. Hermes still resolves one global primary/fallback route and does not yet map operations to capability policies.

Pre-existing state to preserve: Hermes has an unrelated modified `package-lock.json`. Do not stage, reset, clean, or commit it as part of Onceaponatime work.

## Completion checklist

### Completed foundation

- [x] Onceaponatime/Hermes authority split is normative.
- [x] Hermes exposes authenticated, stateless, tool-less raw inference.
- [x] Onceaponatime can construct a closed Hermes request without selecting provider/model.
- [x] Onceaponatime rejects malformed, mismatched, failed, or unattested Hermes responses.
- [x] Admitted transport results and receipts are frozen at runtime.
- [x] Transport RED and GREEN are separate commits.

### Next bounded slice: additive receipt-bearing interfaces

- [ ] Move the neutral wire/domain `InferenceReceipt` type from `app/server/modelProvider.ts` to `app/src/types.ts`; do not duplicate it.
- [ ] Add generic `InferenceArtifact<T>` and specific `Stage1PlanningArtifact` / `Stage2RenderingArtifact` types in `app/src/types.ts`.
- [ ] Add a `ReceiptBearingModelProvider` interface whose successful result requires an admitted receipt.
- [ ] Keep legacy `ModelProvider` separate and explicitly marked transitional; do not weaken the receipt-bearing interface to accommodate Gemini.
- [ ] Make `HermesProvider` satisfy `ReceiptBearingModelProvider` without changing `getModelProvider()`.
- [ ] Add focused type/runtime tests in `app/tests/receiptBearingInterfaces.test.ts` before production edits.
- [ ] Prove the artifact and receipt are frozen and the exact admitted receipt object is retained.
- [ ] Prove receipt-bearing results cannot be represented without a receipt.
- [ ] Do not modify `narrativePipeline.ts`, `server.ts`, `App.tsx`, or active execution behavior in this slice.
- [ ] Run focused RED, focused GREEN, full tests, TypeScript, and build.
- [ ] Commit RED and GREEN separately.

### Later slices — do not pull these into the next GREEN

- [ ] Stage 1 activation changes the active provider path and receipt propagation together; no active route is left requiring Hermes receipts from Gemini.
- [ ] Stage 1 sends `onceaponatime.stage1.plan`, returns `Stage1PlanningArtifact`, and rejects provider failure without `generateLocalPlan(...)` output.
- [ ] The server and client carry the Stage 1 receipt without reconstruction; the client freezes it again after HTTP deserialization.
- [ ] Stage 1 remains candidate-only and cannot mutate Codex or persistent narrative state before validation and promotion.
- [ ] Stage 2 returns its own `Stage2RenderingArtifact` and distinct immutable receipt.
- [ ] Stage 2 receives only an approved, epistemically filtered scene envelope; hidden world truth is omitted rather than accompanied by a “do not reveal” instruction.
- [ ] Candidate validation carries both Stage 1 and Stage 2 receipts without rewriting either.
- [ ] Acceptance/promotion rejects candidates missing either required receipt.
- [ ] Receipt identities are stored with accepted artifacts and never regenerated from configuration or logs.
- [ ] Hermes maps operation names to capability policies, not hard-coded model names.
- [ ] Capability policy selection remains internal to Hermes.
- [ ] Live evaluation selects models/providers only after current availability, revision, cost, context, latency, and provenance controls are verified.
- [ ] The normal Onceaponatime provider changes from Gemini to Hermes only after receipt-bearing Stage 1 and Stage 2 interfaces are ready.
- [ ] Direct Gemini model selection and fallback ownership are removed from the normal path.
- [ ] Stage 2 deterministic prose fallbacks are removed.
- [ ] Naked benchmark fabricated-success responses are removed.
- [ ] Mention extraction and validation failure paths are audited for receiptless/fabricated success.
- [ ] Full benchmark separates framework obedience, literary quality, and operational performance.
- [ ] Full verification is rerun in both repositories before push/release claims.

## Next slice: exact RED → GREEN work order

### Task 1: Freeze receipt-bearing interface expectations in RED

Objective: Specify shared immutable artifact/provider interfaces without changing the active pipeline.

Files:

- Create: `app/tests/receiptBearingInterfaces.test.ts`
- Modify: `app/package.json`

RED requirements:

1. Import `InferenceArtifact`, `Stage1PlanningArtifact`, `Stage2RenderingArtifact`, and `ReceiptBearingModelProvider` from their intended modules.
2. Construct a receipt-bearing fake provider and require its successful result to contain `{ text, receipt }`.
3. Wrap a normalized plan and prose value with the exact provider receipt; require object identity (`artifact.receipt === providerResult.receipt`) rather than reconstructed equality.
4. Require both artifact and receipt to be frozen at runtime.
5. Include compile-time negative assertions (using `@ts-expect-error`) showing that a receipt-bearing provider result and each inference artifact cannot omit `receipt`.

Run:

```bash
cd /mnt/data-drive/onceaponatime/app
npm run test:receipt-interfaces
npm run lint
```

Expected RED: missing shared artifact and receipt-bearing provider exports. Fixture self-checks should otherwise be valid.

Commit RED separately:

```bash
cd /mnt/data-drive/onceaponatime
git diff --check
git status --short
git add app/tests/receiptBearingInterfaces.test.ts app/package.json
git diff --cached --check
git commit -m "test: require receipt-bearing inference interfaces"
```

### Task 2: Implement the smallest additive GREEN

Objective: Establish one shared receipt vocabulary while preserving current execution behavior.

Files:

- Modify: `app/src/types.ts`
- Modify: `app/server/modelProvider.ts`

Required type relationships:

```text
InferenceReceipt
    broker: "Hermes"
    requestId
    operation
    actualProvider
    actualModel
    fallbackUsed
    fallbackIndex
    routeAttemptCount

InferenceArtifact<T>
    value: T
    receipt: InferenceReceipt

Stage1PlanningArtifact = InferenceArtifact<BeatPlanStage1>
Stage2RenderingArtifact = InferenceArtifact<string>

ReceiptBearingModelProvider
    generateText(...) -> Promise<HermesGenerateTextResult>
```

Rules:

- Move `InferenceReceipt`; do not copy it.
- Keep all receipt fields readonly.
- Keep `broker` fixed to the Hermes literal.
- Keep `HermesGenerateTextResult.receipt` mandatory.
- Have `HermesProvider` explicitly satisfy `ReceiptBearingModelProvider`.
- Preserve the existing runtime `Object.freeze` behavior.
- Do not add cost, tokens, latency, upstream trace IDs, or policy names before the HTTP contract supplies them.
- Do not edit active pipeline/server/client files.
- Do not change `getModelProvider()` in this slice.

Focused and full verification:

```bash
cd /mnt/data-drive/onceaponatime/app
npm run test:receipt-interfaces
npm run test:hermes-provider
npm run lint
npm test
npm run build
```

Commit GREEN separately:

```bash
cd /mnt/data-drive/onceaponatime
git diff --check
git status --short
git add app/src/types.ts app/server/modelProvider.ts
git diff --cached --check
git commit -m "refactor: add receipt-bearing inference interfaces"
```

Do not stage unrelated files or use `git add .`.

### Following activation slice (plan only; do not execute now)

After reviewing the additive interface milestone, activate Stage 1 in a separate vertical RED → GREEN slice. That later slice must change the active provider path and Stage 1 receipt propagation together so `/api/framework/execute` is never left dependent on receiptless Gemini while requiring a Hermes receipt.

## Stop conditions

Stop and report instead of widening the patch if:

- Stage 1 receipt propagation requires changing the Hermes HTTP schema.
- Existing client candidate acceptance cannot carry a receipt without redesigning persistence.
- Tests reveal that plan normalization reconstructs or mutates receipt data.
- A passing test would require making receipt optional on the new Stage 1 artifact.
- The only way to keep tests passing is to retain receiptless local planning as model success.
- The work begins to include Stage 2 filtering, capability routing, model configuration, benchmarks, or default-provider migration.

## Red lines for the next agent

- Do not treat structurally valid Stage 1 JSON as verified narrative truth.
- Do not persist Stage 1 state merely because JSON parsing succeeded.
- Do not synthesize a receipt for Gemini or any receiptless provider.
- Do not infer actual provider/model from configuration.
- Do not turn operation labels into model selectors.
- Do not expose model/provider choice to Onceaponatime.
- Do not send hidden world facts to Stage 2 in this slice.
- Do not modify Hermes `package-lock.json`.
- Do not push unless the user explicitly asks; the user intends to perform the push for this checkpoint.

## Completion report template

The next agent’s report should state:

- RED commit and exact expected failure;
- GREEN commit;
- files changed;
- exact shared receipt, generic artifact, and receipt-bearing provider shapes;
- proof that artifact/provider types cannot omit a receipt;
- proof that the admitted receipt and result remain frozen;
- confirmation that active planning, rendering, server, and client behavior was not changed;
- focused/full test, lint, and build results;
- remaining Stage 2/default-provider/operation-policy work;
- current Git status;
- explicit confirmation that no model/provider configuration and no push occurred.
