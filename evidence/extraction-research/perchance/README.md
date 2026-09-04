# Perchance Extraction Research Evidence

Purpose: preserve external implementation evidence relevant to Onceaponatime's narrative extraction, progressive memory, Master Codex, continuity, and context-selection architecture.

These files are **research evidence, not Onceaponatime specifications**. They document working patterns observed in external Perchance writing systems and the limitations those systems expose. Nothing here is automatically authoritative for the Onceaponatime implementation.

## Evidence sets

### Enhanced AI Story Generator

See `enhanced-story-generator-extraction-evidence.md`.

Useful evidence for:

- automatic Story Bible tracking alongside prose generation;
- separate Bible-update workload rather than making the prose generator maintain memory itself;
- preservation-oriented section updates using existing section content plus newly generated story events;
- explicit section separation for main characters/inventory, other characters, locations, events/plot, lore/factions, and mysteries/plot threads;
- reinjection of the tracked Story Bible into future writing prompts;
- long-story compression through summary generation.

Observed limitations include prompt-only epistemic control, text-as-database storage, duplicate/misclassification risk, whole-Bible reinjection, and browser-local persistence.

### NOVELLA — AI Novel Forge

See `novella-living-bible-self-audit.md`.

Useful evidence for:

- hierarchical whole-source digestion;
- Project Bible construction from a master chronological digest plus representative source samples;
- separate rolling history, static Bible, current Story State, and continuity-audit layers;
- tracking open threads, due payoffs, established facts, secrets, and who knows them;
- context-budget management and folding older prose into a rolling digest;
- continuity checks for contradictions, character-knowledge leaks, abandoned setups, repetition, and timeline slips.

Observed limitations include a stale Bible after generated chapters, full rebuild rather than claim-level incremental merge, no entity/deduplication layer, and whole-Bible context injection rather than relevance retrieval.

## Onceaponatime relevance

The recurring external pattern is:

```text
source / prose
    -> extraction or compression
    -> persistent semantic/story state
    -> context construction
    -> generation
    -> state update / audit
```

Onceaponatime should treat these as implementation evidence while preserving its stronger requirements around source evidence, provenance, claim-level authority, author-governed promotion, chronology, character epistemics, contradiction handling, and selective retrieval.

A useful target separation is:

```text
SOURCE EVIDENCE      = where a claim came from
MASTER CODEX         = promoted structured story/world truth
NARRATIVE MEMORY     = compressed historical orientation
NARRATIVE STATE      = what matters at the current story position
CHARACTER KNOWLEDGE  = who knows what at that position
WORKING CONTEXT      = temporary scene-specific projection
```

The Master Codex should remain renderer/game-neutral so the same governed semantic truth can later support both Onceaponatime authoring and EngAIn game-world projections.
