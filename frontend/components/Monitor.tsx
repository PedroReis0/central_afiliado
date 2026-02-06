
import React, { useState, useEffect, useMemo } from 'react';
import { Activity, AlertOctagon, ChevronLeft, ChevronRight, ArrowLeft, ExternalLink } from 'lucide-react';
import { MessageLog, ApiResponse } from '../types';
import { apiGet } from '../api';

const ITEMS_PER_PAGE = 10;

interface ErrorLog {
  id: string;
  event: string;
  message: string;
  timestamp: string;
}

const Monitor: React.FC = () => {
  const [isFullLogView, setIsFullLogView] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadLogs = async (page: number) => {
    setLoading(true);
    try {
      const { data, meta } = await apiGet<MessageLog[]>(`/api/v1/logs?page=${page}&limit=${ITEMS_PER_PAGE}`);
      setMessages(data as MessageLog[]);
      if (meta) {
        setTotalPages((meta as any).total_pages || 1);
        setTotalItems((meta as any).total_items || 0);
      }
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadErrors = async () => {
    try {
      const { data } = await apiGet<ErrorLog[]>('/api/v1/errors?limit=5');
      setErrors(data as ErrorLog[]);
    } catch (err) {
      console.error('Erro ao carregar erros:', err);
    }
  };

  const checkHealth = async () => {
    try {
      const { data } = await apiGet<{ status: string }>('/api/v1/health');
      setIsOnline((data as any).status === 'ok');
    } catch {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    checkHealth();
    loadErrors();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadLogs(currentPage);
  }, [currentPage]);

  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

  if (isFullLogView) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFullLogView(false)}
              className="p-2 bg-white border border-gray-200 hover:border-blue-500 rounded-xl transition-all text-gray-500"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Histórico de Mensagens</h1>
              <p className="text-sm text-gray-500">Log completo de todos os disparos processados pela IA.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || loading}
              className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-xs font-bold px-2 text-gray-600">Página {currentPage} de {totalPages}</span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || loading}
              className="p-1.5 text-gray-400 hover:text-gray-900 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] text-gray-400 uppercase font-bold bg-gray-50/50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 tracking-widest">ID Log</th>
                  <th className="px-6 py-4 tracking-widest">Data / Horário</th>
                  <th className="px-6 py-4 tracking-widest">Instância</th>
                  <th className="px-6 py-4 tracking-widest">Grupo Destino</th>
                  <th className="px-6 py-4 tracking-widest">Status</th>
                  <th className="px-6 py-4 tracking-widest">Latência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-[10px] text-gray-400">#{msg.id.substring(0, 8)}</td>
                    <td className="px-6 py-4 font-medium text-gray-600">
                      {new Date(msg.received_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{msg.instance}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{msg.group}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${msg.status === 'processed' ? 'bg-green-100 text-green-700 border border-green-200' :
                          msg.status === 'failed' ? 'bg-red-100 text-red-700 border border-red-200' :
                            'bg-gray-100 text-gray-500 border border-gray-200'
                        }`}>
                        {msg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{msg.latency}s</td>
                  </tr>
                ))}
                {messages.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400 italic text-sm">Nenhum log encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 px-2">
          <p>Exibindo {messages.length} de {totalItems} registros totais</p>
          <div className="flex gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg font-bold hover:bg-gray-50 disabled:opacity-50 transition-all active:scale-95 text-gray-700"
            >
              Anterior
            </button>
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages || loading}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-bold hover:bg-black disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-gray-900/10"
            >
              Próxima Página
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Monitor de Processamento</h1>
        <div className="flex items-center gap-2">
          <span className={`flex h-2 w-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          <span className={`text-xs font-bold uppercase tracking-widest ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
            {isOnline ? 'Sistema Online' : 'Sistema Offline'}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-colors">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
              <Activity size={18} />
            </div>
            <h3 className="font-bold text-gray-800">Últimas Mensagens</h3>
          </div>
          <button
            onClick={() => {
              setIsFullLogView(true);
              setCurrentPage(1);
            }}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-xs font-bold bg-blue-50 px-3 py-1.5 rounded-lg transition-all active:scale-95 border border-blue-100"
          >
            Ver Tudo <ExternalLink size={14} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-gray-400 uppercase font-bold bg-white transition-colors">
              <tr>
                <th className="px-6 py-4">Recebido</th>
                <th className="px-6 py-4">Instância</th>
                <th className="px-6 py-4">Grupo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Latência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {messages.slice(0, 5).map((msg) => (
                <tr key={msg.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-gray-600">
                    {new Date(msg.received_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{msg.instance}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{msg.group}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${msg.status === 'processed' ? 'bg-green-100 text-green-700' :
                        msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                          msg.status === 'ignored' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'
                      }`}>
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">{msg.latency}s</td>
                </tr>
              ))}
              {messages.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400 italic text-sm">Nenhuma mensagem recente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden transition-colors">
        <div className="p-5 border-b border-red-50 bg-red-50/50 flex items-center gap-3">
          <div className="p-2 bg-red-600 text-white rounded-xl shadow-lg shadow-red-500/20">
            <AlertOctagon size={18} />
          </div>
          <h3 className="font-bold text-red-900">Erros Recentes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-red-800 uppercase font-bold bg-white">
              <tr>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Evento</th>
                <th className="px-6 py-4">Mensagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-50">
              {errors.map((err) => (
                <tr key={err.id} className="hover:bg-red-50/30 transition-colors">
                  <td className="px-6 py-4 font-mono text-red-700/60">
                    {new Date(err.timestamp).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 font-bold text-red-700">{err.event}</td>
                  <td className="px-6 py-4 text-red-900/70">{err.message}</td>
                </tr>
              ))}
              {errors.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-400 italic text-sm">Nenhum erro registrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Monitor;
