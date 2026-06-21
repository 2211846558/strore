import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  getAuthToken,
  getStoredUser,
  getStoredStoreId,
  getActiveStore,
  resolveStoreForUser,
  resolveManagedStoreId,
  storeSubscriptionExpired,
  clearLocalSubscriptionDates,
  verifyStorePlanActive,
  storeLogin as apiStoreLogin,
  storeLogout as apiStoreLogout,
  fetchCurrentUser,
  persistAuthSession,
  AUTH_UNAUTHORIZED_EVENT,
} from '../api/auth';
import { resolveStorePlanAccess } from '../api/plans';
import { useCurrentUser } from '../api/hooks/useAuth';

const AuthStateContext = createContext(null);
const StoreContext = createContext(null);
const AuthActionsContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [storeId, setStoreId] = useState(() => resolveManagedStoreId(getStoredUser()) ?? getStoredStoreId());
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getAuthToken()));
  const [isLoading, setIsLoading] = useState(false);
  const [planChecking, setPlanChecking] = useState(() => Boolean(getAuthToken()));
  const [planAccessActive, setPlanAccessActive] = useState(null);
  const userRef = useRef(user);
  userRef.current = user;

  const { data: freshUser, isSuccess, isError } = useCurrentUser();

  useEffect(() => {
    const storedUser = getStoredUser();
    const id = resolveManagedStoreId(storedUser) || null;
    if (id) setStoreId(id);
  }, []);

  useEffect(() => {
    if (isSuccess && freshUser) {
      persistAuthSession({ token: getAuthToken(), user: freshUser });
      setUser(freshUser);
      const id = resolveManagedStoreId(freshUser);
      if (id) setStoreId(id);
    } else if (isError) {
      setUser(null);
      setStoreId(null);
      setIsAuthenticated(false);
    }
  }, [isSuccess, isError, freshUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setStoreId(null);
      setIsAuthenticated(false);
      setPlanAccessActive(null);
      setPlanChecking(false);
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  const applyPlanAccessResult = useCallback((result, targetStoreId) => {
    if (result?.active === true) {
      setPlanAccessActive(true);
      return;
    }

    if (result?.active === false) {
      setPlanAccessActive(false);
      if (
        targetStoreId &&
        (result.reason === 'subscription_expired' || result.reason === 'no_subscription')
      ) {
        clearLocalSubscriptionDates(targetStoreId);
      }
    }
  }, []);

  const checkPlanAccess = useCallback(async (targetStoreId, { withLoader = false } = {}) => {
    if (!targetStoreId) {
      setPlanAccessActive(false);
      setPlanChecking(false);
      return;
    }

    if (withLoader) setPlanChecking(true);
    try {
      const currentStore = resolveStoreForUser(userRef.current, targetStoreId);

      const [apiResult, subscriptionResult] = await Promise.all([
        verifyStorePlanActive(targetStoreId),
        resolveStorePlanAccess(currentStore, targetStoreId),
      ]);

      // تواريخ الاشتراك من API/S سجل الخطط — مصدر الحقيقة لمنع الدخول للداشبورد
      if (!subscriptionResult.active) {
        applyPlanAccessResult(
          {
            active: false,
            reason: subscriptionResult.reason ?? 'subscription_expired',
          },
          targetStoreId,
        );
        return;
      }

      if (apiResult.active === false) {
        applyPlanAccessResult(
          {
            active: false,
            reason: apiResult.reason ?? subscriptionResult.reason ?? 'subscription_expired',
          },
          targetStoreId,
        );
        return;
      }

      setPlanAccessActive(true);
    } catch {
      setPlanAccessActive(false);
    } finally {
      if (withLoader) setPlanChecking(false);
    }
  }, [applyPlanAccessResult]);

  useEffect(() => {
    if (!isAuthenticated || !storeId) {
      setPlanAccessActive(isAuthenticated ? false : null);
      setPlanChecking(false);
      return undefined;
    }

    checkPlanAccess(storeId, { withLoader: true });
    return undefined;
  }, [isAuthenticated, storeId, checkPlanAccess]);

  const login = useCallback(async ({ email, password, storeCode }) => {
    setIsLoading(true);
    try {
      const data = await apiStoreLogin({ email, password, storeCode });
      const authUser = data.user;
      const store = getActiveStore(authUser);
      setUser(authUser);
      setStoreId(resolveManagedStoreId(authUser) ?? store?.id ?? null);
      setIsAuthenticated(true);
      setPlanChecking(true);
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
    setPlanAccessActive(null);
    setPlanChecking(false);
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

  const store = useMemo(() => resolveStoreForUser(user, storeId), [user, storeId]);
  const hasActivePlan = planAccessActive === true && !planChecking;
  const subscriptionExpired = useMemo(
    () => !hasActivePlan && storeSubscriptionExpired(store, storeId),
    [hasActivePlan, store, storeId],
  );

  const authStateValue = useMemo(
    () => ({ user, isAuthenticated, isLoading }),
    [user, isAuthenticated, isLoading]
  );

  const storeValue = useMemo(
    () => ({ store, storeId, hasActivePlan, subscriptionExpired, planChecking }),
    [store, storeId, hasActivePlan, subscriptionExpired, planChecking]
  );

  const actionsValue = useMemo(
    () => ({ login, logout, updateStoreInSession, refreshSession, refreshPlanAccess: checkPlanAccess }),
    [login, logout, updateStoreInSession, refreshSession, checkPlanAccess]
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
