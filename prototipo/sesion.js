"use strict";

(() => {
  const toolbar = document.querySelector("[data-player-session]");
  toolbar.innerHTML = `
    <span data-player-name hidden></span>
    <button type="button" data-player-login hidden>Iniciar sesión</button>
    <button type="button" data-player-logout hidden>Cerrar sesión</button>
    <span data-player-status role="status" hidden></span>
  `;
  const dialog = document.createElement("dialog");
  dialog.className = "session-dialog";
  dialog.setAttribute("aria-labelledby", "session-title");
  dialog.innerHTML = `
    <h2 id="session-title">Bienvenido a Archivo Nocturno</h2>
    <p>Inicia sesión para sincronizar tu progreso o juega como invitado.</p>
    <form method="post">
      <label>Usuario <input name="username" autocomplete="username" required
        minlength="3" maxlength="24" pattern="[A-Za-z0-9_\\-]{3,24}" autofocus></label>
      <label>Contraseña <input name="password" type="password" autocomplete="current-password"
        required></label>
      <p data-session-status role="status" hidden></p>
      <div class="session-actions">
        <button class="session-primary">Iniciar sesión</button>
        <button type="button" data-open-register>Crear cuenta</button>
      </div>
      <button type="button" data-play-guest>Jugar como invitado</button>
    </form>
  `;
  const registerDialog = document.createElement("dialog");
  registerDialog.className = "session-dialog";
  registerDialog.setAttribute("aria-labelledby", "register-title");
  registerDialog.innerHTML = `
    <h2 id="register-title">Crear cuenta</h2>
    <form method="post">
      <label>Usuario <input name="username" autocomplete="username" required
        minlength="3" maxlength="24" pattern="[A-Za-z0-9_\\-]{3,24}" autofocus></label>
      <label>Contraseña <input name="password" type="password" autocomplete="new-password" required></label>
      <label>Repite la contraseña <input name="confirmation" type="password" autocomplete="new-password" required></label>
      <p data-session-status role="status" hidden></p>
      <div class="session-actions">
        <button class="session-primary">Crear cuenta</button>
        <button type="button" data-back-login>Volver a iniciar sesión</button>
      </div>
    </form>
  `;
  document.body.append(dialog, registerDialog);

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
    name.textContent = username || "";
    name.hidden = !username;
    login.hidden = Boolean(username);
    logout.hidden = !username;
  }

  function openDialog() {
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
      logout.focus();
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
      login.focus();
      openDialog();
    } catch {
      showStatus(toolbarStatus, "No se pudo cerrar sesión. Inténtalo de nuevo.");
    } finally {
      logout.disabled = false;
    }
  });
})();
