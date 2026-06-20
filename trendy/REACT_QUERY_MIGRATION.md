# React Query Migration — Trendy Store

## Overview
Migrate the custom fetch+cache layer to TanStack React Query for better performance, deduplication, and developer experience.

**Strategy:** Incremental migration — no breaking changes, each phase is independently testable.

---

## Phase 0: Setup (No existing code changes)

### 0.1 Install
```bash
npm install @tanstack/react-query
npm install -D @tanstack/react-query-devtools
```

### 0.2 Create `src/api/queryClient.js`
```js
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

### 0.3 Update `src/main.jsx`
```jsx
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from './api/queryClient'

createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
)
```

---

## Phase 1: Create Hooks Layer (New files only — originals untouched)

### 1.1 `src/api/hooks/useApi.js` — Base utility
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../client'

export function useApiQuery({ key, path, options = {}, queryOptions = {} }) {
  return useQuery({
    queryKey: Array.isArray(key) ? key : [key],
    queryFn: () => apiRequest(path, options),
    ...queryOptions,
  })
}

export function useApiMutation({ path, options = {}, invalidateKeys = [] }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => apiRequest(path, { ...options, body }),
    onSuccess: () => {
      invalidateKeys.forEach(key =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    },
  })
}
```

### 1.2 `src/api/hooks/useAuth.js`
```js
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  storeLogin, storeLogout, fetchCurrentUser, verifyStoreJoin,
  forgotPassword, verifyPasswordOtp, resetPassword,
} from '../auth'

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeLogin,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currentUser'] }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: storeLogout,
    onSuccess: () => qc.clear(),
  })
}

export { fetchCurrentUser as fetchCurrentUserFn }
```

### 1.3 `src/api/hooks/useDashboard.js`
```js
import { useQuery } from '@tanstack/react-query'
import { fetchStoreDashboard, fetchDashboardStats } from '../dashboard'

export function useDashboard(storeId) {
  return useQuery({
    queryKey: ['dashboard', storeId],
    queryFn: () => fetchStoreDashboard({ storeId }),
    staleTime: 15 * 1000,
  })
}

export function useDashboardStats(storeId) {
  return useQuery({
    queryKey: ['dashboardStats', storeId],
    queryFn: () => fetchDashboardStats({ storeId }),
    staleTime: 15 * 1000,
  })
}
```

### 1.4 `src/api/hooks/useProducts.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchStoreProducts, createProduct, updateProduct,
  archiveProduct, restoreProduct, deleteProductVariant,
  fetchCategories, fetchAttributes,
} from '../products'

const PRODUCTS_KEY = 'products'
const CATEGORIES_KEY = 'categories'
const ATTRIBUTES_KEY = 'attributes'

export function useProducts(filters = {}) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, filters],
    queryFn: () => fetchStoreProducts(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCategories() {
  return useQuery({
    queryKey: [CATEGORIES_KEY],
    queryFn: fetchCategories,
    staleTime: 60 * 60 * 1000,
  })
}

export function useAttributes() {
  return useQuery({
    queryKey: [ATTRIBUTES_KEY],
    queryFn: () => fetchAttributes(),
    staleTime: 60 * 60 * 1000,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] }),
  })
}

export function useUpdateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateProduct(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] })
      qc.invalidateQueries({ queryKey: ['productDetails'] })
    },
  })
}

export function useArchiveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: archiveProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] }),
  })
}

export function useRestoreProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: restoreProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PRODUCTS_KEY] }),
  })
}
```

### 1.5 `src/api/hooks/useOrders.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchOrders, fetchOrder, updateOrderStatus, cancelOrder,
  prepareOrder, confirmOrderDelivery,
} from '../orders'

const ORDERS_KEY = 'orders'

export function useOrders(filters = {}) {
  return useQuery({
    queryKey: [ORDERS_KEY, filters],
    queryFn: () => fetchOrders(filters),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useOrder(id) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => fetchOrder(id),
    enabled: Boolean(id),
  })
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, comment }) => updateOrderStatus(id, status, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

export function useCancelOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }) => cancelOrder(id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

export function usePrepareOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id) => prepareOrder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}

export function useConfirmDelivery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: confirmOrderDelivery,
    onSuccess: () => qc.invalidateQueries({ queryKey: [ORDERS_KEY] }),
  })
}
```

### 1.6 `src/api/hooks/useInventory.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchInventory, fetchShipments, createShipment, updateShipment,
  adjustInventory, archiveShipment,
} from '../inventory'

