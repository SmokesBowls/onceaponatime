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
  'After',
  'Although',
  'An',
  'And',
  'As',
  'At',
  'Because',
  'Before',
  'But',
  'By',
  'During',
  'Everything',
  'He',
  'Her',
  'His',
  'I',
  'If',
  'In',
  'Is',
  'It',
  'Its',
  'My',
  'She',
  'Since',
  'The',
  'Their',
  'They',
  'This',
  'Though',
  'We',
  'When',
  'While',
  'Without',
  'You',
]);

/**
 * Titles/ranks that may prefix a proper name without themselves being part of
 * the entity's working identity ("Captain Ulric" -> "Ulric").
 */
const TITLE_WORDS = new Set([
  'Captain',
  'Colonel',
  'Doctor',
  'Duchess',
  'Duke',
  'General',
  'King',
  'Lady',
  'Lord',
  'Master',
  'Princess',
  'Prince',
  'Professor',
  'Queen',
  'Sergeant',
  'Sir',
]);

const DETERMINER_WORDS = new Set(['a', 'an', 'the', 'this', 'that']);

/**
 * A small, closed class of prepositions that govern a spatial complement --
 * "at Falcon Ridge", "in the city", "to Ironspire". Distinct in kind from the
 * old PERSON_ACTIONS/verb-adjacency approach: prepositions are a genuinely
 * closed part-of-speech class, and this list is only ever consulted against
 * the token immediately governing one specific candidate occurrence, never
 * against sentence-wide presence.
 */
const SPATIAL_PREPOSITIONS = new Set([
  'above',
  'across',
  'around',
  'at',
  'beneath',
  'beside',
  'between',
  'beyond',
  'from',
  'in',
  'into',
  'near',
  'on',
  'onto',
  'over',
  'through',
  'to',
  'toward',
  'towards',
  'under',
  'within',
]);

/**
 * Prepositions (spatial ones included) whose object is not eligible to also
 * be read as a clausal subject -- used only to disqualify a candidate from
 * the agentive-subject check, never to promote anything by itself.
 */
const FUNCTION_PREPOSITIONS = new Set([
  ...SPATIAL_PREPOSITIONS,
  'about',
  'against',
  'by',
  'despite',
  'for',
  'of',
  'with',
  'without',
]);

/** Verbs whose direct object is the place being moved to/through/accessed. */
const PLACE_GOVERNING_VERBS = new Set([
  'accessed',
  'accessing',
  'approached',
  'departed',
  'entered',
  'explore',
  'explored',
  'exploring',
  'left',
  'reached',
  'visit',
  'visited',
  'visiting',
]);

/** Verbs of physical/spatial existence -- their subject is a place, not an agent. */
const STATIVE_PLACE_VERBS = new Set([
  'lay',
  'lie',
  'lies',
  'loom',
  'loomed',
  'looms',
  'rise',
  'rises',
  'rose',
  'span',
  'spanned',
  'spans',
  'sprawl',
  'sprawled',
  'sprawls',
  'stand',
  'stands',
  'stood',
  'stretch',
  'stretched',
  'stretches',
  'tower',
  'towered',
  'towers',
]);

/**
 * Verbs of speech, perception, cognition, and emotional reaction -- their
 * subject is unambiguously an animate agent/speaker/perceiver/experiencer;
 * an inanimate/place subject cannot take them. Consulted only against the
 * verb directly governing one specific candidate as its clausal subject
 * (see isAgentiveSubject), never against sentence-wide presence -- that
 * positional constraint, not the list's size, is what distinguishes this
 * from the admission bug being fixed.
 */
const STRONG_AGENTIVE_VERBS = new Set([
  'answered',
  'asked',
  'believed',
  'breathed',
  'detected',
  'distrusted',
  'distrusts',
  'followed',
  'gasped',
  'gazed',
  'glanced',
  'knew',
  'laughed',
  'listened',
  'looked',
  'murmured',
  'nodded',
  'offered',
  'perceived',
  'recognized',
  'replied',
  'responded',
  'said',
  'sensed',
  'sighed',
  'smiled',
  'spoke',
  'told',
  'thought',
  'watched',
  'whispered',
  'wondered',
]);

