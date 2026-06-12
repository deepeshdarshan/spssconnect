/**
 * @fileoverview Injects a sticky hamburger bar and wires an off-canvas admin sidebar at ≤992px.
 * Uses `body.admin-shell-drawer-open` for open state; pairs with `04-admin-shell-mobile-drawer.css`.
 * @module admin-shell-mobile-drawer
 */

import * as Logger from '../utils/logger.js';

/** Matches the admin responsive breakpoint in `04-admin-shell-mobile-drawer.css`. */
const ADMIN_SHELL_DRAWER_MEDIA = '(max-width: 992px)';

/** Stable id for `aria-controls` / sidebar targeting. */
const SIDEBAR_ID = 'adminShellSidebar';

/**
 * Relative logo URL when the sidebar brand `<img>` is missing (kept in sync with shell HTML).
 * Resolved with `window.location` so it works if the app is hosted under a path prefix.
 */
const ADMIN_SHELL_MOBILE_LOGO_FALLBACK_SRC = 'assets/logo.png';

/**
 * @returns {boolean} Whether the sidebar participates in layout (not `display: none`).
 * @param {HTMLElement} sidebar
 */
function isSidebarParticipating(sidebar) {
  try {
    return window.getComputedStyle(sidebar).display !== 'none';
  } catch (err) {
    Logger.error('admin-shell-mobile-drawer: compute sidebar display', err);
    return false;
  }
}

/**
 * @returns {string} Short label for the mobile top bar (from `document.title`).
 */
function resolveTopbarTitle() {
  const raw = String(document.title ?? '').trim();
  if (!raw) return 'SPSS Connect';
  const parts = raw.split(/\s[—–-]\s/);
  return parts[0]?.trim() || raw;
}

/**
 * Resolves the mobile top bar logo `src` from the sidebar brand link, with a static fallback.
 *
 * @param {HTMLElement} sidebar
 * @returns {string}
 */
function resolveTopbarLogoSrc(sidebar) {
  const brandImg = sidebar.querySelector('.dashboard-brand img');
  const src = brandImg instanceof HTMLImageElement ? brandImg.getAttribute('src') : null;
  if (src && src.trim()) {
    try {
      return new URL(src, window.location.href).href;
    } catch (err) {
      Logger.warn('admin-shell-mobile-drawer: invalid brand img src, using fallback', err);
    }
  }
  try {
    return new URL(ADMIN_SHELL_MOBILE_LOGO_FALLBACK_SRC, window.location.href).href;
  } catch (err) {
    Logger.error('admin-shell-mobile-drawer: logo URL resolution failed', err);
    return ADMIN_SHELL_MOBILE_LOGO_FALLBACK_SRC;
  }
}

/**
 * Resolves accessible name for the top bar logo (matches sidebar brand img alt when set).
 *
 * @param {HTMLElement} sidebar
 * @returns {string}
 */
function resolveTopbarLogoAlt(sidebar) {
  const brandImg = sidebar.querySelector('.dashboard-brand img');
  if (brandImg instanceof HTMLImageElement) {
    const a = String(brandImg.getAttribute('alt') ?? '').trim();
    if (a) return a;
  }
  return 'SPSS';
}

/**
 * @param {HTMLElement} sidebar
 */
function ensureSidebarId(sidebar) {
  if (!sidebar.id) {
    sidebar.id = SIDEBAR_ID;
  }
}

/**
 * When the viewport is in the drawer range, reflect whether the panel is on-screen for assistive tech.
 * On wider viewports, clears `aria-hidden` so the sticky desktop sidebar is not hidden incorrectly.
 *
 * @param {HTMLElement} sidebar
 * @param {boolean} drawerOpen Whether the off-canvas drawer is open.
 * @param {MediaQueryList} mq
 */
function syncSidebarAriaHidden(sidebar, drawerOpen, mq) {
  if (!mq.matches) {
    sidebar.removeAttribute('aria-hidden');
    return;
  }
  sidebar.setAttribute('aria-hidden', drawerOpen ? 'false' : 'true');
}

/**
 * @param {HTMLButtonElement} toggleBtn
 * @param {boolean} drawerOpen
 */
function setToggleUi(toggleBtn, drawerOpen) {
  toggleBtn.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
  toggleBtn.setAttribute('aria-label', drawerOpen ? 'Close admin navigation menu' : 'Open admin navigation menu');
}

/**
 * @param {HTMLElement} sidebar
 * @param {HTMLButtonElement} toggleBtn
 * @param {boolean} drawerOpen
 * @param {MediaQueryList} mq
 */
function setDrawerOpen(sidebar, toggleBtn, drawerOpen, mq) {
  document.body.classList.toggle('admin-shell-drawer-open', drawerOpen);
  setToggleUi(toggleBtn, drawerOpen);
  syncSidebarAriaHidden(sidebar, drawerOpen, mq);
}

/**
 * @param {HTMLElement} sidebar
 * @param {HTMLElement} backdrop
 * @param {HTMLButtonElement} toggleBtn
 * @param {MediaQueryList} mq
 */
function closeDrawer(sidebar, backdrop, toggleBtn, mq) {
  setDrawerOpen(sidebar, toggleBtn, false, mq);
  backdrop.setAttribute('aria-hidden', 'true');
  try {
    toggleBtn.focus();
  } catch {
    /* focus can fail if detached */
  }
}

