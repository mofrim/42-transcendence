import assert from 'node:assert/strict';
import test from 'node:test';

import { isBlackHoleQuestCompleted } from '../src/game/BlackHoleTimeout.ts';

test('keep restored completed black-hole quest completed', () => {
    assert.equal(isBlackHoleQuestCompleted(true, 16 * 60 + 42), true);
});

test('not complete active or expired black-hole countdown', () => {
    assert.equal(isBlackHoleQuestCompleted(false, 16 * 60 + 42), false);
    // stoppen
    assert.equal(isBlackHoleQuestCompleted(true, 0), false);
});
