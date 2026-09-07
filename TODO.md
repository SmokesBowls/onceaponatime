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
B3c — Author Decisions + Explicit Assignments  ✅ done, pushed (1a93177)
        ↓
B3d — Atomic Canonical Admission  ✅ done, not yet pushed (14d86e2)
        ↓
B4 — Optional AI Refinement  ← split into B4a/B4b/B4c/B4d; B4a ✅ done, pushed (ded2db7); B4a hardening ✅ done, pushed (3ab5357); B4b ✅ done, pushed (de787b0); B4c1 ✅ done, pushed (fbf06ec); B4b suggestion-evidence hardening ✅ done, pushed (c50ce9e); B4c2 contract frozen, awaiting RED; B4c3/B4d not started
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

### B3c — Author Decisions + Explicit Assignments ✅ shipped

**Shipped:** frozen RED contracts in `96035b7` (decisions/readiness) and `27e9892`
(workspace/lifecycle); GREEN in `1a93177` (`src/lib/bootstrapReview.ts`,
`src/components/BootstrapReviewWorkspace.tsx`, `StoryEditor.tsx` wiring). An independent
adversarial review found and this commit fixed two real bugs (a duplicate-id collision
between two independently edited entries, and a missing defense-in-depth guard against
deciding an unsupported entry) before it landed. A small closeout in `ec4431f`/`217d04f`
then closed the one finding judged a real gap against stated intent rather than future
coverage: a source change while the workspace stayed open (no CLOSE/REOPEN) went
undetected until the next `BEGIN`. See `COMPLETION_LOG.md` for the full record. Kept
below as the frozen contract this slice was built against.

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
REVIEW COMPLETE
```

B3c is the author-facing controller for the authority system B1 already built (`BootstrapDecision`,
`decideBootstrapManifestEntry()`, `BootstrapAssignments`), not a new authority layer. It still does
not call `prepareBootstrap()` -- that boundary, the receipt, and canonical admission belong to B3d.

**Review complete is not the same claim as admission valid.** B3c can only ever establish that
every entry has an explicit decision and both assignments explicitly resolve to an admitted entry
of the correct kind. It does not, and cannot, predict whether `prepareBootstrap()` will actually
succeed -- deeper domain validation (POV/location coherence, possession reciprocity, and whatever
else `prepareBootstrap()` checks) remains exclusively B3d's to run and B3d may still legitimately
return a domain error after review is complete. Naming and language throughout this section is
chosen to keep that seam visible: "review complete," never "B3d-ready" or "ready to admit."

#### B3c authority

MAY:
- approve a pending manifest entry, via `decideBootstrapManifestEntry(manifest, id, 'approved')`;
- reject a pending manifest entry, via `decideBootstrapManifestEntry(manifest, id, 'rejected')`;
- edit a supported proposal, then approve that edited proposal, via
  `decideBootstrapManifestEntry(manifest, id, 'edited', admittedProposal)`;
- explicitly choose `BootstrapAssignments.activePovActorId`;
- explicitly choose `BootstrapAssignments.currentLocationId`;
- preserve the original discovery evidence and `discoveryConfidence` through every transition;
- produce a reviewed `BootstrapManifest` + `BootstrapAssignments` artifact once review is
  complete, for B3d to attempt to admit -- completeness is not a success guarantee.

MAY NOT:
- infer POV;
- infer current location;
- auto-approve/auto-decide an entry based on `discoveryConfidence`, support count, or
  `corroborated` status;
- render `APPROVE` or `EDIT` on an unsupported entry (`supportedForApplication: false`) --
  `prepareBootstrap()` already throws on an unsupported entry decided `approved`/`edited`
  (see `admittedProposal()` in `prepareBootstrap.ts`), so B3c must never offer a control that
  invites an author into a decision B1 will refuse; an unsupported entry gets `REJECT` only;
- claim or imply that "review complete" predicts or guarantees `prepareBootstrap()` success;
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

"Review Complete" means the author has finished reviewing -- every entry decided, both
assignments explicit and resolved -- not that admission is guaranteed to succeed. Never "Review
Complete -> Composition automatically unlocked": that transition, the canonical state change it
implies, and the possibility of `prepareBootstrap()` legitimately rejecting a complete review all
belong entirely to B3d.

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

#### B3c component architecture (design decision, settled before UI RED)

`StructuralReviewPanel.tsx` stays exactly what B3b built: a read-only presentation component,
forever. B3c does not mutate it into an authority panel -- it introduces a new, separate
component whose job is explicitly different:

```text
StoryEditor
   |
   +-- owns BootstrapReviewSession
   |      manifest
   |      assignments
   |      source identity/fingerprint
   |      open/closed
   |
   +-- when open
          |
   BootstrapReviewWorkspace   <- NEW B3c component
          |
          +-- read-only proposal/evidence presentation
          +-- APPROVE / EDIT / REJECT
          +-- POV assignment
          +-- current-location assignment
```

The mutable review session (manifest, assignments, source identity, open/closed) lives in
`StoryEditor`, above `BootstrapReviewWorkspace`, not inside it -- this is what makes the
settled in-progress-review-lifetime decision above actually hold: `CLOSE` unmounts/hides the
workspace component, but the session state it reads from survives in the parent regardless of
that component's own mount/unmount. Component lifecycle must never become accidental
persistence policy.

Domain decisions stay out of the visual component wherever practical -- the workspace only
translates author intent into a call, it never re-implements B1's authority itself:

```text
UI intent ("author clicked APPROVE")
        |
B3c controller (bootstrapReview.ts pure functions)
        |
B1 decideBootstrapManifestEntry()
        |
new immutable manifest
```

`bootstrapReview.ts` (already required by the RED gate below for
`assessBootstrapReviewReadiness()`) is where this controller logic lives: resolving which
existing entries are eligible POV/current-location targets, and clearing a stale assignment
after its target is rejected or re-edited. `BootstrapReviewWorkspace.tsx` renders what that
logic reports and forwards author clicks to it -- it does not decide anything itself.

EDIT is a bounded field-level transition, not an unconstrained JSON editor: the workspace only
ever exposes the fields that already belong to the entry's existing proposal kind (an actor
edit shows actor fields, a location edit shows location fields, and so on). Same-kind
enforcement remains B1's job (`isProposalForKind`, already exercised in the frozen readiness
tests) -- the bounded field set is a UI-level courtesy on top of that, not a replacement for it.

**The one thing this supersedes.** B3b's own RED test banned `decideBootstrapManifestEntry()`
from the *entire* `StoryEditor`-reachable graph -- correct for B3b's scope, but B3c
intentionally makes it false by wiring `BootstrapReviewWorkspace` in alongside
`StructuralReviewPanel`. That assertion is narrowed, not deleted: it now applies only to
`StructuralReviewPanel.tsx`'s own reachable graph, which must still never reach decision
authority. `prepareBootstrap()` stays banned across the *whole* `StoryEditor`-reachable graph,
unchanged and unnarrowed -- that boundary belongs to B3d regardless of what B3c adds.

```text
B3b read-only panel remains read-only.
B3c introduces a separate review workspace/controller.
The B3b whole-StoryEditor decision-authority ban narrows to StructuralReviewPanel's own
  boundary, not simply deleted.
B3c may reach B1 decision authority (decideBootstrapManifestEntry, BootstrapAssignments).
B3c may never reach B1 canonical-admission authority (prepareBootstrap, receipts,
  canonical StoryProject mutation).
```

#### B3c RED gate

Before production changes, commit focused failing tests proving:

1. each pending **supported** entry exposes exactly `APPROVE`, `EDIT`, and `REJECT` controls;
2. each pending **unsupported** entry (`supportedForApplication: false`) exposes exactly
   `REJECT` -- no `APPROVE`, no `EDIT` -- since `prepareBootstrap()`'s `admittedProposal()`
   already throws on an unsupported entry decided `approved` or `edited`; B3c must never offer
   a control that invites a decision B1 will refuse;
3. approve calls B1's existing `decideBootstrapManifestEntry(..., 'approved')` and does not
   alter the proposal;
4. reject calls B1's existing `decideBootstrapManifestEntry(..., 'rejected')` and produces no
   admitted proposal;
5. edit requires a structurally valid proposal of the same supported bootstrap kind (reusing
   `isProposalForKind`'s existing enforcement), preserves evidence and `discoveryConfidence`
   unchanged, and records the author-edited proposal through
   `decideBootstrapManifestEntry(..., 'edited', admitted)`;
6. an unsupported entry still requires an explicit decision -- it cannot be left pending and
   counted as though it were harmless;
7. no entry becomes decided merely from `discoveryConfidence`, support count, or
   `corroborated` classification -- decision always requires an explicit author action;
8. POV selection is explicit and must resolve to an actor entry that will actually be admitted
   by the reviewed manifest (approved or edited-and-approved, kind `actor_proposal`,
   `supportedForApplication: true`) -- never a pending, rejected, or unsupported entry;
9. current-location selection is explicit and must resolve to a location entry under the same
   admitted/supported constraint;
10. rejecting or re-editing the entry currently chosen for an assignment invalidates/stales that
    assignment rather than silently remapping it to the new admitted id;
11. `isBootstrapReviewComplete()` (or `assessBootstrapReviewReadiness()` -- name to be settled
    at RED, see origin finding below) reports **incomplete** when any entry is still pending;
12. reports **incomplete** when POV is unassigned;
13. reports **incomplete** when current location is unassigned;
14. reports **incomplete** when an assignment resolves to an entry whose decision is `rejected`;
15. reports **incomplete** when an assignment resolves to an entry of the wrong kind (or to no
    entry at all -- an unknown id);
16. reports **review complete** only when every entry is decided and both assignments resolve to
    an admitted entry of the correct kind -- and this result must never be described, tested, or
    documented as predicting or guaranteeing `prepareBootstrap()` success; only `prepareBootstrap()`
    in B3d establishes admission validity;
17. ordinary React rerenders preserve the current in-progress review artifact instead of
    reconstructing decisions from a fresh B2 discovery pass;
18. `CLOSE` hides the review surface without discarding decisions or assignments; reopening
    resumes the identical in-progress artifact; a change in bound source documents makes the
    prior artifact stale rather than silently reused;
19. every decision transition is immutable: the `BootstrapManifest` and `BootstrapAssignments`
    values passed into a decision/assignment operation remain byte-for-byte unchanged afterward
    -- only the newly returned value reflects the change;
20. review completeness is a pure projection only -- it never normalizes, repairs, remaps,
    auto-selects, or otherwise changes the manifest or assignments it is given;
21. no reachable B3c path imports or calls `prepareBootstrap()`.

Items 3-16, 19-21 are pure decision/assignment/readiness logic, frozen in
`tests/bootstrapReviewDecisions.test.ts`. Items 1, 2, 17, 18 depend on the component
architecture above and are frozen separately in `tests/bootstrapReviewWorkspace.test.tsx`
against the new `BootstrapReviewWorkspace` component, once that design was settled.

**Origin finding.** No existing predicate answers even the narrow question "has the author
finished deciding every entry and assigning both roles" independently of calling
`prepareBootstrap()` itself (which throws rather than returning a checkable result, and is
off-limits to B3c). RED gate items 11-16 require freezing a new pure, non-mutating predicate
over `BootstrapManifest` + `BootstrapAssignments` before B3c's UI can be built against it -- not
a duplicate of `prepareBootstrap()`'s internal validation, and not a new authority type, just a
read-only projection of decision/assignment state that already exists.

Naming matters here: this predicate must not be named or documented as anything like
"B3d-ready," "ready for `prepareBootstrap()`," or "admission-ready" -- those names claim
knowledge the predicate doesn't have. `prepareBootstrap()` still owns deeper domain validation
(POV/location coherence, possession reciprocity, and whatever else it checks) that this
predicate never runs. Candidate names to settle at RED: `isBootstrapReviewComplete()` (boolean)
or `assessBootstrapReviewReadiness()` (a richer result carrying which of items 11-15 failed, if
any, mirroring `assessCompositionReadiness()`'s existing shape elsewhere in this codebase).
Either way: **review complete is not the same claim as canonical admission valid.**

**Second origin finding.** Determining whether an assignment id "resolves to an admitted entry
of the correct kind" (items 8, 9, 14, 15) requires the exact same per-entry admission logic
`prepareBootstrap.ts`'s private `admittedProposal()` already implements (decision ->
proposed/admitted/undefined, including the unsupported-entry throw). Reimplementing that
resolution independently in the new readiness predicate would create exactly the kind of
duplicate-authority drift B2/B3a were built to avoid. `admittedProposal()` should be exported
(e.g. renamed `resolveAdmittedBootstrapProposal()`) so both `prepareBootstrap()` and the new
readiness predicate call the identical function -- the readiness predicate catching whatever it
throws and treating that as "does not resolve," never letting the exception escape a pure query.

#### B3c hard non-goals

- No `prepareBootstrap()` call, canonical admission, receipt, or mutation; those belong to B3d.
- No durable/disk persistence or resume-after-reload; the review artifact only needs to survive
  `CLOSE` and ordinary rerenders within the live session, not a page reload.
- No AI/B4 work, confidence inference/ranking, schema expansion, Promotion Manifest work,
  facts, relationships, threads, mysteries, or continuity auditing.

### B3d — Atomic Canonical Admission ✅ shipped

**Shipped:** the frozen contract in `50d0e4b` and RED gate in `abe4301` are GREEN in
`14d86e2`. `StoryEditor.tsx` owns the explicit APPLY action, supplies the exact
live B3c manifest/assignments plus one click-time timestamp, guards re-entrancy, preserves the
review session on failure, retires it on success, and renders the exact returned receipt.
`App.tsx` is the sole `prepareBootstrap()` call site and performs one atomic
`updateActiveProject(nextProject)` only after preparation succeeds; bootstrap failures use the
existing `WorkbenchOperationError` / `WorkbenchErrorNotice` path. No separate readiness flag or
React-side admission validation was added. See `COMPLETION_LOG.md` for verification evidence.

```text
B3c review-complete artifact
manifest + assignments
        ↓
