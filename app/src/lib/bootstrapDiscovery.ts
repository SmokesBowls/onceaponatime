import type { AuthorSourceDocument, StoryProject } from '../types';
import type {
  BootstrapDiscoveryConfidence,
  BootstrapDiscoveryEntry,
  BootstrapProposal,
  SourceEvidenceUnit,
} from './bootstrapManifest';
import { extractNovelEntityCandidates } from './codexEngine';

export type {
  BootstrapDiscoveryClassification,
  BootstrapDiscoveryConfidence,
} from './bootstrapManifest';

export interface EvidenceBackedBootstrapDiscoveryEntry extends BootstrapDiscoveryEntry {
  readonly discoveryConfidence: BootstrapDiscoveryConfidence;
}

export interface EvidenceBackedBootstrapDiscoveryPayload {
  readonly entries: readonly EvidenceBackedBootstrapDiscoveryEntry[];
}

type SupportedProposalKind =
  | 'actor_proposal'
  | 'object_proposal'
  | 'location_proposal'
  | 'faction_proposal';

interface DetectorObservation {
  readonly kind: SupportedProposalKind;
  readonly label: string;
  readonly evidence: SourceEvidenceUnit;
  readonly reasons: readonly string[];
}

interface AccumulatedCandidate {
  readonly kind: SupportedProposalKind;
  readonly workingLabel: string;
  readonly aliases: string[];
  readonly evidence: SourceEvidenceUnit[];
  readonly reasons: Set<string>;
  ambiguous: boolean;
}

const CAPITALIZED_STOPWORDS = new Set([
  'A',
  'An',
  'And',
  'As',
  'At',
  'But',
  'He',
  'Her',
  'His',
  'I',
  'In',
  'Is',
  'It',
  'Its',
  'My',
  'She',
  'The',
  'Their',
  'They',
  'This',
  'We',
  'You',
]);

const PERSON_ACTIONS = [
  'answered',
  'approached',
  'asked',
  'believed',
  'distrusted',
  'distrusts',
  'entered',
  'followed',
  'gazed',
  'glanced',
  'laughed',
  'left',
  'looked',
  'nodded',
  'paused',
  'perceived',
  'ran',
  'replied',
  'said',
  'smiled',
  'spoke',
  'stepped',
  'told',
  'turned',
  'walked',
  'waited',
  'whispered',
];

function trimSpan(text: string, start: number, end: number): [number, number] | null {
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return start === end ? null : [start, end];
}

/**
 * Splits one author source document into non-semantic paragraph blocks.
 * Offsets always refer to the unchanged AuthorSourceDocument.exactText.
 */
