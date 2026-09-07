import assert from 'node:assert/strict';
import { createInferenceArtifact, type AuthorSourceDocument, type InferenceReceipt, type StoryProject } from '../src/types';
import {
  buildBootstrapManifest,
  deepFreeze,
  validateBootstrapManifestStructure,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
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
 * B4b hardening regression: BootstrapSuggestedRefinement is missing its
 * evidence field. mergeBootstrapRefinementArtifact() already re-validates
 * and computes the correct SourceEvidenceUnit[] for every candidate,
 * additions and suggestions alike -- an addition's own entry keeps its copy,
 * but a suggestion's construction currently drops it. This was found while
 * inspecting the real manifest shape B4c2 (rendering) will need to consume;
 * closed as its own small slice before B4c2's contract, mirroring the B4a
 * hardening precedent (71c5aed/b24d806) rather than folded into B4c2.
 *
 * No new extraction, no new evidence inference, no UI -- purely carrying
 * forward data the merge already computes.
 */

const BASELINE_TEXT = 'Locke found Mara near the old well. Isla stood by the gate. Ulric watched from the ridge.';

function sourceOnlyProject(pastedText: string = BASELINE_TEXT): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4b_suggestion_evidence',
    projectTitle: 'B4b Suggestion Evidence Fixture',
    sourceLabel: 'Chapter One',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4b_suggestion_evidence',
  });
}

function firstDoc(project: StoryProject): AuthorSourceDocument {
  const doc = (project.sourceDocuments ?? [])[0];
  assert.ok(doc, 'fixture requires a source document');
  return doc;
}

function evidenceFor(doc: AuthorSourceDocument, unitId: string, substring: string): SourceEvidenceUnit {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found`);
  return { sourceDocumentId: doc.id, unitId, startOffset: start, endOffset: start + substring.length, exactText: substring };
}

function actorProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'actor_proposal', id, working_label: label, name: null, aliases: [] };
}

function discoveryEntry(proposed: BootstrapProposal, evidence: readonly SourceEvidenceUnit[]): BootstrapDiscoveryEntry {
  return { proposed, evidence };
}

function pendingBaseline(pastedText: string = BASELINE_TEXT): BootstrapManifest {
  const project = sourceOnlyProject(pastedText);
  const doc = firstDoc(project);
  return buildBootstrapManifest(project, {
    entries: [
      discoveryEntry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u1', 'Mara')]),
    ],
  });
}

function baselineDoc(baseline: BootstrapManifest): AuthorSourceDocument {
  const doc = baseline.boundSourceDocuments[0];
  assert.ok(doc, 'baseline fixture requires a bound source document');
  return doc;
}

function evidenceCitationFor(doc: AuthorSourceDocument, substring: string): BootstrapRefinementEvidenceCitation {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found`);
  return { sourceDocumentId: doc.id, startOffset: start, endOffset: start + substring.length, exactText: substring };
}

let candidateSequence = 0;

function buildCandidate(
  kind: BootstrapRefinementCandidateKind,
  workingLabel: string,
  evidence: readonly BootstrapRefinementEvidenceCitation[],
  refinesEntryId: string | null,
): BootstrapRefinementCandidate {
  candidateSequence += 1;
  const digest = candidateSequence.toString(16).padStart(64, '0');
  return {
    kind, workingLabel, name: null, aliases: [], refinesEntryId, evidence,
    candidateId: `bootstrap_ai_${kind}_${digest.slice(0, 32)}`,
    candidateDigest: digest,
  };
}

function admittedReceipt(): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes', requestId: 'r1', operation: BOOTSTRAP_REFINEMENT_OPERATION,
    actualProvider: 'x', actualModel: 'y', fallbackUsed: false, fallbackIndex: 0, routeAttemptCount: 1,
  });
}

function buildArtifact(baseline: BootstrapManifest, candidates: readonly BootstrapRefinementCandidate[]): BootstrapRefinementArtifact {
  const payload: BootstrapRefinementPayload = {
    schema: BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
    baselineManifestId: baseline.id,
    boundSourceFingerprint: baseline.boundSourceFingerprint,
    candidates,
    rawOutputDigest: '1'.repeat(64),
    artifactDigest: '2'.repeat(64),
  };
  return createInferenceArtifact(deepFreeze(payload), admittedReceipt());
}

