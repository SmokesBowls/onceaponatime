import type { StoryProject } from '../types';

/**
 * Composition Readiness Gate.
 *
 * Whether a StoryProject has enough structured narrative state to safely
 * enter the normal composition pipeline (POST /api/framework/execute).
 *
 * Grounded in the pipeline's actual structural requirements, not in whether
 * the project happens to have sourceDocuments:
 *
 * - server/contextCompiler.ts::compileGenerationContext resolves the POV
 *   actor via `project.actors.find(a => a.id === activePovActorId) ||
 *   project.actors[0]`. If `project.actors` is empty there is no fallback
 *   left, and it throws `POV Actor with ID '${activePovActorId}' not found
 *   in project.` -- the exact runtime failure this gate exists to prevent.
 *   A resolvable POV actor is a hard requirement of the current pipeline.
 * - The current location is looked up the same way
 *   (`project.locations.find(l => l.id === currentPosition.location_id)`)
 *   and, unlike the POV actor, does not throw if absent -- context compiles
 *   with `currentLocation: null`. It is still required here: a location-less
 *   context has no established scene to write in, which is not a
 *   composition-ready state even though it happens not to crash.
 *
 * Does not inspect sourceDocuments at all. An imported project and a
 * hand-built empty project reach the same verdict for the same reason.
 */
export interface CompositionReadiness {
  readonly ready: boolean;
  readonly hasPovActor: boolean;
  readonly hasCurrentLocation: boolean;
}

export function assessCompositionReadiness(project: StoryProject): CompositionReadiness {
  const hasPovActor = project.actors.some((actor) => actor.id === project.activePovActorId);
  const hasCurrentLocation = project.locations.some(
    (location) => location.id === project.currentPosition.location_id,
  );
  return {
    ready: hasPovActor && hasCurrentLocation,
    hasPovActor,
    hasCurrentLocation,
  };
}

/**
 * The pure dispatch decision consulted before ever calling
 * POST /api/framework/execute. App.tsx's handleExecuteFramework checks this
 * first and returns without dispatching a request when it is false -- the
 * same check StoryEditor.tsx uses to disable the Execute control, so the
 * button state and the actual network call can never disagree.
 */
export function canDispatchFrameworkExecution(project: StoryProject): boolean {
  return assessCompositionReadiness(project).ready;
}

export const NARRATIVE_STRUCTURE_UNESTABLISHED_MESSAGE =
  'Authoritative source imported. Narrative structure has not yet been established.';

/**
 * Header's beat position display. A StoryProject's currentPosition.beat is a
 * "next beat to compose" pointer, not a record of an accepted beat -- it is
 * only meaningful once at least one canonical manuscript beat exists.
 * Displaying it for a project with zero manuscript beats would claim a beat
 * exists when none does.
 */
export function describeBeatPosition(project: StoryProject): string {
  return project.manuscript.length === 0 ? 'No beats yet' : `Beat #${project.currentPosition.beat}`;
}
