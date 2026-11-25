import { gameProgress } from "./progress.js";

export function mountSession() {
  const toolbar = document.querySelector("[data-player-session]");
  const dialog = document.querySelector("#login-dialog");
  const registerDialog = document.querySelector("#register-dialog");
  const profileDialog = document.querySelector("#profile-dialog");
  const profileForm = profileDialog.querySelector("form");
  const profileStatus = profileDialog.querySelector("[data-session-status]");
  const trigger = toolbar.querySelector("[data-player-trigger]");
  const options = toolbar.querySelector("#player-options");
  const avatar = toolbar.querySelector(".player-avatar");
  const name = toolbar.querySelector("[data-player-name]");
  const login = toolbar.querySelector("[data-player-login]");
  const logout = toolbar.querySelector("[data-player-logout]");
  const toolbarStatus = toolbar.querySelector("[data-player-status]");
  const dialogStatus = dialog.querySelector("[data-session-status]");
  const guestKey = "archivo-nocturno:continue-as-guest";
  let busy = false;

  function showStatus(element, message = "") {
    element.textContent = message;
    element.hidden = !message;
  }

  function render() {
    const username = gameProgress.username;
    const { display_name, avatar_color } = gameProgress.appearance;
    name.textContent = display_name;
    avatar.style.setProperty("--avatar-color", avatar_color);
    trigger.setAttribute("aria-label", `Opciones de usuario de ${display_name}`);
    login.hidden = Boolean(username);
    logout.hidden = !username;
  }

  function setOptions(open) {
    options.hidden = !open;
    trigger.setAttribute("aria-expanded", String(open));
  }

  trigger.addEventListener("click", () => setOptions(options.hidden));
  document.addEventListener("click", event => {
    if (!toolbar.contains(event.target)) setOptions(false);
  });
  toolbar.addEventListener("keydown", event => {
    if (event.key === "Escape" && !options.hidden) {
      setOptions(false);
      trigger.focus();
    }
  });

  function openDialog() {
    setOptions(false);
    showStatus(dialogStatus);
    dialog.showModal();
  }

  function markGuest(confirmed) {
    try {
      if (confirmed) sessionStorage.setItem(guestKey, "1");
      else sessionStorage.removeItem(guestKey);
    } catch {
      // The current page remains playable when session storage is unavailable.
    }
  }

  function continueAsGuest() {
    markGuest(true);
    dialog.close();
  }

  document.addEventListener("gameprogress", render);
  document.addEventListener("gameprogresserror", () => {
    showStatus(toolbarStatus, "No se pudo sincronizar el progreso.");
  });
  gameProgress.ready.then(() => {
    render();
    let guestConfirmed = false;
    try {
      guestConfirmed = sessionStorage.getItem(guestKey) === "1";
    } catch {
      // Show the welcome dialog when the previous choice is unavailable.
    }
    if (!gameProgress.username && !guestConfirmed && !dialog.open) openDialog();
  });

  login.addEventListener("click", openDialog);
  toolbar.querySelector("[data-player-customize]").addEventListener("click", () => {
    setOptions(false);
    const { display_name, avatar_color } = gameProgress.appearance;
    profileForm.elements.display_name.value = display_name;
    profileForm.elements.avatar_color.value = avatar_color;
    showStatus(profileStatus);
    profileDialog.showModal();
  });
  profileForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const { display_name, avatar_color } = Object.fromEntries(new FormData(profileForm));
    if (!display_name.trim()) {
      showStatus(profileStatus, "Escribe un nombre visible.");
      profileForm.elements.display_name.focus();
      return;
    }
    busy = true;
    const buttons = profileForm.querySelectorAll("button");
    for (const button of buttons) button.disabled = true;
    showStatus(profileStatus);
    try {
      await gameProgress.customize({ display_name: display_name.trim(), avatar_color });
      profileDialog.close();
    } catch (error) {
      showStatus(profileStatus, error.message || "No se pudo guardar el perfil.");
    } finally {
      busy = false;
      for (const button of buttons) button.disabled = false;
    }
  });
  profileDialog.querySelector("[data-close-profile]").addEventListener("click", () => profileDialog.close());
  profileDialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  profileDialog.addEventListener("close", () => trigger.focus());
  dialog.querySelector("[data-play-guest]").addEventListener("click", continueAsGuest);
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    if (!busy) continueAsGuest();
  });
  function backToLogin() {
    registerDialog.querySelector("form").reset();
    registerDialog.close();
    openDialog();
  }

  dialog.querySelector("[data-open-register]").addEventListener("click", () => {
    dialog.close();
    showStatus(registerDialog.querySelector("[data-session-status]"));
    registerDialog.showModal();
  });
  registerDialog.querySelector("[data-back-login]").addEventListener("click", backToLogin);
  registerDialog.addEventListener("cancel", event => {
    event.preventDefault();
    if (!busy) backToLogin();
  });

  async function submitCredentials(event, action, activeDialog) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const { username, password, confirmation } = Object.fromEntries(new FormData(form));
    const status = activeDialog.querySelector("[data-session-status]");
    if (action === "register" && password !== confirmation) {
      showStatus(status, "Las contraseñas deben coincidir.");
      form.elements.confirmation.focus();
      return;
    }
    const buttons = form.querySelectorAll("button");
    busy = true;
    for (const button of buttons) button.disabled = true;
    showStatus(status);
    showStatus(toolbarStatus);
    try {
      await gameProgress.authenticate(action, { username, password });
      markGuest(false);
      form.reset();
      dialog.querySelector("form").reset();
      activeDialog.close();
      trigger.focus();
    } catch (error) {
      showStatus(status, error instanceof TypeError ? "No se pudo conectar con el servidor." : error.message);
    } finally {
      busy = false;
      for (const button of buttons) button.disabled = false;
    }
  }

  dialog.querySelector("form").addEventListener("submit", event => submitCredentials(event, "login", dialog));
  registerDialog.querySelector("form").addEventListener("submit", event => submitCredentials(event, "register", registerDialog));
  logout.addEventListener("click", async () => {
    logout.disabled = true;
    showStatus(toolbarStatus);
    try {
      await gameProgress.logout();
      trigger.focus();
      openDialog();
    } catch {
      showStatus(toolbarStatus, "No se pudo cerrar sesión. Inténtalo de nuevo.");
    } finally {
      logout.disabled = false;
    }
  });
}
