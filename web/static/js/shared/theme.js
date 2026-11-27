(() => {
  const storageKey = "archivo-nocturno:theme";
  const root = document.documentElement;

  try {
    if (localStorage.getItem(storageKey) === "light") root.dataset.theme = "light";
  } catch {
    // Keep the default when the browser blocks storage.
  }

  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.querySelector(".theme-toggle");
    if (!toggle) return;

    function updateToggle() {
      const light = root.dataset.theme === "light";
      toggle.setAttribute("aria-pressed", String(light));
      toggle.title = light ? "Activar modo oscuro" : "Activar modo claro";
    }

    updateToggle();
    toggle.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      updateToggle();
      try {
        localStorage.setItem(storageKey, root.dataset.theme);
      } catch {
        // The toggle still works on the current page.
      }
    });
  }, { once: true });
})();
