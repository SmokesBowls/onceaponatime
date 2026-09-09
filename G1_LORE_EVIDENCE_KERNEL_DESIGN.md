# G1 — Lore Evidence Kernel Design Decisions (D1–D12)

## Status

**Design-only record. Not a frozen contract. Not an implementation authorization.**

This document resolves the twelve foundational design questions gated by
`POST_B4_MRLORE_MECHANICS_INTEGRATION_BLUEPRINT.md`'s **Gate G1-DESIGN**, per instruction from
the user after B4's formal closure at commit `ae56573`.

```text
B4 CLOSED
    ↓
this document: G1 design questions resolved
    ↓
G1 contract freeze                 ← NOT done here
    ↓
G1 RED                             ← NOT done here
    ↓
G1 implementation                  ← NOT done here
```

No RED test exists because of this document. No kernel code exists because of this document. No
MrLore file was changed to produce this document. No Onceaponatime application/library/schema/
test/UI file was changed to produce this document.

## Hardening pass (this revision)

This revision resolves seven contradictions found in the D1–D12 decisions above before they could
become a frozen RED contract. None required new evidence beyond re-reading the same files more
carefully; none reverses a decision's underlying reasoning. Summary (full detail inline in each
D-section and in the final report to the user):

1. **D3 repaired** — the FNV family stays a diagnostic/self-consistency fingerprint only; it is
   never the sole proof that two kernel records are the same record. A collision-resistant *or*
   fully-verified structural identity is now required wherever a collision would silently merge two
   different records. See D3 below.
2. **D3/D4/D5 repaired, one renamed** — `IdentitySymbol` is renamed `IdentityCandidate` throughout
   and redefined to remove the contradiction between "kernel mints an incrementing symbol id" and
   "G1A–C are pure, non-mutating, zero-persistence, deterministic." An `IdentityCandidate`'s id is
   now itself content-derived, like every other G1A–C artifact; "accepted symbol" is entirely a
   consumer concept the kernel never holds. See D3 and D5 below.
3. **New explicit split** — "eventual kernel architecture" (six types, unchanged) versus "first
   frozen G1A–C slice" (four: `SourceDocument`, `EvidenceSpan`, `Observation`, `IdentityCandidate`,
   plus pure identity-resolution/merge/split projections) is now stated explicitly, with
   `ScopedStateAssertion` and `DecisionRecord`/`AdmissionReceiptRecord` moved out of the first slice.
   See "Eventual kernel architecture vs. first G1A–C slice" below.
4. **D12 renamed** — `translateKernelProposalsToBootstrapDiscoveryPayload()` is replaced by a
   provisional name that does not grant the kernel a "proposal" concept; see D12 below.
5. **D6 repaired** — the reserved-fieldname blacklist is replaced by a closed-schema-first rule;
   the blacklist is dropped rather than merely supplemented. See D6 below.
6. **D1 clarified** — physical incubation inside the Onceaponatime repository is restated as
   carrying no semantic dependency; the kernel package imports nothing Onceaponatime-specific. See
   D1 below.
7. **D2 clarified, not changed** — UTF-16 offsets are restated as a TypeScript-representation
   choice, not a claim of universal/language-neutral coordinate semantics. See D2 below.

## Correction to the task framing before proceeding

The task instructed reading D1–D12 out of `POST_B4_LORE_EVIDENCE_KERNEL_DIRECTION.md`. On
inspection, that file does not contain a D1–D12 list at all — it contains a *different*,
shorter 10-point "G1 RED gate should prove at least..." sketch (its own §"G1 — first post-B4
contract target"). The actual, numbered **D1–D12** decision list lives in
`POST_B4_MRLORE_MECHANICS_INTEGRATION_BLUEPRINT.md`, under **Gate G1-DESIGN**. Per this task's
own normative-order rule (the blueprint document, §"Normative document order," ranks itself
below the direction document but above `TODO.md`, and neither document disputes the other's
content — this is a location mix-up in the task prompt, not a conflict between the two banked
documents), this record answers the *real* D1–D12 as written in the blueprint, verbatim in
substance, without inventing a replacement question set. Both banked documents were read in full
and are cited below where relevant; neither is amended by this document.

## Method

Every decision below was checked against the actual current code, not against documentation
claims alone:

- `app/src/types.ts`, `app/src/lib/bootstrapManifest.ts`, `app/src/lib/bootstrapDiscovery.ts`,
  `app/src/lib/prepareBootstrap.ts`, `app/src/lib/codexEngine.ts` (identity-merge/reliability
  functions), `app/server/contextCompiler.ts` (POV/knowledge consumer shape) — read in full or in
  the relevant part.
- `_mrlore/schema/ARTIFACT_SCHEMA.md`, `PASS2_MATH_SCHEMA.md`, `ENTITY_STATE_SCHEMA.md`,
  `REGISTRY_SYMBOL_TABLE_SCHEMA.md` — read in full.
- `_mrlore/tools/artifact_extractor.py`, `pass2_math.py` (schema only; tool grep-inspected),
  `identity_signal_math.py`, `registry_builder.py`, `mrlore_query.py`, `continuity_audit.py` —
  grep-inspected for structure, with the specific contamination/donor claims below confirmed by
  reading the exact lines.
- `app/package.json` and repository root layout — inspected to settle D1 against what tooling
  actually exists today (no monorepo/workspace tooling, no test framework beyond hand-rolled
  `tsx` scripts).

No MrLore file was modified. `git status --short --branch` in `_mrlore` was not re-run at the end
of this specific increment since only `Read`/`Bash grep` (no writes) touched it — the directory
was never opened for writing.

---

## D1 — Physical ownership and repository home

**Question (blueprint, verbatim in substance):** where does the kernel physically live; who
owns its contract, release, and version; how do consumers pin it; how is cross-repo drift
detected?

**Competing choices:** (a) inside MrLore's repository; (b) inside `app/src/lib/` mixed with
Onceaponatime's own authority code; (c) a brand-new, independent git repository with its own
release/package process; (d) a physically separate package *inside* the Onceaponatime repository,
with no reverse import from `app/`.

**Evidence:** `app/package.json` is a single flat npm project (`"name": "react-example"`) with no
`workspaces` field, no `pnpm-workspace.yaml`, no `lerna.json` anywhere in the repo root — confirmed
by direct listing. Tests are hand-rolled `tsx` scripts wired into one aggregate `npm test`, not a
package-aware test runner. There is no second physical repository this session can see for EngAIn.
MrLore is a separate Python toolchain with its own `git` remote (per the blueprint's own MrLore
preservation check) — a different language and authority model entirely.

**What MrLore does:** everything lives in one Python repo/toolchain, files-based, one implicit
consumer (itself).

**What Onceaponatime does:** everything lives in one npm project (`app/`); `bootstrapManifest.ts`
already models a project-neutral vocabulary but is physically inside `app/src/lib`, imported
directly by `app/src/lib/prepareBootstrap.ts` and React components — i.e., Onceaponatime's own
"neutral" vocabulary is *not* currently physically separated from its authority code, which is
exactly the pattern the kernel must not repeat at a bigger scale.

**Classify:** (b) is a dangerous authority coupling — a future EngAIn consumer importing from
inside Onceaponatime's own package would invert the intended dependency direction (the direction
doc's own table: Onceaponatime is "authority consumer, not kernel owner"). (a) is rejected outright
by the hard non-goals ("no MrLore changes," and MrLore is Python while every current Onceaponatime
surface is TypeScript). (c) is premature infrastructure — there is no second real consumer with
actual code today to justify a cross-repo pin/version/drift-detection mechanism; inventing one now
means guessing at requirements no one has yet. (d) is the smallest reusable-concept choice that
respects the authority boundary without inventing unused machinery.

**Decision:** the kernel is a new, physically separate directory at the Onceaponatime repository
root (exact name settled at contract freeze; a working name is `kernel/`), with its own
`package.json`, its own `tsconfig`, and its own test scripts — zero imports from `app/src` or
`app/server`, and zero imports in the reverse direction until an explicit adapter is built. `app/`
consumes it only through that adapter, via a plain relative/`file:`-style path reference (the
mechanically simplest thing that works inside one physical repository today). Contract and release
ownership stay with whoever currently governs the B-series decisions in this repository (no new
role is invented). "Pinning" for now means: the kernel package's own `package.json` version field
changes only on a deliberate, reviewed edit, and every behavioral change must be provable by the
kernel's own independent test suite before any Onceaponatime code is allowed to depend on the new
behavior — never a silent, bundled change. Cross-repository verification (a real second repo, a
real EngAIn consumer, a real drift-detection mechanism) is explicitly deferred until a second real
consumer exists to design against.

**Rejected alternatives, explicit:** MrLore's repo (wrong language/authority model, hard non-goal
anyway); `app/src/lib/` (inverts consumer/owner direction); an independent repository today
(premature — no second consumer, no tooling need proven yet); an implicit "decide during
implementation" (explicitly forbidden by Gate G1-DESIGN's own forbidden-activity list — "selecting
a path by simply creating it first").

