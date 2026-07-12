const assert = require('assert');
const progress = require('../assets/progress-model.js');

assert.deepStrictEqual(progress.normalize(0, 55), { status: 'not-started', currentChapter: 0 });
assert.deepStrictEqual(progress.normalize(38, 55), { status: 'reading', currentChapter: 38 });
assert.strictEqual(progress.lastCompleted(38, 55), 37);
assert.strictEqual(progress.canOpenChapter(38, 55, 38), true);
assert.strictEqual(progress.canOpenChapter(38, 55, 39), false);
assert.strictEqual(progress.lastCompleted({ status: 'finished', currentChapter: 55 }, 55), 55);
assert.strictEqual(progress.canOpenChapter({ status: 'finished', currentChapter: 55 }, 55, 55), true);

console.log('progress-model tests passed');
