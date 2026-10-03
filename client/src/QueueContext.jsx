import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { seed, STATE_VERSION } from './mockData.js';
import { actions } from './queueLogic.js';

// One shared store for every screen, so user and admin views always agree.
// It is saved in localStorage (never passwords) and syncs between tabs: sign in
// as the admin in one tab and as the user in another to watch "Serve next" live.
const STORAGE_KEY = 'queuesmart_demo_v3';

const QueueContext = createContext(null);

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.v === STATE_VERSION) return saved;
  } catch {
    // Storage blocked or corrupt: start from the seed data.
  }
  return seed();
}

export function QueueProvider({ children }) {
  const [state, setState] = useState(load);
  // Latest state, so an action can return its message synchronously.
  const latest = useRef(state);

  useEffect(() => {
    latest.current = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Not saved; the demo still works for this page load.
    }
  }, [state]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        latest.current = next;
        setState(next);
      } catch {
        // Ignore a bad value written by another tab.
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Each action runs on a copy of the state and returns its toast message, if any.
  const run =
    (name) =>
    (...args) => {
      const draft = structuredClone(latest.current);
      const message = actions[name](draft, ...args);
      latest.current = draft;
      setState(draft);
      return message;
    };

  const value = {
    state,
    join: run('join'),
    leave: run('leave'),
    serveNext: run('serveNext'),
    move: run('move'),
    moveTo: run('moveTo'),
    removeVisitor: run('removeVisitor'),
    toggleOpen: run('toggleOpen'),
    saveService: run('saveService'),
    deleteService: run('deleteService'),
    updateHistory: run('updateHistory'),
    clearUpdates: run('clearUpdates'),
    markUpdateRead: run('markUpdateRead'),
    markAllUpdatesRead: run('markAllUpdatesRead'),
    dismissTicket: run('dismissTicket'),
    markCelebrated: run('markCelebrated'),
    resetDemo: () => {
      latest.current = seed();
      setState(latest.current);
    },
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueues() {
  return useContext(QueueContext);
}
