Yes. This is exactly the kind of thing that deserves its own `LITERARY_MECHANICS.md`, because none of it is automatically implied by “build a storytelling framework.” We could easily build generation, rewriting, and character sheets and completely forget the machinery that makes the story progressively understand itself.

I’d classify what we just developed as a set of core literary-memory mechanics:

1. **First-Pass Entity Recognition**
   The first time something meaningful appears, the framework identifies it as a possible persistent entity and assigns a neutral ID.

```text
"an old iron key"
        ↓
object_001
```

At this point the system knows very little. It records only what the text actually establishes.

2. **Subsequent-Pass Entity Resolution**
   Every later mention is compared against existing entities rather than automatically creating a new one.

```text
PASS 1
"an old iron key"
→ object_001

PASS 2
"the key beneath the glass"
→ candidate object_001

PASS 3
"the iron key in actor_002's hand"
→ object_001 strongly reinforced
```

This is where continuity begins to emerge.

3. **Mention Tracking**
   The system keeps every meaningful occurrence of an entity.

Not merely:

```text
object_001 exists
```

but:

```text
object_001
├─ mention_001
├─ mention_014
├─ mention_037
└─ mention_061
```

Each mention has source location, scene position, surrounding actors, wording, and other context.

4. **Relational Accumulation**
   Repeated mentions teach the framework how an entity relates to the rest of the story.

```text
object_001
    located_at → location_003
    possessed_by → actor_002
    used_during → event_017
    known_by → actor_004
    connected_to → thread_006
```

The Codex therefore becomes relational rather than merely descriptive.

5. **Temporal State Tracking**
   Relationships can change over time.

```text
T1 object_001 → located_at location_003
T2 object_001 → missing
T3 object_001 → possessed_by actor_002
```

The framework must retain history rather than overwriting everything with the latest state.

6. **Evidence Accumulation**
   Every interpretation should retain the evidence that produced it.

```text
claim:
mention_037 refers to object_001

evidence:
- same physical description
- prior location reference
- same associated actor
- explicit phrase "the same key"
```

This prevents the system from merely producing conclusions with no traceable basis.

7. **Confidence Scoring**
   Interpretations accumulate confidence as compatible evidence appears.

```text
mention_002 → object_001
confidence: 0.64

mention_003 → object_001
confidence: 0.83

mention_004 → object_001
confidence: 0.97
```

But confidence needs to apply independently to different claims.

```text
entity identity confidence
attribute confidence
relationship confidence
event confidence
inference confidence
```

A framework may be 99% confident that an object is `object_001`, while only 55% confident that `actor_002` stole it.

8. **Confidence Revision**
   Confidence must be reversible.

New evidence may:

```text
reinforce
weaken
contradict
split
replace
```

an earlier interpretation.

The framework cannot treat its first interpretation as permanent truth.

9. **Established Fact vs. Inference**
   This is critical.

```text
ESTABLISHED:
actor_002 possesses object_001

INFERRED:
actor_002 stole object_001
```

The prose may establish possession without establishing how possession occurred.

Inference cannot silently become canon.

10. **Contradiction Detection**
    New accepted text should be compared against existing relational state.

```text
Existing:
object_001 was destroyed.

New candidate:
actor_004 picks up object_001.
```

That should trigger investigation rather than quietly becoming another Codex entry.

11. **Entity Splitting**
    Sometimes early mentions that looked like one thing turn out to describe two things.

```text
initial hypothesis:
mention_004 + mention_011 → object_003

later evidence:
mention_004 → object_003
mention_011 → object_017
```

The graph needs to be able to correct itself without destroying the original evidence.

12. **Entity Merging**
    The reverse must also happen.

Two apparently different things may later be revealed to be the same entity.

```text
object_004
object_012

later revelation:
same object

→ merge identities while preserving mention history
```

13. **Codex Accumulation**
    The Codex should be generated from accumulated story understanding rather than manually authored as the primary source.

Underneath:

```text
mentions
+ entities
+ relationships
+ state changes
+ evidence
+ confidence
```

produce the author-readable Codex.

14. **Codex Retrieval**
    When generating or rewriting, the model should not receive the entire Codex.

The framework retrieves relevant information:

```text
current scene
        ↓
actors present
objects involved
locations
related events
active threads
relevant facts
knowledge restrictions
        ↓
context package
```

That is literary retrieval.

15. **Relational Retrieval**
    Retrieval should not depend only on matching words.

If `actor_001` enters `location_005`, the framework should potentially retrieve information about:

```text
location_005
objects currently there
actors associated with it
prior events there
active threads tied to it
facts known about it
```

because those are graph relationships.

16. **Narrative Salience**
    Separate from confidence.

Something repeatedly involved in significant events should become more narratively salient.

```text
object_001
mentions: 1
salience: low

object_001
mentions: 14
connected actors: 5
connected events: 8
active thread involvement: 3
salience: high
```

High salience does not mean true. It means important to the narrative.

17. **Knowledge Ownership**
    A Codex fact should know who has access to it.

```text
world truth
reader knows
actor_001 knows
actor_002 suspects
actor_003 does not know
```

This keeps relational memory from causing information leakage.

18. **Provenance**
    Every important Codex claim should know where it came from.

```text
fact_042
source:
chapter_004
scene_009
mention_117
```

Then the system can trace a continuity conclusion back to the prose.

19. **Accepted-State Promotion**
    Draft material should not feed the permanent Codex automatically.

```text
generated prose
→ candidate interpretation
→ validation
→ author accepts
→ update relational story state
→ update Codex
```

Otherwise rejected generations would contaminate memory.

20. **Transactional Reversal**
    If accepted prose gets undone, all literary-state changes caused by that prose must also undo.

```text
undo operation_021
        ↓
remove/revert:
mention_187
event_055
relationship changes
confidence changes
Codex changes
current-state changes
```

That keeps manuscript and memory synchronized.

So I would make the file roughly:

```text
LITERARY_MECHANICS.md

1. Purpose
2. Entity Recognition
3. Mention Tracking
4. Entity Resolution
5. Relational Accumulation
6. Temporal State
7. Evidence
8. Confidence
9. Fact vs Inference
10. Contradiction Handling
11. Merge / Split
12. Narrative Salience
13. Codex Accumulation
14. Codex Retrieval
15. Relational Retrieval
16. Knowledge Ownership
17. Provenance
18. Accepted-State Promotion
19. Reversal / History
```

And I would put one governing sentence right at the top:

> **The framework must not merely remember what has been written. It must progressively identify, relate, qualify, and retrieve what the story has established.**

That captures the whole thing.

The important architectural distinction we found today is essentially:

```text
CODEX = human-readable story knowledge

RELATIONAL STORY GRAPH = underlying machine memory

MENTIONS = evidence

CONFIDENCE = certainty about interpretation

RETRIEVAL = how that accumulated understanding gets back to the storyteller
```

Those five pieces together are much more powerful than a conventional lorebook.
