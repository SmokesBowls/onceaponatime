import assert from 'node:assert/strict';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import {
  createAuthorSourceDocument,
  createManuscriptIntakeProject,
} from '../src/lib/manuscriptIntake';

// ---------------------------------------------------------------------------
// Source-text exactness
// ---------------------------------------------------------------------------

function testExactTextIsPreservedVerbatim() {
  const tricky = [
    '  Leading and trailing whitespace preserved.  ',
    'Internal   multiple   spaces   must survive.',
    'Line one.\nLine two.\n\nLine four after a blank line.',
    'Tabs\tare\tnot\tcollapsed.',
    'Unicode: café, “quotes”, em—dash, 📖.',
    '',
  ].join('\n---\n');

  const doc = createAuthorSourceDocument({
    id: 'source_test_001',
    label: 'Exactness Fixture',
    exactText: tricky,
    importedAt: 1_700_000_000_000,
  });

  assert.equal(doc.exactText, tricky, 'exactText must be byte-for-byte identical to the input');
  assert.equal(doc.exactText.length, tricky.length);
}

function testFunctionAppliesNoLineEndingNormalizationItself() {
  // Documents the one allowed divergence: a browser <textarea> DOM value
  // normalizes CRLF/CR to LF before any JS (including this function) ever
  // sees the string. This function must not add any *further* normalization
  // of its own -- it must not touch line endings at all, in either
  // direction, regardless of what it is handed.
  const withCrlf = 'First line.\r\nSecond line.\r\nThird line.';
  const docCrlf = createAuthorSourceDocument({
    id: 'source_test_crlf',
    label: 'CRLF Fixture',
    exactText: withCrlf,
    importedAt: 1_700_000_000_000,
  });
  assert.equal(docCrlf.exactText, withCrlf, 'must not rewrite CRLF sequences it is given');

  const alreadyLf = 'First line.\nSecond line.\nThird line.';
  const docLf = createAuthorSourceDocument({
    id: 'source_test_lf',
    label: 'LF Fixture',
    exactText: alreadyLf,
    importedAt: 1_700_000_000_000,
  });
  assert.equal(docLf.exactText, alreadyLf, 'must not alter text that is already LF-normalized');
}

function testAuthorSourceDocumentIsFrozen() {
  const doc = createAuthorSourceDocument({
    id: 'source_test_frozen',
    label: 'Frozen Fixture',
    exactText: 'Immutable once created.',
    importedAt: 1_700_000_000_000,
  });
  assert.ok(Object.isFrozen(doc), 'an AuthorSourceDocument must be frozen once created');
  assert.throws(() => {
    (doc as { exactText: string }).exactText = 'tampered';
  });
}

function testSourceDocumentFieldsAndDefaultSourceType() {
  const doc = createAuthorSourceDocument({
    id: 'source_test_shape',
    label: 'Chapter One',
    exactText: 'Once upon a time.',
    importedAt: 1_700_000_000_000,
  });
  assert.deepEqual(doc, {
    id: 'source_test_shape',
    label: 'Chapter One',
    exactText: 'Once upon a time.',
    sourceType: 'pasted_prose',
    importedAt: 1_700_000_000_000,
  });
}

// ---------------------------------------------------------------------------
// No fabricated narrative structure
// ---------------------------------------------------------------------------

function testImportedProjectFabricatesNoNarrativeStructure() {
  const project = createManuscriptIntakeProject({
    projectId: 'proj_intake_test_001',
    projectTitle: "The Author's Real Manuscript",
    sourceLabel: 'Chapter One: The Real Beginning',
    pastedText: 'The real prose the author actually wrote, word for word.',
    importedAt: 1_700_000_100_000,
    sourceDocumentId: 'source_intake_test_001',
  });

  // No fabricated entities of any kind.
  assert.deepEqual(project.actors, [], 'intake must not create actors from names in the text');
  assert.deepEqual(project.objects, [], 'intake must not create objects');
  assert.deepEqual(project.locations, [], 'intake must not create locations');
  assert.deepEqual(project.factions, []);
  assert.deepEqual(project.facts, [], 'intake must not invent facts');
  assert.deepEqual(project.threads, [], 'intake must not invent threads');
  assert.deepEqual(project.reveals, [], 'intake must not invent reveals');
  assert.deepEqual(project.mentions, []);
  assert.deepEqual(project.temporalHistory, [], 'intake must not invent state transitions');

  // No invented POV or location claim.
  assert.equal(project.activePovActorId, '', 'intake must not invent a POV actor');
  assert.equal(project.currentPosition.location_id, '', 'intake must not invent a location');

  // No invented knowledge/belief state.
  assert.deepEqual(project.knowledge.world_truth, []);
  assert.deepEqual(project.knowledge.reader_knowledge, []);
  assert.deepEqual(project.knowledge.actor_knowledge, {}, 'intake must not invent beliefs or possession');

  // The prose is not forced into the normalized manuscript-beat representation
  // (that would require inventing povActorId/locationId/beat boundaries).
  assert.deepEqual(project.manuscript, [],
    'intake must not fabricate beat boundaries by splitting prose into manuscript beats');

  // The prose is preserved exactly as authoritative source material instead.
  assert.equal(project.sourceDocuments?.length, 1);
  assert.equal(project.sourceDocuments?.[0].exactText,
    'The real prose the author actually wrote, word for word.');
  assert.equal(project.sourceDocuments?.[0].label, 'Chapter One: The Real Beginning');
}