export function segmentSourceDocument(document: AuthorSourceDocument): readonly SourceEvidenceUnit[] {
  const text = document.exactText;
  const separators = /\r?\n[\t ]*\r?\n/g;
  const units: SourceEvidenceUnit[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  const append = (rawStart: number, rawEnd: number) => {
    const span = trimSpan(text, rawStart, rawEnd);
    if (!span) return;
    const [startOffset, endOffset] = span;
    units.push({
      sourceDocumentId: document.id,
      unitId: `source-unit:${encodeURIComponent(document.id)}:${startOffset}:${endOffset}`,
      startOffset,
      endOffset,
      exactText: text.slice(startOffset, endOffset),
    });
  };

  while ((match = separators.exec(text)) !== null) {
    append(cursor, match.index);
    cursor = match.index + match[0].length;
  }
  append(cursor, text.length);

  return units;
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/^(?:a|an|the)\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function candidateKey(kind: SupportedProposalKind, label: string): string {
  return `${kind}:${normalizeLabel(label)}`;
}

function codexTypeToSupportedKind(primaryType: string): SupportedProposalKind | null {
  switch (primaryType) {
    case 'actor': return 'actor_proposal';
    case 'object': return 'object_proposal';
    case 'location': return 'location_proposal';
    default: return null;
  }
}

function observeCodexCandidates(unit: SourceEvidenceUnit): DetectorObservation[] {
  return extractNovelEntityCandidates(unit.exactText, new Set())
    .map((candidate): DetectorObservation | null => {
      const kind = codexTypeToSupportedKind(candidate.primaryType);
      if (!kind) return null;
      return {
        kind,
        label: candidate.workingLabel,
        evidence: unit,
        reasons: [
          candidate.isProper ? 'proper_name_match' : 'noun_phrase_match',
          `${kind.replace('_proposal', '')}_context_match`,
        ],
      };
    })
    .filter((observation): observation is DetectorObservation => observation !== null);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function observeSingleTokenNames(unit: SourceEvidenceUnit): DetectorObservation[] {
  const observations: DetectorObservation[] = [];
  const tokenPattern = /\b[A-Z][a-z][A-Za-z0-9-]*\b/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(unit.exactText)) !== null) {
    const label = match[0];
    if (CAPITALIZED_STOPWORDS.has(label)) continue;

    const escaped = escapeRegExp(label);
    const actorPattern = new RegExp(`\\b${escaped}\\s+(?:${PERSON_ACTIONS.join('|')})\\b`, 'i');
    const namedPattern = new RegExp(`\\b(?:my name is|i am|call me|they call me)\\s+${escaped}\\b`, 'i');
    const locationPattern = new RegExp(`\\b(?:entered|reached|arrived at|departed from)\\s+${escaped}\\b`, 'i');

    if (actorPattern.test(unit.exactText) || namedPattern.test(unit.exactText)) {
      observations.push({
        kind: 'actor_proposal',
        label,
        evidence: unit,
        reasons: ['proper_name_match', 'person_context_match'],
      });
    } else if (locationPattern.test(unit.exactText)) {
      observations.push({
        kind: 'location_proposal',
        label,
        evidence: unit,
        reasons: ['proper_name_match', 'place_context_match'],
      });
    }
  }

  return observations;
}

function observeFactions(unit: SourceEvidenceUnit): DetectorObservation[] {
  const observations: DetectorObservation[] = [];
  const factionPattern = /\b(?:the\s+)?((?:Order|Guild|Council|Company|Legion|Clan|House)(?:\s+of\s+[A-Z][A-Za-z-]+|\s+[A-Z][A-Za-z-]+)*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = factionPattern.exec(unit.exactText)) !== null) {
    observations.push({
      kind: 'faction_proposal',
      label: match[1],
      evidence: unit,
      reasons: ['faction_name_match'],
    });
  }
  return observations;
}

function addObservation(
  candidates: Map<string, AccumulatedCandidate>,
  observation: DetectorObservation,
): void {
  const key = candidateKey(observation.kind, observation.label);
  let candidate = candidates.get(key);
  if (!candidate) {
    candidate = {
      kind: observation.kind,
      workingLabel: observation.label,
      aliases: [],
      evidence: [],
      reasons: new Set(),
      ambiguous: false,
    };
    candidates.set(key, candidate);
  }
  if (!candidate.evidence.some((unit) => unit.unitId === observation.evidence.unitId)) {
    candidate.evidence.push(observation.evidence);
  }
  for (const reason of observation.reasons) candidate.reasons.add(reason);
}

function mergeIdentityDisclosures(
  candidates: Map<string, AccumulatedCandidate>,
  units: readonly SourceEvidenceUnit[],
): void {
  const merge = (sourceLabel: string, revealedName: string) => {
    const sourceKey = candidateKey('actor_proposal', sourceLabel);
    const nameKey = candidateKey('actor_proposal', revealedName);
    const source = candidates.get(sourceKey);
    if (!source) return;

    const named = candidates.get(nameKey);
    if (named) {
      for (const evidence of named.evidence) {
        if (!source.evidence.some((unitEvidence) => unitEvidence.unitId === evidence.unitId)) {
          source.evidence.push(evidence);
        }
      }
      for (const reason of named.reasons) source.reasons.add(reason);
      candidates.delete(nameKey);
    }
    if (!source.aliases.some((alias) => alias.toLowerCase() === revealedName.toLowerCase())) {
      source.aliases.push(revealedName);
    }
    source.reasons.add('identity_disclosure_match');
  };

  const forwardPattern = /["“](?:my name is|i am|call me|they call me)\s+([A-Z][A-Za-z0-9-]*)[^"”]*["”]\s*(?:said|whispered|replied|murmured|answered)\s+(?:the|this)\s+([a-z][a-z -]*?)(?:[.!?,]|$)/gi;
  const reversePattern = /(?:the|this)\s+([a-z][a-z -]*?)\s+(?:smiled|spoke|paused|nodded|replied|whispered|answered)[.!?]\s*["“](?:my name is|i am|call me|they call me)\s+([A-Z][A-Za-z0-9-]*)/gi;

  for (const unit of units) {
    forwardPattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = forwardPattern.exec(unit.exactText)) !== null) {
      merge(match[2].trim(), match[1]);
    }

    reversePattern.lastIndex = 0;
    while ((match = reversePattern.exec(unit.exactText)) !== null) {
      merge(match[1].trim(), match[2]);
    }
  }
}

