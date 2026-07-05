import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import {
  getAuthToken,
  getStoredUser,
  getStoredStoreId,
  getActiveStore,
  resolveManagedStoreId,
  storeHasActivePlan,
  userIsStoreStaff,
  storeLogin as apiStoreLogin,
  storeLogout as apiStoreLogout,
  fetchCurrentUser,
  persistAuthSession,
  AUTH_UNAUTHORIZED_EVENT,
} from '../api/auth';
import { enrichUserWithSubscription } from '../api/plans';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [storeId, setStoreId] = useState(() => resolveManagedStoreId(getStoredUser()) ?? getStoredStoreId());
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [isLoading, setIsLoading] = useState(false);
  const [planChecking, setPlanChecking] = useState(() => Boolean(getAuthToken()));

  useEffect(() => {
    const storedUser = getStoredUser();
    const id = resolveManagedStoreId(storedUser) || null;
    if (id) setStoreId(id);
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setPlanChecking(false);
      return;
    }

    fetchCurrentUser()
      .then(async (freshUser) => {
        if (!freshUser) return;
        const enrichedUser = await enrichUserWithSubscription(freshUser);
        persistAuthSession({ token, user: enrichedUser });
        setUser(enrichedUser);
        const id = resolveManagedStoreId(enrichedUser);
        if (id) setStoreId(id);
      })
      .catch(() => {
        setUser(null);
        setStoreId(null);
        setIsAuthenticated(false);
      })
      .finally(() => {
        setPlanChecking(false);
      });
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setStoreId(null);
      setIsAuthenticated(false);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const login = useCallback(async ({ email, password, storeCode }) => {
    setIsLoading(true);
    try {
      const data = await apiStoreLogin({ email, password, storeCode });
      const authUser = await enrichUserWithSubscription(data.user);
      const store = getActiveStore(authUser);
      persistAuthSession({ token: data.token, user: authUser });
      setUser(authUser);
      setStoreId(resolveManagedStoreId(authUser) ?? store?.id ?? null);
      setIsAuthenticated(true);
      return { ...data, user: authUser };
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

    const enrichedUser = await enrichUserWithSubscription(freshUser);
    persistAuthSession({ token, user: enrichedUser });
    setUser(enrichedUser);

    const id = resolveManagedStoreId(enrichedUser);
    if (id) setStoreId(id);

    return enrichedUser;
  }, []);

  const store = useMemo(() => getActiveStore(user), [user]);
  const hasActivePlan = useMemo(() => {
    if (userIsStoreStaff(user)) {
      return true;
    }
    return storeHasActivePlan(store);
  }, [store, user]);

  const value = useMemo(
    () => ({
      user,
      store,
      storeId,
      hasActivePlan,
      planChecking,
      isAuthenticated,
      isLoading,
      login,
      logout,
      updateStoreInSession,
      refreshSession,
    }),
    [user, store, storeId, hasActivePlan, planChecking, isAuthenticated, isLoading, login, logout, updateStoreInSession, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const useStore = () => {
  const { store, storeId, hasActivePlan, planChecking } = useAuth();
  return { store, storeId, hasActivePlan, planChecking };
};

export const useAuthActions = () => {
  const { login, logout, updateStoreInSession, refreshSession } = useAuth();
  return { login, logout, updateStoreInSession, refreshSession };
};
