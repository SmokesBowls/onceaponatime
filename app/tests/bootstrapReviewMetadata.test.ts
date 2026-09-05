import assert from 'node:assert/strict';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import { discoverBootstrap } from '../src/lib/bootstrapDiscovery';
import {
  buildBootstrapManifest,
  decideBootstrapManifestEntry,
  validateBootstrapManifestStructure,
  type BootstrapDecision,
  type BootstrapDiscoveryConfidence,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { prepareBootstrap } from '../src/lib/prepareBootstrap';
import type { StoryProject } from '../src/types';

function sourceOnlyProject(text = 'Keen entered Ironspire.\n\nKeen waited.'): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b3a_review_metadata',
    projectTitle: 'B3a Review Metadata Fixture',
    sourceLabel: 'Chapter One',
    pastedText: text,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b3a_review_metadata',
  });
}

function exactEvidence(project: StoryProject, unitId: string, text: string): SourceEvidenceUnit {
  const document = project.sourceDocuments?.[0];
  assert.ok(document);
  const startOffset = document.exactText.indexOf(text);
  assert.notEqual(startOffset, -1, `fixture text must exist: ${text}`);
  return {
    sourceDocumentId: document.id,
    unitId,
    startOffset,
    endOffset: startOffset + text.length,
    exactText: text,
  };
}

function actorProposal(): Extract<BootstrapProposal, { kind: 'actor_proposal' }> {
  return {
    kind: 'actor_proposal',
    id: 'actor_keen',
    working_label: 'Keen',
    name: null,
    aliases: [],
    initial_location_id: 'location_ironspire',
  };
}

function locationProposal(): Extract<BootstrapProposal, { kind: 'location_proposal' }> {
  return {
    kind: 'location_proposal',
    id: 'location_ironspire',
    working_label: 'Ironspire',
    name: null,
    aliases: [],
  };
}

function confidence(
  classification: BootstrapDiscoveryConfidence['classification'] = 'provisional',
  supportingUnitCount = 1,
  reasons: readonly string[] = ['proper_name_match'],
): BootstrapDiscoveryConfidence {
  return { classification, supportingUnitCount, reasons };
}

function manualEntries(
  project: StoryProject,
  actorConfidence?: BootstrapDiscoveryConfidence,
  locationConfidence?: BootstrapDiscoveryConfidence,
): BootstrapDiscoveryEntry[] {
  const actorEvidence = [exactEvidence(project, 'unit-keen', 'Keen entered Ironspire.')];
  const locationEvidence = [exactEvidence(project, 'unit-ironspire', 'Keen entered Ironspire.')];
  return [
    {
      proposed: actorProposal(),
      evidence: actorEvidence,
      ...(actorConfidence === undefined ? {} : { discoveryConfidence: actorConfidence }),
    },
    {
      proposed: locationProposal(),
      evidence: locationEvidence,
      ...(locationConfidence === undefined ? {} : { discoveryConfidence: locationConfidence }),
    },
  ];
}

function decideAll(
  manifest: BootstrapManifest,
  decision: Exclude<BootstrapDecision, 'edited'> = 'approved',
): BootstrapManifest {
  return manifest.entries.reduce(
    (current, entry) => decideBootstrapManifestEntry(current, entry.id, decision),
    manifest,
  );
}

function testB2MetadataIsRequiredAtB2AndPreservedByManifestBuilder() {
  const project = sourceOnlyProject();
  const discovery = discoverBootstrap(project);
  assert.ok(discovery.entries.length > 0);
  for (const entry of discovery.entries) {
    assert.ok(entry.discoveryConfidence, 'every B2 entry must explain why it was surfaced');
  }

  const manifest = buildBootstrapManifest(project, discovery);
  assert.equal(manifest.entries.length, discovery.entries.length);
  manifest.entries.forEach((entry, index) => {
    assert.deepEqual(
      entry.discoveryConfidence,
      discovery.entries[index].discoveryConfidence,
      'the manifest must preserve B2 review metadata exactly',
    );
  });
}

function testManualEntriesRemainValidWithoutFabricatedConfidence() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const manualDiscovery: { entries: BootstrapDiscoveryEntry[] } = {
    entries: manualEntries(project),
  };
  const manifest = buildBootstrapManifest(project, manualDiscovery);

  assert.doesNotThrow(() => validateBootstrapManifestStructure(manifest));
  for (const entry of manifest.entries) {
    assert.ok(
      !Object.prototype.hasOwnProperty.call(entry, 'discoveryConfidence'),
      'non-B2 entries must keep absent confidence absent',
    );
  }
}

