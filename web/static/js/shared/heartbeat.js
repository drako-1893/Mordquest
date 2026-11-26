const heartbeatInterval = 5 * 60 * 1000;
let lastRequest = Date.now();
let timer;

function scheduleHeartbeat() {
  window.clearTimeout(timer);
  if (document.visibilityState !== "visible") return;

  const remaining = Math.max(0, heartbeatInterval - (Date.now() - lastRequest));
  timer = window.setTimeout(sendHeartbeat, remaining);
}

function sendHeartbeat() {
  if (document.visibilityState !== "visible") return;

  lastRequest = Date.now();
  fetch("/api/heartbeat", { cache: "no-store", credentials: "omit" }).catch(() => {
    // A temporary connection failure is retried on the next interval.
  });
  scheduleHeartbeat();
}

document.addEventListener("visibilitychange", scheduleHeartbeat);
window.addEventListener("pageshow", scheduleHeartbeat);
scheduleHeartbeat();
