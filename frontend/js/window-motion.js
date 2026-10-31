// macOS-style window motion: the "genie" minimize into a Dock icon and the reverse when restoring.
// Public API: WindowMotion.minimize(el, targetRect, done), WindowMotion.restore(el, fromRect, done),
// WindowMotion.cancel(el). Uses the Web Animations API; skipped when the user prefers reduced motion.
(() => {
  const DURATION = 560;
  const EASING = "cubic-bezier(0.32, 0, 0.18, 1)";
  const running = new WeakMap(); // element → Animation

  const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Keyframes that funnel the window into the point (tx, ty) given in page coordinates.
  function genie(el, target) {
    const box = el.getBoundingClientRect();
    const tx = target.left + target.width / 2 - box.left;
    const ty = target.top + target.height / 2 - box.top;
    // Where the funnel narrows to, as a percentage of the window's width.
    const x = clamp((tx / box.width) * 100, 6, 94);
    const funnel = (topL, topR, botHalf) => `polygon(${topL}% 0%, ${topR}% 0%, ${x + botHalf}% 100%, ${x - botHalf}% 100%)`;
    return {
      origin: `${tx}px ${ty}px`,
      frames: [
        { offset: 0, transform: "scale(1, 1)", clipPath: funnel(0, 100, 50 + Math.abs(50 - x)), opacity: 1 },
        { offset: 0.38, transform: "scale(0.96, 0.92)", clipPath: funnel(0, 100, 9), opacity: 1 },
        { offset: 0.72, transform: "scale(0.42, 0.5)", clipPath: funnel(x - 22, x + 22, 4), opacity: 0.95 },
        { offset: 1, transform: "scale(0.04, 0.06)", clipPath: funnel(x - 6, x + 6, 2), opacity: 0.35 },
      ],
    };
  }

  function play(el, rect, reverse, done) {
    cancel(el);
    if (!rect || !el.animate || reduceMotion()) {
      done?.();
      return null;
    }
    const { origin, frames } = genie(el, rect);
    const previousOrigin = el.style.transformOrigin;
    el.style.transformOrigin = origin;
    el.classList.add("window-animating");
    const animation = el.animate(reverse ? [...frames].reverse().map((f) => ({ ...f, offset: 1 - f.offset })) : frames, {
      duration: DURATION,
      easing: reverse ? "cubic-bezier(0.2, 0.8, 0.3, 1)" : EASING,
      fill: "forwards",
    });
    running.set(el, animation);
    const finish = () => {
      if (running.get(el) !== animation) return;
      running.delete(el);
      done?.();
      // Drop the animation's fill only after the caller has applied the final state (hidden or shown).
      animation.cancel();
      el.style.transformOrigin = previousOrigin;
      el.classList.remove("window-animating");
    };
    animation.onfinish = finish;
    // The finish event only fires on a rendered frame; if the tab is hidden mid-animation, finish anyway
    // so the window never gets stuck half-minimized. `finish` ignores the second call.
    setTimeout(finish, DURATION + 120);
    return animation;
  }

  function cancel(el) {
    const animation = running.get(el);
    if (!animation) return;
    running.delete(el);
    animation.cancel();
    el.classList.remove("window-animating");
    el.style.transformOrigin = "";
  }

  window.WindowMotion = {
    minimize: (el, targetRect, done) => play(el, targetRect, false, done),
    restore: (el, fromRect, done) => play(el, fromRect, true, done),
    cancel,
    isRunning: (el) => running.has(el),
  };
})();