explicit APPLY action
        ↓
prepareBootstrap()
        ↓
        +-- SUCCESS
        |      atomic canonical project result
        |      exact bootstrap receipt
        |      composition readiness re-derived from project
        |
        +-- FAILURE
               canonical project unchanged
               review session retained
               author-visible error
```

B3d commits only a complete, explicitly reviewed (B3c-produced) manifest through B1's existing
atomic `prepareBootstrap()` boundary and presents its receipt or error honestly.

#### The real `prepareBootstrap()` surface (inspected before drafting this contract)

```ts
export function prepareBootstrap(
  project: StoryProject,
  manifest: BootstrapManifest,
  assignments: BootstrapAssignments,
  transactionTimestamp: number,
): PreparedBootstrap
```

Four positional arguments, not three -- the caller must supply `transactionTimestamp`.
`prepareBootstrap()` is deliberately deterministic (never calls `Date.now()` itself, per its own
doc comment), so B3d's APPLY handler is the one place a real wall-clock read belongs.

There is no success/failure result union. Success is a normal return of:

```ts
interface PreparedBootstrap {
  readonly nextProject: StoryProject;
  readonly preBootstrapSnapshot: StoryProject;
  readonly bootstrapReceipt: BootstrapReceipt;
}
```

Failure is a thrown plain `Error` (no custom error class distinguishing failure modes) --
B3d's APPLY handler must be a try/catch around the call, never a `{ success, error }` check.

```ts
interface BootstrapReceipt {
  readonly id: string;
  readonly manifestId: string;
  readonly projectId: string;
  readonly boundSourceDocumentIds: readonly string[];
  readonly boundSourceFingerprint: string;
  readonly admissionFingerprint: string;
  readonly assignments: { readonly activePovActorId: string; readonly currentLocationId: string };
  readonly entries: readonly BootstrapReceiptEntry[]; // entryId, kind, decision, supportedForApplication, proposed, admitted, applied
  readonly appliedEntryIds: readonly string[];
  readonly unsupportedEntryIds: readonly string[];
  readonly resultingProjectFingerprint: string;
  readonly transactionTimestamp: number;
}
```

**What `prepareBootstrap()` already independently re-validates** -- none of this is B3d's or
B3c's to reimplement, and it is exactly why B3c's "review complete" was never allowed to claim
admission validity:

- source-identity staleness, via `sourceDocumentsAreIdentical()` -- the same function B3c's own
  staleness check now uses, so a stale-source race between the UI's check and APPLY is still
  caught here even if the UI's own check somehow missed it;
- duplicate entity ids, checked against *canonical* project state, not just within the
  manifest (`resolveBootstrapIdentities` throws `"...duplicate entity <id>"`) -- B3c's own
  edit-id collision fix only ever checked within one manifest, never against already-canonical
  entities, because it can't see them the way `prepareBootstrap()` does;
- every sub-proposal reference (`initial_location_id`, `initial_holder_actor_id`,
  `member_actor_ids`) resolves to an admitted or already-canonical entity of the right kind;
- POV/current-location coherence (`enforcePovActorLocationCoherence`) -- an admitted POV actor
  whose own `initial_location_id` contradicts the chosen scene location throws. B3c's readiness
  has no equivalent check at all;
- `assessCompositionReadiness(draft)` on the result, defensively, before ever returning it.

**Existing plumbing B3d reuses rather than invents:**

- `App.tsx`'s `updateActiveProject(updated: Partial<StoryProject>)` is already the one place
  canonical project state gets replaced (`onSetPovActor`, promotion, etc. all go through it).
  Passing the full `nextProject` through it is the atomic swap -- no new canonical-state
  mechanism needed.
- `src/lib/workbenchErrors.ts`'s `WorkbenchOperationError`/`workbenchOperationError()` and
  `StoryEditor.tsx`'s existing `WorkbenchErrorNotice` component are already the author-visible
  failure surface for exactly this kind of operation (`execute`/`promote`). `WorkbenchOperationSource`
  needs a third value (e.g. `'bootstrap'`) added, not a parallel error-display mechanism.
- `assessCompositionReadiness()` is already computed from the live `project` prop at the top of
  `StoryEditor.tsx`. Once canonical state is swapped to `nextProject`, that existing computation
  naturally re-derives `ready: true` -- there is no separate "unlocked" boolean to flip.

#### B3d authority

MAY:
- render an explicit APPLY action when (and only when) B3c's review is complete
  (`isBootstrapReviewComplete()`) and not stale;
- call `prepareBootstrap(project, manifest, assignments, transactionTimestamp)` exactly once per
  APPLY click, with the exact current canonical project, the exact B3c-reviewed manifest, and the
  exact B3c assignments -- none reconstructed or approximated;
- on success, replace canonical project state atomically via the existing `updateActiveProject()`
  path, render the returned `bootstrapReceipt` exactly as returned, and retire the now-consumed
  B3c review session (it must not remain applicable a second time);
- on failure, surface the thrown error's message via the existing `WorkbenchOperationError`/
  `WorkbenchErrorNotice` mechanism.

MAY NOT:
- auto-commit on review completion -- APPLY is always an explicit author action;
- enable APPLY for a pending, incomplete, or stale review session;
- reimplement any of `prepareBootstrap()`'s validation in React (staleness, duplicate ids,
  reference resolution, POV/location coherence) -- it is the sole canonical-admission authority;
- mutate canonical project state piecemeal (no per-actor/per-location/per-object writes in UI
  code) -- only the one atomic `nextProject` swap;
- change canonical project state, on any code path, before `prepareBootstrap()` has actually
  returned successfully;
- discard or clear the B3c review session on failure -- the author must be able to see and
  correct their decisions, not start over;
- construct, paraphrase, or partially render the receipt -- only the exact `bootstrapReceipt`
  `prepareBootstrap()` returned;
- flip a separate "composition unlocked" boolean -- unlocking happens only because
  `assessCompositionReadiness()` re-derives `ready: true` from the actual resulting project;
- allow a second APPLY click to fire while the previous one is still being applied.

#### B3d RED gate

Before production changes, commit focused failing tests proving:

1. an incomplete review (per `isBootstrapReviewComplete()`) never renders APPLY as enabled;
2. a stale review (per the B3c staleness check) never renders APPLY as enabled, even if the
   underlying manifest would otherwise read as complete;
3. a complete, non-stale review renders APPLY visible and enabled;
4. an APPLY click calls `prepareBootstrap()` exactly once, never zero, never more than once;
5. the exact current canonical project, the exact B3c-reviewed manifest, and the exact
   B3c assignments are supplied -- none reconstructed, defaulted, or approximated;
6. a successful result replaces canonical project state atomically (one `updateActiveProject()`
   call carrying the complete `nextProject`, not a sequence of smaller mutations);
7. the returned `bootstrapReceipt` is rendered exactly -- no field recomputed, reformatted into
   a different shape, or partially displayed;
8. `assessCompositionReadiness()` on the resulting project reports `ready: true` after a
   successful apply, and nothing in B3d sets any separate unlocked flag to achieve this;
9. a `prepareBootstrap()` failure (thrown `Error`) leaves the pre-existing canonical project
   byte-for-byte untouched;
10. a failure leaves the B3c review artifact (manifest + assignments) fully intact and still
    interactable, not cleared or reset;
11. a failure is visibly reported to the author via the existing `WorkbenchOperationError`/
    `WorkbenchErrorNotice` mechanism, carrying the thrown error's actual message;
12. no code path outside the single `prepareBootstrap()` call site can mutate canonical project
    state as part of the bootstrap flow (static reachable-graph check, mirroring B3c's own);
13. a second APPLY click while the first is still in flight cannot invoke `prepareBootstrap()`
    a second time (an `isApplying`-style guard, mirroring `isGenerating`'s existing pattern for
    Execute);
14. a source change between B3c's own staleness check and the APPLY click is still independently
    rejected by `prepareBootstrap()` itself (`sourceDocumentsAreIdentical()` re-checked inside
    it) -- the UI's own stale-gating is not the only thing standing between a stale source and
    a canonical write;
15. a successful apply retires the consumed B3c review session -- reopening structural review
    afterward starts a genuinely fresh session (a new `discoverBootstrap()` pass against the
    now-different canonical state), never re-offering the same manifest for a second APPLY.

#### B3d prop boundary (design decision, settled before RED)

B3c's `BootstrapReviewSession` (manifest + assignments) deliberately lives in `StoryEditor`, not
`App.tsx` -- unlike `candidate` (Promotion Manifest's review-and-decide state), which already
lives in `App.tsx` and reaches `StoryEditor` only as a prop. B3d does not retroactively lift B3c's
session to match that older pattern; the actual `prepareBootstrap()` call, and the canonical
`updateActiveProject()` write, still belong exclusively to `App.tsx` (the only place the
`projects` array lives), so the boundary must pass the reviewed artifact *down* to that call
instead of pulling session state *up*:

```ts
onApplyBootstrap: (
  manifest: BootstrapManifest,
  assignments: BootstrapAssignments,
  transactionTimestamp: number,
) => Promise<BootstrapReceipt>
```

`StoryEditor` generates `transactionTimestamp` (`Date.now()`) at the moment APPLY is clicked --
the one deliberate non-determinism this whole chain has, isolated to that single call site. Its
handler guards re-entrancy (`isApplyingBootstrap`), and on the resolved promise clears
`reviewSession`/`isReviewOpen` and stores the receipt for display; on rejection it does nothing
UI-wise itself and leaves the session untouched -- `App.tsx`'s implementation is the one that
calls `setWorkbenchError(workbenchOperationError('bootstrap', err))` before rethrowing, so the
failure reaches the screen through the exact same `workbenchError` prop and `WorkbenchErrorNotice`
render branch execute/promote already use, just gated on `source === 'bootstrap'` instead. No new
error-carrying prop, no new display component.

#### B3d hard non-goals

- No new validation logic duplicating any check `prepareBootstrap()` already performs.
- No partial/piecemeal canonical mutation path, in this slice or reachable from it.
- No new receipt display mechanism -- reuse the existing `WorkbenchOperationError`/
  `WorkbenchErrorNotice` pattern, extending `WorkbenchOperationSource` with one new value.
- No B4/AI work, no schema expansion, no changes to `prepareBootstrap()` itself beyond what
  B3c's own `resolveAdmittedBootstrapProposal()` export already required.

### B4 — Optional AI Refinement  ← contract draft; not frozen, no RED/implementation yet

#### B4 split into four increments (design decision, settled before B4a RED)

The rest of this section is the master B4 contract, frozen as one document. Implementation
does not proceed as one RED gate against it, for the same reason B3c was split into
decision-logic and workspace/lifecycle: a single monolithic RED makes any later failure hard
to localize. B4 is split into four independently frozen/RED/GREEN increments, each building
only on the previous increment's *shipped* public boundary, never on its implementation
choices beyond that boundary:

```text
B4a — Hermes Refinement Artifact Boundary
  request construction, exact source/review inputs, receipt-bearing inference,
  raw response validation, deterministic IDs/digests, fail-closed malformed/
  unavailable output. Produces exactly one artifact and stops:
  Hermes raw output -> validate -> BootstrapRefinementArtifact.
  No additive merge, no UI, no B3 review integration.
        ↓
B4b — Refinement Merge
  additional proposals / suggested edits additively merged into bootstrap review
  material; provenance preserved; collisions/duplicates handled deterministically;
  original B2 proposals never rewritten in place; no author decisions transferred
  or invented.
        ↓
B4c — Optional Refinement UI + Lifecycle
  explicit REFINE action, loading/error state, source/review staleness, repeated-
  refinement behavior, no automatic invocation; resulting proposals return through
  the same B3 review controls.
        ↓
B4d — End-to-End Authority Proof
  B2 -> optional Hermes refinement -> B3 review -> B3d prepareBootstrap, proven
  together against the real wired surfaces (not fresh mocks).