const INVENTORY_KEY = 'inventory'
const SHIPMENTS_KEY = 'shipments'

export function useInventory(filters = {}) {
  return useQuery({
    queryKey: [INVENTORY_KEY, filters],
    queryFn: () => fetchInventory(filters),
    staleTime: 30 * 1000,
  })
}

export function useShipments(filters = {}, forceRefresh = false) {
  return useQuery({
    queryKey: [SHIPMENTS_KEY, filters],
    queryFn: () => fetchShipments(filters, forceRefresh),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createShipment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [SHIPMENTS_KEY] })
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
    },
  })
}

export function useUpdateShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateShipment(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [SHIPMENTS_KEY] }),
  })
}

export function useAdjustInventory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adjustInventory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [INVENTORY_KEY] })
      qc.invalidateQueries({ queryKey: [SHIPMENTS_KEY] })
    },
  })
}
```

### 1.7 `src/api/hooks/useFinance.js`
```js
import { useQuery } from '@tanstack/react-query'
import {
  fetchRevenueOverview, fetchProfitOverview, fetchTransactions,
  fetchAccountStatement,
} from '../finance'

export function useRevenueOverview(filters = {}) {
  return useQuery({
    queryKey: ['revenueOverview', filters],
    queryFn: () => fetchRevenueOverview(filters),
    staleTime: 30 * 1000,
  })
}

export function useProfitOverview(filters = {}) {
  return useQuery({
    queryKey: ['profitOverview', filters],
    queryFn: () => fetchProfitOverview(filters),
    staleTime: 30 * 1000,
  })
}

export function useTransactions(filters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  })
}

export function useAccountStatement(filters = {}) {
  return useQuery({
    queryKey: ['accountStatement', filters],
    queryFn: () => fetchAccountStatement(filters),
    staleTime: 30 * 1000,
  })
}
```

### 1.8 `src/api/hooks/useWallet.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWalletBalance, getStoreWalletBalance, chargeStoreWallet, withdrawStoreWallet } from '../wallet'

const WALLET_KEY = 'wallet'

export function useWalletBalance() {
  return useQuery({
    queryKey: [WALLET_KEY],
    queryFn: () => getStoreWalletBalance(),
    staleTime: 30 * 1000,
  })
}

export function useChargeWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: chargeStoreWallet,
    onSuccess: () => qc.invalidateQueries({ queryKey: [WALLET_KEY] }),
  })
}

export function useWithdrawWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: withdrawStoreWallet,
    onSuccess: () => qc.invalidateQueries({ queryKey: [WALLET_KEY] }),
  })
}
```

### 1.9 `src/api/hooks/usePos.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPosInit, fetchPosCart, addToPosCart, removeFromPosCart, checkoutPosCart } from '../pos'

const POS_CART_KEY = 'posCart'

export function usePosInit() {
  return useQuery({
    queryKey: ['posInit'],
    queryFn: fetchPosInit,
    staleTime: 15 * 1000,
  })
}

export function usePosCart() {
  return useQuery({
    queryKey: [POS_CART_KEY],
    queryFn: fetchPosCart,
    staleTime: 15 * 1000,
  })
}

export function useAddToCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addToPosCart,
    onSuccess: () => qc.invalidateQueries({ queryKey: [POS_CART_KEY] }),
  })
}

export function useRemoveFromCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeFromPosCart,
    onSuccess: () => qc.invalidateQueries({ queryKey: [POS_CART_KEY] }),
  })
}

export function useCheckoutCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: checkoutPosCart,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POS_CART_KEY] })
      qc.invalidateQueries({ queryKey: ['posInit'] })
    },
  })
}
```

### 1.10 `src/api/hooks/useNotifications.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchNotifications, markAsRead, markAllAsRead } from '../notifications'

const NOTIF_KEY = 'notifications'

export function useNotifications(filters = {}) {
  return useQuery({
    queryKey: [NOTIF_KEY, filters],
    queryFn: () => fetchNotifications(filters),
    staleTime: 30 * 1000,
  })
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIF_KEY] }),
  })
}

export function useMarkAllAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: [NOTIF_KEY] }),
  })
}
```

### 1.11 `src/api/hooks/useEmployees.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchEmployees, createEmployee, updateEmployee, toggleEmployee } from '../employees'

