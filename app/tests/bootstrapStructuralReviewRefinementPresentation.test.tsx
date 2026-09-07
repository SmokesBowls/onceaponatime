import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { AuthorSourceDocument, InferenceReceipt, StoryProject } from '../src/types';
import { createInferenceArtifact } from '../src/types';
import {
  assessBootstrapReviewReadiness,
  isBootstrapReviewComplete,
} from '../src/lib/bootstrapReview';
import {
  buildBootstrapManifest,
  deepFreeze,
  type BootstrapDiscoveryConfidence,
  type BootstrapDiscoveryEntry,
  type BootstrapManifest,
  type BootstrapManifestEntry,
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
import { StructuralReviewPanel } from '../src/components/StructuralReviewPanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * B4c2 RED gate -- StructuralReviewPanel's projection of AI-origin entries
 * and suggestions. Frozen against TODO.md's B4c2 contract (85c4021).
 * StructuralReviewPanel is a pure, stateless function of (manifest, onClose)
 * -- tested directly, without StoryEditor/BootstrapReviewWorkspace, except
 * for the one decision-still-operates-correctly case (8), which necessarily
 * exercises the real decision path.
 */

const BASELINE_TEXT = 'Locke found Mara near the old well. Isla stood by the gate. Ulric watched from the ridge.';

const WELL_CONFIDENCE: BootstrapDiscoveryConfidence = {
  classification: 'corroborated',
  supportingUnitCount: 1,
  reasons: ['strong_place_preposition'],
};

function sourceOnlyProject(pastedText: string = BASELINE_TEXT): StoryProject {
  return createManuscriptIntakeProject({
    projectId: 'proj_b4c2_presentation',
    projectTitle: 'B4c2 Presentation Fixture',
    sourceLabel: 'Chapter One',
    pastedText,
    importedAt: 1_700_000_000_000,
    sourceDocumentId: 'source_b4c2_presentation',
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
  return createInferenceArtifact(deepFreeze(payload), admittedReceipt());
}

/** A combined manifest with one AI addition (Ulric) and one suggestion on Mara. */
function combinedManifestWithAdditionAndSuggestion(): {
  combined: BootstrapManifest;
  additionEntry: BootstrapManifestEntry;
  suggestionTargetEntry: BootstrapManifestEntry;
  unaffectedEntry: BootstrapManifestEntry;
} {
  const baseline = pendingBaseline();
  const doc = baselineDoc(baseline);
  const maraOriginal = originalEntry(baseline, 'actor_mara');
  const wellOriginal = originalEntry(baseline, 'location_well');

  const addition = buildCandidate('actor_proposal', 'Ulric', [evidenceCitationFor(doc, 'Ulric')], null);
  const suggestion = buildCandidate('actor_proposal', 'Mara the Wanderer', [evidenceCitationFor(doc, 'Isla')], maraOriginal.id);

  const combined = mergeBootstrapRefinementArtifact(baseline, buildArtifact(baseline, [addition, suggestion]));
  const entryIdMap = combined.refinementMetadata!.entryIdMap;
  const rebasedIds = new Set(Object.values(entryIdMap));

  const additionEntry = combined.entries.find((e) => !rebasedIds.has(e.id))!;
  const suggestionTargetEntry = combined.entries.find((e) => e.id === entryIdMap[maraOriginal.id])!;
  const unaffectedEntry = combined.entries.find((e) => e.id === entryIdMap[wellOriginal.id])!;

  return { combined, additionEntry, suggestionTargetEntry, unaffectedEntry };
}

function instanceText(instance: ReactTestInstance): string {
  return instance.children.map((child) => (typeof child === 'string' ? child : instanceText(child))).join('');
}

function renderPanel(manifest: BootstrapManifest): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(StructuralReviewPanel, { manifest, onClose: () => {} })); });
  return renderer;
}

function entryArticle(renderer: ReactTestRenderer, entryId: string): ReactTestInstance {
  const [article] = renderer.root.findAll((node) => node.props['data-bootstrap-entry-id'] === entryId);
  assert.ok(article, `expected a rendered article for entry ${entryId}`);
  return article;
}

// ---------------------------------------------------------------------------
// 1. AI-added entry is visibly, structurally distinguishable
// ---------------------------------------------------------------------------