```

Each increment gets its own narrowing pre-implementation note below (where it turns the
master contract's prose into exact file/function/type names) and its own RED gate. The
master contract above/below remains the authority both increments answer to; an increment's
note may narrow scope (defer a piece to a later increment) but may never contradict it.

#### Purpose

B4 may ask Hermes for one optional, receipt-bearing refinement pass over a freshly generated,
still-undecided deterministic bootstrap manifest. Its output is an additional proposal artifact
that Onceaponatime validates and additively merges as new proposal entries and/or suggested edits in
the same B1 `BootstrapManifest` consumed by the existing B3 review workspace.

```text
B2 deterministic discovery
        ↓
deterministic pending BootstrapManifest
        ↓
explicit optional REFINE WITH HERMES
        ↓
receipt-bearing refinement proposal artifact
        ↓
Onceaponatime validation + additive merge
        ↓
one combined pending BootstrapManifest
        ↓
same B3 review authority
        ↓
author approve / edit / reject
        ↓
same B3d atomic canonical admission
```

The invariant is:

```text
AI refinement = another proposal source

AI refinement != canon
AI refinement != replacement for B2
AI refinement != automatic approval
AI refinement != direct mutation
AI refinement != a second review or admission path
```

#### Inspected existing surfaces this design must preserve

- `discoverBootstrap(project)` is the deterministic, non-inference B2 producer. It returns
  evidence-backed `BootstrapDiscoveryPayload` data and does not mutate the project.
- `buildBootstrapManifest(project, discovery)` is B1's pure manifest builder. It binds the complete,
  ordered source-document snapshot, starts every entry at `pending`, fingerprints proposal/evidence
  content, and deep-freezes the result.
- `BootstrapReviewWorkspace` plus `bootstrapReview.ts` own the one B3 author-decision and assignment
  flow. They do not prepare or mutate canonical project state.
- `prepareBootstrap()` remains the sole atomic canonical admission boundary.
- `HermesProvider` is server-side, provider/model-neutral, receipt-bearing, and fail-closed under
  `HERMES_INFERENCE_CONTRACT.md`. The browser must not call Hermes directly.
- `InferenceArtifact<T>` and `InferenceReceipt` are the existing shared receipt vocabulary. B4 must
  reuse them rather than create a bootstrap-only execution-receipt shape.

#### Entry point and eligibility

- B2 always runs first and produces the baseline deterministic manifest. Hermes never replaces,
  suppresses, edits, reorders, or re-runs B2.
- Refinement is explicit and optional. No project load, source import, `BEGIN STRUCTURAL REVIEW`,
  regeneration, or APPLY action may invoke Hermes automatically.
- `REFINE WITH HERMES` is available only while the current review session is fresh, every manifest
  entry is still `pending`, both assignments are `null`, and that exact deterministic baseline has
  not already completed a refinement pass.
- A baseline with zero deterministic entries is still eligible: Hermes may propose evidence-backed
  additions from the bound source text. It still receives a real deterministic baseline manifest,
  not a bypass around B2.
- Once any author decision or assignment exists, refinement is unavailable for that session. The
  author may explicitly regenerate a fresh deterministic review session to discard work and begin
  again; B4 does not silently reset author decisions.
- At most one successful refinement artifact may be merged into one baseline manifest. Failure may
  be retried against the exact unchanged baseline. AI-on-AI iterative refinement is out of scope.

#### Hermes request boundary

- The exact operation label is `onceaponatime.bootstrap.refine`.
- A dedicated `ReceiptBearingModelProvider` selector may route this operation to `HermesProvider`;
  it must not use the transitional receipt-optional `ModelProvider`/Gemini path.
- The browser route request is a closed envelope containing only schema version, project ID, exact
  current source documents, exact baseline manifest, the two explicitly null assignments,
  `refinementSessionId`, retry ordinal, and idempotency key. It does not send the rest of
  `StoryProject` or any canonical collections to Hermes or the model-visible prompt.
- The server-side refinement function receives the immutable baseline `BootstrapManifest` and an
  injectable receipt-bearing provider. It independently validates manifest structure and requires
  every baseline entry to be `pending` with no `admitted` value before provider invocation.
- The B4 route treats both browser JSON and model text as hostile. Before invocation it recursively
  validates an exact-key-set baseline request (including nested proposals/evidence/source documents),
  exact project/manifest/source identity, size/count bounds, pending-only state, null assignments,
  and a non-hash review-session generation token. Existing permissive B1 guards are insufficient as
  the sole HTTP-boundary parser and must not be represented as closed validation.
- The B4 route is registered with a route-specific raw `application/json` body parser before the
  app-wide `express.json()` decoder so duplicate request keys and invalid UTF-8 are still observable.
  It rejects duplicate keys at every nesting level, trailing JSON values, and bodies over the existing
  15 MiB transport cap. Within that cap, v1 accepts at most 128 current/bound source documents, 10,000
  baseline entries, 64 evidence units per baseline entry, and 64 aliases per baseline proposal; it
  checks safe-integer counts/offsets before loops or allocation. These are operation admission limits,
  not truncation rules: an over-limit baseline fails visibly before Hermes runs.
- The model-visible request contains only the exact bound source documents and the baseline's
  deterministic proposal/evidence/rationale data needed for this task. It contains no canonical
  mutation command, author decision, assignment, provider/model selection, credential, project
  filesystem access, tool, skill, memory, or agent-session capability.
- The request tells the model that source text is evidence, deterministic entries are proposals,
  and its output is untrusted proposal material. Model prose, confidence, or rationale cannot
  approve an entry or claim narrative truth.
- Provider unavailability, failed/partial responses, malformed JSON, receipt-operation mismatch, or
  operation-specific validation failure rejects the entire refinement attempt. There is no local,
  deterministic, or plausible-looking fallback refinement.
- Raw model bytes are parsed with duplicate-key-detecting JSON machinery before ordinary object
  construction; `JSON.parse()` alone is not sufficient. The top-level key set is exactly `schema`,
  `baseline_manifest_id`, `bound_source_fingerprint`, and `entries`.

Each deterministic review session receives a cryptographically random `refinementSessionId` used
only for operation correlation, never narrative identity. Each server attempt uses an idempotency key
derived from that token and an explicit retry ordinal. A network timeout or ambiguous disconnect
reuses the same key; the server returns/awaits the same in-flight or completed artifact and rejects
the same key with different request bytes. Only an explicit terminal provider/validation failure may
advance the retry ordinal against the unchanged baseline. The server keeps in-flight/completed
reservations for its process lifetime; restart-level durable idempotency is out of scope and must not
be claimed. "At most one success" means one artifact accepted into that live review session: client
attempt/project/source tokens make any later competing result inert even if an upstream call ran.

#### Raw model output and operation-specific validation

The model returns one closed JSON value with:

```text
schema = "onceaponatime.bootstrap.refinement.v1"
baseline_manifest_id = exact input manifest id
bound_source_fingerprint = exact input source fingerprint
entries = [] | one or more refinement candidates
```

Each raw candidate contains only:

```text
kind = actor_proposal | object_proposal | location_proposal | faction_proposal
working_label = non-blank proposed label
name = string | null
aliases = string[]
refines_entry_id = exact baseline entry id | null
evidence = one or more { source_document_id, start_offset, end_offset }

