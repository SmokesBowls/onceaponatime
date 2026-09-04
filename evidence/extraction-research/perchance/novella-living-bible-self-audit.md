# NOVELLA — Living Novel Bible: Technical Architecture Audit

Status: external implementation evidence for Onceaponatime. Not a specification and not an authority source.

This report was produced by NOVELLA's own Perchance AI editor after being instructed to inspect the duplicated generator without modifying code. It is preserved as research evidence and should be verified against source before using any individual implementation claim as authoritative.

Generator: **NOVELLA — AI Novel Forge**. All logic lives in one IIFE inside `index.html` (`<script>` at line 1274); `main.pjs` only holds plugin imports + the `storyIdea` seed list. There is no `src/` tree.

---

## 1. Where the Bible data is stored

- **In memory:** global `store = {projects:[], currentId, settings}` (index.html:1291) and `current` (the active project object).
- **Persisted:** kv-plugin (IndexedDB), folder `novella`, key `KVS = 'novella.store.v1'` (index.html:1291).
  - `persist()` (index.html:1410) — debounced 700ms write: `root.kv.novella.set(KVS, store)`.
  - `loadStore()` (index.html:1389) — reads it back on boot.
  - `saveNow()` — immediate write.
- The whole `store` (all projects) is one kv value. Separate kv keys: `mangaCache`, `corpus`.

## 2. Every data structure / field used by the Bible

Project object shape from `newProject()` (index.html:2014):

| Field | Type | Role |
| --- | --- | --- |
| `p.bible` | `Array<{id, title, content}>` | **THE BIBLE** — array of markdown sections |
| `p.styleProfile` | string | authorial voice profile (feeds every prompt) |
| `p.summary` | string | **rolling/master digest** (compressed history; rebuilt alongside bible) |
| `p.pastedText` | string | full imported source text (canonical input) |
| `p.story` | `Array<{id, type, title, chapter, text, createdAt, volume?}>` | all text segments (`type`: `pasted`/`generated`/`translated`/`reader`) |
| `p.foldedCount` | int | index of first story segment *not yet folded* into digest |
| `p.plotDesign` | string | 10-section plot architecture (idea mode) |
| `p.storyState` | object | `{act, arc, arcs, ladder, openThreads, duePayoffs, established, nextBeat, secrets}` — current-position tracker |
| `p.audit` | `{at, report}` | continuity audit report |
| `p.buildPrompts` | `{idea, style, plotDesign, bible, digest}` | logged prompts (for the "View prompt" debug feature) |
| `p.digestTruncated` | bool | set when source > 4M words |
| `p.mode` / `p.mangaInfo` / `p.nameGuide` / `p.worldGenres` / `p.worldDetails` / `p.powerDetails` / `p.tropes` | — | origin & constraint metadata injected into prompts |
| `p.marathon` | object | marathon run state (not bible, but writes chapters) |

The bible itself is **unstructured**: `parseBible()` (index.html:1976) just splits the model's markdown on `^## ` lines into `{id, title, content}` sections. No schema, no entity records.

## 3. What triggers initial Bible creation

All roads lead to **`runBuild(p)`** (index.html:2087), triggered by:

- `buildFromModal()` (index.html:7275) — the **⚡ Forge New Story** modal, modes `paste` / `idea` / `plot`. Each creates a project then `await runBuild(p)`.
- `continueBuild(opts)` (index.html:5252) — **⚡ Fetch & Continue** (MangaDex, Royal Road, Toonily, ComicK, NovelUpdates, Webnovel…) → `newProject({mode:'manga', pastedText:text,...})` + `runBuild`.
- `buildFromReader(text)` (index.html:5201) — reader → "build project from this chapter".
- `continueStory()` refuses to run if `!current.styleProfile && !current.bible.length` (index.html:2231) — bible is a hard prerequisite for writing.

## 4. What happens when existing source material is first imported

`runBuild(p)` pipeline (paste path; `p.pastedText` set by import):

