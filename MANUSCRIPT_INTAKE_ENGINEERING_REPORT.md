# Author Manuscript Intake Baseline — Engineering Report

Status: Bounded RED → GREEN slice complete.

Repository: `/mnt/data-drive/onceaponatime`

Baseline HEAD (before this slice): `b389945` (`fix: surface Story Workbench operation failures to the author`)

## Governing authority rule

```text
author-supplied prose
= authoritative source material

machine-derived actors / objects / locations / facts / POV /
beat boundaries / relationships / knowledge / state
= proposals, not truth
```

This slice implements only the first half: a legitimate way for an author's own prose to
enter a project, preserved exactly, without fabricating any of the second half to make it
fit existing schemas. Bootstrap Analysis (turning that prose into reviewed proposals) and
Promotion Manifest Phase 2 are explicitly out of scope and were not touched.

## Problem statement (inspected before writing anything)

`StoryProject`, the manuscript-beat shape, `handleNewProject`, the Header project selector,
and the runtime/persistence model were inspected first. Findings:

- The app has no persistence layer at all — `projects: StoryProject[]` lives only in React
  state (`App.tsx`), cloned via `JSON.parse(JSON.stringify(...))` for undo/rollback
  snapshots. No database, no autosave, nothing to migrate.
- `handleNewProject` built a hardcoded `StoryProject` literal with a real actor
  (`actor_001`, "the traveler") and a real location (`location_001`, "The Crossroads") —
  fabricated demo canon presented as if it were the author's story, every time NEW was
  clicked.
- There was no textarea, file input, or any other intake path anywhere in `App.tsx`.
- Each `manuscript` beat requires `povActorId` and `locationId` (both non-nullable
  strings) — a real semantic claim about who experienced the beat and where. Forcing
  imported prose into this shape would require inventing both.

## Schema constraint discovered

`StoryProject.activePovActorId: string` and `currentPosition.location_id: string` /
`location_label: string` are required, non-nullable, with no "not yet established"
representation in the type. A truly empty project still has to supply *some* value for
each.

**Considered and rejected:** widen these to `string | null`. This is the structurally
correct fix, but every read site — `StoryEditor.tsx`, `Header.tsx`,
`server/contextCompiler.ts`, `server/narrativePipeline.ts`, `src/lib/promotionIntegrity.ts`,
`src/lib/preparePromotion.ts` — currently treats them as guaranteed non-null strings. Doing
this properly means updating every one of those call sites, which is a second bounded
slice on its own, not part of an intake baseline.

**What was actually done:** a freshly-imported project uses `''` for `activePovActorId`
and `currentPosition.location_id`/`location_label`, paired with genuinely empty
`actors`/`locations` arrays. `''` cannot collide with any real generated id
(`actor_001`, `location_004`, …) and asserts nothing about who or where — it is not a
placeholder actor or location, it is the honest absence of one. This is different in kind
from the old `'actor_001'`/`'The Crossroads'` fabrication: no entity with that identity or
description exists anywhere in the project.

One consequence surfaced during inspection: `Header.tsx`'s POV display had a hardcoded
`'actor_001'` string fallback for when no actor matches `activePovActorId`. For an intake
project (`activePovActorId === ''`, `actors: []`), that fallback would have displayed a
fake-looking entity id in the header. Fixed as a one-line change to `'Unassigned'` — this
is the only pre-existing code touched outside what the new type/lib/UI required.

Purely organizational `StoryPosition` fields that assert no entity claims — `act`,
`chapter`, `scene`, `beat` — were not treated as part of this constraint. They're
labels/counters, not references to canonical entities, so `chapter: <source label>`,
`act: 'Unassigned'`, `scene: 'Unresolved'`, `beat: 1` are honest without inventing
anything.

No other constraint blocked a semantically empty `StoryProject`. `manuscript`, `actors`,
`objects`, `locations`, `factions`, `facts`, `threads`, `reveals`, `mentions`,
`temporalHistory` are all plain arrays and accept `[]` with no minimum-population
requirement.

## Exact source-document type

Added to `app/src/types.ts`, additive only:

```ts
export type AuthorSourceDocumentType = 'pasted_prose' | 'uploaded_file';

export interface AuthorSourceDocument {
  readonly id: string;
  readonly label: string;
  readonly exactText: string;
  readonly sourceType: AuthorSourceDocumentType;
  readonly importedAt: number;
}
```

`'uploaded_file'` is reserved for a later slice; nothing in this commit emits it — file
upload was explicitly out of scope for this baseline.

## Where source material lives

```ts
export interface StoryProject {
  // ...unchanged...
  codexEntities?: CodexEntity[];
  sourceDocuments?: AuthorSourceDocument[]; // new, optional, same precedent as codexEntities
}
```

Optional, following the exact precedent already set by `codexEntities?`. This means the
three existing `DEFAULT_PROJECTS` entries required zero changes — `sourceDocuments` is
simply `undefined` for them, which every read site treats as equivalent to `[]`. Proven
in `tests/manuscriptIntake.test.ts::testExistingDemoProjectsAreUntouchedByTheAdditiveField`.

Construction logic lives in `app/src/lib/manuscriptIntake.ts` — two pure functions,
no React, no `fetch`, no provider import:

- `createAuthorSourceDocument(params)` — wraps text into a frozen `AuthorSourceDocument`.
- `createManuscriptIntakeProject(input)` — builds a complete, valid, but narratively empty
  `StoryProject`, with at most one `AuthorSourceDocument` attached (zero if the paste was
  empty).

`createManuscriptIntakeProject` takes no existing `StoryProject` as an argument at all —
by construction it has nothing to mutate.

## Proof imported text is preserved

`tests/manuscriptIntake.test.ts`:

