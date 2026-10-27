// Capability detection never starts a session or prompts for a device.
export function watchVRSupport(onChange, xr = globalThis.navigator?.xr) {
  let alive = true, revision = 0;
  const check = async () => {
    const current = ++revision;
    let supported = false;
    try { supported = Boolean(await xr?.isSessionSupported?.('immersive-vr')); } catch { /* Normal view stays available. */ }
    if (alive && current === revision) onChange(supported);
  };
  check();
  xr?.addEventListener?.('devicechange', check);
  return () => { alive = false; ++revision; xr?.removeEventListener?.('devicechange', check); };
}

// One action per deliberate look. A pause/lost pose cannot complete a dwell.
export function createGazeDwell(duration = 1600) {
  let target = null, started = 0, lastTime = null, fired = false;
  return {
    reset() { target = null; fired = false; lastTime = null; },
    update(next, time) {
      if (!next) { this.reset(); return { progress: 0, activate: false }; }
      if (next !== target || lastTime === null || time - lastTime > 250 || time < lastTime) {
        target = next; started = time; fired = false;
      }
      lastTime = time;
      const progress = Math.min(1, Math.max(0, (time - started) / duration));
      const activate = progress === 1 && !fired;
      if (activate) fired = true;
      return { progress, activate };
    },
  };
}
