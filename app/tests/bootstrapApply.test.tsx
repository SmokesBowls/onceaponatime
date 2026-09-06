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
  buildBootstrapManifest,
  type BootstrapAssignments,
  type BootstrapManifest,
} from '../src/lib/bootstrapManifest';
import { admittedEntityCandidates } from '../src/lib/bootstrapReview';
import { discoverBootstrap } from '../src/lib/bootstrapDiscovery';
import { prepareBootstrap, type BootstrapReceipt } from '../src/lib/prepareBootstrap';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import type { WorkbenchOperationError } from '../src/lib/workbenchErrors';
import type { StoryProject } from '../src/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B3d RED gate -- StoryEditor's own contract with a mocked onApplyBootstrap
 * (per TODO.md's B3d prop-boundary decision), plus one direct test against
 * the real prepareBootstrap() for the stale-source-race guarantee (item 14),
 * which is pre-existing B1 behavior this file only confirms rather than
 * introduces. App.tsx's actual wiring (the real prepareBootstrap() call site
 * and updateActiveProject()) is not independently tested here, matching how
 * no other App.tsx-level callback implementation is unit-tested in this
 * codebase -- StoryEditor's tests throughout mock every callback prop.
 */

function sourceOnlyProject(overrides?: { text?: string; sourceDocumentId?: string }): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b3d_apply',
    projectTitle: 'B3d Apply Fixture',
    sourceLabel: 'Chapter One',
    pastedText: overrides?.text ?? 'Keen entered Ironspire.\n\nA locked chest sat in the corner.',
    importedAt: 1_700_000_000_000,
    sourceDocumentId: overrides?.sourceDocumentId ?? 'source_b3d_apply',
  });
}

interface CallbackCalls {
  updateManuscript: number;
  setPov: number;
  setLocation: number;
  executeFramework: number;
  executeNaked: number;
  acceptCandidate: number;
  rejectCandidate: number;
  editCandidate: number;
  applyBootstrap: Array<{ manifest: BootstrapManifest; assignments: BootstrapAssignments; transactionTimestamp: number }>;
}

function callbackCalls(): CallbackCalls {
  return {
    updateManuscript: 0,
    setPov: 0,
    setLocation: 0,
    executeFramework: 0,
    executeNaked: 0,
    acceptCandidate: 0,
    rejectCandidate: 0,
    editCandidate: 0,
    applyBootstrap: [],
  };
}

const FAKE_RECEIPT: BootstrapReceipt = {
  id: 'bootstrap-receipt:fake:fake',
  manifestId: 'manifest_fake',
  projectId: 'proj_b3d_apply',
  boundSourceDocumentIds: ['source_b3d_apply'],
  boundSourceFingerprint: 'fake',
  admissionFingerprint: 'fake',
  assignments: { activePovActorId: 'actor_keen', currentLocationId: 'location_ironspire' },
  entries: [],
  appliedEntryIds: [],
  unsupportedEntryIds: [],
  resultingProjectFingerprint: 'fake',
  transactionTimestamp: 1_700_000_000_000,
};

type ApplyBootstrapMock = (
  manifest: BootstrapManifest,
  assignments: BootstrapAssignments,
  transactionTimestamp: number,
) => Promise<BootstrapReceipt>;