function testDecisionsAndProposalEditsCannotRewriteDiscoveryHistory() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const originalConfidence = confidence('ambiguous', 1, ['cross_kind_conflict', 'proper_name_match']);
  const manifest = buildBootstrapManifest(project, {
    entries: manualEntries(project, originalConfidence, confidence()),
  });
  const actorEntry = manifest.entries.find((entry) => entry.kind === 'actor_proposal');
  assert.ok(actorEntry);

  const approved = decideBootstrapManifestEntry(manifest, actorEntry.id, 'approved');
  assert.deepEqual(approved.entries.find((entry) => entry.id === actorEntry.id)?.discoveryConfidence, originalConfidence);

  const rejected = decideBootstrapManifestEntry(manifest, actorEntry.id, 'rejected');
  assert.deepEqual(rejected.entries.find((entry) => entry.id === actorEntry.id)?.discoveryConfidence, originalConfidence);

  const editedProposal: BootstrapProposal = {
    ...actorProposal(),
    id: 'actor_keen_reviewed',
    working_label: 'Keen, the scout',
  };
  const edited = decideBootstrapManifestEntry(manifest, actorEntry.id, 'edited', editedProposal);
  const editedEntry = edited.entries.find((entry) => entry.id === actorEntry.id);
  assert.deepEqual(editedEntry?.discoveryConfidence, originalConfidence);
  assert.notDeepEqual(editedEntry?.admitted, editedEntry?.proposed);
  assert.deepEqual(manifest.entries.find((entry) => entry.id === actorEntry.id)?.decision, 'pending');
}

function testMalformedConfidenceIsRejectedWhenPresent() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const malformedCases: Array<{ label: string; value: unknown }> = [
    {
      label: 'classification',
      value: { classification: 'certain', supportingUnitCount: 1, reasons: ['proper_name_match'] },
    },
    {
      label: 'missing classification',
      value: { supportingUnitCount: 1, reasons: ['proper_name_match'] },
    },
    {
      label: 'count',
      value: { classification: 'provisional', supportingUnitCount: -1, reasons: ['proper_name_match'] },
    },
    {
      label: 'zero count',
      value: { classification: 'provisional', supportingUnitCount: 0, reasons: ['proper_name_match'] },
    },
    {
      label: 'non-integer count',
      value: { classification: 'provisional', supportingUnitCount: 1.5, reasons: ['proper_name_match'] },
    },
    {
      label: 'non-number count',
      value: { classification: 'provisional', supportingUnitCount: '1', reasons: ['proper_name_match'] },
    },
    {
      label: 'missing count',
      value: { classification: 'provisional', reasons: ['proper_name_match'] },
    },
    {
      label: 'reason',
      value: { classification: 'provisional', supportingUnitCount: 1, reasons: ['Model says yes'] },
    },
    {
      label: 'blank reason',
      value: { classification: 'provisional', supportingUnitCount: 1, reasons: [''] },
    },
    {
      label: 'empty reasons',
      value: { classification: 'provisional', supportingUnitCount: 1, reasons: [] },
    },
    {
      label: 'non-array reasons',
      value: { classification: 'provisional', supportingUnitCount: 1, reasons: 'proper_name_match' },
    },
    {
      label: 'missing reasons',
      value: { classification: 'provisional', supportingUnitCount: 1 },
    },
  ];

  for (const malformed of malformedCases) {
    const entries = manualEntries(project, malformed.value as BootstrapDiscoveryConfidence, confidence());
    const manifest = buildBootstrapManifest(project, { entries });
    assert.throws(
      () => validateBootstrapManifestStructure(manifest),
      /discovery confidence|classification|supportingUnitCount|reasons/i,
      `malformed ${malformed.label} must fail validation`,
    );
  }
}

