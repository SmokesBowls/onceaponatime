# Onceaponatime — TODO

Status: living list. Move an item to `COMPLETION_LOG.md` when it ships; do not delete
history here, strike it through or remove it once logged.

## Immediate roadmap

```text
B1 authority + truthfulness closeout   ✅ done, pushed (c7815f9)
        ↓
B2 — Deterministic Bootstrap Discovery  ✅ done, pushed (7008fd2)
        ↓
B3a — Preserve B2 Review Metadata Through Bootstrap Manifest  ✅ done, pushed (c9faf14)
        ↓
B3b — Read-Only Structural Review Presentation  ← next
        ↓
B3c–B3d — Author Decisions + Atomic Admission
        ↓
B4 — Optional AI Refinement
```

### B2 — Deterministic Bootstrap Discovery ✅ shipped
No AI, no mutation of canonical state. Segments an `AuthorSourceDocument` into
non-semantic `SourceEvidenceUnit`s and produces `BootstrapDiscoveryPayload` proposals for
B1 to review.

#### B2 pre-implementation contract

**Detector adapter boundary.** Existing deterministic Codex-era detectors may be invoked
internally, but their output types are not part of B2's public contract. Every detector
result must pass through a bootstrap-discovery adapter that:

- resolves evidence to exact offsets in the original `AuthorSourceDocument.exactText`;
- produces valid `SourceEvidenceUnit`s whose `exactText` equals the referenced source slice;
- maps only defensible B1 proposal categories and preserves ambiguity instead of coercing a
  Codex classification into actor/object/location/faction;
- strips Codex beat, reliability, and canonical-prose semantics from the public result;
- treats detector snippets only as aids for locating evidence, never as evidence records;
- cannot mutate source documents or canonical project state.

Candidate internal detectors from `src/lib/codexEngine.ts` are
`classifyEntityTypes`, `extractNovelEntityCandidates`, `detectIdentityEvidence`,
`detectEntityInteractions`, `extractClaimsFromProse`, `mergeClaims`, and
`isGenericMentionClaim`. Reuse of their implementations does not authorize direct reuse of
their Codex-shaped return values; B2 owns the translation boundary.

**Discovery confidence.** B2 confidence is deterministic review-assistance metadata only.
It must not reuse Codex reliability, detector/model confidence floats, or canonical-beat
counts. It must explain why a candidate is being shown using:

- a classification state (`ambiguous` / `provisional` / `corroborated`);
- the count of distinct supporting `SourceEvidenceUnit`s;
- deterministic rule/reason identifiers.

Confidence must never approve, reject, rank into canon, or otherwise affect admission
automatically. B1's explicit author decision remains the only authority.

**Scope freeze.** B2 discovers plausible bootstrap actors, objects, locations, and factions
from all original manuscript text. It does not add threads, mysteries, generic relationship
graphs, narrative memory, relevance retrieval, AI extraction, or new canonical schemas.
Facts and generic relationships remain unsupported rather than being flattened into a
supported category.

#### B2 RED gate

Before production implementation, commit focused failing tests proving:

1. exact source-slice offsets and stable unit IDs, including repeated identical paragraphs;
2. collision-free evidence across multiple source documents;
3. zero mutation of source documents and canonical project state;
4. single-token names such as Keen, Isla, Ulric, and Ironspire are discoverable;
5. aliases/identity evidence do not create duplicate actors or automatically establish a
   canonical name;
6. character belief or perception is not emitted as objective fact;
7. ambiguous Codex classifications are not silently forced into a supported B1 kind;
8. confidence counts distinct source units rather than repeated matches in one unit and
   reports deterministic reasons;
9. unsupported facts/relationships cannot become applicable B1 entries;
10. empty/whitespace-only inputs produce no proposals, and repeated runs preserve output
    ordering and identifiers.

- Do **not** reuse `computeDistinctEvidenceCount` / `calculateReliability` /
  `synthesizeCodex`'s orchestration — that is Codex reliability (corroboration across
  *canonical* narrative beats), a different concept from bootstrap confidence
  (corroboration across *source* spans). `mergeClaims` mutates its derived claim records and
  hardcodes the word "Beat" in contradiction notes; neither behavior may cross the adapter
  boundary.
- New: a deliberately non-semantic segmentation function (paragraph blocks or stable text
  spans — never called scenes/beats, never exposed as manuscript beats).
- New: an orchestrator plus an explicit discovery-metadata contract carrying B2 confidence;
  `BootstrapDiscoveryEntry` currently has no field for this metadata, so freeze that shape
  in RED before implementing the orchestrator.

### B3a — Preserve B2 Review Metadata Through the Bootstrap Manifest Boundary

**Shipped:** frozen RED contract through `56cafd8`; GREEN metadata handoff in `c9faf14`.

