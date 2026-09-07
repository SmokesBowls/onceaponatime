import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import React from 'react';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { StoryEditor } from '../src/components/StoryEditor';
import {
  type BootstrapAssignments,
  type BootstrapManifest,
  type BootstrapProposal,
} from '../src/lib/bootstrapManifest';
import { admittedEntityCandidates } from '../src/lib/bootstrapReview';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import type { StoryProject } from '../src/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B3c UI/lifecycle RED gate -- RED gate items 1, 2, 17, 18 (control
 * visibility, rerender stability, close/reopen lifecycle) against the new
 * BootstrapReviewWorkspace component and StoryEditor's ownership of the
 * mutable review session. Items 3-16, 19-21 (pure decision/assignment/
 * readiness logic) are already frozen in bootstrapReviewDecisions.test.ts --
 * this file drives the UI that calls that logic, not the logic itself.
 *
 * StructuralReviewPanel.tsx is untouched here and stays read-only forever --
 * B3c wires decision authority through a *separate* new component instead.
 */

function sourceOnlyProject(overrides?: { text?: string; sourceDocumentId?: string }): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b3c_workspace',
    projectTitle: 'B3c Workspace Fixture',
    sourceLabel: 'Chapter One',
    pastedText: overrides?.text ?? 'Keen entered Ironspire.\n\nA locked chest sat in the corner.',
    importedAt: 1_700_000_000_000,
    sourceDocumentId: overrides?.sourceDocumentId ?? 'source_b3c_workspace',
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
  };
}

function storyEditorProps(project: StoryProject, calls = callbackCalls()): React.ComponentProps<typeof StoryEditor> {
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
    workbenchError: null,
    onApplyBootstrap: async () => { throw new Error('B3c fixture must never apply bootstrap'); },
    onRefineBootstrap: async () => { throw new Error('B3c fixture must never refine bootstrap'); },
  };
}

function instanceText(instance: ReactTestInstance): string {
  return instance.children.map((child) => (
    typeof child === 'string' ? child : instanceText(child)
  )).join('');
}

function findButtonsLabelled(renderer: ReactTestRenderer, label: string): ReactTestInstance[] {
  return renderer.root.findAllByType('button').filter(
    (candidate) => instanceText(candidate).trim() === label,
  );
}

function buttonWithLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const [button] = findButtonsLabelled(renderer, label);
  assert.ok(button, `expected a button labelled ${label}`);
  return button;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function reachableSources(entryFiles: readonly string[]): Map<string, string> {
  const pending = [...entryFiles];
  const sources = new Map<string, string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (sources.has(file) || !existsSync(file)) continue;
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

async function begin(renderer: ReactTestRenderer): Promise<void> {
  const beginButton = buttonWithLabel(renderer, 'BEGIN STRUCTURAL REVIEW');
  await act(async () => {
    await beginButton.props.onClick();
  });
}

// ---------------------------------------------------------------------------
// 1-2. Control visibility: supported gets APPROVE/EDIT/REJECT, unsupported
// gets REJECT only.
// ---------------------------------------------------------------------------

async function testSupportedEntryExposesApproveEditRejectUnsupportedExposesRejectOnly() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const project = sourceOnlyProject();
  const calls = callbackCalls();
  const props = storyEditorProps(project, calls);

  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, props));
  });
  await begin(renderer!);

  const workspace = renderer!.root.findByType(BootstrapReviewWorkspace);
  const manifest = workspace.props.manifest as BootstrapManifest;
  assert.ok(manifest.entries.length > 0, 'fixture requires at least one manifest entry');

  for (const entry of manifest.entries) {
    if (entry.decision !== 'pending') continue;
    // Element type is not prescribed -- only that each entry's own controls
    // are independently scoped and discoverable via this attribute, the same
    // one StructuralReviewPanel already uses for its own entries.
    const scope = renderer!.root.findAll(
      (node) => typeof node.type === 'string' && node.props['data-bootstrap-entry-id'] === entry.id,
    );
    assert.ok(scope.length > 0, `entry ${entry.id} must be independently identifiable via data-bootstrap-entry-id`);
    const root = scope[0];
    const labels = root.findAllByType('button').map((button) => instanceText(button).trim());

    if (entry.supportedForApplication) {
      assert.ok(labels.includes('APPROVE'), `supported entry ${entry.id} must expose APPROVE`);
      assert.ok(labels.includes('EDIT'), `supported entry ${entry.id} must expose EDIT`);
      assert.ok(labels.includes('REJECT'), `supported entry ${entry.id} must expose REJECT`);
    } else {
      assert.ok(labels.includes('REJECT'), `unsupported entry ${entry.id} must still expose REJECT`);
      assert.ok(!labels.includes('APPROVE'), `unsupported entry ${entry.id} must never expose APPROVE`);
      assert.ok(!labels.includes('EDIT'), `unsupported entry ${entry.id} must never expose EDIT`);
    }
  }

  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// Decided entries show correct resulting status; POV/location selectors
