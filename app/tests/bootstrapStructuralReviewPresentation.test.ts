import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { DEFAULT_PROJECTS } from '../src/data/defaultProjects';
import { StoryEditor } from '../src/components/StoryEditor';
import { discoverBootstrap } from '../src/lib/bootstrapDiscovery';
import {
  assessCompositionReadiness,
  NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE,
} from '../src/lib/compositionReadiness';
import { createManuscriptIntakeProject } from '../src/lib/manuscriptIntake';
import {
  buildBootstrapManifest,
  validateBootstrapManifestStructure,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import type { StoryProject } from '../src/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOCK_DETAIL = 'Structural review must establish at least one actor and one location before generation can run.';
const CLASSIFICATIONS = ['ambiguous', 'provisional', 'corroborated'] as const;
const FIXTURE_REASONS = [
  'proper_name_match',
  'cross_kind_conflict',
  'location_verb_context',
  'faction_term_context',
] as const;

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

function sourceOnlyProject(): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b3b_structural_review',
    projectTitle: 'B3b Structural Review Fixture',
    sourceLabel: 'Chapter One',
    pastedText: 'Keen entered Ironspire.\n\nThe Guild watched.\n\nA brass key gleamed.',
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b3b_chapter_one',
  });
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
  };
}

function storyEditorMarkup(project: StoryProject): string {
  return renderToStaticMarkup(React.createElement(StoryEditor, storyEditorProps(project)));
}

function exactEvidence(
  project: StoryProject,
  unitId: string,
  exactText: string,
): SourceEvidenceUnit {
  const document = project.sourceDocuments?.[0];
  assert.ok(document, 'fixture requires one source document');
  const startOffset = document.exactText.indexOf(exactText);
  assert.notEqual(startOffset, -1, `fixture text must contain ${JSON.stringify(exactText)}`);
  return {
    sourceDocumentId: document.id,
    unitId,
    startOffset,
    endOffset: startOffset + exactText.length,
    exactText,
  };
}

function entityProposal(
  kind: 'actor_proposal' | 'object_proposal' | 'location_proposal' | 'faction_proposal',
  id: string,
  workingLabel: string,
): BootstrapProposal {
  return {
    kind,
    id,
    working_label: workingLabel,
    name: null,
    aliases: [],
  };
}

function presentationManifest(project: StoryProject): BootstrapManifest {
  const keen = exactEvidence(project, 'unit-keen', 'Keen entered Ironspire.');
  const guild = exactEvidence(project, 'unit-guild', 'The Guild watched.');
  const key = exactEvidence(project, 'unit-key', 'A brass key gleamed.');

  const entries: BootstrapDiscoveryEntry[] = [
    {
      proposed: entityProposal('actor_proposal', 'actor_keen', 'Keen'),
      evidence: [keen, structuredClone(keen)],
      discoveryConfidence: {
        classification: 'ambiguous',
        supportingUnitCount: 1,
        reasons: ['proper_name_match', 'cross_kind_conflict'],
      },
    },
    {
      proposed: entityProposal('location_proposal', 'location_ironspire', 'Ironspire'),
      evidence: [keen, structuredClone(keen), structuredClone(keen)],
      discoveryConfidence: {
        classification: 'provisional',
        supportingUnitCount: 1,
        reasons: ['location_verb_context'],
      },
    },
    {
      proposed: entityProposal('faction_proposal', 'faction_guild', 'The Guild'),
      evidence: [keen, guild, structuredClone(guild)],
      discoveryConfidence: {
        classification: 'corroborated',
        supportingUnitCount: 2,
        reasons: ['faction_term_context'],
      },
    },
    {
      proposed: entityProposal('object_proposal', 'object_brass_key', 'a brass key'),
      evidence: [key],
    },
  ];

  const manifest = buildBootstrapManifest(project, { entries });
  validateBootstrapManifestStructure(manifest);
  return manifest;
}