B2 knows why a deterministic candidate was surfaced; B1 knows what the author decided.
B3a closes the loss between those two records before any review UI is built:

```text
B2 EvidenceBackedBootstrapDiscoveryEntry
        ↓ buildBootstrapManifest()
B1 BootstrapManifestEntry
  proposal + evidence + preserved discoveryConfidence? + author decision
```

**Origin finding.** The public `buildBootstrapManifest()` API and existing B1/interop tests
legitimately construct discovery payloads without B2 confidence metadata. No live UI path
currently guarantees that every manifest entry originates from `discoverBootstrap()`.
Therefore `discoveryConfidence` remains required on B2-produced discovery entries but is
optional on `BootstrapManifestEntry`; the builder must preserve it exactly when supplied and
must not fabricate it when absent.

#### B3a RED gate

Before production changes, commit focused failing tests proving:

1. B2-produced entries require discovery confidence, and `buildBootstrapManifest()` preserves
   classification, distinct-support count, and deterministic reason identifiers exactly;
2. legacy/manual/non-B2 discovery entries remain valid without confidence, and the manifest
   leaves that metadata absent rather than inventing it;
3. approve/edit/reject transitions preserve the original confidence byte-for-byte and never
   let an edited proposal rewrite why the detector originally surfaced the candidate;
4. malformed confidence classification, support count, or reason identifiers fail structural
   validation when metadata is present;
5. `supportingUnitCount` equals the number of distinct cited `SourceEvidenceUnit.unitId` values;
6. discovery confidence participates in manifest review-artifact fingerprinting, so different
   discovery reasoning cannot produce the same manifest identity;
7. confidence classification semantics are preserved exactly as B2 supplied them — B3a does
   not infer or reinterpret `ambiguous`, `provisional`, or `corroborated` from the count;
8. confidence alone cannot approve/reject an entry, alter assignments, bypass pending decisions,
   or change which explicit admitted proposal `prepareBootstrap()` applies;
9. two otherwise equivalent, fully author-decided manifests with different valid confidence
   metadata produce the same canonical project result (receipt/manifest identities may differ);
10. building, deciding, validating, and applying remain deterministic and do not mutate source
    documents, discovery payloads, manifests, assignments, or canonical project input.

#### B3a hard non-goals

- No React/UI changes and no `BEGIN STRUCTURAL REVIEW` button yet.
- No new approval, editing, rejection, POV, or current-location interaction surface.
- No automatic call to `prepareBootstrap()` and no canonical project mutation.
- No persistence/resume layer, AI/B4 work, Promotion Manifest changes, facts, relationships,
  schema expansion, or reinterpretation of B2 detector confidence.

### B3b — Read-Only Structural Review Presentation

B3b closes the acknowledged UX dead end without changing authority or readiness:

```text
Composition Pipeline Unavailable
        ↓ BEGIN STRUCTURAL REVIEW
one deterministic BootstrapManifest review snapshot
        ↓ read-only rendering
proposal + separate exact evidence units + preserved discovery rationale
        ↓ CLOSE REVIEW
Composition Pipeline Unavailable
```

`BEGIN STRUCTURAL REVIEW` does not unlock composition. It means composition remains unavailable
and exposes the structure that must be reviewed before it can become canonical. The existing
`assessCompositionReadiness()` gate and its truthful locked heading remain unchanged.

#### B3b RED gate

Before production changes, commit focused failing tests proving:

1. the locked panel exposes an explicit `BEGIN STRUCTURAL REVIEW` action only when substantive
   source text exists and composition readiness is not established;
2. opening review creates one deterministic snapshot by reading the existing B2 → B3a
   `BootstrapManifest` path without mutating the project or changing composition readiness;
3. every pending manifest entry renders in stable manifest order with proposal kind and working
   label presented exactly, without React-side reinterpretation;
4. every `SourceEvidenceUnit` remains separately visible with its preserved `exactText`, source
   document ID, unit ID, and exact `[startOffset, endOffset)` span identity;
5. optional discovery classification, supporting-unit count, and reason IDs render exactly from
   `BootstrapManifestEntry.discoveryConfidence`, never recomputed from evidence in React;
6. manual/non-B2 entries lacking confidence render an explicit honest absence without fabricating
   a classification, support count, or reason;
7. closing and reopening review from unchanged project/source input produces the same manifest
   artifact and rendering, and neither operation mutates the snapshot or caller-owned input;
8. the read-only surface exposes `CLOSE REVIEW` but no approve, edit, reject, POV, location,
   assignment, apply, commit, or admission control;
9. opening, rendering, closing, and reopening never call `prepareBootstrap()`, never change
   project/canonical state, and never change composition readiness.

#### B3b hard non-goals