// only ever list admitted candidates of the correct kind.
// ---------------------------------------------------------------------------

async function testDecisionsUpdateStatusAndOnlyAdmittedCandidatesAreSelectable() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(project)));
  });
  await begin(renderer!);

  const initialManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  const actorEntry = initialManifest.entries.find((entry) => entry.kind === 'actor_proposal');
  const locationEntry = initialManifest.entries.find((entry) => entry.kind === 'location_proposal');
  assert.ok(actorEntry, 'fixture requires an actor entry');
  assert.ok(locationEntry, 'fixture requires a location entry');

  const approveButtons = renderer!.root.findAllByType('button').filter((b) => instanceText(b).trim() === 'APPROVE');
  assert.ok(approveButtons.length >= 2);
  await act(async () => { await approveButtons[0].props.onClick(); });
  await act(async () => { renderer!.update(React.createElement(StoryEditor, storyEditorProps(project))); });

  const afterOneApproval = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  const decidedCount = afterOneApproval.entries.filter((entry) => entry.decision !== 'pending').length;
  assert.equal(decidedCount, 1, 'exactly one entry must have transitioned out of pending');

  // Approve both actor and location so both become admitted candidates.
  for (const entry of afterOneApproval.entries) {
    if (entry.decision === 'pending' && entry.supportedForApplication) {
      const workspace = renderer!.root.findByType(BootstrapReviewWorkspace);
      const btn = workspace.findAllByType('button').find((b) => instanceText(b).trim() === 'APPROVE');
      if (btn) await act(async () => { await btn.props.onClick(); });
    }
  }

  const decidedManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  const povOptions = renderer!.root.findAllByProps({ 'data-role': 'pov-select' })[0]
    ?.findAllByType('option')
    .map((option) => option.props.value)
    .filter((value) => value !== '');
  const locationOptions = renderer!.root.findAllByProps({ 'data-role': 'current-location-select' })[0]
    ?.findAllByType('option')
    .map((option) => option.props.value)
    .filter((value) => value !== '');

  const expectedActorIds = admittedEntityCandidates(decidedManifest, 'actor_proposal').map((c) => c.id);
  const expectedLocationIds = admittedEntityCandidates(decidedManifest, 'location_proposal').map((c) => c.id);
  assert.deepEqual(new Set(povOptions), new Set(expectedActorIds), 'POV selector must list exactly the admitted actor candidates');
  assert.deepEqual(
    new Set(locationOptions),
    new Set(expectedLocationIds),
    'current-location selector must list exactly the admitted location candidates',
  );
  assert.ok(!povOptions?.some((id) => decidedManifest.entries.some((e) => e.kind === 'location_proposal' && 'id' in e.proposed && e.proposed.id === id)),
    'POV selector must never offer a location id');

  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// Editing an assigned entry invalidates the assignment; it is never silently
// remapped to the new admitted id, even though it "looks like the same
// person."
// ---------------------------------------------------------------------------

