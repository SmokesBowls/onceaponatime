import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AuthorSourceDocument, InferenceReceipt, StoryProject } from '../src/types';
import {
  buildBootstrapManifest,
  decideBootstrapManifestEntry,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import {
  BOOTSTRAP_REFINEMENT_OPERATION,
  BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
  assertNoIdentityCollisions,
  isBootstrapRefinementEligible,
  parseJsonNoDuplicateKeys,
  validateBootstrapRefinementOutput,
} from '../src/lib/bootstrapRefinement';
import {
  buildBootstrapRefinementPrompt,
  refineBootstrapManifest,
} from '../server/bootstrapRefinement';
import type {
  HermesGenerateTextResult,
  ModelProvider,
  ReceiptBearingGenerateTextParams,
  ReceiptBearingModelProvider,
} from '../server/modelProvider';

/**
 * B4a RED gate: the Hermes Refinement Artifact Boundary.
 *
 * Frozen against TODO.md's "B4a -- Hermes Refinement Artifact Boundary" contract
 * (014e7f2). Neither src/lib/bootstrapRefinement.ts nor server/bootstrapRefinement.ts
 * exists yet -- this file's own imports are the first genuinely absent public
 * boundary, matching the B2/B3d RED precedent. Covers all 15 frozen guarantees:
 * unreachability from B2/B3/B3d, exact operation label, prompt built only from the
 * bound baseline, receipt propagation, eligibility gating before invocation,
 * duplicate-key-safe JSON parsing, closed structural/kind/topology validation, UTF-16
 * coordinate replay (including astral fixtures, duplicate vs. overlapping spans),
 * resource limits, a valid empty-entries artifact, deterministic SHA-256 digesting,
 * shortened-ID collision rejection, fail-closed provider failure modes, and
 * non-mutation of the baseline argument.
 *
 * No additive merge into BootstrapManifest, no React/UI, and no live HTTP route are
 * exercised here -- those are B4b/B4c/B4d's own RED gates.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASELINE_TEXT = 'Locke found Mara near the old well. Ulric watched from the ridge.';

function sourceOnlyProject(pastedText: string): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4a_test',
    projectTitle: 'B4a RED Fixture',
    sourceLabel: 'Chapter One',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4a_test',
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

function citationFor(doc: AuthorSourceDocument, substring: string): { source_document_id: string; start_offset: number; end_offset: number } {
  const start = doc.exactText.indexOf(substring);
  if (start === -1) throw new Error(`Fixture error: "${substring}" not found in source document ${doc.id}`);
  return { source_document_id: doc.id, start_offset: start, end_offset: start + substring.length };
}

function locationProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'location_proposal', id, working_label: label, name: null, aliases: [] };
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
      discoveryEntry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')]),
      discoveryEntry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
}

function baselineDoc(baseline: BootstrapManifest): AuthorSourceDocument {
  const doc = baseline.boundSourceDocuments[0];
  assert.ok(doc, 'baseline fixture requires a bound source document');
  return doc;
}

// ---------------------------------------------------------------------------
// Fake receipt-bearing provider (mirrors tests/stage1HermesActivation.test.ts)
// ---------------------------------------------------------------------------

function admittedReceipt(overrides: Partial<InferenceReceipt> = {}): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId: 'b4a-request-001',
    operation: BOOTSTRAP_REFINEMENT_OPERATION,
    actualProvider: 'openrouter',
    actualModel: 'actual/model-build-2026-09-01',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
    ...overrides,
  });
}

function providerReturning(
  generate: (params: ReceiptBearingGenerateTextParams) => Promise<HermesGenerateTextResult>,
  available = true,
): ReceiptBearingModelProvider {
  return {
    name: 'b4a-test-provider',
    isAvailable: () => available,
    generateText: generate,
  };
}

function fixedTextProvider(text: string, receipt: InferenceReceipt = admittedReceipt()): ReceiptBearingModelProvider {
  return providerReturning(async () => Object.freeze({ text, receipt }));
}

// ---------------------------------------------------------------------------
// Raw refinement output builders
// ---------------------------------------------------------------------------

function validCandidateFor(baseline: BootstrapManifest): Record<string, unknown> {
  return {
    kind: 'actor_proposal',
    working_label: 'Ulric',
    name: null,
    aliases: [],
    refines_entry_id: null,
    evidence: [citationFor(baselineDoc(baseline), 'Ulric')],
  };
}

function validOutputJson(baseline: BootstrapManifest, entries?: unknown[]): string {
  return JSON.stringify({
    schema: BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
    baseline_manifest_id: baseline.id,
    bound_source_fingerprint: baseline.boundSourceFingerprint,
    entries: entries ?? [validCandidateFor(baseline)],
  });
}

// ---------------------------------------------------------------------------
// 1. refineBootstrapManifest() is unreachable from B2/B3/B3d
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

function testRefinementIsUnreachableFromB2B3B3d(): void {
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
    assert.ok(!/bootstrapRefinement/.test(source), `${file} must not reference the B4a refinement module`);
    assert.ok(!/refineBootstrapManifest/.test(source), `${file} must not call refineBootstrapManifest()`);
  }
}

// ---------------------------------------------------------------------------
// 2. exact operation label; transitional ModelProvider rejected at type level
// ---------------------------------------------------------------------------

function assertCompileTimeProviderBoundary(): void {
  const legacyProvider: ModelProvider = {
    name: 'legacy-receipt-optional-provider',
    isAvailable: () => true,
    generateText: async () => ({ text: validOutputJson(pendingBaseline()) }),
  };
  // @ts-expect-error B4a requires a receipt-bearing provider, not the transitional ModelProvider.
  void refineBootstrapManifest(pendingBaseline(), legacyProvider);
}

async function testUsesExactOperationLabelAndNothingElse(): Promise<void> {
  const baseline = pendingBaseline();
  const operations: string[] = [];
  const provider = providerReturning(async (params) => {
    operations.push(params.operation);
    return Object.freeze({ text: validOutputJson(baseline), receipt: admittedReceipt() });
  });
  await refineBootstrapManifest(baseline, provider);
  assert.deepEqual(operations, [BOOTSTRAP_REFINEMENT_OPERATION]);
}

// ---------------------------------------------------------------------------
// 3. the prompt is built only from the exact bound baseline
// ---------------------------------------------------------------------------

function testPromptDependsOnlyOnBoundBaselineContent(): void {
  const baselineA = pendingBaseline();
  const baselineB = pendingBaseline();
  assert.deepEqual(
    buildBootstrapRefinementPrompt(baselineA),
    buildBootstrapRefinementPrompt(baselineB),
    'two identically-built baselines must produce an identical prompt',
  );

  const changedBaseline = pendingBaseline('Locke found Mara near the old well. Ulric watched from the bridge.');
  assert.notDeepEqual(
    buildBootstrapRefinementPrompt(baselineA),
    buildBootstrapRefinementPrompt(changedBaseline),
    'a changed bound source must change the prompt deterministically',
  );
}

// ---------------------------------------------------------------------------
// 4. the returned artifact carries the exact receipt and is deep-frozen
// ---------------------------------------------------------------------------

async function testArtifactCarriesExactReceiptAndIsDeepFrozen(): Promise<void> {
  const baseline = pendingBaseline();
  const receipt = admittedReceipt();
  const artifact = await refineBootstrapManifest(baseline, fixedTextProvider(validOutputJson(baseline), receipt));

  assert.equal(artifact.receipt, receipt);
  assert.equal(Object.isFrozen(artifact), true);
  assert.equal(Object.isFrozen(artifact.value), true);
  assert.equal(artifact.value.candidates.length, 1);
  for (const candidate of artifact.value.candidates) {
    assert.equal(Object.isFrozen(candidate), true);
    for (const citation of candidate.evidence) assert.equal(Object.isFrozen(citation), true);
  }
}

// ---------------------------------------------------------------------------
// 5. ineligible baseline rejects before the provider is ever invoked
// ---------------------------------------------------------------------------

async function testIneligibleBaselineRejectsBeforeProviderCall(): Promise<void> {
  const baseline = pendingBaseline();
  const decided = decideBootstrapManifestEntry(baseline, baseline.entries[0].id, 'approved');

  assert.equal(isBootstrapRefinementEligible(baseline), true);
  assert.equal(isBootstrapRefinementEligible(decided), false);

  let called = false;
  const provider = providerReturning(async (params) => {
    called = true;
    return Object.freeze({ text: validOutputJson(decided), receipt: admittedReceipt() });
  });
  await assert.rejects(() => refineBootstrapManifest(decided, provider));
  assert.equal(called, false, 'an ineligible baseline must reject before the provider is ever invoked');
}

// ---------------------------------------------------------------------------
// 6. duplicate-key-detecting JSON parsing
// ---------------------------------------------------------------------------

function testDuplicateKeyJsonFailsClosed(): void {
  assert.throws(() => parseJsonNoDuplicateKeys('{"a":1,"a":2}'));
  assert.doesNotThrow(() => parseJsonNoDuplicateKeys('{"a":1,"b":2}'));
  assert.throws(() => parseJsonNoDuplicateKeys('{"entries":[{"kind":"actor_proposal","kind":"object_proposal"}]}'));
  assert.throws(() => parseJsonNoDuplicateKeys('{"a":1} garbage'));
}

async function testMalformedTopLevelJsonFailsClosedThroughRefine(): Promise<void> {
  const baseline = pendingBaseline();
  await assert.rejects(() => refineBootstrapManifest(baseline, fixedTextProvider('{"a":1,"a":2}')));
}

// ---------------------------------------------------------------------------
// 7. wrong key set / schema / baseline id / source fingerprint fail closed
// ---------------------------------------------------------------------------

function testStructuralIdentityMismatchesFailClosed(): void {
  const baseline = pendingBaseline();
  const valid = JSON.parse(validOutputJson(baseline));

  assert.throws(() => validateBootstrapRefinementOutput(JSON.stringify({ ...valid, extra_key: 'nope' }), baseline));
  assert.throws(() => validateBootstrapRefinementOutput(JSON.stringify({ ...valid, schema: 'wrong.schema.v0' }), baseline));
  assert.throws(() => validateBootstrapRefinementOutput(JSON.stringify({ ...valid, baseline_manifest_id: 'not-the-real-id' }), baseline));
  assert.throws(() => validateBootstrapRefinementOutput(JSON.stringify({ ...valid, bound_source_fingerprint: 'not-the-real-fingerprint' }), baseline));
  assert.doesNotThrow(() => validateBootstrapRefinementOutput(validOutputJson(baseline), baseline));
}

// ---------------------------------------------------------------------------
// 8. all four supported kinds parse; unsupported/unknown kinds and topology
//    fields reject the whole output
// ---------------------------------------------------------------------------

function testSupportedKindsAndExcludedTopologyFields(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);

  for (const kind of ['actor_proposal', 'object_proposal', 'location_proposal', 'faction_proposal']) {
    const candidate: Record<string, unknown> = {
      kind, working_label: 'Something', name: null, aliases: [], refines_entry_id: null,
      evidence: [citationFor(doc, 'Ulric')],
    };
    if (kind === 'location_proposal') candidate.description_summary = 'A watchpost.';
    assert.doesNotThrow(
      () => validateBootstrapRefinementOutput(validOutputJson(baseline, [candidate]), baseline),
      `kind ${kind} should be accepted`,
    );
  }

  for (const kind of ['fact_proposal', 'relationship_proposal', 'unknown_kind']) {
    const candidate = { kind, working_label: 'x', name: null, aliases: [], refines_entry_id: null, evidence: [citationFor(doc, 'Ulric')] };
    assert.throws(
      () => validateBootstrapRefinementOutput(validOutputJson(baseline, [candidate]), baseline),
      `kind ${kind} must reject the whole output`,
    );
  }

  for (const [field, value] of [['initial_location_id', 'location_well'], ['initial_holder_actor_id', 'actor_mara'], ['member_actor_ids', []]] as const) {
    const candidate: Record<string, unknown> = {
      kind: 'actor_proposal', working_label: 'x', name: null, aliases: [], refines_entry_id: null,
      evidence: [citationFor(doc, 'Ulric')], [field]: value,
    };
    assert.throws(
      () => validateBootstrapRefinementOutput(validOutputJson(baseline, [candidate]), baseline),
      `topology field ${field} must reject the whole output`,
    );
  }
}

// ---------------------------------------------------------------------------
// 9. UTF-16 coordinate replay
// ---------------------------------------------------------------------------

function testCoordinateReplayRules(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);

  const candidateWith = (evidence: unknown[]) => ({
    kind: 'actor_proposal', working_label: 'x', name: null, aliases: [], refines_entry_id: null, evidence,
  });
  const rejects = (evidence: unknown[]) => assert.throws(
    () => validateBootstrapRefinementOutput(validOutputJson(baseline, [candidateWith(evidence)]), baseline),
  );
  const accepts = (evidence: unknown[]) => assert.doesNotThrow(
    () => validateBootstrapRefinementOutput(validOutputJson(baseline, [candidateWith(evidence)]), baseline),
  );

  rejects([{ source_document_id: doc.id, start_offset: 0, end_offset: doc.exactText.length + 1000 }]);
  rejects([{ source_document_id: doc.id, start_offset: 5, end_offset: 5 }]);
  rejects([{ source_document_id: doc.id, start_offset: -1, end_offset: 3 }]);
  rejects([{ source_document_id: doc.id, start_offset: 1.5, end_offset: 3 }]);
  rejects([{ source_document_id: 'not-a-real-document', start_offset: 0, end_offset: 3 }]);
  rejects([citationFor(doc, '. ')]); // no Unicode letter or number in the span

  // astral / surrogate-pair fixture: a real, correctly-computed UTF-16 span over
  // a character outside the BMP must resolve, not be mishandled as code points.
  const astralBaseline = pendingBaseline('\u{1D504}ncient rune glimmered near Mara at the old well.');
  const astralCitation = citationFor(baselineDoc(astralBaseline), '\u{1D504}ncient');
  assert.doesNotThrow(() => validateBootstrapRefinementOutput(
    validOutputJson(astralBaseline, [{ kind: 'actor_proposal', working_label: 'x', name: null, aliases: [], refines_entry_id: null, evidence: [astralCitation] }]),
    astralBaseline,
  ));

  // duplicate identical spans within one candidate fail closed
  const singleCitation = citationFor(doc, 'Ulric');
  rejects([singleCitation, singleCitation]);

  // distinct overlapping spans within one candidate are preserved (accepted)
  accepts([citationFor(doc, 'Ulric'), citationFor(doc, 'ric watched')]);

  // reuse of the same span across different candidates is preserved (accepted)
  const twoCandidatesSameSpan = [
    { kind: 'actor_proposal', working_label: 'Ulric the Watcher', name: null, aliases: [], refines_entry_id: null, evidence: [citationFor(doc, 'Ulric')] },
    { kind: 'faction_proposal', working_label: 'Watchers of the Ridge', name: null, aliases: [], refines_entry_id: null, evidence: [citationFor(doc, 'Ulric')] },
  ];
  assert.doesNotThrow(() => validateBootstrapRefinementOutput(validOutputJson(baseline, twoCandidatesSameSpan), baseline));
}

// ---------------------------------------------------------------------------
// 10. resource limits
// ---------------------------------------------------------------------------

function testResourceLimitsRejectClosed(): void {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const validCitation = citationFor(doc, 'Ulric');
  const rejects = (candidate: Record<string, unknown>) => assert.throws(
    () => validateBootstrapRefinementOutput(validOutputJson(baseline, [candidate]), baseline),
  );

  const tooManyCandidates = Array.from({ length: 65 }, (_, i) => ({
    kind: 'actor_proposal', working_label: `Candidate ${i}`, name: null, aliases: [], refines_entry_id: null, evidence: [validCitation],
  }));
  assert.throws(() => validateBootstrapRefinementOutput(validOutputJson(baseline, tooManyCandidates), baseline));

  rejects({ kind: 'actor_proposal', working_label: 'x', name: null, aliases: [], refines_entry_id: null, evidence: Array.from({ length: 9 }, () => validCitation) });
  rejects({ kind: 'actor_proposal', working_label: 'x', name: null, aliases: [], refines_entry_id: null, evidence: [] });
  rejects({ kind: 'actor_proposal', working_label: 'x', name: null, aliases: Array.from({ length: 17 }, (_, i) => `alias${i}`), refines_entry_id: null, evidence: [validCitation] });
  rejects({ kind: 'actor_proposal', working_label: '   ', name: null, aliases: [], refines_entry_id: null, evidence: [validCitation] });
  rejects({ kind: 'actor_proposal', working_label: 'Ulric\u0007', name: null, aliases: [], refines_entry_id: null, evidence: [validCitation] });
  rejects({ kind: 'actor_proposal', working_label: 'x', name: 'n'.repeat(201), aliases: [], refines_entry_id: null, evidence: [validCitation] });
  rejects({ kind: 'location_proposal', working_label: 'x', name: null, aliases: [], refines_entry_id: null, evidence: [validCitation], description_summary: 'd'.repeat(2001) });

  const oversizedOutput = validOutputJson(baseline, [{ kind: 'actor_proposal', working_label: 'x'.repeat(300_000), name: null, aliases: [], refines_entry_id: null, evidence: [validCitation] }]);
  assert.throws(() => validateBootstrapRefinementOutput(oversizedOutput, baseline));
}

// ---------------------------------------------------------------------------
// 11. a fully valid, empty entries array is a real artifact, not an error
// ---------------------------------------------------------------------------

async function testEmptyEntriesProducesRealArtifactNotError(): Promise<void> {
  const baseline = pendingBaseline();
  const receipt = admittedReceipt();
  const artifact = await refineBootstrapManifest(baseline, fixedTextProvider(validOutputJson(baseline, []), receipt));
  assert.deepEqual(artifact.value.candidates, []);
  assert.equal(artifact.receipt, receipt);
}

// ---------------------------------------------------------------------------
// 12. SHA-256 digest scheme: deterministic, change-sensitive
// ---------------------------------------------------------------------------

async function testDigestsAreDeterministicAndChangeSensitive(): Promise<void> {
  const baseline = pendingBaseline();
  const outputText = validOutputJson(baseline);
  const receipt = admittedReceipt();

  const artifactA = await refineBootstrapManifest(baseline, fixedTextProvider(outputText, receipt));
  const artifactB = await refineBootstrapManifest(baseline, fixedTextProvider(outputText, receipt));
  assert.equal(artifactA.value.candidates[0].candidateDigest, artifactB.value.candidates[0].candidateDigest);
  assert.equal(artifactA.value.rawOutputDigest, artifactB.value.rawOutputDigest);
  assert.equal(artifactA.value.artifactDigest, artifactB.value.artifactDigest);
  assert.ok(/^[0-9a-f]{64}$/.test(artifactA.value.rawOutputDigest));
  assert.ok(/^[0-9a-f]{64}$/.test(artifactA.value.candidates[0].candidateDigest));
  assert.ok(/^[0-9a-f]{64}$/.test(artifactA.value.artifactDigest));

  const changedCandidateOutput = validOutputJson(baseline, [{ ...validCandidateFor(baseline), working_label: 'Ulric the Watcher' }]);
  const artifactC = await refineBootstrapManifest(baseline, fixedTextProvider(changedCandidateOutput, receipt));
  assert.notEqual(artifactC.value.candidates[0].candidateDigest, artifactA.value.candidates[0].candidateDigest);
  assert.notEqual(artifactC.value.rawOutputDigest, artifactA.value.rawOutputDigest);
  assert.notEqual(artifactC.value.artifactDigest, artifactA.value.artifactDigest);

  const differentBaseline = pendingBaseline('Locke found Mara near the old well. Ulric watched from the bridge.');
  const artifactD = await refineBootstrapManifest(differentBaseline, fixedTextProvider(validOutputJson(differentBaseline), receipt));
  assert.notEqual(artifactD.value.artifactDigest, artifactA.value.artifactDigest);
}

// ---------------------------------------------------------------------------
// 13. shortened-ID collision fails closed even when full digests differ
// ---------------------------------------------------------------------------

function testShortenedIdCollisionFailsClosedEvenWithDifferentFullDigests(): void {
  const colliding = [
    { candidateId: 'bootstrap_ai_actor_proposal_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', candidateDigest: 'a'.repeat(64) },
    { candidateId: 'bootstrap_ai_actor_proposal_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', candidateDigest: 'b'.repeat(64) },
  ];
  assert.throws(() => assertNoIdentityCollisions(colliding));

  const distinct = [
    { candidateId: 'bootstrap_ai_actor_proposal_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', candidateDigest: 'x'.repeat(64) },
    { candidateId: 'bootstrap_ai_actor_proposal_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', candidateDigest: 'y'.repeat(64) },
  ];
  assert.doesNotThrow(() => assertNoIdentityCollisions(distinct));
}

async function testTwoIdenticalCandidatesInOneOutputCollideAndRejectTheWholeArtifact(): Promise<void> {
  const baseline = pendingBaseline();
  const candidate = validCandidateFor(baseline);
  const provider = fixedTextProvider(validOutputJson(baseline, [candidate, candidate]));
  await assert.rejects(() => refineBootstrapManifest(baseline, provider));
}

// ---------------------------------------------------------------------------
// 14. provider failure modes reject closed, with no fallback artifact
// ---------------------------------------------------------------------------

async function testProviderFailureModesRejectWithoutFallback(): Promise<void> {
  const baseline = pendingBaseline();

  const unavailable = providerReturning(async () => {
    throw new Error('should not be called');
  }, false);
  await assert.rejects(() => refineBootstrapManifest(baseline, unavailable), /unavailable/i);

  const throwing = providerReturning(async () => {
    throw new Error('broker rejected refinement inference');
  });
  await assert.rejects(() => refineBootstrapManifest(baseline, throwing), /broker rejected refinement inference/i);

  const httpShaped = providerReturning(async () => {
    throw new Error('Hermes inference failed (HTTP 503) SERVICE_UNAVAILABLE');
  });
  await assert.rejects(() => refineBootstrapManifest(baseline, httpShaped), /503/);
}

// ---------------------------------------------------------------------------
// 15. refineBootstrapManifest() never mutates its baseline argument
// ---------------------------------------------------------------------------

async function testRefineNeverMutatesItsBaselineArgument(): Promise<void> {
  const baseline = pendingBaseline();
  assert.equal(Object.isFrozen(baseline), true);
  const before = JSON.stringify(baseline);
  await refineBootstrapManifest(baseline, fixedTextProvider(validOutputJson(baseline)));
  assert.equal(JSON.stringify(baseline), before);
}

// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  testRefinementIsUnreachableFromB2B3B3d();
  await testUsesExactOperationLabelAndNothingElse();
  testPromptDependsOnlyOnBoundBaselineContent();
  await testArtifactCarriesExactReceiptAndIsDeepFrozen();
  await testIneligibleBaselineRejectsBeforeProviderCall();
  testDuplicateKeyJsonFailsClosed();
  await testMalformedTopLevelJsonFailsClosedThroughRefine();
  testStructuralIdentityMismatchesFailClosed();
  testSupportedKindsAndExcludedTopologyFields();
  testCoordinateReplayRules();
  testResourceLimitsRejectClosed();
  await testEmptyEntriesProducesRealArtifactNotError();
  await testDigestsAreDeterministicAndChangeSensitive();
  testShortenedIdCollisionFailsClosedEvenWithDifferentFullDigests();
  await testTwoIdenticalCandidatesInOneOutputCollideAndRejectTheWholeArtifact();
  await testProviderFailureModesRejectWithoutFallback();
  await testRefineNeverMutatesItsBaselineArgument();
  console.log('B4a Hermes refinement artifact boundary regression passed');
}

void assertCompileTimeProviderBoundary;
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
