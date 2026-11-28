const guestOnly = document.body.hasAttribute("data-guest-only");

const gameProgress = (() => {
  const prefix = "archivo-nocturno:completed:";
  const guestPreferences = "archivo-nocturno:guest-profile";
  const sessionChangeKey = "archivo-nocturno:session-change";
  const defaultColor = "#f1ca92";
  const localTutorials = new Set();
  let username = null;
  let role = null;
  let accountTutorialSeen = false;
  let appearance = readAppearance();
  let completed = read("guest");
  let queue = Promise.resolve();

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

  function tutorialKey(player) {
    return "archivo-nocturno:tutorial:" + (player ? "account:" + player : "guest");
  }

  function hasLocalTutorial(player) {
    if (localTutorials.has(player)) return true;
    try {
      return localStorage.getItem(tutorialKey(player)) === "1";
    } catch {
      return false;
    }
  }

  function readAppearance() {
    try {
      const saved = JSON.parse(localStorage.getItem(guestPreferences));
      if (typeof saved?.display_name === "string" && /^#[0-9a-f]{6}$/i.test(saved.avatar_color)) return saved;
    } catch {
      // A guest can start with the default appearance when storage is unavailable.
    }
    return { display_name: "Invitado", avatar_color: defaultColor };
  }

  function accept(profile) {
    username = profile.username;
    role = profile.role ?? null;
    accountTutorialSeen = profile.tutorial_seen === true;
    appearance = username ? {
      display_name: profile.display_name ?? username,
      avatar_color: profile.avatar_color ?? defaultColor,
    } : readAppearance();
    const key = username ? "account:" + username : "guest";
    completed = merge(read(username ? "pending:" + username : "guest"), profile.completed);
    write(key, completed);
    document.dispatchEvent(new Event("gameprogress"));
  }

  async function request(path, method = "GET", data) {
    const response = await fetch("/api/" + path, {
      method,
      headers: { "Content-Type": "application/json", "X-Game-Request": "1" },
      body: data && JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return response.status === 204 ? null : response.json();
    const error = await response.json().catch(() => ({}));
    throw new Error(typeof error.detail === "string" ? error.detail : "No se pudo completar la operación.");
  }

  async function sync(extra = []) {
    if (!username) return;
    const key = "pending:" + username;
    const pending = merge(read(key), extra);
    if (!pending.length) return;
    const profile = await request("progress", "PUT", { username, completed: pending });
    write(key, read(key).filter(level => !pending.includes(level)));
    accept(profile);
  }

  function run(action) {
    const result = queue.then(action);
    queue = result.catch(() => {});
    return result;
  }

  function reportSyncError() {
    document.dispatchEvent(new Event("gameprogresserror"));
  }

  async function refreshSession() {
    if (!guestOnly) accept(await request("session"));
  }

  function notifySessionChange() {
    try {
      localStorage.setItem(sessionChangeKey, String(Date.now()));
    } catch {
      // The current tab still has the new session when storage is unavailable.
    }
  }

  const ready = run(async () => {
    await refreshSession();
    if (username) await sync();
  }).catch(reportSyncError);

  window.addEventListener("online", () => run(sync).catch(reportSyncError));
  window.addEventListener("storage", event => {
    if (event.key === sessionChangeKey) run(refreshSession).catch(reportSyncError);
    if (!username && event.key === guestPreferences) {
      appearance = readAppearance();
      document.dispatchEvent(new Event("gameprogress"));
    }
    if (event.key === prefix + (username ? "account:" + username : "guest")) {
      completed = read(event.key.slice(prefix.length));
      document.dispatchEvent(new Event("gameprogress"));
    }
  });
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    accept({
      username, role, ...appearance,
      completed: read(username ? "account:" + username : "guest"),
      tutorial_seen: accountTutorialSeen,
    });
    run(refreshSession).catch(reportSyncError);
  });

  return {
    ready,
    get username() { return username; },
    get role() { return role; },
    get appearance() { return appearance; },
    get tutorialSeen() { return accountTutorialSeen || hasLocalTutorial(username); },
    get hasCompletedLevels() { return completed.length > 0; },
    rememberTutorial() {
      if (accountTutorialSeen) return;
      const player = username;
      if (!hasLocalTutorial(player)) {
        localTutorials.add(player);
        try {
          localStorage.setItem(tutorialKey(player), "1");
        } catch {
          // Keep the choice for the current page when storage is unavailable.
        }
      }
      if (player) {
        void run(async () => {
          if (username !== player || accountTutorialSeen) return;
          await request("tutorial", "PUT", { username: player });
          accountTutorialSeen = true;
        }).catch(reportSyncError);
      }
    },
    customize(preferences) {
      return run(async () => {
        if (username) {
          accept(await request("profile", "PUT", { username, ...preferences }));
        } else {
          localStorage.setItem(guestPreferences, JSON.stringify(preferences));
          appearance = preferences;
          document.dispatchEvent(new Event("gameprogress"));
        }
      });
    },
    has(level) { return completed.includes(level); },
    complete(level, savedProfile) {
      return run(async () => {
        if (savedProfile) {
          if (savedProfile.username === username) {
            const key = "pending:" + username;
            write(key, read(key).filter(id => id !== level));
            accept(savedProfile);
          } else {
            accept(await request("session"));
          }
          return;
        }
        const key = username ? "account:" + username : "guest";
        const next = merge(read(key), completed, [level]);
        if (!username && !write(key, next)) throw new Error("El navegador no pudo guardar el progreso.");
        if (username) write("pending:" + username, merge(read("pending:" + username), [level]));
        completed = next;
        if (username) write(key, completed);
        document.dispatchEvent(new Event("gameprogress"));
        if (username) {
          await sync([level]);
        }
      });
    },
    authenticate(action, credentials) {
      return run(async () => {
        const guest = merge(read("guest"), username ? [] : completed);
        accept(await request("auth/" + action, "POST", { ...credentials, completed: guest }));
        notifySessionChange();
        write("guest", read("guest").filter(level => !guest.includes(level)));
        await sync().catch(reportSyncError);
      });
    },
    logout() {
      return run(async () => {
        await request("logout", "POST");
        accept({ username: null, completed: [] });
        notifySessionChange();
      });
    },
  };
})();

export { gameProgress, guestOnly };