async function testEditingAnAssignedActorInvalidatesRatherThanRemapsTheAssignment() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, storyEditorProps(project)));
  });
  await begin(renderer!);

  let manifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  const actorEntry = manifest.entries.find((entry) => entry.kind === 'actor_proposal')!;
  const approveButton = renderer!.root.findAllByType('button').find((b) => instanceText(b).trim() === 'APPROVE')!;
  await act(async () => { await approveButton.props.onClick(); });

  const povSelect = renderer!.root.findAllByProps({ 'data-role': 'pov-select' })[0];
  await act(async () => {
    povSelect.props.onChange({ target: { value: actorEntry.proposed.kind === 'actor_proposal' ? actorEntry.proposed.id : '' } });
  });

  let assignments = renderer!.root.findByType(BootstrapReviewWorkspace).props.assignments as BootstrapAssignments;
  assert.equal(assignments.activePovActorId, (actorEntry.proposed as Extract<BootstrapProposal, { kind: 'actor_proposal' }>).id);

  const editButton = renderer!.root.findAllByType('button').find((b) => instanceText(b).trim() === 'EDIT')!;
  await act(async () => { await editButton.props.onClick(); });
  const labelInput = renderer!.root.findAllByProps({ 'data-role': 'edit-working-label' })[0];
  await act(async () => { labelInput.props.onChange({ target: { value: 'Keen, Renamed' } }); });
  const saveEditButton = renderer!.root.findAllByType('button').find((b) => instanceText(b).trim() === 'SAVE EDIT')!;
  await act(async () => { await saveEditButton.props.onClick(); });

  assignments = renderer!.root.findByType(BootstrapReviewWorkspace).props.assignments as BootstrapAssignments;
  manifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  const editedEntry = manifest.entries.find((entry) => entry.id === actorEntry.id)!;
  const newAdmittedId = (editedEntry.admitted as Extract<BootstrapProposal, { kind: 'actor_proposal' }>).id;

  assert.notEqual(
    assignments.activePovActorId,
    newAdmittedId,
    'editing must never silently remap the assignment to the new admitted id',
  );
  assert.notEqual(
    assignments.activePovActorId,
    (actorEntry.proposed as Extract<BootstrapProposal, { kind: 'actor_proposal' }>).id,
    'the stale pre-edit id must not be left in place as though still valid either',
  );

  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// 17-18. Session lifecycle: rerenders preserve it, CLOSE hides without
// discarding it, REOPEN restores it, and a source change stales it.
// ---------------------------------------------------------------------------

async function testOrdinaryRerenderPreservesTheInProgressSession() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const project = sourceOnlyProject();
  const props = storyEditorProps(project);
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, props)); });
  await begin(renderer!);

  const approveButton = renderer!.root.findAllByType('button').find((b) => instanceText(b).trim() === 'APPROVE')!;
  await act(async () => { await approveButton.props.onClick(); });
  const beforeRerender = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;

  await act(async () => { renderer!.update(React.createElement(StoryEditor, storyEditorProps(project))); });
  const afterRerender = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;

  assert.deepEqual(afterRerender, beforeRerender, 'an ordinary rerender must not rebuild the manifest or lose decisions');
  await act(async () => { renderer!.unmount(); });
}

async function testCloseHidesWithoutDiscardingAndReopenRestoresTheSameSession() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);

  const approveButton = renderer!.root.findAllByType('button').find((b) => instanceText(b).trim() === 'APPROVE')!;
  await act(async () => { await approveButton.props.onClick(); });
  const decidedManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;

  const closeButton = buttonWithLabel(renderer!, 'CLOSE REVIEW');
  await act(async () => { await closeButton.props.onClick(); });
  assert.equal(
    renderer!.root.findAllByType(BootstrapReviewWorkspace).length,
    0,
    'CLOSE must hide the workspace',
  );

  await begin(renderer!);
  const reopenedManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  assert.deepEqual(
    reopenedManifest,
    decidedManifest,
    'reopening must restore the same in-progress manifest, including the prior decision -- not a fresh pending one',
  );

  await act(async () => { renderer!.unmount(); });
}

async function testSourceChangeStalesTheSessionRatherThanReapplyingOldDecisions() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const originalProject = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  const calls = callbackCalls();
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(originalProject, calls))); });
  await begin(renderer!);

  const approveButton = renderer!.root.findAllByType('button').find((b) => instanceText(b).trim() === 'APPROVE')!;
  await act(async () => { await approveButton.props.onClick(); });
  const decidedManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  assert.ok(decidedManifest.entries.some((entry) => entry.decision !== 'pending'));

  const closeButton = buttonWithLabel(renderer!, 'CLOSE REVIEW');
  await act(async () => { await closeButton.props.onClick(); });

  const changedProject = sourceOnlyProject({
    text: 'Isla approached Falcon Ridge.\n\nA locked chest sat in the corner.',
    sourceDocumentId: 'source_b3c_workspace',
  });
  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, storyEditorProps(changedProject, calls)));
  });
  await begin(renderer!);

  const newManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  assert.notEqual(
    newManifest.boundSourceFingerprint,
    decidedManifest.boundSourceFingerprint,
    'a changed source must produce a differently-bound manifest',
  );
  assert.ok(
    newManifest.entries.every((entry) => entry.decision === 'pending'),
    'a stale session must never reapply old decisions onto new source evidence',
  );

  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// A source change while the workspace stays open (no CLOSE/REOPEN) must not
