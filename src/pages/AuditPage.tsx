import React, { useState, useMemo } from 'react'
import {
  Shield, Search, Filter, FilterX, Download, RefreshCw,
  CheckCircle, AlertTriangle,
  FileText, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AuditLog } from '../types'
import { Badge } from '../components/ui/Badge'
import { getRoleLabel } from '../utils/rbac'
import { useAuditLogs } from '../hooks/useDataApi'
import { isSecureUrl, documentLinkLabel } from '../utils/security'

const RESULT_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircle size={14} className="text-green-500" />,
  error: <AlertTriangle size={14} className="text-orange-500" />,
  blocked: <AlertTriangle size={14} className="text-orange-500" />,
  denied: <AlertTriangle size={14} className="text-orange-500" />,
}

const RESULT_LABELS: Record<string, string> = {
  success: 'Sucesso',
  error: 'Falha da IA',
  blocked: 'Falha da IA',
  denied: 'Falha da IA',
}

const RESULT_VARIANTS: Record<string, 'green' | 'yellow' | 'red' | 'default'> = {
  success: 'green',
  error: 'red',
  blocked: 'red',
  denied: 'red',
}

function auditDocumentLinks(log: AuditLog): Array<{ name: string; url: string }> {
  if (log.documentLinks?.length) {
    return log.documentLinks
      .filter((link) => isSecureUrl(link.url))
      .map((link) => ({
        url: link.url,
        name: documentLinkLabel(link.name || log.documentAccessed, link.url),
      }))
  }

  const urls = log.documentUrls?.length
    ? log.documentUrls
    : log.documentUrl
      ? [log.documentUrl]
      : []

  return urls
    .filter((url) => isSecureUrl(url))
    .map((url, index) => ({
      url,
      name: documentLinkLabel(index === 0 ? log.documentAccessed : undefined, url),
    }))
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
  const apiCounts = data?.counts

  // Filtrar e ordenar logs
  const filteredLogs = useMemo(() => {
    let result = [...logs]

    if (filterUser) {
      result = result.filter(log =>
        log.userName.toLowerCase().includes(filterUser.toLowerCase())
      )
    }

    result = result.filter(log => (log.ipAddress || '').trim().toLowerCase() !== 'browser')

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
    const headers = ['Data', 'Usuário', 'Email', 'Perfil', 'Consulta', 'Documento', 'Link', 'Resultado']
    const rows = filteredLogs.map(log => [
      format(log.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR }),
      log.userName,
      log.userEmail,
      getRoleLabel(log.role),
      `"${log.query.replace(/"/g, '""')}"`,
      log.documentAccessed || '',
      log.documentUrl || log.documentUrls?.[0] || '',
      RESULT_LABELS[log.result],
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
    total: apiCounts?.total ?? totalFromApi,
    success: apiCounts?.success ?? filteredLogs.filter(l => l.result === 'success').length,
    error: apiCounts?.error ?? filteredLogs.filter(l => l.result === 'error').length,
  }
  const slaPercent =
    (stats.success + stats.error) === 0
      ? 100
      : Math.round((stats.success / (stats.success + stats.error)) * 1000) / 10

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
              Somente consultas enviadas à IA (chat e upload)
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
            <div className="w-8 h-8 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
              <AlertTriangle size={15} className="text-orange-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{stats.error}</p>
              <p className="text-xs text-[var(--text-muted)]">Falhas da IA</p>
            </div>
          </div>
          <div className="card p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
              <CheckCircle size={15} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{slaPercent}%</p>
              <p className="text-xs text-[var(--text-muted)]">SLA da IA</p>
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
              <option value="error">⚠️ Falha de Consulta da IA</option>
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
                      <td className="px-4 py-3 w-[38%] min-w-[260px] max-w-[480px]">
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 break-words leading-relaxed" title={log.query}>
                          {log.query}
                        </p>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        {(() => {
                          const links = auditDocumentLinks(log)
                          const primary = links[0]
                          const label = primary
                            ? primary.name
                            : log.documentAccessed && !/^https?:\/\//i.test(log.documentAccessed)
                              ? log.documentAccessed
                              : ''

                          if (!label && !primary) {
                            return <span className="text-xs text-[var(--text-muted)]">—</span>
                          }

                          return (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText size={11} className="text-blue-500 flex-shrink-0" />
                              {primary ? (
                                <>
                                  <a
                                    href={primary.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate"
                                    title={primary.name}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {primary.name}
                                  </a>
                                  <a
                                    href={primary.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-700 flex-shrink-0"
                                    title="Abrir documento"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                </>
                              ) : (
                                <span className="text-xs text-[var(--text-secondary)] truncate">{label}</span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={RESULT_VARIANTS[log.result]}>
                          <span className="flex items-center gap-1">
                            {RESULT_ICONS[log.result]}
                            {RESULT_LABELS[log.result]}
                          </span>
                        </Badge>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedRow === log.id && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 bg-[var(--bg-tertiary)]">
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
                            <div className="min-w-0 sm:col-span-2 xl:col-span-4">
                              <p className="font-medium text-[var(--text-muted)] mb-0.5">Consulta</p>
                              <p className="text-[var(--text-secondary)] break-words whitespace-pre-wrap">{log.query}</p>
                            </div>
                            {log.documentPath && (
                              <div className="min-w-0 sm:col-span-2 xl:col-span-4">
                                <p className="font-medium text-[var(--text-muted)] mb-0.5">Caminho</p>
                                <p className="text-[var(--text-secondary)] break-all">{log.documentPath}</p>
                              </div>
                            )}
                            {auditDocumentLinks(log).length > 0 && (
                              <div className="min-w-0 sm:col-span-2 xl:col-span-4">
                                <p className="font-medium text-[var(--text-muted)] mb-0.5">Documento</p>
                                <div className="space-y-1">
                                  {auditDocumentLinks(log).map((link) => (
                                      <a
                                        key={link.url}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                                        title="Abrir documento"
                                      >
                                        <ExternalLink size={12} className="flex-shrink-0" />
                                        {link.name}
                                      </a>
                                  ))}
                                </div>
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
                    <td colSpan={5} className="px-4 py-12 text-center text-[var(--text-muted)] text-sm">
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