function entrySlice(markup: string, entryId: string, nextEntryId?: string): string {
  const marker = `data-bootstrap-entry-id="${entryId}"`;
  const start = markup.indexOf(marker);
  assert.notEqual(start, -1, `rendered review must identify manifest entry ${entryId}`);
  if (nextEntryId === undefined) return markup.slice(start);
  const end = markup.indexOf(`data-bootstrap-entry-id="${nextEntryId}"`, start + marker.length);
  assert.notEqual(end, -1, `rendered review must identify following manifest entry ${nextEntryId}`);
  return markup.slice(start, end);
}

function attributeValues(markup: string, attribute: string): string[] {
  const expression = new RegExp(`${attribute}="([^"]*)"`, 'g');
  return [...markup.matchAll(expression)].map((match) => match[1]);
}

function countOccurrences(value: string, search: string): number {
  if (search.length === 0) return 0;
  return value.split(search).length - 1;
}

function instanceText(instance: ReactTestInstance): string {
  return instance.children.map((child) => (
    typeof child === 'string' ? child : instanceText(child)
  )).join('');
}

function buttonWithLabel(renderer: ReactTestRenderer, label: string): ReactTestInstance {
  const button = renderer.root.findAllByType('button').find(
    (candidate) => instanceText(candidate).trim() === label,
  );
  assert.ok(button, `expected button labelled ${label}`);
  return button;
}

function assertNoAuthorityCallbacks(calls: CallbackCalls): void {
  assert.deepEqual(calls, callbackCalls(), 'review presentation must not invoke existing mutation/authority callbacks');
}