location_proposal alone may also contain:
description_summary = non-blank string, or the key is absent
```

Rules:

- B4 adds no proposal category and cannot make `fact_proposal` or `relationship_proposal`
  applicable. Unsupported/unknown kinds reject the whole output.
- This first B4 slice deliberately excludes topology-bearing proposal fields:
  `initial_location_id`, `initial_holder_actor_id`, and `member_actor_ids`. AI additions cannot
  create actor/location, holder, membership, canonical, or AI-to-AI reference edges. A later slice
  would need its own reference-handle and author-review contract.
- The model does not supply manifest-entry IDs, proposal entity IDs, canonical entity authority,
  decisions, assignments, `supportedForApplication`, copied `exactText`, evidence-unit IDs,
  fingerprints, digests, or receipts. `refines_entry_id` is a comparison target selected from IDs
  the request displayed; it is not a model-owned identity and grants no mutation authority.
- Offsets are zero-based, half-open JavaScript UTF-16 code-unit offsets, matching B1's existing
  `String.slice()` replay semantics. They are not UTF-8 byte offsets or Unicode-scalar indices.
- Onceaponatime resolves every evidence coordinate against the exact baseline-bound source string,
  deterministically derives `exactText` and evidence-unit identity, and rejects unknown documents,
  unsafe/non-integral/out-of-range offsets, `end_offset <= start_offset`, exact duplicate spans
  within one candidate, and spans containing no Unicode letter or number. Overlapping non-identical
  spans and reuse of a span by different candidates are preserved, not silently coalesced.
- This proves a source-bound citation, not semantic entailment. Every candidate must retain at least
  one such citation for the author to judge; no uncited "helpful" proposal is admitted.
- `refines_entry_id !== null` must name one baseline deterministic entry of the same proposal kind.
  It becomes an immutable *suggested edit* attached to that baseline entry, not a second manifest
  entry and not an in-place rewrite. The baseline `proposed` value stays unchanged. The existing B3
  author may explicitly choose the suggestion through the existing `edited` decision, further edit
  it, or ignore it and approve/reject/edit the deterministic proposal normally. B4 never chooses.
- `refines_entry_id === null` means an additional ordinary manifest proposal. Onceaponatime derives
  a distinct proposal entity ID; model-supplied identity is never trusted. Duplicate/colliding AI
  additions reject the whole refinement artifact rather than silently merging entities.
- A suggested edit keeps the referenced proposal's existing entity ID inside suggestion metadata.
  It does not create a duplicate proposed entry, avoiding B3d's deliberate rule that duplicate
  *proposed* entity IDs fail even when one duplicate was rejected.
- The strict parser accepts exactly the common keys above plus `description_summary` only for a
  location. `name` and `refines_entry_id` are required but nullable; `aliases` and `evidence` are
  required arrays; `description_summary` is absent or a string, never `null`. Unknown or duplicate
  JSON keys, wrong primitive/container types, and non-finite numbers reject the whole raw output.
- Resource limits are part of v1: raw UTF-8 output at most 262,144 bytes; at most 64 candidates;
  1–8 evidence spans per candidate; at most 16 aliases; `working_label`, non-null `name`, and each
  alias 1–200 UTF-16 code units after trimming; `description_summary` 1–2,000 UTF-16 code units after
  trimming. Labels/names/aliases reject C0/C1 control characters; description text may contain TAB,
  LF, and CR but no other C0/C1 controls. Exact accepted strings are preserved after validation—no
  hidden case folding, Unicode normalization, trimming, or semantic rewriting.
- An empty `entries` array is a valid completed refinement with a real receipt and means "Hermes
  proposed no admissible additions or suggested edits." It does not erase the deterministic baseline.

Onceaponatime computes SHA-256 over a versioned, length-prefixed UTF-8 encoding of the exact baseline
source snapshot plus each validated candidate's ordered keys/values and evidence coordinates. No
locale-sensitive serialization or object-key enumeration order participates. The full 64-hex digest
is the candidate identity and artifact binding. Additional proposal IDs are
`bootstrap_ai_<kind>_<first-32-hex>`; B4 evidence-unit IDs are
`source-unit:b4:<first-32-hex-of-document-id/offsets/exact-text-digest>`. Full digests are retained
beside shortened display/application IDs, and any shortened-ID collision with a baseline proposal or
another candidate fails closed. Existing B3d identity validation remains responsible for detecting
collisions with current canonical state at admission. Exact encoding vectors must be frozen in B4 RED
before GREEN. Legacy B1 FNV identities remain compatibility labels, never security evidence; B4
always checks exact structural equality and the full digest where hostile model material is bound.

#### Receipt-bearing refinement artifact

The server-side operation returns:

```ts
type BootstrapRefinementArtifact = InferenceArtifact<BootstrapRefinementPayload>;
```

- The exact `InferenceReceipt` returned by Hermes is retained in the frozen artifact and its
  `operation` must equal `onceaponatime.bootstrap.refine`.
- `operation` is a caller-owned request invariant copied into the receipt by `HermesProvider`; the
  current broker response does not echo or attest it. Broker/model/request/fallback fields remain
  broker execution metadata and must pass the normative Hermes envelope checks.
- The normalized payload remains proposal-only. A successful transport receipt proves only which
  route executed, not that any candidate is valid, approved, or canonical.
- Browser HTTP deserialization may reconstruct runtime freezing using `createInferenceArtifact()`,
  as the existing Stage 1/Stage 2 boundary does; it may not rebuild or reinterpret receipt fields.
  Because `createInferenceArtifact()` currently freezes only the wrapper and receipt, B4 must first
  independently deep-freeze the entire normalized payload and every nested candidate/evidence value.
- The artifact carries a full SHA-256 `rawOutputDigest` over the UTF-8 encoding of the exact output
  string returned by the provider (not the original HTTP response bytes, which are unavailable after
  envelope decoding), and each normalized candidate carries its full `candidateDigest`. A full
  `artifactDigest` binds the schema, exact baseline/source identities, ordered candidate digests,
  raw-output digest, and exact receipt fields using the same versioned length-prefix encoding. These
  are Onceaponatime bindings, not broker attestations. The same receipt plus different output is a
  different artifact and cannot substitute candidates during review or admission.
- The review session retains the operation-level artifact even when `entries` is empty so the author
  can see that refinement ran and inspect truthful execution provenance.

#### Additive merge into the existing manifest

- A pure Onceaponatime-owned merge/normalization boundary consumes the exact baseline manifest and
  exact validated refinement artifact. It mutates neither input.
- Before merging, it revalidates baseline structure, receipt operation, baseline manifest ID, bound
  source fingerprint, exact bound source documents, pending-only state, and candidate citations.
- The combined manifest is rebuilt under B1 identity rules because its source-entry projection has
  changed. Current B1 entry IDs embed the containing manifest ID, so every deterministic entry ID is
  necessarily rebased. The merge retains an immutable one-to-one `baselineEntryId -> combinedEntryId`
  map, derived by original kind/sourceIndex/order, and validates both sides. No author decision exists
  yet, so no decision or assignment identity is migrated.
- Apart from the required manifest/entry-ID rebase and addition of immutable suggestion/provenance
  metadata, every baseline entry's kind, `sourceIndex`, proposal, evidence, confidence metadata,
  `supportedForApplication`, pending decision, and absent admitted value remains structurally equal
  and in the same relative order. B4 may not rewrite or suppress those semantic fields in place.
- Normalized AI *addition* entries are appended in one deterministic order as ordinary pending,
  application-supported `BootstrapManifestEntry` values. Normalized *suggested edits* attach to the
  rebased deterministic target entry as non-decision metadata and do not become duplicate entries.
- The existing B3 vocabulary remains `approved | edited | rejected`. Choosing a suggested edit is an
  explicit B3 `edited` decision that records `selectedRefinementCandidateDigest`; it is never an
  automatic decision. Ordinary manual edit leaves that field absent. Subsequent author changes may
  preserve the historical selection marker while the receipt truthfully distinguishes the selected
  source suggestion from the final author-edited admitted proposal.
- Additions and suggestions each carry immutable refinement provenance containing the exact inference
  receipt, raw-output digest, candidate digest, baseline manifest ID, and optional
  `refinesBaselineEntryId`. These fields participate in combined-manifest fingerprinting and
  validation. B1 decision reconstruction must preserve them, and B3d copies them into the matching
  `BootstrapReceiptEntry`; it does not reinterpret them as approval or truth.
- Deterministic/manual/legacy entries do not receive fabricated Hermes provenance. Refinement
  provenance is present only where a real admitted B4 artifact supplied it.
- The combined manifest receives its own B1-derived identity/fingerprint and explicit immutable
  refinement metadata containing the baseline manifest ID, exact old-to-new entry-ID map, artifact
  digest, and receipt. All of that metadata is inside the validated/fingerprinted projection. The
  original baseline artifact remains retained in the review session; the combined manifest does not
  impersonate it or rely on the legacy FNV ID without exact structural comparison.
- The merge performs no deduplication, semantic ranking, automatic conflict resolution, decision,
  assignment, preparation, or canonical write.

These are deliberate, narrow schema extensions to `BootstrapManifest`, `BootstrapManifestEntry`,
B3 decision metadata, and `BootstrapReceiptEntry`. They require coordinated B1 fingerprint/validator,
B3 transition, and B3d receipt-projection changes. They do **not** change `StoryProject` canonical
schema or `prepareBootstrap()` admission semantics. The returned immutable `BootstrapReceipt` is the
post-admission owner through the B3d decision and current UI receipt display. Durable receipt-history
persistence across application reloads does not exist for B3d today and remains a separately frozen
backlog concern; B4 must not pretend that ephemeral display is durable storage.

#### UI and lifecycle boundary

- B4 extends the existing structural-review session; it does not add another review screen or
  alternative APPLY control.
- During refinement, all controls that could decide, edit, assign, close, regenerate, refine again,
  or APPLY the submitted session are unavailable. A second refinement request is impossible.
- Success atomically replaces only the session's pending baseline view with the combined pending
  manifest and retained refinement artifact. The same `BootstrapReviewWorkspace` renders both
  deterministic and AI-origin additions plus AI suggested edits beside their deterministic targets,
  clearly labeling origin and showing receipt provenance without turning it into confidence or
  authority.
- Failure leaves the exact baseline manifest and null assignments intact, displays an author-visible
  refinement operation error, and permits retry. It creates no candidate artifact and no receipt
  display claiming completion.
- Refinement failures use the existing `WorkbenchErrorNotice` path with the exact new
  `WorkbenchOperationSource` value `bootstrap-refine`; they are not mislabeled as B3d `bootstrap`,
  `execute`, or `promote` failures and remain scoped to the originating project/session attempt.
- Source edits, project switches, session regeneration, or component unmount invalidate an in-flight
  attempt. Late success/failure becomes inert and cannot replace another session, display its
  receipt, or clear its controls. Use committed lifecycle identity/token scoping; never mutate
  ownership refs during render.
- Source freshness is checked both immediately before the request and again before merge using exact
  `sourceDocumentsAreIdentical()` semantics, not fingerprint equality alone.

#### Authority and mutation matrix

| Layer | May own | Must not own |
|---|---|---|
| B2 deterministic discovery | baseline evidence-backed proposals | AI invocation, decisions, canon |
| underlying model | raw refinement suggestion only | receipt, IDs, evidence truth, approval, mutation, provider choice |
| Hermes broker/provider boundary | route execution + truthful broker/model/fallback receipt fields | proposal validity, evidence truth, approval, canon |
| B4 validator/normalizer | closed structural admission, source-bound citation replay, deterministic IDs/digests/order | semantic entailment, author decisions, canonical mutation |
| B1 manifest | combined immutable proposal/review artifact | automatic approval or preparation |
| B3 review | explicit author approve/edit/reject + assignments | model execution or direct canon writes |
| B3d `prepareBootstrap()` | atomic application of one complete reviewed manifest | inference, partial admission, implicit decisions |

#### RED acceptance surface to freeze next

The B4 RED gate must test the wished-for public boundaries, not implementation choreography:

1. deterministic B2 executes and remains byte/field-equivalent whether refinement is skipped,
   succeeds, returns zero entries, or fails;
2. no Hermes call occurs without the explicit refinement action, after any decision/assignment, or
   more than once concurrently/successfully for one baseline;
3. exact operation label, provider-neutral receipt-bearing interface, provider unavailability, and
   no fallback candidate fabrication;
4. duplicate-key-detecting raw JSON parsing, exact recursive key sets and v1 resource/control-
   character limits across hostile browser/model input, all four allowed kinds, excluded topology
   fields, unknown/unsupported kinds, wrong types, and valid zero-entry output;
5. exact UTF-16 source-coordinate replay, including astral/surrogate fixtures, repeated identical
   text at different offsets, whitespace/punctuation-only spans, duplicate versus overlapping spans,
   unknown documents, and stale source before request/merge;
6. SHA-256 encoding vectors, candidate/raw-output binding, shortened-ID collision toxics, exact
   structural checks beside legacy FNV IDs, deterministic normalization/order, deep immutability,
   and non-mutation of baseline manifest, source documents, raw output, payload, and receipt;
7. additive-only merge with a validated exact old-to-new entry-ID map: baseline semantic fields stay
   equivalent/in-order under required B1 ID rebasing; AI additions append pending; AI alternatives
   become suggestion metadata rather than duplicate proposed IDs; neither can rewrite/suppress B2;
8. provenance and suggestions affect combined-manifest identity, retain exact artifact/candidate
   digests, survive approve/edit/reject reconstruction, distinguish selected suggestion from final
   author-edited content, never create a decision, and reach matching B3d receipt entries;
9. the same B3 workspace drives decisions/assignments and the same B3d callback/`prepareBootstrap()`
   performs the only canonical mutation; a TypeScript-AST/module-graph gate resolves direct imports,
   re-export aliases, and dynamic imports to prove no second review/APPLY/admission route is reachable;
10. pending UI freezes all review authority controls; failure preserves the exact baseline; success
    swaps one combined session; project/source/session changes and unmount make late completion inert;
    ambiguous timeout retries reuse one idempotency reservation, explicit terminal failures advance
    retry ordinal, same-key/different-request substitution fails, and only one result can be merged;
11. no direct browser-to-Hermes call, model/provider field, tool/skill/memory/session capability,
    topology-bearing model reference, direct StoryProject mutation, or `prepareBootstrap()` call from
    the B4 producer/validator/UI.

The first RED should stop at the first genuinely absent public B4 boundary while fixture self-checks
and adjacent B2/B3/B3d/Hermes-provider tests remain green. Contract freeze, RED, and GREEN remain
separate checkpoints; no B4 production implementation is authorized by this draft.

#### Non-goals

- No changes to B2 detection/parsing heuristics and no model-assisted replacement of B2 output.
- No second review workspace, second decision vocabulary, second APPLY button, or second canonical
  admission function.
- No automatic acceptance, confidence-to-decision conversion, deduplication, ranking, entity merge,
  or preference for AI over deterministic proposals.
- No facts, generic relationships, threads, mysteries, continuity audit, pacing state, schema
  expansion of canonical `StoryProject`, post-bootstrap enrichment, or refinement of
  already-canonical projects. The explicitly listed proposal-manifest/review/receipt provenance
  extensions above are authorized B4 artifact-schema work, not canonical world-schema expansion.
- No tools, skills, memory, agent loop, model picker, direct provider SDK, live model evaluation, or
  capability-policy redesign in this slice.
- No durable review-session or receipt-history persistence/resume across application restart, no
  cancellation transport, and no multi-pass AI refinement.
- No B3d canonical admission or identity-resolution semantic changes. B4 only extends the existing
  receipt projection with immutable provenance after the same admission rules succeed.

#### B4a — Hermes Refinement Artifact Boundary  ✅ shipped (contract 014e7f2/f44d909, RED 83ab7b1, GREEN ded2db7)

**Scope.** B4a produces exactly one thing: given an eligible baseline `BootstrapManifest` and its
bound `AuthorSourceDocument[]`, call Hermes once through a receipt-bearing provider and return a
validated, immutable `BootstrapRefinementArtifact`, or throw. It performs no additive merge into a
`BootstrapManifest` (B4b), renders no UI (B4c), and is not called from anywhere reachable through
`BootstrapReviewWorkspace.tsx`, `bootstrapReview.ts`, `StoryEditor.tsx`, or `prepareBootstrap.ts`.

**Files.**

- `src/lib/bootstrapRefinement.ts` — pure, browser-safe (no `node:crypto`, no `fetch`, no server
  import), mirroring `src/lib/bootstrapManifest.ts`'s domain-module convention. Defines
  `BootstrapRefinementCandidateKind`, `BootstrapRefinementEvidenceCitation`,
  `BootstrapRefinementCandidate`, `BootstrapRefinementPayload`, and
  `BootstrapRefinementArtifact = InferenceArtifact<BootstrapRefinementPayload>`; the exact
  `onceaponatime.bootstrap.refine` operation string and `onceaponatime.bootstrap.refinement.v1`
  schema string as named constants; `isBootstrapRefinementEligible(manifest)` (every entry
  `pending`, no `admitted` value); the strict raw-JSON structural validator plus UTF-16 coordinate
  replay against bound source text (produces candidates *without* digests — digesting needs
  crypto); and `parseJsonNoDuplicateKeys()`, a duplicate-key/trailing-value-detecting JSON reader
  used on raw Hermes output text (`JSON.parse()` alone is insufficient per the master contract).
- `server/bootstrapRefinement.ts` — server-only (may use `node:crypto`), mirroring
  `server/narrativePipeline.ts`'s orchestration convention. Builds the Hermes prompt from the exact
  baseline manifest and `baseline.boundSourceDocuments` only (see "B4a source authority" below); the
  SHA-256 digest functions (`candidateDigest`/`rawOutputDigest`/`artifactDigest`) over the documented
  versioned length-prefixed encoding; and `refineBootstrapManifest(baseline, provider?)`, the
  orchestrator shaped like `planNarrativeBeat()`/`renderNarrativeProse()`: checks eligibility, calls
  `provider.generateText({ operation: 'onceaponatime.bootstrap.refine', ... })` on a
  `ReceiptBearingModelProvider` (never the transitional `ModelProvider`/Gemini path), validates and
  digests the raw output via `src/lib/bootstrapRefinement.ts`, wraps the result with
  `createInferenceArtifact()`, and deep-freezes the payload and every nested candidate/citation.

**B4a source authority.** `BootstrapManifest.boundSourceDocuments` is the sole source-document
input to refinement:

```text
refineBootstrapManifest(
  baseline: BootstrapManifest,
  provider?: ReceiptBearingModelProvider,
)
```

No independent `sourceDocuments` argument exists anywhere in B4a's public surface --
`buildBootstrapRefinementPrompt()` compiles the Hermes prompt from `baseline` plus
`baseline.boundSourceDocuments` alone, never a separately supplied document list. This is
stronger than the general master-contract prose above ("exact bound source documents"): a
caller cannot construct a request from a manifest bound to one source snapshot paired with a
different, independently supplied `sourceDocuments` value -- the type boundary itself forecloses
a manifest/source split-brain, rather than relying on a runtime equality check to catch it.

**Explicitly deferred out of B4a** (named later increments, not abandoned):

- The live `/api/bootstrap/refine` Express route, its route-specific raw body parser ahead of the
  app-wide `express.json()`, and HTTP-level duplicate-key detection on the *browser's* request body.
  B4a's own `parseJsonNoDuplicateKeys()` is exercised directly against raw Hermes *model* output
  text, which is B4a's real hostile-input boundary regardless of transport; wiring an HTTP route to
  call `refineBootstrapManifest()` is transport plumbing, deferred to B4c — the same increment that
  adds the explicit REFINE action a live browser session actually calls it from.
- Idempotency-key reservation, retry-ordinal tracking, and per-session single-success enforcement —
  these need the live review-session identity (`refinementSessionId`) B4c owns, not the pure
  artifact-production boundary B4a proves.
- All additive-merge, suggested-edit attachment, and manifest-identity-rebase behavior (B4b).

**B4a RED gate.** Freeze failing tests proving, against injected fake `ReceiptBearingModelProvider`s
(mirroring `tests/stage1HermesActivation.test.ts`'s pattern), with no live network call:

1. `refineBootstrapManifest()` is unreachable from `discoverBootstrap()`, `buildBootstrapManifest()`,
   `bootstrapReview.ts`, `BootstrapReviewWorkspace.tsx`, `StoryEditor.tsx`, or `prepareBootstrap.ts` —
   a static reachable-import-graph scan proves it, mirroring B3b's `prepareBootstrap()` ban;
2. the exact operation label `onceaponatime.bootstrap.refine` is sent and nothing else; a
   transitional `ModelProvider` (Gemini) is rejected at the type level like Stage 1/2;
3. the prompt is built only from the exact bound baseline manifest and source documents passed in —
   changing an unrelated field of either changes the prompt deterministically, and no other project
   data reaches the provider call;
4. a returned artifact carries the provider's exact `InferenceReceipt` unchanged and is deep-frozen
   (artifact, payload, every candidate, every evidence citation);
5. `isBootstrapRefinementEligible()` rejects a baseline with any non-`pending` entry or any
   `admitted` value present, before the provider is ever called;
6. malformed JSON from the model — including duplicate top-level and nested keys, and trailing
   values — fails closed via `parseJsonNoDuplicateKeys`, never falling through to bare `JSON.parse`;
7. wrong top-level key set, wrong `schema`, and a mismatched `baseline_manifest_id` or
   `bound_source_fingerprint` each fail closed;
8. each of the four supported kinds parses; `fact_proposal`/`relationship_proposal` and any unknown
   kind reject the whole output; `initial_location_id`/`initial_holder_actor_id`/`member_actor_ids`
   present on any candidate reject the whole output (excluded topology fields);
9. UTF-16 offset replay against the bound source text: exact match required, astral/surrogate-pair
   fixtures, `end_offset <= start_offset`, out-of-range/non-integer offsets, and a span containing no
   Unicode letter or number all fail closed, as does an unknown `source_document_id`; a duplicate
   identical span within one candidate fails closed, but distinct overlapping spans and reuse of one
   span across different candidates are preserved, not coalesced;
10. resource limits reject closed: output over 262,144 UTF-8 bytes, over 64 candidates, evidence
    spans outside 1–8, aliases over 16, and label/name/alias/description length and
    control-character bounds;
11. a fully valid, empty `entries` array produces a real artifact with zero candidates, not an error;
12. `candidateDigest`/`rawOutputDigest`/`artifactDigest` are SHA-256 over the documented versioned
    length-prefixed encoding; identical input plus identical raw output yields byte-identical digests
    across repeated calls; changing one candidate field, the raw output text, or the bound
    baseline/source changes the corresponding digest(s);
13. two candidates whose shortened `bootstrap_ai_<kind>_<first-32-hex>` IDs collide fail the whole
    artifact closed even when their full digests differ;
14. provider unavailability, a thrown provider error, and an HTTP-shaped failure the injected
    provider surfaces each reject with no fallback/placeholder artifact — never a "successful" empty
    artifact standing in for a real failure;
15. `refineBootstrapManifest()` never mutates its `baseline` argument (frozen-input assertions), and
    adjacent B2/B3/B3d/`hermesProvider`/`stage1`/`stage2` suites stay green.

Deliberately not in B4a's RED gate, each reserved for its named later increment: additive merge into
`BootstrapManifest`, suggested-edit attachment, any React component, any live HTTP route,
idempotency/retry-ordinal transport, and any change reachable from `BootstrapReviewWorkspace.tsx` or
`StoryEditor.tsx`.

#### B4b — Refinement Merge  ✅ shipped (contract 831a5a4, RED b81f037, GREEN de787b0)

```text
BootstrapManifest
        +
