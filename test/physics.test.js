const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/physics.js');
const B = BC.Blocks;
function floorWorld() {
  const w = new BC.World({ seed: 1, terrain: false, height: 32 });
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) w.set(x, 5, z, B.STONE);
  return w;
}
function run(w, body, seconds) { for (let i = 0; i < seconds * 60; i++) BC.Physics.step(w, body, 1 / 60); }

test('ciało spada i zatrzymuje się na podłodze', () => {
  const w = floorWorld();
  const body = BC.Physics.makeBody(10.5, 12, 10.5);
  run(w, body, 3);
  assert.ok(Math.abs(body.pos.y - 6) < 0.01, 'y=' + body.pos.y);
  assert.equal(body.onGround, true);
  assert.equal(body.vel.y, 0);
});

test('w locie nie ma grawitacji', () => {
  const w = floorWorld();
  const body = BC.Physics.makeBody(10.5, 12, 10.5); body.flying = true;
  run(w, body, 1);
  assert.equal(body.pos.y, 12);
  assert.equal(body.onGround, false);
});

test('ruch w bok zatrzymuje się na ścianie', () => {
  const w = floorWorld();
  w.set(12, 6, 10, B.STONE); w.set(12, 7, 10, B.STONE);
  const body = BC.Physics.makeBody(10.5, 6, 10.5);
  body.vel.x = 4;
  run(w, body, 1);
  assert.ok(body.pos.x < 12 - 0.3 + 0.01 && body.pos.x > 11.5, 'x=' + body.pos.x);
  assert.equal(body.vel.x, 0);
});

test('skok i lądowanie', () => {
  const w = floorWorld();
  const body = BC.Physics.makeBody(10.5, 6, 10.5);
  run(w, body, 0.5);
  body.vel.y = 9;
  BC.Physics.step(w, body, 1 / 60);
  assert.equal(body.onGround, false);
  run(w, body, 2);
  assert.equal(body.onGround, true);
});

test('woda: wolniejsze opadanie', () => {
  const w = floorWorld();
  for (let y = 6; y < 12; y++) w.set(10, y, 10, B.WATER);
  const body = BC.Physics.makeBody(10.5, 11, 10.5);
  run(w, body, 0.5);
  assert.equal(body.inWater, true);
  assert.ok(body.pos.y > 8, 'y=' + body.pos.y);
});

test('kolizje działają na ujemnych współrzędnych', () => {
  const w = new BC.World({ seed: 1, terrain: false, height: 32 });
  for (let x = -20; x < 0; x++) for (let z = -20; z < 0; z++) w.set(x, 5, z, B.STONE);
  const body = BC.Physics.makeBody(-10.5, 12, -10.5);
  run(w, body, 3);
  assert.ok(Math.abs(body.pos.y - 6) < 0.01, 'y=' + body.pos.y);
  assert.equal(body.onGround, true);
});

test('sufit świata zatrzymuje lot w górę', () => {
  const w = new BC.World({ seed: 1, terrain: false, height: 32 });
  const body = BC.Physics.makeBody(0.5, 30, 0.5); body.flying = true; body.vel.y = 20;
  run(w, body, 2);
  assert.ok(body.pos.y <= 42.01);
});
