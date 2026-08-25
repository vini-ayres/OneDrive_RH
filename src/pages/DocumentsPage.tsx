import React, { useState } from 'react'
import { FileText, Search, Folder, Calendar, ExternalLink, Filter, File, FileSpreadsheet, Image, Archive, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { isSecureUrl } from '../utils/security'
import { useRecentDocuments } from '../hooks/useDataApi'
import { recordDocumentAccess } from '../services/apiService'
import { useApp } from '../contexts/AppContext'
import { useQueryClient } from '@tanstack/react-query'

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText size={18} className="text-red-500" />,
  docx: <File size={18} className="text-blue-500" />,
  doc: <File size={18} className="text-blue-500" />,
  xlsx: <FileSpreadsheet size={18} className="text-green-500" />,
  xls: <FileSpreadsheet size={18} className="text-green-500" />,
  png: <Image size={18} className="text-purple-500" />,
  jpg: <Image size={18} className="text-purple-500" />,
  jpeg: <Image size={18} className="text-purple-500" />,
  zip: <Archive size={18} className="text-yellow-500" />,
  txt: <FileText size={18} className="text-gray-500" />,
}

export function DocumentsPage() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const { data: documents = [], isLoading, refetch, isFetching, isError } = useRecentDocuments(50)
  const { state } = useApp()
  const queryClient = useQueryClient()

  const filtered = documents.filter(doc => {
    const matchSearch = doc.name.toLowerCase().includes(search.toLowerCase()) ||
      doc.folder.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || doc.type === filterType
    return matchSearch && matchType
  })

  const handleOpen = (doc: (typeof documents)[number]) => {
    if (!state.user) return
    recordDocumentAccess(state.user, doc.id || doc.webUrl || doc.name, {
      name: doc.name,
      path: doc.folder,
      webUrl: doc.webUrl,
      docType: doc.type,
      source: 'direct',
    })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['recent-documents'] })
      })
      .catch(() => {
        // não bloqueia a abertura
      })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-[var(--text-secondary)]">Não foi possível carregar os documentos recentes.</p>
        <button onClick={() => refetch()} className="btn-secondary text-xs px-3 py-1.5">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <FileText size={20} className="text-blue-600" />
              Documentos Recentes
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Documentos acessados recentemente no OneDrive e SharePoint
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className={`btn-secondary text-xs px-3 py-1.5 ${isFetching ? 'opacity-70' : ''}`}
            disabled={isFetching}
          >
            Atualizar
          </button>
        </div>

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
          <div className="flex gap-2">
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="input-field pl-9 pr-8 text-sm appearance-none"
              >
                <option value="all">Todos os tipos</option>
                <option value="pdf">PDF</option>
                <option value="docx">Word</option>
                <option value="xlsx">Excel</option>
              </select>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <FileText size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">Nenhum documento acessado recentemente.</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Documentos citados no chat ou abertos manualmente aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                  <th className="text-left px-4 py-2.5 font-medium text-[var(--text-secondary)]">Documento</th>
                  <th className="text-left px-4 py-2.5 font-medium text-[var(--text-secondary)] hidden sm:table-cell">Pasta</th>
                  <th className="text-left px-4 py-2.5 font-medium text-[var(--text-secondary)] hidden md:table-cell">Acessado</th>
                  <th className="text-right px-4 py-2.5 font-medium text-[var(--text-secondary)]">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => (
                  <tr key={doc.id} className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-tertiary)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {FILE_ICONS[doc.type] || <File size={18} className="text-gray-400" />}
                        <span className="font-medium text-[var(--text-primary)] truncate max-w-[200px]">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-[var(--text-muted)]">
                        <Folder size={12} />
                        <span className="truncate max-w-[150px]">{doc.folder}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-[var(--text-muted)]">
                      <div className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(doc.modifiedAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {doc.webUrl && isSecureUrl(doc.webUrl) ? (
                        <a
                          href={doc.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          onClick={() => handleOpen(doc)}
                        >
                          <ExternalLink size={12} />
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
          </div>
        )}
      </div>
    </div>
  )
}