function testAiAddedEntryIsStructurallyDistinguishable() {
  const { combined, additionEntry, unaffectedEntry } = combinedManifestWithAdditionAndSuggestion();
  const renderer = renderPanel(combined);

  const addedArticle = entryArticle(renderer, additionEntry.id);
  assert.equal(addedArticle.props['data-refinement-origin'], 'ai-added', 'an AI-added entry must carry a distinct, queryable origin marker');

  const b2Article = entryArticle(renderer, unaffectedEntry.id);
  assert.notEqual(b2Article.props['data-refinement-origin'], 'ai-added', 'a B2 entry must never carry the ai-added origin marker');
  act(() => { renderer.unmount(); });
}

// ---------------------------------------------------------------------------
// 2. AI-added entry never renders discoveryConfidence or a generic fallback
// ---------------------------------------------------------------------------

function testAiAddedEntryNeverRendersDiscoveryConfidenceOrGenericFallback() {
  const { combined, additionEntry } = combinedManifestWithAdditionAndSuggestion();
  assert.equal(additionEntry.discoveryConfidence, undefined, 'fixture sanity: an addition must have no discoveryConfidence');

  const renderer = renderPanel(combined);
  const addedArticle = entryArticle(renderer, additionEntry.id);
  const text = instanceText(addedArticle);

  assert.ok(!text.includes('Discovery rationale not supplied'), 'must never show the B2-shaped fallback for an AI-added entry');
  assert.ok(!/rationale/i.test(text) || text.includes('Refinement provenance'), 'no generic "confidence unavailable" wording -- only refinement provenance');
  assert.ok(
    text.includes(additionEntry.refinementProvenance!.candidateDigest),
    'the refinement provenance block (candidateDigest) must render for an AI-added entry',
  );
  act(() => { renderer.unmount(); });
}

// ---------------------------------------------------------------------------
// 3. an unrelated deterministic entry renders unchanged
// ---------------------------------------------------------------------------

function testUnrelatedDeterministicEntryRendersUnchanged() {
  const baseline = pendingBaseline();
  const wellOriginal = originalEntry(baseline, 'location_well');
  const bareRenderer = renderPanel(baseline);
  const bareText = instanceText(entryArticle(bareRenderer, wellOriginal.id));
  act(() => { bareRenderer.unmount(); });

  const { combined, unaffectedEntry } = combinedManifestWithAdditionAndSuggestion();
  const combinedRenderer = renderPanel(combined);
  const combinedText = instanceText(entryArticle(combinedRenderer, unaffectedEntry.id));
  act(() => { combinedRenderer.unmount(); });

  assert.equal(
    combinedText,
    bareText,
    "an entry with no suggestions and no AI origin must render byte-identically whether or not sibling entries carry refinement data",
  );
}

// ---------------------------------------------------------------------------
// 4. suggestedRefinements render nested under their exact target entry
// ---------------------------------------------------------------------------

function testSuggestionsRenderNestedUnderExactTargetEntry() {
  const { combined, suggestionTargetEntry, additionEntry, unaffectedEntry } = combinedManifestWithAdditionAndSuggestion();
  const renderer = renderPanel(combined);

  const targetArticle = entryArticle(renderer, suggestionTargetEntry.id);
  const suggestionsContainer = targetArticle.findAll((node) => node.props['data-suggested-refinements-for'] === suggestionTargetEntry.id);
  assert.equal(suggestionsContainer.length, 1, "the target entry's own article must contain its suggestions container");

  // Must not appear as a sibling top-level article, and must not appear under any other entry.
  const addedArticle = entryArticle(renderer, additionEntry.id);
  assert.equal(addedArticle.findAll((node) => node.props['data-suggested-refinements-for'] !== undefined).length, 0);
  const unaffectedArticle = entryArticle(renderer, unaffectedEntry.id);
  assert.equal(unaffectedArticle.findAll((node) => node.props['data-suggested-refinements-for'] !== undefined).length, 0);
  act(() => { renderer.unmount(); });
}

// ---------------------------------------------------------------------------
// 5. suggestion evidence renders separately from baseline evidence
// ---------------------------------------------------------------------------