function testSupportingCountUsesDistinctEvidenceUnitIdentity() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const evidence = exactEvidence(project, 'same-unit', 'Keen entered Ironspire.');
  const duplicateEvidenceEntry: BootstrapDiscoveryEntry = {
    proposed: actorProposal(),
    evidence: [evidence, structuredClone(evidence)],
    discoveryConfidence: confidence('provisional', 1),
  };
  const valid = buildBootstrapManifest(project, { entries: [duplicateEvidenceEntry] });
  assert.doesNotThrow(() => validateBootstrapManifestStructure(valid));

  const twoUnitProject = sourceOnlyProject('Keen entered Ironspire.\n\nKeen waited.');
  const twoDistinctUnits: BootstrapDiscoveryEntry = {
    proposed: actorProposal(),
    evidence: [
      exactEvidence(twoUnitProject, 'keen-unit-one', 'Keen entered Ironspire.'),
      exactEvidence(twoUnitProject, 'keen-unit-two', 'Keen waited.'),
    ],
    discoveryConfidence: confidence('corroborated', 2, ['proper_name_match', 'repeated_identity_reference']),
  };
  const validTwoUnitManifest = buildBootstrapManifest(twoUnitProject, { entries: [twoDistinctUnits] });
  assert.doesNotThrow(
    () => validateBootstrapManifestStructure(validTwoUnitManifest),
    'a legitimate count above one must remain valid when distinct unit identities support it',
  );

  const wrongCount = buildBootstrapManifest(project, {
    entries: [{ ...duplicateEvidenceEntry, discoveryConfidence: confidence('provisional', 2) }],
  });
  assert.throws(() => validateBootstrapManifestStructure(wrongCount), /supportingUnitCount|distinct/i);

  const undercount = buildBootstrapManifest(twoUnitProject, {
    entries: [{ ...twoDistinctUnits, discoveryConfidence: confidence('provisional', 1) }],
  });
  assert.throws(() => validateBootstrapManifestStructure(undercount), /supportingUnitCount|distinct/i);
}

function testConfidenceParticipatesInReviewArtifactFingerprint() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const baseline = buildBootstrapManifest(project, {
    entries: manualEntries(project, confidence('provisional', 1), confidence()),
  });
  const changedReasons = buildBootstrapManifest(project, {
    entries: manualEntries(project, confidence('provisional', 1, ['person_context_match']), confidence()),
  });
  const changedClassification = buildBootstrapManifest(project, {
    entries: manualEntries(project, confidence('ambiguous', 1), confidence()),
  });
  const changedCount = buildBootstrapManifest(project, {
    entries: manualEntries(project, confidence('provisional', 2), confidence()),
  });

  for (const changed of [changedReasons, changedClassification, changedCount]) {
    assert.notEqual(baseline.entriesFingerprint, changed.entriesFingerprint);
    assert.notEqual(baseline.id, changed.id);
  }
}

function testB3aPreservesClassificationWithoutReinterpretingCount() {
  const project = sourceOnlyProject('Keen entered Ironspire.\n\nKeen waited.');
  const classifications: BootstrapDiscoveryConfidence['classification'][] = [
    'ambiguous',
    'provisional',
    'corroborated',
  ];

  for (const classification of classifications) {
    const supplied = confidence(classification, 2, ['proper_name_match', 'repeated_identity_reference']);
    const entry: BootstrapDiscoveryEntry = {
      proposed: actorProposal(),
      evidence: [
        exactEvidence(project, 'classification-unit-one', 'Keen entered Ironspire.'),
        exactEvidence(project, 'classification-unit-two', 'Keen waited.'),
      ],
      discoveryConfidence: supplied,
    };
    const manifest = buildBootstrapManifest(project, {
      entries: [entry],
    });
    const actorEntry = manifest.entries.find((entry) => entry.kind === 'actor_proposal');

    assert.equal(actorEntry?.discoveryConfidence?.classification, classification);
    assert.equal(actorEntry?.discoveryConfidence?.supportingUnitCount, 2);
    assert.doesNotThrow(() => validateBootstrapManifestStructure(manifest));
  }
}

function testConfidenceCannotBypassDecisionsOrAssignments() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const highestLookingMetadata = confidence('corroborated', 1, ['proper_name_match']);
  const pending = buildBootstrapManifest(project, {
    entries: manualEntries(project, highestLookingMetadata, highestLookingMetadata),
  });

  assert.throws(
    () => prepareBootstrap(project, pending, {
      activePovActorId: 'actor_keen',
      currentLocationId: 'location_ironspire',
    }, 1_700_000_000_100),
    /pending/i,
  );

  const decided = decideAll(pending);
  assert.throws(
    () => prepareBootstrap(project, decided, {
      activePovActorId: null,
      currentLocationId: null,
    }, 1_700_000_000_100),
    /explicit POV actor assignment and current location assignment/i,
  );

  const actorEntry = pending.entries.find((entry) => entry.kind === 'actor_proposal');
  const locationEntry = pending.entries.find((entry) => entry.kind === 'location_proposal');
  assert.ok(actorEntry);
  assert.ok(locationEntry);
  const editedActor: BootstrapProposal = {
    ...actorProposal(),
    id: 'actor_keen_reviewed',
    working_label: 'Keen, the scout',
  };
  let editedManifest = decideBootstrapManifestEntry(pending, actorEntry.id, 'edited', editedActor);
  editedManifest = decideBootstrapManifestEntry(editedManifest, locationEntry.id, 'approved');
  const editedResult = prepareBootstrap(project, editedManifest, {
    activePovActorId: actorProposal().id,
    currentLocationId: locationProposal().id,
  }, 1_700_000_000_100);
  assert.ok(editedResult.nextProject.actors.some((actor) => (
    actor.id === 'actor_keen_reviewed' && actor.identity.working_label === 'Keen, the scout'
  )));
  assert.ok(!editedResult.nextProject.actors.some((actor) => actor.id === actorProposal().id),
    'confidence cannot choose the original proposal over the author-edited admitted proposal');
}