/**
 * Verbs of generic stance/continuation/motion that are grammatically fine
 * with an animate subject ("Keen remained silent") but equally fine with an
 * inanimate or place subject in descriptive prose ("the silence remained",
 * "the road entered the valley"). A candidate confirmed as actor solely
 * through one of these, with no corroborating strong-tier evidence anywhere
 * else for the same label, is flagged ambiguous rather than asserted with
 * unwarranted confidence -- see hasStrongActorEvidence bookkeeping below.
 */
const AMBIGUOUS_AGENTIVE_VERBS = new Set([
  'approached',
  'continued',
  'entered',
  'left',
  'paused',
  'ran',
  'remained',
  'stayed',
  'stepped',
  'turned',
  'waited',
  'walked',
]);

/** Verbs of possession/carrying/manufacture -- their direct object is a concrete thing. */
const POSSESSION_VERBS = new Set([
  'built',
  'carried',
  'carrying',
  'clasped',
  'grasped',
  'held',
  'owned',
  'picked',
  'possessed',
  'used',
  'wielded',
  'wore',
]);

/** Head nouns that make a common-noun phrase person-like (semantic precondition for actor_proposal). */
const PERSON_HEAD_NOUNS = new Set([
  'archivist',
  'boy',
  'captive',
  'child',
  'curator',
  'elder',
  'figure',
  'girl',
  'guard',
  'hermit',
  'investigator',
  'king',
  'knight',
  'lady',
  'locksmith',
  'lord',
  'man',
  'master',
  'monk',
  'peddler',
  'pilgrim',
  'priest',
  'priestess',
  'prince',
  'princess',
  'queen',
  'sage',
  'scholar',
  'scribe',
  'sentry',
  'sorcerer',
  'sorceress',
  'stranger',
  'traveler',
  'wanderer',
  'woman',
]);

/** Head nouns that make a common-noun phrase place-like (semantic precondition for location_proposal). */
const PLACE_HEAD_NOUNS = new Set([
  'basin',
  'canyon',
  'chamber',
  'city',
  'conduit',
  'courtyard',
  'crossroads',
  'dock',
  'dungeon',
  'forest',
  'garden',
  'glade',
  'hall',
  'harbor',
  'mount',
  'mountain',
  'pass',
  'plateau',
  'room',
  'street',
  'valley',
]);

/** Head nouns that make a common-noun phrase a concrete thing (semantic precondition for object_proposal). */
const OBJECT_HEAD_NOUNS = new Set([
  'amulet',
  'artifact',
  'astrolabe',
  'blade',
  'book',
  'box',
  'chalice',
  'chest',
  'coin',
  'compass',
  'crystal',
  'dagger',
  'device',
  'flask',
  'gem',
  'goblet',
  'journal',
  'key',
  'lantern',
  'ledger',
  'locket',
  'map',
  'mechanism',
  'mirror',
  'parchment',
  'pendant',
  'pouch',
  'relic',
  'ring',
  'scroll',
  'seal',
  'staff',
  'sword',
  'talisman',
  'vial',
  'wand',
]);

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

/**
 * Splits evidence-unit text into sentence-scale spans. Deliberately local to
 * B2 (not shared with codexEngine.ts) -- this is only ever used to bound the
 * local clause context around one candidate occurrence.
 */
function splitIntoSentences(text: string): readonly string[] {
  return text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length > 0);
}

function lastWords(text: string, count: number): string[] {
  const cleaned = text
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '').toLowerCase())
    .filter((token) => token.length > 0);
  return cleaned.slice(-count);
}

/**
 * Text preceding a candidate, truncated to what remains after the nearest
 * comma. A comma ends the enclosing clause, so a preposition/verb on the far
 * side of one does not govern a candidate on this side of it -- without this,
 * "Isla, watched by Ulric, breathed" could let "watched" reach past Ulric's
 * own appositive comma into evaluating an unrelated later clause.
 */
function clauseTail(text: string): string {
  const lastComma = text.lastIndexOf(',');
  return lastComma === -1 ? text : text.slice(lastComma + 1);
}

