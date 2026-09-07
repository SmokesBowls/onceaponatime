import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import React from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { StoryEditor } from '../src/components/StoryEditor';
import {
  deepFreeze,
  type BootstrapManifest,
} from '../src/lib/bootstrapManifest';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import type { WorkbenchOperationError } from '../src/lib/workbenchErrors';
import type { BootstrapReceipt } from '../src/lib/prepareBootstrap';
import type { StoryProject } from '../src/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B4c1 RED gate -- StoryEditor's own REFINE contract with a mocked
 * onRefineBootstrap (per TODO.md's B4c1 frozen contract), mirroring
 * tests/bootstrapApply.test.tsx's exact mocked-callback pattern. App.tsx's
 * actual handleRefineBootstrap composition (transport -> artifact
 * reconstruction -> client-side B4b merge, all inside one try/catch) is not
 * independently unit-tested here, matching this codebase's existing,
 * documented convention that no App.tsx-level callback implementation is
 * unit-tested (see bootstrapApply.test.tsx's own header comment) -- only the
 * server-side transport/envelope logic (tests/bootstrapRefineTransport
 * .test.ts) and this file's StoryEditor-level contract are exercised
 * directly.
 */

function sourceOnlyProject(overrides?: { text?: string; sourceDocumentId?: string }): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4c1_refine',
    projectTitle: 'B4c1 Refine Fixture',
    sourceLabel: 'Chapter One',
    pastedText: overrides?.text ?? 'Keen entered Ironspire.\n\nA locked chest sat in the corner.',
    importedAt: 1_700_000_000_000,
    sourceDocumentId: overrides?.sourceDocumentId ?? 'source_b4c1_refine',
  });
}

interface CallbackCalls {
  updateManuscript: number;
  applyBootstrap: number;
  refineBootstrap: BootstrapManifest[];
}

function callbackCalls(): CallbackCalls {
  return { updateManuscript: 0, applyBootstrap: 0, refineBootstrap: [] };
}

const FAKE_RECEIPT: BootstrapReceipt = {
  id: 'bootstrap-receipt:fake:fake',
  manifestId: 'manifest_fake',
  projectId: 'proj_b4c1_refine',
  boundSourceDocumentIds: ['source_b4c1_refine'],
  boundSourceFingerprint: 'fake',
  admissionFingerprint: 'fake',
  assignments: { activePovActorId: 'actor_keen', currentLocationId: 'location_ironspire' },
  entries: [],
  appliedEntryIds: [],
  unsupportedEntryIds: [],
  resultingProjectFingerprint: 'fake',
  transactionTimestamp: 1_700_000_000_000,
};

type RefineBootstrapMock = (baseline: BootstrapManifest) => Promise<BootstrapManifest>;

function storyEditorProps(
  project: StoryProject,
  calls = callbackCalls(),
  options?: { onRefineBootstrap?: RefineBootstrapMock; workbenchError?: WorkbenchOperationError | null },
): React.ComponentProps<typeof StoryEditor> {
  return {
    project,
    onUpdateManuscript: () => { calls.updateManuscript += 1; },
    onSetPovActor: () => {},
    onSetLocation: () => {},
    onExecuteFramework: async () => {},
    onExecuteNaked: async () => '',
    candidate: null,
    onAcceptCandidate: () => {},
    onRejectCandidate: () => {},
    onEditCandidateText: () => {},
    isGenerating: false,
    workbenchError: options?.workbenchError ?? null,
    onApplyBootstrap: async () => { calls.applyBootstrap += 1; return FAKE_RECEIPT; },
    onRefineBootstrap: (options?.onRefineBootstrap ?? (async (baseline) => {
      calls.refineBootstrap.push(baseline);
      return baseline;
    })) as unknown as RefineBootstrapMock,
  } as unknown as React.ComponentProps<typeof StoryEditor>;
}

function instanceText(instance: ReactTestInstance): string {
  return instance.children.map((child) => (
    typeof child === 'string' ? child : instanceText(child)
  )).join('');
}

function findButtonsLabelled(renderer: ReactTestRenderer, label: string): ReactTestInstance[] {
  return renderer.root.findAllByType('button').filter((candidate) => instanceText(candidate).trim() === label);
}

async function begin(renderer: ReactTestRenderer): Promise<void> {
  const beginButton = findButtonsLabelled(renderer, 'BEGIN STRUCTURAL REVIEW')[0];
  assert.ok(beginButton, 'fixture requires the locked panel to expose BEGIN STRUCTURAL REVIEW');
  await act(async () => { await beginButton.props.onClick(); });
}

