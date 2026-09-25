import { createContext, useContext, useEffect, useState } from 'react';
import { createMockState } from './mockData.js';
import { actions } from './queueLogic.js';

// Holds the mock queue data for the whole app. It is saved in localStorage so
// it survives page reloads, and syncs between tabs: log in as the admin in one
// tab and as the user in another to watch "Serve next" update the user's screen.
const STORAGE_KEY = 'queuesmart_mock_state_v1';

const QueueContext = createContext(null);

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // Storage blocked or corrupt: fall back to fresh demo data.
  }
  return createMockState();
}

export function QueueProvider({ children }) {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Not saved; the app still works for this page load.
    }
  }, [state]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        setState(JSON.parse(event.newValue));
      } catch {
        // Ignore a bad value written by another tab.
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Each action gets a copy of the state to change, so React sees a new object.
  const run =
    (name) =>
    (...args) =>
      setState((prev) => {
        const draft = structuredClone(prev);
        actions[name](draft, ...args);
        return draft;
      });

  const value = {
    state,
    joinQueue: run('joinQueue'),
    leaveQueue: run('leaveQueue'),
    serveNext: run('serveNext'),
    moveEntry: run('moveEntry'),
    removeEntry: run('removeEntry'),
    setServiceOpen: run('setServiceOpen'),
    addService: run('addService'),
    updateService: run('updateService'),
    markNotificationsRead: run('markNotificationsRead'),
    resetDemoData: () => setState(createMockState()),
  };

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueues() {
  return useContext(QueueContext);
}
