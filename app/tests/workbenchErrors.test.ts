import assert from 'node:assert/strict';
import type { ValidationReport } from '../src/types';
import {
  describeOperationFailure,
  revalidationFailureReport,
  workbenchOperationError,
} from '../src/lib/workbenchErrors';

function testDescribeOperationFailureExtractsUsefulText() {
  assert.equal(
    describeOperationFailure(new Error('Model provider "Hermes" is unavailable.')),
    'Model provider "Hermes" is unavailable.',
    'a real Error must surface its exact message',
  );
  assert.equal(describeOperationFailure('plain string rejection'), 'plain string rejection');
  assert.equal(describeOperationFailure(new Error('   ')), 'An unknown error occurred.',
    'a blank Error message must not be presented as if it were useful');
  assert.equal(describeOperationFailure(undefined), 'An unknown error occurred.');
  assert.equal(describeOperationFailure(null), 'An unknown error occurred.');
  assert.equal(describeOperationFailure({ weird: 'shape' }), 'An unknown error occurred.');
}

function testWorkbenchOperationErrorWrapsBothSources() {
  const executeError = workbenchOperationError('execute', new Error('Model provider "Hermes" is unavailable.'));
  assert.deepEqual(executeError, {
    source: 'execute',
    message: 'Model provider "Hermes" is unavailable.',
  });

  const promoteError = workbenchOperationError('promote', new Error('Mention extraction HTTP failure (502)'));
  assert.deepEqual(promoteError, {
    source: 'promote',
    message: 'Mention extraction HTTP failure (502)',
  });
}

function testRevalidationFailureReportNeverLooksLikeAPass() {
  const previous: ValidationReport = {
    passed: true,
    score: 92,
    diagnostics: [],
    verified: true,
    status: 'VERIFIED',
    notes: 'Prior beat verified cleanly.',
  };

  const report = revalidationFailureReport(new Error('Revalidation endpoint timed out'), previous);

  assert.equal(report.passed, false, 'a failed revalidation must never read as passed');
  assert.equal(report.verified, false, 'a failed revalidation must never read as verified');
  assert.equal(report.status, 'UNVERIFIED');
  assert.equal(report.score, 0);
  assert.equal(report.diagnostics.length, 1);
  assert.equal(report.diagnostics[0].severity, 'FATAL');
  assert.equal(report.diagnostics[0].rule, 'REVALIDATION_FAILED');
  assert.match(report.diagnostics[0].message, /Revalidation endpoint timed out/);
  assert.match(report.notes ?? '', /stale/i, 'must explicitly say the previous result is stale');
  assert.match(report.notes ?? '', /VERIFIED/, 'must reference what the previous (now-stale) verdict actually was');

  // The previous report object itself must never be mutated or reused by reference.
  assert.equal(previous.passed, true);
  assert.equal(previous.status, 'VERIFIED');
  assert.notEqual(report, previous);
}

function testRevalidationFailureReportHandlesNonErrorRejections() {
  const previous: ValidationReport = {
    passed: false,
    score: 40,
    diagnostics: [],
    verified: false,
    status: 'UNVERIFIED',
  };
  const report = revalidationFailureReport('network down', previous);
  assert.match(report.diagnostics[0].message, /network down/);
  assert.equal(report.passed, false);
}

function run() {
  testDescribeOperationFailureExtractsUsefulText();
  testWorkbenchOperationErrorWrapsBothSources();
  testRevalidationFailureReportNeverLooksLikeAPass();
  testRevalidationFailureReportHandlesNonErrorRejections();
  console.log('workbench error reporting regression passed');
}

run();
