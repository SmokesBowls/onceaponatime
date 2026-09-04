import assert from 'node:assert/strict';
import type { AuthorSourceDocument, StoryProject } from '../src/types';
import type {
  BootstrapDiscoveryEntry,
  BootstrapProposal,
  SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import {
  discoverBootstrap,
  segmentSourceDocument,
} from '../src/lib/bootstrapDiscovery';

type DiscoveryClassification = 'ambiguous' | 'provisional' | 'corroborated';

interface DiscoveryConfidence {
  readonly classification: DiscoveryClassification;
  readonly supportingUnitCount: number;
  readonly reasons: readonly string[];
}

type DiscoveryEntryWithConfidence = BootstrapDiscoveryEntry & {
  readonly discoveryConfidence: DiscoveryConfidence;
};

const SUPPORTED_KINDS = new Set([
  'actor_proposal',
  'object_proposal',
  'location_proposal',
  'faction_proposal',
]);

function sourceOnlyProject(pastedText: string): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b2_red',
    projectTitle: 'B2 RED Fixture',
    sourceLabel: 'Imported Source',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b2_red',
  });
}

function firstDocument(project: StoryProject): AuthorSourceDocument {
  const document = project.sourceDocuments?.[0];
  assert.ok(document, 'fixture requires one source document');
  return document;
}

function entityEntry(
  entries: readonly BootstrapDiscoveryEntry[],
  label: string,
): BootstrapDiscoveryEntry | undefined {
  const normalized = label.toLowerCase();
  return entries.find((entry) => {
    const proposal = entry.proposed;
    if (!('working_label' in proposal)) return false;
    return [proposal.working_label, proposal.name, ...proposal.aliases]
      .filter((value): value is string => typeof value === 'string')
      .some((value) => value.toLowerCase().includes(normalized));
  });
}

function entityEntries(entries: readonly BootstrapDiscoveryEntry[]): BootstrapDiscoveryEntry[] {
  return entries.filter((entry) => 'working_label' in entry.proposed);
}

function assertExactEvidence(
  unit: SourceEvidenceUnit,
  documents: readonly AuthorSourceDocument[],
): void {
  const document = documents.find((candidate) => candidate.id === unit.sourceDocumentId);
  assert.ok(document, `evidence must reference a real source document: ${unit.sourceDocumentId}`);
  assert.equal(
    unit.exactText,
    document.exactText.slice(unit.startOffset, unit.endOffset),
    'evidence text must equal the exact source slice at its recorded offsets',
  );
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      keys.add(key);
      collectKeys(item, keys);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// 1. Exact source units and stable identities
// ---------------------------------------------------------------------------

function testSegmentationProducesExactStableUnitsForRepeatedParagraphs() {
  const document = firstDocument(sourceOnlyProject('Keen waited.\n\nIsla listened.\n\nKeen waited.'));

  const first = segmentSourceDocument(document);
  const second = segmentSourceDocument(document);

  assert.equal(first.length, 3, 'three paragraph blocks must produce three non-semantic units');
  assert.deepEqual(second, first, 'identical source must produce byte-for-byte stable units');
  assert.equal(new Set(first.map((unit) => unit.unitId)).size, first.length, 'repeated text at different offsets needs distinct unit IDs');
  for (const unit of first) assertExactEvidence(unit, [document]);
  assert.notEqual(first[0].unitId, first[2].unitId, 'unit identity must include source position, not only text');
}

// ---------------------------------------------------------------------------
// 2. Multiple source documents cannot collide
// ---------------------------------------------------------------------------

function testSegmentationIsCollisionFreeAcrossSourceDocuments() {
  const base = sourceOnlyProject('Keen waited.');
  const first = firstDocument(base);
  const second: AuthorSourceDocument = {
    ...first,
    id: 'source_b2_red_second',
    label: 'Second Imported Source',
  };

  const units = [
    ...segmentSourceDocument(first),
    ...segmentSourceDocument(second),
  ];

  assert.equal(units.length, 2);
  assert.equal(new Set(units.map((unit) => unit.unitId)).size, 2, 'document identity must participate in unit identity');
  for (const unit of units) assertExactEvidence(unit, [first, second]);
}

// ---------------------------------------------------------------------------
// 3. Discovery is synchronous and pure
// ---------------------------------------------------------------------------

function testDiscoveryDoesNotMutateSourceOrCanonicalProjectState() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const before = structuredClone(project);

  const result = discoverBootstrap(project);

  assert.ok(!(result instanceof Promise), 'B2 deterministic discovery must not become an inference workload');
  assert.deepEqual(project, before, 'discovery must not mutate source documents or canonical project state');
  assert.deepEqual(project.actors, []);
  assert.deepEqual(project.locations, []);
  assert.deepEqual(project.manuscript, []);
}