function requireRefineButton(renderer: ReactTestRenderer): ReactTestInstance {
  const button = findButtonsLabelled(renderer, 'REFINE WITH HERMES')[0];
  assert.ok(button, 'a fresh, eligible review session must expose REFINE WITH HERMES');
  return button;
}

function refineButtonAbsentOrDisabled(renderer: ReactTestRenderer): boolean {
  const buttons = findButtonsLabelled(renderer, 'REFINE WITH HERMES');
  return buttons.length === 0 || buttons.every((button) => button.props.disabled === true);
}

async function approveFirstEntry(renderer: ReactTestRenderer): Promise<void> {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const manifest = renderer.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  const first = manifest.entries[0];
  const scope = renderer.root.findAll((node) => node.props['data-bootstrap-entry-id'] === first.id)[0];
  const label = first.supportedForApplication ? 'APPROVE' : 'REJECT';
  const button = scope.findAllByType('button').find((candidate) => instanceText(candidate).trim() === label)!;
  await act(async () => { await button.props.onClick(); });
}

function currentManifest(renderer: ReactTestRenderer): Promise<BootstrapManifest> {
  return import('../src/components/BootstrapReviewWorkspace').then(
    ({ BootstrapReviewWorkspace }) => renderer.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest,
  );
}

function combinedManifestFor(baseline: BootstrapManifest): BootstrapManifest {
  return deepFreeze({
    ...baseline,
    id: `${baseline.id}:combined`,
    refinementMetadata: {
      baselineManifestId: baseline.id,
      entryIdMap: Object.fromEntries(baseline.entries.map((e) => [e.id, e.id])),
      artifactDigest: 'a'.repeat(64),
      rawOutputDigest: 'b'.repeat(64),
      receipt: {
        broker: 'Hermes', requestId: 'r', operation: 'onceaponatime.bootstrap.refine',
        actualProvider: 'x', actualModel: 'y', fallbackUsed: false, fallbackIndex: 0, routeAttemptCount: 1,
      },
    },
  }) as BootstrapManifest;
}

// ---------------------------------------------------------------------------
// 1. never invoked automatically
// ---------------------------------------------------------------------------

async function testRefineNeverInvokedAutomatically() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls))); });
  await begin(renderer!);
  assert.equal(calls.refineBootstrap.length, 0, 'BEGIN alone must never trigger REFINE');
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// 2. visible/enabled only under the full eligibility expression
// ---------------------------------------------------------------------------

async function testRefineVisibleOnlyOnFreshUndecidedUnassignedSession() {
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);
  requireRefineButton(renderer!);
  await act(async () => { renderer!.unmount(); });
}

async function testRefineHiddenAfterAnyDecision() {
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);
  requireRefineButton(renderer!);
  await approveFirstEntry(renderer!);
  assert.ok(refineButtonAbsentOrDisabled(renderer!), 'REFINE must disappear once any entry has a decision');
  await act(async () => { renderer!.unmount(); });
}

async function testRefineHiddenAfterPovAssignment() {
  // Deliberately assigns before any entry is admitted -- admittedEntityCandidates()
  // would be empty on a fresh session, but the REFINE eligibility gate cares only
  // about assignments.activePovActorId !== null, not whether it resolves to a real
  // admitted entity (that is B3c's own readiness concern, not B4c1's).
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);
  requireRefineButton(renderer!);
  const povSelect = renderer!.root.findAllByProps({ 'data-role': 'pov-select' })[0];
  await act(async () => { povSelect.props.onChange({ target: { value: 'actor_keen' } }); });
  assert.ok(refineButtonAbsentOrDisabled(renderer!), 'REFINE must disappear once POV is assigned, even with zero decisions');
  await act(async () => { renderer!.unmount(); });
}

async function testRefineHiddenAfterCurrentLocationAssignment() {
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);
  requireRefineButton(renderer!);
  const locationSelect = renderer!.root.findAllByProps({ 'data-role': 'current-location-select' })[0];
  await act(async () => { locationSelect.props.onChange({ target: { value: 'location_ironspire' } }); });
  assert.ok(refineButtonAbsentOrDisabled(renderer!), 'REFINE must disappear once current location is assigned, even with zero decisions');
  await act(async () => { renderer!.unmount(); });
}

async function testRefineHiddenWhileStale() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls))); });
  await begin(renderer!);
  requireRefineButton(renderer!);

  const changedProject = sourceOnlyProject({
    text: 'Isla approached Falcon Ridge.\n\nA locked chest sat in the corner.',
    sourceDocumentId: 'source_b4c1_refine',
  });
  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, storyEditorProps(changedProject, calls)));
  });
  assert.ok(refineButtonAbsentOrDisabled(renderer!), 'REFINE must disappear once the review session is stale');
  await act(async () => { renderer!.unmount(); });
}