const EMP_KEY = 'employees'

export function useEmployees(filters = {}) {
  return useQuery({
    queryKey: [EMP_KEY, filters],
    queryFn: () => fetchEmployees(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: [EMP_KEY] }),
  })
}

export function useUpdateEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateEmployee(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [EMP_KEY] }),
  })
}

export function useToggleEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: toggleEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: [EMP_KEY] }),
  })
}
```

### 1.12 `src/api/hooks/usePromotions.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPromotions, createPromotion, updatePromotion, deletePromotion, togglePromotion } from '../promotions'

const PROMO_KEY = 'promotions'

export function usePromotions(filters = {}) {
  return useQuery({
    queryKey: [PROMO_KEY, filters],
    queryFn: () => fetchPromotions(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createPromotion,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMO_KEY] }),
  })
}

export function useTogglePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: togglePromotion,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMO_KEY] }),
  })
}

export function useDeletePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deletePromotion,
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROMO_KEY] }),
  })
}
```

### 1.13 `src/api/hooks/useStores.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchStore, fetchZones, submitStoreJoinRequest, updateStore } from '../stores'

export function useStore(storeId) {
  return useQuery({
    queryKey: ['store', storeId],
    queryFn: () => fetchStore(storeId),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(storeId),
  })
}

export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: fetchZones,
    staleTime: 60 * 60 * 1000,
  })
}

export function useSubmitJoinRequest() {
  return useMutation({
    mutationFn: ({ form, logoFile }) => submitStoreJoinRequest(form, logoFile),
  })
}

export function useUpdateStore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => updateStore(id, data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['store', id] }),
  })
}
```

### 1.14 `src/api/hooks/usePlans.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPlans, subscribeToPlan, renewPlan, changePlan } from '../plans'

export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
    staleTime: 60 * 60 * 1000,
  })
}

export function useSubscribeToPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: subscribeToPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currentUser'] })
      qc.invalidateQueries({ queryKey: ['plans'] })
    },
  })
}

export function useRenewPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: renewPlan,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['currentUser'] }),
  })
}
```

### 1.15 `src/api/hooks/useCampaigns.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchCampaigns, subscribeToCampaign } from '../campaigns'

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: fetchCampaigns,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSubscribeToCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: subscribeToCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  })
}
```

### 1.16 `src/api/hooks/useCustody.js`
```js
import { useQuery } from '@tanstack/react-query'
import { fetchCustodySummary, fetchCustodyLogs } from '../custody'

export function useCustodySummary() {
  return useQuery({
    queryKey: ['custodySummary'],
    queryFn: fetchCustodySummary,
    staleTime: 30 * 1000,
  })
}

export function useCustodyLogs(filters = {}) {
  return useQuery({
    queryKey: ['custodyLogs', filters],
    queryFn: () => fetchCustodyLogs(filters),
    staleTime: 30 * 1000,
  })
}
```

### 1.17 `src/api/hooks/useChat.js`
```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchChatMessages, sendChatMessage } from '../chat'