// ---------------------------------------------------------------------------
// 4. Real manuscript names attack the inherited multiword-name assumption
// ---------------------------------------------------------------------------

function testSingleTokenNamesAreDiscoverable() {
  const project = sourceOnlyProject(
    'Keen entered Ironspire. Isla followed him. Ulric waited beside the gate.',
  );
  const result = discoverBootstrap(project);

  for (const label of ['Keen', 'Isla', 'Ulric', 'Ironspire']) {
    const entry = entityEntry(result.entries, label);
    assert.ok(entry, `${label} must be discoverable without requiring a multiword proper name`);
    for (const evidence of entry.evidence) assertExactEvidence(evidence, project.sourceDocuments ?? []);
  }
  assert.equal(entityEntry(result.entries, 'Keen')?.proposed.kind, 'actor_proposal');
  assert.equal(entityEntry(result.entries, 'Isla')?.proposed.kind, 'actor_proposal');
  assert.equal(entityEntry(result.entries, 'Ulric')?.proposed.kind, 'actor_proposal');
  assert.equal(entityEntry(result.entries, 'Ironspire')?.proposed.kind, 'location_proposal');
}

// ---------------------------------------------------------------------------
// 5. Identity evidence deduplicates without establishing truth
// ---------------------------------------------------------------------------

function testIdentityEvidenceDoesNotDuplicateOrCanonizeAnActor() {
  const project = sourceOnlyProject(
    'The hooded woman approached. "My name is Mara," said the hooded woman.',
  );
  const actors = discoverBootstrap(project).entries.filter(
    (entry) => entry.proposed.kind === 'actor_proposal',
  );

  assert.equal(actors.length, 1, 'one person described by a provisional label and disclosed name must remain one proposal');
  const actor = actors[0].proposed;
  assert.equal(actor.kind, 'actor_proposal');
  assert.equal(actor.name, null, 'detected identity evidence must not automatically establish a canonical name');
  assert.ok(
    [actor.working_label, ...actor.aliases].some((label) => /mara/i.test(label)),
    'the disclosed name should remain visible as proposal evidence or an alias',
  );
  assert.ok(
    [actor.working_label, ...actor.aliases].some((label) => /hooded woman/i.test(label)),
    'the source description must remain attached to the same proposal',
  );
}

// ---------------------------------------------------------------------------
// 6. Belief and perception are not objective facts
// ---------------------------------------------------------------------------

function testBeliefAndPerceptionDoNotBecomeObjectiveFacts() {
  const project = sourceOnlyProject(
    'Ulric believed Ironspire proved humanity needed no magic. Keen perceived blue lines beneath its walls.',
  );
  const result = discoverBootstrap(project);

  assert.ok(!result.entries.some((entry) => entry.proposed.kind === 'fact_proposal'));
  assert.ok(!result.entries.some((entry) => entry.proposed.kind === 'relationship_proposal'));
  assert.ok(
    result.entries.every((entry) => SUPPORTED_KINDS.has(entry.proposed.kind)),
    'epistemic statements must not be flattened into an unsupported or objective proposal',
  );
}

// ---------------------------------------------------------------------------
// 7. Ambiguous Codex classifications cannot be coerced
// ---------------------------------------------------------------------------

