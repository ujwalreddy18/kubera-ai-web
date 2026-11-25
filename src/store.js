const STORAGE_KEY = 'kubera-ai-prototype-v1';

export function createStore(seedFactory) {
  let state = load(seedFactory);
  const subscribers = new Set();

  function load(factory) {
    const seed = factory();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...seed,
          ...parsed,
          auth: { ...seed.auth, ...(parsed.auth || {}) },
          ui: { ...seed.ui, ...(parsed.ui || {}) },
          settings: { ...seed.settings, ...(parsed.settings || {}) },
          adminSecurity: { ...seed.adminSecurity, ...(parsed.adminSecurity || {}) },
          adminHealth: { ...seed.adminHealth, ...(parsed.adminHealth || {}) }
        };
      }
    } catch (error) {
      console.warn('Unable to restore local prototype state', error);
    }
    return seed;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function notify() {
    persist();
    subscribers.forEach((subscriber) => subscriber(state));
  }

  return {
    getState: () => state,
    update(mutator) {
      const next = structuredClone(state);
      mutator(next);
      state = next;
      notify();
    },
    reset() {
      state = seedFactory();
      notify();
    },
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    }
  };
}
