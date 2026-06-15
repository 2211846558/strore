import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  getAuthToken,
  getStoredUser,
  getStoredStoreId,
  getActiveStore,
  resolveManagedStoreId,
  storeHasActivePlan,
  storeLogin as apiStoreLogin,
  storeLogout as apiStoreLogout,
  fetchCurrentUser,
  persistAuthSession,
  AUTH_UNAUTHORIZED_EVENT,
} from '../api/auth';

const AuthStateContext = createContext(null);
const StoreContext = createContext(null);
const AuthActionsContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [storeId, setStoreId] = useState(() => resolveManagedStoreId(getStoredUser()) ?? getStoredStoreId());
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [isLoading, setIsLoading] = useState(false);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    const storedUser = getStoredUser();
    const id = resolveManagedStoreId(storedUser) || null;
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
        const id = resolveManagedStoreId(freshUser);
        if (id) setStoreId(id);
      })
      .catch(() => {
        setUser(null);
        setStoreId(null);
        setIsAuthenticated(false);
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
      const authUser = data.user;
      const store = getActiveStore(authUser);
      setUser(authUser);
      setStoreId(resolveManagedStoreId(authUser) ?? store?.id ?? null);
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
    const currentUser = userRef.current;
    if (!currentUser) return;

    const targetId = storeData.id ?? currentUser.store_id ?? getStoredStoreId();
    if (!targetId) return;

    const patch = { ...storeData, id: targetId };
    const owned = currentUser.owned_stores || currentUser.ownedStores || [];
    let updatedOwned = owned.map((s) => (s.id === targetId ? { ...s, ...patch } : s));

    if (!updatedOwned.some((s) => s.id === targetId)) {
      updatedOwned = [patch, ...updatedOwned];
    }

    const shouldUpdatePrimary =
      !currentUser.store || currentUser.store.id === targetId || currentUser.store_id === targetId;
    const nextStore = shouldUpdatePrimary ? { ...(currentUser.store || {}), ...patch } : currentUser.store;

    const nextUser = {
      ...currentUser,
      store_id: targetId,
      store: nextStore,
      owned_stores: updatedOwned,
      ownedStores: updatedOwned,
    };

    persistAuthSession({ token: getAuthToken(), user: nextUser });
    setUser(nextUser);
  }, []);

  const refreshSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return null;

    const freshUser = await fetchCurrentUser();
    if (!freshUser) return null;

    persistAuthSession({ token, user: freshUser });
    setUser(freshUser);

    const id = resolveManagedStoreId(freshUser);
    if (id) setStoreId(id);

    return freshUser;
  }, []);

  const store = useMemo(() => getActiveStore(user), [user]);
  const hasActivePlan = useMemo(() => storeHasActivePlan(store), [store]);

  const authStateValue = useMemo(
    () => ({ user, isAuthenticated, isLoading }),
    [user, isAuthenticated, isLoading]
  );

  const storeValue = useMemo(
    () => ({ store, storeId, hasActivePlan }),
    [store, storeId, hasActivePlan]
  );

  const actionsValue = useMemo(
    () => ({ login, logout, updateStoreInSession, refreshSession }),
    [login, logout, updateStoreInSession, refreshSession]
  );

  return (
    <AuthStateContext.Provider value={authStateValue}>
      <StoreContext.Provider value={storeValue}>
        <AuthActionsContext.Provider value={actionsValue}>
          {children}
        </AuthActionsContext.Provider>
      </StoreContext.Provider>
    </AuthStateContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthStateContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within AuthProvider');
  return ctx;
};

export const useAuthActions = () => {
  const ctx = useContext(AuthActionsContext);
  if (!ctx) throw new Error('useAuthActions must be used within AuthProvider');
  return ctx;
};
