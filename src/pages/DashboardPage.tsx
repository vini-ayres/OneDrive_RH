import React, { useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts'
import {
  MessageSquare, Users, FileText, ShieldOff,
  XCircle, Activity,
  RefreshCw, Download, Loader2
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { useDashboardData } from '../hooks/useDataApi'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#6b7280']

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
  subtitle?: string
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-sm text-[var(--text-secondary)] font-medium mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
    </div>
  )
}

function formatChartDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr.length === 10 ? dateStr : dateStr.slice(0, 10)), 'dd/MM', { locale: ptBR })
  } catch {
    return dateStr
  }
}

export function DashboardPage() {
  const { state } = useApp()
  const { theme } = state
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')
  const { statsQuery, chartsQuery } = useDashboardData(period)

  const isDark = theme === 'dark'
  const gridColor = isDark ? '#2a2a2a' : '#f1f5f9'
  const textColor = isDark ? '#94a3b8' : '#64748b'

  const chartData = useMemo(() => {
    const timeline = chartsQuery.data?.timeline ?? []
    return timeline.map((point) => ({
      ...point,
      date: formatChartDate(point.date),
    }))
  }, [chartsQuery.data?.timeline])

  const documentData = useMemo(() => {
    const docs = chartsQuery.data?.topDocuments ?? []
    return docs.map((d, i) => ({
      name: d.documentName,
      value: d.accesses,
      color: COLORS[i % COLORS.length],
    }))
  }, [chartsQuery.data?.topDocuments])

  const userData = useMemo(() => {
    return (chartsQuery.data?.topUsers ?? []).map((u) => ({
      userName: u.userName,
      queries: u.queries,
      role: u.email,
    }))
  }, [chartsQuery.data?.topUsers])

  const securityData = useMemo(() => {
    return (chartsQuery.data?.securityEvents ?? []).map((e) => ({
      date: formatChartDate(e.date),
      blocked: e.blocked,
      denied: e.denied,
      errors: e.errors,
    }))
  }, [chartsQuery.data?.securityEvents])

  const handleRefresh = () => {
    statsQuery.refetch()
    chartsQuery.refetch()
  }

  const isRefreshing = statsQuery.isFetching || chartsQuery.isFetching
  const stats = statsQuery.data

  const statCards = [
    {
      title: 'Consultas Hoje',
      value: stats?.queriesToday ?? '—',
      icon: <MessageSquare size={18} className="text-blue-600" />,
      color: 'bg-blue-50 dark:bg-blue-900/20',
      subtitle: 'Consultas registradas hoje',
    },
    {
      title: 'Usuários Ativos',
      value: stats?.activeUsers ?? '—',
      icon: <Users size={18} className="text-green-600" />,
      color: 'bg-green-50 dark:bg-green-900/20',
      subtitle: 'Últimos 30 minutos',
    },
    {
      title: 'Documentos Acessados',
      value: stats?.documentsAccessed ?? '—',
      icon: <FileText size={18} className="text-purple-600" />,
      color: 'bg-purple-50 dark:bg-purple-900/20',
      subtitle: 'Únicos este mês',
    },
    {
      title: 'Consultas Bloqueadas',
      value: stats?.blockedQueries ?? '—',
      icon: <ShieldOff size={18} className="text-yellow-600" />,
      color: 'bg-yellow-50 dark:bg-yellow-900/20',
      subtitle: 'Por política RBAC',
    },
    {
      title: 'Acessos Negados',
      value: stats?.deniedAccess ?? '—',
      icon: <XCircle size={18} className="text-red-600" />,
      color: 'bg-red-50 dark:bg-red-900/20',
      subtitle: 'Tentativas bloqueadas',
    },
    {
      title: 'Tempo Médio',
      value: stats ? `${stats.avgResponseTime}s` : '—',
      icon: <Activity size={18} className="text-indigo-600" />,
      color: 'bg-indigo-50 dark:bg-indigo-900/20',
      subtitle: 'Resposta da IA',
    },
  ]

  if (statsQuery.isLoading && chartsQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Dashboard Executivo</h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Monitoramento em tempo real · Atualizado {format(new Date(), "HH:mm 'de' dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
              {(['7d', '30d', '90d'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    period === p
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {p === '7d' ? '7 dias' : p === '30d' ? '30 dias' : '90 dias'}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              className={`btn-secondary text-xs px-3 py-1.5 ${isRefreshing ? 'opacity-70' : ''}`}
              disabled={isRefreshing}
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button className="btn-primary text-xs px-3 py-1.5" disabled>
              <Download size={13} />
              Exportar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {statCards.map((stat, i) => (
            <StatCard key={i} {...stat} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--text-primary)]">Consultas por Dia</h3>
              <span className="badge-blue">{period === '7d' ? 'Últimos 7 dias' : period === '30d' ? 'Últimos 30 dias' : 'Últimos 90 dias'}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: textColor }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1e1e1e' : '#fff',
                    border: `1px solid ${isDark ? '#2a2a2a' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="queries" name="Consultas" stroke="#3b82f6" strokeWidth={2} fill="url(#colorQueries)" />
                <Area type="monotone" dataKey="blocked" name="Bloqueadas" stroke="#ef4444" strokeWidth={2} fill="url(#colorBlocked)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Documentos Acessados</h3>
            {documentData.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nenhum documento acessado no período.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={documentData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {documentData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? '#2a2a2a' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {documentData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[var(--text-secondary)] truncate max-w-[120px]">{item.name}</span>
                      </div>
                      <span className="font-medium text-[var(--text-primary)]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Top Usuários por Consultas</h3>
            {userData.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Sem dados no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={userData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: textColor }} tickLine={false} />
                  <YAxis dataKey="userName" type="category" tick={{ fontSize: 11, fill: textColor }} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? '#2a2a2a' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="queries" name="Consultas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Eventos de Segurança</h3>
            {securityData.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Sem eventos no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={securityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: textColor }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: textColor }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: isDark ? '#1e1e1e' : '#fff', border: `1px solid ${isDark ? '#2a2a2a' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="blocked" name="Bloqueadas" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="denied" name="Negadas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="errors" name="Erros" fill="#6b7280" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