**Consequences for the G1 contract:** the frozen contract must name the exact kernel directory
path and its own `package.json` name before RED; the adapter's import boundary becomes a concrete,
testable static-reachability check exactly like B2/B3/B4's existing reachable-import-graph tests.

**Explicitly deferred:** promoting the kernel to its own physical git repository; a package
registry/publish process; any EngAIn-side consumption mechanism; automated cross-repo version-drift
detection.

**Clarification (hardening pass):** physical incubation inside the Onceaponatime repository must
not be read as, or drift into, semantic ownership. Restating the direction document's own table
("Onceaponatime: authority consumer, not kernel owner") as a structural rule, not merely a stated
intention:

```text
kernel package
    imports nothing from app/src or app/server; contains zero references to StoryProject,
    BootstrapProposal, actor_proposal/object_proposal/etc., or any other Onceaponatime-specific
    concept, by name or by shape

Onceaponatime adapter (a new, separate file, per D12)
    may import from the kernel package

Onceaponatime authority (decisions, admission, canonical StoryProject mutation)
    never lives inside, or depends on, the kernel package
```

This is verified the same way B2/B3/B4's existing reachable-import-graph tests already verify
comparable one-directional boundaries — a static scan of the kernel package's own source proving it
never imports anything under `app/`. Physical co-location inside one repository is a deployment
convenience (D1's own decision); it creates no dependency in the forbidden direction, and the frozen
G1 contract must include this reachable-import-graph check as one of its own structural guarantees,
not merely as adapter-side hygiene.

---

## D2 — Source bytes and coordinate semantics

**Question:** is source identity byte- or text-based; what coordinate system; how are repeated
spans and stale sources handled?

**Evidence — Onceaponatime:** `AuthorSourceDocument.exactText` is documented as "preserved
byte-for-byte as entered" (`types.ts`); `SourceEvidenceUnit.startOffset`/`endOffset` are JS string
indices (UTF-16 code units, since every consumer uses `.slice()`); `bootstrapManifest.ts`'s
`assertValidEvidence()` independently re-verifies `sourceDoc.exactText.slice(start, end) ===
unit.exactText` on every structural validation — copied text alone is never trusted, matching the
blueprint's own required invariant almost word for word. `bootstrapDiscovery.ts`'s
`segmentSourceDocument()` mints `unitId` as
`` source-unit:${docId}:${startOffset}:${endOffset} `` — two identical paragraphs in one document
get two different, coordinate-derived unit ids. Staleness is decided by
`sourceDocumentsAreIdentical()`'s exact field-by-field comparison, explicitly documented as "the
primary freshness proof," not the FNV-1a fingerprint alone (which the same file's comment calls "a
self-consistency/tamper marker... not a collision-resistant identity claim").

**Evidence — MrLore:** `ARTIFACT_SCHEMA.md` uses `source_line` (1-indexed line number) and
`source_span` (`<line_start>-<line_end>`) plus a separately-copied `surrounding_quote` — a
line-based, quote-copy coordinate system, weaker than exact character offsets against one pinned
text (it does not survive same-line edits, and the "evidence" is a copy, not a coordinate pair
independently re-verifiable against a single canonical text blob).

**Classify:** Onceaponatime's UTF-16-offset-plus-independent-reverification scheme is the reusable
concept — already adversarially hardened across four B-series slices. MrLore's line/quote-copy
scheme is weaker prior art to avoid, not a donor mechanic.

**Decision:** G1's `EvidenceSpan` coordinates are UTF-16 code-unit offsets into the exact
`SourceDocument` text, with no normalization performed on the stored text (no NFC/NFD, no newline
canonicalization). Identity is `(sourceDocumentId, startOffset, endOffset)` plus the exact witnessed
text, independently re-verified against the live `SourceDocument` at validation time — reused
verbatim from `assertValidEvidence()`'s pattern. Two spans with identical text but different offsets
are different `EvidenceSpan`s (repeated-text-in-one-document case solved by construction). Identical
text in two documents is distinguished by `sourceDocumentId` (repeated-text-across-documents case
solved by construction). Staleness is decided the same way `sourceDocumentsAreIdentical()` already
does — exact field comparison, not fingerprint-only trust. Line/column are allowed only as an
optional, derived *display* convenience computed from offsets on demand, never as identity.

**Why:** reuse an already-fielded, adversarially-reviewed mechanism rather than invent a new,
unproven one; UTF-16 offsets are the natural fit for a TypeScript kernel using the same `string`
primitive Onceaponatime already uses.

**Consequences:** G1's `SourceDocument`/`EvidenceSpan` are structurally close to Onceaponatime's
existing `AuthorSourceDocument`/`SourceEvidenceUnit` by design, which lowers the D12 adapter's risk
to near-relabeling for this part of the translation.

**Deferred:** byte-offset support for a future non-JS consumer; any encoding-declaration/failure
policy beyond "the text is a JS string, already decoded" (no consumer today hands the kernel raw
bytes).

**Clarification (hardening pass, not a change):** UTF-16 code-unit offsets are part of **this G1
implementation's TypeScript representation** because TypeScript/JavaScript is the first (and, for
this increment, only) kernel implementation language and its native `string` type already uses
UTF-16 code units — this is not a claim that UTF-16 is a universal or language-neutral literary
coordinate system. A future non-JS adapter (e.g. a Python-hosted consumer) is responsible for
converting its own native coordinate system into the kernel's declared UTF-16 convention before
calling the kernel, or a later, separately versioned contract may generalize the coordinate
representation (e.g. an explicit, declared coordinate unit per `SourceDocument`) if a real non-JS
consumer ever needs it — not decided or assumed here. The four invariants this decision protects
remain exactly as stated, restated together for clarity:

```text
same text + different offsets in one document  = different EvidenceSpans
same text + different documents                = different EvidenceSpans
edited/changed bound source                    = stale evidence (fails closed)
a copied quote alone, without coordinates       = insufficient identity, never accepted
```

---

## D3 — Identifiers, serialization, and fingerprints

**Question:** how are ids minted, how is content serialized/fingerprinted, and how are the five
distinct identity concepts (diagnostic fingerprint/artifact identity/source binding/proposal
identity/consumer-admission identity) kept separate?

**Evidence — Onceaponatime:** a complete, working, four-slices-of-adversarial-review-hardened
scheme already exists in `bootstrapManifest.ts`: `stableSerialize()` (sorted object keys,
explicit `Number.isFinite` rejection, explicit unsupported-type rejection, array order preserved
as semantically meaningful), `fingerprintString()` (FNV-1a 32-bit, explicitly documented as a
tamper/self-consistency marker, *not* claimed collision-resistant), `expectedBootstrapManifestId()`
/`expectedEntryId()` (content-derived, deterministic), `deepFreeze()`. `fingerprintEntrySources()`'s
own comment explicitly walks through why one field (`refinesBaselineEntryId`) had to be excluded
from a hash to avoid a self-referential id — direct evidence this scheme has already survived a
real circularity bug.

**Evidence — MrLore:** `art_<hash_prefix>` per-token ids and `source_hash` (SHA-256) are
content-derived and fine. But `CHR-0001`, `FAC-0001`-style entity ids (`REGISTRY_SYMBOL_TABLE_
SCHEMA.md`, confirmed in `registry_builder.py`'s `assign_entity_ids()`) are a type-scoped
*incrementing counter*, not content-addressed — an artifact of one specific mutable registry file,
order-dependent unless the registrar enforces strict determinism (not evidenced).

**Classify:** Onceaponatime's serialization/fingerprint family is the reusable concept. MrLore's
counter-minted entity ids are a reasonable *display* convention but not a safe content-identity
algorithm to import into the kernel core.

**Decision — repaired (hardening pass).** The original decision let a short, explicitly
non-collision-resistant FNV-1a fingerprint stand in for artifact identity in some places, and
separately proposed a kernel-minted incrementing `IdentitySymbol` id — both were contradictions
this pass closes.

*Fingerprint versus identity, made explicit.* Onceaponatime's own `bootstrapManifest.ts` comment
already concedes the FNV-1a family is "a self-consistency/tamper marker... not a collision-resistant
identity claim." G1 must act on that concession structurally, not merely repeat it as a caveat. Five
distinct concepts, kept explicitly separate, restated in the corrected terms:

```text
1. diagnostic / self-consistency fingerprint   — the FNV-1a family, unchanged in mechanism
2. deterministic artifact identity             — a kernel record's real identity (below)
3. source binding identity                     — which exact SourceDocument set something is
                                                  bound to (sourceDocumentsAreIdentical()'s exact
                                                  field-by-field comparison, reused verbatim,
                                                  never the fingerprint alone)
4. consumer proposal identity                  — owned entirely by the consumer's own adapter/
                                                  manifest (e.g. BootstrapManifestEntry.id);
                                                  the kernel never mints or interprets this
5. consumer admission identity                 — owned entirely by the consumer's own receipt
                                                  scheme (e.g. bootstrap-receipt:...); likewise
                                                  never kernel-owned
```

(1) is retained as a cheap, non-authoritative diagnostic: a quick "did anything change" signal and
an optional lookup-bucket key for an in-memory index. It is *never* sufficient, alone, to conclude
two records are the same record, and no G1 code path may treat a fingerprint match as a merge/dedup/
replace decision.

(2), **deterministic artifact identity**, is the corrected core of D3: for every G1A–C record whose
content *can* define it (`EvidenceSpan`, `Observation`, and — see the `IdentityCandidate` rework
below — the renamed identity-clustering record), the record's real identity is **Option B**: a
complete deterministic structural key whose equality is independently verifiable, not a compressed
digest. Concretely, this is `stableSerialize()`'s own canonical output over the record's
identity-defining fields, used directly as the identity key (not hashed down to 32 bits first).
`stableSerialize()`'s existing guarantees (sorted object keys, JSON's own unambiguous structural
delimiting of strings/arrays/objects, explicit non-finite-number rejection) already make this
injective by construction: two different values can never produce the same canonical serialization,
so two different `Observation`s or `EvidenceSpan`s can never collide on this key, full stop — there
is no "short hash" step in the identity path at all. The existing FNV-1a fingerprint may still be
computed *from* that same canonical serialization purely as a compact diagnostic/bucket key (per
(1) above), but it is downstream of identity, never identity itself.

