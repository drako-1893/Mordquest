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
