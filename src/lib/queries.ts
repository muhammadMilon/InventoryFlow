'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query'
import { api, qs } from '@/lib/api'
import type {
  AdjustStockResult,
  AiStatus,
  AuditEntry,
  Category,
  DashboardData,
  HealthStatus,
  LowStockAlert,
  Order,
  Paginated,
  PlaceOrderPayload,
  Product,
  ProductVelocity,
  ReconcileResult,
  RestockReport,
  StockLevel,
  StockMovement,
  Warehouse,
} from '@/types/api'

/**
 * Query keys are a single source of truth so invalidation is precise.
 * `['products']` invalidates every product query; `['products','list',filters]`
 * only the one page currently on screen.
 */
export const queryKeys = {
  health: ['health'] as const,
  products: {
    all: ['products'] as const,
    list: (filters: Record<string, unknown>) => ['products', 'list', filters] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    categories: ['products', 'categories'] as const,
  },
  warehouses: { all: ['warehouses'] as const },
  stock: {
    all: ['stock'] as const,
    levels: (filters: Record<string, unknown>) => ['stock', 'levels', filters] as const,
    movements: (filters: Record<string, unknown>) => ['stock', 'movements', filters] as const,
    reconcile: ['stock', 'reconcile'] as const,
    auditLog: (filters: Record<string, unknown>) => ['stock', 'audit-log', filters] as const,
  },
  orders: {
    all: ['orders'] as const,
    list: (filters: Record<string, unknown>) => ['orders', 'list', filters] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    dashboard: (days: number) => ['analytics', 'dashboard', days] as const,
    lowStock: (days: number) => ['analytics', 'low-stock', days] as const,
    velocity: (days: number) => ['analytics', 'velocity', days] as const,
  },
  ai: {
    status: ['ai', 'status'] as const,
    restock: (days: number, limit: number) => ['ai', 'restock', days, limit] as const,
  },
}

/**
 * Polling cadence for "real-time-ish" stock. Three seconds is fast enough that
 * two people working the same warehouse see each other's effect on stock before
 * they try to sell the same unit, and slow enough not to hammer the API.
 * Polling pauses while the tab is hidden — `refetchIntervalInBackground` is
 * left at its default of false.
 */
export const LIVE_POLL_MS = 3000

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export interface ProductFilters {
  [key: string]: string | number | boolean | undefined
  search?: string
  categoryId?: string
  warehouseId?: string
  lowStockOnly?: boolean
  includeInactive?: boolean
  sortBy?: 'name' | 'sku' | 'unitPrice' | 'totalStock' | 'createdAt'
  sortDir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export function useProducts(filters: ProductFilters = {}, options?: { live?: boolean }) {
  const query = {
    ...filters,
    lowStockOnly: filters.lowStockOnly ? 'true' : undefined,
    includeInactive: filters.includeInactive ? 'true' : undefined,
  }

  return useQuery({
    queryKey: queryKeys.products.list(query),
    queryFn: () => api.get<Paginated<Product>>(`/products${qs(query)}`),
    refetchInterval: options?.live ? LIVE_POLL_MS : false,
    placeholderData: (previous) => previous, // keep the table populated while refetching
    staleTime: options?.live ? 0 : 15_000,
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ''),
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: Boolean(id),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.products.categories,
    queryFn: () => api.get<Category[]>('/products/categories'),
    staleTime: 5 * 60_000,
  })
}

export function useWarehouses(options?: Partial<UseQueryOptions<Warehouse[]>>) {
  return useQuery({
    queryKey: queryKeys.warehouses.all,
    queryFn: () => api.get<Warehouse[]>('/warehouses'),
    staleTime: 60_000,
    ...options,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post<Product>('/products', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Record<string, unknown>) =>
      api.patch<Product>(`/products/${id}`, payload),
    onSuccess: (product) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(product.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export function useStockLevels(filters: { warehouseId?: string; search?: string; lowOnly?: boolean } = {}) {
  const query = { ...filters, lowOnly: filters.lowOnly ? 'true' : undefined }
  return useQuery({
    queryKey: queryKeys.stock.levels(query),
    queryFn: () => api.get<StockLevel[]>(`/stock/levels${qs(query)}`),
    refetchInterval: LIVE_POLL_MS,
    placeholderData: (previous) => previous,
  })
}

export interface MovementFilters {
  [key: string]: string | number | undefined
  productId?: string
  warehouseId?: string
  orderId?: string
  type?: string
  reason?: string
  page?: number
  pageSize?: number
}

export function useMovements(filters: MovementFilters = {}) {
  return useQuery({
    queryKey: queryKeys.stock.movements(filters),
    queryFn: () => api.get<Paginated<StockMovement>>(`/stock/movements${qs(filters)}`),
    placeholderData: (previous) => previous,
    refetchInterval: LIVE_POLL_MS * 2,
  })
}

export function useReconcile(enabled = false) {
  return useQuery({
    queryKey: queryKeys.stock.reconcile,
    queryFn: () => api.get<ReconcileResult>('/stock/reconcile'),
    enabled,
    staleTime: 30_000,
  })
}

export function useAuditLog(filters: { page?: number; pageSize?: number; action?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.stock.auditLog(filters),
    queryFn: () => api.get<Paginated<AuditEntry>>(`/stock/audit-log${qs(filters)}`),
    placeholderData: (previous) => previous,
  })
}

export interface AdjustPayload {
  productId: string
  warehouseId: string
  delta?: number
  setTo?: number
  reason: string
  note?: string
}

export function useAdjustStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AdjustPayload) =>
      api.post<AdjustStockResult>('/stock/adjust', payload, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })
}

