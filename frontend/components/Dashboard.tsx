
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, MessageSquare, Zap, TrendingUp, Filter, ChevronDown, Check, Calendar, X } from 'lucide-react';
import { apiGet } from '../api';

type TimeRange = '7days' | 'month' | 'today' | 'yesterday' | 'last30' | 'custom';

interface StatsData {
  range: { start: string; end: string };
  totals: {
    ofertas_enviadas: number;
    ofertas_recebidas: number;
    aproveitamento: number;
    produtos_pendentes: number;
    tokens_total: number;
  };
  series: {
    flow: Array<{ day: string; recebidas: number; enviadas: number }>;
    tokens: Array<{ day: string; tokens: number }>;
  };
}

const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex items-start justify-between hover:shadow-md transition-all">
    <div>
      <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 mt-1">{value}</h3>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-lg ${color} shadow-lg shadow-current/10`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      let url = `/api/v1/stats?range=${timeRange === 'last30' ? 'month' : timeRange === 'yesterday' ? '7days' : timeRange}`;
      if (timeRange === 'custom' && startDate && endDate) {
        url = `/api/v1/stats?range=custom&start=${startDate}&end=${endDate}`;
      }
      const { data } = await apiGet<StatsData>(url);
      setStats(data as StatsData);
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [timeRange]);

  const handleFilterChange = (range: TimeRange) => {
    if (range === 'custom') {
      setIsCustomModalOpen(true);
      setIsFilterMenuOpen(false);
      return;
    }
    setTimeRange(range);
    setIsFilterMenuOpen(false);
  };

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      setTimeRange('custom');
      setIsCustomModalOpen(false);
      loadStats();
    }
  };

  const getFilterLabel = () => {
    switch (timeRange) {
      case 'today': return 'Hoje';
      case 'yesterday': return 'Ontem';
      case 'last30': return 'Últimos 30 dias';
      case 'month': return 'Este Mês';
      case '7days': return '7 Dias';
      case 'custom': 
        if (startDate && endDate) {
          const start = new Date(startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          const end = new Date(endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          return `${start} - ${end}`;
        }
        return 'Personalizado';
      default: return 'Filtros';
    }
  };

  const formatTokens = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toString();
  };

  const flowData = stats?.series?.flow.map(d => ({
    name: new Date(d.day).toLocaleDateString('pt-BR', { weekday: 'short' }),
    sent: d.enviadas,
    received: d.recebidas
  })) || [];

  const tokensData = stats?.series?.tokens.map(d => ({
    name: new Date(d.day).toLocaleDateString('pt-BR', { weekday: 'short' }),
    tokens: d.tokens
  })) || [];

  return (
    <div className="space-y-6 text-gray-900 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm relative transition-colors duration-200">
          <button 
            onClick={() => handleFilterChange('7days')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeRange === '7days' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            7 Dias
          </button>
          <button 
            onClick={() => handleFilterChange('month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${timeRange === 'month' ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            Este Mês
          </button>
          
          <div className="h-4 w-px bg-gray-200 mx-1"></div>
          
          <button 
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${['today', 'yesterday', 'last30', 'custom'].includes(timeRange) ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <Filter size={12} />
            {getFilterLabel()}
            <ChevronDown size={12} className={`transition-transform ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFilterMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsFilterMenuOpen(false)}></div>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in duration-200">
                <button 
                  onClick={() => handleFilterChange('today')}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between text-gray-700"
                >
                  Hoje {timeRange === 'today' && <Check size={14} className="text-blue-600" />}
                </button>
                <button 
                  onClick={() => handleFilterChange('yesterday')}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between text-gray-700"
                >
                  Ontem {timeRange === 'yesterday' && <Check size={14} className="text-blue-600" />}
                </button>
                <button 
                  onClick={() => handleFilterChange('last30')}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between text-gray-700"
                >
                  Últimos 30 dias {timeRange === 'last30' && <Check size={14} className="text-blue-600" />}
                </button>
                <div className="border-t border-gray-100 my-1"></div>
                <button 
                  onClick={() => handleFilterChange('custom')}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between text-gray-700"
                >
                  Personalizado... {timeRange === 'custom' && <Check size={14} className="text-blue-600" />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in fade-in duration-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" />
                Período Personalizado
              </h3>
              <button onClick={() => setIsCustomModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleApplyCustomDate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data Início</label>
                <input 
                  type="date" 
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Data Fim</label>
                <input 
                  type="date" 
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900" 
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-colors shadow-lg shadow-gray-900/10"
                >
                  Aplicar Filtro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && !stats ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-sm italic">
          Carregando indicadores reais...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              title="Ofertas Enviadas" 
              value={stats?.totals.ofertas_enviadas.toLocaleString('pt-BR') || '0'} 
              icon={MessageSquare} 
              color="bg-blue-600" 
              subtext={`${stats?.totals.ofertas_recebidas.toLocaleString('pt-BR')} recebidas`}
            />
            <StatCard 
              title="Aproveitamento" 
              value={`${stats?.totals.aproveitamento || 0}%`} 
              icon={TrendingUp} 
              color="bg-green-500" 
              subtext="Sucesso no envio" 
            />
            <StatCard 
              title="Pend. Produtos" 
              value={stats?.totals.produtos_pendentes.toString() || '0'} 
              icon={Package} 
              color="bg-amber-500" 
              subtext="Requer atenção" 
            />
            <StatCard 
              title="Tokens IA Consumidos" 
              value={formatTokens(stats?.totals.tokens_total || 0)} 
              icon={Zap} 
              color="bg-purple-600" 
              subtext={`Período: ${getFilterLabel()}`} 
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-colors duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">Fluxo de Mensagens</h3>
                <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded">
                  {getFilterLabel()}
                </span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={flowData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} tick={{fill: '#6b7280'}} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `${value/1000}k` : value} tick={{fill: '#6b7280'}} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                        padding: '12px',
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        color: '#fff'
                      }}
                      itemStyle={{ fontSize: '12px', fontWeight: '600' }}
                    />
                    <Area type="monotone" dataKey="sent" stroke="#2563eb" fillOpacity={1} fill="url(#colorSent)" name="Enviadas" strokeWidth={2} />
                    <Area type="monotone" dataKey="received" stroke="#10b981" fillOpacity={1} fill="url(#colorReceived)" name="Recebidas" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col transition-colors duration-200">
              <h3 className="text-lg font-bold text-gray-800 mb-6">Consumo de IA</h3>
              <div className="flex-1 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tokensData}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} hide />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        color: '#fff'
                      }}
                    />
                    <Area type="monotone" dataKey="tokens" stroke="#9333ea" fillOpacity={1} fill="url(#colorTokens)" name="Tokens" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-purple-50 rounded-lg text-xs text-purple-700 border border-purple-100 flex items-center gap-2">
                <Zap size={14} />
                <span>Consumo atualizado em tempo real via API v1.</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
