import React, { useState, useMemo } from 'react'
import {
  Shield, Search, Filter, Download, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, Clock,
  User, FileText, Calendar, ChevronDown, ChevronUp
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AuditLog, UserRole } from '../types'
import { Badge } from '../components/ui/Badge'
import { getRoleLabel } from '../utils/rbac'

// Mock data para demonstração
const generateMockLogs = (): AuditLog[] => {
  const names = ['Ana Santos', 'Carlos Lima', 'Maria Oliveira', 'João Costa', 'Paula Ferreira', 'Roberto Silva']
  const roles: UserRole[] = ['rh', 'gestor', 'colaborador', 'diretoria']
  const queries = [
    'Localize o contrato de trabalho',
    'Mostre os holerites de janeiro',
    'Resuma o regulamento interno',
    'Liste documentos admissionais',
    'Buscar arquivos da pasta RH',
    'Contrato de prestação de serviços',
    'Documentos de rescisão',
    'Política de benefícios',
  ]
  const results = ['success', 'blocked', 'denied', 'error'] as const
  const documents = [
    'Regulamento_Interno_2024.pdf',
    'Contrato_Trabalho_Template.docx',
    'Politica_RH_v3.pdf',
    'Holerite_Template.xlsx',
    '',
  ]

  return Array.from({ length: 50 }, (_, i) => {
    const name = names[Math.floor(Math.random() * names.length)]
    const role = roles[Math.floor(Math.random() * roles.length)]
    const result = results[Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : 2) : 0]
    const doc = documents[Math.floor(Math.random() * documents.length)]
    const daysAgo = Math.floor(Math.random() * 30)
    const hoursAgo = Math.floor(Math.random() * 23)
    const ts = subDays(new Date(), daysAgo)
    ts.setHours(hoursAgo)

    return {
      id: `audit-${i}`,
      userId: `user-${i % 6}`,
      userName: name,
      userEmail: `${name.toLowerCase().replace(' ', '.')}@empresa.com.br`,
      action: 'chat_query',
      query: queries[Math.floor(Math.random() * queries.length)],
      documentAccessed: doc || undefined,
      documentPath: doc ? `/RH/Documentos/${doc}` : undefined,
      result,
      ipAddress: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      timestamp: ts,
      sessionId: `sess-${Math.random().toString(36).substr(2, 8)}`,
      role,
    }
  }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

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
  const [logs] = useState<AuditLog[]>(generateMockLogs())
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

  // Filtrar e ordenar logs
  const filteredLogs = useMemo(() => {
    let result = [...logs]

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(log =>
        log.userName.toLowerCase().includes(q) ||
        log.query.toLowerCase().includes(q) ||
        log.userEmail.toLowerCase().includes(q) ||
        (log.documentAccessed?.toLowerCase().includes(q) ?? false)
      )
    }

    if (filterResult !== 'all') {
      result = result.filter(log => log.result === filterResult)
    }

    if (filterUser) {
      result = result.filter(log =>
        log.userName.toLowerCase().includes(filterUser.toLowerCase())
      )
    }

    if (filterDateFrom) {
      const from = new Date(filterDateFrom)
      result = result.filter(log => log.timestamp >= from)
    }

    if (filterDateTo) {
      const to = new Date(filterDateTo)
      to.setHours(23, 59, 59)
      result = result.filter(log => log.timestamp <= to)
    }

    // Ordenar
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
  }, [logs, searchQuery, filterResult, filterUser, filterDateFrom, filterDateTo, sortField, sortDir])

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE)
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
    total: filteredLogs.length,
    success: filteredLogs.filter(l => l.result === 'success').length,
    blocked: filteredLogs.filter(l => l.result === 'blocked').length,
    denied: filteredLogs.filter(l => l.result === 'denied').length,
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
            <button className="btn-primary text-xs px-3 py-2">
              <RefreshCw size={13} />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Buscar por nome, consulta..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }}
                className="input-field pl-8 text-sm"
              />
            </div>
            <select
              value={filterResult}
              onChange={e => { setFilterResult(e.target.value); setCurrentPage(1) }}
              className="input-field text-sm"
            >
              <option value="all">Todos os resultados</option>
              <option value="success">✅ Sucesso</option>
              <option value="blocked">⚠️ Bloqueado</option>
              <option value="denied">❌ Negado</option>
              <option value="error">🔴 Erro</option>
            </select>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => { setFilterDateFrom(e.target.value); setCurrentPage(1) }}
                className="input-field text-sm flex-1"
              />
              <span className="text-[var(--text-muted)] text-xs">até</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => { setFilterDateTo(e.target.value); setCurrentPage(1) }}
                className="input-field text-sm flex-1"
              />
            </div>
            <button
              onClick={() => {
                setSearchQuery('')
                setFilterResult('all')
                setFilterUser('')
                setFilterDateFrom('')
                setFilterDateTo('')
                setCurrentPage(1)
              }}
              className="btn-secondary text-sm"
            >
              Limpar Filtros
            </button>
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
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <p className="font-medium text-[var(--text-muted)] mb-0.5">Email</p>
                              <p className="text-[var(--text-secondary)]">{log.userEmail}</p>
                            </div>
                            <div>
                              <p className="font-medium text-[var(--text-muted)] mb-0.5">Session ID</p>
                              <p className="text-[var(--text-secondary)] font-mono">{log.sessionId}</p>
                            </div>
                            <div>
                              <p className="font-medium text-[var(--text-muted)] mb-0.5">Data/Hora Completa</p>
                              <p className="text-[var(--text-secondary)]">
                                {format(log.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                              </p>
                            </div>
                            {log.documentPath && (
                              <div>
                                <p className="font-medium text-[var(--text-muted)] mb-0.5">Caminho</p>
                                <p className="text-[var(--text-secondary)] truncate">{log.documentPath}</p>
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
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[var(--border-color)] flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)]">
                Exibindo {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} de {filteredLogs.length} registros
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded border border-[var(--border-color)] disabled:opacity-40 hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Anterior
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i))
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 text-xs rounded border transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-[var(--border-color)] hover:bg-[var(--bg-tertiary)]'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded border border-[var(--border-color)] disabled:opacity-40 hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Próximo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