function testBlankPasteProducesNoSourceDocumentButStillNoFabrication() {
  const project = createManuscriptIntakeProject({
    projectId: 'proj_intake_test_blank',
    projectTitle: 'A Blank Start',
    sourceLabel: '',
    pastedText: '',
    importedAt: 1_700_000_200_000,
    sourceDocumentId: 'source_intake_test_blank',
  });
  assert.deepEqual(project.sourceDocuments, []);
  assert.deepEqual(project.actors, []);
  assert.equal(project.activePovActorId, '');
  assert.equal(project.currentPosition.location_id, '');
}

function testDoesNotCallAnAiProviderOrRequireHermes() {
  // Structural proof rather than a network assertion: createManuscriptIntakeProject
  // and createAuthorSourceDocument are synchronous, return plain data, and this
  // test file never imports modelProvider/HermesProvider/fetch. If either
  // function performed inference it would have to be async and would require
  // a provider; neither is true.
  const before = Date.now();
  const project = createManuscriptIntakeProject({
    projectId: 'proj_intake_test_sync',
    projectTitle: 'Sync Proof',
    sourceLabel: 'Sync Proof Source',
    pastedText: 'Synchronous, no network, no Hermes.',
    importedAt: before,
    sourceDocumentId: 'source_intake_test_sync',
  });
  const after = Date.now();
  assert.ok(after - before < 50, 'construction must be effectively instantaneous (no I/O, no inference call)');
  assert.equal(project.sourceDocuments?.[0].exactText, 'Synchronous, no network, no Hermes.');
}

// ---------------------------------------------------------------------------
// Non-mutation of existing canonical/semantic state
// ---------------------------------------------------------------------------

function testCreationTakesNoExistingProjectAndCannotMutateOne() {
  // createManuscriptIntakeProject accepts no StoryProject argument at all --
  // by construction it has nothing to mutate. Demonstrate concretely with an
  // existing demo project: take a deep snapshot, create an unrelated intake
  // project, and prove the demo project is byte-identical afterward.
  const before = JSON.parse(JSON.stringify(DEFAULT_PROJECTS[0]));
  createManuscriptIntakeProject({
    projectId: 'proj_intake_test_nonmutation',
    projectTitle: 'Unrelated New Project',
    sourceLabel: 'Unrelated Source',
    pastedText: 'This must not touch any other project.',
    importedAt: 1_700_000_300_000,
    sourceDocumentId: 'source_intake_test_nonmutation',
  });
  assert.deepEqual(DEFAULT_PROJECTS[0], before,
    'creating a new intake project must not mutate an unrelated existing project');
}

function testSourceDocumentSurvivesTheAppsExistingJsonSnapshotPattern() {
  // App.tsx snapshots/clones StoryProject via JSON.parse(JSON.stringify(...))
  // for undo history and promotion rollback. The imported text must survive
  // that round-trip exactly, including embedded newlines and special characters.
  const project = createManuscriptIntakeProject({
    projectId: 'proj_intake_test_roundtrip',
    projectTitle: 'Round-trip Fixture',
    sourceLabel: 'Round-trip Source',
    pastedText: 'Line one.\nLine two with "quotes" and a backslash \\ and unicode café.\n\nParagraph two.',
    importedAt: 1_700_000_400_000,
    sourceDocumentId: 'source_intake_test_roundtrip',
  });
  const roundTripped: typeof project = JSON.parse(JSON.stringify(project));
  assert.equal(roundTripped.sourceDocuments?.[0].exactText, project.sourceDocuments?.[0].exactText);
  assert.deepEqual(roundTripped, project);
}

// ---------------------------------------------------------------------------
// Compatibility with existing demo projects
// ---------------------------------------------------------------------------

function testExistingDemoProjectsAreUntouchedByTheAdditiveField() {
  assert.equal(DEFAULT_PROJECTS.length, 3, 'all three existing demo projects must still be present');
  const titles = DEFAULT_PROJECTS.map((p) => p.title);
  assert.deepEqual(titles, [
    "The Clockmaker's Vault",
    'Whispers in the Sunken Archive',
    'The Crossroads of Ash',
  ]);

  for (const project of DEFAULT_PROJECTS) {
    // The additive field was never added to these literals, and must not be
    // required for them to remain valid StoryProject data.
    assert.equal(project.sourceDocuments, undefined,
      `${project.id} must not require sourceDocuments to exist`);
    // The defensive read pattern the UI uses must degrade safely.
    assert.deepEqual(project.sourceDocuments ?? [], []);
    // Existing demo semantics (a real POV actor, a real location) are untouched.
    assert.notEqual(project.activePovActorId, '');
    assert.notEqual(project.currentPosition.location_id, '');
    assert.ok(project.actors.length > 0, `${project.id} must still have its demo actors`);
  }
}

function run() {
  testExactTextIsPreservedVerbatim();
  testFunctionAppliesNoLineEndingNormalizationItself();
  testAuthorSourceDocumentIsFrozen();
  testSourceDocumentFieldsAndDefaultSourceType();
  testImportedProjectFabricatesNoNarrativeStructure();
  testBlankPasteProducesNoSourceDocumentButStillNoFabrication();
  testDoesNotCallAnAiProviderOrRequireHermes();
  testCreationTakesNoExistingProjectAndCannotMutateOne();
  testSourceDocumentSurvivesTheAppsExistingJsonSnapshotPattern();
  testExistingDemoProjectsAreUntouchedByTheAdditiveField();
  console.log('manuscript intake baseline regression passed');
}

run();