function originalEntry(baseline: BootstrapManifest, proposedId: string): BootstrapManifest['entries'][number] {
  const entry = baseline.entries.find((e) => 'id' in e.proposed && e.proposed.id === proposedId);
  assert.ok(entry, `baseline fixture must contain a proposal with id ${proposedId}`);
  return entry;
}

// ---------------------------------------------------------------------------
// 1. suggestion evidence survives merge exactly
// ---------------------------------------------------------------------------

function testSuggestionEvidenceSurvivesMergeExactly() {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const target = originalEntry(baseline, 'actor_mara');
  const citation = evidenceCitationFor(doc, 'Mara');
  const suggestion = buildCandidate('actor_proposal', 'Mara the Wanderer', [citation], target.id);

  const result = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestion]));
  const entryIdMap = result.refinementMetadata!.entryIdMap;
  const rebasedTarget = result.entries.find((e) => e.id === entryIdMap[target.id])!;

  assert.ok(rebasedTarget.suggestedRefinements, 'target must carry suggestedRefinements');
  const [rendered] = rebasedTarget.suggestedRefinements!;
  assert.equal(rendered.evidence.length, 1, 'suggestion evidence must survive the merge');
  assert.equal(rendered.evidence[0].sourceDocumentId, citation.sourceDocumentId);
  assert.equal(rendered.evidence[0].startOffset, citation.startOffset);
  assert.equal(rendered.evidence[0].endOffset, citation.endOffset);
  assert.equal(rendered.evidence[0].exactText, citation.exactText);
  assert.match(rendered.evidence[0].unitId, /^source-unit:b4:/, 'suggestion evidence must carry a real B4 unit id');
}

// ---------------------------------------------------------------------------
// 2. original baseline entry evidence remains byte-for-byte unchanged
// ---------------------------------------------------------------------------

function testOriginalBaselineEvidenceUnchanged() {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const target = originalEntry(baseline, 'actor_mara');
  const suggestion = buildCandidate('actor_proposal', 'Mara the Wanderer', [evidenceCitationFor(doc, 'Mara')], target.id);

  const result = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestion]));
  const entryIdMap = result.refinementMetadata!.entryIdMap;
  const rebasedTarget = result.entries.find((e) => e.id === entryIdMap[target.id])!;

  assert.deepEqual(rebasedTarget.evidence, target.evidence, "the target entry's own evidence must be byte-for-byte unchanged");
}

// ---------------------------------------------------------------------------
// 3. suggestion evidence is separate from baseline evidence
// ---------------------------------------------------------------------------

function testSuggestionEvidenceIsSeparateFromBaselineEvidence() {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const target = originalEntry(baseline, 'actor_mara');
  // Deliberately cite the exact same span as the baseline entry's own evidence.
  const suggestion = buildCandidate('actor_proposal', 'Mara the Wanderer', [evidenceCitationFor(doc, 'Mara')], target.id);

  const result = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestion]));
  const entryIdMap = result.refinementMetadata!.entryIdMap;
  const rebasedTarget = result.entries.find((e) => e.id === entryIdMap[target.id])!;

  assert.equal(rebasedTarget.evidence.length, 1);
  assert.equal(rebasedTarget.suggestedRefinements![0].evidence.length, 1);
  assert.notEqual(
    rebasedTarget.evidence[0].unitId,
    rebasedTarget.suggestedRefinements![0].evidence[0].unitId,
    'suggestion evidence must carry its own distinct unit identity, never collapsed into the baseline evidence array',
  );
  // Structurally two separate fields/arrays, never merged into one list.
  assert.notEqual(rebasedTarget.evidence as unknown, rebasedTarget.suggestedRefinements![0].evidence as unknown);
}

// ---------------------------------------------------------------------------
// 4. malformed/tampered suggestion evidence fails manifest validation
// ---------------------------------------------------------------------------

