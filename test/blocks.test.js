const test = require('node:test');
const assert = require('node:assert');
const BC = require('../src/blocks.js');

test('każdy blok ma wpis w BlockInfo', () => {
  for (const id of Object.values(BC.Blocks)) {
    assert.ok(BC.BlockInfo[id], 'brak wpisu dla id ' + id);
    assert.ok(typeof BC.BlockInfo[id].name === 'string');
    assert.ok(BC.BlockInfo[id].tex && 'top' in BC.BlockInfo[id].tex);
  }
});

test('woda i kwiat nie są stałe, bedrock niezniszczalny', () => {
  assert.equal(BC.BlockInfo[BC.Blocks.WATER].solid, false);
  assert.equal(BC.BlockInfo[BC.Blocks.FLOWER].solid, false);
  assert.equal(BC.BlockInfo[BC.Blocks.STONE].solid, true);
  assert.equal(BC.BlockInfo[BC.Blocks.BEDROCK].breakable, false);
});

test('hotbar ma 3 strony po 9 slotów z placeable blokami', () => {
  assert.equal(BC.Hotbar.length, 3);
  for (const page of BC.Hotbar) {
    assert.equal(page.length, 9);
    for (const id of page) assert.equal(BC.BlockInfo[id].placeable, true);
  }
});
