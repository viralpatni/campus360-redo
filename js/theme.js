(function () {
  const THEME_KEY = "campus360Theme";

  function getIconSvg(mode) {
    if (mode === "dark") {
      return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffd700" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    }
    return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f62fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path></svg>';
  }

  function applyMode(opts, mode) {
    const body = opts.body || document.body;
    const lightClass = opts.lightClass || null;
    const darkClass = opts.darkClass || null;

    body.setAttribute("data-theme", mode);
    body.classList.toggle("theme-light", mode === "light");
    body.classList.toggle("theme-dark", mode === "dark");

    if (lightClass) {
      body.classList.toggle(lightClass, mode === "light");
    }
    if (darkClass) {
      body.classList.toggle(darkClass, mode === "dark");
    }

    const toggle = document.getElementById(opts.toggleId);
    const icon = document.getElementById(opts.iconId);
    if (toggle && icon) {
      icon.innerHTML = getIconSvg(mode);
      toggle.setAttribute(
        "aria-label",
        mode === "dark" ? "Switch to light mode" : "Switch to dark mode",
      );
    }

    if (typeof opts.onChange === "function") {
      opts.onChange(mode);
    }
  }

  function initToggle(options) {
    const opts = {
      defaultMode: "light",
      ...options,
    };

    const toggle = document.getElementById(opts.toggleId);
    if (!toggle) return;

    const saved = localStorage.getItem(THEME_KEY);
    const mode =
      saved === "dark" || saved === "light" ? saved : opts.defaultMode;
    applyMode(opts, mode);

    toggle.addEventListener("click", () => {
      const current = localStorage.getItem(THEME_KEY) || mode;
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyMode(opts, next);
    });
  }

  window.CampusTheme = {
    key: THEME_KEY,
    initToggle,
    applyMode,
  };
})();