function storyEditorProps(
  project: StoryProject,
  calls = callbackCalls(),
  options?: { onApplyBootstrap?: ApplyBootstrapMock; workbenchError?: WorkbenchOperationError | null },
): React.ComponentProps<typeof StoryEditor> {
  return {
    project,
    onUpdateManuscript: () => { calls.updateManuscript += 1; },
    onSetPovActor: () => { calls.setPov += 1; },
    onSetLocation: () => { calls.setLocation += 1; },
    onExecuteFramework: async () => { calls.executeFramework += 1; },
    onExecuteNaked: async () => { calls.executeNaked += 1; return ''; },
    candidate: null,
    onAcceptCandidate: () => { calls.acceptCandidate += 1; },
    onRejectCandidate: () => { calls.rejectCandidate += 1; },
    onEditCandidateText: () => { calls.editCandidate += 1; },
    isGenerating: false,
    workbenchError: options?.workbenchError ?? null,
    onApplyBootstrap: (options?.onApplyBootstrap ?? (async (manifest, assignments, transactionTimestamp) => {
      calls.applyBootstrap.push({ manifest, assignments, transactionTimestamp });
      return FAKE_RECEIPT;
    })) as unknown as ApplyBootstrapMock,
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

async function completeReview(renderer: ReactTestRenderer): Promise<void> {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  let manifest = renderer.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  for (const entry of manifest.entries) {
    const scope = renderer.root.findAll((node) => node.props['data-bootstrap-entry-id'] === entry.id)[0];
    const label = entry.supportedForApplication ? 'APPROVE' : 'REJECT';
    const button = scope.findAllByType('button').find((candidate) => instanceText(candidate).trim() === label);
    if (button) await act(async () => { await button.props.onClick(); });
    manifest = renderer.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  }

  const actorId = admittedEntityCandidates(manifest, 'actor_proposal')[0]?.id;
  const locationId = admittedEntityCandidates(manifest, 'location_proposal')[0]?.id;
  assert.ok(actorId && locationId, 'fixture must admit at least one actor and one location');

  const povSelect = renderer.root.findAllByProps({ 'data-role': 'pov-select' })[0];
  await act(async () => { povSelect.props.onChange({ target: { value: actorId } }); });
  const locationSelect = renderer.root.findAllByProps({ 'data-role': 'current-location-select' })[0];
  await act(async () => { locationSelect.props.onChange({ target: { value: locationId } }); });
}

// ---------------------------------------------------------------------------
// 1-3. APPLY gating: incomplete, stale, complete-and-fresh.
// ---------------------------------------------------------------------------

async function testIncompleteReviewNeverEnablesApply() {
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);
  // No decisions made yet -- review is pending, therefore incomplete.
  const applyButtons = findButtonsLabelled(renderer!, 'APPLY');
  assert.ok(
    applyButtons.length === 0 || applyButtons.every((button) => button.props.disabled === true),
    'an incomplete review must never render APPLY as enabled',
  );
  await act(async () => { renderer!.unmount(); });
}

async function testStaleReviewNeverEnablesApply() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls))); });
  await begin(renderer!);
  await completeReview(renderer!);

  const applyBeforeStale = findButtonsLabelled(renderer!, 'APPLY');
  assert.ok(applyBeforeStale.length > 0 && applyBeforeStale.every((b) => b.props.disabled !== true));

  const changedProject = sourceOnlyProject({
    text: 'Isla approached Falcon Ridge.\n\nA locked chest sat in the corner.',
    sourceDocumentId: 'source_b3d_apply',
  });
  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, storyEditorProps(changedProject, calls)));
  });

  const applyAfterStale = findButtonsLabelled(renderer!, 'APPLY');
  assert.ok(
    applyAfterStale.length === 0 || applyAfterStale.every((button) => button.props.disabled === true),
    'a stale review must never render APPLY as enabled, even though the underlying manifest would otherwise read complete',
  );
  await act(async () => { renderer!.unmount(); });
}

async function testCompleteFreshReviewEnablesApply() {
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);
  await completeReview(renderer!);

  const applyButtons = findButtonsLabelled(renderer!, 'APPLY');
  assert.ok(applyButtons.length > 0, 'a complete, non-stale review must expose APPLY');
  assert.ok(applyButtons.every((button) => button.props.disabled !== true), 'APPLY must be enabled');
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// 4-5. Exactly-once invocation with the exact current artifact.
// ---------------------------------------------------------------------------

async function testApplyInvokesCallbackExactlyOnceWithTheExactCurrentArtifact() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls))); });
  await begin(renderer!);
  await completeReview(renderer!);

  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const currentManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  const currentAssignments = renderer!.root.findByType(BootstrapReviewWorkspace).props.assignments as BootstrapAssignments;

  const applyButton = findButtonsLabelled(renderer!, 'APPLY')[0];
  await act(async () => { await applyButton.props.onClick(); });

  assert.equal(calls.applyBootstrap.length, 1, 'APPLY must invoke the callback exactly once');
  assert.deepEqual(calls.applyBootstrap[0].manifest, currentManifest, 'the exact current reviewed manifest must be supplied, not reconstructed');
  assert.deepEqual(calls.applyBootstrap[0].assignments, currentAssignments, 'the exact current assignments must be supplied');
  assert.equal(typeof calls.applyBootstrap[0].transactionTimestamp, 'number');
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// Success: session clears, receipt renders; readiness re-derives from the
// resulting project rather than any separate unlocked flag.
// ---------------------------------------------------------------------------

