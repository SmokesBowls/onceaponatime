import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AuthorSourceDocument, InferenceReceipt, StoryProject } from '../src/types';
import { createInferenceArtifact } from '../src/types';
import {
  buildBootstrapManifest,
  type BootstrapDiscoveryConfidence,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapManifestEntry,
  type BootstrapProposal,
  type SourceEvidenceUnit,
} from '../src/lib/bootstrapManifest';
import { selectBootstrapReviewSuggestion } from '../src/lib/bootstrapReview';
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
import { BootstrapReviewWorkspace } from '../src/components/BootstrapReviewWorkspace';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B4c3 RED gate -- UI presentation of AI suggestions in BootstrapReviewWorkspace
 * (RED gate items 10, 11, 15 in TODO.md's frozen B4c3 contract, fce0df9).
 * Pure decision/identity/authority logic (items 1-9, 12-14) lives in
 * bootstrapReviewSuggestionSelection.test.ts.
 *
 * Requires new surface frozen in the contract: BootstrapReviewWorkspace's new
 * required `onSelectSuggestion` prop and a compact per-suggestion
 * USE THIS SUGGESTION/SELECTED row, wired to selectBootstrapReviewSuggestion().
 * StructuralReviewPanel.tsx is untouched by this slice -- confirmed here, not
 * merely assumed.
 */

const WELL_CONFIDENCE: BootstrapDiscoveryConfidence = {
  classification: 'corroborated',
  supportingUnitCount: 1,
  reasons: ['strong_place_preposition'],
};

function sourceOnlyProject(): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4c3_workspace_selection',
    projectTitle: 'B4c3 Workspace Selection Fixture',
    sourceLabel: 'Chapter One',
    pastedText: 'Locke found Mara near the old well. Isla stood by the gate. Ulric watched from the ridge.',
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4c3_workspace_selection',
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

function pendingBaseline(): BootstrapManifest {
  const project = sourceOnlyProject();
  const doc = firstDoc(project);
  return buildBootstrapManifest(project, {
    entries: [
      discoveryEntry(locationProposal('location_well', 'the old well'), [evidenceFor(doc, 'u1', 'the old well')], WELL_CONFIDENCE),
      discoveryEntry(actorProposal('actor_mara', 'Mara'), [evidenceFor(doc, 'u2', 'Mara')]),
    ],
  });
}

function baselineDoc(baseline: BootstrapManifest): AuthorSourceDocument {
  return baseline.boundSourceDocuments[0];
}

function originalEntry(baseline: BootstrapManifest, proposedId: string): BootstrapManifestEntry {
  const entry = baseline.entries.find((e) => 'id' in e.proposed && e.proposed.id === proposedId);
  assert.ok(entry, `baseline fixture must contain a proposal with id ${proposedId}`);
  return entry;
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
  return createInferenceArtifact(payload, admittedReceipt());
}

/** A combined manifest with a target entry (the well) carrying two suggestions, neither yet selected. */
function combinedFixture(): { combined: BootstrapManifest; targetEntry: BootstrapManifestEntry; digestA: string; digestB: string } {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const wellOriginal = originalEntry(baseline, 'location_well');

  const suggestionA = buildCandidate('location_proposal', 'the ancient well', [evidenceCitationFor(doc, 'Isla')], wellOriginal.id);
  const suggestionB = buildCandidate('location_proposal', "the villagers' well", [evidenceCitationFor(doc, 'Locke')], wellOriginal.id);

  const combined = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [suggestionA, suggestionB]));
  const entryIdMap = combined.refinementMetadata!.entryIdMap;
  const targetEntry = combined.entries.find((e) => e.id === entryIdMap[wellOriginal.id])!;

  assert.equal(targetEntry.suggestedRefinements?.length, 2, 'fixture sanity: target entry must carry two suggestions');
  return { combined, targetEntry, digestA: suggestionA.candidateDigest, digestB: suggestionB.candidateDigest };
}

function noAssignments() {
  return { activePovActorId: null, currentLocationId: null };
}

