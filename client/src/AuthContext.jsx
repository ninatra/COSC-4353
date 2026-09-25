import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On page load, restore the session from a saved token.
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  function saveSession({ token, user }) {
    tokenStore.set(token);
    setUser(user);
    return user;
  }

  const value = {
    user,
    loading,
    login: (email, password) =>
      api('/auth/login', { method: 'POST', body: { email, password } }).then(saveSession),
    register: (form) => api('/auth/register', { method: 'POST', body: form }).then(saveSession),
    logout: () => {
      tokenStore.clear();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
