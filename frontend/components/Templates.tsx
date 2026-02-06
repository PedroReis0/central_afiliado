
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Edit3, Trash2, CheckCircle2, AlertCircle, Tag } from 'lucide-react';
import { Template } from '../types';
import { apiGet, apiPost, apiPatch, apiDelete } from '../api';
import TemplateModal from './TemplateModal';

const Templates: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(undefined);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data } = await apiGet<Template[]>('/api/v1/templates');
      setTemplates(data as Template[]);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const existingTypes = useMemo(() => {
    const types = templates.map(t => t.type).filter(Boolean) as string[];
    return Array.from(new Set(types)).sort();
  }, [templates]);

  const handleOpenNew = () => {
    setEditingTemplate(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (template: Template) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(undefined);
  };

  const handleSaveTemplate = async (data: Partial<Template>) => {
    try {
      if (editingTemplate) {
        await apiPatch(`/api/v1/templates/${editingTemplate.id}`, data);
      } else {
        await apiPost('/api/v1/templates', data);
      }
      loadTemplates();
      handleCloseModal();
    } catch (err) {
      alert('Erro ao salvar template');
      console.error(err);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (window.confirm('Excluir este template permanentemente?')) {
      try {
        await apiDelete(`/api/v1/templates/${id}`);
        loadTemplates();
      } catch (err) {
        alert('Erro ao excluir template');
        console.error(err);
      }
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await apiPatch(`/api/v1/templates/${id}`, { active: !currentStatus });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, active: !currentStatus } : t));
    } catch (err) {
      alert('Erro ao alterar status');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 transition-colors">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-500">Configure as mensagens enviadas pela IA.</p>
        </div>
        <button
          onClick={handleOpenNew}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-black transition-all shadow-md active:scale-95"
        >
          <Plus size={18} /> Novo Template
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 italic">Carregando templates reais...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {templates.map(t => (
            <div key={t.id} className={`group bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-all ${!t.active ? 'opacity-75 grayscale-[0.5]' : 'border-gray-200'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${t.active ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900">{t.name}</h3>
                      {t.type && (
                        <span className="bg-gray-100 text-gray-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-gray-200 uppercase tracking-wider">
                          {t.type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {t.active ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase tracking-wider">
                          <CheckCircle2 size={10} /> Ativo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          <AlertCircle size={10} /> Inativo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(t.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 font-mono text-xs text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[100px] relative overflow-hidden transition-colors">
                <div className="absolute top-0 right-0 p-2">
                  <button
                    onClick={() => toggleStatus(t.id, t.active)}
                    className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${t.active ? 'bg-white border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600' : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'}`}
                  >
                    {t.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
                {t.content}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Tags:</span>
                {['nome_msg', 'oferta', 'link_afiliado'].map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-mono border border-transparent">
                    {`{{${tag}}}`}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-400 italic bg-white rounded-xl border border-dashed border-gray-200">
              Nenhum template cadastrado no backend.
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <TemplateModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveTemplate}
          templateToEdit={editingTemplate}
          existingTypes={existingTypes}
        />
      )}
    </div>
  );
};

export default Templates;