1. **Input:** `input = p.pastedText || sourceTextOf(p)`; a `sample` = first 12k + last 3k chars.
2. **STEP 1 — Style:** `p.styleProfile = await genStyleFromSamples(input, 'extract')` (index.html:1932) — representative beginning/middle/end samples → style profile.
3. **STEP 2 — Digest:** `digestResult = await genDigestFull(input)` (index.html:1858) — splits source into ~16k-char passages (`splitPassages`), digests each in a 4-way parallel pool (`aiRetry(ANALYZE_HEAD + passage + 'TASK: Produce a terse CHRONOLOGICAL DIGEST...')`), then **hierarchically merges** digests in batches of 6 (`DIGEST_MERGE_BATCH`) down to one master digest. Cap `DIGEST_MAX_WORDS = 4000000`; failed chunks fall back to raw excerpts. Result → `p.summary`.
4. **STEP 3 — Bible:** `p.bible = parseBible(await genBibleFromDigest(p.summary, representativeSamples(input), p))` (index.html:2146). The bible is forged from the **digest + 3 samples**, not the raw text.
5. **Story state seed:** `initStoryState(p)` then regex-extract `ladder`/`openThreads`/`arcs` from `p.plotDesign` (paste mode has none, so mostly empty).
6. **Title:** `genTitle(...)` → `p.title`.
7. **Anchor segment:** if no story and pastedText, push `{type:'pasted', title:'Source Text', chapter:1, text:p.pastedText}` (index.html:2181) — the imported text becomes Chapter 1.
8. `persist()`, `setCurrent`, switch to Studio, toast "Bible forged".

**Idea mode** differs: premise → `ideaPrompt` → `p.premiseExpanded` → `genPlotDesign` → `p.plotDesign` → `p.bible = parseBible(p.plotDesign)` (seed), then a second richer forge prompt (index.html:2151) builds a full 6-section bible from plot design + premise; fallback = plot design itself as bible.

## 5. What happens when "Append More Source" is used

- `openAppendModal()` (index.html:5638) → `appendSource()` (index.html:5650):
  1. Joins `p.pastedText` with new text (end by default, or start via `appendAtStart`): `p.pastedText = joined`.
  2. Also rewrites the existing `type:'pasted'` story segment's text to `joined`.
  3. `await rerunAnalysis()` (index.html:2195) — **full re-extraction**: re-forges `p.styleProfile`, re-digests the entire joined source into `p.summary`, and re-forges `p.bible` from scratch via `genBibleFromDigest`.
  4. Re-renders.
- Net effect: **append = full rebuild from the merged text**, not an incremental merge.

## 6. What happens after new story text is generated

`continueStory()` (index.html:2228): streaming `root.generateText` loop (chained ~700-word generations to reach target), pushes `{type:'generated'}` into `p.story`, updates `currentChapter`, persists, renders. Then three follow-ups:

- `updateStoryState(current, seg.text)` (index.html:2922) — AI rewrites `p.storyState` (act/arc/ladder/open threads/established/secrets/next beat).
- `maybeCompact(current)` (index.html:3024) — folds old segments into the digest.
- `finishIncompleteSentence(seg)` — fixes a trailing incomplete sentence.

**Critical finding: the Bible is NOT updated after generation.** No code path writes new story content into `p.bible`. Only `p.storyState` and `p.summary` (digest) change automatically. The bible goes stale until an explicit re-forge.

## 7. Every AI prompt that touches Bible information

### Extraction / build

- Per-passage digest: `ANALYZE_HEAD + piece + 'TASK: Produce a terse CHRONOLOGICAL DIGEST...' + OPEN THREADS` (`genDigest` index.html:1785, `genDigestFull` index.html:1858).
- Digest merge: `'You are merging chronological story digests into one master digest...'` (`genDigestFull`, merge level).
- **Bible forge (main):** `genBibleFromDigest` (index.html:1905) — `ANALYZE_HEAD + MASTER DIGEST + samples + nameGuide + 'TASK: Forge a PROJECT BIBLE...'` with exactly these top-level sections: World & Setting; Factions & Power Structure; Characters; Magic & Rules; Plot Threads; Themes & Tone.
- Small `genBible` (index.html:1959) — same shape, from a single sample (used for idea/no-source paths).
- Plot-design bible forge (index.html:2151 & `rebuildBibleFromPlot` index.html:5908) — plot design + premise → 6-section bible.
- `genStyle` / `genStyleFromSamples` — style profile extraction.
- `genPlotDesign` — 10-section plan (idea mode).