export function useTransferStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      productId: string
      fromWarehouseId: string
      toWarehouseId: string
      quantity: number
      note?: string
    }) => api.post('/stock/transfer', payload, { idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderFilters {
  [key: string]: string | number | undefined
  status?: string
  warehouseId?: string
  search?: string
  page?: number
  pageSize?: number
}

export function useOrders(filters: OrderFilters = {}, options?: { live?: boolean }) {
  return useQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: () => api.get<Paginated<Order>>(`/orders${qs(filters)}`),
    placeholderData: (previous) => previous,
    refetchInterval: options?.live ? LIVE_POLL_MS * 2 : false,
  })
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id ?? ''),
    queryFn: () => api.get<Order>(`/orders/${id}`),
    enabled: Boolean(id),
  })
}

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<Order>(`/orders/${id}/cancel`, { reason }),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(order.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<Order>(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    },
  })
}

export type PlaceOrderVariables = PlaceOrderPayload & { idempotencyKey: string }

/** See `useOptimisticPlaceOrder` in `use-place-order.ts` for the optimistic path. */
export function usePlaceOrder() {
  return useMutation({
    mutationFn: ({ idempotencyKey, ...payload }: PlaceOrderVariables) =>
      api.post<Order>('/orders', payload, { idempotencyKey }),
  })
}

// ---------------------------------------------------------------------------
// Analytics & AI
// ---------------------------------------------------------------------------

export function useDashboard(days = 30, options?: { live?: boolean }) {
  return useQuery({
    queryKey: queryKeys.analytics.dashboard(days),
    queryFn: () => api.get<DashboardData>(`/analytics/dashboard${qs({ days })}`),
    refetchInterval: options?.live === false ? false : 15_000,
    placeholderData: (previous) => previous,
  })
}

export function useLowStock(days = 30, limit = 50) {
  return useQuery({
    queryKey: queryKeys.analytics.lowStock(days),
    queryFn: () => api.get<LowStockAlert[]>(`/analytics/low-stock${qs({ days, limit })}`),
    refetchInterval: 20_000,
  })
}

export function useVelocity(days = 30, limit = 50) {
  return useQuery({
    queryKey: queryKeys.analytics.velocity(days),
    queryFn: () => api.get<ProductVelocity[]>(`/analytics/velocity${qs({ days, limit })}`),
    staleTime: 60_000,
  })
}

export function useAiStatus() {
  return useQuery({
    queryKey: queryKeys.ai.status,
    queryFn: () => api.get<AiStatus>('/ai/status'),
    staleTime: 5 * 60_000,
  })
}

export function useRestockReport(days = 30, limit = 12, enabled = true) {
  return useQuery({
    queryKey: queryKeys.ai.restock(days, limit),
    queryFn: () => api.get<RestockReport>(`/ai/restock-recommendation${qs({ days, limit })}`),
    enabled,
    // The API caches for 5 minutes; there is nothing to gain from asking sooner.
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function useRegenerateRestock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ days, limit }: { days: number; limit: number }) =>
      api.get<RestockReport>(`/ai/restock-recommendation${qs({ days, limit, force: 'true' })}`),
    onSuccess: (report, variables) => {
      queryClient.setQueryData(queryKeys.ai.restock(variables.days, variables.limit), report)
    },
  })
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get<HealthStatus>('/health'),
    refetchInterval: 30_000,
    retry: false,
  })
}
