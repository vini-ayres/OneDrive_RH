import React, { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts'
import {
  MessageSquare, Users, FileText, ShieldOff,
  XCircle, TrendingUp, TrendingDown, Activity,
  RefreshCw, Download
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Dados mock para demonstração
const generateMockData = () => {
  return Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i)
    return {
      date: format(date, 'dd/MM', { locale: ptBR }),
      queries: Math.floor(Math.random() * 150) + 50,
      users: Math.floor(Math.random() * 30) + 10,
      blocked: Math.floor(Math.random() * 20) + 2,
      documents: Math.floor(Math.random() * 80) + 20,
    }
  })
}

const mockUserData = [
  { userName: 'Ana Santos', queries: 45, role: 'RH' },
  { userName: 'Carlos Lima', queries: 38, role: 'Gestor' },
  { userName: 'Maria Oliveira', queries: 32, role: 'RH' },
  { userName: 'João Costa', queries: 28, role: 'Diretoria' },
  { userName: 'Paula Ferreira', queries: 22, role: 'Gestor' },
]

const mockDocumentData = [
  { name: 'Regulamento Interno', value: 89, color: '#3b82f6' },
  { name: 'Contratos', value: 67, color: '#8b5cf6' },
  { name: 'Holerites', value: 54, color: '#10b981' },
  { name: 'Políticas RH', value: 43, color: '#f59e0b' },
  { name: 'Outros', value: 31, color: '#6b7280' },
]

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#6b7280']

interface StatCardProps {
  title: string
  value: number | string
  change?: number
  icon: React.ReactNode
  color: string
  subtitle?: string
}

function StatCard({ title, value, change, icon, color, subtitle }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500'
          }`}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      <p className="text-sm text-[var(--text-secondary)] font-medium mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
    </div>
  )
}

export function DashboardPage() {
  const { state } = useApp()
  const { theme } = state
  const [period, setPeriod] = useState<'7d' | '30d'>('7d')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [chartData] = useState(generateMockData())

  const isDark = theme === 'dark'
  const gridColor = isDark ? '#2a2a2a' : '#f1f5f9'
  const textColor = isDark ? '#94a3b8' : '#64748b'

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const stats = [
    {
      title: 'Consultas Hoje',
      value: '247',
      change: 12,
      icon: <MessageSquare size={18} className="text-blue-600" />,
      color: 'bg-blue-50 dark:bg-blue-900/20',
      subtitle: 'Meta diária: 300',
    },
    {
      title: 'Usuários Ativos',
      value: '34',
      change: 8,
      icon: <Users size={18} className="text-green-600" />,
      color: 'bg-green-50 dark:bg-green-900/20',
      subtitle: 'De 89 colaboradores',
    },
    {
      title: 'Documentos Acessados',
      value: '1.284',
      change: 5,
      icon: <FileText size={18} className="text-purple-600" />,
      color: 'bg-purple-50 dark:bg-purple-900/20',
      subtitle: 'Únicos este mês',
    },
    {
      title: 'Consultas Bloqueadas',
      value: '18',
      change: -3,
      icon: <ShieldOff size={18} className="text-yellow-600" />,
      color: 'bg-yellow-50 dark:bg-yellow-900/20',
      subtitle: 'Por política RBAC',
    },
    {
      title: 'Acessos Negados',
      value: '7',
      change: -15,
      icon: <XCircle size={18} className="text-red-600" />,
      color: 'bg-red-50 dark:bg-red-900/20',
      subtitle: 'Tentativas bloqueadas',
    },
    {
      title: 'Tempo Médio',
      value: '2.4s',
      change: -8,
      icon: <Activity size={18} className="text-indigo-600" />,
      color: 'bg-indigo-50 dark:bg-indigo-900/20',
      subtitle: 'Resposta da IA',
    },
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Dashboard Executivo</h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Monitoramento em tempo real · Atualizado {format(new Date(), "HH:mm 'de' dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
              {(['7d', '30d'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    period === p
                      ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {p === '7d' ? '7 dias' : '30 dias'}
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
            <button className="btn-primary text-xs px-3 py-1.5">
              <Download size={13} />
              Exportar
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((stat, i) => (
            <StatCard key={i} {...stat} />
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queries over time */}
          <div className="lg:col-span-2 card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--text-primary)]">Consultas por Dia</h3>
              <span className="badge-blue">Últimos 7 dias</span>
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
                <Area
                  type="monotone"
                  dataKey="queries"
                  name="Consultas"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#colorQueries)"
                />
                <Area
                  type="monotone"
                  dataKey="blocked"
                  name="Bloqueadas"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#colorBlocked)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Documents pie chart */}
          <div className="card">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Documentos Acessados</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={mockDocumentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {mockDocumentData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1e1e1e' : '#fff',
                    border: `1px solid ${isDark ? '#2a2a2a' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {mockDocumentData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[var(--text-secondary)] truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-medium text-[var(--text-primary)]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Users bar chart */}
          <div className="card">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Top Usuários por Consultas</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={mockUserData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: textColor }} tickLine={false} />
                <YAxis
                  dataKey="userName"
                  type="category"
                  tick={{ fontSize: 11, fill: textColor }}
                  tickLine={false}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1e1e1e' : '#fff',
                    border: `1px solid ${isDark ? '#2a2a2a' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="queries" name="Consultas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Security events */}
          <div className="card">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Eventos de Segurança</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
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
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="blocked" name="Bloqueadas" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="users" name="Usuários" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
