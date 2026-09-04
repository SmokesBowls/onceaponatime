# Enhanced AI Story Generator — Extraction Evidence

Status: external implementation evidence for Onceaponatime. Not a specification and not an authority source.

Source inspected: Perchance `Enhanced AI Story Generator (Unlimited, Free, Local TTS, & Story Tracking)` generator code supplied during architecture research.

## Why this evidence matters

This generator demonstrates a small but practical long-form-writing pattern:

```text
STORY GENERATION
      |
      v
NEW STORY EVENTS
      |
      v
SEPARATE STORY-BIBLE UPDATE WORKLOAD
      |
      v
PERSISTENT TRACKED STORY INFORMATION
      |
      v
REINJECT INTO NEXT WRITING PROMPT
```

The important architectural point is that prose generation and persistent story tracking are separate workloads.

## Tracked Story Bible structure

The implementation keeps six tracked sections:

1. Player Info & Inventory
2. Other Characters
3. Locations
4. Events & Plot
5. Lore & Factions
6. Mysteries & Plot Threads

A scratchpad exists separately for author notes and is intentionally excluded from the tracked Story Bible injected into generation.

The Bible is assembled by `getCombinedStoryBibleText()` into a `<tracked_info>` block and appended to the story overview/context supplied to the writing model.

Conceptually:

```text
playerInfo
charactersInfo
locationsInfo
eventsInfo
loreInfo
mysteriesInfo
      |
      v
getCombinedStoryBibleText()
      |
      v
<tracked_info>
# STORY BIBLE
...
</tracked_info>
      |
      v
story-writing prompt
```

## Separate Bible-update workload

The core updater is driven by `bibleAutoUpdatePrompt`.

Its job is not to rewrite the story. It receives:

- the current Story Bible section;
- newly generated story events since the previous update;
- the general story overview.

It is instructed to compare the new events with the existing section and update only newly established or changed information.

Key preservation rules include:

- preserve existing information that is not mentioned by the new events;
- do not remove manually added details unless directly contradicted;
- if no relevant change occurred, return the existing section unchanged;
- do not guess ages;
- do not place main characters into the Other Characters section;
- do not mix mysteries/plot threads with lore/factions;
- avoid reaching for facts that are not explicitly stated.

This is evidence that the generator's author independently encountered entity classification, preservation, hallucination, and section-contamination problems and attempted to constrain them at the prompt layer.

## Section templates

The updater expects text templates rather than structured entity records.

Examples of expected fields include:

```text
Player Info & Inventory
- NAME
- AGE
- DESCRIPTION
- INVENTORY LIST
- RELATIONSHIPS
```

```text
Other Characters
- NAME
- AGE
- DESCRIPTION
- RELATIONSHIPS
```

```text
Locations
- NAME
- TYPE
- DESCRIPTION
- NOTABLE FEATURES
```

```text
Events & Plot
- Event Name
- DESCRIPTION
- CHARACTERS INVOLVED
- OUTCOME
```

```text
Lore & Factions
- FACTIONS/ORGANIZATIONS
- FACTION NAME
- TYPE
- DESCRIPTION
- KEY MEMBERS
- GOALS/PURPOSE
- LORE/CONCEPTS
```

```text
Mysteries & Plot Threads
- title
- DESCRIPTION
- CLUES
- STATUS
```

This is useful UX evidence, but the text itself acts as the database. There are no stable entity IDs, claim IDs, source spans, provenance records, or machine-enforced relationship schemas.

## Persistence

Tracked state is stored in browser `localStorage`, including:

- story overview;
- story text;
- generation guidance;
- tracking-enabled state;
- all six Story Bible sections;
- scratchpad;
- writing/style preferences.

This is appropriate for a lightweight browser generator but not sufficient as an authoritative project-state model for Onceaponatime.

## Long-story memory

The generator separately compresses older story material.

It contains:

- a prompt that generates story text and a summary of that text in repeated blocks;
- `summarizeChunkPrompt`, which explicitly states that the summary will be used to remind the AI of past events in a long story.

This produces a second memory channel distinct from the Story Bible:

```text
STORY BIBLE  = tracked characters / places / events / lore / threads
SUMMARY      = compressed narrative history
```

That separation is worth preserving conceptually.

## Observed extraction failure from Ironspire test

A test passage about Keen, Isla, Captain Ulric, and Ironspire produced useful structured-looking output, including:

- Keen's spirit-sight and permanent retinal scarring;
- Ironspire as a location;
- the group's arrival as an event;
- spirit-sight as a lore concept;
- the hidden nature of Ironspire as an unresolved plot thread.

However, the output also exposed prompt-only limits:

- Isla was duplicated between main-character/player tracking and Other Characters;
- placeholder relationship text survived extraction;
- Captain Ulric's belief about Ironspire was promoted into an apparent faction goal;
- membership/significance was inferred more strongly than the passage directly established;
- character perception and objective world truth were flattened together.

This is important evidence for Onceaponatime's epistemic model.

The distinction that should be preserved is closer to:

```text
CHARACTER BELIEF:
Ulric believes Ironspire proves humanity does not need magic.

CHARACTER PERCEPTION:
Keen perceives sapphire energy lines siphoning vitality.

OBJECTIVE CANON:
not automatically established merely because a character believes or perceives it.
```

## What Onceaponatime should consider stealing

The strongest reusable ideas are:

1. Keep prose generation separate from persistent semantic extraction.
2. Update story-state memory automatically after accepted prose rather than requiring a manual "update Codex" action.
3. Keep compressed narrative memory separate from structured story/world state.
4. Give the author a readable Story Bible/Codex presentation even if the authoritative representation underneath is structured.
5. Preserve old information when new material does not address it.
6. Treat open mysteries/plot threads as first-class persistent state rather than incidental prose.

## What Onceaponatime should not copy directly

Avoid making text templates the authority.

Onceaponatime should instead prefer a pipeline like:

```text
SOURCE TEXT
    |
    v
EXTRACT CANDIDATE CLAIMS
    |
    v
ATTACH SOURCE / CHAPTER / SCENE EVIDENCE
    |
    v
CLASSIFY EPISTEMIC STATUS
    |
    v
DEDUP / CONTRADICTION CHECK
    |
    v
AUTHOR-GOVERNED PROMOTION
    |
    v
MASTER CODEX
```

Then render human-readable Bible views from that structured authority.

The system should also distinguish at minimum:

- objective fact;
- narrator assertion;
- character belief;
- character perception;
- memory;
- rumor;
- prophecy;
- author note;
- unresolved theory;
- rejected/non-canon idea.

## Onceaponatime relevance summary

The Enhanced Story Generator is evidence that even a general-purpose community writing tool benefits from:

```text
write
  -> extract/update tracked state
  -> preserve persistent memory
  -> summarize old narrative
  -> reinject state
  -> write again
```

Onceaponatime can use the same high-level loop while replacing prompt-only text tracking with evidence-backed, claim-level, author-governed state suitable for both long-form literary continuity and eventual Master Codex export to EngAIn.
