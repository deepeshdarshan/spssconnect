/**
 * Synchronous pre-paint hook: restores admin / super-admin body classes from sessionStorage
 * so the admin shell CSS matches before first paint (avoids sidebar FOUC).
 *
 * Loaded as a classic script (not type="module") so it runs immediately after the body opens.
 *
 * Storage key must match SESSION_KEY_ROLE_UI in js/constants/constants.js.
 */
(function applyRoleUiHintClassesFromSession() {
  try {
    var key = 'spss_role_ui';
    var raw = sessionStorage.getItem(key);
    if (!raw) return;
    var o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return;
    if (o.admin) {
      document.body.classList.add('is-admin');
      if (document.body.classList.contains('phone-check-page')) {
        document.body.classList.add('phone-check-admin-shell');
      }
    }
    if (o.superAdmin) {
      document.body.classList.add('is-super-admin');
    }
  } catch {
    /* Corrupt or unreadable session hint — leave default body classes */
  }
})();
