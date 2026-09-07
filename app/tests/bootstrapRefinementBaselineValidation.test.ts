import assert from 'node:assert/strict';
import type { AuthorSourceDocument, InferenceReceipt, StoryProject } from '../src/types';
import {
  buildBootstrapManifest,
  deepFreeze,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import { BOOTSTRAP_REFINEMENT_OPERATION } from '../src/lib/bootstrapRefinement';
import { refineBootstrapManifest } from '../server/bootstrapRefinement';
import type {
  HermesGenerateTextResult,
  ReceiptBearingGenerateTextParams,
  ReceiptBearingModelProvider,
} from '../server/modelProvider';

/**
 * B4a hardening regression: refineBootstrapManifest() is an authority
 * boundary and must never assume its caller handed it a structurally valid
 * BootstrapManifest -- a hostile/malformed manifest must be rejected before
 * the provider is ever invoked, not merely before eligibility happens to
 * catch something unrelated. B4a's own frozen RED (tests/
 * bootstrapRefinementArtifact.test.ts) never exercised this because every
 * one of its fixtures is already structurally valid by construction; this
 * gap was found while surveying real integration surfaces for B4c, where a
 * baseline manifest first arrives as raw, potentially hostile browser JSON.
 *
 * Frozen and closed as its own slice, separate from B4c, per TODO.md.
 */

function sourceOnlyProject(pastedText: string): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4a_hardening_test',
    projectTitle: 'B4a Hardening Regression Fixture',
    sourceLabel: 'Chapter One',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4a_hardening_test',
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

function actorProposal(id: string, label: string): BootstrapProposal {
  return { kind: 'actor_proposal', id, working_label: label, name: null, aliases: [] };
}

function discoveryEntry(proposed: BootstrapProposal, evidence: readonly SourceEvidenceUnit[]): BootstrapDiscoveryEntry {
  return { proposed, evidence };
}

function validBaseline(): BootstrapManifest {
  const project = sourceOnlyProject('Locke found Mara near the old well.');
  const doc = firstDoc(project);
  return buildBootstrapManifest(project, {
    entries: [discoveryEntry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u1', 'Mara')])],
  });
}

/** Structurally malformed: an evidence unit's exactText no longer matches the bound source at its offsets. */
function malformedBaselineWithTamperedEvidence(): BootstrapManifest {
  const baseline = validBaseline();
  return deepFreeze({
    ...baseline,
    entries: baseline.entries.map((entry) => ({
      ...entry,
      evidence: entry.evidence.map((unit) => ({ ...unit, exactText: 'Not Actually There' })),
    })),
  }) as BootstrapManifest;
}

/** Both malformed (tampered evidence) AND ineligible (a decided entry) -- proves check ordering. */
function malformedAndIneligibleBaseline(): BootstrapManifest {
  const baseline = malformedBaselineWithTamperedEvidence();
  return deepFreeze({
    ...baseline,
    entries: baseline.entries.map((entry) => ({ ...entry, decision: 'approved' as const })),
  }) as BootstrapManifest;
}

function admittedReceipt(): InferenceReceipt {
  return Object.freeze({
    broker: 'Hermes',
    requestId: 'b4a-hardening-request-001',
    operation: BOOTSTRAP_REFINEMENT_OPERATION,
    actualProvider: 'openrouter',
    actualModel: 'actual/model-build-2026-09-01',
    fallbackUsed: false,
    fallbackIndex: 0,
    routeAttemptCount: 1,
  });
}

function validOutputJsonFor(baseline: BootstrapManifest): string {
  return JSON.stringify({
    schema: 'onceaponatime.bootstrap.refinement.v1',
    baseline_manifest_id: baseline.id,
    bound_source_fingerprint: baseline.boundSourceFingerprint,
    entries: [],
  });
}

function countingProvider(): { provider: ReceiptBearingModelProvider; callCount: () => number } {
  let calls = 0;
  const provider: ReceiptBearingModelProvider = {
    name: 'b4a-hardening-test-provider',
    isAvailable: () => true,
    generateText: async (params: ReceiptBearingGenerateTextParams): Promise<HermesGenerateTextResult> => {
      calls += 1;
      // Not used by the malformed-baseline test (it must never reach this point), but kept
      // realistic so the valid-baseline regression check below exercises the real happy path.
      return Object.freeze({ text: '{}', receipt: admittedReceipt() });
    },
  };
  return { provider, callCount: () => calls };
}

async function testMalformedBaselineRejectsBeforeProviderIsEverCalled(): Promise<void> {
  const malformed = malformedBaselineWithTamperedEvidence();
  const { provider, callCount } = countingProvider();

  await assert.rejects(() => refineBootstrapManifest(malformed, provider));
  assert.equal(callCount(), 0, 'a structurally malformed baseline must reject before the provider is ever invoked');
}

async function testStructuralValidationRunsBeforeEligibility(): Promise<void> {
  const baseline = malformedAndIneligibleBaseline();
  const { provider, callCount } = countingProvider();

  await assert.rejects(
    () => refineBootstrapManifest(baseline, provider),
    /Malformed Bootstrap Manifest/i,
    'a baseline that is both malformed and ineligible must fail on structural validation first, not eligibility',
  );
  assert.equal(callCount(), 0);
}

async function testValidBaselineStillReachesTheProvider(): Promise<void> {
  const baseline = validBaseline();
  const { provider, callCount } = countingProvider();
  const providerWithValidOutput: ReceiptBearingModelProvider = {
    name: provider.name,
    isAvailable: provider.isAvailable,
    generateText: async (params) => {
      await provider.generateText(params);
      return Object.freeze({ text: validOutputJsonFor(baseline), receipt: admittedReceipt() });
    },
  };

  const artifact = await refineBootstrapManifest(baseline, providerWithValidOutput);
  assert.equal(callCount(), 1, 'a structurally valid baseline must still reach the provider exactly once');
  assert.deepEqual(artifact.value.candidates, []);
}

async function run(): Promise<void> {
  await testMalformedBaselineRejectsBeforeProviderIsEverCalled();
  await testStructuralValidationRunsBeforeEligibility();
  await testValidBaselineStillReachesTheProvider();
  console.log('B4a baseline structural validation hardening regression passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
