import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  getAuthToken,
  getStoredUser,
  getStoredStoreId,
  getActiveStore,
  storeHasActivePlan,
  storeLogin as apiStoreLogin,
  storeLogout as apiStoreLogout,
  fetchCurrentUser,
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

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    fetchCurrentUser()
      .then((freshUser) => {
        if (!freshUser) return;
        persistAuthSession({ token, user: freshUser });
        setUser(freshUser);
        const id = freshUser.store_id ?? getActiveStore(freshUser)?.id ?? null;
        if (id) setStoreId(id);
      })
      .catch(() => {
        // التوكن منتهٍ — تبقى الجلسة المحلية حتى يفشل طلب لاحق
      });
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

    const targetId = storeData.id ?? user.store_id ?? getStoredStoreId();
    if (!targetId) return;

    const patch = { ...storeData, id: targetId };
    const owned = user.owned_stores || user.ownedStores || [];
    let updatedOwned = owned.map((s) => (s.id === targetId ? { ...s, ...patch } : s));

    if (!updatedOwned.some((s) => s.id === targetId)) {
      updatedOwned = [patch, ...updatedOwned];
    }

    const shouldUpdatePrimary =
      !user.store || user.store.id === targetId || user.store_id === targetId;
    const nextStore = shouldUpdatePrimary ? { ...(user.store || {}), ...patch } : user.store;

    const nextUser = {
      ...user,
      store_id: targetId,
      store: nextStore,
      owned_stores: updatedOwned,
      ownedStores: updatedOwned,
    };

    persistAuthSession({ token: getAuthToken(), user: nextUser });
    setUser(nextUser);
  }, [user]);

  const refreshSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return null;

    const freshUser = await fetchCurrentUser();
    if (!freshUser) return null;

    persistAuthSession({ token, user: freshUser });
    setUser(freshUser);

    const id = freshUser.store_id ?? getActiveStore(freshUser)?.id ?? null;
    if (id) setStoreId(id);

    return freshUser;
  }, []);

  const store = useMemo(() => getActiveStore(user), [user]);
  const hasActivePlan = useMemo(() => storeHasActivePlan(store), [store]);

  const value = useMemo(
    () => ({
      user,
      store,
      storeId,
      hasActivePlan,
      isAuthenticated,
      isLoading,
      login,
      logout,
      updateStoreInSession,
      refreshSession,
    }),
    [user, store, storeId, hasActivePlan, isAuthenticated, isLoading, login, logout, updateStoreInSession, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
