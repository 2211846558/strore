import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchStoreProducts, createProduct, updateProduct,
  archiveProduct, restoreProduct, deleteProductVariant,
  fetchCategories, fetchAttributes,
} from '../products'

const PRODUCTS_KEY = 'products'
const CATEGORIES_KEY = 'categories'
const ATTRIBUTES_KEY = 'attributes'

export function useProducts(filters = {}, queryOptions = {}) {
  return useQuery({
    queryKey: [PRODUCTS_KEY, filters],
    queryFn: () => fetchStoreProducts(filters),
    staleTime: 5 * 60 * 1000,
    ...queryOptions,
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
