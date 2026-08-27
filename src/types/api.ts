/**
 * Wire types for the InventoryFlow API.
 *
 * These are hand-maintained rather than generated: the API is a separate
 * repository/deployment, so codegen would couple the two build pipelines. The
 * shapes are small and stable, and `ApiError` gives the UI a machine `code` to
 * branch on rather than string-matching a message.
 */

export type Role = 'ADMIN' | 'STAFF'

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED'

export type MovementType = 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT'

export type MovementReason =
  | 'PURCHASE_RECEIPT'
  | 'SALE_ORDER'
  | 'ORDER_CANCELLED'
  | 'MANUAL_ADJUSTMENT'
  | 'STOCK_TAKE'
  | 'DAMAGED'
  | 'RETURN'
  | 'TRANSFER'
  | 'INITIAL_LOAD'

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_STOCK'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'IDEMPOTENT_REPLAY_IN_PROGRESS'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'

export interface ApiEnvelope<T> {
  ok: true
  data: T
}

export interface ApiErrorBody {
  ok: false
  error: {
    code: ErrorCode
    message: string
    details?: unknown
    requestId?: string
  }
}

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: Pagination
}

// --- Auth -------------------------------------------------------------------

export interface User {
  id: string
  email: string
  name: string
  role: Role
  lastLoginAt: string | null
}

export interface LoginResponse {
  user: User
  accessToken: string
}

// --- Catalogue --------------------------------------------------------------

export interface Category {
  id: string
  name: string
  slug: string
  productCount: number
}

export interface WarehouseRef {
  id: string
  code: string
  name: string
}

export interface Warehouse extends WarehouseRef {
  city: string
  country: string
  isActive: boolean
  skuCount: number
  totalUnits: number
  stockValue: number
  lowStockCount: number
  orderCount: number
  createdAt: string
}

export interface ProductStockByWarehouse {
  warehouseId: string
  warehouse: WarehouseRef
  quantity: number
  reserved: number
  available: number
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  category: { id: string; name: string; slug: string } | null
  unitPrice: number
  costPrice: number
  margin: number
  reorderPoint: number
  reorderQty: number
  isActive: boolean
  totalStock: number
  totalReserved: number
  available: number
  stockValue: number
  isLow: boolean
  isOutOfStock: boolean
  stockByWarehouse: ProductStockByWarehouse[]
  createdAt: string
  updatedAt: string
}

// --- Stock ------------------------------------------------------------------

export interface StockLevel {
  productId: string
  warehouseId: string
  sku: string
  productName: string
  warehouse: WarehouseRef
  quantity: number
  reserved: number
  available: number
  reorderPoint: number
  reorderQty: number
  unitPrice: number
  isLow: boolean
  updatedAt: string
}

export interface StockMovement {
  id: string
  type: MovementType
  reason: MovementReason
  quantityDelta: number
  balanceAfter: number
  unitCost: number | null
  note: string | null
  referenceId: string | null
  createdAt: string
  product: { id: string; sku: string; name: string }
  warehouse: WarehouseRef
  actor: { id: string; name: string; email: string } | null
  order: { id: string; orderNumber: string } | null
}

export interface AdjustStockResult {
  productId: string
  warehouseId: string
  previousQuantity: number
  quantity: number
  delta: number
  movementId: string
}

export interface ReconcileResult {
  checked: number
  balanced: boolean
  discrepancies: Array<{
    productId: string
    warehouseId: string
    sku: string
    productName: string
    warehouseCode: string
    level: number
    ledger: number
    drift: number
  }>
}

export interface AuditEntry {
  id: string
  action: string
  entity: string
  entityId: string | null
  before: unknown
  after: unknown
  metadata: Record<string, unknown> | null
  ip: string | null
  actor: { id?: string; name: string; email: string | null; role?: Role }
  createdAt: string
}

// --- Orders -----------------------------------------------------------------

