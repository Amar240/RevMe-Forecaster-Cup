'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchKeys?: string[]
  searchPlaceholder?: string
  pageSize?: number
  filters?: {
    key: string
    label: string
    options: { value: string; label: string }[]
  }[]
}

export function DataTable<T extends object>({
  data,
  columns,
  searchKeys = [],
  searchPlaceholder = 'Search...',
  pageSize = 10,
  filters = [],
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})

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

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize)
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
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
          <select
            key={filter.key}
            value={activeFilters[filter.key] || 'all'}
            onChange={(e) => {
              setActiveFilters((prev) => ({ ...prev, [filter.key]: e.target.value }))
              setCurrentPage(1)
            }}
            className="h-10 px-3 border rounded-md text-sm bg-white"
          >
            <option value="all">{filter.label}: All</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-gray-600 font-medium ${column.className || ''}`}
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
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                  No results found
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3 ${column.className || ''}`}>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filteredAndSortedData.length)} of{' '}
            {filteredAndSortedData.length} results
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
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
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
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