function testMalformedSuggestionEvidenceFailsValidation() {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const target = originalEntry(baseline, 'actor_mara');
  const citation = evidenceCitationFor(doc, 'Mara');
  const suggestion = buildCandidate('actor_proposal', 'Mara the Wanderer', [citation], target.id);

  const result = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestion]));
  const entryIdMap = result.refinementMetadata!.entryIdMap;

  const tamperedEntries = result.entries.map((entry) => {
    if (entry.id !== entryIdMap[target.id]) return entry;
    return {
      ...entry,
      suggestedRefinements: entry.suggestedRefinements!.map((s) => ({
        ...s,
        evidence: s.evidence.map((unit) => ({ ...unit, exactText: 'Not Actually There' })),
      })),
    };
  });
  const tampered = { ...result, entries: tamperedEntries } as BootstrapManifest;

  assert.throws(
    () => validateBootstrapManifestStructure(tampered),
    /Malformed Bootstrap Manifest/i,
    'tampered suggestion evidence must fail structural validation',
  );
}

// ---------------------------------------------------------------------------
// 5. changing suggestion evidence changes manifest identity
// ---------------------------------------------------------------------------

function testChangingSuggestionEvidenceChangesManifestIdentity() {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const target = originalEntry(baseline, 'actor_mara');

  const suggestionA = buildCandidate('actor_proposal', 'Mara the Wanderer', [evidenceCitationFor(doc, 'Mara')], target.id);
  const suggestionB = buildCandidate('actor_proposal', 'Mara the Wanderer', [evidenceCitationFor(doc, 'Isla')], target.id);

  const resultA = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestionA]));
  const resultB = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestionB]));

  assert.notEqual(resultA.id, resultB.id, 'a changed suggestion evidence span must change the combined manifest identity');
  assert.notEqual(resultA.entriesFingerprint, resultB.entriesFingerprint);
}

// ---------------------------------------------------------------------------
// 6. AI additions retain their existing evidence behavior unchanged
// ---------------------------------------------------------------------------

function testAdditionsEvidenceBehaviorUnchanged() {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const addition = buildCandidate('actor_proposal', 'Ulric', [evidenceCitationFor(doc, 'Ulric')], null);

  const result = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [addition]));
  const entryIdMap = result.refinementMetadata!.entryIdMap;
  const rebasedIds = new Set(Object.values(entryIdMap));
  const added = result.entries.find((e) => !rebasedIds.has(e.id))!;

  assert.equal(added.evidence.length, 1);
  assert.equal(added.evidence[0].exactText, 'Ulric');
  assert.match(added.evidence[0].unitId, /^source-unit:b4:/);
  assert.equal('suggestedRefinements' in added, false, 'an addition must never itself carry suggestedRefinements');
}

// ---------------------------------------------------------------------------
// 7. baseline/artifact inputs remain immutable
// ---------------------------------------------------------------------------

function testInputsRemainImmutable() {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const target = originalEntry(baseline, 'actor_mara');
  const suggestion = buildCandidate('actor_proposal', 'Mara the Wanderer', [evidenceCitationFor(doc, 'Mara')], target.id);
  const artifact = buildArtifact(baseline, [suggestion]);

  const baselineBefore = JSON.stringify(baseline);
  const artifactBefore = JSON.stringify(artifact);
  mergeBootstrapRefinementArtifact(baseline, artifact);
  assert.equal(JSON.stringify(baseline), baselineBefore);
  assert.equal(JSON.stringify(artifact), artifactBefore);
}

function run() {
  testSuggestionEvidenceSurvivesMergeExactly();
  testOriginalBaselineEvidenceUnchanged();
  testSuggestionEvidenceIsSeparateFromBaselineEvidence();
  testMalformedSuggestionEvidenceFailsValidation();
  testChangingSuggestionEvidenceChangesManifestIdentity();
  testAdditionsEvidenceBehaviorUnchanged();
  testInputsRemainImmutable();
  console.log('B4b suggestion-evidence preservation hardening regression passed');
}

run();