**Explicit answer to "what happens if two different serialized observations produce the same short
fingerprint?"** Nothing treats them as the same. Their `stableSerialize()`-based identity keys
remain different (by construction, per the injectivity argument above), so they remain two distinct
records under any correct implementation. The failure this decision actually forecloses is
structural, not merely definitional: any G1 code that indexes records by their short diagnostic
fingerprint (e.g. a hashmap used purely for lookup speed) must store a bucket of colliding
candidates and re-check full `stableSerialize()` equality before returning a match — it may never
return "found" on a bucket hit alone. This is a required structural test (see the revised proposed
RED gate below), not merely a documented intention — mirroring how `sourceDocumentsAreIdentical()`
already relates to `fingerprintSourceDocuments()` today: the fingerprint is a hint, the field-by-field
comparison is the proof.

*Collision-resistant digests, deferred correctly.* This decision does not select SHA-256 (or any
other real cryptographic digest) now, and does not need to: G1A–C hold every record fully in memory
(per D8), so full structural equality is always checkable directly — there is no scenario in the
first frozen slice where two records must be compared *without* both being available to compare in
full. A real collision-resistant digest only becomes necessary once a record must be identified
*without* holding its full content for comparison — e.g. a future G1E persistence/index layer
comparing a stored digest against an incoming record without reading the whole store first. That is
explicitly named as a **required precondition G1E's own freeze must resolve**, not a permissively
open deferral: G1E may not ship without deciding a real digest algorithm for exactly this purpose.

**Decision — identity-layer minting (repaired together with D5/D12; renamed, see the hardening-pass
summary above).** The prior "IdentitySymbol ids minted per-project via a kernel-owned incrementing
counter" is withdrawn — it contradicted G1A–C's own purity/statelessness (D8) and conflated
"identity candidate" with "accepted identity" (see the rewritten `IdentityCandidate` definition in
D5 below). The renamed `IdentityCandidate`'s id is, like `Observation`'s, **content-derived** —
`stableSerialize()` over its own defining fields (its detector origin, and the exact, sorted set of
`Observation` ids it currently clusters) — recomputed identically given the same inputs, requiring
no mutable registrar, no incrementing counter, and no persistence. A consumer's own stable,
project-owned canonical id (e.g. Onceaponatime's `actor_001`, per `PROPOSAL.md`'s own "Stable
Internal Identity" section — already exactly this pattern, already proven) is minted entirely by
that consumer, never by the kernel, and is recorded — if at all — only inside that consumer's own
`DecisionRecord` (D10), which the kernel stores opaquely without interpreting the mapping. A future,
separately authorized registrar/persistence layer (G1D/E) may *additionally* mint a durable,
human-friendly symbol id as a consumer-facing convenience alias layered on top of the content-derived
identity (mirroring how MrLore's own `CHR-0001`-style ids are, per D3's original finding, a display
convention layered over real evidence, never the identity mechanism itself) — but this is explicitly
deferred, never assumed by G1A–C.

**Why:** avoids introducing a new cryptographic dependency merely because one was named in this
task (per instruction); reuses `stableSerialize()`'s already-proven injectivity property instead of
inventing a new collision-resistance mechanism; and removes the one place (identity-symbol minting)
where the prior design secretly required kernel-owned mutable state despite claiming purity
elsewhere.

**Consequences:** G1A's serialization/identity module still extracts near-verbatim from
`bootstrapManifest.ts`'s `stableSerialize()`, but the frozen contract must now specify, per record
type, exactly which fields are "identity-defining" (fed to the structural key) versus merely
descriptive (excluded from it) — a new, concrete freeze-time requirement this correction surfaces
that the original D3 answer did not need, since it never had a real identity key distinct from the
fingerprint to define.

**Deferred:** a real collision-resistant digest algorithm, required before G1E's own freeze (not an
open-ended deferral, per above); retry/idempotency-key mechanics for a future durable write, using
B4's `refinementSessionId`+ordinal+idempotency-key pattern as the template; a consumer-facing
friendly-alias registrar layered over content-derived `IdentityCandidate` ids.

---

## D4 — Core vocabulary versus extensions

**Question:** what is the smallest closed kernel core, and how do project/domain terms attach
without polluting it?

**Evidence:** the direction document's own six-concept candidate list
(`SourceDocument`/`EvidenceSpan`/`Observation`/`IdentityCandidate` [renamed from the direction
document's own working name `IdentitySymbol`; see D5's hardening-pass repair]/`ScopedStateAssertion`/
`DecisionRecord`+`AdmissionReceiptRecord`) is already sound against both codebases read this
session. MrLore's `entity_type` enum (`character|faction|species|location|system|artifact|event|
concept|group|relationship_label|unknown`, `ENTITY_STATE_SCHEMA.md`) is broader/more neutral than
Onceaponatime's own 4+2 bootstrap kinds, and already includes a first-class `unknown` — but it is
still a *fixed* list, and `ENTITY_STATE_SCHEMA.md`'s required frontmatter still hard-requires
`book_id`/`chapter_id` — confirmed contamination, not merely alleged. Onceaponatime's
`actor_proposal`/`object_proposal`/`location_proposal`/`faction_proposal` are entirely
project/domain-specific literary bootstrap concepts (`bootstrapManifest.ts`) and must never enter
the kernel core.

**Classify:** MrLore's enum shape (open-ish, has `unknown`) is a partially reusable idea; its
specific member list is itself a project-shaped ontology, not neutral enough for the kernel core.
Onceaponatime's proposal kinds are entirely project-specific and must stay in Onceaponatime's own
adapter layer.

**Decision:** the kernel's closed core is exactly the six candidate concepts, nothing else, as
first-class kernel types (though see the "Eventual kernel architecture vs. first G1A–C slice"
section below — not all six ship in the first frozen implementation contract).
`Observation.kind` and `IdentityCandidate.type` are **open, namespaced
strings** (e.g. `"onceaponatime:actor_proposal"`), never a kernel-defined enum — the kernel core
ships *zero* built-in kind/type values, only the shape of the field (non-empty namespaced string,
or the literal `unknown`/absent sentinel, which is always legal and never blocks storage). This is
stricter than MrLore's own enum and satisfies "no book/chapter/character/Burdens/EngAIn primitive
in the core" by construction rather than by a maintained blocklist. Project vocabularies (which
strings mean what, how they map to UI) live entirely in adapter-owned data/profiles, never kernel
code.

**Why:** an open namespaced string is a structural guarantee, not a maintained exclusion list —
exactly the kind of guarantee that would have prevented `registry_builder.py`'s hardcoded
`TYPE_OVERRIDES`/`MANUAL_PROMOTIONS` (see D11) from ever being possible in the first place.

**Consequences:** kernel structural validation of `kind`/`type` is purely syntactic; every
domain-level "is this kind supported" decision happens entirely in a consumer's own adapter
(Onceaponatime's `SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS` stays exactly where it is).

**Deferred:** a shared cross-consumer vocabulary-negotiation mechanism — not needed until two real
consumers must interoperate on the same evidence.

---

## D5 — Evidence, observation, assertion, and authority states

**Question:** what separate state machines exist, and which collapses (`observed != true`,
`reviewed != admitted`, etc.) must never happen?

**Evidence:** Onceaponatime already keeps `BootstrapDecision`
(`pending|approved|edited|rejected`) and `BootstrapDiscoveryClassification`
(`ambiguous|provisional|corroborated`) on two independent fields of one entry, never read by each
other — confirmed by reading every branch of `decideBootstrapManifestEntry()` and
`isBootstrapRefinementEligible()`, neither of which references `discoveryConfidence`. MrLore
independently keeps *three to four* axes on one record: `status`
(`captured|compiled|needs_review|rejected|superseded` — record lifecycle), `canon_state`
(`evidence_only|provisional|reviewed|approved` — authority/trust axis), and, at the registry layer,
`authority_level` (`evidence|compiler|human_review|canon_decision` — producer identity) plus a
*fourth*, `status` again at the registry-symbol layer
(`candidate|active|needs_review|deprecated|merged|split|rejected` — resolution lifecycle,
distinct from the entity-state file's own `status`). Both systems, independently, already prove
collapsing these is wrong.

**Classify:** convergent evidence from two unrelated systems that a single "status" field is
insufficient — a reusable, already-validated structural pattern, not a contested choice.

**Decision:** G1 defines these independent axes, none collapsible into another:

1. **EvidenceSpan validity** — binary: valid (replays against pinned source) / invalidated (source
   changed or removed). Nothing else; evidence is either an exact witness or it is not.
2. **Observation lifecycle** — `proposed | superseded | retracted`. Never "approved" — approval is
   entirely a consumer concern, outside this axis.
3. **`IdentityCandidate` resolution lifecycle** (renamed from the working name `IdentitySymbol` —
   see the repaired definition immediately below) — `candidate | needs_review | merged | split |
   deprecated`, mirroring MrLore's registry `status` values (already neutral). Deliberately excludes
   anything like "approved"/"canon."
4. **ScopedStateAssertion lifecycle** — `proposed | contradicted | superseded`. A contradiction
   never deletes either assertion. (Banked eventual-architecture axis; `ScopedStateAssertion` itself
   is not part of the first G1A–C slice — see below.)
5. **Consumer decision lifecycle** — entirely consumer-owned and stored opaquely (Onceaponatime's
   own `pending|approved|edited|rejected` is unchanged, lives entirely in Onceaponatime's own
   layer, and the kernel never interprets it).
6. **Consumer admission lifecycle** — likewise entirely consumer-owned, stored opaquely. (5 and 6
   are banked eventual-architecture axes; `DecisionRecord`/`AdmissionReceiptRecord` are not part of
   the first G1A–C slice — see below.)

Required non-collapses (restated, now grounded in evidence rather than asserted): `observed != true`
(Observation lifecycle never implies truth); `recurring != identical` (corroboration counts distinct
spans, D6); `identity candidate != accepted symbol` (axis 3 has no "accepted" state — that is a
consumer DecisionRecord); `state assertion != current state` (the kernel has no "current" concept —
only a consumer's projection over admitted assertions produces one); `reviewed != admitted`
(MrLore's own `reviewed` vs `approved` distinction already proves this is a real, not hypothetical,
distinction); `admitted by Onceaponatime != admitted by EngAIn` (two separate consumer-qualified
records, D10).

**Repaired definition (hardening pass): `IdentityCandidate`, not `IdentitySymbol`.** The original
draft used the direction document's own working name `IdentitySymbol` and, in D3, quietly gave it a
kernel-minted incrementing id — implying acceptance/canonical status ("symbol" reads as an already-
resolved referent) while also requiring hidden mutable registrar state that contradicts G1A–C's own
purity/statelessness (D8). Both problems are fixed by one rename-plus-redefinition:

```text
Observation (immutable, source-traceable, never mutated by anything downstream)
        ↓ a deterministic or model-assisted identity-resolution process groups Observations
        ↓ it believes may refer to the same underlying referent

