export function mountPuzzleTimer(display, canPlay) {
  let key;
  let elapsed = 0;
  let startedAt = null;
  let interval;
  let pageActive = true;
  let canPersist = true;

  function savedTime() {
    if (!canPersist) return elapsed;
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch {
      canPersist = false;
      return elapsed;
    }
  }

  function draw() {
    const total = Math.floor((elapsed + (startedAt === null ? 0 : performance.now() - startedAt)) / 1000);
    const minutes = Math.floor(total / 60);
    const hours = Math.floor(minutes / 60);
    const formatted = [minutes % 60, total % 60].map(value => String(value).padStart(2, "0")).join(":");
    const time = hours ? `${hours}:${formatted}` : formatted;
    if (display.textContent !== time) display.textContent = time;
  }

  function pause() {
    if (startedAt === null) return;
    const duration = performance.now() - startedAt;
    elapsed = savedTime() + duration;
    startedAt = null;
    clearInterval(interval);
    try {
      if (canPersist) localStorage.setItem(key, String(elapsed));
    } catch {
      canPersist = false;
    }
    draw();
  }

  function sync() {
    if (!key || !pageActive || document.visibilityState !== "visible" || !document.hasFocus()
        || document.querySelector("dialog[open]") || !canPlay()) {
      pause();
    } else if (startedAt === null) {
      elapsed = savedTime();
      startedAt = performance.now();
      interval = setInterval(draw, 250);
      draw();
    }
  }

  const dialogs = new MutationObserver(sync);
  for (const dialog of document.querySelectorAll("dialog")) {
    dialogs.observe(dialog, { attributes: true, attributeFilter: ["open"] });
  }
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("focus", sync);
  window.addEventListener("blur", pause);
  window.addEventListener("storage", event => {
    if (event.key !== key) return;
    elapsed = savedTime();
    draw();
  });
  window.addEventListener("pagehide", () => {
    pageActive = false;
    pause();
  });
  window.addEventListener("pageshow", () => {
    pageActive = true;
    sync();
  });

  return {
    load(attemptKey) {
      pause();
      key = attemptKey;
      elapsed = 0;
      canPersist = true;
      elapsed = savedTime();
      draw();
      sync();
    },
    reset() {
      pause();
      elapsed = 0;
      try {
        localStorage.removeItem(key);
        canPersist = true;
      } catch {
        canPersist = false;
      }
      draw();
      sync();
    },
  };
}