function reachablePresentationSources(entryFiles: readonly string[]): Map<string, string> {
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

// ---------------------------------------------------------------------------
// 1. The truthful lock panel owns the conditional B3b entry point.
// ---------------------------------------------------------------------------

function testLockedSourceProjectOffersStructuralReviewWithoutClaimingCompositionIsReady() {
  const project = sourceOnlyProject();
  assert.equal(assessCompositionReadiness(project).ready, false);

  const markup = storyEditorMarkup(project);
  assert.ok(markup.includes('Composition Pipeline Unavailable'), 'the existing truthful lock heading must remain');
  assert.ok(markup.includes(NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE), 'the existing readiness explanation must remain');
  assert.ok(markup.includes(LOCK_DETAIL), 'the existing structural-review detail must remain');
  assert.ok(markup.includes('BEGIN STRUCTURAL REVIEW'), 'a locked source project must expose the explicit review action');
  assert.ok(!markup.includes('Unlock Composition'), 'review must never be presented as unlocking composition');
}

function testReviewEntryPointRequiresSubstantiveSourceTextAndAnUnreadyProject() {
  const sourceOnly = sourceOnlyProject();
  const noSourceCases: StoryProject[] = [
    { ...sourceOnly, sourceDocuments: undefined },
    { ...sourceOnly, sourceDocuments: [] },
    {
      ...sourceOnly,
      sourceDocuments: sourceOnly.sourceDocuments?.map((document) => ({ ...document, exactText: '' })),
    },
    {
      ...sourceOnly,
      sourceDocuments: sourceOnly.sourceDocuments?.map((document) => ({ ...document, exactText: ' \n\t ' })),
    },
  ];
  for (const project of noSourceCases) {
    assert.equal(assessCompositionReadiness(project).ready, false);
    assert.ok(!storyEditorMarkup(project).includes('BEGIN STRUCTURAL REVIEW'));
  }

  const readyWithSource: StoryProject = {
    ...structuredClone(DEFAULT_PROJECTS[0]),
    sourceDocuments: structuredClone(sourceOnly.sourceDocuments),
  };
  assert.equal(assessCompositionReadiness(readyWithSource).ready, true);
  assert.ok(!storyEditorMarkup(readyWithSource).includes('BEGIN STRUCTURAL REVIEW'));
}

// ---------------------------------------------------------------------------
// 2 & 7–9. Drive the real StoryEditor BEGIN/CLOSE transitions.
// ---------------------------------------------------------------------------

async function testLiveStoryEditorOpensRetainsClosesAndReopensOnePureSnapshot() {
  const { StructuralReviewPanel } = await import('../src/components/StructuralReviewPanel');
  const project = sourceOnlyProject();
  const projectBefore = structuredClone(project);
  const readinessBefore = assessCompositionReadiness(project);
  const calls = callbackCalls();
  const props = storyEditorProps(project, calls);
  const expectedManifest = buildBootstrapManifest(project, discoverBootstrap(project));

  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StoryEditor, props));
  });

  const beginButton = buttonWithLabel(renderer!, 'BEGIN STRUCTURAL REVIEW');
  await act(async () => {
    await beginButton.props.onClick();
  });

  const firstPanels = renderer!.root.findAllByType(StructuralReviewPanel);
  assert.equal(firstPanels.length, 1, 'BEGIN must open exactly one read-only review surface');
  const firstSnapshot = firstPanels[0].props.manifest as BootstrapManifest;
  assert.deepEqual(
    firstSnapshot,
    expectedManifest,
    'the live action must expose the existing B2 → B3a manifest, not a parallel payload',
  );
  assert.ok(firstSnapshot.entries.every((entry) => entry.decision === 'pending'));
  assert.deepEqual(project, projectBefore, 'BEGIN must not mutate project or canonical state');
  assert.deepEqual(assessCompositionReadiness(project), readinessBefore, 'BEGIN must not change readiness');
  assertNoAuthorityCallbacks(calls);

  const openText = instanceText(renderer!.root);
  assert.ok(openText.includes('Composition Pipeline Unavailable'));
  assert.ok(openText.includes(NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE));
  assert.ok(openText.includes(LOCK_DETAIL));

  await act(async () => {
    renderer!.update(React.createElement(StoryEditor, props));
  });
  const retainedSnapshot = renderer!.root.findByType(StructuralReviewPanel).props.manifest;
  assert.equal(retainedSnapshot, firstSnapshot, 'ordinary rerenders must retain the one snapshot created by BEGIN');

  const firstMarkup = renderToStaticMarkup(React.createElement(StructuralReviewPanel, {
    manifest: firstSnapshot,
    onClose: () => undefined,
  }));
  const closeButton = buttonWithLabel(renderer!, 'CLOSE REVIEW');
  await act(async () => {
    await closeButton.props.onClick();
  });
  assert.equal(renderer!.root.findAllByType(StructuralReviewPanel).length, 0, 'CLOSE must remove the review surface');
  assert.ok(instanceText(renderer!.root).includes('Composition Pipeline Unavailable'));
  assertNoAuthorityCallbacks(calls);
  assert.deepEqual(project, projectBefore, 'CLOSE must not mutate project or canonical state');

  const reopenButton = buttonWithLabel(renderer!, 'BEGIN STRUCTURAL REVIEW');
  await act(async () => {
    await reopenButton.props.onClick();
  });
  const reopenedSnapshot = renderer!.root.findByType(StructuralReviewPanel).props.manifest as BootstrapManifest;
  assert.deepEqual(reopenedSnapshot, firstSnapshot, 'unchanged source must reopen the same manifest artifact');
  const reopenedMarkup = renderToStaticMarkup(React.createElement(StructuralReviewPanel, {
    manifest: reopenedSnapshot,
    onClose: () => undefined,
  }));
  assert.equal(reopenedMarkup, firstMarkup, 'unchanged source must reopen the same deterministic rendering');
  assert.deepEqual(project, projectBefore, 'reopening must not mutate project or canonical state');
  assert.deepEqual(assessCompositionReadiness(project), readinessBefore, 'reopening must leave readiness unchanged');
  assertNoAuthorityCallbacks(calls);

  await act(async () => {
    renderer!.unmount();
  });
}

// ---------------------------------------------------------------------------
// 3–6. Exact per-entry rendering of proposal, evidence, and rationale.
// ---------------------------------------------------------------------------

