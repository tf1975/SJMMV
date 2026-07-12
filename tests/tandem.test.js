const assert = require('assert');
const tandem = require('../data/tandem.json');

assert.strictEqual(tandem.steps.length, 50);

for (const [bookId, chapterCount] of [['eos', 75], ['tod', 68]]) {
  const chapters = tandem.steps
    .filter(step => step.bookId === bookId)
    .flatMap(step => Array.from({ length: step.end - step.start + 1 }, (_, index) => step.start + index));
  assert.deepStrictEqual(chapters, Array.from({ length: chapterCount }, (_, index) => index + 1));
}

for (let index = 1; index < tandem.steps.length; index += 1) {
  assert.notStrictEqual(tandem.steps[index - 1].bookId, tandem.steps[index].bookId);
}

console.log('tandem tests passed');
