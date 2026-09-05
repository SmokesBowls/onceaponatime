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
B3b — Read-Only Structural Review Presentation  ✅ done, pushed (688fc39)
        ↓
B2 correction — Discovery-Quality Grammatical-Role Admission  ✅ done, pushed (398033e)
        ↓
B3c — Author Decisions + Explicit Assignments  ← next (contract frozen, RED not yet written)
        ↓
B3d — Atomic Canonical Admission
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

### B3b — Read-Only Structural Review Presentation ✅ shipped

**Shipped:** frozen RED contract in `b816516`; GREEN in `688fc39`
(`StructuralReviewPanel.tsx`, `BEGIN STRUCTURAL REVIEW` entry point in `StoryEditor.tsx`).
See `COMPLETION_LOG.md` for the full record. Kept below as the frozen contract this slice
was built against.

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

### B2 correction — Discovery-Quality Grammatical-Role Admission ✅ shipped

Trying real manuscript prose through B3b's review surface exposed that B2's admission
boundary at `bootstrapDiscovery.ts` had two opposite failures at the same seam: an
unrelated noun could inherit sentence-wide action context (false positive), and a
legitimate entity was invisible unless it matched a tiny fixed verb-adjacency list (false
negative). Replaced with deterministic grammatical/semantic role validation: a candidate
is now promoted only when it occupies the relevant syntactic position relative to a
specific governing verb/preposition occurrence, never merely because a qualifying word
appears somewhere in its sentence. `codexEngine.ts` and `codexProgressiveMemory.test.ts`
were left untouched.

**Shipped:** frozen RED contract in `8163f21`
(`tests/bootstrapDiscoveryGrammaticalRole.test.ts`); GREEN in `398033e`
(`observeProperNounRoles()`/`observeCommonNounRoles()` in `bootstrapDiscovery.ts`), with
three real bugs found by an independent adversarial review fixed pre-commit. Known
coverage gaps (compound subjects, possessive/appositive place-attribution, passive voice —
all fail closed, no false positives) recorded below in "Recorded, deliberately deferred."
See `COMPLETION_LOG.md` for the full record.

### B3c — Author Decisions + Explicit Assignments ← next

B3c turns B3b's read-only snapshot into something an author can actually act on, without
touching the atomic admission boundary that belongs to B3d:

```text
read-only BootstrapManifest snapshot
        ↓
AUTHOR REVIEW
  approve / edit / reject
        ↓
fully decided BootstrapManifest
        +
explicit BootstrapAssignments
  POV actor
  current location
        ↓
READY FOR B3d
```

B3c is the author-facing controller for the authority system B1 already built (`BootstrapDecision`,
`decideBootstrapManifestEntry()`, `BootstrapAssignments`), not a new authority layer. It still does
not call `prepareBootstrap()` -- that boundary, the receipt, and canonical admission belong to B3d.

#### B3c authority

MAY:
- approve a pending manifest entry, via `decideBootstrapManifestEntry(manifest, id, 'approved')`;
- reject a pending manifest entry, via `decideBootstrapManifestEntry(manifest, id, 'rejected')`;
- edit a supported proposal, then approve that edited proposal, via
  `decideBootstrapManifestEntry(manifest, id, 'edited', admittedProposal)`;
- explicitly choose `BootstrapAssignments.activePovActorId`;
- explicitly choose `BootstrapAssignments.currentLocationId`;
- preserve the original discovery evidence and `discoveryConfidence` through every transition;
- produce a reviewed `BootstrapManifest` + `BootstrapAssignments` artifact for B3d to consume.

MAY NOT:
- infer POV;
- infer current location;
- auto-approve/auto-decide an entry based on `discoveryConfidence`, support count, or
  `corroborated` status;
- silently reject an unsupported or still-pending entry -- every entry (supported or
  unsupported) still requires an explicit decision, per B1's existing pending-vs-rejected rule;
