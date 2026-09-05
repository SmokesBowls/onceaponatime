import assert from 'node:assert/strict';
import type { AuthorSourceDocument, StoryProject } from '../src/types';
import type { BootstrapDiscoveryEntry, SourceEvidenceUnit } from '../src/lib/bootstrapManifest';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import { discoverBootstrap } from '../src/lib/bootstrapDiscovery';

/**
 * B2 discovery-quality regression: the exact, unedited manuscript excerpt
 * supplied for this fixture (author's real prose, not a contrived sentence)
 * exposes a structural gap at the B2 adapter boundary.
 *
 * `observeCodexCandidates()` (bootstrapDiscovery.ts) forwards every candidate
 * through Codex's `classifyEntityTypes()`, which decides a candidate's kind by
 * testing whether a qualifying verb appears anywhere in the *sentence* --
 * never whether the candidate itself fills that verb's subject/object/spatial
 * role. `observeSingleTokenNames()` has the mirror problem: it only accepts a
 * name immediately adjacent to one exact verb from a short hardcoded list
 * (PERSON_ACTIONS / entered|reached|arrived at|departed from), so natural
 * verb choices ("Isla breathed", "Keen remained silent", "Ironspire stands")
 * are invisible to it even though the actor/location role is unambiguous to
 * a reader.
 *
 * The correction belongs to B2's admission boundary, not to Codex:
 * `classifyEntityTypes()` / `extractNovelEntityCandidates()` and their own
 * `codexProgressiveMemory.test.ts` suite are deliberately left unchanged --
 * see TODO.md's B2 adapter-boundary rule ("B2 owns the translation
 * boundary"). This fixture constrains only `discoverBootstrap()`'s decision
 * about what a Codex observation is allowed to become.
 *
 * Target admission rule (not yet implemented -- this file is RED):
 *   actor    - candidate is agent/speaker/perceiver/experiencer in the clause
 *   location - candidate is place-like and participates in a spatial
 *              relation (in/to/from/through/at/enter/visit/explore/access)
 *   object   - candidate is a concrete thing being possessed/carried/used/
 *              built, and is not itself the agent of that verb
 *   otherwise - the observation stays unpromoted
 *
 * Do not trim, reflow, or otherwise "clean up" PASSAGE below -- B2's evidence
 * contract requires exact source-slice offsets against exactly this text.
 */
