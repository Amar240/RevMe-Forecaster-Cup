'use client'

import { useState, useMemo, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Download } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (item: T) => React.ReactNode
  className?: string
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchKeys?: string[]
  searchPlaceholder?: string
  pageSize?: number
  pageSizes?: number[]
  filters?: {
    key: string
    label: string
    options: { value: string; label: string }[]
  }[]
  loading?: boolean
  exportFileName?: string
}

export function DataTable<T extends object>({
  data,
  columns,
  searchKeys = [],
  searchPlaceholder = 'Search...',
  pageSize = 10,
  pageSizes = [10, 25, 50],
  filters = [],
  loading = false,
  exportFileName,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const [effectivePageSize, setEffectivePageSize] = useState(pageSize)

  const filteredAndSortedData = useMemo(() => {
    let result = [...data]

    if (searchQuery && searchKeys.length > 0) {
      const query = searchQuery.toLowerCase()
      result = result.filter((item) =>
        searchKeys.some((key) => {
          const value = getNestedValue(item, key)
          return String(value).toLowerCase().includes(query)
        })
      )
    }

    Object.entries(activeFilters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        result = result.filter((item) => {
          const itemValue = getNestedValue(item, key)
          return String(itemValue) === value
        })
      }
    })

    if (sortKey) {
      result.sort((a, b) => {
        const aValue = getNestedValue(a, sortKey)
        const bValue = getNestedValue(b, sortKey)

        if (aValue === bValue) return 0
        if (aValue === null || aValue === undefined) return 1
        if (bValue === null || bValue === undefined) return -1

        const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true })
        return sortDirection === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [data, searchQuery, searchKeys, sortKey, sortDirection, activeFilters])

  const totalPages = Math.ceil(filteredAndSortedData.length / effectivePageSize)
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * effectivePageSize,
    currentPage * effectivePageSize
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ChevronsUpDown className="h-4 w-4 text-gray-400" />
    return sortDirection === 'asc' ? (
      <ChevronUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ChevronDown className="h-4 w-4 text-blue-600" />
    )
  }

  const getAriaSortValue = (key: string): 'ascending' | 'descending' | 'none' => {
    if (sortKey !== key) return 'none'
    return sortDirection === 'asc' ? 'ascending' : 'descending'
  }

  const handleExportCsv = useCallback(() => {
    const headers = columns.map((col) => col.header)
    const rows = filteredAndSortedData.map((item) =>
      columns.map((col) => {
        const value = getNestedValue(item, col.key)
        const str = String(value ?? '')
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      })
    )
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${exportFileName}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [columns, filteredAndSortedData, exportFileName])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 bg-gray-200 animate-pulse rounded-md" />
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm" role="grid">
            <thead>
              <tr className="bg-gray-50 border-b" role="row">
                {columns.map((column) => (
                  <th key={column.key} className="px-4 py-3 text-left text-gray-600 font-medium">
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b last:border-0" role="row">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3" role="gridcell">
                      <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        {searchKeys.length > 0 && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10"
            />
          </div>
        )}
        {filters.map((filter) => (
          <Select
            key={filter.key}
            value={activeFilters[filter.key] || 'all'}
            onValueChange={(value) => {
              setActiveFilters((prev) => ({ ...prev, [filter.key]: value }))
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="h-10 w-[180px]">
              <SelectValue placeholder={`${filter.label}: All`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filter.label}: All</SelectItem>
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {exportFileName && (
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-10">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        )}
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm" role="grid">
          <thead>
            <tr className="bg-gray-50 border-b" role="row">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-gray-600 font-medium ${column.className || ''}`}
                  aria-sort={column.sortable ? getAriaSortValue(column.key) : undefined}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center space-x-1 hover:text-gray-900"
                    >
                      <span>{column.header}</span>
                      {getSortIcon(column.key)}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr role="row">
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500" role="gridcell">
                  No results found
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr key={index} className="border-b last:border-0 hover:bg-gray-50" role="row">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3 ${column.className || ''}`} role="gridcell">
                      {column.render
                        ? column.render(item)
                        : String(getNestedValue(item, column.key) ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500" aria-live="polite">
          {filteredAndSortedData.length === 0
            ? 'No results'
            : `Showing ${(currentPage - 1) * effectivePageSize + 1} to ${Math.min(
                currentPage * effectivePageSize,
                filteredAndSortedData.length
              )} of ${filteredAndSortedData.length} results`}
        </p>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Rows per page</span>
            <Select
              value={String(effectivePageSize)}
              onValueChange={(value) => {
                setEffectivePageSize(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Go to next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getNestedValue(obj: object, path: string): unknown {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, obj as unknown)
}