IdentityCandidate
    id:                     content-derived (stableSerialize() over detector origin + the exact,
                             sorted set of member Observation ids) -- see D3's repaired identity
                             model; never a kernel-minted counter, never mutable registrar state
    type:                   open namespaced string, per D4 (unknown/unresolved always legal)
    memberObservationIds:   the exact, immutable set of Observations grouped -- original
                             Observations are never mutated, deleted, or made unaddressable by
                             any later merge/split/resolution change
    resolutionLifecycle:    candidate | needs_review | merged | split | deprecated -- NO
                            "approved"/"accepted"/"canonical" state exists anywhere on this type

merge(candidateA, candidateB, evidence) -> new IdentityCandidate
    fresh, recomputed content-derived id (since membership changed); candidateA/candidateB are
    marked merged, not deleted, and carry an explicit supersededBy pointer to the new id; every
    original member Observation remains independently retrievable under its own unchanged id

split(candidate, evidence) -> IdentityCandidate[]
    same shape, reversed: candidate is marked split with supersededBy pointers to the new ids;
    every original member Observation remains independently retrievable

consumer acceptance (entirely outside the kernel)
    Onceaponatime mints its OWN stable, project-owned canonical id (e.g. actor_001, per
    PROPOSAL.md's own "Stable Internal Identity" section -- already exactly this pattern) and
    MAY record, inside its own DecisionRecord (D10), a link such as
    (consumerId: "onceaponatime", proposalIdentity: <IdentityCandidate.id>, acceptedAs: "actor_001")
    -- the kernel stores this opaquely, without ever interpreting what "acceptedAs" means
```

"Candidate" was chosen over "Hypothesis"/"Cluster": it matches MrLore's own already-neutral registry
vocabulary (`candidate` status value, `merge_candidate`, `split_candidate` in
`REGISTRY_SYMBOL_TABLE_SCHEMA.md`) and Onceaponatime's own existing `candidate_types` fields
(`ActorEntity`/`ObjectEntity`/etc. in `types.ts`) — both donor vocabularies already use exactly this
word for "not yet decided," so it introduces no new terminology either side has to learn. "Symbol" is
withdrawn because it reads as an already-resolved referent, which is precisely the acceptance claim
the kernel must never make.

A future, separately authorized registrar/persistence layer (G1D/E) may mint a durable,
human-friendly alias id as a consumer-facing convenience layered on top of the content-derived
`IdentityCandidate.id` (mirroring how MrLore's own `CHR-0001`-style ids are themselves a display
convention over real evidence, never the identity mechanism) — explicitly deferred, not assumed by
G1A–C.

**Why:** both donor systems already independently learned the multi-axis lesson; regressing to one
shared "status" field in G1 would be a step backward relative to both. The `IdentityCandidate`
rename/redefinition removes a real internal contradiction (mutable kernel-owned minting state
inside an otherwise-pure kernel) rather than merely renaming a word.

**Consequences:** the structural validator needs one independent transition check per axis,
mirroring `validateBootstrapManifestStructure()`'s per-field approach; every prior reference to
`IdentitySymbol` elsewhere in this document is updated to `IdentityCandidate` for consistency
(D3, D4, D6, D10, D12, the resulting boundary, and the proposed RED gate, below).

**Deferred:** exact transition-legality tables (e.g., can a `merged` candidate return to
`candidate`?) — settled fully at contract freeze (Gate G1-CONTRACT explicitly requires "state
machines" as a package item), not sketched exhaustively here; the future friendly-alias registrar
named above.

---

## D6 — Corroboration, confidence, salience, and authority

**Question:** what separate fields exist, and how is it structurally guaranteed that none of them
becomes authority?

**Evidence — Onceaponatime:** `calculateReliability()` (`types.ts`) is a deterministic progression
table keyed on distinct-evidence-count, used only for `CodexEntity.reliability` display. Nothing in
`prepareBootstrap.ts`/`bootstrapManifest.ts` reads `reliability` or `mention_count` to decide
anything — confirmed by reading every branch of `resolveAdmittedBootstrapProposal()` and
`decideBootstrapManifestEntry()`. `BootstrapDiscoveryConfidence`'s own doc comment states it "must
never approve, reject, rank into canon, or otherwise affect admission automatically," and this is
enforced structurally, not just documented: no admission-path function reads it.

**Evidence — MrLore:** the blueprint's own donor table already flags `tools/
authority_score_calculator.py` as "linear mention authority... do not port as authority" — this
session's own inspection of the surrounding toolchain (`pass2_math.py`'s schema, §6 rule 6: "No
Silent Promotion... provisional: true is immutable") confirms the corroboration-vs-authority
distinction is understood in principle even where one component (the authority-score calculator)
already violates it in practice. That named violation is exactly the anti-pattern to exclude, not a
mechanic to port.

**Classify:** Onceaponatime's existing separation (display-only, structurally unreachable from
admission) is the reusable, already-correct pattern. MrLore's `authority_score_calculator.py` is
donor evidence of the precise failure mode to exclude.

**Decision:** G1 defines, with a structural (not merely documentary) guarantee that none can
reach admission: (a) **corroboration** = count of distinct, non-duplicate `EvidenceSpan`s/
`Observation`s, computed the same way Onceaponatime already does (distinct source-unit count,
never raw mention count — mirroring `BootstrapDiscoveryConfidence.supportingUnitCount`'s existing
distinct-unit rule); (b) **detector confidence** = bounded, per-`Observation`, detector-supplied,
always attributed to a `detectorId`/`detectorVersion` (D9), never aggregated by the kernel into a
project-wide score; (c) **salience** — excluded from G1's closed core entirely, deferred to a later
retrieval-ranking consumer (R1); (d) **authority** — never a kernel-computed field, full stop; it
can only ever appear inside an opaque, consumer-supplied `DecisionRecord`/`AdmissionReceiptRecord`
(D10).

**Repaired guard (hardening pass): closed-schema-first, not a word blacklist.** The original
decision added a reserved-fieldname rejection list (`authority`/`canonical`/`approved`/`admitted`)
as the structural enforcement mechanism. Reconsidered per instruction: if `Observation`/
`IdentityCandidate`/`ScopedStateAssertion` schemas are genuinely closed (an exact, enumerated field
set per record type, exactly like `validateBootstrapManifestStructure()`'s own exact-key-set
discipline elsewhere in this codebase, and B4a's route-boundary exact-key-set check), then *any*
unexpected top-level field — `authority`-named or not — already fails structural validation before
the question of what to name a blacklist even arises. A word blacklist is fragile in a way a closed
schema is not: it would not catch `auth`, `trust`, `isCanonical`, a translated-language key, or any
other English near-miss, and it invites an ever-growing maintained exclusion list of exactly the
kind D4 already rejected for kind/type vocabulary. The corrected rule:

```text
kernel-owned record fields are closed (an exact, enumerated set per record type; any unlisted
    top-level field fails structural validation, unconditionally -- not because of what it is
    named, but because it is not one of the declared fields)

consumer/domain extension metadata, if the kernel allows any at all, lives inside exactly one
    explicitly-named, opaque container field (e.g. consumerMetadata?: Record<string, unknown>)
    that kernel logic never reads or interprets -- only stores and returns verbatim

kernel logic never interprets anything inside that opaque container, regardless of what its
    keys are named
```

Within that one designated extension container specifically (not the closed core schema, where the
problem cannot arise at all), the corrected, non-fragile version of the original instinct is a
**namespacing requirement**, not a word-blacklist: every extension key must be namespaced (e.g.
`"onceaponatime:*"`), so a consumer cannot accidentally shadow or imply kernel authority with an
unqualified key — the same structural technique D4 already uses for `kind`/`type`, applied
consistently here instead of a second, different (and weaker) enforcement idiom.

**Why:** a closed schema is a stronger, non-fragile guarantee than a maintained blacklist of
English words — precisely the lesson D4 already drew from `registry_builder.py`'s hardcoded
overrides, now applied consistently to this decision instead of leaving one inconsistent,
weaker mechanism standing beside it.

**Consequences:** the frozen contract's structural validator needs one closed-field-set check per
record type (already implied by "closed core," now made an explicit, testable requirement) plus one
namespacing check on the single opaque extension container, replacing the withdrawn reserved-word
list entirely.

**Deferred:** salience/relevance ranking entirely (named in the direction doc's own defer list as
R1's job); any specific corroboration→display-confidence curve (Onceaponatime's own progression
table stays in Onceaponatime's own `types.ts`, not the kernel — the kernel exposes the raw distinct
count only); whether the kernel allows a `consumerMetadata` extension container at all in G1A–C, or
only from G1D onward once a real consumer decision-record use case exists — not decided here.

---

## D7 — Modality, presence, perspective, and scope

**Question:** what evidence-layer modality/scope fields does G1 need, at minimum, to avoid making
any of the seven distinctions (present/absent/remembered/believed/hypothetical/denied/unknown)
structurally impossible later; how is scope kept neutral?

**Evidence:** Onceaponatime's rich epistemic model (`KnowledgeBoundaries`, `contextCompiler.ts`'s
POV/forbidden-knowledge filtering) exists entirely downstream of canon, over already-admitted
`FactEntity`s — it has no analog at the raw-evidence layer today; bootstrap discovery only asks
"is this text-defensible," never "is this presented as presently true, remembered, or denied."
Codex's `EntityClaim.status` (`supported|provisional|unsupported|contradicted`) is the closest
existing evidence-adjacent four-state precedent. MrLore's Pass 1/Pass 2 layers (`ARTIFACT_
SCHEMA.md`/`PASS2_MATH_SCHEMA.md`) capture surface tokens and counts only — no modality encoding at
that layer either; modality-adjacent structure only appears later, in `CHAPTER_LEDGER_SCHEMA.md`
(named but not read in full this session, since D7 does not require it — noted as a gap, not
assumed resolved).

**Classify:** neither donor system has a mature, *evidence-layer* modality model to reuse wholesale
— the direction document's seven-way list is aspirational, not already proven. This is a genuine
new-design axis, kept deliberately minimal per D4's own "smallest closed core" mandate.

**Decision:** `Observation` gets one required, closed field —
`presenceState: 'asserted' | 'negated' | 'uncertain'` — plus one optional, open, consumer-defined
`perspectiveTag` string (e.g. `"narrator"`, `"character-belief:<id>"`; uninterpreted by the kernel).
This is smaller than the direction document's seven-way list by design: present/referenced-but-
absent collapses into `'asserted'` plus whatever subject/object candidate is or isn't cited;
remembered/believed/hypothetical all become `perspectiveTag` values, since *which* epistemic
category applies is project-specific vocabulary Onceaponatime already owns via
`KnowledgeBoundaries` and must not be re-invented in the kernel; denied maps to `'negated'`;
unknown/ambiguous maps to `'uncertain'`. None of the seven becomes impossible to represent later —
each needs only a new `perspectiveTag` value or a consumer-side interpretation rule, never a kernel
schema change.

Scope: a neutral `(scopeKind, scopeId)` pair (shape borrowed from MrLore's `book_id`/`chapter_id`
without requiring those specific values) plus a separate, monotonic, source-relative
`SequencePosition` (closest existing analog: Onceaponatime's per-document evidence-unit order, or
`manuscript[].beatNumber` — both just "this came before that" within one stream) plus a third,
always-optional, kernel-opaque `narrativeTimeLabel` string for in-fiction chronology (closest
analog: MrLore's incarnation-chain `era` field). These three are never collapsed into one number,
per the blueprint's explicit warning.

**Why:** keeps the evidence layer honestly minimal while satisfying every one of the direction
document's representability requirements without inventing modality machinery neither donor system
has actually proven.

**Consequences:** an Onceaponatime adapter only ever inspects `presenceState` (accepting
`'asserted'`, flagging or rejecting `'negated'`/`'uncertain'` for author attention); Onceaponatime's
own `KnowledgeBoundaries` stays untouched, entirely downstream.

**Deferred:** a full narrative-chronology/timeline model — explicitly S1/R1 work in both banked
documents.

---

## D8 — Storage boundary

**Question:** what behavioral persistence requirements must be settled before any storage
technology is chosen?

**Evidence:** Onceaponatime's B1–B4 layer is 100% pure in-memory value objects today — nothing in
`bootstrapManifest.ts`/`prepareBootstrap.ts` touches a filesystem or database; `StoryProject`
itself lives in application state (`App.tsx`'s `updateActiveProject`), outside anything read this
session. MrLore is entirely file/JSONL/YAML-based, with real, usable behavioral conventions:
`PASS2_MATH_SCHEMA.md` §6 specifies atomic temp+rename writes, manifest-gated ingest, deterministic
ordering, idempotent-by-input-hash execution, and a three-tier exit-code contract (`EXIT 0/1/2`)
distinguishing clean success from structural failure from a safety-stop requiring human review.

**Classify:** MrLore's *behavioral* conventions (atomicity, idempotency, manifest-gating,
fail-closed exit codes) are genuinely reusable and pass the donor-acceptance rule. Its *specific*
JSONL/YAML-per-file layout is an implementation accident of a database-less Python toolchain, not
something to copy. Onceaponatime has no existing durable-store precedent to reuse for storage
specifically (only for values, already reused via D2/D3).

**Decision:** G1A–C (source witnesses, observation envelopes, identity registry — the blueprint's
own implementation ladder) are **pure value/validation contracts, no persistence at all** — plain,
deeply-frozen, structurally-validated in-memory objects a caller constructs and holds, mirroring
how `BootstrapManifest` itself already works with zero persistence layer. G1D
(consumer decision/receipt storage) and G1E (any actual durable index) remain optional, separately
authorized slices, gated on a real, demonstrated need (e.g., a second process needing to read back
yesterday's evidence) — not decided now. If G1E is ever authorized, its behavioral contract borrows
MrLore's already-proven conventions (atomic temp+rename, deterministic rebuildable indexes,
input-hash-gated idempotency) rather than picking a technology first.

**Why:** satisfies the blueprint's own D8 instruction directly ("None is selected until these
behavioral requirements are agreed") and this task's "keep G1 deliberately narrow" instruction —
Onceaponatime doesn't need kernel-side persistence to prove G1A–C against its own adapter, since
`StoryProject` already persists wherever it already persists, untouched.

**Consequences:** the first frozen G1 contract can skip binding commitments on append-only-vs-
mutable/crash-recovery/locking/migrations/corruption-detection for G1A–C, deferring them to a
separately authorized G1D/E.

**Deferred:** every specific D8 requirement (append-only vs mutable indexes, atomic publication,
crash recovery, locking, migrations, query consistency, rebuildability, backup/restore) until G1D/E
is separately authorized.

---

## D9 — Detector and language adapter boundary

**Question:** how are detectors (deterministic and model-assisted) kept to proposal-only output,
with language/profile policy kept out of the core?

**Evidence:** `bootstrapDiscovery.ts` is a complete, already-working example of exactly this
boundary, hardened by the B2-correction slice and the B4a adversarial reviews:
`CAPITALIZED_STOPWORDS`/`TITLE_WORDS`/`SPATIAL_PREPOSITIONS`/`PLACE_GOVERNING_VERBS`/
`STRONG_AGENTIVE_VERBS`/`PERSON_HEAD_NOUNS`/etc. are English-specific tables living entirely inside
this one detector module, never in the shared `bootstrapManifest.ts` vocabulary;
`DetectorObservation.reasons` carries an explainable, deterministic rule-identifier vocabulary
(`'proper_name_match'`, `'spatial_preposition_governs'`, ...) — directly matching MrLore's own
`heuristic_approximation: true` transparency instinct (`PASS2_MATH_SCHEMA.md` §6.7). B4's
`bootstrapRefinement.ts` (not re-read line-by-line this session, but its shipped contract is
recorded in `TODO.md`/`COMPLETION_LOG.md` and was verified in the prior B4 closure) proves the
model-assisted half: model output is treated as untrusted proposal material, parsed defensively,
and never gains admission authority. MrLore's `identity_signal_math.py` is the same *kind* of
component (English-specific: static verb sets, capitalization, proximity co-occurrence,
`compute_avg_verb_distance`) but as a standalone script rather than one detector cleanly separated
from a shared neutral core.

**Classify:** `bootstrapDiscovery.ts`'s module-boundary pattern (one file per detector,
language-specific tables local to that file, explainable reason strings, zero admission authority)
is the reusable concept, proven across multiple adversarial reviews. `identity_signal_math.py`'s
heuristics are useful donor *content* for a possible future English-language detector, but the file
as a whole is contamination if imported wholesale (matching the blueprint's own donor-map entry for
it: "earliest target: post-G1C optional analyzer").

**Decision:** a G1 detector is an external function of shape
`(sealed EvidenceSpans, detector profile) => Observation[]`, with mandatory (not optional)
`detectorId`/`detectorVersion`/`languageProfile` metadata on every `Observation` it produces —
stronger than Onceaponatime's current `discoveryConfidence?`, since D9 explicitly requires this
always be recorded. The kernel core ships zero built-in detectors and zero language tables.
Onceaponatime's `bootstrapDiscovery.ts` becomes, conceptually, "one detector adapter that already
exists and already works" — wrapped, never rewritten; its English tables never move into the
kernel. Deterministic and model-assisted detectors share the same `Observation` envelope,
distinguished only by a `reproducible: boolean`-equivalent flag plus, for model-assisted ones, the
raw captured output bytes attached as opaque detector metadata (mirroring B4a's `InferenceReceipt`
pattern).

**Why:** reusing B2's already-hardened boundary is strictly lower-risk than inventing a new one,
and it lets D12's adapter treat `bootstrapDiscovery.ts` as an existence proof rather than something
needing to change.

**Consequences:** G1B ("observation envelopes") can be contract-tested against B2's existing logic
as an external reference fixture without importing or modifying `bootstrapDiscovery.ts`.

**Deferred:** an actual shared "language profile" registry format — not needed until a second
detector genuinely exists.

---

## D10 — Consumer authority records

**Question:** how does the kernel store decisions/receipts without interpreting their universal
meaning, and keep one consumer's admission from leaking into another's?

**Evidence:** `BootstrapReceipt`/`BootstrapReceiptEntry` (`prepareBootstrap.ts`) is a complete, real
worked example of exactly this shape: `id`/`manifestId`/`projectId` (qualification),
`boundSourceFingerprint` (source fingerprint), `admissionFingerprint` (decision identity),
per-entry `decision`/`proposed`/`admitted`/`applied`, plus (post-B4d) `refinementProvenance`/
`selectedRefinementCandidateDigest` — linkage to an upstream proposal source without
reinterpreting it. It is immutable (`deepFreeze`), produced by exactly one function, and B3d's own
RED gate exists specifically to prove nothing downstream may reconstruct or partially render it —
i.e., Onceaponatime already treats its own receipt the way D10 requires the *kernel* to treat any
consumer's receipt. MrLore's `authority_level`/`canon_state` fields are real "who produced this"
qualification metadata, but for one implicit consumer only — no existing multi-consumer
qualification pattern to borrow directly.

**Classify:** Onceaponatime's `BootstrapReceipt` shape is the best-evidenced example of "what a
consumer-qualified admission record looks like" in either codebase — reusable as the *shape*, even
though nothing today stores it against an external kernel. The specific requirement of
distinguishing *which consumer* wrote a record is genuinely new design, not a straight port.

**Decision:** `DecisionRecord`/`AdmissionReceiptRecord` are opaque containers keyed by
`(consumerId, authorityPolicyName, authorityPolicyVersion, proposalIdentity, decisionIdentity)`,
storing the consumer's decision/receipt bytes or an already-validated structured record verbatim —
the kernel never re-serializes or reformats them, mirroring how `BootstrapReceipt` is rendered
"exactly" throughout B3d/B4d — bound to the exact source/evidence/proposal fingerprints true at
decision time. Every read-path query returns the `(consumerId, policy)` qualification alongside the
record; the kernel can answer "Onceaponatime admitted this under policy X," never "this is
universally canonical." The kernel performs zero interpretation of what a stored decision *means*.

**Why:** this is the most direct implementation of the direction document's own "Core laws" using
Onceaponatime's own receipt as the concrete worked example of "supplied, not decided" data.

**Consequences:** Onceaponatime's future adapter, after a successful `prepareBootstrap()`, may
*additively* write a `(consumerId: "onceaponatime", authorityPolicyName: "bootstrap-v1", ...)`
`AdmissionReceiptRecord` into the kernel — never a replacement for `BootstrapReceipt`, which stays
exactly where it lives. This is also the exact mechanism (hardening pass, D5) by which a consumer's
acceptance of an `IdentityCandidate` as its own stable canonical id (e.g. `actor_001`) gets recorded
— an opaque `(consumerId, proposalIdentity: <IdentityCandidate.id>, acceptedAs: "actor_001")`-shaped
`DecisionRecord`, never a kernel-side "accepted" state on the `IdentityCandidate` itself. `D10`'s
own type — `DecisionRecord`/`AdmissionReceiptRecord` — is a banked eventual-architecture concept,
not part of the first G1A–C slice; see the "Eventual kernel architecture vs. first G1A–C slice"
section below.

**Deferred:** an actual second consumer (EngAIn) — the schema supports multiple `consumerId`s by
construction, but only Onceaponatime's own qualification is exercised until EngAIn work is
separately authorized.

---

## D11 — MrLore donor extraction and migration policy

**Question:** which mechanics are reimplemented, which values become project data, how are
existing MrLore artifacts (if ever) migrated, and how is parity measured?

**Evidence:** this session's own direct reading confirms, rather than merely repeats, the
blueprint's donor-extraction-map claims. `registry_builder.py` lines 60–117 hardcode
`TYPE_OVERRIDES = {"Vale": ..., "Luminaire": ...}`, `MANUAL_PROMOTIONS = {"Geralt": ...}`,
`INCARNATION_CHAINS = {"Geralt": {...sequence of "The Nameless One" → "Geralt" → "Ragnarok" →
"Man Who Flew Into The Sun" → "Mr GPT"...}}`, and `ACCESSORIES = {"Geralt": [...]}` — real
project-identity data embedded directly as Python source constants, not project data files.
`artifact_extractor.py`'s `make_chapter_id()`/`RAW_CHAPTERS`/`discover_chapters()` bake a
`book_XX_chNNN` filename convention directly into extraction control flow, not merely into
configuration. This is present-tense, verified fact, not a stale claim.

**Classify:** applying the blueprint's own eight-point donor-acceptance rule: the *mechanics*
(surface-form/artifact capture shape, Pass 2's provisional-until-explicit-promotion discipline, the
registry's multi-axis status/canon_state/authority_level lifecycle, merge/split-preserves-evidence,
incarnation-chain-preserves-sequence-without-flattening) all pass and are reusable as
re-implemented concepts. The concrete *values* found (Vale/Luminaire/Geralt/Mr GPT, the
`book_XX_chNNN` convention, the English verb/capitalization lists) all fail the rule and must never
appear in kernel code.

**Decision (reconfirming, without change, the blueprint's own already-frozen D11 answer, now
verified rather than assumed):** (a) donor files remain read-only design evidence, never a code
dependency — nothing is imported or path-referenced from `_mrlore/`; (b) each mechanic gets an
independent, from-scratch TypeScript re-implementation, verified by G1's own tests, never compared
byte-for-byte against MrLore's Python output; (c) the concrete project values found belong entirely
to that project's own data, exactly like Onceaponatime's own actor names never appear in
`bootstrapManifest.ts`; (d) whether/how existing MrLore artifacts are ever imported into a
kernel-backed store is out of scope for every slice through G1E — a separately authorized future
ticket, not assumed; (e) parity, if ever measured, means "the same underlying evidence/identity
facts are recoverable," never byte-identical shape (MrLore's shapes are contaminated by design).

**Why:** nothing discovered this session contradicts the blueprint's existing answer — the task was
to verify, and verification came back positive: the contamination is real and exactly where
claimed.

**Consequences:** none of G1A–E needs a MrLore-compatibility shim at any point.

**Deferred:** everything in (d)/(e) above; whether MrLore-the-application itself is ever
refactored onto the kernel later (an open question in the blueprint, correctly left open here).

---

## D12 — Onceaponatime adapter boundary

**Question:** which kernel proposal kinds are eligible for the first adapter; how do they map into
`BootstrapProposal` kinds; how is evidence translated; what is explicitly forbidden?

**Evidence:** `SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS` (`bootstrapManifest.ts`) is the exact existing
eligibility list (`actor_proposal|object_proposal|location_proposal|faction_proposal`).
`buildBootstrapManifest(project, discovery: BootstrapDiscoveryPayload)` — read in full — has *no*
dependency on `discoverBootstrap()` (B2) at all; it accepts any conforming `BootstrapDiscoveryPayload`
regardless of origin. This means the seam the blueprint's A0/A1 gates ask to "reconfirm" already
exists, exactly as hoped, and is unchanged by B4 closure — B4 only added fields onto the manifest
*entry*, downstream of `buildBootstrapManifest()`, never onto its discovery-payload input contract.

**Classify:** reusable concept, requiring zero Onceaponatime production-code change to exploit — a
strong, direct confirmation that the master direction document's "no B2 replacement" non-goal is
cheap to honor in practice, not merely in principle.

**Decision:** the first Onceaponatime adapter (blueprint gates A1/A2, not built in this increment)
is a pure function, living in a new Onceaponatime-side file (not inside the kernel package, not
inside `bootstrapDiscovery.ts`), that: (1) accepts only kernel `Observation`/`IdentityCandidate`
values whose open `kind`/`type` string matches an explicit, adapter-owned mapping table — never a
fuzzy match; (2) re-derives `SourceEvidenceUnit`s by re-validating kernel `EvidenceSpan`
coordinates against the exact same `boundSourceDocuments` already bound to the target manifest,
never trusting the kernel's own copy of the text; (3) leaves any non-mapping kernel kind
unsupported/omitted, never coerced; (4) produces `discoveryConfidence` only when the kernel's
corroboration/detector data honestly translates into Onceaponatime's existing
`ambiguous|provisional|corroborated`+`supportingUnitCount`+`reasons[]` shape, otherwise leaves it
absent; (5) creates zero decisions, zero assignments, never imports or calls
`decideBootstrapManifestEntry`/`prepareBootstrap`/`updateActiveProject` — its only output feeds the
existing, unchanged `buildBootstrapManifest()`; (6) is rerun-safe/deterministic, matching every
other B-series function.

**Repaired naming (hardening pass).** The original name,
`translateKernelProposalsToBootstrapDiscoveryPayload()`, accidentally granted the *kernel* a
"proposal" concept — `proposal` is Bootstrap-domain vocabulary (`BootstrapProposal`,
`BootstrapDiscoveryEntry`) that must live entirely on the Onceaponatime side of the boundary. The
kernel exposes only evidence, observations, and identity candidates (per D4/D5); it must never be
described, even in a function name that lives outside it, as producing "proposals." A provisional
corrected name — **not frozen**, per instruction, since the exact input type still needs inspection
against whatever the frozen G1A–C contract actually exports —
is `buildBootstrapDiscoveryPayloadFromKernelEvidence(kernelEvidence: { observations:
readonly Observation[]; identityCandidates: readonly IdentityCandidate[] }, boundSourceDocuments):
BootstrapDiscoveryPayload`. The exact parameter shape (a bundle of observations plus identity
candidates, versus something narrower) is deliberately left open here and must be settled once
G1A–C's own frozen contract exists to inspect — this decision fixes the *naming/authority direction*
problem, not the exact TypeScript signature.

Restated explicitly, since this is the one place the two systems actually touch: **the kernel core
must remain unaware that Bootstrap exists** — no kernel-package file may reference
`BootstrapProposal`, `actor_proposal`/`object_proposal`/etc., `BootstrapManifest`,
`BootstrapDiscoveryPayload`, or any other Onceaponatime-specific name, by import or by string
literal. All of that vocabulary lives exclusively inside the adapter function above and its mapping
table, on the Onceaponatime side of D1's physical/semantic boundary (restated in D1's own
hardening-pass clarification).

**Why:** reuses `buildBootstrapManifest()`'s already-decoupled seam exactly, requires no widening
of `SUPPORTED_BOOTSTRAP_PROPOSAL_KINDS` or any other authority-bearing constant, keeps the adapter a
pure, review-only translation with the same shape B2 already has, and keeps "proposal" a
consumer-owned word rather than letting it leak into the kernel's own vocabulary or the function
name describing the kernel's output.

**Consequences:** this is what makes G1A–C buildable and testable before any Onceaponatime code
change at all — the adapter's contract can be frozen and RED-gated entirely against
`BootstrapDiscoveryPayload`'s already-shipped shape.

**Deferred:** A3 (wiring the adapter into a live `BEGIN STRUCTURAL REVIEW` UI path) and A4
(whether kernel-backed discovery ever becomes default/optional-per-project) — both explicitly
later, separately-authorized gates in the blueprint.

---

## Eventual kernel architecture vs. first G1A–C slice (hardening pass, Correction 3)

The original document called all six direction-document concepts "the closed core" without
distinguishing what the *first* implementable slice actually needs to prove. That was too broad:
nothing in this session's evidence shows `ScopedStateAssertion` or `DecisionRecord`/
`AdmissionReceiptRecord` is required to prove the minimum substrate for progressive evidence and
identity understanding — both banked documents' own sequencing (`evidence → identity → later scoped
state/history → retrieval → continuity consumers`) already says these are later work. The two lists
are now stated explicitly and are allowed to differ:

```text
EVENTUAL KERNEL TYPES (unchanged from the direction document; banked architecture, not all
implemented now):
  SourceDocument
  EvidenceSpan
  Observation
  IdentityCandidate                          (renamed from the working name IdentitySymbol)
  ScopedStateAssertion                       (banked; not in G1A-C)
  DecisionRecord / AdmissionReceiptRecord    (banked; not in G1A-C)

G1A-C FROZEN-SLICE CANDIDATES (the actual first implementation contract target):
  SourceDocument
  EvidenceSpan
  Observation
  IdentityCandidate
  identity-resolution evidence (the merge/split candidate records IdentityCandidate's own
      lifecycle already requires -- not a seventh type, part of IdentityCandidate's own shape)
  pure corroboration / merge / split projections (functions, not new stored types)
```

`ScopedStateAssertion` stays banked eventual architecture, picked up only when S1 (scoped state
history) is separately authorized — introducing it now would be building state-assertion machinery
before the evidence/identity substrate it depends on is even proven. `DecisionRecord`/
`AdmissionReceiptRecord` likewise stay banked, picked up only when G1D (consumer decision/receipt
storage) is separately authorized — Onceaponatime already has a complete, working consumer-authority
system (`BootstrapReceipt`, per D10) that needs nothing from G1A–C to keep functioning; building a
generic receipt-storage system merely to prove evidence/identity correctness would be scope
creep the "keep G1 deliberately narrow" instruction specifically warns against.

## Resulting high-level G1 boundary

```text
arbitrary SourceDocuments (UTF-16 text, no book/chapter requirement)
        ↓
exact, replayable EvidenceSpans (offset-based, independently re-verified)
        ↓
Observation[] (open namespaced kind, presenceState, detector-attributed,
               proposal-only, no admission authority)
        ↓
IdentityCandidate clusters (open namespaced type, merge/split preserves
               every witness via content-derived ids, no repetition-based
               auto-promotion, no "accepted" state anywhere)
        ↓
Onceaponatime adapter (buildBootstrapDiscoveryPayloadFromKernelEvidence, name
               provisional — pure, review-only, zero decisions/assignments,
               kernel remains unaware Bootstrap exists)
        ↓
existing BootstrapDiscoveryPayload → buildBootstrapManifest() → BootstrapReviewWorkspace
        ↓
existing explicit author decision → existing prepareBootstrap() → existing BootstrapReceipt
```

First G1A–C frozen-slice types (four, plus pure projections — see above): `SourceDocument`,
`EvidenceSpan`, `Observation`, `IdentityCandidate`. No persistence anywhere in this slice; no
kernel-computed authority/salience field anywhere; no built-in kind/type vocabulary; no
book/chapter/character/Burdens/EngAIn primitive anywhere in the core; no kernel-minted mutable
registrar state (identity is content-derived throughout, per D3's repair).

## Explicitly deferred beyond this document (unchanged from the banked direction/blueprint, now
reconfirmed against real code rather than merely asserted)

```text
ScopedStateAssertion and the full scoped-state transition ledger (S1)
DecisionRecord / AdmissionReceiptRecord kernel-side storage (G1D)
historical relational retrieval (R1)
NarrativeContextSelector integration
automatic Codex generation
continuity auditing (C1)
knowledge ownership propagation
POV retrieval
thread/reveal retrieval
narrative salience ranking
complete merge/split UI
persistent database choice (G1E, gated separately; also where a real collision-resistant digest
    becomes a required precondition, per D3's repair)
automatic corpus migration
MrLore compatibility layer
a second real consumer (EngAIn) and any cross-repo pin/version mechanism (D1)
a consumer-facing friendly-alias registrar layered over IdentityCandidate ids
```

## Proposed — not implemented — next-stage G1 RED gate (revised, Correction 8)

This is a **surgical, first-slice-only** proposal, narrowed from the prior revision to match the
G1A–C/eventual-architecture split above: it proves only `SourceDocument`, `EvidenceSpan`,
`Observation`, and `IdentityCandidate`, never `ScopedStateAssertion` or `DecisionRecord`/
`AdmissionReceiptRecord` (those get their own, separately authorized gates when S1/G1D exist), and
never the Onceaponatime adapter's own behavior in detail (that is D12's own future A1 gate, per the
blueprint — this RED only proves the kernel remains structurally unaware of Bootstrap, not that the
adapter itself works correctly). It still does not replace the blueprint's own
G1-CONTRACT/G1-RED gate process, which governs the real freeze-then-RED sequence, and it is still a
proposal, not RED — writing it is explicitly out of scope for this increment.

1. Arbitrary `SourceDocument`s (no book/chapter/directory convention) produce structurally valid,
   deeply-frozen kernel values; a document missing/malformed in any required field fails closed.
2. `EvidenceSpan` coordinates are UTF-16 code-unit offsets (a TypeScript-representation choice, per
   D2's hardening-pass clarification, not a universality claim) that independently re-verify against
   the exact pinned `SourceDocument` text; a tampered/mismatched `exactText` fails closed.
3. Repeated identical text at different offsets in one document remains distinct; identical text
   across two documents never collides — both by construction of the `(sourceDocumentId, offsets)`
   identity, not by a fingerprint check.
4. Evidence validation fails against stale/changed source text — reusing
   `sourceDocumentsAreIdentical()`'s exact field-by-field comparison, never the fingerprint alone.
5. `Observation`s remain immutable and source-traceable after any later `IdentityCandidate`
   merge/split/resolution-state change — an `Observation` fetched by its own id before and after such
   a change is byte-identical.
6. An `IdentityCandidate`'s resolution status never moves past `candidate` from `Observation` volume
   alone — corroboration count rises with repetition; resolution state changes only via an explicit
   call representing a resolution decision, never automatically from observation count.
7. Corroboration is computed from the count of distinct `EvidenceSpan`/`Observation` ids, never raw
   mention count (reusing the distinct-unit rule `BootstrapDiscoveryConfidence.supportingUnitCount`
   already proves out) — a toxic fixture with many duplicate-content, colliding-fingerprint
   observations must still report the correct *distinct* count.
8. A merge or split operation preserves every contributing `Observation`/`EvidenceSpan` reference —
   none deleted, none silently reassigned; the superseded `IdentityCandidate`(s) remain independently
   retrievable by their own (unchanged) ids with an explicit `supersededBy` pointer, never deleted or
   overwritten; the toxic fixture "split candidate reassigns evidence silently" must fail closed.
9. An unknown/unsupported `Observation.kind` or `IdentityCandidate.type` is preserved as
   unknown/unsupported through every kernel-core operation — never coerced into a recognized kind by
   any code path.
10. **Fingerprint-versus-identity (new, Correction 1):** two distinct `Observation`s or
    `EvidenceSpan`s constructed to share the same short diagnostic (FNV-1a) fingerprint but with
    genuinely different `stableSerialize()`-based content never become the same record through any
    kernel operation — any fingerprint-keyed lookup structure must return every colliding candidate
    for a full structural equality check, never the first fingerprint match alone.
11. G1A–C perform zero durable writes; every operation is a pure function over supplied values,
    verified by re-running twice on identical input and asserting byte-identical, reference-fresh
    output (no hidden mutation of caller-owned input).
12. **Kernel unaware of Bootstrap, and closed-schema-first (new/merged, Corrections 1, 4, 5, 6):** a
    static source scan of the kernel package proves (a) no kernel-core type, constant, or default
    value names a real project identity (no "Vale"/"Luminaire"/"Geralt"-shaped literal, no
    `book_XX_chNNN` convention — mirroring B2/B3's reachable-import-graph tests); (b) no kernel-package
    file imports anything from `app/src` or `app/server`, or references `BootstrapProposal`,
    `actor_proposal`/`object_proposal`/etc., `BootstrapManifest`, or `BootstrapDiscoveryPayload` by
    name; (c) every kernel-core record type rejects any field outside its own exact, enumerated field
    set (closed-schema check, replacing the withdrawn reserved-fieldname blacklist) — an attempt to
    add a top-level `authority`/`canonical`/`approved`/`admitted` field (or any other unlisted field)
    to a core record fails structural validation unconditionally.

Toxic fixtures required by the blueprint's own Gate G1-RED list that apply to this narrowed
first slice (repeated text same/different document, multibyte Unicode before/inside a span, changed
source with stale coordinates, duplicate JSON keys, non-finite numbers, shuffled record order,
duplicate ids, unknown ontology term, a Burdens-shaped identity embedded in a purported core config,
a merge candidate dropping one witness, a split candidate silently reassigning evidence) are all
represented, each as its own isolated failing test per the blueprint's RED-domain separation rule.
Toxic fixtures specific to consumer-qualified records or persistence atomicity (a high-confidence
proposal with no consumer decision; one consumer's admission record presented as another's;
interrupted/retried publication) are explicitly deferred to G1D/E's own, separately authorized RED,
not folded in here, per the eventual-architecture/first-slice split above.

The Onceaponatime adapter's own detailed behavior (mapping table correctness, evidence
re-derivation, zero-decision/zero-assignment proof, the exact reachable-import-graph ban on
`decideBootstrapManifestEntry`/`prepareBootstrap`/`updateActiveProject`) remains a separate,
adapter-specific RED gate under the blueprint's own A1 gate, authorized only once G1A–C's own
contract is frozen and shipped — not folded into the kernel's own RED, consistent with "do not force
adapter tests... into this first RED" from this task's own instructions.

---

## Files inspected this session (for the record)

```text
Onceaponatime:
  TODO.md, COMPLETION_LOG.md,
  POST_B4_LORE_EVIDENCE_KERNEL_DIRECTION.md, POST_B4_MRLORE_MECHANICS_INTEGRATION_BLUEPRINT.md,
  app/src/types.ts, app/src/lib/bootstrapManifest.ts, app/src/lib/bootstrapDiscovery.ts,
  app/src/lib/prepareBootstrap.ts, app/src/lib/codexEngine.ts (grep + full read of
  detectIdentityEvidence/computeDistinctEvidenceCount/mergeClaims),
  app/server/contextCompiler.ts (grep of structure), app/package.json, repository root layout.

MrLore (read-only; nothing modified):
  schema/ARTIFACT_SCHEMA.md, schema/PASS2_MATH_SCHEMA.md, schema/ENTITY_STATE_SCHEMA.md,
  schema/REGISTRY_SYMBOL_TABLE_SCHEMA.md (all read in full),
  tools/registry_builder.py, tools/artifact_extractor.py, tools/identity_signal_math.py,
  tools/continuity_audit.py, tools/mrlore_query.py (grep-inspected structure; specific
  contamination/donor lines read directly and quoted above), tools/pass2_math.py (schema doc read;
  tool file structure grepped only).
```

`LITERARY_MECHANICS.md` and `PROPOSAL.md` were listed in the original D1–D12 pass's Step 1 reading
list; their relevant content (identity-neutral entity model, progressive discovery, alias
resolution, reliability scoring) was judged already represented in `app/src/types.ts` and
`app/src/lib/codexEngine.ts`, which were read directly.

## Files re-inspected for this hardening pass

```text
G1_LORE_EVIDENCE_KERNEL_DESIGN.md (this file, prior revision — read in full before editing),
POST_B4_MRLORE_MECHANICS_INTEGRATION_BLUEPRINT.md, POST_B4_LORE_EVIDENCE_KERNEL_DIRECTION.md
(re-checked against the corrections; neither required amendment),
LITERARY_MECHANICS.md (grepped for identity/merge/split/canonical/alias, then read the "Entity
Splitting"/"Entity Merging"/"Established Fact vs. Inference" section in full — confirms identity
confidence is already kept separate from other confidence axes and that inference must never
silently become canon, both consistent with, and supporting, Corrections 1-2),
PROPOSAL.md (grepped for identity/canonical/merge/split/neutral/kernel, then read the "Absolute
Identity-Neutrality Rule"/"Stable Internal Identity" section in full — confirms the consumer-owned,
project-minted stable id pattern (actor_001, etc.) that Correction 2's IdentityCandidate/consumer-
acceptance split is built on already exists and is proven in this exact codebase),
app/src/lib/bootstrapManifest.ts, app/src/lib/bootstrapDiscovery.ts, app/src/lib/prepareBootstrap.ts
(re-checked the specific functions cited in the corrections: stableSerialize(), fingerprintString(),
sourceDocumentsAreIdentical(), assertValidEvidence(), validateBootstrapManifestStructure(),
buildBootstrapManifest()).
```

No MrLore file was re-read or modified for this pass (none of the seven corrections required new
MrLore evidence beyond what the original D1–D12 pass already gathered).
