import React, { useState, useMemo } from 'react'
import {
  Shield, Search, Filter, FilterX, Download, RefreshCw,
  CheckCircle, XCircle, AlertTriangle,
  FileText, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AuditLog } from '../types'
import { Badge } from '../components/ui/Badge'
import { getRoleLabel } from '../utils/rbac'
import { useAuditLogs } from '../hooks/useDataApi'

const RESULT_ICONS = {
  success: <CheckCircle size={14} className="text-green-500" />,
  blocked: <Shield size={14} className="text-yellow-500" />,
  denied: <XCircle size={14} className="text-red-500" />,
  error: <AlertTriangle size={14} className="text-orange-500" />,
}

const RESULT_LABELS = {
  success: 'Sucesso',
  blocked: 'Bloqueado',
  denied: 'Negado',
  error: 'Erro',
}

const RESULT_VARIANTS: Record<string, 'green' | 'yellow' | 'red' | 'default'> = {
  success: 'green',
  blocked: 'yellow',
  denied: 'red',
  error: 'default',
}

export function AuditPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterResult, setFilterResult] = useState('all')
  const [filterUser, setFilterUser] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [sortField, setSortField] = useState<keyof AuditLog>('timestamp')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const PAGE_SIZE = 15

  const apiFilters = useMemo(() => ({
    startDate: filterDateFrom ? new Date(filterDateFrom) : undefined,
    endDate: filterDateTo ? new Date(filterDateTo) : undefined,
    result: filterResult !== 'all' ? filterResult : undefined,
    documentName: searchQuery || undefined,
  }), [filterDateFrom, filterDateTo, filterResult, searchQuery])

  const { data, isLoading, refetch, isFetching } = useAuditLogs(apiFilters, currentPage, PAGE_SIZE)
  const logs = data?.logs ?? []
  const totalFromApi = data?.total ?? 0

  // Filtrar e ordenar logs
  const filteredLogs = useMemo(() => {
    let result = [...logs]

    if (filterUser) {
      result = result.filter(log =>
        log.userName.toLowerCase().includes(filterUser.toLowerCase())
      )
    }

    result.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const dir = sortDir === 'asc' ? 1 : -1

      if (aVal instanceof Date && bVal instanceof Date) {
        return (aVal.getTime() - bVal.getTime()) * dir
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * dir
      }
      return 0
    })

    return result
  }, [logs, filterUser, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(totalFromApi / PAGE_SIZE))
  const paginatedLogs = filteredLogs
  const pageFrom = totalFromApi === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const pageTo = Math.min(currentPage * PAGE_SIZE, totalFromApi)

  const pageNumbers = useMemo(() => {
    const windowSize = Math.min(5, totalPages)
    const half = Math.floor(windowSize / 2)
    let start = Math.max(1, currentPage - half)
    const end = Math.min(totalPages, start + windowSize - 1)
    start = Math.max(1, end - windowSize + 1)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }, [currentPage, totalPages])

  const handleSort = (field: keyof AuditLog) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const exportCSV = () => {
    const headers = ['Data', 'Usuário', 'Email', 'Perfil', 'Consulta', 'Documento', 'Resultado', 'IP']
    const rows = filteredLogs.map(log => [
      format(log.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
      log.userName,
      log.userEmail,
      getRoleLabel(log.role),
      `"${log.query.replace(/"/g, '""')}"`,
      log.documentAccessed || '',
      RESULT_LABELS[log.result],
      log.ipAddress,
    ])

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ field }: { field: keyof AuditLog }) => {
    if (sortField !== field) return <ChevronDown size={12} className="opacity-30" />
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-blue-500" />
      : <ChevronDown size={12} className="text-blue-500" />
  }

  // Stats rápidas
  const stats = {
    total: totalFromApi,
    success: filteredLogs.filter(l => l.result === 'success').length,
    blocked: filteredLogs.filter(l => l.result === 'blocked').length,
    denied: filteredLogs.filter(l => l.result === 'denied').length,
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Shield size={20} className="text-blue-600" />
              Log de Auditoria
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Registro completo de acessos e consultas em conformidade com LGPD
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="btn-secondary text-xs px-3 py-2"
            >
              <Download size={13} />
              Exportar CSV
            </button>
            <button
              onClick={() => refetch()}
              className={`btn-primary text-xs px-3 py-2 ${isFetching ? 'opacity-70' : ''}`}
              disabled={isFetching}
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <FileText size={15} className="text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.total}</p>
              <p className="text-xs text-[var(--text-muted)]">Total</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-50 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <CheckCircle size={15} className="text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.success}</p>
              <p className="text-xs text-[var(--text-muted)]">Sucesso</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
              <Shield size={15} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.blocked}</p>
              <p className="text-xs text-[var(--text-muted)]">Bloqueados</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
              <XCircle size={15} className="text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.denied}</p>
              <p className="text-xs text-[var(--text-muted)]">Negados</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter size={14} className="text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_minmax(0,1.4fr)] gap-3 items-end">
            <div className="relative min-w-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Buscar por nome, consulta..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="input-field pl-8 text-sm h-10"
              />
            </div>
            <select
              value={filterResult}
              onChange={e => { setFilterResult(e.target.value); setCurrentPage(1) }}
              className="input-field text-sm h-10 min-w-0"
            >
              <option value="all">Todos os resultados</option>
              <option value="success">✅ Sucesso</option>
              <option value="blocked">⚠️ Bloqueado</option>
              <option value="denied">❌ Negado</option>
              <option value="error">🔴 Erro</option>
            </select>
            <div className="flex items-center gap-1.5 min-w-0 sm:col-span-2 xl:col-span-1">
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1) }}
                className="input-field text-sm flex-1 min-w-0 h-10"
              />
              <span className="text-[var(--text-muted)] text-xs shrink-0">até</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1) }}
                className="input-field text-sm flex-1 min-w-0 h-10"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setFilterResult('all')
                  setFilterUser('')
                  setFilterDateFrom('')
                  setFilterDateTo('')
                  setCurrentPage(1)
                }}
                className="btn-secondary text-[11px] px-2 py-0 h-8 w-auto shrink-0 border border-[var(--border-color)] whitespace-nowrap"
              >
                <FilterX size={12} />
                Limpar Filtros
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                  {[
                    { key: 'timestamp' as const, label: 'Data/Hora' },
                    { key: 'userName' as const, label: 'Usuário' },
                    { key: 'query' as const, label: 'Consulta' },
                    { key: 'documentAccessed' as const, label: 'Documento' },
                    { key: 'result' as const, label: 'Resultado' },
                    { key: 'ipAddress' as const, label: 'IP' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] whitespace-nowrap"
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.key} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {paginatedLogs.map(log => (
                  <React.Fragment key={log.id}>
                    <tr
                      onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                      className="hover:bg-[var(--bg-tertiary)] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar size={11} className="text-[var(--text-muted)]" />
                          <span className="text-[var(--text-secondary)]">
                            {format(log.timestamp, 'dd/MM HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs font-medium text-[var(--text-primary)]">{log.userName}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{getRoleLabel(log.role)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-[var(--text-secondary)] truncate">{log.query}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[150px]">
                        {log.documentAccessed ? (
                          <div className="flex items-center gap-1.5">
                            <FileText size={11} className="text-blue-500 flex-shrink-0" />
                            <span className="text-xs text-[var(--text-secondary)] truncate">{log.documentAccessed}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={RESULT_VARIANTS[log.result]}>
                          <span className="flex items-center gap-1">
                            {RESULT_ICONS[log.result]}
                            {RESULT_LABELS[log.result]}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono text-[var(--text-muted)]">{log.ipAddress}</span>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedRow === log.id && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3 bg-[var(--bg-tertiary)]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-3 text-xs">
                            <div className="min-w-0">
                              <p className="font-medium text-[var(--text-muted)] mb-0.5">Email</p>
                              <p className="text-[var(--text-secondary)] break-all">{log.userEmail}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-[var(--text-muted)] mb-0.5">Data/Hora Completa</p>
                              <p className="text-[var(--text-secondary)] whitespace-nowrap">
                                {format(log.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                              </p>
                            </div>
                            <div className="min-w-0 sm:col-span-2">
                              <p className="font-medium text-[var(--text-muted)] mb-0.5">Session ID</p>
                              <p className="text-[var(--text-secondary)] font-mono break-all">{log.sessionId}</p>
                            </div>
                            {log.documentPath && (
                              <div className="min-w-0 sm:col-span-2 xl:col-span-4">
                                <p className="font-medium text-[var(--text-muted)] mb-0.5">Caminho</p>
                                <p className="text-[var(--text-secondary)] break-all">{log.documentPath}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}

                {paginatedLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
                      <Shield size={32} className="mx-auto mb-2 opacity-30" />
                      Nenhum registro encontrado com os filtros aplicados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalFromApi > 0 && (
            <div className="px-4 py-3 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                Exibindo {pageFrom}–{pageTo} de {totalFromApi} registros
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary text-xs px-2.5 py-0 h-8 border border-[var(--border-color)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} />
                    Anterior
                  </button>
                  {pageNumbers.map(page => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      aria-current={currentPage === page ? 'page' : undefined}
                      className={`w-8 h-8 text-xs font-medium rounded-lg border transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-[var(--border-color)] text-[var(--text-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary text-xs px-2.5 py-0 h-8 border border-[var(--border-color)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Próximo
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