function preserveCrossKindAmbiguities(candidates: Map<string, AccumulatedCandidate>): void {
  const candidatesByLabel = new Map<string, AccumulatedCandidate[]>();
  for (const candidate of candidates.values()) {
    const label = normalizeLabel(candidate.workingLabel);
    const matching = candidatesByLabel.get(label) ?? [];
    matching.push(candidate);
    candidatesByLabel.set(label, matching);
  }

  for (const matching of candidatesByLabel.values()) {
    if (new Set(matching.map((candidate) => candidate.kind)).size <= 1) continue;

    // Keep the first evidence-backed proposal visible for review, but mark it
    // ambiguous and fold every conflicting observation into its evidence.
    // This is deterministic source order, not an assertion that its kind is true.
    const retained = matching[0];
    retained.ambiguous = true;
    retained.reasons.add('cross_kind_conflict');
    for (const conflicting of matching.slice(1)) {
      for (const evidence of conflicting.evidence) {
        if (!retained.evidence.some((unit) => unit.unitId === evidence.unitId)) {
          retained.evidence.push(evidence);
        }
      }
      for (const reason of conflicting.reasons) retained.reasons.add(reason);
      candidates.delete(candidateKey(conflicting.kind, conflicting.workingLabel));
    }
  }
}

function proposalFor(candidate: AccumulatedCandidate): BootstrapProposal {
  const id = `${candidate.kind.replace('_proposal', '')}_${normalizeLabel(candidate.workingLabel).replace(/\s+/g, '_')}`;
  const identity = {
    id,
    working_label: candidate.workingLabel,
    name: null,
    aliases: [...candidate.aliases],
  };
  switch (candidate.kind) {
    case 'actor_proposal': return { kind: candidate.kind, ...identity };
    case 'object_proposal': return { kind: candidate.kind, ...identity };
    case 'location_proposal': return { kind: candidate.kind, ...identity };
    case 'faction_proposal': return { kind: candidate.kind, ...identity };
  }
}

/**
 * Deterministically discovers review-only bootstrap entity proposals from all
 * author source documents. It neither calls inference nor mutates the project.
 */
export function discoverBootstrap(project: StoryProject): EvidenceBackedBootstrapDiscoveryPayload {
  const units = (project.sourceDocuments ?? []).flatMap((document) => segmentSourceDocument(document));
  const candidates = new Map<string, AccumulatedCandidate>();

  for (const unit of units) {
    for (const observation of observeCodexCandidates(unit)) addObservation(candidates, observation);
    for (const observation of observeSingleTokenNames(unit)) addObservation(candidates, observation);
    for (const observation of observeFactions(unit)) addObservation(candidates, observation);
  }
  mergeIdentityDisclosures(candidates, units);
  preserveCrossKindAmbiguities(candidates);

  return {
    entries: [...candidates.values()].map((candidate) => {
      const supportingUnitCount = candidate.evidence.length;
      const reasons = new Set(candidate.reasons);
      if (supportingUnitCount > 1) reasons.add('repeated_identity_reference');
      return {
        proposed: proposalFor(candidate),
        evidence: [...candidate.evidence],
        discoveryConfidence: {
          classification: candidate.ambiguous
            ? 'ambiguous'
            : supportingUnitCount > 1 ? 'corroborated' : 'provisional',
          supportingUnitCount,
          reasons: [...reasons].sort(),
        },
      };
    }),
  };
}
