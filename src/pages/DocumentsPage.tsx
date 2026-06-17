import React, { useState } from 'react'
import { FileText, Search, Folder, Calendar, ExternalLink, Filter, File, FileSpreadsheet, Image, Archive } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { isSecureUrl } from '../utils/security'

// Mock documents
const mockDocuments = [
  { id: '1', name: 'Regulamento_Interno_2024.pdf', type: 'pdf', size: '2.4 MB', folder: 'RH/Políticas', modifiedAt: new Date(), webUrl: '#' },
  { id: '2', name: 'Política_de_Benefícios_v3.docx', type: 'docx', size: '1.1 MB', folder: 'RH/Políticas', modifiedAt: subDays(new Date(), 2), webUrl: '#' },
  { id: '3', name: 'Contrato_Trabalho_Template.docx', type: 'docx', size: '890 KB', folder: 'RH/Contratos', modifiedAt: subDays(new Date(), 5), webUrl: '#' },
  { id: '4', name: 'Organograma_2024.xlsx', type: 'xlsx', size: '340 KB', folder: 'RH/Estrutura', modifiedAt: subDays(new Date(), 7), webUrl: '#' },
  { id: '5', name: 'Plano_de_Cargos_Salários.pdf', type: 'pdf', size: '5.2 MB', folder: 'RH/Cargos', modifiedAt: subDays(new Date(), 10), webUrl: '#' },
  { id: '6', name: 'Manual_de_Onboarding.pdf', type: 'pdf', size: '3.8 MB', folder: 'RH/Admissão', modifiedAt: subDays(new Date(), 14), webUrl: '#' },
  { id: '7', name: 'Política_Home_Office.pdf', type: 'pdf', size: '780 KB', folder: 'RH/Políticas', modifiedAt: subDays(new Date(), 20), webUrl: '#' },
  { id: '8', name: 'Código_de_Conduta.pdf', type: 'pdf', size: '1.5 MB', folder: 'RH/Normas', modifiedAt: subDays(new Date(), 30), webUrl: '#' },
]

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText size={18} className="text-red-500" />,
  docx: <File size={18} className="text-blue-500" />,
  doc: <File size={18} className="text-blue-500" />,
  xlsx: <FileSpreadsheet size={18} className="text-green-500" />,
  xls: <FileSpreadsheet size={18} className="text-green-500" />,
  png: <Image size={18} className="text-purple-500" />,
  jpg: <Image size={18} className="text-purple-500" />,
  zip: <Archive size={18} className="text-yellow-500" />,
}

export function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  const filtered = mockDocuments.filter(doc => {
    const matchSearch = doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.folder.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || doc.type === filterType
    return matchSearch && matchType
  })

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={20} className="text-blue-600" />
            Documentos Recentes
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Documentos acessados recentemente no OneDrive e SharePoint
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9 text-sm"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="input-field text-sm sm:w-40"
          >
            <option value="all">Todos os tipos</option>
            <option value="pdf">PDF</option>
            <option value="docx">Word</option>
            <option value="xlsx">Excel</option>
          </select>
          <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'list' ? 'bg-[var(--bg-primary)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === 'grid' ? 'bg-[var(--bg-primary)] shadow-sm text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
              }`}
            >
              Grade
            </button>
          </div>
        </div>

        {/* Documents */}
        {viewMode === 'list' ? (
          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden sm:table-cell">Pasta</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden md:table-cell">Tamanho</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider hidden lg:table-cell">Modificado</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {FILE_ICONS[doc.type] || <FileText size={18} className="text-gray-400" />}
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[200px]">
                          {doc.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <Folder size={12} />
                        <span>{doc.folder}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-[var(--text-muted)]">{doc.size}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                        <Calendar size={11} />
                        <span>{format(doc.modifiedAt, 'dd/MM/yyyy', { locale: ptBR })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isSecureUrl(doc.webUrl) ? (
                        <a
                          href={doc.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          <ExternalLink size={13} />
                          Abrir
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum documento encontrado</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(doc => (
              <div key={doc.id} className="card hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer group">
                <div className="flex items-center justify-center h-16 bg-[var(--bg-tertiary)] rounded-lg mb-3 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors">
                  <span className="scale-125">{FILE_ICONS[doc.type] || <FileText size={24} />}</span>
                </div>
                <p className="text-xs font-medium text-[var(--text-primary)] truncate mb-1">{doc.name}</p>
                <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                  <Calendar size={9} />
                  {format(doc.modifiedAt, 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
