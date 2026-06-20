import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAllEmployees, createEmployee, updateEmployee, toggleEmployee, deleteEmployee } from '../employees'

const EMP_KEY = 'employees'

export function useEmployees(filters = {}) {
  return useQuery({
    queryKey: [EMP_KEY, filters],
    queryFn: () => fetchAllEmployees(filters),
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

export function useDeleteEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: [EMP_KEY] }),
  })
}