const PASSAGE = `Its towers stretched toward the sky with mathematical precision, their surfaces gleaming with metals and alloys that spoke of technological capabilities far beyond anything the rural communities possessed.

But to eyes awakened to the deeper currents that flowed beneath the surface of apparent reality, the city revealed complexities that its impressive facade was clearly designed to conceal. The geometric precision of its construction followed patterns that belonged more to sacred architecture than to simple engineering, incorporating principles that suggested understanding of forces that transcended conventional knowledge of structural mechanics and urban planning.

Isla breathed in wonder as they crested the final hill that offered an unobstructed view of the metropolis spread before them, her scholar's mind immediately recognizing architectural innovations that challenged everything she thought she understood about the capabilities of non-magical civilization. "By the old gods," she whispered, her voice carrying reverence that spoke of intellectual excitement at witnessing achievements that expanded her understanding of what was possible within the boundaries of human determination and skill.

"Without my parents," she continued, her words carrying the weight of recognition that her previous visits to the city had been filtered through the perspectives and explanations of those who had raised her, "it's like I've never seen it."

The observation carried implications that went beyond simple changes in viewpoint or maturation of understanding. Her awakened consciousness was beginning to perceive layers of meaning and significance that had been invisible to her previous visits, patterns and relationships that spoke of forces operating far beneath the surface of apparent civic achievement and technological progress.

Captain Ulric, riding alongside their small group with the bearing of someone who took personal pride in the accomplishments of his homeland, responded to her wonder with satisfaction that seemed genuine despite the complex circumstances that had brought them together. "Ironspire stands as proof that humanity doesn't need magic to achieve greatness," he said, his voice carrying conviction that spoke of deeply held beliefs about the relationship between human capability and supernatural assistance.

"Everything you see was built by skill, determination, and ingenuity," he continued, his words painting a picture of civilization that had achieved magnificent results through the application of rational principles and disciplined effort rather than reliance on forces that transcended normal understanding of cause and effect.

But even as he spoke with obvious pride about the achievements of his people, Keen remained silent beside them, her awakened senses detecting subtle wrongness in the city's energy that had nothing to do with the impressive technical capabilities on display. Her spirit-walker's awareness, once awakened during the crisis at Falcon Ridge, had proven difficult to suppress entirely, and it now provided her with perception that operated on levels far beyond normal sensory input.

The sensation was difficult to describe in terms that would make sense to someone who lacked her enhanced abilities—like a beautiful mask concealing a fundamentally different face underneath, or a magnificent performance that concealed the true nature of the actors involved. The impressive facade that Ulric described with such satisfaction seemed to her expanded awareness to be concealing deeper currents of power that had nothing to do with simple engineering or conventional technology.

As they passed through the outer defenses and formal checkpoints that controlled access to the city proper, the complexity of what they were witnessing became increasingly apparent. The guards who processed their entry carried equipment that incorporated principles belonging more to magical enhancement than to purely mechanical function, though the designs were subtle enough that casual observation might miss their true significance.

The streets themselves followed patterns that seemed designed to channel and focus energies according to principles that belonged more to sacred geometry than to practical urban planning. The buildings that lined those streets showed evidence of construction techniques that incorporated understanding of harmonic resonance and geometric relationships that transcended simple architectural knowledge.

But perhaps most significantly, the people who moved through those streets carried themselves with the unconscious awareness of those who lived in proximity to forces that operated beyond their understanding or direct control. There was a tension in the air that spoke of secrets maintained through careful discipline, of knowledge that was preserved by some while being systematically hidden from others.

As the formal escort duties concluded and they found themselves free to explore the city according to their own interests and purposes, Ulric offered guidance that carried both helpful intention and subtle warning about the complexities they might encounter.`;

function fixtureProject(): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b2_grammatical_role',
    projectTitle: 'B2 Grammatical Role Fixture',
    sourceLabel: 'Ironspire Approach',
    pastedText: PASSAGE,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b2_grammatical_role',
  });
}

function entryLabels(entry: BootstrapDiscoveryEntry): string[] {
  const proposal = entry.proposed;
  if (!('working_label' in proposal)) return [];
  return [proposal.working_label, proposal.name, ...proposal.aliases].filter(
    (value): value is string => typeof value === 'string',
  );
}

function entityEntry(entries: readonly BootstrapDiscoveryEntry[], label: string): BootstrapDiscoveryEntry | undefined {
  const normalized = label.toLowerCase();
  return entries.find((entry) => entryLabels(entry).some((value) => value.toLowerCase() === normalized));
}

function entriesMatching(entries: readonly BootstrapDiscoveryEntry[], label: string): BootstrapDiscoveryEntry[] {
  const normalized = label.toLowerCase();
  return entries.filter((entry) => entryLabels(entry).some((value) => value.toLowerCase().includes(normalized)));
}

function assertExactEvidence(unit: SourceEvidenceUnit, documents: readonly AuthorSourceDocument[]): void {
  const document = documents.find((candidate) => candidate.id === unit.sourceDocumentId);
  assert.ok(document, `evidence must reference a real source document: ${unit.sourceDocumentId}`);
  assert.equal(
    unit.exactText,
    document.exactText.slice(unit.startOffset, unit.endOffset),
    'evidence text must equal the exact source slice at its recorded offsets',
  );
}

// ---------------------------------------------------------------------------
// 1. Natural prose must surface the real named actors and locations -- not
//    only sentences hand-built to match a fixed verb-adjacency list.
// ---------------------------------------------------------------------------