function testSuggestionEvidenceRendersSeparatelyFromBaselineEvidence() {
  const { combined, suggestionTargetEntry } = combinedManifestWithAdditionAndSuggestion();
  const renderer = renderPanel(combined);
  const targetArticle = entryArticle(renderer, suggestionTargetEntry.id);

  const baselineEvidenceUnits = targetArticle.findAll((node) => node.props['data-source-unit-id'] !== undefined
    && node.props['data-suggestion-evidence-unit-id'] === undefined);
  const suggestionEvidenceUnits = targetArticle.findAll((node) => node.props['data-suggestion-evidence-unit-id'] !== undefined);

  assert.equal(baselineEvidenceUnits.length, suggestionTargetEntry.evidence.length, "the entry's own evidence block must still render unchanged");
  assert.equal(
    suggestionEvidenceUnits.length,
    suggestionTargetEntry.suggestedRefinements![0].evidence.length,
    'suggestion evidence must render in its own, separately-attributed block',
  );
  assert.notEqual(
    suggestionTargetEntry.evidence[0].unitId,
    suggestionTargetEntry.suggestedRefinements![0].evidence[0].unitId,
    'fixture sanity: baseline and suggestion evidence must cite different spans in this test',
  );
  act(() => { renderer.unmount(); });
}

// ---------------------------------------------------------------------------
// 6. suggestion provenance renders read-only
// ---------------------------------------------------------------------------

function testSuggestionProvenanceRendersReadOnly() {
  const { combined, suggestionTargetEntry } = combinedManifestWithAdditionAndSuggestion();
  const renderer = renderPanel(combined);
  const targetArticle = entryArticle(renderer, suggestionTargetEntry.id);
  const suggestionsContainer = targetArticle.findAll((node) => node.props['data-suggested-refinements-for'] === suggestionTargetEntry.id)[0];

  const text = instanceText(suggestionsContainer);
  assert.ok(text.includes(suggestionTargetEntry.suggestedRefinements![0].provenance.candidateDigest), 'candidateDigest must render');
  assert.equal(suggestionsContainer.findAllByType('button').length, 0, 'no interactive control may appear inside the suggestions block');
  assert.equal(suggestionsContainer.findAllByType('select').length, 0);
  assert.equal(suggestionsContainer.findAllByType('input').length, 0);
  act(() => { renderer.unmount(); });
}

// ---------------------------------------------------------------------------
// 7. no suggestion-rendering code path references a decision callback
// ---------------------------------------------------------------------------

function testStructuralReviewPanelNeverReferencesADecisionCallback() {
  const path = new URL('../src/components/StructuralReviewPanel.tsx', import.meta.url).pathname;
  assert.ok(existsSync(path));
  const source = readFileSync(path, 'utf8');
  assert.ok(!/onDecide/.test(source), 'StructuralReviewPanel.tsx must never reference onDecide -- it has no decision authority');
}

// ---------------------------------------------------------------------------
// 8. existing APPROVE still decides the real entry when suggestions are attached
// ---------------------------------------------------------------------------

async function testApproveStillDecidesTheRealEntryWhenSuggestionsAreAttached() {
  const { BootstrapReviewWorkspace } = await import('../src/components/BootstrapReviewWorkspace');
  const { combined, suggestionTargetEntry } = combinedManifestWithAdditionAndSuggestion();
  const decisions: Array<{ entryId: string; decision: string; admitted?: BootstrapProposal }> = [];

  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(BootstrapReviewWorkspace, {
      manifest: combined,
      assignments: { activePovActorId: null, currentLocationId: null },
      isStale: false,
      isRefining: false,
      onDecide: (entryId: string, decision: string, admitted?: BootstrapProposal) => decisions.push({ entryId, decision, admitted }),
      onSelectSuggestion: () => {},
      onAssignPovActor: () => {},
      onAssignCurrentLocation: () => {},
      onRegenerate: () => {},
      onClose: () => {},
    }));
  });

  const scope = renderer.root.findAll((node) => node.props['data-bootstrap-entry-id'] === suggestionTargetEntry.id)[0];
  const approveButton = scope.findAllByType('button').find((b) => instanceText(b).trim() === 'APPROVE')!;
  await act(async () => { approveButton.props.onClick(); });

  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].entryId, suggestionTargetEntry.id, 'APPROVE must decide the real entry, never a suggestion');
  assert.equal(decisions[0].decision, 'approved');
  assert.equal(decisions[0].admitted, undefined, 'APPROVE never supplies an admitted value -- SAVE EDIT is the only decision that does, and was not used here');
  await act(async () => { renderer.unmount(); });
}