async function testReviewSurfaceRendersManifestExactlyWithoutReinterpretation() {
  const { StructuralReviewPanel } = await import('../src/components/StructuralReviewPanel');
  const project = sourceOnlyProject();
  const projectBefore = structuredClone(project);
  const manifest = presentationManifest(project);
  const render = () => renderToStaticMarkup(React.createElement(StructuralReviewPanel, {
    manifest,
    onClose: () => undefined,
  }));
  const firstMarkup = render();
  assert.equal(render(), firstMarkup, 'the same manifest must render deterministically');
  assert.ok(firstMarkup.includes('Read-Only Structural Review'));
  assert.ok(firstMarkup.includes('Composition Pipeline Unavailable'), 'review must retain the truthful composition lock');
  assert.deepEqual(attributeValues(firstMarkup, 'data-bootstrap-manifest-id'), [manifest.id]);

  const positions = manifest.entries.map((entry) => firstMarkup.indexOf(`data-bootstrap-entry-id="${entry.id}"`));
  assert.ok(positions.every((position) => position >= 0), 'every pending manifest entry must render');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'entries must render in manifest order');

  for (let index = 0; index < manifest.entries.length; index += 1) {
    const entry = manifest.entries[index];
    const next = manifest.entries[index + 1];
    const renderedEntry = entrySlice(firstMarkup, entry.id, next?.id);
    assert.ok(renderedEntry.includes(entry.kind), `proposal kind must render without reinterpretation: ${entry.kind}`);
    assert.ok('working_label' in entry.proposed);
    assert.ok(renderedEntry.includes(entry.proposed.working_label), 'working label must render exactly');

    assert.deepEqual(
      attributeValues(renderedEntry, 'data-source-document-id'),
      entry.evidence.map((evidence) => evidence.sourceDocumentId),
    );
    assert.deepEqual(
      attributeValues(renderedEntry, 'data-source-unit-id'),
      entry.evidence.map((evidence) => evidence.unitId),
      'multiple evidence records must remain separate and in manifest order',
    );
    assert.deepEqual(
      attributeValues(renderedEntry, 'data-start-offset'),
      entry.evidence.map((evidence) => String(evidence.startOffset)),
    );
    assert.deepEqual(
      attributeValues(renderedEntry, 'data-end-offset'),
      entry.evidence.map((evidence) => String(evidence.endOffset)),
    );

    for (const evidence of entry.evidence) {
      assert.equal(
        countOccurrences(renderedEntry, `Source document: ${evidence.sourceDocumentId}`),
        entry.evidence.filter((candidate) => candidate.sourceDocumentId === evidence.sourceDocumentId).length,
        'each evidence record must visibly retain source-document identity',
      );
      assert.equal(
        countOccurrences(renderedEntry, `Evidence unit: ${evidence.unitId}`),
        entry.evidence.filter((candidate) => candidate.unitId === evidence.unitId).length,
        'each evidence record must visibly retain source-unit identity',
      );
      assert.equal(
        countOccurrences(renderedEntry, `Span: [${evidence.startOffset}, ${evidence.endOffset})`),
        entry.evidence.filter((candidate) => (
          candidate.startOffset === evidence.startOffset && candidate.endOffset === evidence.endOffset
        )).length,
        'each evidence record must visibly retain its exact half-open source span',
      );
      assert.equal(
        countOccurrences(renderedEntry, evidence.exactText),
        entry.evidence.filter((candidate) => candidate.exactText === evidence.exactText).length,
        'the displayed evidence must be SourceEvidenceUnit.exactText for every separate record',
      );
    }

    if (entry.discoveryConfidence === undefined) {
      assert.deepEqual(attributeValues(renderedEntry, 'data-discovery-classification'), []);
      assert.deepEqual(attributeValues(renderedEntry, 'data-supporting-unit-count'), []);
      assert.deepEqual(attributeValues(renderedEntry, 'data-discovery-reason-id'), []);
      assert.ok(renderedEntry.includes('Discovery rationale not supplied'), 'missing rationale must be stated honestly');
      for (const classification of CLASSIFICATIONS) assert.ok(!renderedEntry.includes(classification));
      for (const reason of FIXTURE_REASONS) assert.ok(!renderedEntry.includes(reason));
      assert.ok(!renderedEntry.includes('Supporting units'));
      continue;
    }

    const confidence = entry.discoveryConfidence;
    assert.deepEqual(attributeValues(renderedEntry, 'data-discovery-classification'), [confidence.classification]);
    assert.deepEqual(attributeValues(renderedEntry, 'data-supporting-unit-count'), [String(confidence.supportingUnitCount)]);
    assert.deepEqual(attributeValues(renderedEntry, 'data-discovery-reason-id'), [...confidence.reasons]);
    assert.ok(renderedEntry.includes(`Discovery classification: ${confidence.classification}`));
    assert.ok(renderedEntry.includes(`Supporting units: ${confidence.supportingUnitCount}`));
    for (const reason of confidence.reasons) assert.ok(renderedEntry.includes(reason));
    for (const classification of CLASSIFICATIONS) {
      assert.equal(
        renderedEntry.includes(classification),
        classification === confidence.classification,
        'each classification must remain scoped to its own manifest entry',
      );
    }
    assert.notEqual(
      confidence.supportingUnitCount,
      entry.evidence.length,
      'fixture must detect React-side evidence.length recomputation for every confidence-bearing entry',
    );
  }

  assert.deepEqual(project, projectBefore, 'rendering review must not mutate the project');
  assert.deepEqual(manifest, presentationManifest(project), 'rendering review must not mutate the manifest');
}

