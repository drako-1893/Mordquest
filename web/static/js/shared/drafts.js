export function draftKey(username, levelId) {
  const profile = username ? "account:" + username : "guest";
  return "archivo-nocturno:draft:" + profile + ":" + levelId;
}

export function readDraft(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

export function hasSavedDraft(username) {
  const prefix = draftKey(username, "");
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix) || key.includes(":", prefix.length)) continue;
      if (Number.isInteger(readDraft(key)?.size)) return true;
    }
  } catch {
    // A saved draft cannot be checked when storage is unavailable.
  }
  return false;
}
