import { gameProgress, guestOnly } from "./progress.js";
import { pageLoadingFinished } from "./loading.js";

export function mountSession() {
  const toolbar = document.querySelector("[data-player-session]");
  const dialog = document.querySelector("#login-dialog");
  const registerDialog = document.querySelector("#register-dialog");
  const loginForm = dialog.querySelector("form");
  const registerForm = registerDialog.querySelector("form");
  const profileDialog = document.querySelector("#profile-dialog");
  const profileForm = profileDialog.querySelector("form");
  const profileStatus = profileDialog.querySelector("[data-session-status]");
  const trigger = toolbar.querySelector("[data-player-trigger]");
  const options = toolbar.querySelector("#player-options");
  const avatar = toolbar.querySelector(".player-avatar");
  const name = toolbar.querySelector("[data-player-name]");
  const role = toolbar.querySelector("[data-player-role]");
  const resourcesLink = document.querySelector("[data-admin-resources]");
  const login = toolbar.querySelector("[data-player-login]");
  const logout = toolbar.querySelector("[data-player-logout]");
  const toolbarStatus = toolbar.querySelector("[data-player-status]");
  const dialogStatus = dialog.querySelector("[data-session-status]");
  const guestKey = "archivo-nocturno:continue-as-guest";
  let busy = false;

  function showStatus(element, message = "", pending = false) {
    element.toggleAttribute("data-pending", pending);
    element.textContent = message;
    element.hidden = !message;
  }

  function render() {
    const username = gameProgress.username;
    const isAdmin = gameProgress.role === "admin";
    const { display_name, avatar_color } = gameProgress.appearance;
    name.textContent = display_name;
    role.hidden = !isAdmin;
    if (resourcesLink) resourcesLink.hidden = !isAdmin;
    avatar.style.setProperty("--avatar-color", avatar_color);
    trigger.setAttribute("aria-label", `Opciones de usuario de ${display_name}${isAdmin ? ", administrador" : ""}`);
    login.hidden = guestOnly || Boolean(username);
    logout.hidden = !username;
    if (username && !busy) {
      const authDialog = dialog.open ? dialog : registerDialog;
      if (authDialog.open) {
        resetCredentials(authDialog === dialog ? loginForm : registerForm);
        authDialog.close();
        trigger.focus();
      }
    }
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

  function setPasswordVisibility(form, visible) {
    const toggle = form.querySelector("[data-password-toggle]");
    const label = visible ? "Ocultar" : "Mostrar";
    const ids = toggle.getAttribute("aria-controls").split(" ");
    for (const id of ids) {
      document.getElementById(id).type = visible ? "text" : "password";
    }
    toggle.textContent = label;
    toggle.setAttribute("aria-label", `${label} contraseña${ids.length > 1 ? "s" : ""}`);
  }

  for (const form of [loginForm, registerForm]) {
    const toggle = form.querySelector("[data-password-toggle]");
    toggle.addEventListener("click", () => setPasswordVisibility(form, form.elements.password.type === "password"));
  }

  function resetCredentials(form) {
    form.reset();
    setPasswordVisibility(form, false);
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
    resetCredentials(loginForm);
    dialog.close();
    trigger.focus();
  }

  document.addEventListener("gameprogress", render);
  document.addEventListener("gameprogresserror", () => {
    showStatus(toolbarStatus, "No se pudo sincronizar el progreso.");
  });
  const welcomeFinished = Promise.all([gameProgress.ready, pageLoadingFinished]).then(() => {
    render();
    if (guestOnly) return;
    let guestConfirmed = false;
    try {
      guestConfirmed = sessionStorage.getItem(guestKey) === "1";
    } catch {
      // Show the welcome dialog when the previous choice is unavailable.
    }
    if (gameProgress.username || guestConfirmed) return;
    if (!dialog.open) openDialog();
    return new Promise(resolve => {
      function finishWelcome() {
        if (dialog.open || registerDialog.open) return;
        dialog.removeEventListener("close", finishWelcome);
        registerDialog.removeEventListener("close", finishWelcome);
        resolve();
      }
      dialog.addEventListener("close", finishWelcome);
      registerDialog.addEventListener("close", finishWelcome);
    });
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
    showStatus(profileStatus, "Guardando perfil…", true);
    try {
      await gameProgress.customize({ display_name: display_name.trim(), avatar_color });
      showStatus(profileStatus);
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
    loginForm.elements.username.value = registerForm.elements.username.value;
    resetCredentials(registerForm);
    registerDialog.close();
    openDialog();
  }

  dialog.querySelector("[data-open-register]").addEventListener("click", () => {
    registerForm.elements.username.value = loginForm.elements.username.value;
    resetCredentials(loginForm);
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
    const fields = form.querySelectorAll("input");
    busy = true;
    for (const button of buttons) button.disabled = true;
    for (const field of fields) field.readOnly = true;
    showStatus(status, action === "login" ? "Iniciando sesión…" : "Creando cuenta…", true);
    showStatus(toolbarStatus);
    try {
      await gameProgress.authenticate(action, { username, password });
      markGuest(false);
      resetCredentials(form);
      showStatus(status);
      activeDialog.close();
      trigger.focus();
    } catch (error) {
      let message = error.message || "No se pudo completar la operación.";
      if (error instanceof TypeError) message = "No se pudo conectar con el servidor. Inténtalo de nuevo.";
      if (error.name === "TimeoutError") message = "La conexión tardó demasiado. Inténtalo de nuevo.";
      showStatus(status, message);
      const field = action === "login" ? form.elements.password : form.elements.username;
      field.focus();
    } finally {
      busy = false;
      for (const field of fields) field.readOnly = false;
      for (const button of buttons) button.disabled = false;
    }
  }

  loginForm.addEventListener("submit", event => submitCredentials(event, "login", dialog));
  registerForm.addEventListener("submit", event => submitCredentials(event, "register", registerDialog));
  logout.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    setOptions(false);
    trigger.focus();
    trigger.disabled = true;
    showStatus(toolbarStatus, "Cerrando sesión…", true);
    try {
      await gameProgress.logout();
      showStatus(toolbarStatus);
      openDialog();
    } catch {
      showStatus(toolbarStatus, "No se pudo cerrar sesión. Inténtalo de nuevo.");
    } finally {
      busy = false;
      trigger.disabled = false;
      if (!dialog.open) trigger.focus();
    }
  });
  return welcomeFinished;
}