/**
 * @param {HTMLElement} sidebar
 * @param {HTMLElement} backdrop
 * @param {HTMLButtonElement} toggleBtn
 * @param {MediaQueryList} mq
 */
function openDrawer(sidebar, backdrop, toggleBtn, mq) {
  setDrawerOpen(sidebar, toggleBtn, true, mq);
  backdrop.setAttribute('aria-hidden', 'false');
  const firstLink = sidebar.querySelector('#dashboardNav a[href]');
  if (firstLink instanceof HTMLElement) {
    window.requestAnimationFrame(() => {
      try {
        firstLink.focus();
      } catch {
        /* ignore */
      }
    });
  }
}

/**
 * @returns {HTMLElement}
 */
function createBackdrop() {
  const el = document.createElement('div');
  el.className = 'dashboard-shell-drawer-backdrop';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/**
 * @param {HTMLElement} sidebar
 * @returns {{ bar: HTMLElement; toggleBtn: HTMLButtonElement }}
 */
function createTopbar(sidebar) {
  const bar = document.createElement('header');
  bar.className = 'dashboard-mobile-shell-topbar';
  bar.setAttribute('role', 'banner');

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'dashboard-mobile-shell-menu-btn';
  toggleBtn.setAttribute('aria-controls', sidebar.id);
  setToggleUi(toggleBtn, false);
  const icon = document.createElement('i');
  icon.className = 'bi bi-list';
  icon.setAttribute('aria-hidden', 'true');
  toggleBtn.appendChild(icon);

  const logo = document.createElement('img');
  logo.className = 'dashboard-mobile-shell-topbar-logo';
  logo.src = resolveTopbarLogoSrc(sidebar);
  logo.alt = resolveTopbarLogoAlt(sidebar);
  logo.setAttribute('decoding', 'async');
  logo.setAttribute('loading', 'lazy');

  const title = document.createElement('span');
  title.className = 'dashboard-mobile-shell-topbar-title';
  title.textContent = resolveTopbarTitle();

  bar.appendChild(toggleBtn);
  bar.appendChild(logo);
  bar.appendChild(title);
  return { bar, toggleBtn };
}

/**
 * Wires toggle, backdrop, Escape, nav link navigation, and viewport breakpoint cleanup.
 *
 * @param {HTMLElement} sidebar
 * @param {HTMLElement} backdrop
 * @param {HTMLButtonElement} toggleBtn
 * @param {MediaQueryList} mq
 */
function bindDrawerInteractions(sidebar, backdrop, toggleBtn, mq) {
  const nav = document.getElementById('dashboardNav');

  const onToggleClick = () => {
    const open = !document.body.classList.contains('admin-shell-drawer-open');
    if (open) {
      openDrawer(sidebar, backdrop, toggleBtn, mq);
    } else {
      closeDrawer(sidebar, backdrop, toggleBtn, mq);
    }
  };

  const onBackdropClick = () => {
    closeDrawer(sidebar, backdrop, toggleBtn, mq);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('admin-shell-drawer-open')) {
      e.preventDefault();
      closeDrawer(sidebar, backdrop, toggleBtn, mq);
    }
  };

  const onNavClick = (e) => {
    const a = e.target instanceof Element ? e.target.closest('a') : null;
    if (!a || !nav || !nav.contains(a)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    closeDrawer(sidebar, backdrop, toggleBtn, mq);
  };

  const onMqChange = () => {
    if (!mq.matches) {
      closeDrawer(sidebar, backdrop, toggleBtn, mq);
    } else {
      syncSidebarAriaHidden(sidebar, document.body.classList.contains('admin-shell-drawer-open'), mq);
    }
  };

  toggleBtn.addEventListener('click', onToggleClick);
  backdrop.addEventListener('click', onBackdropClick);
  document.addEventListener('keydown', onKeyDown);
  if (nav) {
    nav.addEventListener('click', onNavClick);
  }
  mq.addEventListener('change', onMqChange);
}

/**
 * Injects mobile drawer UI when the admin sidebar is visible and the main column exists.
 * Idempotent per `.dashboard-main` via `data-admin-shell-mobile-drawer`.
 *
 * **Side effects:** may set `sidebar.id`, prepend a sticky top bar into `.dashboard-main`,
 * append a full-screen backdrop to `document.body`, register `click` / `keydown` / `change`
 * listeners (document, toggle, backdrop, nav), and toggle `body.admin-shell-drawer-open`
 * when the user opens or closes the drawer.
 *
 * @returns {void}
 */
export function initAdminShellMobileDrawer() {
  const main = document.querySelector('.dashboard-main');
  const sidebar = document.querySelector('.dashboard-sidebar');
  if (!main || !sidebar || main.dataset.adminShellMobileDrawer === '1') {
    return;
  }
  if (!isSidebarParticipating(sidebar)) {
    return;
  }

  try {
    ensureSidebarId(sidebar);
    const mq = window.matchMedia(ADMIN_SHELL_DRAWER_MEDIA);

    const backdrop = createBackdrop();
    const { bar, toggleBtn } = createTopbar(sidebar);

    main.insertBefore(bar, main.firstChild);
    document.body.appendChild(backdrop);

    bindDrawerInteractions(sidebar, backdrop, toggleBtn, mq);
    setDrawerOpen(sidebar, toggleBtn, false, mq);
    backdrop.setAttribute('aria-hidden', 'true');

    main.dataset.adminShellMobileDrawer = '1';
  } catch (err) {
    Logger.error('admin-shell-mobile-drawer: init failed', err);
  }
}