- No approve/edit/reject decisions; those belong to B3c.
- No POV or current-location assignments; those belong to B3c.
- No `prepareBootstrap()` call, canonical admission, receipt, or mutation; those belong to B3d.
- No persistence/resume layer, AI/B4 work, confidence inference/ranking, schema expansion,
  Promotion Manifest work, facts, relationships, threads, mysteries, or continuity auditing.

### B3c–B3d — Author Decisions + Atomic Admission

- B3c adds approve/edit/reject per entry and explicit POV/current-location assignment, never
  inferred and always represented by B1's existing decision and `BootstrapAssignments` types.
- B3d commits only a complete explicitly reviewed manifest through B1's atomic
  `prepareBootstrap()` boundary and presents its receipt/error honestly.

### B4 — Optional AI Refinement
- A Hermes operation (e.g. `onceaponatime.bootstrap.refine`), receipt-bearing, following
  `HERMES_INFERENCE_CONTRACT.md`.
- Enters as *another proposal source* feeding B1's manifest — never a replacement for the
  deterministic pass, never establishes truth directly.

## Recorded, deliberately deferred (found during review, out of scope where found)

- **`src/lib/preparePromotion.ts`'s `applyAdmittedPossessionChanges`** has the same
  one-sided possession-reciprocity gap B1's `prepareBootstrap.ts` was fixed to close
  (`object.current_holder_id` set without reciprocally updating `actor.possessions`).
  Not reproduced in B1 on purpose; not yet fixed in Promotion Manifest.
- **Pending-vs-rejected semantics diverge between Promotion Manifest and Bootstrap
  Manifest.** B1 requires every entry (supported or unsupported) to be explicitly decided
  before commit; `src/lib/preparePromotion.ts`'s `admittedProposal` still treats an
  unsupported entry left pending the same as rejected (harmless). Deliberate divergence,
  not reconciled — B1's rule was judged stronger and correct for bootstrap's "establish
  the initial world" purpose; whether Promotion Manifest should adopt the same rule is an
  open decision, not made here.
- **Lazy `current_state` materialization still fabricates untouched sibling fields.**
  When a real accepted beat first provides evidence for *one* of fatigue/fear/emotion,
  `preparePromotion.ts`/`App.tsx` now materialize a full `current_state` object (to avoid
  crashing on a bootstrap actor that had none) — but the *other*, still-unevidenced
  fields still get floor/neutral defaults at that moment, a smaller-scoped version of the
  exact fabrication B1's truthfulness pass was built to eliminate. Only a per-field-optional
  redesign of `current_state` would remove this fully; judged too large to fold into the
  B1 closeout.
- **`fact_proposal` and `relationship_proposal` remain unsupported in Bootstrap Manifest**,
  not from oversight: `project.facts[]` membership is displayed as "Established Lore" by
  `CodexView.tsx` regardless of a fact's `status`, and StoryProject has no top-level
  relationship collection at all (only `CodexEntity.relationships`, a derived/read-only
  view, and `MentionRecord.extracted_relationships`, a narrower shape belonging to
  Promotion Manifest's own pipeline). A real fix needs either a new
  `KnowledgeBoundaries`-safe "candidate fact" representation, or a schema decision about
  where reviewed relationships should live.
- **Promotion Manifest Phase 2** (wiring `promotionManifest.ts`/`preparePromotion.ts` into
  the live Workbench UI — review panel, Accept/Reject flow) has never been started. The
  live "Promote to Story Canon" button still uses the old direct-mutation path in
  `App.tsx`.

## Outstanding from `RECEIPT_PROPAGATION_HANDOFF.md` (pre-B1, still true)

- Validator inference (`validateCandidateProse`) migrates away from transitional Gemini.
- Extraction inference (`extractMentionsAndState`) migrates away from transitional Gemini.
- Benchmark inference migrates away from transitional Gemini where appropriate.
- Fabricated naked-benchmark success output (`/api/benchmark/naked-execute`'s hardcoded
  fallback prose) is removed; failures are reported truthfully instead.
- Hermes maps operation names to capability policies (currently audit labels only).
- Live model/provider evaluation only after architecture/capability/provenance/benchmark
  boundaries are ready — current model names, prices, limits, and availability have not
  been verified live.
- HTTP integration coverage for the `/api/framework/execute` Stage 2 artifact round-trip
  (server response shape, validation input, browser-side re-freezing).
- Explicit proof that Stage 2 rendering does not mutate its input `GenerationContext`.

## Not yet decided

- Whether Manuscript Intake should eventually support file upload (`sourceType:
  'uploaded_file'` exists in the type but nothing produces it — deliberately out of scope
  for the intake baseline).
- Whether `StoryProject.activePovActorId` / `currentPosition.location_id` should
  eventually widen to `string | null` for a truly clean "unestablished" representation,
  now that two separate features (Manuscript Intake, B1) have worked around the same gap
  with the `''` sentinel convention.
