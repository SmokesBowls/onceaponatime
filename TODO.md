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
B3c — Author Decisions + Explicit Assignments  ✅ done, not yet pushed (1a93177)
        ↓
B3d — Atomic Canonical Admission  ← next (contract + RED frozen, GREEN not yet implemented)
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

### B3d — Atomic Canonical Admission ← next

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

### B4 — Optional AI Refinement
- A Hermes operation (e.g. `onceaponatime.bootstrap.refine`), receipt-bearing, following
  `HERMES_INFERENCE_CONTRACT.md`.
- Enters as *another proposal source* feeding B1's manifest — never a replacement for the
  deterministic pass, never establishes truth directly.

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
