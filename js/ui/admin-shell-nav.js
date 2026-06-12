/**
 * @fileoverview Highlights the correct items in the shared admin left nav (#dashboardNav)
 * using [data-nav] keys. Run after role classes are applied (app-init).
 * @module admin-shell-nav
 */

/**
 * Resolves which nav keys should appear active for the current URL.
 * @returns {{ primary: string|null, sub: string|null }}
 */
function resolveAdminNavKeys() {
  const path = window.location.pathname;
  const q = new URLSearchParams(window.location.search);

  if (path.includes('advanced-member-search')) {
    return { primary: 'member_mgmt', sub: 'member_search' };
  }
  if (path.includes('member-management')) {
    return { primary: 'member_mgmt', sub: 'member_list' };
  }
  if (path.includes('phone-check')) {
    return { primary: 'member_mgmt', sub: 'phone_check' };
  }
  if (path.includes('create')) {
    return { primary: 'member_mgmt', sub: null };
  }
  if (path.includes('view')) {
    return { primary: 'member_mgmt', sub: 'member_list' };
  }
  if (path.includes('user-management')) {
    return { primary: 'administration', sub: 'user_management' };
  }
  if (path.includes('admin-contacts')) {
    return { primary: 'administration', sub: 'admin_contacts' };
  }
  if (path.includes('jilla-membership')) {
    return { primary: 'administration', sub: 'jilla_membership' };
  }
  if (path.includes('admin-dashboard')) {
    const s = q.get('section');
    if (s === 'statistics') {
      return { primary: 'statistics', sub: null };
    }
    if (s === 'members') {
      return { primary: 'member_mgmt', sub: null };
    }
    if (s === 'administration') {
      return { primary: 'administration', sub: null };
    }
    return { primary: 'overview', sub: null };
  }
  return { primary: null, sub: null };
}

/**
 * Sets aria-current and .active on matching [data-nav] links in the admin sidebar.
 */
export function initAdminShellNav() {
  const nav = document.getElementById('dashboardNav');
  if (!nav) return;

  const { primary, sub } = resolveAdminNavKeys();
  const activeKeys = new Set();
  if (primary) activeKeys.add(primary);
  if (sub) activeKeys.add(sub);

  nav.querySelectorAll('[data-nav]').forEach((el) => {
    const key = el.getAttribute('data-nav');
    const on = key && activeKeys.has(key);
    el.classList.toggle('active', Boolean(on));
    if (on && el.tagName === 'A') {
      el.setAttribute('aria-current', 'page');
    } else {
      el.removeAttribute('aria-current');
    }
  });
}
