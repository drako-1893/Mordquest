"use strict";

const gameProgress = (() => {
  const prefix = "archivo-nocturno:completed:";
  let username = null;
  let completed = read("guest");
  let queue = Promise.resolve();
  let sessionChecked = false;

  function read(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(prefix + key));
      return Array.isArray(saved) ? saved.filter(level => typeof level === "string") : [];
    } catch {
      return [];
    }
  }

  function write(key, levels) {
    try {
      localStorage.setItem(prefix + key, JSON.stringify(levels));
      return true;
    } catch {
      return false;
    }
  }

  function merge(...lists) {
    return [...new Set(lists.flat())];
  }

  function accept(profile) {
    username = profile.username;
    const key = username ? "account:" + username : "guest";
    completed = merge(read(key), profile.completed);
    write(key, completed);
    document.dispatchEvent(new Event("gameprogress"));
  }

  async function request(path, method = "GET", data) {
    const response = await fetch("/api/" + path, {
      method,
      headers: { "Content-Type": "application/json", "X-Game-Request": "1" },
      body: data && JSON.stringify(data),
    });
    if (response.ok) return response.status === 204 ? null : response.json();
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : "No se pudo completar la operación.");
  }

  async function sync() {
    if (username) accept(await request("progress", "PUT", { username, completed }));
  }

  function run(action) {
    const result = queue.then(action);
    queue = result.catch(() => {});
    return result;
  }

  function reportSyncError() {
    document.dispatchEvent(new Event("gameprogresserror"));
  }

  const ready = run(async () => {
    try {
      accept(await request("session"));
    } finally {
      sessionChecked = true;
    }
    if (username) await sync();
  }).catch(reportSyncError);

  window.addEventListener("online", () => run(sync).catch(reportSyncError));
  window.addEventListener("storage", event => {
    if (event.key === prefix + (username ? "account:" + username : "guest")) {
      completed = merge(completed, read(event.key.slice(prefix.length)));
      document.dispatchEvent(new Event("gameprogress"));
    }
  });

  return {
    ready,
    get username() { return username; },
    has(level) { return completed.includes(level); },
    complete(level) {
      function saveCompletion() {
        const key = username ? "account:" + username : "guest";
        completed = merge(read(key), completed, [level]);
        const saved = write(key, completed);
        document.dispatchEvent(new Event("gameprogress"));
        if (!username && !saved) {
          throw new Error("El navegador no pudo guardar el progreso.");
        }
      }
      let savedImmediately = false;
      if (sessionChecked) {
        try {
          saveCompletion();
          savedImmediately = true;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      return run(async () => {
        if (!savedImmediately) saveCompletion();
        await sync();
      });
    },
    authenticate(action, credentials) {
      return run(async () => {
        const guest = merge(read("guest"), username ? [] : completed);
        accept(await request("auth/" + action, "POST", { ...credentials, completed: guest }));
        write("guest", read("guest").filter(level => !guest.includes(level)));
        await sync().catch(reportSyncError);
      });
    },
    logout() {
      return run(async () => {
        await request("logout", "POST");
        accept({ username: null, completed: [] });
      });
    },
  };
})();