- mutate canonical `StoryProject` state;
- call `prepareBootstrap()`;
- generate a bootstrap receipt;
- alter `SourceEvidenceUnit` contents or offsets;
- rewrite discovery rationale after an author edit;
- create a parallel decision/assignment type system -- reuse `BootstrapDecision`,
  `decideBootstrapManifestEntry()`, and `BootstrapAssignments` exactly as B1 defines them.

#### B3c truthful UI state

Composition remains locked throughout review, exactly as B3b established; only the final
transition into B3d unlocks it:

```text
Composition Pipeline Unavailable
        ↓
Structural Review
        ↓
author decisions + assignments
        ↓
Review Complete — Ready to Apply
```

Never "Review Complete -> Composition automatically unlocked" -- that transition, and the
canonical state change it implies, belongs entirely to B3d.

#### B3c in-progress review lifetime (design decision, settled before RED)

B3b's `BEGIN`/`CLOSE` deliberately created and discarded a disposable read-only snapshot --
correct for a snapshot with no author work in it. B3c's snapshot accumulates real author
decisions (potentially dozens of approve/edit/reject calls plus two assignments), so the same
discard-on-close behavior would silently destroy that work. B3c changes this on purpose:

```text
BEGIN STRUCTURAL REVIEW
        ↓
working review artifact
        ↓
author decisions persist while project/source identity is unchanged

CLOSE REVIEW
        ↓
hide panel
NOT
destroy author decisions
```

`CLOSE` hides the panel; it does not discard the reviewed manifest or assignments. Reopening
resumes the same in-progress artifact. If the underlying source changes (a different/updated
`AuthorSourceDocument` set -- the same identity B3b's own reopen-produces-the-same-manifest
check already keys on), the review becomes stale and must be regenerated rather than having its
old decisions silently reapplied to different source evidence. This is in-memory session state
lifted above the panel's own mount/unmount, not a durable resume-after-reload feature -- see
hard non-goals.

#### B3c RED gate

Before production changes, commit focused failing tests proving:

1. each pending supported entry exposes exactly `APPROVE`, `EDIT`, and `REJECT` controls;
2. approve calls B1's existing `decideBootstrapManifestEntry(..., 'approved')` and does not
   alter the proposal;
3. reject calls B1's existing `decideBootstrapManifestEntry(..., 'rejected')` and produces no
   admitted proposal;
4. edit requires a structurally valid proposal of the same supported bootstrap kind (reusing
   `isProposalForKind`'s existing enforcement), preserves evidence and `discoveryConfidence`
   unchanged, and records the author-edited proposal through
   `decideBootstrapManifestEntry(..., 'edited', admitted)`;
5. an unsupported entry (`supportedForApplication: false`) cannot be edited or approved into a
   supported category; it still requires an explicit decision before the manifest can be
   B3d-ready;
6. no entry becomes decided merely from `discoveryConfidence`, support count, or
   `corroborated` classification -- decision always requires an explicit author action;
7. POV selection is explicit and must resolve to an actor entry that will actually be admitted
   by the reviewed manifest (approved or edited-and-approved, kind `actor_proposal`,
   `supportedForApplication: true`) -- never a pending, rejected, or unsupported entry;
8. current-location selection is explicit and must resolve to a location entry under the same
   admitted/supported constraint;
9. rejecting or re-editing the entry currently chosen for an assignment invalidates/stales that
   assignment rather than silently remapping it to the new admitted id;
10. a manifest with any pending entry is not B3d-ready;
11. a fully decided manifest missing either required assignment is not B3d-ready;
12. a fully decided manifest with both valid explicit assignments is B3d-ready, but canonical
    project state is still unchanged and `prepareBootstrap()` is never called to determine this;
13. ordinary React rerenders preserve the current in-progress review artifact instead of
    reconstructing decisions from a fresh B2 discovery pass;
14. `CLOSE` hides the review surface without discarding decisions or assignments; reopening
    resumes the identical in-progress artifact; a change in bound source documents makes the
    prior artifact stale rather than silently reused;
15. no reachable B3c path imports or calls `prepareBootstrap()`.

**Origin finding.** No existing predicate answers "is this manifest+assignments combination
ready for `prepareBootstrap()`" independently of calling `prepareBootstrap()` itself (which
throws rather than returning a checkable result, and is off-limits to B3c). RED gate items
10-12 require freezing a new pure, non-mutating readiness predicate over `BootstrapManifest` +
`BootstrapAssignments` before B3c's UI can be built against it -- not a duplicate of
`prepareBootstrap()`'s internal validation, and not a new authority type, just a read-only
projection of decision/assignment state that already exists.