function testDifferentConfidenceCannotChangeCanonicalApplication() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const provisional = decideAll(buildBootstrapManifest(project, {
    entries: manualEntries(project, confidence('provisional', 1), confidence('provisional', 1)),
  }));
  const corroborated = decideAll(buildBootstrapManifest(project, {
    entries: manualEntries(project, confidence('corroborated', 1), confidence('ambiguous', 1, ['place_context_match'])),
  }));
  const assignments = {
    activePovActorId: 'actor_keen',
    currentLocationId: 'location_ironspire',
  };

  const first = prepareBootstrap(project, provisional, assignments, 1_700_000_000_100);
  const second = prepareBootstrap(project, corroborated, assignments, 1_700_000_000_100);
  assert.deepEqual(second.nextProject, first.nextProject);
  assert.notEqual(second.bootstrapReceipt.manifestId, first.bootstrapReceipt.manifestId);
}

function testReviewMetadataOperationsAreDeterministicAndNonMutating() {
  const project = sourceOnlyProject('Keen entered Ironspire.');
  const discovery = {
    entries: manualEntries(project, confidence('ambiguous', 1, ['cross_kind_conflict']), confidence()),
  };
  const projectBefore = structuredClone(project);
  const discoveryBefore = structuredClone(discovery);
  const callerOwnedConfidence = discovery.entries[0].discoveryConfidence;
  assert.ok(callerOwnedConfidence);
  assert.equal(Object.isFrozen(callerOwnedConfidence), false);

  const first = buildBootstrapManifest(project, discovery);
  const second = buildBootstrapManifest(project, discovery);
  assert.deepEqual(second, first);
  assert.notEqual(first.entries[0].discoveryConfidence, callerOwnedConfidence,
    'the manifest must clone review metadata rather than aliasing caller-owned history');
  assert.equal(Object.isFrozen(callerOwnedConfidence), false,
    'freezing the manifest must not freeze caller-owned discovery metadata');
  assert.deepEqual(project, projectBefore);
  assert.deepEqual(discovery, discoveryBefore);

  const decided = decideAll(first);
  const decidedAgain = decideAll(first);
  assert.deepEqual(decidedAgain, decided, 'decision transitions must be deterministic');
  const decidedBefore = structuredClone(decided);
  assert.doesNotThrow(() => validateBootstrapManifestStructure(decided));
  assert.doesNotThrow(() => validateBootstrapManifestStructure(decided));
  assert.deepEqual(decided, decidedBefore, 'validation must not mutate the manifest');
  const assignments = {
    activePovActorId: 'actor_keen',
    currentLocationId: 'location_ironspire',
  };
  const assignmentsBefore = structuredClone(assignments);
  const preparedA = prepareBootstrap(project, decided, assignments, 1_700_000_000_100);
  const preparedB = prepareBootstrap(project, decided, assignments, 1_700_000_000_100);
  assert.deepEqual(preparedB, preparedA);
  assert.deepEqual(project, projectBefore);
  assert.deepEqual(discovery, discoveryBefore);
  assert.deepEqual(decided, decidedBefore);
  assert.deepEqual(assignments, assignmentsBefore);
}

function run() {
  testB2MetadataIsRequiredAtB2AndPreservedByManifestBuilder();
  testManualEntriesRemainValidWithoutFabricatedConfidence();
  testDecisionsAndProposalEditsCannotRewriteDiscoveryHistory();
  testMalformedConfidenceIsRejectedWhenPresent();
  testSupportingCountUsesDistinctEvidenceUnitIdentity();
  testConfidenceParticipatesInReviewArtifactFingerprint();
  testB3aPreservesClassificationWithoutReinterpretingCount();
  testConfidenceCannotBypassDecisionsOrAssignments();
  testDifferentConfidenceCannotChangeCanonicalApplication();
  testReviewMetadataOperationsAreDeterministicAndNonMutating();
  console.log('B3a bootstrap review metadata contract regression passed');
}

run();
