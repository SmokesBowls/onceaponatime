import type { ActorEntity, ObjectEntity } from '../types';

/**
 * Presentation for actor current_state / object status when either is
 * genuinely absent (unestablished), never a substitute default. Absence
 * must read to the author as "not established", not as a plausible-looking
 * neutral value they could mistake for something the framework actually
 * knows. Used by RelationalGraph.tsx; kept here (not inline in the
 * component) so the mapping from absence to display text is directly unit
 * testable without a React/DOM harness.
 */

export const UNESTABLISHED_LABEL = 'Not Established';

export function describeActorFatigue(actor: ActorEntity): string {
  return actor.current_state ? `${Math.round(actor.current_state.fatigue * 100)}%` : UNESTABLISHED_LABEL;
}

export function describeActorFear(actor: ActorEntity): string {
  return actor.current_state ? `${Math.round(actor.current_state.fear * 100)}%` : UNESTABLISHED_LABEL;
}

export function describeActorEmotion(actor: ActorEntity): string {
  return actor.current_state ? actor.current_state.emotion : UNESTABLISHED_LABEL;
}

export function describeObjectStatus(object: ObjectEntity): string {
  return object.status ? object.status.toUpperCase() : UNESTABLISHED_LABEL.toUpperCase();
}

export type ObjectStatusBadgeTone = 'warning' | 'danger' | 'positive' | 'unestablished';

/**
 * The pre-existing badge logic defaulted every non-'missing'/'destroyed'
 * status to a positive/"healthy" green, which would have colored an absent
 * (unestablished) status the same as a confirmed-intact one. Absence gets
 * its own neutral tone instead.
 */
export function objectStatusBadgeTone(object: ObjectEntity): ObjectStatusBadgeTone {
  if (object.status === undefined) return 'unestablished';
  if (object.status === 'missing') return 'warning';
  if (object.status === 'destroyed') return 'danger';
  return 'positive';
}