function testNamedEntitiesSurviveNaturalVerbChoices() {
  const project = fixtureProject();
  const documents = project.sourceDocuments ?? [];
  const result = discoverBootstrap(project);

  const expectations: ReadonlyArray<{ label: string; kind: string }> = [
    { label: 'isla', kind: 'actor_proposal' },
    { label: 'ulric', kind: 'actor_proposal' },
    { label: 'keen', kind: 'actor_proposal' },
    { label: 'ironspire', kind: 'location_proposal' },
    { label: 'falcon ridge', kind: 'location_proposal' },
    { label: 'city', kind: 'location_proposal' },
  ];

  for (const { label, kind } of expectations) {
    const entry = entityEntry(result.entries, label);
    assert.ok(
      entry,
      `"${label}" must be discoverable from natural prose ("Isla breathed", "Captain Ulric ... responded", ` +
      `"Keen remained silent", "Ironspire stands") using verbs absent from today's fixed PERSON_ACTIONS/` +
      `location-adjacency lists`,
    );
    assert.equal(entry!.proposed.kind, kind, `"${label}" must be classified as ${kind}, not ${entry!.proposed.kind}`);
    for (const evidence of entry!.evidence) assertExactEvidence(evidence, documents);
  }
}

// ---------------------------------------------------------------------------
// 2. A qualifying verb landing anywhere in the sentence must not promote an
//    abstract noun phrase that never fills that verb's role.
// ---------------------------------------------------------------------------

function testAbstractNounsNearAQualifyingVerbAreNotPromoted() {
  const project = fixtureProject();
  const result = discoverBootstrap(project);

  // None of these is an agent, a place participating in a spatial relation,
  // or a concrete possessed/carried/built thing. Per the classification rule
  // itself each must fall through "otherwise: stays unpromoted" -- today each
  // is admitted only because a qualifying verb (e.g. "achieved", "expanded")
  // happens to appear somewhere in the same sentence.
  const mustNotBePromotedAtAll = [
    'sky',
    'expanded',
    'boundaries',
    'relationship',
    'achievements',
    'impressive technical capabilities',
    'tension',
  ];
  for (const label of mustNotBePromotedAtAll) {
    assert.equal(
      entriesMatching(result.entries, label).length,
      0,
      `"${label}" must not be promoted to any supported proposal kind -- it is not the agent, place, or ` +
      `concrete thing any nearby verb actually governs`,
    );
  }
}

// ---------------------------------------------------------------------------
// 3. A possessive property of a place is not itself a place.
// ---------------------------------------------------------------------------

function testPossessivePropertyIsNotItsOwnLocation() {
  const project = fixtureProject();
  const result = discoverBootstrap(project);

  assert.ok(
    !entriesMatching(result.entries, "city's energy").some((entry) => entry.proposed.kind === 'location_proposal'),
    '"city\'s energy" is a property belonging to the city, not a place participating in a spatial relation -- ' +
    'it must not be promoted as location_proposal',
  );
}

// ---------------------------------------------------------------------------
// 4. A plural human collective acting as the agent of a verb is not the
//    concrete object that verb governs.
// ---------------------------------------------------------------------------

function testAgentCollectivesAreNotDemotedToCarriedObjects() {
  const project = fixtureProject();
  const result = discoverBootstrap(project);

  for (const label of ['guards', 'people']) {
    assert.ok(
      !entriesMatching(result.entries, label).some((entry) => entry.proposed.kind === 'object_proposal'),
      `"${label}" is the grammatical agent of "carried" in this passage ("the ${label} ... carried ..."), not ` +
      'the concrete thing being carried -- it must not be promoted as object_proposal',
    );
  }
}

function run() {
  testNamedEntitiesSurviveNaturalVerbChoices();
  testAbstractNounsNearAQualifyingVerbAreNotPromoted();
  testPossessivePropertyIsNotItsOwnLocation();
  testAgentCollectivesAreNotDemotedToCarriedObjects();
  console.log('B2 discovery-quality grammatical-role admission contract regression passed');
}

run();
