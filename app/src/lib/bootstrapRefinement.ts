import type { InferenceArtifact } from '../types';
import type { BootstrapManifest } from './bootstrapManifest';

/**
 * B4a -- Hermes Refinement Artifact Boundary (pure domain module).
 *
 * Governing rule (unchanged from B1-B3d):
 *
 *   author-supplied source text = authoritative source material
 *   deterministic B2 proposals  = proposals, not truth
 *   Hermes refinement output    = ANOTHER proposal source, not truth
 *
 * This module produces exactly one thing: given an eligible, immutable
 * BootstrapManifest baseline and a raw Hermes response string, validate that
 * response into a closed, source-cited BootstrapRefinementPayload. It never
 * calls a model provider (that is server/bootstrapRefinement.ts's job), never
 * merges into a BootstrapManifest (B4b), never renders UI (B4c), and is never
 * imported by anything reachable from B2/B3/B3d -- see TODO.md's "B4a --
 * Hermes Refinement Artifact Boundary" contract.
 *
 * Browser-safe: no node:crypto, no fetch, no server import. Digesting
 * (candidateDigest/rawOutputDigest/artifactDigest) needs crypto and is
 * therefore computed in server/bootstrapRefinement.ts, not here -- this
 * module only defines the shape those digests fill in and performs the
 * crypto-free structural/coordinate validation.
 */

// ---------------------------------------------------------------------------
// Operation / schema identity
// ---------------------------------------------------------------------------

export const BOOTSTRAP_REFINEMENT_OPERATION = 'onceaponatime.bootstrap.refine';
export const BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA = 'onceaponatime.bootstrap.refinement.v1';

// ---------------------------------------------------------------------------
// Candidate / payload / artifact shapes
// ---------------------------------------------------------------------------

export type BootstrapRefinementCandidateKind =
  | 'actor_proposal'
  | 'object_proposal'
  | 'location_proposal'
  | 'faction_proposal';

const SUPPORTED_REFINEMENT_KINDS: ReadonlySet<string> = new Set([
  'actor_proposal',
  'object_proposal',
  'location_proposal',
  'faction_proposal',
]);

export interface BootstrapRefinementEvidenceCitation {
  readonly sourceDocumentId: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly exactText: string;
}

/** Structurally validated candidate, before server-side digesting/identity assignment. */
export interface ValidatedBootstrapRefinementCandidate {
  readonly kind: BootstrapRefinementCandidateKind;
  readonly workingLabel: string;
  readonly name: string | null;
  readonly aliases: readonly string[];
  readonly refinesEntryId: string | null;
  readonly evidence: readonly BootstrapRefinementEvidenceCitation[];
  readonly descriptionSummary?: string;
}

export interface ValidatedBootstrapRefinementOutput {
  readonly schema: typeof BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA;
  readonly baselineManifestId: string;
  readonly boundSourceFingerprint: string;
  readonly candidates: readonly ValidatedBootstrapRefinementCandidate[];
}

/** Final candidate shape, digested/identified server-side. */
export interface BootstrapRefinementCandidate extends ValidatedBootstrapRefinementCandidate {
  readonly candidateId: string;
  readonly candidateDigest: string;
}

export interface BootstrapRefinementPayload {
  readonly schema: typeof BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA;
  readonly baselineManifestId: string;
  readonly boundSourceFingerprint: string;
  readonly candidates: readonly BootstrapRefinementCandidate[];
  readonly rawOutputDigest: string;
  readonly artifactDigest: string;
}

export type BootstrapRefinementArtifact = InferenceArtifact<BootstrapRefinementPayload>;

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/**
 * B4a source authority: BootstrapManifest.boundSourceDocuments is the sole
 * source-document input to refinement (see TODO.md). A baseline is eligible
 * only while every entry is untouched by author review -- once any decision
 * or assignment exists, refinement is unavailable for that session.
 */
export function isBootstrapRefinementEligible(manifest: BootstrapManifest): boolean {
  return manifest.entries.every((entry) => entry.decision === 'pending' && entry.admitted === undefined);
}

// ---------------------------------------------------------------------------
// Duplicate-key-detecting JSON parser
// ---------------------------------------------------------------------------