#### B3c hard non-goals

- No `prepareBootstrap()` call, canonical admission, receipt, or mutation; those belong to B3d.
- No durable/disk persistence or resume-after-reload; the review artifact only needs to survive
  `CLOSE` and ordinary rerenders within the live session, not a page reload.
- No AI/B4 work, confidence inference/ranking, schema expansion, Promotion Manifest work,
  facts, relationships, threads, mysteries, or continuity auditing.

### B3d — Atomic Canonical Admission

```text
fully reviewed manifest
        ↓
prepareBootstrap()
        ↓
atomic canonical admission
        ↓
receipt / visible error
```

B3d commits only a complete, explicitly reviewed (B3c-produced) manifest through B1's existing
atomic `prepareBootstrap()` boundary and presents its receipt or error honestly. Contract/RED
gate to be drafted once B3c ships.

### B4 — Optional AI Refinement
- A Hermes operation (e.g. `onceaponatime.bootstrap.refine`), receipt-bearing, following
  `HERMES_INFERENCE_CONTRACT.md`.
- Enters as *another proposal source* feeding B1's manifest — never a replacement for the
  deterministic pass, never establishes truth directly.

## Post-B4 backlog — explicitly not part of B3c/B3d

These are later architectural additions to preserve for future design. They do **not** expand,
compete with, or block B3c/B3d, and they are not part of the B4 implementation slice.

- **Advisory continuity audit.** Add a periodic or on-demand review-and-report operation that
  examines accepted narrative state for possible continuity problems and produces evidence-backed
  findings for author review. It follows B4's authority principle: the audit is another proposal
  source only, never establishes truth directly, never auto-fixes canon, and never mutates canonical
  state as a side effect. Any suggested correction must return through the normal explicit review
  and authority path.
- **Structured pacing state.** Add an explicit schema-level representation for narrative pacing
  and planned progression — e.g. current act, current arc, escalation ladder, open threads, and
  what is approaching or due for payoff. This is distinct from entity state and knowledge
  boundaries: it describes where the story is within its planned dramatic structure, not what is
  objectively true in-world. Treat this as a later schema/design task, not a B3c/B3d extension.

## Recorded, deliberately deferred (found during review, out of scope where found)

- **`src/lib/bootstrapDiscovery.ts`'s role-aware admission (`398033e`) has three known
  coverage gaps**, all confirmed to fail closed (nothing promoted) rather than
  reproducing the false-positive pattern the fix targeted:
  - Compound subjects joined by a conjunction are only half-discovered — the
    agentive-subject check inspects only the word immediately following each
    candidate, so `"Isla and Keen entered Ironspire."` finds Keen but not Isla.
  - Possessive/appositive attribution to a place is not recognized as location
    evidence — `"Ironspire's eastern gate opened."` and `"The city of Ironspire
    welcomed travelers..."` confirm nothing for Ironspire.
  - Passive voice is not resolved — `"Ulric was seen by Keen."` attributes agency
    to neither the grammatical subject (correctly, since it's not the semantic
    agent) nor the true agent in the "by Keen" phrase (a genuine miss).
  Each would require either scanning past a coordinating conjunction to a shared
  verb, recognizing possessive/appositive place constructions, or resolving
  passive-voice agent phrases — real parsing extensions, not adjacency-list
  growth, and not required by the frozen grammatical-role contract. Deferred
  rather than folded into that slice.
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
