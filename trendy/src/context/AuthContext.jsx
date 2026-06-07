import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  getAuthToken,
  getStoredUser,
  getStoredStoreId,
  getActiveStore,
  storeLogin as apiStoreLogin,
  storeLogout as apiStoreLogout,
  persistAuthSession,
} from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [storeId, setStoreId] = useState(() => getStoredStoreId());
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedUser = getStoredUser();
    const id = getStoredStoreId() || getActiveStore(storedUser)?.id || null;
    if (id) setStoreId(id);
  }, []);

  const login = useCallback(async ({ email, password, storeCode }) => {
    setIsLoading(true);
    try {
      const data = await apiStoreLogin({ email, password, storeCode });
      const authUser = data.user;
      const store = getActiveStore(authUser);
      setUser(authUser);
      setStoreId(authUser.store_id ?? store?.id ?? null);
      setIsAuthenticated(true);
      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiStoreLogout();
    setUser(null);
    setStoreId(null);
    setIsAuthenticated(false);
  }, []);

  const updateStoreInSession = useCallback((storeData) => {
    if (!user) return;
    const owned = user.owned_stores || user.ownedStores || [];
    const updatedOwned = owned.map((s) => (s.id === storeData.id ? { ...s, ...storeData } : s));
    const nextUser = {
      ...user,
      owned_stores: updatedOwned.length ? updatedOwned : user.owned_stores,
      ownedStores: updatedOwned.length ? updatedOwned : user.ownedStores,
    };
    persistAuthSession({ token: getAuthToken(), user: nextUser });
    setUser(nextUser);
  }, [user]);

  const store = useMemo(() => getActiveStore(user), [user]);

  const value = useMemo(
    () => ({
      user,
      store,
      storeId,
      isAuthenticated,
      isLoading,
      login,
      logout,
      updateStoreInSession,
    }),
    [user, store, storeId, isAuthenticated, isLoading, login, logout, updateStoreInSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