function firstWordAfter(text: string): string | null {
  const match = text.match(/^\s*([A-Za-z']+)/);
  return match ? match[1].toLowerCase() : null;
}

function lastTwoClauseWords(sentence: string, start: number): { last?: string; secondLast?: string } {
  const words = lastWords(clauseTail(sentence.slice(0, start)), 2);
  return { last: words[words.length - 1], secondLast: words[words.length - 2] };
}

/** True when the candidate at [0, start) of `sentence` is governed by a spatial preposition. */
function isSpatiallyGoverned(sentence: string, start: number): boolean {
  const { last, secondLast } = lastTwoClauseWords(sentence, start);
  if (last !== undefined && SPATIAL_PREPOSITIONS.has(last)) return true;
  return (
    last !== undefined &&
    DETERMINER_WORDS.has(last) &&
    secondLast !== undefined &&
    SPATIAL_PREPOSITIONS.has(secondLast)
  );
}

/** True when the candidate at [0, start) of `sentence` is the direct object of a place-governing verb. */
function isPlaceVerbGoverned(sentence: string, start: number): boolean {
  const { last, secondLast } = lastTwoClauseWords(sentence, start);
  if (last !== undefined && PLACE_GOVERNING_VERBS.has(last)) return true;
  return (
    last !== undefined &&
    DETERMINER_WORDS.has(last) &&
    secondLast !== undefined &&
    PLACE_GOVERNING_VERBS.has(secondLast)
  );
}

/** True when the word immediately after end` in `sentence` is a stative-place verb. */
function isStativePlaceFollowing(sentence: string, end: number): boolean {
  const word = firstWordAfter(sentence.slice(end));
  return word !== null && STATIVE_PLACE_VERBS.has(word);
}

/** True when the candidate at [0, start) of `sentence` is the direct object of a possession verb. */
function isPossessionObject(sentence: string, start: number): boolean {
  const { last, secondLast } = lastTwoClauseWords(sentence, start);
  if (last !== undefined && POSSESSION_VERBS.has(last)) return true;
  return (
    last !== undefined &&
    DETERMINER_WORDS.has(last) &&
    secondLast !== undefined &&
    POSSESSION_VERBS.has(secondLast)
  );
}

/**
 * True when the candidate at [0, start) of `sentence` is itself the object of
 * a preposition ("watched by Ulric") -- meaning it is not eligible to also be
 * evaluated as a clausal subject. Without this guard, a name embedded inside
 * another candidate's appositive could be mistaken for the subject of a verb
 * appearing later in that same appositive.
 */
function isObjectOfPreposition(sentence: string, start: number): boolean {
  const { last, secondLast } = lastTwoClauseWords(sentence, start);
  if (last !== undefined && FUNCTION_PREPOSITIONS.has(last)) return true;
  return (
    last !== undefined &&
    DETERMINER_WORDS.has(last) &&
    secondLast !== undefined &&
    FUNCTION_PREPOSITIONS.has(secondLast)
  );
}

/**
 * Whether the candidate ending at `end` in `sentence` occupies clausal
 * subject position and, if so, how strongly its governing verb entails an
 * animate subject: 'strong' when the verb (breathe, whisper, believe, ...)
 * has no plausible inanimate reading; 'ambiguous' when the verb (remained,
 * entered, continued, ...) is equally grammatical with a place/inanimate
 * subject in descriptive prose, so promotion should be flagged rather than
 * asserted with confidence when nothing else corroborates it. Checked either
 * directly adjacent ("Isla breathed") or across exactly one comma-bounded
 * appositive/participial modifier ("Captain Ulric, riding alongside their
 * group, responded"). This -- not the size of the verb lists -- is the
 * structural fix: the verb must actually govern this candidate as subject,
 * not merely appear somewhere in the same sentence.
 */
function agentiveSubjectStrength(sentence: string, end: number): 'strong' | 'ambiguous' | null {
  let rest = sentence.slice(end).replace(/^\s*/, '');
  if (rest.startsWith(',')) {
    const afterFirstComma = rest.slice(1);
    const secondCommaIndex = afterFirstComma.indexOf(',');
    if (secondCommaIndex === -1) return null;
    rest = afterFirstComma.slice(secondCommaIndex + 1);
  }
  const word = firstWordAfter(rest);
  if (word === null) return null;
  if (STRONG_AGENTIVE_VERBS.has(word)) return 'strong';
  if (AMBIGUOUS_AGENTIVE_VERBS.has(word)) return 'ambiguous';
  return null;
}

/**
 * Finds maximal runs of consecutive capitalized tokens in `sentence` (proper
 * names, including multi-word names like "Falcon Ridge"), stripping a
 * leading title/rank ("Captain Ulric" -> "Ulric") so the same person is
 * addressed by one bare identity regardless of how a given mention titles
 * them.
 */
function properNounRuns(sentence: string): Array<{ start: number; end: number; label: string }> {
  const runs: Array<{ start: number; end: number; label: string }> = [];
  const tokenPattern = /\b[A-Z][a-z][A-Za-z0-9-]*\b/g;
  let current: { start: number; end: number; words: string[] } | null = null;
  let match: RegExpExecArray | null;

  const flush = () => {
    if (!current) return;
    let words = current.words;
    if (words.length >= 2 && TITLE_WORDS.has(words[0])) words = words.slice(1);
    if (words.length > 0) runs.push({ start: current.start, end: current.end, label: words.join(' ') });
    current = null;
  };

  while ((match = tokenPattern.exec(sentence)) !== null) {
    const word = match[0];
    if (CAPITALIZED_STOPWORDS.has(word)) {
      flush();
      continue;
    }
    const start = match.index;
    const end = start + word.length;
    if (current && sentence.slice(current.end, start).trim() === '') {
      current.words.push(word);
      current.end = end;
    } else {
      flush();
      current = { start, end, words: [word] };
    }
  }
  flush();
  return runs;
}

/**
 * Role-aware admission for proper-name candidates. Location is checked
 * before actor: a candidate governed by a spatial relation ("at Falcon
 * Ridge") or subject of a stative-place verb ("Ironspire stands") is a
 * place, regardless of an unrelated Codex lexical collision (e.g. "falcon"
 * matching a creature word-list) that would otherwise silently veto it.
 */
function observeProperNounRoles(unit: SourceEvidenceUnit): DetectorObservation[] {
  const observations: DetectorObservation[] = [];

  for (const sentence of splitIntoSentences(unit.exactText)) {
    for (const run of properNounRuns(sentence)) {
      if (isSpatiallyGoverned(sentence, run.start)) {
        observations.push({
          kind: 'location_proposal',
          label: run.label,
          evidence: unit,
          reasons: ['proper_name_match', 'spatial_preposition_governs'],
        });
        continue;
      }
      if (isPlaceVerbGoverned(sentence, run.start)) {
        observations.push({
          kind: 'location_proposal',
          label: run.label,
          evidence: unit,
          reasons: ['proper_name_match', 'place_governing_verb_object'],
        });
        continue;
      }
      if (isStativePlaceFollowing(sentence, run.end)) {
        observations.push({
          kind: 'location_proposal',
          label: run.label,
          evidence: unit,
          reasons: ['proper_name_match', 'stative_place_predicate'],
        });
        continue;
      }
      if (isObjectOfPreposition(sentence, run.start)) {
        // This occurrence is itself the object of a preposition (e.g. "watched
        // by Ulric") -- it is not a candidate clausal subject here, regardless
        // of what verb happens to follow later in the same appositive.
        continue;
      }
      const subjectStrength = agentiveSubjectStrength(sentence, run.end);
      if (subjectStrength === 'strong') {
        observations.push({
          kind: 'actor_proposal',
          label: run.label,
          evidence: unit,
          reasons: ['proper_name_match', 'agentive_subject_verb'],
        });
      } else if (subjectStrength === 'ambiguous') {
        observations.push({
          kind: 'actor_proposal',
          label: run.label,
          evidence: unit,
          reasons: ['proper_name_match', 'ambiguous_agentive_verb'],
        });
      }
      // Otherwise: no defensible role evidence for this occurrence -- leave unpromoted
      // rather than coercing it into a supported kind.
    }
  }

  return observations;
}

/**
 * Role-aware admission for common-noun candidates. Codex's
 * extractNovelEntityCandidates() is reused only to locate noun-phrase
 * boundaries and their head noun -- its own primaryType/classification is
 * discarded entirely. Promotion requires both a semantic precondition (the
 * head noun is plausibly person/place/thing-shaped) and positional evidence
 * that the candidate actually fills the corresponding role in its clause.
 *
 * Called once per sentence, not once over the whole unit: extractNovelEntityCandidates()
 * dedupes candidates against a `foundLabels` set scoped to the whole string
 * it is given, so a phrase whose *first* mention doesn't confirm a role would
 * otherwise silently suppress Codex from ever reporting a later mention in
 * the same unit that does -- an order-dependent false negative unrelated to
 * this function's own role logic. A fresh call per sentence gives every
 * sentence its own dedup scope instead.
 */
function observeCommonNounRoles(unit: SourceEvidenceUnit): DetectorObservation[] {
  const observations: DetectorObservation[] = [];

  for (const sentence of splitIntoSentences(unit.exactText)) {
    for (const candidate of extractNovelEntityCandidates(sentence, new Set())) {
      if (candidate.isProper) continue; // proper nouns are handled by observeProperNounRoles
      const headNoun = candidate.headNoun;
      if (!headNoun) continue;

      const start = sentence.indexOf(candidate.workingLabel);
      if (start === -1) continue;
      const end = start + candidate.workingLabel.length;

      if (PLACE_HEAD_NOUNS.has(headNoun) && (isSpatiallyGoverned(sentence, start) || isPlaceVerbGoverned(sentence, start))) {
        observations.push({
          kind: 'location_proposal',
          label: candidate.workingLabel,
          evidence: unit,
          reasons: ['noun_phrase_match', 'place_headnoun_match'],
        });
        continue;
      }
      if (PERSON_HEAD_NOUNS.has(headNoun) && agentiveSubjectStrength(sentence, end) !== null) {
        observations.push({
          kind: 'actor_proposal',
          label: candidate.workingLabel,
          evidence: unit,
          reasons: ['noun_phrase_match', 'person_headnoun_match'],
        });
        continue;
      }
      if (OBJECT_HEAD_NOUNS.has(headNoun) && isPossessionObject(sentence, start)) {
        observations.push({
          kind: 'object_proposal',
          label: candidate.workingLabel,
          evidence: unit,
          reasons: ['noun_phrase_match', 'object_headnoun_match'],
        });
      }
      // Otherwise: the head noun does not plausibly belong to any supported
      // kind, or no positional evidence confirms the role -- stays unpromoted.
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
    for (const observation of observeProperNounRoles(unit)) addObservation(candidates, observation);
    for (const observation of observeCommonNounRoles(unit)) addObservation(candidates, observation);
    for (const observation of observeFactions(unit)) addObservation(candidates, observation);
  }
  mergeIdentityDisclosures(candidates, units);
  preserveCrossKindAmbiguities(candidates);

  return {
    entries: [...candidates.values()].map((candidate) => {
      const supportingUnitCount = candidate.evidence.length;
      const reasons = new Set(candidate.reasons);
      if (supportingUnitCount > 1) reasons.add('repeated_identity_reference');
      // An actor confirmed solely through an ambiguous-tier verb ("Ironspire
      // remained empty") -- with no strong-tier corroboration anywhere for
      // the same label -- gets an honest ambiguity flag rather than
      // confident promotion; a label with both keeps its normal confidence,
      // since the strong evidence corroborates the role independently.
      const soleAmbiguousActorSubject =
        candidate.kind === 'actor_proposal' &&
        candidate.reasons.has('ambiguous_agentive_verb') &&
        !candidate.reasons.has('agentive_subject_verb');
      return {
        proposed: proposalFor(candidate),
        evidence: [...candidate.evidence],
        discoveryConfidence: {
          classification: candidate.ambiguous || soleAmbiguousActorSubject
            ? 'ambiguous'
            : supportingUnitCount > 1 ? 'corroborated' : 'provisional',
          supportingUnitCount,
          reasons: [...reasons].sort(),
        },
      };
    }),
  };
}