/**
 * Bare JSON.parse() silently keeps the last value of a duplicate key,
 * matching JS object-literal semantics -- by the time a reviver could
 * inspect it, the duplicate is already gone. This is a real recursive-
 * descent JSON parser that rejects a duplicate key at any nesting level and
 * rejects trailing content after the top-level value.
 */
export function parseJsonNoDuplicateKeys(rawText: string): unknown {
  const parser = new StrictJsonParser(rawText);
  const value = parser.parseValue();
  parser.skipWhitespace();
  if (parser.position !== rawText.length) {
    throw new Error(`Unexpected trailing content after JSON value at position ${parser.position}.`);
  }
  return value;
}

class StrictJsonParser {
  position = 0;
  constructor(private readonly text: string) {}

  skipWhitespace(): void {
    while (this.position < this.text.length && /[ \t\n\r]/.test(this.text[this.position])) {
      this.position += 1;
    }
  }

  private peek(): string {
    if (this.position >= this.text.length) throw new Error('Unexpected end of JSON input.');
    return this.text[this.position];
  }

  private expect(char: string): void {
    if (this.text[this.position] !== char) {
      throw new Error(`Expected "${char}" at position ${this.position}.`);
    }
    this.position += 1;
  }

  parseValue(): unknown {
    this.skipWhitespace();
    const ch = this.peek();
    if (ch === '{') return this.parseObject();
    if (ch === '[') return this.parseArray();
    if (ch === '"') return this.parseString();
    if (ch === '-' || (ch >= '0' && ch <= '9')) return this.parseNumber();
    if (this.text.startsWith('true', this.position)) { this.position += 4; return true; }
    if (this.text.startsWith('false', this.position)) { this.position += 5; return false; }
    if (this.text.startsWith('null', this.position)) { this.position += 4; return null; }
    throw new Error(`Unexpected token at position ${this.position}.`);
  }

  private parseObject(): Record<string, unknown> {
    this.expect('{');
    // Object.create(null), not {}: a plain object literal inherits Object.prototype's
    // __proto__ accessor, so result['__proto__'] = value would silently reassign the
    // object's prototype instead of creating an own property -- the key would vanish
    // from Object.keys()/hasOwnProperty, evading both duplicate-key detection and every
    // downstream exact-key-set check. A null-prototype target makes every key (including
    // "__proto__") a genuine own data property.
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    this.skipWhitespace();
    if (this.peek() === '}') { this.position += 1; return result; }
    for (;;) {
      this.skipWhitespace();
      if (this.peek() !== '"') throw new Error(`Expected string key at position ${this.position}.`);
      const key = this.parseString();
      this.skipWhitespace();
      this.expect(':');
      const value = this.parseValue();
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        throw new Error(`Duplicate JSON key "${key}" at position ${this.position}.`);
      }
      result[key] = value;
      this.skipWhitespace();
      const next = this.peek();
      if (next === ',') { this.position += 1; continue; }
      if (next === '}') { this.position += 1; break; }
      throw new Error(`Expected "," or "}" at position ${this.position}.`);
    }
    return result;
  }

  private parseArray(): unknown[] {
    this.expect('[');
    const result: unknown[] = [];
    this.skipWhitespace();
    if (this.peek() === ']') { this.position += 1; return result; }
    for (;;) {
      result.push(this.parseValue());
      this.skipWhitespace();
      const next = this.peek();
      if (next === ',') { this.position += 1; continue; }
      if (next === ']') { this.position += 1; break; }
      throw new Error(`Expected "," or "]" at position ${this.position}.`);
    }
    return result;
  }

  private parseString(): string {
    this.expect('"');
    let result = '';
    for (;;) {
      if (this.position >= this.text.length) throw new Error('Unterminated JSON string.');
      const ch = this.text[this.position];
      if (ch === '"') { this.position += 1; break; }
      if (ch === '\\') {
        this.position += 1;
        const esc = this.text[this.position];
        switch (esc) {
          case '"': result += '"'; break;
          case '\\': result += '\\'; break;
          case '/': result += '/'; break;
          case 'b': result += '\b'; break;
          case 'f': result += '\f'; break;
          case 'n': result += '\n'; break;
          case 'r': result += '\r'; break;
          case 't': result += '\t'; break;
          case 'u': {
            const hex = this.text.slice(this.position + 1, this.position + 5);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error('Invalid unicode escape in JSON string.');
            result += String.fromCharCode(parseInt(hex, 16));
            this.position += 4;
            break;
          }
          default:
            throw new Error(`Invalid escape sequence "\\${esc}" in JSON string.`);
        }
        this.position += 1;
      } else if (ch.charCodeAt(0) < 0x20) {
        throw new Error('Unescaped control character in JSON string.');
      } else {
        result += ch;
        this.position += 1;
      }
    }
    return result;
  }

  private parseNumber(): number {
    const start = this.position;
    if (this.text[this.position] === '-') this.position += 1;
    if (this.text[this.position] === '0') {
      this.position += 1;
    } else if (this.text[this.position] >= '1' && this.text[this.position] <= '9') {
      while (this.text[this.position] >= '0' && this.text[this.position] <= '9') this.position += 1;
    } else {
      throw new Error(`Invalid number at position ${start}.`);
    }
    if (this.text[this.position] === '.') {
      this.position += 1;
      if (!(this.text[this.position] >= '0' && this.text[this.position] <= '9')) throw new Error('Invalid number fraction.');
      while (this.text[this.position] >= '0' && this.text[this.position] <= '9') this.position += 1;
    }
    if (this.text[this.position] === 'e' || this.text[this.position] === 'E') {
      this.position += 1;
      if (this.text[this.position] === '+' || this.text[this.position] === '-') this.position += 1;
      if (!(this.text[this.position] >= '0' && this.text[this.position] <= '9')) throw new Error('Invalid number exponent.');
      while (this.text[this.position] >= '0' && this.text[this.position] <= '9') this.position += 1;
    }
    const numberText = this.text.slice(start, this.position);
    const value = Number(numberText);
    if (!Number.isFinite(value)) throw new Error(`Non-finite JSON number at position ${start}.`);
    return value;
  }
}

