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

const writer = newDraftId();

function newDraftId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function draftVersions(key) {
  const current = readDraft(key);
  try {
    return Object.keys(localStorage)
      .filter(slot => slot.startsWith(`${key}:version:`))
      .map(slot => ({ slot, draft: readDraft(slot) }))
      .filter(({ draft }) => draft && draft.id !== current?.id)
      .sort((first, second) => second.draft.savedAt - first.draft.savedAt);
  } catch {
    return [];
  }
}

export function stampDraft(draft) {
  return { ...draft, id: newDraftId(), savedAt: Date.now() };
}

function write(key, draft) {
  localStorage.setItem(key, JSON.stringify(draft));
}

function lockDraft(key, action) {
  return navigator.locks?.request(key, action) ?? Promise.resolve().then(action);
}

function archive(key, draft) {
  if (draft) write(`${key}:version:${draft.id ?? "legacy"}`, { ...draft, id: draft.id ?? "legacy" });
}

export async function saveDraftVersion(key, draft, expected, { preserve = false, choice, pending } = {}) {
  const copy = `${key}:version:${writer}`;
  const previous = readDraft(copy);
  const pendingFrom = previous && previous.id === expected ? previous.pendingFrom : expected;
  // Persist this tab's revision before competing for the shared draft.
  write(copy, { ...draft, pendingFrom, pendingExpected: expected });
  return lockDraft(key, () => {
    const current = readDraft(key);
    if (!choice && (current?.id ?? null) !== expected) return false;
    if (preserve || choice) archive(key, current);
    write(key, draft);
    const source = choice ?? pending;
    if (source && readDraft(source.slot)?.id === source.draft.id) localStorage.removeItem(source.slot);
    if (navigator.locks && readDraft(copy)?.id === draft.id) localStorage.removeItem(copy);
    return true;
  });
}

export function pendingDraft(key, expected) {
  const versions = draftVersions(key);
  if (versions.length !== 1) return null;
  const [version] = versions;
  return version.draft.pendingFrom === expected || version.draft.pendingExpected === expected ? version : null;
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
