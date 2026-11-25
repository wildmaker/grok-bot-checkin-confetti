/* Serial celebration queue with a hard pending cap. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrokBotCheckin = Object.assign(root.GrokBotCheckin || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /**
   * play(index, done) starts one celebration and must call done() exactly once.
   * Only one celebration runs at a time; up to maxPending more wait. Beyond that they are
   * counted as dropped so long-running sessions cannot accumulate unbounded work.
   */
  function createCelebrationQueue(play, maxPending) {
    const cap = maxPending == null ? 6 : maxPending;
    let running = false;
    let pending = 0;
    let started = 0;
    let dropped = 0;
    let destroyed = false;

    function next() {
      if (destroyed || running || pending === 0) return;
      pending -= 1;
      running = true;
      const index = started;
      started += 1;
      let finished = false;
      play(index, () => {
        if (finished) return;
        finished = true;
        running = false;
        next();
      });
    }

    return {
      enqueue() {
        if (destroyed) return false;
        if (pending >= cap) {
          dropped += 1;
          return false;
        }
        pending += 1;
        next();
        return true;
      },
      destroy() {
        destroyed = true;
        pending = 0;
      },
      stats: () => ({ running, pending, started, dropped }),
    };
  }

  return { createCelebrationQueue };
});
