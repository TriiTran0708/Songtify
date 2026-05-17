// Small theme helper used by pages that don't run the full app bundle.
export function applySavedTheme() {
  try {
    let t = localStorage.getItem('theme');
    // Default to 'dark' when no preference exists
    if (!t) {
      t = 'dark';
      try { localStorage.setItem('theme', t); } catch(e) {}
    }
    if (t === 'light') document.documentElement.classList.add('light-mode');
    else document.documentElement.classList.remove('light-mode');
  } catch (e) {
    // ignore (localStorage may be unavailable in some contexts)
  }
}

export function setThemeLight(isLight) {
  if (isLight) document.documentElement.classList.add('light-mode');
  else document.documentElement.classList.remove('light-mode');
  try { localStorage.setItem('theme', isLight ? 'light' : 'dark'); } catch(e) {}
}