async function testSuccessfulApplyClearsSessionAndDisplaysReceipt() {
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);
  await completeReview(renderer!);

  const applyButton = findButtonsLabelled(renderer!, 'APPLY')[0];
  await act(async () => { await applyButton.props.onClick(); });

  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  assert.equal(
    renderer!.root.findAllByType(BootstrapReviewWorkspace).length,
    0,
    'a successful apply must retire the consumed review session',
  );
  assert.ok(
    instanceText(renderer!.root).includes(FAKE_RECEIPT.id),
    'the exact receipt returned by the authority operation must be rendered',
  );
  await act(async () => { renderer!.unmount(); });
}

async function testSuccessfulApplyRederivesReadinessFromResultingProjectNotAFlag() {
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);
  await completeReview(renderer!);
  const applyButton = findButtonsLabelled(renderer!, 'APPLY')[0];
  await act(async () => { await applyButton.props.onClick(); });

  assert.ok(instanceText(renderer!.root).includes('Composition Pipeline Unavailable'));

  // Simulate what App.tsx's real onApplyBootstrap would have produced: the
  // canonical project prop itself now carries the admitted actor/location
  // and explicit assignments -- nothing else changes about how StoryEditor
  // computes readiness.
  const admittedProject: StoryProject = {
    ...project,
    actors: [{
      id: 'actor_keen',
      identity: { name: null, working_label: 'Keen', aliases: [] },
      roles: { story: [], scene: [] },
      traits: {},
      active_goals: [],
      current_location_id: 'location_ironspire',
      possessions: [],
    } as unknown as StoryProject['actors'][number]],
    locations: [{
      id: 'location_ironspire',
      identity: { name: null, working_label: 'Ironspire', aliases: [] },
    } as unknown as StoryProject['locations'][number]],
    activePovActorId: 'actor_keen',
    currentPosition: { ...project.currentPosition, location_id: 'location_ironspire', location_label: 'Ironspire' },
  };
  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, storyEditorProps(admittedProject)));
  });

  assert.ok(
    !instanceText(renderer!.root).includes('Composition Pipeline Unavailable'),
    'composition must unlock purely because the resulting project now passes assessCompositionReadiness -- no separate flag needed',
  );
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// Failure: canonical/session state retained, error visibly reported through
// the existing WorkbenchOperationError/WorkbenchErrorNotice mechanism.
// ---------------------------------------------------------------------------

async function testFailedApplyRetainsSessionAndSurfacesWorkbenchError() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  const failingApply: ApplyBootstrapMock = async () => { throw new Error('Bootstrap scene/actor location contradiction'); };
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls, { onApplyBootstrap: failingApply })));
  });
  await begin(renderer!);
  await completeReview(renderer!);

  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const manifestBeforeFailure = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;

  const applyButton = findButtonsLabelled(renderer!, 'APPLY')[0];
  await act(async () => { await applyButton.props.onClick().catch(() => undefined); });

  assert.equal(
    renderer!.root.findAllByType(BootstrapReviewWorkspace).length,
    1,
    'a failed apply must retain the review session, not clear it',
  );
  assert.deepEqual(
    renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest,
    manifestBeforeFailure,
    'the retained session must be exactly what the author had, untouched by the failed attempt',
  );

  // App.tsx's real implementation sets workbenchError itself (source:
  // 'bootstrap') before rethrowing -- simulate that arriving as a prop update.
  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, storyEditorProps(project, calls, {
      onApplyBootstrap: failingApply,
      workbenchError: { source: 'bootstrap' as unknown as WorkbenchOperationError['source'], message: 'Bootstrap scene/actor location contradiction' },
    })));
  });
  assert.ok(
    instanceText(renderer!.root).includes('Bootstrap scene/actor location contradiction'),
    'the failure must be visibly reported with the actual thrown message',
  );
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// In-flight guard: a second click while applying cannot double-invoke.
// ---------------------------------------------------------------------------

