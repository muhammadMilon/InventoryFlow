'use client'

import { useEffect, useMemo, useState } from 'react'
import { Filter, Package, Plus, Search, ShoppingCart, SlidersHorizontal, X } from 'lucide-react'
import { toast } from 'sonner'
import { currency, number } from '@/lib/format'
import { useCategories, useProducts, useWarehouses, type ProductFilters } from '@/lib/queries'
import { useAuthStore } from '@/store/auth-store'
import { useCartStore } from '@/store/cart-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { StockBadge } from '@/components/ui/badge'
import { EmptyState, ErrorState, LiveDot, TableSkeleton } from '@/components/ui/feedback'
import { Pagination, Table, TableWrap, TBody, Td, Th, THead, Tr } from '@/components/ui/table'
import { ProductFormModal } from './product-form-modal'
import { AdjustStockModal } from './adjust-stock-modal'
import type { Product } from '@/types/api'

const PAGE_SIZE = 12

export default function ProductsPage() {
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [sortBy, setSortBy] = useState<NonNullable<ProductFilters['sortBy']>>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [adjusting, setAdjusting] = useState<Product | null>(null)

  // Debounce so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const filters = useMemo<ProductFilters>(
    () => ({
      search: debouncedSearch || undefined,
      categoryId: categoryId || undefined,
      warehouseId: warehouseId || undefined,
      lowStockOnly,
      sortBy,
      sortDir,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, categoryId, warehouseId, lowStockOnly, sortBy, sortDir, page],
  )

  // `live: true` polls every 3s — two staff working the same warehouse see each
  // other's stock changes without a manual refresh.
  const { data, isLoading, isError, error, refetch, isFetching } = useProducts(filters, { live: true })
  const { data: categories } = useCategories()
  const { data: warehouses } = useWarehouses()

  const cart = useCartStore()

  const toggleSort = (column: NonNullable<ProductFilters['sortBy']>) => {
    if (sortBy === column) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir(column === 'name' || column === 'sku' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  const addToCart = (product: Product) => {
    if (!warehouseId) {
      toast.error('Choose a warehouse first', {
        description: 'Stock is held per warehouse, so an order has to name one.',
      })
      return
    }
    const stockHere = product.stockByWarehouse.find((row) => row.warehouseId === warehouseId)
    const available = stockHere?.available ?? 0

    if (available <= 0) {
      toast.error(`${product.name} is out of stock here`, {
        description: 'Pick another warehouse or restock first.',
      })
      return
    }

    cart.setWarehouse(warehouseId)
    cart.add(
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unitPrice: product.unitPrice,
        available,
      },
      1,
    )
    toast.success(`${product.name} added`, { description: `${cart.count() + 1} items in the basket` })
  }

  const activeFilterCount = [debouncedSearch, categoryId, warehouseId, lowStockOnly].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setCategoryId('')
    setWarehouseId('')
    setLowStockOnly(false)
    setPage(1)
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-[-0.02em] text-ink-900 sm:text-xl">Products</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-500 sm:text-sm">
            {data ? `${number(data.pagination.total)} products in the catalogue` : 'Loading catalogue…'}
            <span aria-hidden>·</span>
            <LiveDot label="live stock" active={isFetching} />
          </p>
        </div>

        {isAdmin && (
          <Button
            leftIcon={<Plus className="size-4" />}
            onClick={() => setCreateOpen(true)}
            className="w-full justify-center sm:w-auto"
          >
            New product
          </Button>
        )}
      </div>

      {/* ---- Filter bar: one row, above the table ---- */}
      <Card className="p-2.5 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
          <div className="w-full sm:min-w-[200px] sm:flex-1">
            <Input
              placeholder="Search name, SKU or description…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              leftIcon={<Search className="size-4" />}
              rightSlot={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : undefined
              }
              aria-label="Search products"
            />
          </div>

          <Select
            value={warehouseId}
            onChange={(event) => {
              setWarehouseId(event.target.value)
              setPage(1)
            }}
            aria-label="Filter by warehouse"
            className="w-full sm:w-[190px]"
          >
            <option value="">All warehouses</option>
            {warehouses?.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} — {warehouse.city}
              </option>
            ))}
          </Select>

          <Select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value)
              setPage(1)
            }}
            aria-label="Filter by category"
            className="w-full sm:w-[170px]"
          >
            <option value="">All categories</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name} ({category.productCount})
              </option>
            ))}
          </Select>

          <button
            type="button"
            onClick={() => {
              setLowStockOnly((value) => !value)
              setPage(1)
            }}
            aria-pressed={lowStockOnly}
            className={
              'inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors sm:w-auto ' +
              (lowStockOnly
                ? 'border-serious-500/30 bg-serious-50 text-serious-700'
                : 'border-ink-300 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700')
            }
          >
            <Filter className="size-3.5" />
            Low stock only
          </button>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="md"
              onClick={clearFilters}
              leftIcon={<X className="size-3.5" />}
              className="w-full justify-center sm:w-auto"
            >
              Clear
            </Button>
          )}
        </div>

        {warehouseId && (
          <p className="mt-2 flex items-center gap-1.5 px-1 text-[12px] text-ink-500">
            <SlidersHorizontal className="size-3" />
            Showing stock for{' '}
            <span className="font-medium text-ink-700">
              {warehouses?.find((w) => w.id === warehouseId)?.name}
            </span>
            . Orders will be placed against this site.
          </p>
        )}
      </Card>

      {/* ---- Table ---- */}
      <Card className="overflow-hidden">
        {isError ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<Package className="size-5" />}
            title="No products match these filters"
            description={
              activeFilterCount > 0
                ? 'Try widening the search, or clear the filters to see the whole catalogue.'
                : 'Add your first product to get started.'
            }
            action={
              activeFilterCount > 0 ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : isAdmin ? (
                <Button size="sm" onClick={() => setCreateOpen(true)} leftIcon={<Plus className="size-3.5" />}>
                  New product
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table className="min-w-[840px]">
                <THead>
                  <Tr>
                    <Th sortable sorted={sortBy === 'name' && sortDir} onClick={() => toggleSort('name')}>
                      Product
                    </Th>
                    <Th sortable sorted={sortBy === 'sku' && sortDir} onClick={() => toggleSort('sku')}>
                      SKU
                    </Th>
                    <Th>Category</Th>
                    <Th
                      align="right"
                      sortable
                      sorted={sortBy === 'unitPrice' && sortDir}
                      onClick={() => toggleSort('unitPrice')}
                    >
                      Price
                    </Th>
                    <Th
                      align="right"
                      sortable
                      sorted={sortBy === 'totalStock' && sortDir}
                      onClick={() => toggleSort('totalStock')}
                    >
                      {warehouseId ? 'At site' : 'Total stock'}
                    </Th>
                    <Th align="center">Status</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>

                <TBody>
                  {data?.items.map((product) => {
                    const siteRow = warehouseId
                      ? product.stockByWarehouse.find((row) => row.warehouseId === warehouseId)
                      : undefined
                    const shownAvailable = warehouseId ? (siteRow?.available ?? 0) : product.available

                    return (
                      <Tr key={product.id} data-testid="product-row" data-sku={product.sku}>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-bold text-brand-600">
                              {product.sku.slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink-900">{product.name}</p>
                              <p className="truncate text-[12px] text-ink-400">
                                Reorder at {product.reorderPoint} · {product.stockByWarehouse.length} sites
                              </p>
                            </div>
                          </div>
                        </Td>

                        <Td className="font-mono text-[12px] text-ink-500">{product.sku}</Td>

                        <Td className="text-[12.5px]">{product.category?.name ?? '—'}</Td>

                        <Td align="right" numeric>
                          <span className="font-medium text-ink-900">{currency(product.unitPrice)}</span>
                          <span className="mt-0.5 block text-[11px] text-ink-400">
                            cost {currency(product.costPrice)}
                          </span>
                        </Td>

                        <Td align="right" numeric>
                          <span className="text-[15px] font-semibold text-ink-900">{shownAvailable}</span>
                          {product.totalReserved > 0 && !warehouseId && (
                            <span className="mt-0.5 block text-[11px] text-ink-400">
                              {product.totalReserved} reserved
                            </span>
                          )}
                        </Td>

                        <Td align="center">
                          <StockBadge available={shownAvailable} reorderPoint={product.reorderPoint} />
                        </Td>

                        <Td align="right">
                          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
                            <Button
                              size="sm"
                              variant="subtle"
                              onClick={() => addToCart(product)}
                              disabled={shownAvailable <= 0}
                              leftIcon={<ShoppingCart className="size-3.5" />}
                              title={
                                warehouseId
                                  ? 'Add to the order basket'
                                  : 'Choose a warehouse first to add to an order'
                              }
                            >
                              Add
                            </Button>

                            {isAdmin && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => setAdjusting(product)}>
                                  Adjust
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditing(product)}>
                                  Edit
                                </Button>
                              </>
                            )}
                          </div>
                        </Td>
                      </Tr>
                    )
                  })}
                </TBody>
              </Table>
            </TableWrap>

            {data && (
              <Pagination
                page={data.pagination.page}
                totalPages={data.pagination.totalPages}
                total={data.pagination.total}
                pageSize={data.pagination.pageSize}
                onPageChange={setPage}
                label="products"
              />
            )}
          </>
        )}
      </Card>

      {/* ---- Modals ---- */}
      <ProductFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        warehouses={warehouses ?? []}
        categories={categories ?? []}
      />

      <ProductFormModal
        open={Boolean(editing)}
        product={editing ?? undefined}
        onClose={() => setEditing(null)}
        warehouses={warehouses ?? []}
        categories={categories ?? []}
      />

      <AdjustStockModal
        open={Boolean(adjusting)}
        product={adjusting ?? undefined}
        warehouses={warehouses ?? []}
        onClose={() => setAdjusting(null)}
      />
    </div>
  )
}