export function useChatMessages(orderId) {
  return useQuery({
    queryKey: ['chat', orderId],
    queryFn: () => fetchChatMessages(orderId),
    enabled: Boolean(orderId),
    staleTime: 15 * 1000,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: sendChatMessage,
    onSuccess: (_, { orderId }) =>
      qc.invalidateQueries({ queryKey: ['chat', orderId] }),
  })
}
```

---

## Phase 2: Update AuthContext (Single file change)

In `src/context/AuthContext.jsx`, replace manual `fetchCurrentUser()` fetch with `useQuery`:
- Replace `useEffect` that calls `fetchCurrentUser()` with `useCurrentUser()` hook
- Keep the rest of the auth logic (login/logout actions, store management)
- The Context API wrapper stays — React Query replaces only the data-fetching internals

---

## Phase 3: Convert Pages Incrementally

Replace manual `useState` + `useEffect` + `fetchXxx()` patterns in each page with hooks.

### Pattern: Before → After

**Before (e.g., Dashboard.jsx):**
```jsx
const [stats, setStats] = useState(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState(null)

useEffect(() => {
  fetchStoreDashboard({ storeId })
    .then(setStats)
    .catch(setError)
    .finally(() => setLoading(false))
}, [storeId])

if (loading) return <Spinner />
if (error) return <Error message={error.message} />
return <Stats data={stats} />
```

**After:**
```jsx
const { data, isLoading, error } = useDashboard(storeId)

if (isLoading) return <Spinner />
if (error) return <Error message={error.message} />
return <Stats data={data} />
```

### Migration Order (safest first):

| Step | Page | Hook | Complexity |
|------|------|------|------------|
| 1 | Dashboard | `useDashboard`, `useDashboardStats` | Low (read-only) |
| 2 | Products | `useProducts`, `useCategories`, `useAttributes` | Medium (CRUD) |
| 3 | Orders | `useOrders`, `useOrder`, `useUpdateOrderStatus` | Medium |
| 4 | Inventory | `useInventory`, `useShipments` | Medium |
| 5 | Finance | `useTransactions`, `useRevenueOverview` | Low |
| 6 | Staff | `useEmployees` | Low |
| 7 | Offers | `usePromotions` | Low |
| 8 | Notifications | `useNotifications` | Low |
| 9 | Chat | `useChatMessages` | Low |
| 10 | Sales (POS) | `usePosInit`, `usePosCart` | Medium |
| 11 | Plans | `usePlans` | Low |
| 12 | Marketing | `useCampaigns` | Low |
| 13 | Wallet (if separate) | `useWalletBalance` | Low |

---

## Phase 4: Cleanup (After all pages migrated)

1. `src/api/cache.js` — Remove entire file
2. `src/context/WalletContext.jsx` — Remove; pages use `useWalletBalance()` directly
3. Devtools — Keep for production debugging, or remove in production build

---

## Original Files That Stay (no change needed)

| File | Reason |
|------|--------|
| `src/api/client.js` | Used by hooks as the fetcher function |
| `src/api/config.js` | Endpoint definitions unchanged |
| `src/api/auth.js` | Functions used by `useAuth.js` hooks |
| `src/api/products.js` | Functions used by `useProducts.js` hooks |
| `src/api/orders.js` | Functions used by `useOrders.js` hooks |
| `src/api/inventory.js` | Functions used by `useInventory.js` hooks |
| `src/api/finance.js` | Functions used by `useFinance.js` hooks |
| `src/api/dashboard.js` | Functions used by `useDashboard.js` hooks |
| `src/api/wallet.js` | Functions used by `useWallet.js` hooks |
| `src/api/stores.js` | Functions used by `useStores.js` hooks |
| `src/api/pos.js` | Functions used by `usePos.js` hooks |
| `src/api/media.js` | Not an API module — image URL resolver |
| `src/api/stripe.js` | Not a data-fetching module — Stripe SDK wrapper |

---

## Implementation Checklist

- [ ] Phase 0: Install + QueryClient + Provider
- [ ] Phase 1.1: `useApi.js` base utility
- [ ] Phase 1.2: `useAuth.js`
- [ ] Phase 1.3: `useDashboard.js`
- [ ] Phase 1.4: `useProducts.js`
- [ ] Phase 1.5: `useOrders.js`
- [ ] Phase 1.6: `useInventory.js`
- [ ] Phase 1.7: `useFinance.js`
- [ ] Phase 1.8: `useWallet.js`
- [ ] Phase 1.9: `usePos.js`
- [ ] Phase 1.10: `useNotifications.js`
- [ ] Phase 1.11: `useEmployees.js`
- [ ] Phase 1.12: `usePromotions.js`
- [ ] Phase 1.13: `useStores.js`
- [ ] Phase 1.14: `usePlans.js`
- [ ] Phase 1.15: `useCampaigns.js`
- [ ] Phase 1.16: `useCustody.js`
- [ ] Phase 1.17: `useChat.js`
- [ ] Phase 2: Update AuthContext
- [ ] Phase 3: Convert pages (see order above)
- [ ] Phase 4: Cleanup

---

## Performance Gains Expected

| Metric | Before | After |
|--------|--------|-------|
| Duplicate requests | Multiple per mount | Deduplicated |
| Navigation re-fetch | Always fresh | Cached up to staleTime |
| Background updates | Manual | Automatic (staleTime) |
| Cache size management | Manual (localStorage quota) | Automatic (gcTime) |
| Loading states | Manual in each page | Automatic in each hook |
| Error handling | Manual try/catch | Centralized onError |