function instanceText(instance: ReactTestInstance): string {
  return instance.children.map((child) => (typeof child === 'string' ? child : instanceText(child))).join('');
}

function renderWorkspace(
  manifest: BootstrapManifest,
  overrides: Partial<{
    onDecide: (entryId: string, decision: string, admitted?: BootstrapProposal) => void;
    onSelectSuggestion: (entryId: string, candidateDigest: string) => void;
  }> = {},
): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(React.createElement(BootstrapReviewWorkspace, {
      manifest,
      assignments: noAssignments(),
      isStale: false,
      isRefining: false,
      onDecide: overrides.onDecide ?? (() => {}),
      onSelectSuggestion: overrides.onSelectSuggestion ?? (() => {}),
      onAssignPovActor: () => {},
      onAssignCurrentLocation: () => {},
      onRegenerate: () => {},
      onClose: () => {},
    }));
  });
  return renderer;
}

function entryScope(renderer: ReactTestRenderer, entryId: string): ReactTestInstance {
  const [scope] = renderer.root.findAll((node) => node.props['data-bootstrap-entry-id'] === entryId);
  assert.ok(scope, `expected a rendered scope for entry ${entryId}`);
  return scope;
}

function suggestionRow(scope: ReactTestInstance, candidateDigest: string): ReactTestInstance {
  const [row] = scope.findAll((node) => node.props['data-suggestion-candidate-digest'] === candidateDigest);
  assert.ok(row, `expected a rendered suggestion row for digest ${candidateDigest}`);
  return row;
}

// ---------------------------------------------------------------------------
// 10. every sibling suggestion remains visible after one is selected; only
// the selected one carries the marker.
// ---------------------------------------------------------------------------

function testSiblingsStayVisibleAndOnlySelectedCarriesTheMarker() {
  const { combined, targetEntry, digestA, digestB } = combinedFixture();
  const selectedManifest = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA).manifest;

  const renderer = renderWorkspace(selectedManifest);
  const scope = entryScope(renderer, targetEntry.id);

  const rowA = suggestionRow(scope, digestA);
  const rowB = suggestionRow(scope, digestB);

  assert.equal(rowA.props['data-suggestion-selected'], 'true', "the selected suggestion's row must be marked");
  assert.ok(instanceText(rowA).includes('SELECTED'), "the selected suggestion's row must render a SELECTED marker");

  assert.notEqual(rowB.props['data-suggestion-selected'], 'true', 'every other sibling must not carry the selected marker');
  assert.ok(instanceText(rowB).includes('USE THIS SUGGESTION'), 'every unselected sibling must still offer USE THIS SUGGESTION');
  assert.ok(!instanceText(rowB).includes('SELECTED'), 'an unselected sibling must never render the SELECTED marker');

  act(() => { renderer.unmount(); });
}

// ---------------------------------------------------------------------------
// clicking USE THIS SUGGESTION calls onSelectSuggestion with the exact
// (entryId, candidateDigest) pair -- never a reconstructed proposal.
// ---------------------------------------------------------------------------

function testUseThisSuggestionButtonCallsOnSelectSuggestionWithEntryIdAndDigest() {
  const { combined, targetEntry, digestB } = combinedFixture();
  const calls: Array<{ entryId: string; candidateDigest: string }> = [];

  const renderer = renderWorkspace(combined, {
    onSelectSuggestion: (entryId, candidateDigest) => calls.push({ entryId, candidateDigest }),
  });
  const scope = entryScope(renderer, targetEntry.id);
  const rowB = suggestionRow(scope, digestB);
  const button = rowB.findAllByType('button').find((b) => instanceText(b).trim() === 'USE THIS SUGGESTION')!;
  assert.ok(button, 'expected a USE THIS SUGGESTION button on the unselected row');

  act(() => { button.props.onClick(); });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { entryId: targetEntry.id, candidateDigest: digestB });

  act(() => { renderer.unmount(); });
}

