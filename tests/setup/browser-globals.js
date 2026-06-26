/**
 * @fileoverview Minimal browser globals for Node unit tests.
 * Import this module before production code that expects `window`, `document`, or Web Storage.
 */

if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
  };
}

if (typeof globalThis.sessionStorage === 'undefined' || typeof globalThis.sessionStorage.getItem !== 'function') {
  globalThis.sessionStorage = globalThis.localStorage;
}

if (typeof globalThis.location === 'undefined') {
  globalThis.location = {
    hostname: 'localhost',
    href: 'http://localhost/',
    pathname: '/',
    search: '',
    hash: '',
  };
}

if (typeof globalThis.navigator === 'undefined') {
  globalThis.navigator = { userAgent: 'node-test' };
}

function createElementStub() {
  return {
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    dataset: {},
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    textContent: '',
    innerHTML: '',
    value: '',
    focus: () => {},
    click: () => {},
  };
}

const elementStub = createElementStub();

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => createElementStub(),
    body: elementStub,
    head: elementStub,
    documentElement: elementStub,
  };
} else if (!globalThis.document.head) {
  globalThis.document.head = elementStub;
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis;
}
