# Onceaponatime — TODO

Status: living list. Move an item to `COMPLETION_LOG.md` when it ships; do not delete
history here, strike it through or remove it once logged.

## Immediate roadmap

```text
B1 authority + truthfulness closeout   ✅ done, pushed (c7815f9)
        ↓
B2 — Deterministic Bootstrap Discovery  ← next
        ↓
B3 — Structural Review UI
        ↓
B4 — Optional AI Refinement
```

### B2 — Deterministic Bootstrap Discovery
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

### B3 — Structural Review UI
- The `BEGIN STRUCTURAL REVIEW` entry point in the "Composition Pipeline Unavailable"
  panel (`src/components/StoryEditor.tsx`) — currently there is no button there at all;
  this is the acknowledged UX dead end raised earlier and intentionally not stubbed out
  ahead of B2/B3.
- Show proposals + evidence, approve/edit/reject per entry.
- Explicit POV/current-location picker (never inferred) wired to `BootstrapAssignments`.
- Commits through B1's `prepareBootstrap()` — no new authority logic here.

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
