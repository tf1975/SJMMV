(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ArchiveProgress = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function normalize(raw, chapterCount) {
    if (raw && typeof raw === 'object') {
      const status = ['not-started', 'reading', 'finished'].includes(raw.status)
        ? raw.status
        : 'not-started';
      if (status === 'finished') {
        return { status, currentChapter: chapterCount };
      }
      if (status === 'not-started') {
        return { status, currentChapter: 0 };
      }
      return { status, currentChapter: clamp(raw.currentChapter || 1, 1, chapterCount) };
    }

    // Legacy builds stored a number. Treat it as the reader's current chapter,
    // which matches the wording users saw during onboarding.
    const chapter = clamp(raw, 0, chapterCount);
    if (chapter === 0) return { status: 'not-started', currentChapter: 0 };
    if (chapter >= chapterCount) return { status: 'finished', currentChapter: chapterCount };
    return { status: 'reading', currentChapter: chapter };
  }

  function lastCompleted(entry, chapterCount) {
    const value = normalize(entry, chapterCount);
    if (value.status === 'finished') return chapterCount;
    if (value.status === 'reading') return Math.max(0, value.currentChapter - 1);
    return 0;
  }

  function canOpenChapter(entry, chapterCount, chapter) {
    const value = normalize(entry, chapterCount);
    if (value.status === 'finished') return chapter <= chapterCount;
    return chapter <= Math.max(1, value.currentChapter);
  }

  return { normalize, lastCompleted, canOpenChapter };
});
