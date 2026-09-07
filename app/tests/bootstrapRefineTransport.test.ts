import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import type { AuthorSourceDocument, StoryProject } from '../src/types';
import { createInferenceArtifact } from '../src/types';
import {
  buildBootstrapManifest,
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
} from '../src/lib/bootstrapRefinement';
import { handleBootstrapRefineRequest } from '../server/bootstrapRefineRoute';

/**
 * B4c1 RED gate -- the /api/bootstrap/refine route's transport/envelope
 * logic, extracted into a directly testable function per TODO.md's frozen
 * B4c1 contract (mirroring how server/narrativePipeline.ts already separates
 * orchestration from server.ts's thin route registration). No live HTTP
 * server or supertest-style integration is used -- this exercises the exact
 * bytes-in, {status, body}-out boundary server.ts's real route will call.
 *
 * Frozen HTTP meaning (TODO.md): 400 = the request never entered the
 * bootstrap-refinement operation boundary (malformed envelope/transport).
 * 500 = it entered but refinement did not produce an artifact.
 */

function sourceOnlyProject(pastedText: string): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4c1_transport',
    projectTitle: 'B4c1 Transport Fixture',
    sourceLabel: 'Chapter One',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4c1_transport',
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

function validBaseline(): BootstrapManifest {
  const project = sourceOnlyProject('Locke found Mara near the old well.');
  const doc = firstDoc(project);
  return buildBootstrapManifest(project, {
    entries: [discoveryEntry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u1', 'Mara')])],
  });
}

function fakeArtifact(baseline: BootstrapManifest): BootstrapRefinementArtifact {
  const receipt = Object.freeze({
    broker: 'Hermes', requestId: 'r1', operation: BOOTSTRAP_REFINEMENT_OPERATION,
    actualProvider: 'x', actualModel: 'y', fallbackUsed: false, fallbackIndex: 0, routeAttemptCount: 1,
  });
  return createInferenceArtifact(
    Object.freeze({
      schema: BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
      baselineManifestId: baseline.id,
      boundSourceFingerprint: baseline.boundSourceFingerprint,
      candidates: [],
      rawOutputDigest: 'a'.repeat(64),
      artifactDigest: 'b'.repeat(64),
    }),
    receipt,
  );
}

function countingRefine(result: (baseline: BootstrapManifest) => Promise<BootstrapRefinementArtifact>) {
  let calls = 0;
  const fn = async (baseline: BootstrapManifest) => { calls += 1; return result(baseline); };
  return { fn, callCount: () => calls };
}

async function testDuplicateTopLevelKeysReject400WithoutReachingRefine() {
  const baseline = validBaseline();
  const raw = `{"baseline":${JSON.stringify(baseline)},"baseline":${JSON.stringify(baseline)}}`;
  const { fn, callCount } = countingRefine(async (b) => fakeArtifact(b));

  const result = await handleBootstrapRefineRequest(Buffer.from(raw, 'utf8'), fn);
  assert.equal(result.status, 400);
  assert.equal((result.body as { success: boolean }).success, false);
  assert.equal(callCount(), 0, 'a duplicate-key request must never reach refineBootstrapManifest()');
}

async function testWrongEnvelopeKeySetRejects400() {
  const baseline = validBaseline();
  const { fn, callCount } = countingRefine(async (b) => fakeArtifact(b));

  const withExtraKey = JSON.stringify({ baseline, extra: 1 });
  const resultExtra = await handleBootstrapRefineRequest(Buffer.from(withExtraKey, 'utf8'), fn);
  assert.equal(resultExtra.status, 400);

  const missingBaseline = JSON.stringify({ notBaseline: baseline });
  const resultMissing = await handleBootstrapRefineRequest(Buffer.from(missingBaseline, 'utf8'), fn);
  assert.equal(resultMissing.status, 400);

  assert.equal(callCount(), 0, 'a wrong-envelope request must never reach refineBootstrapManifest()');
}

async function testInvalidUtf8Rejects400() {
  const { fn, callCount } = countingRefine(async (b) => fakeArtifact(b));
  // Lone continuation byte 0x80 with no leading byte is invalid UTF-8.
  const invalidUtf8 = Buffer.from([0x7b, 0x22, 0x62, 0x80, 0x22, 0x7d]); // {"b\x80"}
  const result = await handleBootstrapRefineRequest(invalidUtf8, fn);
  assert.equal(result.status, 400);
  assert.equal(callCount(), 0, 'invalid UTF-8 must never reach refineBootstrapManifest()');
}

async function testMalformedJsonRejects400() {
  const { fn, callCount } = countingRefine(async (b) => fakeArtifact(b));
  const result = await handleBootstrapRefineRequest(Buffer.from('{not json', 'utf8'), fn);
  assert.equal(result.status, 400);
  assert.equal(callCount(), 0);
}

async function testValidEnvelopeReachesRefineAndReturns200WithExactArtifact() {
  const baseline = validBaseline();
  const artifact = fakeArtifact(baseline);
  const { fn, callCount } = countingRefine(async () => artifact);

  const raw = JSON.stringify({ baseline });
  const result = await handleBootstrapRefineRequest(Buffer.from(raw, 'utf8'), fn);

  assert.equal(callCount(), 1);
  assert.equal(result.status, 200);
  const body = result.body as { success: true; artifact: BootstrapRefinementArtifact };
  assert.equal(body.success, true);
  assert.deepEqual(body.artifact, artifact, 'the response artifact must be exactly what refineBootstrapManifest() returned, unmodified');
}

async function testRefineFailureReturns500WithItsOwnMessage() {
  const baseline = validBaseline();
  const { fn } = countingRefine(async () => { throw new Error('Bootstrap refinement provider unavailable'); });

  const raw = JSON.stringify({ baseline });
  const result = await handleBootstrapRefineRequest(Buffer.from(raw, 'utf8'), fn);

  assert.equal(result.status, 500);
  const body = result.body as { success: false; error: string };
  assert.equal(body.success, false);
  assert.match(body.error, /Bootstrap refinement provider unavailable/);
}

async function testStructurallyMalformedBaselineFailsClosedVia500() {
  // The envelope itself is well-formed; the *baseline* inside it is not.
  // refineBootstrapManifest() (hardened in b24d806) is responsible for
  // rejecting this -- the route must not attempt to duplicate that check,
  // only propagate whatever it throws as a 500.
  const { fn } = countingRefine(async () => { throw new Error('Malformed Bootstrap Manifest identity'); });
  const raw = JSON.stringify({ baseline: { id: 'not-a-real-manifest' } });
  const result = await handleBootstrapRefineRequest(Buffer.from(raw, 'utf8'), fn);
  assert.equal(result.status, 500);
}

function testRouteFileNeverImportsTheMergeModule() {
  const path = new URL('../server/bootstrapRefineRoute.ts', import.meta.url).pathname;
  if (!existsSync(path)) return; // module absence is itself the primary RED signal above
  const source = readFileSync(path, 'utf8');
  assert.ok(!/bootstrapRefinementMerge/.test(source), 'the route must not import the B4b merge module -- merge is client-side only');
  assert.ok(!/mergeBootstrapRefinementArtifact/.test(source));
}

async function run() {
  await testDuplicateTopLevelKeysReject400WithoutReachingRefine();
  await testWrongEnvelopeKeySetRejects400();
  await testInvalidUtf8Rejects400();
  await testMalformedJsonRejects400();
  await testValidEnvelopeReachesRefineAndReturns200WithExactArtifact();
  await testRefineFailureReturns500WithItsOwnMessage();
  await testStructurallyMalformedBaselineFailsClosedVia500();
  testRouteFileNeverImportsTheMergeModule();
  console.log('B4c1 refine transport regression passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
