/*
 * Virtual clock, injected before any page script runs.
 *
 * SyncLab keeps time only through performance.now, Date.now, setTimeout,
 * setInterval and requestAnimationFrame. With ?server=local the authoritative
 * server (the same shared code the Node server runs) also lives in the tab.
 * Replacing those clocks lets the capture script step the whole app, netcode
 * included, exactly 1/30 s per frame, so footage is perfectly smooth no matter
 * how long each screenshot takes. App code and netcode are unchanged.
 *
 * CSS animations and transitions are pinned to the same clock through the
 * Web Animations API.
 */
(() => {
  const realSetTimeout = window.setTimeout.bind(window);
  const epoch = Date.now();
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  let frameCallbacks = new Map();
  const animationStarts = new WeakMap();

  performance.now = () => now;
  Date.now = () => epoch + now;

  window.setTimeout = (fn, delay = 0, ...args) => {
    const id = nextId++;
    timers.set(id, { fn, args, at: now + Math.max(0, Number(delay) || 0), every: 0 });
    return id;
  };
  window.setInterval = (fn, delay = 0, ...args) => {
    const id = nextId++;
    const every = Math.max(1, Number(delay) || 0);
    timers.set(id, { fn, args, at: now + every, every });
    return id;
  };
  window.clearTimeout = (id) => timers.delete(id);
  window.clearInterval = (id) => timers.delete(id);

  window.requestAnimationFrame = (fn) => {
    const id = nextId++;
    frameCallbacks.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => frameCallbacks.delete(id);

  function runTimersUntil(target) {
    for (;;) {
      let soonestId = -1;
      let soonest = null;
      for (const [id, timer] of timers) {
        if (timer.at <= target && (soonest === null || timer.at < soonest.at)) {
          soonest = timer;
          soonestId = id;
        }
      }
      if (soonest === null) break;
      now = Math.max(now, soonest.at);
      if (soonest.every > 0) soonest.at += soonest.every;
      else timers.delete(soonestId);
      try {
        if (typeof soonest.fn === "function") soonest.fn(...soonest.args);
      } catch (error) {
        console.error("[virtual-clock] timer error", error);
      }
    }
    now = target;
  }

  function syncCssAnimations() {
    for (const animation of document.getAnimations()) {
      if (!animationStarts.has(animation)) animationStarts.set(animation, now);
      animation.pause();
      animation.currentTime = now - animationStarts.get(animation);
    }
  }

  /** Advance virtual time by ms, run due timers, then one animation frame. */
  window.__vclockAdvance = async (ms) => {
    const target = now + ms;
    // Step in 4 ms slices so promise/microtask work between timers settles in order.
    while (now < target) {
      runTimersUntil(Math.min(target, now + 4));
      await Promise.resolve();
    }
    const callbacks = frameCallbacks;
    frameCallbacks = new Map();
    for (const fn of callbacks.values()) {
      try {
        fn(now);
      } catch (error) {
        console.error("[virtual-clock] rAF error", error);
      }
    }
    syncCssAnimations();
    // Let React's MessageChannel scheduler flush DOM updates before the screenshot.
    await new Promise((resolve) => realSetTimeout(resolve, 0));
    await new Promise((resolve) => realSetTimeout(resolve, 0));
    return now;
  };
  window.__vclockNow = () => now;

  try {
    window.localStorage.setItem("synclab.tour.v1", "done");
  } catch {
    /* storage blocked: the tour would show, capture would notice */
  }
})();
