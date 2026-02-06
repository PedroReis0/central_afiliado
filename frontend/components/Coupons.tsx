import React, { useState, useEffect, useMemo } from 'react';
import { Ticket, Ban, Check, Filter } from 'lucide-react';
import { Coupon } from '../types';
import { apiGet, apiPatch, apiDelete } from '../api';

type CouponStatus = 'active' | 'pending' | 'blocked' | 'all';

const Coupons: React.FC = () => {
  const [filter, setFilter] = useState<CouponStatus>('all');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const endpoint = filter === 'all' ? '/api/v1/coupons' : `/api/v1/coupons/${filter}`;
      const { data } = await apiGet<Coupon[]>(endpoint);
      setCoupons(data as Coupon[]);
    } catch (err) {
      console.error('Erro ao carregar cupons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, [filter]);

  const stats = useMemo(() => ({
    all: coupons.length,
    active: coupons.filter(c => c.status === 'active').length,
    pending: coupons.filter(c => c.status === 'pending').length,
    blocked: coupons.filter(c => c.status === 'blocked').length,
  }), [coupons]);

  const handleAction = async (id: string, action: 'approve' | 'block' | 'remove') => {
    try {
      if (action === 'remove') {
        await apiDelete(`/api/v1/coupons/${id}`);
      } else {
        await apiPatch(`/api/v1/coupons/${id}/${action}`, {});
      }
      loadCoupons();
    } catch (err) {
      alert(`Erro ao processar ação: ${action}`);
      console.error(err);
    }
  };

  const FilterButton = ({ status, label, count }: { status: CouponStatus, label: string, count: number }) => (
    <button
      onClick={() => setFilter(status)}
      className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all flex items-center gap-2 ${filter === status
          ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded text-[10px] ${filter === status ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
        }`}>
        {count}
      </span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cupons</h1>
          <p className="text-sm text-gray-500">Gerencie códigos promocionais e descontos ativos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterButton status="all" label="Todos" count={stats.all} />
          <FilterButton status="active" label="Ativos" count={stats.active} />
          <FilterButton status="pending" label="Pendentes" count={stats.pending} />
          <FilterButton status="blocked" label="Bloqueados" count={stats.blocked} />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 italic">Carregando cupons reais...</div>
      ) : coupons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map(coupon => (
            <div key={coupon.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="font-mono text-lg font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                    {coupon.code}
                  </span>
                  <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-wider ${coupon.status === 'active' ? 'bg-green-100 text-green-700' :
                      coupon.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                    {coupon.status === 'active' ? 'Ativo' : coupon.status === 'blocked' ? 'Bloqueado' : 'Pendente'}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 mb-2">{coupon.description}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Ticket size={12} />
                  <span>Expira em: <span className="font-semibold text-gray-600">{coupon.expires_at ? new Date(coupon.expires_at).toLocaleDateString('pt-BR') : 'Sem data'}</span></span>
                </div>
              </div>

              <div className="flex gap-2 mt-5 pt-4 border-t border-gray-50">
                {coupon.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAction(coupon.id, 'approve')}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Check size={14} /> Aprovar
                    </button>
                    <button
                      onClick={() => handleAction(coupon.id, 'block')}
                      className="px-3 bg-white border border-gray-200 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                    >
                      Bloquear
                    </button>
                  </>
                )}
                {coupon.status === 'active' && (
                  <button
                    onClick={() => handleAction(coupon.id, 'block')}
                    className="flex-1 bg-amber-50 text-amber-700 border border-amber-200 py-2 rounded-lg text-xs font-bold hover:bg-amber-100 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Ban size={14} /> Suspender Cupom
                  </button>
                )}
                {coupon.status === 'blocked' && (
                  <>
                    <button
                      onClick={() => handleAction(coupon.id, 'approve')}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check size={14} /> Reativar
                    </button>
                    <button
                      onClick={() => handleAction(coupon.id, 'remove')}
                      className="px-3 bg-red-50 text-red-600 py-2 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <Ticket size={48} className="text-gray-300 mb-4" />
          <p className="text-sm font-medium text-gray-500">Nenhum cupom encontrado para este filtro.</p>
          <button onClick={() => setFilter('all')} className="mt-2 text-blue-600 text-xs font-bold hover:underline">Ver todos os cupons</button>
        </div>
      )}
    </div>
  );
};

export default Coupons;