// ---------------------------------------------------------------------------
// Structural / coordinate validation
// ---------------------------------------------------------------------------

const MAX_RAW_OUTPUT_BYTES = 262_144;
const MAX_CANDIDATES = 64;
const MIN_EVIDENCE_PER_CANDIDATE = 1;
const MAX_EVIDENCE_PER_CANDIDATE = 8;
const MAX_ALIASES = 16;
const MAX_LABEL_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

const TOP_LEVEL_KEYS = ['schema', 'baseline_manifest_id', 'bound_source_fingerprint', 'entries'];
const CANDIDATE_BASE_KEYS = ['kind', 'working_label', 'name', 'aliases', 'refines_entry_id', 'evidence'];
const CITATION_KEYS = ['source_document_id', 'start_offset', 'end_offset'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
}

/**
 * Every required key must be present; every actual key must be required or
 * optional -- unlike hasExactKeys, this does not demand a fixed total count,
 * so a genuinely optional key (description_summary on a location_proposal)
 * may be present or entirely absent without failing closed on the absent
 * case. The parser guarantees no duplicate own keys, so no separate
 * duplicate check is needed here.
 */
function hasAllowedKeys(value: Record<string, unknown>, requiredKeys: readonly string[], optionalKeys: readonly string[] = []): boolean {
  const actualKeys = Object.keys(value);
  for (const key of requiredKeys) {
    if (!actualKeys.includes(key)) return false;
  }
  return actualKeys.every((key) => requiredKeys.includes(key) || optionalKeys.includes(key));
}

/** Labels/names/aliases reject every C0/C1 control character, including TAB/LF/CR. */
// eslint-disable-next-line no-control-regex
const STRICT_CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/;
/** Description text may contain TAB/LF/CR but no other C0/C1 control character. */
// eslint-disable-next-line no-control-regex
const DESCRIPTION_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

