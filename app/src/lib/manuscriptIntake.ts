import type { AuthorSourceDocument, AuthorSourceDocumentType, StoryProject } from '../types';

/**
 * Manuscript Intake Baseline.
 *
 * This module does exactly one thing: it lets an author's existing prose
 * enter a StoryProject as authoritative source material, unchanged.
 *
 * It deliberately does NOT:
 *   - rewrite, summarize, clean, split, extract, classify, or interpret text;
 *   - create actors, objects, locations, factions, facts, threads, or reveals;
 *   - invent a POV actor, a location, or a beat/scene/chapter boundary;
 *   - invent possession, belief, knowledge, or any other state transition;
 *   - call an AI provider, or require one to be available.
 *
 * A StoryProject built here is intentionally, honestly empty of narrative
 * canon. Populating it is later, separate, reviewed work (Bootstrap
 * Manifest phase) -- not this slice.
 */

const NO_LOCATION_ID = '';
const NO_LOCATION_LABEL = '';
const NO_POV_ACTOR_ID = '';

export interface CreateAuthorSourceDocumentParams {
  readonly id: string;
  readonly label: string;
  readonly exactText: string;
  readonly importedAt: number;
  readonly sourceType?: AuthorSourceDocumentType;
}

/**
 * Wraps author-supplied text into an AuthorSourceDocument, storing it
 * exactly as given. No trimming, normalization, or interpretation of any
 * kind happens here. Frozen so nothing downstream can silently edit
 * `exactText` and still call it "author-supplied source material" -- an
 * edit to source material must go through creating/replacing a document,
 * not a mutation.
 *
 * The one normalization this code cannot see or control: a browser
 * `<textarea>` DOM value normalizes CRLF/CR line endings to LF before this
 * function (or any JS) ever receives the string. That happens upstream, is
 * outside this function's reach, and is the only divergence from what the
 * author physically typed or pasted. See tests/manuscriptIntake.test.ts for
 * proof this function performs zero additional transformation.
 */
export function createAuthorSourceDocument(
  params: CreateAuthorSourceDocumentParams,
): AuthorSourceDocument {
  return Object.freeze({
    id: params.id,
    label: params.label,
    exactText: params.exactText,
    sourceType: params.sourceType ?? 'pasted_prose',
    importedAt: params.importedAt,
  });
}

export interface ManuscriptIntakeInput {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly sourceLabel: string;
  readonly pastedText: string;
  readonly importedAt: number;
  readonly sourceDocumentId: string;
}

/**
 * Builds a brand-new StoryProject from author-supplied intake input.
 *
 * Takes no existing StoryProject as input, by design: a function that never
 * receives existing canonical state cannot mutate it. Adding the result to
 * an author's project list is the caller's responsibility (App.tsx), and is
 * itself additive (append), never a rewrite of any other project.
 *
 * If `pastedText` is non-empty, exactly one AuthorSourceDocument is created
 * and attached. If it is empty, the project is created with no source
 * documents at all -- still a legitimately empty project, not a fabricated
 * one; this is also how an author starts a project with no existing prose
 * to import.
 */
export function createManuscriptIntakeProject(input: ManuscriptIntakeInput): StoryProject {
  const projectTitle = input.projectTitle.trim().length > 0
    ? input.projectTitle
    : 'Untitled Narrative Project';

  const sourceDocuments: AuthorSourceDocument[] = input.pastedText.length > 0
    ? [
        createAuthorSourceDocument({
          id: input.sourceDocumentId,
          label: input.sourceLabel.trim().length > 0 ? input.sourceLabel : 'Untitled Source',
          exactText: input.pastedText,
          importedAt: input.importedAt,
        }),
      ]
    : [];

  return {
    id: input.projectId,
    title: projectTitle,
    description: sourceDocuments.length > 0
      ? 'Imported author-supplied source material awaiting structural review.'
      : 'A newly initialized project with no established story state yet.',
    currentPosition: {
      act: 'Unassigned',
      chapter: sourceDocuments.length > 0 ? sourceDocuments[0].label : 'Unassigned',
      scene: 'Unresolved',
      beat: 1,
      location_id: NO_LOCATION_ID,
      location_label: NO_LOCATION_LABEL,
    },
    activePovActorId: NO_POV_ACTOR_ID,
    manuscript: [],
    actors: [],
    objects: [],
    locations: [],
    factions: [],
    facts: [],
    threads: [],
    reveals: [],
    mentions: [],
    knowledge: {
      world_truth: [],
      reader_knowledge: [],
      actor_knowledge: {},
    },
    temporalHistory: [],
    sourceDocuments,
  };
}
