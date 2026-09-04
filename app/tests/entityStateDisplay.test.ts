import assert from 'node:assert/strict';
import type { ActorEntity, ObjectEntity } from '../src/types';
import {
  describeActorEmotion,
  describeActorFatigue,
  describeActorFear,
  describeObjectStatus,
  objectStatusBadgeTone,
  UNESTABLISHED_LABEL,
} from '../src/lib/entityStateDisplay';

function actorWithState(current_state?: ActorEntity['current_state']): ActorEntity {
  return {
    id: 'actor_fixture',
    identity: { name: null, working_label: 'a fixture actor', aliases: [] },
    roles: { story: [], scene: [] },
    traits: {},
    current_state,
    active_goals: [],
    current_location_id: '',
    possessions: [],
    isPresent: true,
  };
}

function objectWithStatus(status?: ObjectEntity['status']): ObjectEntity {
  return {
    id: 'object_fixture',
    identity: { name: null, working_label: 'a fixture object', aliases: [] },
    current_holder_id: null,
    current_location_id: null,
    status,
    salience: 0.5,
    isPresent: true,
  };
}

// ---------------------------------------------------------------------------
// UI must not display unknown state as concrete authored state
// ---------------------------------------------------------------------------

function testUnestablishedActorStateDisplaysAsNotEstablished() {
  const actor = actorWithState(undefined);
  assert.equal(describeActorFatigue(actor), UNESTABLISHED_LABEL);
  assert.equal(describeActorFear(actor), UNESTABLISHED_LABEL);
  assert.equal(describeActorEmotion(actor), UNESTABLISHED_LABEL);
  // None of these must ever read as a plausible concrete value.
  assert.notEqual(describeActorFatigue(actor), '0%');
  assert.notEqual(describeActorEmotion(actor), 'neutral');
}

function testEstablishedActorStateDisplaysTheRealValue() {
  const actor = actorWithState({ fatigue: 0.4, fear: 0.2, certainty: 0.8, emotion: 'determined' });
  assert.equal(describeActorFatigue(actor), '40%');
  assert.equal(describeActorFear(actor), '20%');
  assert.equal(describeActorEmotion(actor), 'determined');
}

function testUnestablishedObjectStatusDisplaysAsNotEstablished() {
  const object = objectWithStatus(undefined);
  assert.equal(describeObjectStatus(object), UNESTABLISHED_LABEL.toUpperCase());
  assert.notEqual(describeObjectStatus(object), 'INTACT');
  assert.equal(objectStatusBadgeTone(object), 'unestablished',
    'an unestablished status must not share the "positive/healthy" tone real intact objects get');
}

function testEstablishedObjectStatusDisplaysTheRealValueAndTone() {
  assert.equal(describeObjectStatus(objectWithStatus('intact')), 'INTACT');
  assert.equal(objectStatusBadgeTone(objectWithStatus('intact')), 'positive');
  assert.equal(objectStatusBadgeTone(objectWithStatus('missing')), 'warning');
  assert.equal(objectStatusBadgeTone(objectWithStatus('destroyed')), 'danger');
  assert.equal(objectStatusBadgeTone(objectWithStatus('damaged')), 'positive',
    '"damaged" falls into the same tone bucket as "intact" today (pre-existing behavior, unrelated to this fix)');
}

function run() {
  testUnestablishedActorStateDisplaysAsNotEstablished();
  testEstablishedActorStateDisplaysTheRealValue();
  testUnestablishedObjectStatusDisplaysAsNotEstablished();
  testEstablishedObjectStatusDisplaysTheRealValueAndTone();
  console.log('entity state display regression passed');
}

run();