BootstrapRefinementArtifact
        ↓
deterministic additive merge
        ↓
new (combined) BootstrapManifest
```

**Scope.** B4b answers only the merge semantics already specified in this document's master
"Additive merge into the existing manifest" section above, narrowed into exact file/function/type
names: how new AI proposals are added, how suggested edits attach to their existing B2 target entry,
how IDs/provenance survive the required manifest/entry-ID rebase, how duplicates/collisions are
handled, and how original B2 proposals remain untouched. B4b calls no Hermes provider, renders no
React, adds no `REFINE` action, adds no HTTP route, and does not touch
`BootstrapReviewWorkspace.tsx`, `bootstrapReview.ts`, `StoryEditor.tsx`, or `prepareBootstrap.ts` --
those are B4c's and B4d's jobs. It consumes an already-validated `BootstrapRefinementArtifact`
exactly as B4a produces it; it does not re-invoke Hermes or re-run `validateBootstrapRefinementOutput`
against raw text.

**B4b baseline binding -- merge only into the exact baseline the refinement was produced against.**

```text
Requirements, all checked at merge time (never assumed from B4a having checked them earlier):
- baseline.id === artifact.value.baselineManifestId
- baseline.boundSourceFingerprint === artifact.value.boundSourceFingerprint
  (and baseline.boundSourceDocuments still matches that fingerprint)
- baseline is still refinement-eligible right now:
    every entry decision === 'pending'
    no entry carries an admitted value

If author review has begun, the source changed, or the manifest otherwise changed since the
artifact was produced:
        -> fail closed
        -> never transplant a refinement artifact onto a merely "compatible" manifest
```

This is a real trust boundary, not a formality: B4a only ever runs against a fresh, untouched review
artifact, but nothing prevents time passing between B4a producing an artifact and something later
calling the merge -- an author could have started deciding entries in the meantime, or the bound
source could have changed. B4b re-derives and re-checks eligibility itself rather than trusting that
"B4a must have validated this already." A direct consequence: **merging an already-merged manifest
against the same artifact must fail** -- the combined manifest's own `id` is no longer
`artifact.value.baselineManifestId` (that field still names the *original* pre-merge baseline), so
the identity check above rejects it on its own, with no separate session/idempotency mechanism
needed. B4b is pure repeat-safe by construction; click/retry semantics remain B4c's problem.

**Baseline-entry preservation -- frozen explicitly, not left to infer from "structurally unchanged."**

```text
For every pre-existing B2/B3a manifest entry, the merge may NOT alter:
  - proposed
  - evidence
  - discoveryConfidence
  - supportedForApplication
  - decision
  - admitted

It may only:
  - rebase the entry's own id (required, because entriesFingerprint changes)
  - attach suggestedRefinements metadata defined by B4b
```

`discoveryConfidence` gets called out on purpose: it is B2 detector rationale (why *deterministic*
discovery surfaced a candidate) and AI refinement must never acquire or modify it, on existing
entries or its own. A new AI-addition entry gets its own `refinementProvenance` -- never a fabricated
or copied `discoveryConfidence`, which would misrepresent an AI proposal as having B2's evidentiary
grammar-based backing it never had.

**Suggested-edit targeting is exact-identity only, never label-based.**

```text
suggested edit target resolution:
        candidate.refinesEntryId (already validated by B4a against the original baseline)
        -> rebased under the baselineEntryId -> combinedEntryId map
        -> must name a real combined-manifest entry of the SAME proposal kind

Never:
  - working-label lookup
  - alias lookup
  - fuzzy/"closest" matching

If the rebased target is missing, or present but of the wrong kind:
        -> reject the whole merge, not just that one suggestion