// ---------------------------------------------------------------------------
// 11. the marker is derived purely from manifest state -- no independent UI
// state. Clicking a sibling's button, with the manifest prop unchanged,
// must not itself move the marker; a fresh mount from the same manifest
// reproduces identical placement.
// ---------------------------------------------------------------------------

function testMarkerIsDerivedPurelyFromManifestStateNotLocalState() {
  const { combined, targetEntry, digestA, digestB } = combinedFixture();
  const selectedManifest = selectBootstrapReviewSuggestion(combined, noAssignments(), targetEntry.id, digestA).manifest;

  const renderer = renderWorkspace(selectedManifest, { onSelectSuggestion: () => {} });
  const scope = entryScope(renderer, targetEntry.id);
  const rowBButton = suggestionRow(scope, digestB).findAllByType('button').find((b) => instanceText(b).trim() === 'USE THIS SUGGESTION')!;

  // Click B's button. The test's onSelectSuggestion handler is a no-op that
  // never feeds an updated manifest back in -- if the component held any
  // independent selection state, B would now render as selected too.
  act(() => { rowBButton.props.onClick(); });

  const rowAAfter = suggestionRow(entryScope(renderer, targetEntry.id), digestA);
  const rowBAfter = suggestionRow(entryScope(renderer, targetEntry.id), digestB);
  assert.equal(rowAAfter.props['data-suggestion-selected'], 'true', 'the marker must remain exactly where the manifest says it is, unmoved by the click alone');
  assert.notEqual(rowBAfter.props['data-suggestion-selected'], 'true', 'clicking a sibling must never move the marker without a new manifest prop');

  act(() => { renderer.unmount(); });

  // Fresh mount (simulating close/reopen) from the identical manifest reproduces identical placement.
  const secondRenderer = renderWorkspace(selectedManifest);
  const rowAFresh = suggestionRow(entryScope(secondRenderer, targetEntry.id), digestA);
  const rowBFresh = suggestionRow(entryScope(secondRenderer, targetEntry.id), digestB);
  assert.equal(rowAFresh.props['data-suggestion-selected'], 'true');
  assert.notEqual(rowBFresh.props['data-suggestion-selected'], 'true');
  act(() => { secondRenderer.unmount(); });
}

// ---------------------------------------------------------------------------
// 15. static reachable-import-graph: StructuralReviewPanel.tsx never imports
// selectBootstrapReviewSuggestion and never receives a decision-authority
// prop -- the same "zero decision authority" proof B4c2 already established.
// ---------------------------------------------------------------------------

function testStructuralReviewPanelGainsNoAuthorityFromThisSlice() {
  const panelPath = new URL('../src/components/StructuralReviewPanel.tsx', import.meta.url).pathname;
  const panelSource = readFileSync(panelPath, 'utf8');
  assert.ok(
    !/selectBootstrapReviewSuggestion/.test(panelSource),
    'StructuralReviewPanel.tsx must never import or reference selectBootstrapReviewSuggestion',
  );
  assert.ok(
    !/onSelectSuggestion/.test(panelSource),
    'StructuralReviewPanel.tsx must never accept an onSelectSuggestion prop -- selection authority belongs solely to BootstrapReviewWorkspace.tsx',
  );
  assert.ok(!/onDecide/.test(panelSource), 'StructuralReviewPanel.tsx must still never reference onDecide -- reconfirmed, not weakened, by this slice');

  const workspacePath = new URL('../src/components/BootstrapReviewWorkspace.tsx', import.meta.url).pathname;
  const workspaceSource = readFileSync(workspacePath, 'utf8');
  assert.ok(/onSelectSuggestion/.test(workspaceSource), 'BootstrapReviewWorkspace.tsx must own the new onSelectSuggestion prop');
}

function run() {
  testSiblingsStayVisibleAndOnlySelectedCarriesTheMarker();
  testUseThisSuggestionButtonCallsOnSelectSuggestionWithEntryIdAndDigest();
  testMarkerIsDerivedPurelyFromManifestStateNotLocalState();
  testStructuralReviewPanelGainsNoAuthorityFromThisSlice();
  console.log('B4c3 workspace suggestion selection UI regression passed');
}

run();