### Update / re-forge — all full rebuilds

- `regenAllBible()` (index.html:5816) — re-digest + `genBibleFromDigest` (or `genBible` if no source).
- `regenSection(sec)` (index.html:5802) — single-section regen: other sections as context, regenerate the named section only.
- `appendSource` → `rerunAnalysis` → `genBibleFromDigest`.

### Summarize / compress

- `maybeCompact` fold prompt (index.html:3037): update the rolling digest by merging in events, reveals, character developments, and unresolved threads from the segment being folded → `p.summary`.
- `digestRefresh` (index.html:5685): digest update after a manual segment edit.

### Audit / contradiction

- `performAudit` (index.html:2971): `SYSTEM_HEAD{bible} + STORY STATE + RECENT STORY + ROLLING DIGEST + continuity-editor task` → `CONTINUITY / KNOWLEDGE / SETUPS / REPETITION / TIMELINE / SECRETS / NEXT` report → `p.audit.report`.
- `updateStoryState` (index.html:2922): compact story-state block prompt.

### Retrieval into generation

- `SYSTEM_HEAD` (index.html:1427) — `===== PROJECT BIBLE ===== {bible}` placeholder, used by `buildWritePrompt`, `writeMarathonChapter`, `performAudit`, `maybeCompact`.
- `parsePowerSystem(bibleText(p))` — regex-scans bible text (index.html:1550+); results injected as `powerPromptAddendum`/`outlineGuidance`.
- `buildMarathonOutline` (index.html:2767) — `bibleText(p).slice(0, 4000)`.

## 8. Rebuilt from scratch vs. incrementally updated

**The Bible is rebuilt from scratch, never incrementally merged.** Every regeneration path (`runBuild`, `rerunAnalysis`, `regenAllBible`, `appendSource`, `rebuildBibleFromPlot`, `regenPlotDesign`) discards and re-forges `p.bible` from the digest/source. The digest `p.summary` is the one thing updated incrementally (via `maybeCompact` after each generation). The only per-section surgical tool is manual `regenSection` and direct textarea edits in `renderBible`.

## 9. How duplicates are handled

**Not handled programmatically.** There is no entity resolution, merge, or dedup of characters/locations/events/facts. Duplicate avoidance is delegated to prompt wording: digest merge says to remove redundancies; bible forge says never contradict the source; characters are requested one line per character. `characterNames()` only parses the Characters section for display chips. `parseBible` would accept duplicate sections.

## 10. How existing information is preserved

- **Raw source:** `p.pastedText` is retained in full; append joins rather than discards.
- **Digest:** hierarchical digest is designed to keep all events; failed chunks keep raw excerpts.
- **Bible:** preserved only while it is not re-forged. A re-forge regenerates from the digest, so information survives only if it survived digesting. Manual edits persist until a re-forge; `regenSection` keeps other sections as context.

## 11. How contradictions are handled

**Reactive, not corrective.** `performAudit` produces `p.audit.report` with `CONTINUITY/KNOWLEDGE/SETUPS/REPETITION/TIMELINE/SECRETS/NEXT` findings.

Findings are:

- rendered in the Bible tab's Continuity Audit card;
- folded back into `p.storyState.nextBeat` (NEXT) and `p.storyState.secrets` (SECRETS);
- injected into marathon chapter/outline prompts via `auditActionable(p)` as the continuity editor's latest notes.

The Bible text itself is **never auto-corrected**. Manual/auto audits run on demand or every `AUTO_AUDIT_EVERY = 8` marathon chapters.

## 12. How chapter boundaries are represented

- Each `p.story` segment carries `chapter` and `title`; `chapterNumOf(seg)` parses int-or-title; `nextChapterNum(p)` = max chapter + 1.
- Volumes: `seg.volume` is stamped by `sealVolume()` on marathon completion; separate volume export exists.
- The digest (`p.summary`) is a flat chronological bullet list — **no chapter markers inside it**; chapter identity lives only on segments.

## 13. Historical vs. current state — distinguished?

**Yes, three layers:**

1. **History (compressed):** `p.summary` rolling digest + `p.foldedCount`.
2. **Full text:** `p.story`.
3. **Current state:** `p.storyState` (act, arc, ladder, openThreads, established, secrets, nextBeat).