async function testRefineHiddenAfterAlreadySuccessfullyRefined() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  const refineOnce: RefineBootstrapMock = async (baseline) => combinedManifestFor(baseline);
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls, { onRefineBootstrap: refineOnce })));
  });
  await begin(renderer!);
  const refineButton = requireRefineButton(renderer!);
  await act(async () => { await refineButton.props.onClick(); });
  assert.ok(
    refineButtonAbsentOrDisabled(renderer!),
    'REFINE must disappear once the session has already gone through one successful refinement',
  );
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// 3. success replaces only the manifest
// ---------------------------------------------------------------------------

async function testSuccessfulRefineReplacesOnlyTheManifest() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  let capturedBaseline: BootstrapManifest | null = null;
  const refine: RefineBootstrapMock = async (baseline) => {
    capturedBaseline = baseline;
    calls.refineBootstrap.push(baseline);
    return combinedManifestFor(baseline);
  };
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls, { onRefineBootstrap: refine })));
  });
  await begin(renderer!);
  const before = await currentManifest(renderer!);
  const refineButton = requireRefineButton(renderer!);
  await act(async () => { await refineButton.props.onClick(); });

  assert.equal(calls.refineBootstrap.length, 1, 'REFINE must invoke the callback exactly once');
  assert.deepEqual(capturedBaseline, before, 'the exact current review manifest must be supplied, not reconstructed');

  const after = await currentManifest(renderer!);
  assert.equal(after.id, combinedManifestFor(before).id, 'the returned combined manifest must replace reviewSession.manifest');
  assert.equal(calls.updateManuscript, 0, 'REFINE must never touch canonical StoryProject state');
  assert.equal(calls.applyBootstrap, 0);

  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const assignments = renderer!.root.findByType(BootstrapReviewWorkspace).props.assignments;
  assert.deepEqual(assignments, { activePovActorId: null, currentLocationId: null }, 'assignments must remain exactly null/null after a successful refine');
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// 4. in-flight freezes every named control
// ---------------------------------------------------------------------------

async function testInFlightRefineFreezesReviewControls() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  let release: ((manifest: BootstrapManifest) => void) | null = null;
  const slowRefine: RefineBootstrapMock = (baseline) => {
    calls.refineBootstrap.push(baseline);
    return new Promise<BootstrapManifest>((resolve) => { release = resolve; });
  };
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls, { onRefineBootstrap: slowRefine })));
  });
  await begin(renderer!);
  const refineButton = requireRefineButton(renderer!);
  await act(async () => { refineButton.props.onClick(); });

  // A second REFINE click must not invoke again.
  const stillPresentRefine = findButtonsLabelled(renderer!, 'REFINE WITH HERMES');
  for (const button of stillPresentRefine) {
    if (button.props.disabled !== true) await act(async () => { await button.props.onClick(); });
  }
  assert.equal(calls.refineBootstrap.length, 1, 'a second click while refinement is in flight must not invoke the callback again');

  // Decision/assignment controls on every rendered entry must be disabled.
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const workspace = renderer!.root.findByType(BootstrapReviewWorkspace);
  assert.equal(workspace.props.isRefining, true, 'BootstrapReviewWorkspace must be told refinement is in flight');
  for (const button of workspace.findAllByType('button')) {
    const label = instanceText(button).trim();
    if (['APPROVE', 'EDIT', 'REJECT'].includes(label)) {
      assert.equal(button.props.disabled, true, `${label} must be disabled while refinement is in flight`);
    }
  }
  for (const select of workspace.findAllByType('select')) {
    assert.equal(select.props.disabled, true, 'assignment selects must be disabled while refinement is in flight');
  }

  // CLOSE must be inert.
  const closeButton = findButtonsLabelled(renderer!, 'CLOSE REVIEW')[0];
  if (closeButton) {
    await act(async () => { closeButton.props.onClick(); });
    assert.equal(
      renderer!.root.findAllByType(BootstrapReviewWorkspace).length,
      1,
      'CLOSE must be inert while refinement is in flight',
    );
  }

  // APPLY must be disabled/absent (readiness is incomplete on a fresh session anyway).
  const applyButtons = findButtonsLabelled(renderer!, 'APPLY');
  assert.ok(applyButtons.length === 0 || applyButtons.every((b) => b.props.disabled === true));

  const inFlightBaseline = await currentManifest(renderer!);
  await act(async () => { release!(combinedManifestFor(inFlightBaseline)); });
  await act(async () => { await Promise.resolve(); });
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// 5. failure leaves the session untouched, surfaces the workbench error
// ---------------------------------------------------------------------------