// ---------------------------------------------------------------------------
// 8–9. Review controls remain presentation-only.
// ---------------------------------------------------------------------------

async function testReviewSurfaceExposesNoAuthorityControls() {
  const { StructuralReviewPanel } = await import('../src/components/StructuralReviewPanel');
  const manifest = presentationManifest(sourceOnlyProject());
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(StructuralReviewPanel, {
      manifest,
      onClose: () => undefined,
    }));
  });

  const interactive = renderer!.root.findAll((node) => (
    typeof node.type === 'string'
    && (['button', 'input', 'select', 'textarea', 'a'].includes(node.type) || node.props.role === 'button')
  ));
  const labels = interactive.map((node) => (
    String(node.props['aria-label'] ?? node.props.title ?? instanceText(node)).trim()
  ));
  assert.ok(labels.includes('CLOSE REVIEW'), 'the read-only surface must expose Close');
  assert.ok(labels.every((label) => label.length > 0), 'every interactive review control must have an author-visible label');
  for (const label of labels) {
    assert.ok(
      !/\b(?:APPROVE|EDIT|REJECT|ASSIGN|POV|CURRENT LOCATION|APPLY|COMMIT|ADMIT)\b/i.test(label),
      `B3b must not expose authority control ${JSON.stringify(label)}`,
    );
  }

  const markup = renderToStaticMarkup(React.createElement(StructuralReviewPanel, {
    manifest,
    onClose: () => undefined,
  }));
  assert.ok(!/\b(?:APPROVED|EDITED|REJECTED|ADMITTED)\b/i.test(markup));
  assert.ok(markup.includes('review assistance'));

  const reachableSources = reachablePresentationSources([
    new URL('../src/components/StoryEditor.tsx', import.meta.url).pathname,
    new URL('../src/components/StructuralReviewPanel.tsx', import.meta.url).pathname,
  ]);
  for (const [file, source] of reachableSources) {
    assert.ok(
      !/from\s+['"][^'"]*prepareBootstrap['"]|import\s*\(\s*['"][^'"]*prepareBootstrap['"]\s*\)/.test(source),
      `B3b's reachable presentation graph must not import prepareBootstrap(): ${file}`,
    );
    for (const importStatement of source.matchAll(/import[\s\S]*?from\s+['"][^'"]+['"];?/g)) {
      assert.ok(
        !/\bdecideBootstrapManifestEntry\b/.test(importStatement[0]),
        `B3b's reachable presentation graph must not import decision authority: ${file}`,
      );
    }
  }

  await act(async () => {
    renderer!.unmount();
  });
}

async function run() {
  testLockedSourceProjectOffersStructuralReviewWithoutClaimingCompositionIsReady();
  testReviewEntryPointRequiresSubstantiveSourceTextAndAnUnreadyProject();
  await testLiveStoryEditorOpensRetainsClosesAndReopensOnePureSnapshot();
  await testReviewSurfaceRendersManifestExactlyWithoutReinterpretation();
  await testReviewSurfaceExposesNoAuthorityControls();
  console.log('B3b read-only Structural Review presentation contract regression passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