// ---------------------------------------------------------------------------
// 9. zero-refinement manifest renders byte-identical to the pre-B4c2 baseline
// ---------------------------------------------------------------------------

function testZeroRefinementManifestRendersByteIdenticalOutput() {
  const baseline = pendingBaseline();
  const renderer = renderPanel(baseline);
  const text = instanceText(renderer.root);
  act(() => { renderer.unmount(); });

  assert.ok(!text.includes('ai-added'));
  assert.ok(!/AI suggestions/i.test(text));
  assert.ok(!/Refinement provenance/i.test(text));
}

// ---------------------------------------------------------------------------
// 10. readiness/completeness unchanged by the mere presence of refinement data
// ---------------------------------------------------------------------------

function testReadinessUnchangedByRefinementDataPresence() {
  const baseline = pendingBaseline();
  const { combined } = combinedManifestWithAdditionAndSuggestion();

  const assignments = { activePovActorId: null, currentLocationId: null };
  const baselineReadiness = assessBootstrapReviewReadiness(baseline, assignments);
  const combinedReadiness = assessBootstrapReviewReadiness(combined, assignments);

  // Both are "not complete" for the same reason (nothing decided yet) --
  // presence of refinementMetadata/suggestedRefinements must not itself
  // change the readiness verdict or its constituent booleans.
  assert.equal(baselineReadiness.complete, combinedReadiness.complete);
  assert.equal(baselineReadiness.allEntriesDecided, combinedReadiness.allEntriesDecided);
  assert.equal(isBootstrapReviewComplete(baseline, assignments), isBootstrapReviewComplete(combined, assignments));
}

// ---------------------------------------------------------------------------
// 11. projection-only: rendering never mutates the manifest or its entries
// ---------------------------------------------------------------------------

function testRenderingNeverMutatesTheManifest() {
  const { combined } = combinedManifestWithAdditionAndSuggestion();
  const before = JSON.stringify(combined);

  const renderer = renderPanel(combined);
  assert.equal(JSON.stringify(combined), before, 'mounting must not mutate the manifest');

  act(() => { renderer.update(React.createElement(StructuralReviewPanel, { manifest: combined, onClose: () => {} })); });
  assert.equal(JSON.stringify(combined), before, 're-rendering with an unchanged manifest must not mutate it');

  act(() => { renderer.unmount(); });
  assert.equal(JSON.stringify(combined), before, 'unmounting must not mutate the manifest');
  assert.equal(Object.isFrozen(combined), true, 'the manifest must remain the same frozen object throughout');
}

// ---------------------------------------------------------------------------
// 12. reachable-import-graph: no new reference to B4a/B4b orchestration
// ---------------------------------------------------------------------------

function testNoNewReachabilityIntoB4aOrB4bOrchestration() {
  const path = new URL('../src/components/StructuralReviewPanel.tsx', import.meta.url).pathname;
  const source = readFileSync(path, 'utf8');
  assert.ok(!/bootstrapRefinementMerge/.test(source), 'must not import the B4b merge module');
  assert.ok(!/mergeBootstrapRefinementArtifact/.test(source));
  assert.ok(!/refineBootstrapManifest/.test(source), 'must not reference B4a’s orchestrator');
}

async function run() {
  testAiAddedEntryIsStructurallyDistinguishable();
  testAiAddedEntryNeverRendersDiscoveryConfidenceOrGenericFallback();
  testUnrelatedDeterministicEntryRendersUnchanged();
  testSuggestionsRenderNestedUnderExactTargetEntry();
  testSuggestionEvidenceRendersSeparatelyFromBaselineEvidence();
  testSuggestionProvenanceRendersReadOnly();
  testStructuralReviewPanelNeverReferencesADecisionCallback();
  await testApproveStillDecidesTheRealEntryWhenSuggestionsAreAttached();
  testZeroRefinementManifestRendersByteIdenticalOutput();
  testReadinessUnchangedByRefinementDataPresence();
  testRenderingNeverMutatesTheManifest();
  testNoNewReachabilityIntoB4aOrB4bOrchestration();
  console.log('B4c2 structural review refinement presentation regression passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
