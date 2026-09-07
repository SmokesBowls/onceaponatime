import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInferenceArtifact, type AuthorSourceDocument, type InferenceReceipt, type StoryProject } from '../src/types';
import {
  buildBootstrapManifest,
  decideBootstrapManifestEntry,
  deepFreeze,
  expectedEntryId,
  isBootstrapEntityProposal,
  validateBootstrapManifestStructure,
  type BootstrapDiscoveryConfidence,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapManifestEntry,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import {
  BOOTSTRAP_REFINEMENT_OPERATION,
  BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
  type BootstrapRefinementArtifact,
  type BootstrapRefinementCandidate,
  type BootstrapRefinementCandidateKind,
  type BootstrapRefinementEvidenceCitation,
  type BootstrapRefinementPayload,
} from '../src/lib/bootstrapRefinement';
import { mergeBootstrapRefinementArtifact } from '../src/lib/bootstrapRefinementMerge';

/**
 * B4b RED gate: the Refinement Merge boundary.
 *
 * Frozen against TODO.md's "B4b -- Refinement Merge" contract (831a5a4).
 * src/lib/bootstrapRefinementMerge.ts does not exist yet, and expectedEntryId()
 * is not yet exported from src/lib/bootstrapManifest.ts (the frozen origin
 * finding) -- either import alone is the first genuinely absent public
 * boundary, matching the B2/B3d/B4a precedent.
 *
 * No Hermes call, no B4a invocation, no React/UI, and no B3d apply path are
 * exercised here -- every BootstrapRefinementArtifact fixture below is
 * hand-built exactly to B4a's own payload shape, never produced by calling
 * refineBootstrapManifest(). Covers all 14 points of B4b's frozen RED gate
 * plus the baseline-proposal-id collision rule from its "Duplicates/
 * collisions" prose.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Baseline fixture
// ---------------------------------------------------------------------------

const BASELINE_TEXT = 'Locke found Mara near the old well. Isla stood by the gate. Ulric watched from the ridge.';

function sourceOnlyProject(pastedText: string): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4b_test',
    projectTitle: 'B4b RED Fixture',
    sourceLabel: 'Chapter One',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4b_test',
  });
}

function firstDoc(project: StoryProject): AuthorSourceDocument {
  const doc = (project.sourceDocuments ?? [])[0];
  assert.ok(doc, 'fixture requires a source document');
  return doc;
}

function evidenceFor(doc: AuthorSourceDocument, unitId: string, substring: string): SourceEvidenceUnit {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found in source document ${doc.id}`);
  return {
    sourceDocumentId: doc.id,
    unitId,
    startOffset: start,
    endOffset: start + substring.length,
    exactText: substring,
  };
}

function locationProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'location_proposal', id, working_label: label, name: null, aliases: [] };
}

function actorProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'actor_proposal', id, working_label: label, name: null, aliases: [] };
}

function discoveryEntry(
  proposed: BootstrapProposal,
  evidence: readonly SourceEvidenceUnit[],
  discoveryConfidence?: BootstrapDiscoveryConfidence,
): BootstrapDiscoveryEntry {
  return { proposed, evidence, ...(discoveryConfidence === undefined ? {} : { discoveryConfidence }) };
}

const WELL_CONFIDENCE: BootstrapDiscoveryConfidence = {
  classification: 'corroborated',
  supportingUnitCount: 1,
  reasons: ['strong_place_preposition'],
};

/**
 * Baseline: two actor_proposal entries (Mara sourceIndex 0, Isla sourceIndex 1)
 * plus one location_proposal entry (the old well, sourceIndex 0, carrying real
 * B2 discoveryConfidence) -- deliberately includes two same-kind entries so an
 * AI addition of that same kind must continue the per-kind sourceIndex counter
 * rather than colliding.
 */
function pendingBaseline(pastedText: string = BASELINE_TEXT): BootstrapManifest {
  const project = sourceOnlyProject(pastedText);
  const doc = firstDoc(project);
  return buildBootstrapManifest(project, {
    entries: [
      discoveryEntry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')], WELL_CONFIDENCE),
      discoveryEntry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
      discoveryEntry(actorProposal('actor_isla', 'Isla'), [evidenceFor(doc, 'u3', 'Isla')]),
    ],
  });
}

function baselineDoc(baseline: BootstrapManifest): AuthorSourceDocument {
  const doc = baseline.boundSourceDocuments[0];
  assert.ok(doc, 'baseline fixture requires a bound source document');
  return doc;
}

function originalEntry(baseline: BootstrapManifest, proposedId: string): BootstrapManifestEntry {
  const entry = baseline.entries.find((e) => isBootstrapEntityProposal(e.proposed) && e.proposed.id === proposedId);
  assert.ok(entry, `baseline fixture must contain a proposal with id ${proposedId}`);
  return entry;
}

// ---------------------------------------------------------------------------
// Hand-built BootstrapRefinementArtifact fixtures (never produced by B4a)
// ---------------------------------------------------------------------------

function admittedReceipt(overrides: Partial<InferenceReceipt> = {}): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId: 'b4b-request-001',
    operation: BOOTSTRAP_REFINEMENT_OPERATION,
    actualProvider: 'openrouter',
    actualModel: 'actual/model-build-2026-09-01',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
    ...overrides,
  });
}