function testAmbiguousStructureIsNotForcedIntoObjectOrLocation() {
  const project = sourceOnlyProject('An ancient well hummed in the darkness.');
  const matching = entityEntries(discoverBootstrap(project).entries).filter((entry) => {
    const proposal = entry.proposed as Extract<BootstrapProposal, { working_label: string }>;
    return /well/i.test(proposal.working_label);
  });

  assert.equal(
    matching.length,
    0,
    'a structure/object/location ambiguity must not be silently coerced into a supported B1 kind',
  );
}

// ---------------------------------------------------------------------------
// 8. Confidence explains evidence strength rather than truth
// ---------------------------------------------------------------------------

function testConfidenceCountsDistinctUnitsAndReportsDeterministicReasons() {
  const project = sourceOnlyProject('Keen waited. Keen spoke.\n\nKeen left Ironspire.');
  const first = discoverBootstrap(project);
  const second = discoverBootstrap(project);
  const keen = entityEntry(first.entries, 'Keen') as DiscoveryEntryWithConfidence | undefined;

  assert.ok(keen, 'fixture requires a Keen proposal');
  assert.equal(keen.discoveryConfidence.classification, 'corroborated');
  assert.equal(
    keen.discoveryConfidence.supportingUnitCount,
    2,
    'two mentions in one source unit count once; support from a second unit counts separately',
  );
  assert.ok(keen.discoveryConfidence.reasons.length > 0);
  assert.ok(keen.discoveryConfidence.reasons.every((reason) => /^[a-z][a-z0-9_]*$/.test(reason)));
  assert.deepEqual(second, first, 'confidence reasons and ordering must be deterministic');
}

// ---------------------------------------------------------------------------
// 9. Unsupported semantics never become applicable discovery entries
// ---------------------------------------------------------------------------

function testUnsupportedFactsAndRelationshipsAreNotEmitted() {
  const project = sourceOnlyProject(
    "Keen is Isla's brother. The sky above Ironspire is green. Keen distrusts Ulric.",
  );
  const result = discoverBootstrap(project);

  assert.ok(result.entries.every((entry) => SUPPORTED_KINDS.has(entry.proposed.kind)));
  assert.ok(!result.entries.some((entry) => entry.proposed.kind === 'fact_proposal'));
  assert.ok(!result.entries.some((entry) => entry.proposed.kind === 'relationship_proposal'));
}

// ---------------------------------------------------------------------------
// 10. Empty input and repeated execution are deterministic and Codex-free
// ---------------------------------------------------------------------------

function testEmptyInputProducesNothingAndRepeatedDiscoveryIsCodexFree() {
  const blank = sourceOnlyProject(' \n\t\n ');
  assert.deepEqual(segmentSourceDocument(firstDocument(blank)), []);
  assert.deepEqual(discoverBootstrap(blank), { entries: [] });

  const project = sourceOnlyProject('Keen entered Ironspire.');
  const first = discoverBootstrap(project);
  const second = discoverBootstrap(project);
  assert.deepEqual(second, first, 'repeated discovery must preserve entry ordering and identifiers');

  const publicKeys = collectKeys(first);
  for (const forbidden of [
    'beat',
    'beatNumber',
    'evidenceBeat',
    'evidence_beats',
    'first_seen_beat',
    'last_seen_beat',
    'reliability',
  ]) {
    assert.ok(!publicKeys.has(forbidden), `B2 public output must strip Codex field ${forbidden}`);
  }
}

function run() {
  testSegmentationProducesExactStableUnitsForRepeatedParagraphs();
  testSegmentationIsCollisionFreeAcrossSourceDocuments();
  testDiscoveryDoesNotMutateSourceOrCanonicalProjectState();
  testSingleTokenNamesAreDiscoverable();
  testIdentityEvidenceDoesNotDuplicateOrCanonizeAnActor();
  testBeliefAndPerceptionDoNotBecomeObjectiveFacts();
  testAmbiguousStructureIsNotForcedIntoObjectOrLocation();
  testConfidenceCountsDistinctUnitsAndReportsDeterministicReasons();
  testUnsupportedFactsAndRelationshipsAreNotEmitted();
  testEmptyInputProducesNothingAndRepeatedDiscoveryIsCodexFree();
  console.log('B2 bootstrap discovery contract regression passed');
}

run();