```

**Files.**

- `src/lib/bootstrapManifest.ts` (existing B1 domain module, extended, not replaced) --
  new optional schema fields only, matching the master contract's "narrow schema extensions":
  - `BootstrapManifestEntry` gains `refinementProvenance?: BootstrapRefinementProvenance` (present
    only on an entry that originated as a B4 AI *addition*) and
    `suggestedRefinements?: readonly BootstrapSuggestedRefinement[]` (present only on a deterministic
    entry that has one or more AI *suggested edits* attached; an array because more than one candidate
    may target the same baseline entry).
  - `BootstrapManifest` gains `refinementMetadata?: BootstrapManifestRefinementMetadata`, present only
    on a combined (post-merge) manifest, absent on a pure B2 baseline.
  - **Provenance ownership is split cleanly in two, one exact record plus linkage -- never copied and
    independently reconstructed per entry:**
    ```text
    manifest.refinementMetadata               (ONE artifact-level record, whole-manifest scope)
      baselineManifestId
      entryIdMap
      artifactDigest
      rawOutputDigest
      receipt                                 (the exact InferenceReceipt -- lives here ONCE)

    entry.refinementProvenance /
    suggestedRefinement.provenance            (candidate-level linkage only)
      candidateDigest
      refinesBaselineEntryId?                 (present for a suggestion, absent for an addition)
    ```
    An entry's own provenance never re-embeds `receipt`, `artifactDigest`, or `baselineManifestId` --
    those are already the manifest's own `refinementMetadata`, one exact record per manifest. Copying
    the receipt into every entry would let entry-level and manifest-level copies drift; a single
    manifest-level record plus a per-entry digest linkage cannot.
  - `validateBootstrapManifestStructure()` is extended to validate these fields' content when present
    (not merely tolerate their absence) -- an attacker-shaped `refinementProvenance`/
    `suggestedRefinements`/`refinementMetadata` must fail closed like every other manifest field.
  - `fingerprintEntrySources()`/`entriesFingerprint` and `expectedBootstrapManifestId()` are extended
    so this new metadata participates in combined-manifest identity, per the master contract.
  - **Origin finding to resolve in RED, not silently duplicated:** the private `expectedEntryId()`
    (and manifest-ID composition) is not currently exported. B4b's merge must rebase every baseline
    entry's ID under the new combined manifest ID using *exactly* B1's own identity rule, not a
    reimplementation that could drift from it -- mirroring the B3c finding that led to exporting
    `resolveAdmittedBootstrapProposal()`. Export what B4b needs from `bootstrapManifest.ts` rather than
    recomputing the ID format in the new module.
- `src/lib/bootstrapRefinementMerge.ts` (new, pure, browser-safe) --
  `mergeBootstrapRefinementArtifact(baseline: BootstrapManifest, artifact: BootstrapRefinementArtifact):
  BootstrapManifest`, the sole merge/normalization boundary. Mutates neither argument.

**Revalidation the merge performs itself (never assumes the artifact arrived untampered).** Before
merging: `artifact.receipt.operation === 'onceaponatime.bootstrap.refine'`; the baseline-binding checks
above; and every candidate's evidence citations are re-resolved against `baseline.boundSourceDocuments`
(exact offsets, exact text) rather than trusting the artifact's embedded `exactText` at face value --
the artifact may have round-tripped through an untrusted transport by the time a later increment (B4c)
wires it to a live HTTP boundary, even though B4b itself adds no transport.

**Rebase and append.**

- Every baseline entry is rebased to a new entry ID under the combined manifest's own (necessarily
  different) ID, because the entries fingerprint changes once AI entries are appended. An immutable
  one-to-one `baselineEntryId -> combinedEntryId` map is retained (derived by original kind/
  sourceIndex/order) and both sides are validated.
- Each `refines_entry_id === null` candidate becomes a new ordinary pending, application-supported
  `BootstrapManifestEntry` (ordinary B1 entity-proposal shape derived from the candidate, `id` derived
  from `candidateId`, `evidence` derived from the candidate's citations re-resolved against `baseline
  .boundSourceDocuments`), carrying `refinementProvenance` with `refinesBaselineEntryId` absent and no
  `discoveryConfidence`.
- Each `refines_entry_id !== null` candidate becomes one `BootstrapSuggestedRefinement` appended to
  its *rebased* target entry's `suggestedRefinements` array, per the exact-identity targeting rule
  above. It does not become a new manifest entry and does not touch the target's own
  `proposed`/`decision`/`admitted` fields.
- AI addition ordering is deterministic (candidate order as returned by B4a, which is itself
  deterministic given identical validated input).

**Duplicates/collisions -- fail closed, never silently coalesced or renamed.**

- An AI addition's derived proposal id colliding with *any* baseline entry's `proposed.id` fails the
  whole merge (this is the "shortened-ID collision with a baseline proposal" half of the master
  contract's identity rule; the "collision with another candidate" half is already B4a's job via
  `assertNoIdentityCollisions`, re-checked here only as defense in depth, not re-derived).
- The merge performs no deduplication, semantic ranking, automatic conflict resolution, decision,
  assignment, preparation, or canonical write. Multiple suggestions on one entry, and multiple
  additions citing overlapping source spans, are preserved as-is for the (not-yet-built) B3 surface to
  display -- B4b does not rank or prefer among them.

**Combined manifest identity.** The result receives its own B1-derived `id`/`boundSourceFingerprint`/
`entriesFingerprint` (via the exported rebasing rule above, not a reimplementation) plus
`refinementMetadata`. All of that is inside the validated/fingerprinted projection. The original
baseline artifact is not mutated or discarded by this function -- retaining it across a review session
remains a B4c lifecycle concern, not B4b's.

**Explicitly deferred out of B4b** (named later increments, not abandoned):

- `decideBootstrapManifestEntry()` gaining a `selectedRefinementCandidateDigest` recording path, and
  any UI for choosing a suggestion -- both belong to B4c, the increment that actually wires an author
  interaction to "select this suggestion" through the same B3 review controls.
- `BootstrapReceiptEntry` (B3d's receipt projection) copying `refinementProvenance`/
  `selectedRefinementCandidateDigest` through -- that is B4d's end-to-end proof, once B4c exists to
  produce a real decided-and-applied combined manifest to prove it against.
- Any live wiring of `mergeBootstrapRefinementArtifact()` into `StoryEditor.tsx` or
  `BootstrapReviewWorkspace.tsx` -- B4b proves the pure function in isolation only.

**B4b RED gate (draft -- not yet frozen).** Freeze failing tests proving, against hand-built baseline
manifests and hand-built `BootstrapRefinementArtifact` fixtures (no Hermes call, no B4a invocation
required):

1. `mergeBootstrapRefinementArtifact()` is unreachable from `BootstrapReviewWorkspace.tsx`,
   `bootstrapReview.ts`, `StoryEditor.tsx`, and `prepareBootstrap.ts` (reachable-import-graph scan,
   same pattern as B4a's #1);
2. original entries are unchanged: every baseline entry's `proposed`/`evidence`/`discoveryConfidence`/
   `supportedForApplication`/`decision`/`admitted` survives byte-for-byte and in order under the
   required ID rebase; the `baselineEntryId -> combinedEntryId` map is exact and one-to-one and
   validates on both sides;
3. AI additions are additive only: an addition candidate becomes an ordinary new pending entry with
   `refinementProvenance` and no `discoveryConfidence`, never mutating any existing entry;
4. suggestions attach without rewriting targets: a suggestion candidate becomes `suggestedRefinements`
   metadata on its rebased target and never a new entry, never touching the target's own
   proposed/decision/admitted;
5. a wrong or stale baseline rejects: mismatched `artifact.receipt.operation`, `baselineManifestId`, or
   `boundSourceFingerprint` against `baseline` each fail closed;
6. a partially reviewed baseline rejects: any non-`pending` decision or any `admitted` value anywhere
   in `baseline.entries` fails closed before any merging happens, even though B4a should already have
   refused to produce such an artifact;
7. a missing suggestion target rejects: a (post-rebase) `refinesBaselineEntryId` that names no real
   combined-manifest entry fails the whole merge closed;
8. a wrong-kind suggestion target rejects: a (post-rebase) target that exists but is of a different
   proposal kind than the candidate fails the whole merge closed;
9. B2 confidence untouched: existing `discoveryConfidence` values are never read, copied, or
   reinterpreted by anything in the merge path, and no AI entry ever fabricates one;
10. same input gives the same merged manifest: identical valid `(baseline, artifact)` produces a
    structurally identical combined manifest across repeated calls (deterministic addition ordering,
    deterministic entry-ID rebase);
11. already-merged input doesn't accept the same stale artifact: calling the merge again with the
    *combined* manifest as `baseline` and the same original `artifact` fails closed via the baseline-
    binding check (the artifact's `baselineManifestId` still names the pre-merge manifest);
12. source citations are replayed against `baseline.boundSourceDocuments` again, not trusted from the
    artifact: a hand-tampered artifact whose embedded `exactText` no longer matches the real source
    slice at its stated offsets fails closed;
13. all provenance participates in manifest fingerprinting: two otherwise-identical merges whose only
    difference is `refinementMetadata` or an entry's `refinementProvenance`/`suggestedRefinements`
    produce different combined-manifest identities;
14. the caller-owned `baseline` and `artifact` arguments remain immutable (frozen-input assertions),
    and a zero-candidate artifact produces a combined manifest structurally equal to the rebased
    baseline plus a real (empty-`entryIdMap`-only-covering-baseline) `refinementMetadata`, not a bypass
    that skips rebasing.

**Non-goals (B4b):** no Hermes call, no React/UI, no `REFINE` action, no HTTP route, no
idempotency/retry transport, no `decideBootstrapManifestEntry()` change, no `prepareBootstrap()` or
`BootstrapReceiptEntry` change, no canonical `StoryProject` mutation, no ranking/deduplication/
automatic conflict resolution.

Reviewed and frozen. Per the established B2/B3/B3d/B4a pattern, RED and GREEN remain separate
checkpoints from this freeze: no B4b production implementation is authorized by this draft alone.


#### B4c — Optional Refinement UI + Lifecycle  ← B4c1 contract frozen; B4c2 scoped only; B4c3 undesigned

Drafted against the real current surfaces (read in full before writing this): `StoryEditor.tsx`
(review-session state: `reviewSession`/`isReviewOpen`/`isApplyingBootstrap`/`bootstrapReceipt`, the
`isApplyingBootstrapRef`/`applyAttemptRef`/`projectIdRef` re-entrancy-and-staleness-guard pattern,
`isReviewSessionStale`, `handleBeginStructuralReview`/`handleApplyBootstrap`), `BootstrapReviewWorkspace
.tsx` (its closed prop list: `manifest`/`assignments`/`isStale`/`onDecide`/`onAssignPovActor`/
`onAssignCurrentLocation`/`onRegenerate`/`onClose`, and that every `disabled={isStale}` site plus
`StructuralReviewPanel`'s always-enabled `onClose` are the exact controls needing a freeze), `App.tsx`
(the plain `fetch('/api/framework/execute', ...)` + `createInferenceArtifact(data.stage1.value,
data.stage1.receipt)` client pattern, and `handleApplyBootstrap`'s exact
`workbenchOperationError('bootstrap', err)` shape), `server.ts` (every existing route registers with
`app.post(path, handler)` *after* the single app-wide `app.use(express.json({limit: '15mb'}))` at the
top of the file, and none does route-specific raw-body parsing or duplicate-key detection), and
`workbenchErrors.ts` (`WorkbenchOperationSource = 'execute' | 'promote' | 'bootstrap'`, no
`'bootstrap-refine'` value yet).

**One origin finding surfaced by this inspection, already resolved separately:**
`server/bootstrapRefinement.ts`'s `refineBootstrapManifest()` never called
`validateBootstrapManifestStructure(baseline)` itself -- fixed as its own hardening slice (RED
`71c5aed`, GREEN `b24d806`) before this contract, not buried inside B4c1. `refineBootstrapManifest()`
now independently validates structure before eligibility and before the provider runs, so B4c1's route
does not need to duplicate that check -- it inherits it for free.

**Duplicate-key HTTP detection is retained, not dropped.** An earlier pass of this draft proposed
following every other route's plain `express.json()` convention on the reasoning that nothing else
here does duplicate-key detection. That reasoning does not survive scrutiny: this was explicitly
deferred from B4a into B4c, not abandoned, and the bootstrap path has deliberately stronger fail-closed
semantics than the older routes throughout this project (B4a's own raw-model-output parser exists for
exactly this reason). Plain `express.json()` silently resolves `{"id":"trusted","id":"different"}` to
one key before any validator ever sees it -- indistinguishable from an honest single-key object. The
real trust boundary for this route is:

```text
untrusted HTTP request bytes
        ↓
duplicate-key-safe parse (src/lib/bootstrapRefinement.ts's own parseJsonNoDuplicateKeys(),
  reused here exactly as B4a already reuses it for the model's raw output -- not
  reimplemented a second time)
        ↓
exact request envelope shape: { "baseline": <BootstrapManifest> } and nothing else
        ↓
refineBootstrapManifest(baseline) -- which now validates full manifest structure itself
  (the B4a hardening fix above), then eligibility, then the provider
```

**The App/StoryEditor operation boundary is narrower than the first draft had it: the server runs only
B4a; the merge (B4b) happens back on the client, inside the same `try/catch` that already owns
transport and server-rejection handling.** The first draft had the *server* call
`mergeBootstrapRefinementArtifact()` and return a combined manifest directly. That hides a real
failure-path gap: a client-side merge failure occurring *after* a successful fetch would land outside
whatever `try/catch` handles the fetch, leaving `StoryEditor` without the one error-setting path every
other Workbench operation already has. Since `bootstrapRefinementMerge.ts` is already pure and
browser-safe by design (no `node:crypto`, no server import -- true since B4b shipped), there is no
reason to run it server-side at all. One boundary, one `try/catch`:

```text
StoryEditor
  exact current review manifest (reviewSession.manifest)
        ↓
App.handleRefineBootstrap(baseline)          -- ONE try/catch covers everything below
        ↓
POST /api/bootstrap/refine  { "baseline": baseline }
        ↓
server: duplicate-key-safe parse -> exact envelope check -> refineBootstrapManifest(baseline)
        ↓ (success)                                          ↓ (any failure)
{ success: true, artifact: BootstrapRefinementArtifact }    { success: false, error }
        ↓
App: createInferenceArtifact(data.artifact.value, data.artifact.receipt)
        ↓
App: mergeBootstrapRefinementArtifact(baseline, artifact)    -- still inside the same try
        ↓ (success)                                          ↓ (throws)
combined BootstrapManifest returned                          caught by the same catch,
        ↓                                                    workbenchOperationError('bootstrap-refine', err)
StoryEditor atomically replaces only reviewSession.manifest
```

App still never owns or mutates the review session, and still never touches canonical `StoryProject`
for this operation -- it only computes and returns the combined manifest, exactly as
`handleApplyBootstrap` already computes and returns a receipt without owning `StoryEditor`'s session
state.

B4c is split into three increments, only the first of which is drafted in full below. **B4c3's
suggestion-selection semantics are deliberately not designed yet** -- per instruction, no RED freezes
until that's resolved as its own explicit discussion, not invented casually alongside transport work.
The current bias (not yet checked against `decideBootstrapManifestEntry()`/the receipt path, so not a
decision) is that selecting a suggestion should probably still produce the existing B3 `edited`
decision rather than a fifth decision state, with the selected candidate digest recorded as provenance
orthogonal to the decision itself.

```text
B4c1 — REFINE transport + lifecycle
  wires REFINE end to end (client action -> HTTP route -> B4a -> client-side B4b merge ->
  replaces the in-memory review manifest) using BootstrapReviewWorkspace.tsx exactly as it
  exists today except for one new disabling prop. AI additions appear automatically as
  ordinary new pending entries (the panel already renders manifest.entries generically); AI
  suggestedRefinements attach but render nothing yet -- no code anywhere reads that field
  until B4c2.
        ↓
B4c2 — render AI additions/suggestions in review
  BootstrapReviewWorkspace.tsx (and/or StructuralReviewPanel.tsx) visually distinguishes an
  origin: refinementProvenance present, and shows suggestedRefinements beside their target
  entry. Read-only -- no new decision path.
        ↓