The Bible itself is mostly **atemporal**.

## 14. How Bible info is selected for the next continuation prompt

**The whole Bible is injected — no relevance selection.** `bibleText(p, budgetFrac)` computes a context ceiling, iterates every section, and only trims section text if token budget is exceeded. `buildWritePrompt` calls `bibleText(p, 1.0)`.

Remaining context is allocated to the story feed after Bible tokens are counted.

## 15. Whole Bible or only relevant entries?

**Whole Bible** in the writer paths (`buildWritePrompt`, `writeMarathonChapter`, `performAudit`). Token-based per-section trimming only applies when necessary. Some auxiliary paths use fixed text slices.

## 16. How old story text is summarized/compressed

- **Initial:** `genDigestFull` compresses the whole source → `p.summary` (passage digests → hierarchical merge).
- **Post-generation:** `maybeCompact` — when enough unfolded segments exist and the next prompt approaches context limits, folds the oldest unfolded segment into `p.summary` and increments `p.foldedCount`.
- **In-prompt:** `storySoFarText` always prepends `[Earlier events — digest]`, appends the recent unfolded segments, and trims bodies as necessary to fit the budget.

## 17. Persistence mechanism

kv-plugin / IndexedDB: `root.kv.novella`, key `novella.store.v1` via debounced `persist()` or immediate `saveNow()`. All bible/digest/style/story data is stored in that one project-store blob. There is no server-side project storage.

---

## Producer → Data → Receiver flow

```text
EXISTING NOVEL SOURCE
  Paste:  newPasteTa --buildFromModal--> p.pastedText
  Fetch:  continueBuild (...) ---------> p.pastedText
  Reader: buildFromReader ------------> p.pastedText
  Append: appendTa --appendSource-----> p.pastedText (joined)
                  |
                  v
BIBLE EXTRACTION (runBuild / rerunAnalysis / regenAllBible)
  p.pastedText --genStyleFromSamples--> p.styleProfile
  p.pastedText --genDigestFull---------> p.summary
  p.summary + representativeSamples + nameGuide
       --genBibleFromDigest--> raw md --parseBible--> p.bible[{id,title,content}]
                  |
                  v
BIBLE STORAGE
  p.bible / p.summary / p.styleProfile / p.storyState
       --persist()--> root.kv.novella('novella.store.v1') [IndexedDB]
                  |
                  v
CONTEXT SELECTION (per generation)
  buildWritePrompt / writeMarathonChapter:
    bibleText(p,1.0)        <- WHOLE bible (per-section token trim)
    nameGuideText(p) + projectWorldText(p) + plotDesign
    storySoFarText: digest + recent unfolded segments
    storyStateText(p) + powerPromptAddendum + auditActionable
                  |
                  v
STORY GENERATION
  continueStory(): chained root.generateText(...)
  Marathon: writeMarathonChapter -> streamSection
                  |
                  v
NEW TEXT
  seg.text -> p.story.push({type:'generated', chapter:nextChapterNum}) -> persist
                  |
                  v
BIBLE UPDATE   !! NO AUTOMATIC BIBLE WRITE PATH
  updateStoryState(text) -> p.storyState
  maybeCompact()         -> p.summary
  performAudit()         -> p.audit.report
  bible changes only via explicit reanalysis/regeneration/manual edit
                  |
                  v
NEXT GENERATION
  reads p.bible (stale until re-forged) + p.summary + p.storyState + p.audit.report
  -> buildWritePrompt -> continueStory -> new text
```

## Key takeaways

1. **The Bible is write-once-read-many.** Every generated chapter updates `storyState` and `summary`, but never the Bible; long-running stories drift from the Bible unless the user manually re-extracts/regenerates.
2. **Full rebuild, not incremental merge.** Regeneration re-forges the entire Bible from the digest/source, so preservation depends on digest fidelity.
3. **No entity/dedup/contradiction-resolution layer.** Duplicates and conflicts are handled only by prompt instruction plus a non-corrective audit report.
4. **Context = whole Bible.** No relevance/retrieval selection; only token trimming.
5. **Historical vs. current state is well separated** (digest + full story vs. `storyState`), but the Bible is atemporal and current-chapter state enters prompts through `storyState` and related context rather than the Bible.

No code was modified during the inspection.
