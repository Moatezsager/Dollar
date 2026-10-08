try {
  const theme = localStorage.getItem('colorTheme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch {
  // Embedded browsers may deny persistent storage.
}