function evidenceCitationFor(doc: AuthorSourceDocument, substring: string): BootstrapRefinementEvidenceCitation {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found in source document ${doc.id}`);
  return { sourceDocumentId: doc.id, startOffset: start, endOffset: start + substring.length, exactText: substring };
}

let candidateSequence = 0;

function buildCandidate(
  kind: BootstrapRefinementCandidateKind,
  workingLabel: string,
  evidence: readonly BootstrapRefinementEvidenceCitation[],
  overrides: Partial<Pick<BootstrapRefinementCandidate, 'refinesEntryId' | 'candidateId'>> = {},
): BootstrapRefinementCandidate {
  candidateSequence += 1;
  const digest = candidateSequence.toString(16).padStart(64, '0');
  return {
    kind,
    workingLabel,
    name: null,
    aliases: [],
    refinesEntryId: overrides.refinesEntryId ?? null,
    evidence,
    candidateId: overrides.candidateId ?? `bootstrap_ai_${kind}_${digest.slice(0, 32)}`,
    candidateDigest: digest,
  };
}

function buildArtifact(
  baseline: BootstrapManifest,
  candidates: readonly BootstrapRefinementCandidate[],
  overrides: { baselineManifestId?: string; boundSourceFingerprint?: string; receipt?: InferenceReceipt } = {},
): BootstrapRefinementArtifact {
  const receipt = overrides.receipt ?? admittedReceipt();
  const payload: BootstrapRefinementPayload = {
    schema: BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
    baselineManifestId: overrides.baselineManifestId ?? baseline.id,
    boundSourceFingerprint: overrides.boundSourceFingerprint ?? baseline.boundSourceFingerprint,
    candidates,
    rawOutputDigest: '1'.repeat(64),
    artifactDigest: '2'.repeat(64),
  };
  return createInferenceArtifact(deepFreeze(payload), receipt);
}

// ---------------------------------------------------------------------------
// 1. mergeBootstrapRefinementArtifact() is unreachable from B2/B3/B3d
// ---------------------------------------------------------------------------

function reachableSources(entryFiles: readonly string[]): Map<string, string> {
  const pending = [...entryFiles];
  const sources = new Map<string, string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (sources.has(file)) continue;
    const source = readFileSync(file, 'utf8');
    sources.set(file, source);
    const relativeImports = [
      ...source.matchAll(/(?:from\s+|import\s*\()(['"])(\.[^'"]+)\1/g),
    ].map((match) => match[2]);
    for (const specifier of relativeImports) {
      const base = resolve(dirname(file), specifier);
      const resolved = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]
        .find((candidate) => existsSync(candidate));
      if (resolved !== undefined && resolved.includes('/app/src/')) pending.push(resolved);
    }
  }
  return sources;
}

function testMergeIsUnreachableFromB2B3B3d(): void {
  const entryFiles = [
    resolve(__dirname, '../src/lib/bootstrapDiscovery.ts'),
    resolve(__dirname, '../src/lib/bootstrapManifest.ts'),
    resolve(__dirname, '../src/lib/bootstrapReview.ts'),
    resolve(__dirname, '../src/components/BootstrapReviewWorkspace.tsx'),
    resolve(__dirname, '../src/components/StoryEditor.tsx'),
    resolve(__dirname, '../src/lib/prepareBootstrap.ts'),
  ];
  const sources = reachableSources(entryFiles);
  for (const [file, source] of sources) {
    assert.ok(!/bootstrapRefinementMerge/.test(source), `${file} must not reference the B4b merge module`);
    assert.ok(!/mergeBootstrapRefinementArtifact/.test(source), `${file} must not call mergeBootstrapRefinementArtifact()`);
  }
}

// ---------------------------------------------------------------------------
// 2. original entries unchanged under the required rebase
// ---------------------------------------------------------------------------

function testOriginalEntriesUnchangedUnderRebase(): void {
  const baseline = pendingBaseline();
  const artifact = buildArtifact(baseline, []);
  const result = mergeBootstrapRefinementArtifact(baseline, artifact);

  validateBootstrapManifestStructure(result);
  assert.equal(Object.isFrozen(result), true);

  const entryIdMap = result.refinementMetadata?.entryIdMap;
  assert.ok(entryIdMap, 'combined manifest must carry refinementMetadata.entryIdMap');
  assert.equal(Object.keys(entryIdMap).length, baseline.entries.length);

  for (const original of baseline.entries) {
    const newId = entryIdMap[original.id];
    assert.ok(newId, `entryIdMap must cover original entry ${original.id}`);
    assert.equal(newId, expectedEntryId(result.id, original.kind, original.sourceIndex));

    const rebased = result.entries.find((e) => e.id === newId);
    assert.ok(rebased, `result must contain rebased entry ${newId}`);
    assert.deepEqual(rebased.proposed, original.proposed);
    assert.deepEqual(rebased.evidence, original.evidence);
    assert.deepEqual(rebased.discoveryConfidence, original.discoveryConfidence);
    assert.equal(rebased.supportedForApplication, original.supportedForApplication);
    assert.equal(rebased.decision, 'pending');
    assert.equal(rebased.admitted, undefined);
    assert.equal(rebased.kind, original.kind);
    assert.equal(rebased.sourceIndex, original.sourceIndex);
  }
}

// ---------------------------------------------------------------------------
// 3. AI additions are additive only (including same-kind sourceIndex continuation)
// ---------------------------------------------------------------------------

function testAdditionsAreAdditiveOnly(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  // Same kind (actor_proposal) as two existing baseline entries (sourceIndex 0, 1)
  // -- the addition must not collide with either.
  const addition = buildCandidate('actor_proposal', 'Ulric', [evidenceCitationFor(doc, 'Ulric')]);
  const artifact = buildArtifact(baseline, [addition]);

  const result = mergeBootstrapRefinementArtifact(baseline, artifact);
  validateBootstrapManifestStructure(result);

  const entryIdMap = result.refinementMetadata!.entryIdMap;
  const rebasedIds = new Set(Object.values(entryIdMap));
  const newEntries = result.entries.filter((e) => !rebasedIds.has(e.id));
  assert.equal(newEntries.length, 1);

  const [added] = newEntries;
  assert.equal(added.kind, 'actor_proposal');
  assert.equal(added.decision, 'pending');
  assert.equal(added.admitted, undefined);
  assert.equal(added.supportedForApplication, true);
  assert.equal('discoveryConfidence' in added, false, 'an AI addition must never carry discoveryConfidence');
  assert.ok(added.refinementProvenance, 'an AI addition must carry refinementProvenance');
  assert.equal(added.refinementProvenance!.candidateDigest, addition.candidateDigest);
  assert.equal(added.refinementProvenance!.refinesBaselineEntryId, undefined);
  assert.ok(isBootstrapEntityProposal(added.proposed), 'an AI addition must be an entity proposal');
  assert.equal(isBootstrapEntityProposal(added.proposed) ? added.proposed.id : undefined, addition.candidateId);

  // Original baseline entries must be completely untouched by the addition.
  for (const original of baseline.entries) {
    const rebased = result.entries.find((e) => e.id === entryIdMap[original.id])!;
    assert.deepEqual(rebased.proposed, original.proposed);
  }
}

// ---------------------------------------------------------------------------
// 4. suggestions attach without rewriting targets
// ---------------------------------------------------------------------------

function testSuggestionsAttachWithoutRewritingTargets(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const targetOriginal = originalEntry(baseline, 'actor_mara');
  const suggestion = buildCandidate('actor_proposal', 'Mara the Wanderer', [evidenceCitationFor(doc, 'Mara')], {
    refinesEntryId: targetOriginal.id,
  });
  const artifact = buildArtifact(baseline, [suggestion]);

  const result = mergeBootstrapRefinementArtifact(baseline, artifact);
  validateBootstrapManifestStructure(result);

  const entryIdMap = result.refinementMetadata!.entryIdMap;
  assert.equal(result.entries.length, baseline.entries.length, 'a suggestion must not add a new manifest entry');

  const rebasedTarget = result.entries.find((e) => e.id === entryIdMap[targetOriginal.id])!;
  assert.deepEqual(rebasedTarget.proposed, targetOriginal.proposed, 'a suggestion must never rewrite its target\'s proposed value');
  assert.equal(rebasedTarget.decision, 'pending');
  assert.equal(rebasedTarget.admitted, undefined);
  assert.ok(rebasedTarget.suggestedRefinements, 'target must carry suggestedRefinements');
  assert.equal(rebasedTarget.suggestedRefinements!.length, 1);
  assert.equal(rebasedTarget.suggestedRefinements![0].provenance.candidateDigest, suggestion.candidateDigest);
  assert.equal(rebasedTarget.suggestedRefinements![0].provenance.refinesBaselineEntryId, rebasedTarget.id);
}

// ---------------------------------------------------------------------------
// 5. wrong or stale baseline rejects
// ---------------------------------------------------------------------------

function testWrongOrStaleBaselineRejects(): void {
  const baseline = pendingBaseline();
  const wrongOperationReceipt = admittedReceipt({ operation: 'onceaponatime.stage1.plan' });
  assert.throws(() => mergeBootstrapRefinementArtifact(
    baseline,
    buildArtifact(baseline, [], { receipt: wrongOperationReceipt }),
  ));
  assert.throws(() => mergeBootstrapRefinementArtifact(
    baseline,
    buildArtifact(baseline, [], { baselineManifestId: 'not-the-real-baseline-id' }),
  ));
  assert.throws(() => mergeBootstrapRefinementArtifact(
    baseline,
    buildArtifact(baseline, [], { boundSourceFingerprint: 'not-the-real-fingerprint' }),
  ));
  assert.doesNotThrow(() => mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [])));
}

// ---------------------------------------------------------------------------
// 6. a partially reviewed baseline rejects
// ---------------------------------------------------------------------------

function testPartiallyReviewedBaselineRejects(): void {
  const baseline = pendingBaseline();
  const decidedApproved = decideBootstrapManifestEntry(baseline, baseline.entries[0].id, 'approved');
  assert.throws(() => mergeBootstrapRefinementArtifact(decidedApproved, buildArtifact(decidedApproved, [])));

  const editedProposal: BootstrapProposal = { ...baseline.entries[1].proposed as any, working_label: 'Edited Mara' };
  const decidedEdited = decideBootstrapManifestEntry(baseline, baseline.entries[1].id, 'edited', editedProposal);
  assert.throws(() => mergeBootstrapRefinementArtifact(decidedEdited, buildArtifact(decidedEdited, [])));
}

// ---------------------------------------------------------------------------
// 7. a missing suggestion target rejects
// ---------------------------------------------------------------------------

function testMissingSuggestionTargetRejects(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const suggestion = buildCandidate('actor_proposal', 'Someone', [evidenceCitationFor(doc, 'Ulric')], {
    refinesEntryId: 'entry-id-that-does-not-exist',
  });
  assert.throws(() => mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestion])));
}

// ---------------------------------------------------------------------------
// 8. a wrong-kind suggestion target rejects
// ---------------------------------------------------------------------------

function testWrongKindSuggestionTargetRejects(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const locationTarget = originalEntry(baseline, 'location_well');
  // candidate kind is actor_proposal but targets the location entry
  const suggestion = buildCandidate('actor_proposal', 'Someone', [evidenceCitationFor(doc, 'Ulric')], {
    refinesEntryId: locationTarget.id,
  });
  assert.throws(() => mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestion])));
}

// ---------------------------------------------------------------------------
// 9. B2 confidence untouched; AI entries never fabricate it
// ---------------------------------------------------------------------------

function testB2ConfidenceUntouchedAndNeverFabricated(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const wellOriginal = originalEntry(baseline, 'location_well');
  assert.deepEqual(wellOriginal.discoveryConfidence, WELL_CONFIDENCE);

  const addition = buildCandidate('location_proposal', 'The Ridge', [evidenceCitationFor(doc, 'ridge')]);
  const suggestion = buildCandidate('location_proposal', 'The Ancient Well', [evidenceCitationFor(doc, 'the old well')], {
    refinesEntryId: wellOriginal.id,
  });
  const result = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [addition, suggestion]));
  validateBootstrapManifestStructure(result);

  const entryIdMap = result.refinementMetadata!.entryIdMap;
  const rebasedWell = result.entries.find((e) => e.id === entryIdMap[wellOriginal.id])!;
  assert.deepEqual(rebasedWell.discoveryConfidence, WELL_CONFIDENCE, 'existing discoveryConfidence must survive unchanged');

  const rebasedIds = new Set(Object.values(entryIdMap));
  const addedEntry = result.entries.find((e) => !rebasedIds.has(e.id))!;
  assert.equal('discoveryConfidence' in addedEntry, false, 'an AI addition must never fabricate discoveryConfidence');
}

// ---------------------------------------------------------------------------
// 10. same input gives the same merged manifest
// ---------------------------------------------------------------------------

function testDeterministicRepeatedMerge(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const addition = buildCandidate('actor_proposal', 'Ulric', [evidenceCitationFor(doc, 'Ulric')]);
  const artifact = buildArtifact(baseline, [addition]);

  const resultA = mergeBootstrapRefinementArtifact(baseline, artifact);
  const resultB = mergeBootstrapRefinementArtifact(baseline, artifact);
  assert.deepEqual(resultA, resultB);
}

// ---------------------------------------------------------------------------
// 11. already-merged input doesn't accept the same stale artifact
// ---------------------------------------------------------------------------

function testAlreadyMergedInputRejectsSameArtifact(): void {
  const baseline = pendingBaseline();
  const artifact = buildArtifact(baseline, []);
  const combined = mergeBootstrapRefinementArtifact(baseline, artifact);
  assert.throws(() => mergeBootstrapRefinementArtifact(combined, artifact));
}

// ---------------------------------------------------------------------------
// 12. source citations are replayed against baseline source again
// ---------------------------------------------------------------------------

function testTamperedEvidenceReplayRejects(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const realCitation = evidenceCitationFor(doc, 'Ulric');

  const tamperedExactText: BootstrapRefinementEvidenceCitation = { ...realCitation, exactText: 'Not Actually There' };
  const tamperedCandidate = buildCandidate('actor_proposal', 'Ulric', [tamperedExactText]);
  assert.throws(() => mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [tamperedCandidate])));

  const outOfRange: BootstrapRefinementEvidenceCitation = {
    sourceDocumentId: doc.id,
    startOffset: 0,
    endOffset: doc.exactText.length + 1000,
    exactText: doc.exactText,
  };
  const outOfRangeCandidate = buildCandidate('actor_proposal', 'Ulric', [outOfRange]);
  assert.throws(() => mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [outOfRangeCandidate])));

  const unknownDoc: BootstrapRefinementEvidenceCitation = {
    sourceDocumentId: 'not-a-real-document',
    startOffset: 0,
    endOffset: 3,
    exactText: 'Loc',
  };
  const unknownDocCandidate = buildCandidate('actor_proposal', 'Ulric', [unknownDoc]);
  assert.throws(() => mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [unknownDocCandidate])));

  assert.doesNotThrow(() => mergeBootstrapRefinementArtifact(
    baseline,
    buildArtifact(baseline, [buildCandidate('actor_proposal', 'Ulric', [realCitation])]),
  ));
}

// ---------------------------------------------------------------------------
// 13. all provenance participates in manifest fingerprinting
// ---------------------------------------------------------------------------

function testProvenanceParticipatesInFingerprinting(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const citation = evidenceCitationFor(doc, 'Ulric');

  const candidateA = buildCandidate('actor_proposal', 'Ulric', [citation]);
  const candidateB = { ...candidateA, candidateDigest: 'f'.repeat(64) };

  const resultA = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [candidateA]));
  const resultB = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [candidateB]));

  assert.notEqual(resultA.id, resultB.id, 'a changed candidateDigest must change the combined manifest identity');
  assert.notEqual(resultA.entriesFingerprint, resultB.entriesFingerprint);
}

// ---------------------------------------------------------------------------
// 14. immutability, and zero-candidate structure
// ---------------------------------------------------------------------------

function testImmutabilityAndZeroCandidateStructure(): void {
  const baseline = pendingBaseline();
  const artifact = buildArtifact(baseline, []);
  const baselineBefore = JSON.stringify(baseline);
  const artifactBefore = JSON.stringify(artifact);

  const result = mergeBootstrapRefinementArtifact(baseline, artifact);

  assert.equal(JSON.stringify(baseline), baselineBefore, 'merge must never mutate its baseline argument');
  assert.equal(JSON.stringify(artifact), artifactBefore, 'merge must never mutate its artifact argument');
  assert.equal(Object.isFrozen(result), true);

  assert.equal(result.entries.length, baseline.entries.length, 'a zero-candidate artifact adds no entries');
  const entryIdMap = result.refinementMetadata!.entryIdMap;
  assert.equal(Object.keys(entryIdMap).length, baseline.entries.length);
  for (const original of baseline.entries) {
    assert.ok(entryIdMap[original.id], `entryIdMap must still cover ${original.id} even with zero AI candidates`);
  }
  assert.equal(result.refinementMetadata!.baselineManifestId, baseline.id);
  assert.equal(result.refinementMetadata!.artifactDigest, artifact.value.artifactDigest);
  assert.equal(result.refinementMetadata!.rawOutputDigest, artifact.value.rawOutputDigest);
  assert.equal(result.refinementMetadata!.receipt, artifact.receipt);
}

// ---------------------------------------------------------------------------
// Bonus: addition id colliding with an existing baseline proposal id fails closed
// (from the frozen "Duplicates/collisions" prose, not separately numbered above)
// ---------------------------------------------------------------------------

function testAdditionIdCollisionWithBaselineProposalRejects(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const colliding = buildCandidate('actor_proposal', 'Impostor Mara', [evidenceCitationFor(doc, 'Mara')], {
    candidateId: 'actor_mara', // collides with baseline's real actor_mara proposal id
  });
  assert.throws(() => mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [colliding])));
}

// ---------------------------------------------------------------------------

function run(): void {
  testMergeIsUnreachableFromB2B3B3d();
  testOriginalEntriesUnchangedUnderRebase();
  testAdditionsAreAdditiveOnly();
  testSuggestionsAttachWithoutRewritingTargets();
  testWrongOrStaleBaselineRejects();
  testPartiallyReviewedBaselineRejects();
  testMissingSuggestionTargetRejects();
  testWrongKindSuggestionTargetRejects();
  testB2ConfidenceUntouchedAndNeverFabricated();
  testDeterministicRepeatedMerge();
  testAlreadyMergedInputRejectsSameArtifact();
  testTamperedEvidenceReplayRejects();
  testProvenanceParticipatesInFingerprinting();
  testImmutabilityAndZeroCandidateStructure();
  testAdditionIdCollisionWithBaselineProposalRejects();
  console.log('B4b refinement merge regression passed');
}

run();