B4c3 — explicit author selection of a suggested edit
  NOT DESIGNED YET. Needs its own discussion: what UI action "selects" a suggestion, whether
  it's a distinct decision from EDIT or a special case of EDIT that records
  selectedRefinementCandidateDigest (per the master contract's "Additive merge" section),
  whether decideBootstrapManifestEntry()'s signature changes, and how a selection interacts
  with an already-in-progress manual edit of the same entry. No RED freezes for B4c3 until
  this is resolved.
```

##### B4c1 — REFINE transport + lifecycle  ✅ shipped (contract efc19eb, RED 573f985, GREEN fbf06ec)

**Scope.** Exactly one new author action: an explicit `REFINE WITH HERMES` control, available only
on a completely untouched review session, that calls B4a once via the new route, merges the result
through B4b once on the client, and replaces only `reviewSession.manifest` in `StoryEditor.tsx`'s
existing local state. `reviewSession.assignments` is untouched (REFINE is only offered while both are
still `null` anyway). No `StoryProject` mutation, no auto-approval, no suggestion selection, and no
second review/APPLY path -- the existing `BootstrapReviewWorkspace`/`decideBootstrapReviewEntry`/
`handleApplyBootstrap`/`prepareBootstrap()` chain is completely unchanged and is the only thing that
ever decides, assigns, or applies anything.

**REFINE is enabled only if, re-derived fresh every render exactly like `isReviewSessionStale` already
is -- never cached in its own state:**

```text
- a review session exists (reviewSession !== null) and is open
- the session is not stale (!isReviewSessionStale)
- isBootstrapRefinementEligible(reviewSession.manifest)    (B4a's own export: every entry
                                                              pending, no admitted value, no
                                                              existing refinementMetadata)
- reviewSession.assignments.activePovActorId === null
- reviewSession.assignments.currentLocationId === null      (B4a cannot check this --
                                                               assignments live outside
                                                               BootstrapManifest entirely;
                                                               an assignment is author review
                                                               activity even though it lives
                                                               outside the manifest, so B4c
                                                               must enforce it)
- no refinement request is already in flight (!isRefining)
```

Once any decision or assignment exists, or the session has already been through one successful
refine (`refinementMetadata` now present), the control disappears (never disables-but-visible) --
matching the existing BEGIN/APPLY convention of only showing a control while it is truthfully
actionable. The author's only way back to a refinable session is the existing explicit
REGENERATE/BEGIN path, which already discards decisions by design.

**While REFINE is in flight, none of the following may happen:**

```text
- APPROVE
- EDIT (including SAVE EDIT)
- REJECT
- POV or current-location assignment changes
- APPLY
- a second REFINE
- CLOSE
- REGENERATE (unreachable in practice -- staleness and an in-flight refine cannot co-occur
  under the eligibility expression above, since REFINE is never offered while stale)
```

**Files.**

- `src/App.tsx` -- new `handleRefineBootstrap(baseline: BootstrapManifest): Promise<BootstrapManifest>`.
  One `try/catch` covering the entire diagram above: `setWorkbenchError(null)`, `fetch('/api/bootstrap/
  refine', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({
  baseline }) })`, parse `{ success, artifact, error }`, throw on `!success`, reconstruct via
  `createInferenceArtifact(data.artifact.value, data.artifact.receipt)` (the exact existing
  `stage1`/`stage2` pattern), call `mergeBootstrapRefinementArtifact(baseline, artifact)` -- still
  inside the same `try` -- and return the combined manifest. The single `catch` covers transport,
  server-side rejection, and a client-side merge failure identically:
  `setWorkbenchError(workbenchOperationError('bootstrap-refine', err)); throw err;`. Never calls
  `updateActiveProject` -- there is nothing canonical to update. Passed to `StoryEditor` as a new
  `onRefineBootstrap` prop, mirroring `onApplyBootstrap`'s existing wiring shape.
- `src/lib/workbenchErrors.ts` -- `WorkbenchOperationSource` gains `'bootstrap-refine'` (additive; the
  existing `'execute' | 'promote' | 'bootstrap'` values and every existing gate on them are untouched).
- `server.ts` -- new `app.post('/api/bootstrap/refine', express.raw({ type: 'application/json', limit:
  '15mb' }), async (req, res) => { ... })`, registered *before* the file's existing
  `app.use(express.json({ limit: '15mb' }))` line (Express matches middleware/routes in registration
  order; an earlier specific route match means the later app-wide JSON body-parser never runs for this
  one path -- every other route keeps using the app-wide parser unchanged). Handler: decode `req.body`
  (a `Buffer`) via `new TextDecoder('utf-8', { fatal: true }).decode(...)` (throws on invalid UTF-8,
  unlike Express's own lossy default decode); parse with `parseJsonNoDuplicateKeys()` (imported from
  `src/lib/bootstrapRefinement.ts`, reused exactly as-is -- not reimplemented); require the parsed
  value's key set to be exactly `{ baseline }`; call `refineBootstrapManifest(baseline)` (which now,
  per the hardening fix, validates full structure and eligibility itself before ever touching the
  provider); `res.json({ success: true, artifact })` on success. A malformed envelope (bad JSON,
  duplicate keys, wrong key set) responds `400`; any `refineBootstrapManifest()` throw (structural,
  eligibility, or provider/model failure) responds `500` with `{ success: false, error }`, mirroring
  the existing `400`-for-bad-input/`500`-for-pipeline-failure split already used by
  `/api/framework/execute`. Not perfectly taxonomic -- a malformed *manifest* is technically client
  input too -- but resolving that cleanly would need domain error classes or otherwise classifying
  thrown errors, machinery this slice deliberately does not add just for prettier HTTP codes; what
  matters is that the route fails closed and the client gets one truthful failure path either way.
  Frozen meaning, so no one later reads `500` as necessarily "provider outage":
  ```text
  HTTP 400 means: the server could not admit the request into the bootstrap-refinement
                  operation boundary at all (malformed envelope/transport).
  HTTP 500 means: the request entered that boundary, but refinement did not successfully
                  produce an artifact (structural/eligibility/provider/model failure --
                  refineBootstrapManifest()'s own thrown reason is the truth, not the code).
  ```
  The route never imports or calls `mergeBootstrapRefinementArtifact` -- merge is client-side only.
- `src/components/StoryEditor.tsx` -- new `isRefining`/`isRefiningRef`/`refineAttemptRef` state,
  exactly mirroring `isApplyingBootstrap`/`isApplyingBootstrapRef`/`applyAttemptRef`'s existing
  re-entrancy-and-late-completion-guard shape (including the same `useLayoutEffect([project.id])`
  reset and the same attempt-ordinal/project-id check before ever touching state after an await). New
  `handleRefineBootstrap` local handler calling the new `onRefineBootstrap` prop; on success (and only
  if the attempt/project checks still match) replaces `reviewSession.manifest` with the returned
  combined manifest via `setReviewSession((prev) => prev ? { ...prev, manifest: combined } : prev)` --
  `assignments` untouched. On failure, catches and does nothing further (App already recorded the
  error; the existing review session survives exactly as `handleApplyBootstrap` already does today).
  New `REFINE WITH HERMES` button rendered as a sibling alongside the existing APPLY button (not
  injected into `BootstrapReviewWorkspace`), visible only under the eligibility expression above.
- `src/components/BootstrapReviewWorkspace.tsx` -- gains one new required prop, `readonly isRefining:
  boolean`. Every existing `disabled={isStale}` site (the two decision-adjacent buttons and the two
  assignment `<select>`s) becomes `disabled={isStale || isRefining}`. The `onClose` passed down to
  `StructuralReviewPanel` is wrapped, not the panel itself touched: `onClose={() => { if (!isRefining)
  onClose(); }}` -- freezes CLOSE during an in-flight refine without adding a prop to
  `StructuralReviewPanel.tsx`.
- `src/App.tsx` -- the existing APPLY button's `disabled={isApplyingBootstrap}` becomes
  `disabled={isApplyingBootstrap || isRefining}` (defensive: REFINE and APPLY cannot both be truthfully
  offered at once under correct eligibility gating, since APPLY requires full decision+assignment
  completion and REFINE requires the opposite, but the freeze list is explicit that APPLY must be
  unavailable during an in-flight refine regardless).

**Success:**

```text
- the returned combined manifest replaces reviewSession.manifest exactly once
- reviewSession.assignments remain exactly { activePovActorId: null, currentLocationId: null }
- canonical StoryProject is unchanged (no updateActiveProject call anywhere in this path)
- no entry is approved/edited/rejected automatically -- every entry in the combined
  manifest, additions included, is decision: 'pending'
- refinement becomes unavailable for this session going forward, because the combined
  manifest now carries refinementMetadata (isBootstrapRefinementEligible() -> false)
```

**Failure (provider / transport / validation / merge -- all indistinguishable to the client, all
handled identically by the one `try/catch` in `App.tsx`):**

```text
- the exact original reviewSession.manifest is retained (reference-unchanged, not merely
  deep-equal)
- reviewSession.assignments are retained exactly as they were
- canonical StoryProject is unchanged
- a visible WorkbenchOperationError with source 'bootstrap-refine' is recorded, scoped to
  the originating project like every other WorkbenchOperationError already is
- REFINE remains offered again immediately -- eligibility is re-derived fresh, never
  latched by the failed attempt
```

**Late completion:** if the project, the bound source, or the review-session identity changed while a
request was in flight (project switch, component unmount, source edit invalidating the session,
REGENERATE, or CLOSE-then-reopen producing a new session), the returned result -- success or failure --
is discarded: it may not overwrite the newer session, may not display a success that belongs to the
old session, and may not re-enable or re-disable a control a subsequent render has already set for a
different reason. Implemented via the same attempt-ordinal-plus-project-id ref check
`handleApplyBootstrap` already uses, extended to also fail the check if the review session itself was
replaced (a new session's own object identity, or a monotonically incrementing session generation
counter if identity alone proves fragile once B4c2/B4c3 exist -- exact mechanism decided at RED time,
not here).

**B4c1 RED gate (draft -- not yet frozen).** Freeze failing tests proving, against the real
`StoryEditor`/`BootstrapReviewWorkspace` component tree with a mocked `onRefineBootstrap` (mirroring
`tests/bootstrapApply.test.tsx`'s existing mocked-`onApplyBootstrap` pattern) plus focused tests
against the real server route handler and the real `App.handleRefineBootstrap` composition:

1. REFINE is never invoked automatically by BEGIN/discovery/decision/assignment/APPLY -- only the
   explicit control's own click calls it, exactly once per click;
2. the control is visible/enabled only under the full eligibility expression above -- any single
   decided entry, any assigned POV or location, any existing `refinementMetadata`, staleness, or an
   in-flight request each independently hide or disable it (never merely gray-out-but-clickable);
3. a successful call replaces only `reviewSession.manifest` with the exact returned combined manifest
   -- `reviewSession.assignments` is reference-unchanged before/after, no `updateActiveProject` call
   occurs, and the canonical `StoryProject` prop is unchanged; every resulting entry is `pending`;
4. every control named in the in-flight freeze list above is disabled or inert for the exact duration
   of the request, verified via a controlled never-resolving promise, then correctly re-enabled after
   resolution;
5. failure (rejected `onRefineBootstrap`, from a transport error, a server `{success:false}`, or a
   thrown client-side merge) leaves `reviewSession` reference-unchanged, records a
   `WorkbenchOperationError` with source `'bootstrap-refine'`, and leaves the REFINE control
   immediately re-offerable;
6. an immediate second click cannot double-invoke (re-entrancy guard identical in shape to B3d's);
7. a project switch, component unmount, or review-session replacement while a request is in flight
   makes its late success/failure inert -- cannot replace a different session, display its error, or
   re-enable/disable controls a subsequent render already set for a different reason;
8. the server route: a raw request body with duplicate top-level keys is rejected `400` without
   `refineBootstrapManifest()` ever being called; a body whose key set is not exactly `{ baseline }`
   is rejected `400`; invalid UTF-8 in the raw body is rejected rather than silently replaced/mangled;
   a structurally malformed `baseline` is rejected (via the already-hardened
   `refineBootstrapManifest()`) without ever reaching the provider; a success response's `artifact` is
   exactly what `refineBootstrapManifest()` returned, unmodified in transit; the route never imports
   `mergeBootstrapRefinementArtifact`;
9. `App.handleRefineBootstrap()`: a thrown client-side `mergeBootstrapRefinementArtifact()` failure
   (e.g. a hand-tampered artifact) is caught by the same `try/catch` as a transport failure and
   produces the identical `workbenchOperationError('bootstrap-refine', ...)` shape -- no separate,
   forgettable second error path;
10. static reachable-import-graph confirmation that nothing in this path calls `prepareBootstrap()` or
    mutates `StoryProject` directly, that `BootstrapReviewWorkspace.tsx`/`StoryEditor.tsx` never import
    `mergeBootstrapRefinementArtifact` or `bootstrapRefinementMerge` themselves (only `App.tsx` does),
    and that no direct browser-to-Hermes call exists (the only network call the browser makes is to
    the new same-origin route).

**Non-goals (B4c1):** no visual distinction of AI-origin entries or rendering of `suggestedRefinements`
(B4c2); no suggestion-selection UI or `selectedRefinementCandidateDigest` (B4c3, undesigned); no
idempotency-key/retry-ordinal transport (the attempt-ordinal ref guard is presentation-layer
re-entrancy protection, not the idempotent-retry transport the master draft separately describes -- if
that is still wanted, it is a distinct, explicitly scoped follow-up, not silently assumed present
here); no change to `decideBootstrapManifestEntry()`; no server-side merge.

B4c1 is reviewed and frozen. Per the established pattern, RED and GREEN remain separate checkpoints
from this freeze: no B4c1 production implementation is authorized by this contract alone. B4c2 remains
scoped above only at the paragraph level (not yet narrowed into exact files/props) and B4c3 remains
explicitly undesigned -- neither is unblocked by this freeze.


##### B4c2 — render AI additions/suggestions in review  ← contract frozen; awaiting RED

Drafted after reading `StructuralReviewPanel.tsx` in full (it is the only thing that renders
per-entry proposal/evidence/discovery-rationale detail today, and is used from exactly one place --
`BootstrapReviewWorkspace.tsx` -- so it is the natural, already-consistent home for this slice's
rendering, not a new component) and `BootstrapReviewWorkspace.tsx` (already receives the full
combined `manifest` whenever B4c1 has run; needs no new prop threaded through for B4c2 to have
everything it needs).

**The prerequisite gap this inspection found is closed.** `BootstrapSuggestedRefinement` was missing
an `evidence` field -- closed as its own slice (RED `288d5d1`, GREEN `c50ce9e`, independent review:
no findings), mirroring the B4a-hardening precedent rather than folded into B4c2. Every
`suggestedRefinements[]` entry now carries `suggested`, `evidence: readonly SourceEvidenceUnit[]`,
and `provenance` -- the manifest shape B4c2 needs to render is now genuinely complete. The contract
below is re-checked against that real, landed shape, not a promised one.

**Scope.** Presentation only, on the existing, already-wired `BootstrapReviewWorkspace.tsx` /
`StructuralReviewPanel.tsx` surfaces. No new authority, no new decision path, no props threaded in
from `StoryEditor.tsx` (everything B4c2 needs is already reachable through the `manifest` prop
`StructuralReviewPanel` already receives).

```text
B4c2 MAY:
- visibly mark an entry as AI-added (refinementProvenance present, no discoveryConfidence)
- visibly mark a deterministic entry as having one or more AI suggestions attached
- render each suggestion's proposed working label / name / aliases / description / evidence
- render refinement provenance (candidateDigest; the manifest-level artifact/receipt summary,
  read-only) beside the entries/suggestions it belongs to
- keep every existing B3 decision control (APPROVE/EDIT/REJECT, assignment selects) operating
  on the real BootstrapManifestEntry exactly as it does today

B4c2 MAY NOT:
- render any control that selects, applies, or previews-as-chosen a suggestion
- mutate proposed/admitted/decision/evidence/discoveryConfidence on any entry
- invent a new decision value or a second decision vocabulary
- auto-copy any suggested field into proposed or admitted
- rank, sort-by-preference, or deduplicate suggestions
- hide, dim, or visually subordinate the original deterministic proposal beneath a suggestion
- merge/collapse AI evidence into the same list as B2 discovery evidence -- rendered in a
  visibly separate block, never interleaved
- render a generic "confidence unavailable"/"rationale not supplied" style message for an
  AI-added entry's absent discoveryConfidence -- that field is intentionally inapplicable to an
  AI addition, not a detector that forgot something, and must never be worded to imply the latter
- change assessBootstrapReviewReadiness()/isBootstrapReviewComplete() semantics, or any input
  to them -- rendering additional detail is not a readiness input
- change manifest/entry.proposed/entry.decision/entry.admitted/entry.evidence/
  suggestedRefinements, or readiness/completeness, merely by having rendered them -- B4c2 is a
  pure projection of the manifest it is handed, nothing more
```

**Structure and labels -- epistemic origin must stay legible at a glance, never implying a
suggestion is already part of the authoritative proposal:**

```text
DETERMINISTIC ENTRY (entry.refinementProvenance absent)
  Original proposal                         (ProposalDetails, unchanged)
  Original source evidence                  (existing "Exact source evidence" block, unchanged
                                              heading and unchanged content)
  B2 discovery rationale/confidence          (existing block, unchanged, still absent-safe --
                                              this heading names it as B2's, on purpose)

  AI suggestions (entry.suggestedRefinements, only if present -- own container, never
  nested inside or visually merged with the two blocks above)
    for each suggestion:
      Suggested values                      (ProposalDetails reused on suggestion.suggested)
      AI supporting evidence                (own block, own heading -- never "Exact source
                                              evidence" reused verbatim, never the same list or
                                              container as the entry's own evidence above, even
                                              when a span is character-identical to one already
                                              shown there)
      Refinement provenance                 (candidateDigest, read-only)

AI-ADDED ENTRY (entry.refinementProvenance present)
  AI proposal                               (ProposalDetails, unchanged component, labelled to
                                              distinguish it from a B2 entry's "Original proposal")
  AI supporting evidence                    (existing evidence block, unchanged component --
                                              already renders whatever entry.evidence holds --
                                              relabelled so it reads as AI-sourced, not B2)
  AI refinement provenance                  (candidateDigest, read-only -- entirely replaces the
                                              "Discovery rationale not supplied" fallback; that
                                              fallback text is B2-shaped and must never render for
                                              an AI-added entry)
  NO discoveryConfidence block, in any form -- not fabricated, not a placeholder explaining its
  absence. entry.discoveryConfidence is simply absent on every AI addition, per B4b's own frozen
  guarantee, and B4c2 must render that as "this kind of rationale does not apply here," not as a
  gap.
```

**Files.**

- `src/components/StructuralReviewPanel.tsx` -- extended, not replaced. Per entry: if
  `entry.refinementProvenance !== undefined`, render an "AI-added" marker beside the existing
  kind/working-label header, relabel the proposal/evidence blocks per the structure above, and
  entirely replace the "Discovery rationale not supplied" fallback with the read-only refinement-
  provenance block (`candidateDigest`) -- never both. If `entry.suggestedRefinements !== undefined`,
  render an "AI suggestions" section after the entry's own evidence/discoveryConfidence block, one
  sub-block per suggestion, reusing the existing `ProposalDetails` component on `suggestion.suggested`
  and a new evidence-rendering block fed from the now-real `suggestion.evidence` -- markup-distinct
  from the entry's own evidence block (separate `data-` attributes; e.g. `data-suggestion-evidence`
  vs. the existing `data-source-unit-id` scoped under the entry's own block) -- plus
  `suggestion.provenance.candidateDigest`.
- No change to `BootstrapReviewWorkspace.tsx`'s props, decision handlers, or control wiring --
  APPROVE/EDIT/REJECT and the assignment selects continue to operate on `entry.id`/`entry.proposed`
  exactly as today; nothing about a suggestion is selectable through them.
- No change to `bootstrapReview.ts` -- `assessBootstrapReviewReadiness()`/
  `isBootstrapReviewComplete()`/`decideBootstrapReviewEntry()` take the same inputs and produce the
  same outputs regardless of whether an entry carries `suggestedRefinements` or
  `refinementProvenance`.

**Pre-existing, out-of-scope observation from this inspection (deliberately left alone in this
slice):** `StructuralReviewPanel.tsx`'s per-entry status badge is a hardcoded literal `"Pending
author review"` string, not derived from `entry.decision` -- `BootstrapReviewWorkspace.tsx` already
renders the real, decision-derived badge above it via `DECISION_LABEL[entry.decision]`, so the two
badges can disagree once an entry is actually decided. Predates B4 entirely (B3b/B3c). Fixing an
unrelated status-rendering bug in the same commit that introduces AI-origin rendering would muddy
the boundary between the two changes -- recorded in TODO.md's deferred-findings section if/when this
draft is frozen, logged separately, not fixed as a drive-by here.

**B4c2 RED gate (draft -- not yet frozen):**

1. an AI-added entry (`refinementProvenance` present) is visibly, structurally distinguishable from a
   B2 entry (a distinct marker/attribute, not merely absent text an author could miss);
2. an AI-added entry never renders a `discoveryConfidence` block, fabricated or otherwise, and never
   renders a generic "rationale not supplied"/"confidence unavailable" placeholder in its place --
   only the refinement-provenance block;
3. a deterministic entry's own `proposed`/`evidence`/`discoveryConfidence` render unchanged,
   byte-identical to pre-B4c2 output, whether or not it has suggestions attached;
4. `suggestedRefinements` render nested beneath/alongside their exact target entry, never as
   sibling top-level entries and never attached to the wrong entry;
5. suggestion evidence renders in a block markup-distinguishable from the entry's own baseline
   evidence block -- never the same list, never interleaved, never under a reused "Exact source
   evidence" heading, even when spans are identical text;
6. suggestion provenance (`candidateDigest`) renders, read-only -- no interactive control anywhere
   near it;
7. rendering a suggestion never calls `onDecide`/mutates `proposed`/`admitted`/`decision` -- a static
   source scan confirms no suggestion-rendering code path references `onDecide`;
8. existing APPROVE/EDIT/REJECT clicks on an entry that has suggestions attached still decide the
   *entry*, with the *entry's own* `proposed` value, exactly as `tests/bootstrapRefineLifecycle
   .test.tsx`'s existing decision tests already prove for entries without suggestions -- suggestions
   present must not change what EDIT's SAVE writes;
9. a combined manifest with zero AI additions and zero suggestions on every entry renders
   byte-identical output to the pre-B4c2 component (a snapshot/string-equality check against the
   existing B3b/B3c presentation tests' fixtures);
10. `assessBootstrapReviewReadiness()`/`isBootstrapReviewComplete()` results are unchanged by the
    mere presence of `refinementProvenance`/`suggestedRefinements` on entries that are otherwise
    identical -- readiness depends only on decision/assignment state, never on rendering detail;
11. projection-only: rendering (including opening/closing the panel, mounting/unmounting, and
    re-rendering with an unchanged manifest) never mutates the `manifest` object or any of
    `entry.proposed`/`entry.decision`/`entry.admitted`/`entry.evidence`/`entry.suggestedRefinements`
    -- asserted by reference/deep-equality on the exact manifest object before and after a render
    pass, not merely by absence of a visible symptom;
12. static reachable-import-graph confirmation that `StructuralReviewPanel.tsx` imports nothing new
    from B4a (`bootstrapRefinement.ts`) or B4b's orchestration (`bootstrapRefinementMerge.ts`) --
    only the `BootstrapManifest`/`BootstrapSuggestedRefinement`/`BootstrapRefinementProvenance` types
    it already has reachable via `bootstrapManifest.ts`.

**Non-goals (B4c2):** everything B4c3 owns (suggestion selection, `selectedRefinementCandidateDigest`,
any new decision path) remains untouched and undesigned; no manifest schema change (the one schema
change B4c2 depended on already landed as its own prerequisite slice); no `StoryProject` mutation; no
change to `StoryEditor.tsx`; the pre-existing `"Pending author review"` badge quirk stays untouched.

B4c2 is reviewed and frozen. Per the established pattern, RED and GREEN remain separate checkpoints
from this freeze: no B4c2 production implementation is authorized by this contract alone. B4c3
remains explicitly undesigned -- not unblocked by this freeze.

## Post-B4 backlog — explicitly not part of B3c/B3d

These are later architectural additions to preserve for future design. They do **not** expand,
compete with, or block B3c/B3d, and they are not part of the B4 implementation slice. Both
items below were also independently surfaced reading Novella AI Novel Forge's actual generator
source (`novela-code.html`, not marketing material) for outside inspiration -- worth noting its
architecture is LLM-authored-and-trusted at every layer (its "Bible" is free-text markdown an
LLM writes with nothing verified against source evidence; its "Story State" is an
LLM-regenerated text block after every chapter), structurally less rigorous than this project's
deterministic-evidence + explicit-author-authority chain (B1-B3d) -- not a model to imitate
wholesale, just a source for these two specific ideas.

- **Advisory continuity audit.** Add a periodic or on-demand review-and-report operation that
  examines accepted narrative state for possible continuity problems and produces evidence-backed
  findings for author review. It follows B4's authority principle: the audit is another proposal
  source only, never establishes truth directly, never auto-fixes canon, and never mutates canonical
  state as a side effect. Any suggested correction must return through the normal explicit review
  and authority path. (Novella re-checks recent chapters against its Bible/state every ~8 chapters
  and folds a findings report -- contradictions, knowledge leaks, dangling setups, timeline slips --
  back into subsequent generation; this project only validates at generation time
  (`validateCandidateProse`) and tracks per-entity reliability progressively (`codexEngine.ts`),
  with nothing doing a holistic look-back over already-canonical chapters.)
- **Structured pacing state.** Add an explicit schema-level representation for narrative pacing
  and planned progression — e.g. current act, current arc, escalation ladder, open threads, and
  what is approaching or due for payoff. This is distinct from entity state and knowledge
  boundaries: it describes where the story is within its planned dramatic structure, not what is
  objectively true in-world. Treat this as a later schema/design task, not a B3c/B3d extension.
  (Novella tracks act/arc/an "escalation ladder"/open threads/what's "due for payoff soon" as
  first-class state; this project's `StoryProject.threads[]` tracks open/closed but nothing about
  pacing, escalation, or payoff timing -- a real gap, but well outside B3c/B3d's scope.)

## Recorded, deliberately deferred (found during review, out of scope where found)

- **Re-approving an entry after an earlier edit reverts to its original proposed value**,
  silently dropping the intermediate edited value. This is existing B1
  `resolveAdmittedBootstrapProposal()` behavior (`prepareBootstrap.ts`), not introduced by
  B3c -- `decision === 'approved'` always returns `entry.proposed`, never a prior
  `entry.admitted` -- just never documented anywhere before now.
- **The reachable-graph tests' `prepareBootstrap()` ban is a source-text regex**, which a
  deliberately obscure re-export alias (`export { prepareBootstrap as x } from
  './prepareBootstrap'`) would evade undetected. Confirmed via direct regex testing in
  `1a93177`'s adversarial review; nothing in the shipped code does this. A real import-graph
  tool or an ESLint `no-restricted-imports` rule would close this properly; not urgent.
- **Minor UX dead-end**: if `project.sourceDocuments` becomes all-blank while the B3c
  workspace is open, `isReviewOpen` doesn't reset (only `project.id` changing does), but
  the `BEGIN STRUCTURAL REVIEW` button (gated on `hasSubstantiveSource`) disappears --
  closing the workspace then leaves no way to reopen it. Not a data-safety issue.
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