- `testExactTextIsPreservedVerbatim` — leading/trailing whitespace, repeated internal
  spaces, tabs, blank lines, unicode (`café`, curly quotes, em dash, emoji) all compared
  with strict `assert.equal` against the exact input string.
- `testFunctionAppliesNoLineEndingNormalizationItself` — feeds both a CRLF string and an
  already-LF string through `createAuthorSourceDocument` and asserts neither is altered.
  This documents the one allowed divergence explicitly: a browser `<textarea>` DOM value
  normalizes CRLF/CR to LF *before* any JavaScript, including this code, ever sees the
  string. That happens upstream of everything in this repository and cannot be observed or
  controlled here; this test proves the code adds no *further* transformation of its own
  in either direction.
- `testAuthorSourceDocumentIsFrozen` — `Object.isFrozen(doc)` is true; attempting to write
  `exactText` afterward throws.
- `testSourceDocumentSurvivesTheAppsExistingJsonSnapshotPattern` — runs a constructed
  project through `JSON.parse(JSON.stringify(...))`, the exact clone pattern `App.tsx`
  already uses for undo/promotion snapshots, and asserts the text (including embedded
  newlines, quotes, a backslash, and unicode) survives byte-for-byte.

## Proof no narrative semantics are fabricated

`testImportedProjectFabricatesNoNarrativeStructure` asserts, on a project built from real
pasted prose: `actors`, `objects`, `locations`, `factions`, `facts`, `threads`, `reveals`,
`mentions`, `manuscript`, and `temporalHistory` are all `[]`; `activePovActorId === ''`;
`currentPosition.location_id === ''`; `knowledge.world_truth`/`reader_knowledge` are `[]`
and `knowledge.actor_knowledge` is `{}`. `testBlankPasteProducesNoSourceDocumentButStillNoFabrication`
proves the same holds even with no source document attached at all.
`testDoesNotCallAnAiProviderOrRequireHermes` is a structural/timing proof rather than a
network assertion — construction is synchronous and completes in under 50ms, and the test
file imports nothing from `modelProvider`/`HermesProvider`/`fetch`.
`testCreationTakesNoExistingProjectAndCannotMutateOne` snapshots a `DEFAULT_PROJECTS` entry,
constructs an unrelated intake project, and asserts the demo project is byte-identical
afterward (`assert.deepEqual`).

## Exact UI path

Header's existing **NEW** button (unchanged prop name `onNewProject`, now wired to
`handleOpenIntake` instead of the old inline-template creator) opens
`ManuscriptIntakeModal`: Project Title, Source/Chapter Title or Label, a large optional
paste textarea, Cancel, and a primary button reading **Import Manuscript** (paste
non-empty) or **Create Blank Project** (paste empty). Submission goes straight into
`createManuscriptIntakeProject` with no intermediate transformation of the pasted text.

After creation, `StoryEditor.tsx` (Story Workbench tab, left column, above the Manuscript
Chronicle) renders a new **"Author-Supplied Source Material"** card — but only when
`project.sourceDocuments` is non-empty, so it is invisible for all three existing demo
projects and for a truly blank intake project. Each document's `exactText` is rendered
with `whitespace-pre-wrap` so blank lines and spacing are visible exactly as entered, under
an **"Authoritative / Unstructured"** tag and the caption *"Preserved exactly as entered.
Not yet interpreted, structured, or converted into story state."* Nothing labels it
machine-generated, extracted, validated, or structurally resolved.

Relational Graph, Knowledge & Reveals, Temporal State, and Accumulated Codex are untouched
by this slice and read the same empty arrays as before — they stay empty/unresolved for an
intake-only project, as required.

## Compatibility with existing demo projects

`testExistingDemoProjectsAreUntouchedByTheAdditiveField`: all three demo projects
(`The Clockmaker's Vault`, `Whispers in the Sunken Archive`, `The Crossroads of Ash`) are
still present with unchanged titles; `sourceDocuments` is `undefined` on all three (never
required); their real `activePovActorId`/`currentPosition.location_id`/actor data are
unchanged and non-empty. No entry in `app/src/data/defaultProjects.ts` was modified.

## Verification

```text
cd app
npm run test:manuscript-intake   -> "manuscript intake baseline regression passed"
npm test                          -> exit 0, all suites including the above
npm run lint                      -> tsc --noEmit, clean
npm run build                     -> vite build + esbuild bundle, clean
git diff --check                  -> exit 0
```

RED was proven in an isolated `git worktree` checked out at `b389945` with *only*
`tests/manuscriptIntake.test.ts` copied in (no production files present) — running it
failed with `ERR_MODULE_NOT_FOUND` for `src/lib/manuscriptIntake`, exit 1. The worktree and
its `node_modules` symlink were removed afterward; the main working tree was untouched
throughout.

## Git

```text
Baseline HEAD:  b389945 fix: surface Story Workbench operation failures to the author
RED commit:     9dc8d20 test: require an author manuscript intake baseline
GREEN commit:   1b6a196 feat: add Author Manuscript Intake Baseline
Docs commit:    (this file)
Working tree: clean at each commit above.
Pushed: no
```

## Confirmation: no AI / Bootstrap / Promotion Manifest work occurred

No provider/model SDK was imported or called anywhere in this slice. No Hermes
configuration was added or changed. No Bootstrap Manifest concept, type, or code exists.
`src/lib/promotionManifest.ts` and `src/lib/preparePromotion.ts` were not modified and are
still unwired from `App.tsx`, exactly as before this slice. Stage 1/Stage 2 rendering,
`server/contextCompiler.ts`, and `server/narrativePipeline.ts` were not modified. No
persistence, database, or autosave was added. Nothing was pushed.