export interface OrderLine {
  id: string
  productId: string
  sku: string
  name: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface Order {
  id: string
  orderNumber: string
  status: OrderStatus
  customerName: string
  customerEmail: string
  customerPhone: string | null
  notes: string | null
  subtotal: number
  taxTotal: number
  totalAmount: number
  itemCount: number
  warehouse: WarehouseRef
  placedBy: { id: string; name: string; email: string }
  createdAt: string
  cancelledAt: string | null
  fulfilledAt: string | null
  items: OrderLine[]
}

export interface PlaceOrderPayload {
  customerName: string
  customerEmail: string
  customerPhone?: string
  warehouseId: string
  notes?: string
  items: Array<{ productId: string; quantity: number }>
}

export interface StockShortfall {
  productId: string
  sku: string
  name: string
  requested: number
  available: number
}

// --- Analytics --------------------------------------------------------------

export interface DashboardSummary {
  totalProducts: number
  activeProducts: number
  totalWarehouses: number
  totalUnits: number
  stockValue: number
  retailValue: number
  lowStockCount: number
  outOfStockCount: number
  ordersToday: number
  revenueToday: number
  orders30d: number
  revenue30d: number
  avgOrderValue: number
  openOrders: number
  revenueChangePct: number
  orderChangePct: number
}

export interface SalesTrendPoint {
  date: string
  orders: number
  revenue: number
  units: number
}

export interface MovementFlowPoint {
  date: string
  inbound: number
  outbound: number
  net: number
}

export interface TopProduct {
  productId: string
  sku: string
  name: string
  category: string | null
  unitsSold: number
  revenue: number
  orders: number
}

export interface CategoryBreakdown {
  category: string
  products: number
  units: number
  stockValue: number
  revenue: number
}

export interface WarehouseUtilisation {
  warehouseId: string
  code: string
  name: string
  city: string
  units: number
  skus: number
  stockValue: number
  lowStock: number
  orders: number
}

export interface LowStockAlert {
  productId: string
  sku: string
  name: string
  category: string | null
  warehouseId: string
  warehouseCode: string
  warehouseName: string
  quantity: number
  reserved: number
  available: number
  reorderPoint: number
  reorderQty: number
  velocity: number
  daysOfCover: number | null
  severity: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW'
}

export interface OrderStatusSlice {
  status: OrderStatus
  count: number
  value: number
}

export interface DashboardData {
  summary: DashboardSummary
  salesTrend: SalesTrendPoint[]
  movementFlow: MovementFlowPoint[]
  topProducts: TopProduct[]
  categories: CategoryBreakdown[]
  warehouses: WarehouseUtilisation[]
  lowStock: LowStockAlert[]
  orderStatus: OrderStatusSlice[]
}

export interface ProductVelocity {
  productId: string
  sku: string
  name: string
  category: string | null
  onHand: number
  reorderPoint: number
  reorderQty: number
  unitPrice: number
  unitsSold: number
  orderCount: number
  dailyVelocity: number
  daysOfCover: number | null
}

// --- AI ---------------------------------------------------------------------

export type Urgency = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface RestockLine {
  sku: string
  productId: string
  name: string
  category: string | null
  onHand: number
  reorderPoint: number
  dailyVelocity: number
  daysOfCover: number | null
  suggestedQty: number
  urgency: Urgency
  estimatedCost: number
  rationale: string
}

export interface RestockReport {
  source: 'gemini' | 'heuristic'
  model: string | null
  generatedAt: string
  windowDays: number
  headline: string
  summary: string
  riskLevel: Urgency
  recommendations: RestockLine[]
  watchList: Array<{ sku: string; name: string; note: string }>
  totalSuggestedUnits: number
  totalEstimatedSpend: number
  degradedReason?: string
}

export interface AiStatus {
  provider: string
  enabled: boolean
  model: string | null
  fallback: string
  cacheTtlSeconds: number
}

export interface HealthStatus {
  status: string
  uptime: number
  database: { connected: boolean; latencyMs: number }
  ai: { enabled: boolean; model: string | null }
  version: string
  environment: string
}