async function testRepeatedApplyClicksWhileInFlightCannotDoubleInvoke() {
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  let releaseApply: (() => void) | null = null;
  const slowApply: ApplyBootstrapMock = (manifest, assignments, transactionTimestamp) => {
    calls.applyBootstrap.push({ manifest, assignments, transactionTimestamp });
    return new Promise<BootstrapReceipt>((resolve) => { releaseApply = () => resolve(FAKE_RECEIPT); });
  };
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(project, calls, { onApplyBootstrap: slowApply })));
  });
  await begin(renderer!);
  await completeReview(renderer!);

  const applyButton = findButtonsLabelled(renderer!, 'APPLY')[0];
  await act(async () => { applyButton.props.onClick(); });
  // While the first call is still in flight, click again (and again).
  const stillPresent = findButtonsLabelled(renderer!, 'APPLY');
  for (const button of stillPresent) {
    if (button.props.disabled !== true) {
      await act(async () => { await button.props.onClick(); });
    }
  }
  assert.equal(calls.applyBootstrap.length, 1, 'a second click while the first apply is in flight must not invoke the callback again');

  await act(async () => { releaseApply!(); });
  await act(async () => { await Promise.resolve(); });
  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// No direct canonical mutation path outside the single callback call site.
// ---------------------------------------------------------------------------

async function testNoDirectCanonicalMutationPathOutsideTheCallback() {
  const path = new URL('../src/components/StoryEditor.tsx', import.meta.url).pathname;
  assert.ok(existsSync(path));
  const source = readFileSync(path, 'utf8');
  for (const forbidden of [
    /\bproject\.actors\s*=/, /\bproject\.objects\s*=/, /\bproject\.locations\s*=/,
    /\bproject\.factions\s*=/, /\bproject\.activePovActorId\s*=/, /\bproject\.currentPosition\s*=/,
  ]) {
    assert.ok(!forbidden.test(source), `StoryEditor.tsx must never assign directly into canonical project fields: ${forbidden}`);
  }
  assert.ok(
    !/\bimport\s*(\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*from\s+['"][^'"]*prepareBootstrap['"]/.test(source) || !/\bprepareBootstrap\b/.test(
      (source.match(/import\s*(\{[^}]*\})\s*from\s+['"][^'"]*prepareBootstrap['"]/) ?? ['', ''])[1],
    ),
    'StoryEditor.tsx must not import prepareBootstrap() itself -- only App.tsx may call it, via onApplyBootstrap',
  );
}

// ---------------------------------------------------------------------------
// Item 14: prepareBootstrap() itself independently rejects a stale source,
// even if a UI-level check somehow missed it. Pre-existing B1 behavior --
// confirmed here directly against the real function, not introduced by B3d.
// ---------------------------------------------------------------------------

function testPrepareBootstrapIndependentlyRejectsAStaleSourceRace() {
  const project = sourceOnlyProject();
  const manifest = buildBootstrapManifest(project, discoverBootstrap(project));
  const projectWithChangedSource: StoryProject = {
    ...project,
    sourceDocuments: (project.sourceDocuments ?? []).map((doc) => ({ ...doc, exactText: `${doc.exactText}\n\nSomething new.` })),
  };
  assert.throws(
    () => prepareBootstrap(projectWithChangedSource, manifest, { activePovActorId: null, currentLocationId: null }, Date.now()),
    /Stale Bootstrap Manifest/,
    'prepareBootstrap() must independently reject a manifest bound to source documents that no longer match the project',
  );
}

async function run() {
  await testIncompleteReviewNeverEnablesApply();
  await testStaleReviewNeverEnablesApply();
  await testCompleteFreshReviewEnablesApply();
  await testApplyInvokesCallbackExactlyOnceWithTheExactCurrentArtifact();
  await testSuccessfulApplyClearsSessionAndDisplaysReceipt();
  await testSuccessfulApplyRederivesReadinessFromResultingProjectNotAFlag();
  await testFailedApplyRetainsSessionAndSurfacesWorkbenchError();
  await testRepeatedApplyClicksWhileInFlightCannotDoubleInvoke();
  await testNoDirectCanonicalMutationPathOutsideTheCallback();
  testPrepareBootstrapIndependentlyRejectsAStaleSourceRace();
  console.log('B3d apply contract regression passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
