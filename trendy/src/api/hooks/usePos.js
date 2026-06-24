import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPosInit, fetchPosStoreCatalog, fetchPosCart, addToPosCart, removeFromPosCart, checkoutPosCart } from '../pos'
import { buildPosDisplayProducts } from '../posImages'
import { useProducts } from './useProducts'

const POS_INIT_KEY = 'posInit'
const POS_CART_KEY = 'posCart'

/** نفس فلاتر صفحة المنتجات — GET /my-store/products (api.md) */
export const SALES_PRODUCT_FILTERS = {
  name: '',
  categoryId: 'all',
  status: 'all',
}

/**
 * منتجات المبيعات المباشرة
 * GET /stores/{storeId}/products
 */
export function useSalesProducts(storeId) {
  const filters = useMemo(
    () => ({ storeId, ...SALES_PRODUCT_FILTERS }),
    [storeId],
  )

  const storeQuery = useProducts(filters)
  const catalogQuery = useQuery({
    queryKey: ['salesPosCatalog', storeId ?? null],
    queryFn: () => fetchPosStoreCatalog({ storeId }),
    enabled: Boolean(storeId),
    staleTime: 30 * 1000,
    retry: 1,
  })

  const storeProducts = storeQuery.data ?? []
  const posCatalog = catalogQuery.data ?? []

  const products = useMemo(() => {
    const fromStore = buildPosDisplayProducts([], storeProducts)
    if (fromStore.length) {
      return buildPosDisplayProducts(posCatalog, storeProducts)
    }
    return posCatalog
  }, [posCatalog, storeProducts])

  return {
    products,
    storeProducts,
    isLoading: storeQuery.isLoading,
    isEnriching: catalogQuery.isLoading,
    isError: storeQuery.isError && catalogQuery.isError,
    error: storeQuery.error ?? catalogQuery.error,
  }
}

export function usePosInit(storeId) {
  return useQuery({
    queryKey: [POS_INIT_KEY, storeId ?? null],
    queryFn: () => fetchPosInit({ storeId }),
    staleTime: 15 * 1000,
    retry: 1,
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POS_CART_KEY] })
      qc.invalidateQueries({ queryKey: [POS_INIT_KEY] })
    },
  })
}

export function useRemoveFromCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeFromPosCart,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POS_CART_KEY] })
      qc.invalidateQueries({ queryKey: [POS_INIT_KEY] })
    },
  })
}

export function useCheckoutCart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: checkoutPosCart,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [POS_CART_KEY] })
      qc.invalidateQueries({ queryKey: [POS_INIT_KEY] })
    },
  })
}
