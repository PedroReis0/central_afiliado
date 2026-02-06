
import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Radio, Shield, Users } from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '../api';

interface Instance {
    id: string;
    name: string;
    status: string;
    battery: number | null;
}

interface Group {
    id: string;
    group_id: string;
    name: string;
    instance_id: string;
    active: boolean;
}

const Integrations: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'instances' | 'send' | 'receive'>('instances');
    const [instances, setInstances] = useState<Instance[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);

    const loadInstances = async () => {
        setLoading(true);
        try {
            const { data } = await apiGet<Instance[]>('/api/v1/evolution/instances');
            setInstances(data as Instance[]);
        } catch (err) {
            console.error('Erro ao carregar instâncias:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadGroups = async () => {
        setLoading(true);
        try {
            const { data } = await apiGet<Group[]>('/api/v1/groups');
            setGroups(data as Group[]);
        } catch (err) {
            console.error('Erro ao carregar grupos:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'instances') loadInstances();
        else loadGroups();
    }, [activeTab]);

    const handleSyncInstance = async (instanceId: string) => {
        try {
            await apiPost('/api/v1/evolution/sync', { instance_id: instanceId });
            if (activeTab === 'instances') loadInstances();
            else loadGroups();
        } catch (err) {
            alert('Erro ao sincronizar instância');
            console.error(err);
        }
    };

    const handleToggleGroup = async (groupId: string, currentStatus: boolean) => {
        try {
            await apiPatch(`/api/v1/groups/${groupId}/toggle`, { active: !currentStatus });
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, active: !currentStatus } : g));
        } catch (err) {
            alert('Erro ao alterar status do grupo');
            console.error(err);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Automação & Conexões</h1>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-6" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('instances')}
                        className={`border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2 ${activeTab === 'instances' ? 'border-blue-50 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        <Smartphone size={16} /> Instâncias (Evolution)
                    </button>
                    <button
                        onClick={() => setActiveTab('send')}
                        className={`border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2 ${activeTab === 'send' ? 'border-blue-50 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        <Radio size={16} /> Grupos de Envio
                    </button>
                    <button
                        onClick={() => setActiveTab('receive')}
                        className={`border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2 ${activeTab === 'receive' ? 'border-blue-50 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        <Shield size={16} /> Filtro de Entrada
                    </button>
                </nav>
            </div>

            {loading && <div className="text-sm text-gray-400 italic">Carregando dados da API...</div>}

            {activeTab === 'instances' && !loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {instances.map((inst) => (
                        <div key={inst.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${inst.status === 'open' || inst.status === 'connected' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                        <Smartphone size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{inst.name}</h3>
                                        <p className="text-[10px] text-gray-400 font-mono">{inst.id}</p>
                                    </div>
                                </div>
                                <div className={`h-3 w-3 rounded-full ${inst.status === 'open' || inst.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
                            </div>
                            <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                                <span>Bateria</span>
                                <span className="font-mono">{inst.battery !== null ? `${inst.battery}%` : '--'}</span>
                            </div>
                            <button
                                onClick={() => handleSyncInstance(inst.id)}
                                className="w-full py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors"
                            >
                                <RefreshCw size={14} /> Sincronizar Grupos
                            </button>
                        </div>
                    ))}
                    {instances.length === 0 && (
                        <div className="col-span-full py-10 text-center text-gray-400 italic bg-white rounded-xl border border-dashed border-gray-200">
                            Nenhuma instância Evolution conectada no backend.
                        </div>
                    )}
                </div>
            )}

            {(activeTab === 'send' || activeTab === 'receive') && !loading && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h3 className="font-bold text-gray-700">
                            {activeTab === 'send' ? 'Grupos para despacho de ofertas' : 'Whitelist de Entrada'}
                        </h3>
                    </div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Nome do Grupo</th>
                                <th className="px-6 py-3">ID / Instância</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {groups.map(g => (
                                <tr key={g.id}>
                                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                                        {activeTab === 'receive' ? <Shield size={16} className="text-gray-400" /> : <Users size={16} className="text-gray-400" />}
                                        {g.name}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 text-xs">
                                        <div className="font-mono">{g.group_id}</div>
                                        <div className="text-[10px] opacity-60 uppercase">{g.instance_id}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {g.active ? (
                                            <span className={`font-bold text-[10px] px-2 py-1 rounded ${activeTab === 'receive' ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50'}`}>
                                                {activeTab === 'receive' ? 'MONITORANDO' : 'ATIVO'}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 font-bold text-[10px] bg-gray-100 px-2 py-1 rounded">INATIVO</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={g.active}
                                                    onChange={() => handleToggleGroup(g.id, g.active)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {groups.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-gray-400 italic">
                                        Nenhum grupo sincronizado. Clique em "Sincronizar Grupos" na aba de Instâncias.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Integrations;