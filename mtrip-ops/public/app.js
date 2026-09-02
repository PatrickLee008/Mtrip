function syncControls() {
  const theme = localStorage.getItem('mtrip-ops-theme') || 'glass';
  const density = localStorage.getItem('mtrip-ops-density') || 'dense';
  document.body.dataset.theme = theme;
  document.body.dataset.density = density;
  const themeSelect = document.querySelector('[data-theme-select]');
  const densitySelect = document.querySelector('[data-density-select]');
  if (themeSelect) themeSelect.value = theme;
  if (densitySelect) densitySelect.value = density;
}

document.addEventListener('DOMContentLoaded', syncControls);
document.addEventListener('change', (event) => {
  const themeSelect = event.target.closest('[data-theme-select]');
  if (themeSelect) {
    localStorage.setItem('mtrip-ops-theme', themeSelect.value);
    document.body.dataset.theme = themeSelect.value;
  }

  const densitySelect = event.target.closest('[data-density-select]');
  if (densitySelect) {
    localStorage.setItem('mtrip-ops-density', densitySelect.value);
    document.body.dataset.density = densitySelect.value;
  }
});