function requireBoundedString(value: unknown, field: string, min: number, max: number, controlChars: RegExp): string {
  if (typeof value !== 'string') throw new Error(`Bootstrap refinement candidate ${field} must be a string.`);
  const trimmedLength = value.trim().length;
  if (trimmedLength < min || trimmedLength > max) {
    throw new Error(`Bootstrap refinement candidate ${field} must be ${min}-${max} UTF-16 code units after trimming.`);
  }
  if (controlChars.test(value)) {
    throw new Error(`Bootstrap refinement candidate ${field} contains a disallowed control character.`);
  }
  return value;
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function validateEvidenceCitation(
  raw: unknown,
  baseline: BootstrapManifest,
  seenSpans: Set<string>,
): BootstrapRefinementEvidenceCitation {
  if (!isRecord(raw) || !hasExactKeys(raw, CITATION_KEYS)) {
    throw new Error('Malformed bootstrap refinement evidence citation.');
  }
  const { source_document_id: sourceDocumentId, start_offset: startOffset, end_offset: endOffset } = raw;
  if (typeof sourceDocumentId !== 'string' || sourceDocumentId.length === 0) {
    throw new Error('Bootstrap refinement evidence citation source_document_id must be a non-empty string.');
  }
  const document = baseline.boundSourceDocuments.find((doc) => doc.id === sourceDocumentId);
  if (!document) {
    throw new Error(`Bootstrap refinement evidence citation references an unbound source document: ${sourceDocumentId}`);
  }
  if (
    !Number.isSafeInteger(startOffset) || (startOffset as number) < 0
    || !Number.isSafeInteger(endOffset) || (endOffset as number) <= (startOffset as number)
    || (endOffset as number) > document.exactText.length
  ) {
    throw new Error(`Bootstrap refinement evidence citation has an invalid offset range into ${sourceDocumentId}.`);
  }
  const exactText = document.exactText.slice(startOffset as number, endOffset as number);
  if (!LETTER_OR_NUMBER.test(exactText)) {
    throw new Error('Bootstrap refinement evidence citation span contains no Unicode letter or number.');
  }
  const spanKey = `${sourceDocumentId}#${startOffset}#${endOffset}`;
  if (seenSpans.has(spanKey)) {
    throw new Error('Bootstrap refinement candidate cites the exact same evidence span twice.');
  }
  seenSpans.add(spanKey);
  return { sourceDocumentId, startOffset: startOffset as number, endOffset: endOffset as number, exactText };
}

function validateCandidate(raw: unknown, baseline: BootstrapManifest): ValidatedBootstrapRefinementCandidate {
  if (!isRecord(raw)) throw new Error('Malformed bootstrap refinement candidate.');
  if (typeof raw.kind !== 'string' || !SUPPORTED_REFINEMENT_KINDS.has(raw.kind)) {
    throw new Error(`Unsupported bootstrap refinement candidate kind: ${String(raw.kind)}`);
  }
  const kind = raw.kind as BootstrapRefinementCandidateKind;
  // description_summary is genuinely optional on a location_proposal -- present or
  // entirely absent are both valid, so this is an allowed-key check, not an exact-count
  // one (a fixed exact-count check would wrongly reject every location candidate that
  // simply omits the key).
  const optionalKeys = kind === 'location_proposal' ? ['description_summary'] : [];
  if (!hasAllowedKeys(raw, CANDIDATE_BASE_KEYS, optionalKeys)) {
    throw new Error(`Bootstrap refinement candidate of kind ${kind} has a missing or unsupported field.`);
  }

  const workingLabel = requireBoundedString(raw.working_label, 'working_label', 1, MAX_LABEL_LENGTH, STRICT_CONTROL_CHARS);

  let name: string | null;
  if (raw.name === null) {
    name = null;
  } else {
    name = requireBoundedString(raw.name, 'name', 1, MAX_LABEL_LENGTH, STRICT_CONTROL_CHARS);
  }

  if (!Array.isArray(raw.aliases) || raw.aliases.length > MAX_ALIASES) {
    throw new Error('Bootstrap refinement candidate aliases must be an array of at most 16 entries.');
  }
  const aliases = raw.aliases.map((alias) => requireBoundedString(alias, 'alias', 1, MAX_LABEL_LENGTH, STRICT_CONTROL_CHARS));

  let refinesEntryId: string | null;
  if (raw.refines_entry_id === null) {
    refinesEntryId = null;
  } else {
    if (typeof raw.refines_entry_id !== 'string' || raw.refines_entry_id.length === 0) {
      throw new Error('Bootstrap refinement candidate refines_entry_id must be a non-empty string or null.');
    }
    const target = baseline.entries.find((entry) => entry.id === raw.refines_entry_id);
    if (!target || target.kind !== kind) {
      throw new Error(`Bootstrap refinement candidate refines_entry_id does not name a baseline entry of kind ${kind}.`);
    }
    refinesEntryId = raw.refines_entry_id;
  }

  if (!Array.isArray(raw.evidence) || raw.evidence.length < MIN_EVIDENCE_PER_CANDIDATE || raw.evidence.length > MAX_EVIDENCE_PER_CANDIDATE) {
    throw new Error('Bootstrap refinement candidate evidence must have between 1 and 8 citations.');
  }
  const seenSpans = new Set<string>();
  const evidence = raw.evidence.map((citation) => validateEvidenceCitation(citation, baseline, seenSpans));

  let descriptionSummary: string | undefined;
  if (kind === 'location_proposal' && raw.description_summary !== undefined) {
    descriptionSummary = requireBoundedString(raw.description_summary, 'description_summary', 1, MAX_DESCRIPTION_LENGTH, DESCRIPTION_CONTROL_CHARS);
  }

  return {
    kind,
    workingLabel,
    name,
    aliases,
    refinesEntryId,
    evidence,
    ...(descriptionSummary === undefined ? {} : { descriptionSummary }),
  };
}

/**
 * Pure structural + UTF-16 coordinate validation of one raw Hermes refinement
 * response against its exact baseline. Does not compute digests (no crypto
 * dependency) and does not assign candidate identity -- that is
 * server/bootstrapRefinement.ts's job once this returns successfully. Throws
 * on any structural violation; never returns a partially-valid result.
 */
export function validateBootstrapRefinementOutput(
  rawOutputText: string,
  baseline: BootstrapManifest,
): ValidatedBootstrapRefinementOutput {
  if (utf8ByteLength(rawOutputText) > MAX_RAW_OUTPUT_BYTES) {
    throw new Error(`Bootstrap refinement output exceeds the ${MAX_RAW_OUTPUT_BYTES}-byte limit.`);
  }

  const parsed = parseJsonNoDuplicateKeys(rawOutputText);
  if (!isRecord(parsed) || !hasExactKeys(parsed, TOP_LEVEL_KEYS)) {
    throw new Error('Bootstrap refinement output does not match the closed response envelope.');
  }
  if (parsed.schema !== BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA) {
    throw new Error('Bootstrap refinement output schema is unsupported.');
  }
  if (parsed.baseline_manifest_id !== baseline.id) {
    throw new Error('Bootstrap refinement output baseline_manifest_id does not match the exact baseline.');
  }
  if (parsed.bound_source_fingerprint !== baseline.boundSourceFingerprint) {
    throw new Error('Bootstrap refinement output bound_source_fingerprint does not match the exact baseline.');
  }
  if (!Array.isArray(parsed.entries) || parsed.entries.length > MAX_CANDIDATES) {
    throw new Error(`Bootstrap refinement output entries must be an array of at most ${MAX_CANDIDATES} candidates.`);
  }

  const candidates = parsed.entries.map((entry) => validateCandidate(entry, baseline));

  return {
    schema: BOOTSTRAP_REFINEMENT_RESPONSE_SCHEMA,
    baselineManifestId: baseline.id,
    boundSourceFingerprint: baseline.boundSourceFingerprint,
    candidates,
  };
}

// ---------------------------------------------------------------------------
// Identity collision detection
// ---------------------------------------------------------------------------

/**
 * Rejects a whole candidate set closed if any two candidates share a
 * shortened `candidateId`, even when their full `candidateDigest` values
 * differ -- the shortened id is the application/display identity and must
 * remain collision-free regardless of digest content.
 */
export function assertNoIdentityCollisions(candidates: readonly { readonly candidateId: string }[]): void {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.candidateId)) {
      throw new Error(`Duplicate Bootstrap refinement candidate identity: ${candidate.candidateId}`);
    }
    seen.add(candidate.candidateId);
  }
}