// let the review surface keep silently presenting decisions against evidence
// that has already changed underneath it. It must not discard the session
// (destroying author work) or silently regenerate it (transplanting old
// decisions onto new evidence) either -- only disable authority controls and
// require an explicit regenerate action.
// ---------------------------------------------------------------------------

async function testSourceChangeWhileOpenDisablesAuthorityUntilExplicitRegenerate() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const originalProject = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  const calls = callbackCalls();
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(originalProject, calls))); });
  await begin(renderer!);

  const approveButton = renderer!.root.findAllByType('button').find((b) => instanceText(b).trim() === 'APPROVE')!;
  await act(async () => { await approveButton.props.onClick(); });
  const decidedManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  assert.ok(decidedManifest.entries.some((entry) => entry.decision !== 'pending'));

  // The source changes while the workspace is still open -- no CLOSE, no
  // reopening BEGIN. An ordinary rerender is all that happens.
  const changedProject = sourceOnlyProject({
    text: 'Isla approached Falcon Ridge.\n\nA locked chest sat in the corner.',
    sourceDocumentId: 'source_b3c_workspace',
  });
  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, storyEditorProps(changedProject, calls)));
  });

  assert.equal(
    renderer!.root.findAllByType(BootstrapReviewWorkspace).length,
    1,
    'the workspace must stay mounted -- a source change must not silently discard the session',
  );
  const staleManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  assert.deepEqual(
    staleManifest,
    decidedManifest,
    'a source change must not silently regenerate the manifest either -- the old artifact stays visible until an explicit regenerate',
  );

  const fullText = instanceText(renderer!.root);
  assert.ok(
    fullText.includes('Source changed') || fullText.toLowerCase().includes('regenerate structural review'),
    'the stale state must be visibly announced to the author',
  );
  assert.ok(!fullText.includes('Ready to Apply'), 'a stale review must never claim to be ready to apply');

  for (const label of ['APPROVE', 'EDIT', 'REJECT']) {
    for (const button of renderer!.root.findAllByType('button').filter((b) => instanceText(b).trim() === label)) {
      assert.equal(button.props.disabled, true, `${label} must be disabled while the review is stale`);
    }
  }
  const povSelect = renderer!.root.findAllByProps({ 'data-role': 'pov-select' })[0];
  const locationSelect = renderer!.root.findAllByProps({ 'data-role': 'current-location-select' })[0];
  assert.equal(povSelect.props.disabled, true, 'POV assignment must be disabled while the review is stale');
  assert.equal(locationSelect.props.disabled, true, 'current-location assignment must be disabled while the review is stale');

  // Defense in depth: even a stray click somehow reaching the callback must
  // not mutate the stale session.
  const workspaceInstance = renderer!.root.findByType(BootstrapReviewWorkspace);
  await act(async () => { workspaceInstance.props.onDecide(decidedManifest.entries[0].id, 'rejected'); });
  assert.deepEqual(
    renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest,
    decidedManifest,
    'onDecide must be a no-op while stale, not merely hidden behind a disabled button',
  );

  const regenerateButton = renderer!.root.findAllByType('button').find(
    (b) => /regenerate/i.test(instanceText(b)),
  );
  assert.ok(regenerateButton, 'a stale review must expose an explicit regenerate action');
  await act(async () => { await regenerateButton!.props.onClick(); });

  const regeneratedManifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  assert.notEqual(
    regeneratedManifest.boundSourceFingerprint,
    decidedManifest.boundSourceFingerprint,
    'regenerate must rebuild against the current (changed) source',
  );
  assert.ok(
    regeneratedManifest.entries.every((entry) => entry.decision === 'pending'),
    'regenerate must not transplant old decisions onto the new evidence artifact',
  );
  assert.ok(
    !instanceText(renderer!.root).includes('Source changed'),
    'after an explicit regenerate the stale notice must clear',
  );

  await act(async () => { renderer!.unmount(); });
}

// ---------------------------------------------------------------------------
// Review complete display; composition stays locked; prepareBootstrap never
// called anywhere reachable.
// ---------------------------------------------------------------------------