async function testFailedRefineRetainsSessionAndSurfacesWorkbenchError() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  const failingRefine: RefineBootstrapMock = async () => { throw new Error('Bootstrap refinement transport failed'); };
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls, { onRefineBootstrap: failingRefine })));
  });
  await begin(renderer!);
  const before = await currentManifest(renderer!);
  const refineButton = requireRefineButton(renderer!);
  await act(async () => { await refineButton.props.onClick().catch(() => undefined); });

  const after = await currentManifest(renderer!);
  assert.deepEqual(after, before, 'a failed refine must leave the exact original review manifest retained');

  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, storyEditorProps(project, calls, {
      onRefineBootstrap: failingRefine,
      workbenchError: { source: 'bootstrap-refine' as unknown as WorkbenchOperationError['source'], message: 'Bootstrap refinement transport failed' },
    })));
  });
  assert.ok(
    instanceText(renderer!.root).includes('Bootstrap refinement transport failed'),
    'the failure must be visibly reported with the actual thrown message',
  );
  requireRefineButton(renderer!); // retry remains available immediately
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// 7. late completion is inert across a project switch
// ---------------------------------------------------------------------------

async function testLateRefineCompletionInertOnProjectSwitch() {
  const projectA = sourceOnlyProject();
  const projectB = sourceOnlyProject({ text: 'Isla approached Falcon Ridge.\n\nA locked chest sat in the corner.', sourceDocumentId: 'source_b4c1_refine_b' });
  const callsA = callbackCalls();
  const callsB = callbackCalls();
  let releaseA: ((manifest: BootstrapManifest) => void) | null = null;
  const slowRefineA: RefineBootstrapMock = (baseline) => new Promise<BootstrapManifest>((resolve) => { releaseA = resolve; });

  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(projectA, callsA, { onRefineBootstrap: slowRefineA })));
  });
  await begin(renderer!);
  const refineButton = requireRefineButton(renderer!);
  await act(async () => { refineButton.props.onClick(); });

  // Switch to a different project entirely while the refine is still in flight.
  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, storyEditorProps(projectB, callsB)));
  });
  await begin(renderer!);
  const projectBManifestBeforeLateCompletion = await currentManifest(renderer!);

  // Now the stale project-A refinement resolves.
  await act(async () => { releaseA!(combinedManifestFor(projectBManifestBeforeLateCompletion)); });
  await act(async () => { await Promise.resolve(); });

  const projectBManifestAfter = await currentManifest(renderer!);
  assert.deepEqual(
    projectBManifestAfter,
    projectBManifestBeforeLateCompletion,
    'a late completion from a superseded project/session must not overwrite the current session',
  );
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// Static: neither StoryEditor.tsx nor BootstrapReviewWorkspace.tsx import the
// B4b merge module themselves -- only App.tsx does.
// ---------------------------------------------------------------------------

function testNeitherComponentImportsTheMergeModuleDirectly() {
  for (const relativePath of ['../src/components/StoryEditor.tsx', '../src/components/BootstrapReviewWorkspace.tsx']) {
    const path = new URL(relativePath, import.meta.url).pathname;
    assert.ok(existsSync(path));
    const source = readFileSync(path, 'utf8');
    assert.ok(!/bootstrapRefinementMerge/.test(source), `${relativePath} must not import the B4b merge module -- only App.tsx does`);
    assert.ok(!/mergeBootstrapRefinementArtifact/.test(source), `${relativePath} must not call mergeBootstrapRefinementArtifact()`);
  }
}

async function run() {
  await testRefineNeverInvokedAutomatically();
  await testRefineVisibleOnlyOnFreshUndecidedUnassignedSession();
  await testRefineHiddenAfterAnyDecision();
  await testRefineHiddenAfterPovAssignment();
  await testRefineHiddenAfterCurrentLocationAssignment();
  await testRefineHiddenWhileStale();
  await testRefineHiddenAfterAlreadySuccessfullyRefined();
  await testSuccessfulRefineReplacesOnlyTheManifest();
  await testInFlightRefineFreezesReviewControls();
  await testFailedRefineRetainsSessionAndSurfacesWorkbenchError();
  await testLateRefineCompletionInertOnProjectSwitch();
  testNeitherComponentImportsTheMergeModuleDirectly();
  console.log('B4c1 refine lifecycle regression passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