async function testReviewCompleteDisplaysReadyToApplyWhileCompositionStaysLocked() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const project = sourceOnlyProject();
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(StoryEditor, storyEditorProps(project))); });
  await begin(renderer!);

  let manifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  for (const entry of manifest.entries) {
    const btnLabel = entry.supportedForApplication ? 'APPROVE' : 'REJECT';
    const workspace = renderer!.root.findByType(BootstrapReviewWorkspace);
    const scoped = workspace.findAll((node) => node.props['data-bootstrap-entry-id'] === entry.id)[0] ?? workspace;
    const btn = scoped.findAllByType('button').find((b) => instanceText(b).trim() === btnLabel);
    if (btn) await act(async () => { await btn.props.onClick(); });
    manifest = renderer!.root.findByType(BootstrapReviewWorkspace).props.manifest as BootstrapManifest;
  }

  const actorId = admittedEntityCandidates(manifest, 'actor_proposal')[0]?.id;
  const locationId = admittedEntityCandidates(manifest, 'location_proposal')[0]?.id;
  assert.ok(actorId && locationId, 'fixture must admit at least one actor and one location');

  const povSelect = renderer!.root.findAllByProps({ 'data-role': 'pov-select' })[0];
  await act(async () => { povSelect.props.onChange({ target: { value: actorId } }); });
  const locationSelect = renderer!.root.findAllByProps({ 'data-role': 'current-location-select' })[0];
  await act(async () => { locationSelect.props.onChange({ target: { value: locationId } }); });

  const fullText = instanceText(renderer!.root);
  assert.ok(fullText.includes('Review Complete'));
  assert.ok(fullText.includes('Ready to Apply'));
  assert.ok(
    fullText.includes('Composition Pipeline Unavailable') || !fullText.includes('Composition Pipeline Unavailable') === false,
    'sanity: the locked-state text must still be present somewhere in the tree',
  );
  assert.equal(project.actors.length, 0, 'review complete must never itself mutate canonical project state');

  await act(async () => { renderer!.unmount(); });
}

async function testPrepareBootstrapIsNeverReachableFromB3cSources() {
  const sources = reachableSources([
    new URL('../src/components/StoryEditor.tsx', import.meta.url).pathname,
    new URL('../src/components/BootstrapReviewWorkspace.tsx', import.meta.url).pathname,
    new URL('../src/lib/bootstrapReview.ts', import.meta.url).pathname,
  ]);
  for (const [file, source] of sources) {
    // Importing OTHER exports from prepareBootstrap.ts (e.g.
    // resolveAdmittedBootstrapProposal, per the recorded origin finding) is
    // fine -- only the named import `prepareBootstrap` itself, and any call
    // to it, are forbidden. Checking the module-path string alone would
    // false-positive on that legitimate import.
    for (const importStatement of source.matchAll(/import\s*(\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*from\s+['"][^'"]+['"];?/g)) {
      assert.ok(
        !/\bprepareBootstrap\b/.test(importStatement[1]),
        `no B3c-reachable source may import prepareBootstrap(): ${file}`,
      );
    }
    // prepareBootstrap.ts's own declaration ("export function prepareBootstrap(...")
    // matches this same pattern -- it is expected to be reachable now (B3c
    // legitimately imports resolveAdmittedBootstrapProposal from the same
    // file) and defining itself is not the same thing as some other
    // B3c-reachable file calling it.
    if (file.endsWith('/prepareBootstrap.ts')) continue;
    assert.ok(
      !/\bprepareBootstrap\s*\(/.test(stripComments(source)),
      `no B3c-reachable source may call prepareBootstrap(): ${file}`,
    );
  }
}

async function run() {
  await testSupportedEntryExposesApproveEditRejectUnsupportedExposesRejectOnly();
  await testDecisionsUpdateStatusAndOnlyAdmittedCandidatesAreSelectable();
  await testEditingAnAssignedActorInvalidatesRatherThanRemapsTheAssignment();
  await testOrdinaryRerenderPreservesTheInProgressSession();
  await testCloseHidesWithoutDiscardingAndReopenRestoresTheSameSession();
  await testSourceChangeStalesTheSessionRatherThanReapplyingOldDecisions();
  await testSourceChangeWhileOpenDisablesAuthorityUntilExplicitRegenerate();
  await testReviewCompleteDisplaysReadyToApplyWhileCompositionStaysLocked();
  await testPrepareBootstrapIsNeverReachableFromB3cSources();
  console.log('B3c review workspace UI/lifecycle contract regression passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
