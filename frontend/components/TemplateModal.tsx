
import React, { useState, useEffect } from 'react';
import { X, Save, Info, Plus } from 'lucide-react';
import { Template } from '../types';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Template>) => void;
  templateToEdit?: Template;
  existingTypes: string[];
}

const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  onSave,
  templateToEdit,
  existingTypes,
}) => {
  const [formData, setFormData] = useState<Partial<Template>>({
    name: '',
    content: '',
    active: true,
    type: '',
  });

  const [showNewTypeField, setShowNewTypeField] = useState(false);
  const [newType, setNewType] = useState('');

  useEffect(() => {
    if (templateToEdit) {
      setFormData(templateToEdit);
    } else {
      setFormData({
        name: '',
        content: '',
        active: true,
        type: '',
      });
    }
  }, [templateToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.content) return;

    const finalData = {
      ...formData,
      type: showNewTypeField ? newType : formData.type
    };

    onSave(finalData);
  };

  const insertTag = (tag: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newContent = before + `{{${tag}}}` + after;

    setFormData(prev => ({ ...prev, content: newContent }));
    
    // Devolve o foco e posiciona o cursor após a tag
    setTimeout(() => {
      textarea.focus();
      const newPos = start + tag.length + 4;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__new__') {
      setShowNewTypeField(true);
      setFormData(prev => ({ ...prev, type: '' }));
    } else {
      setShowNewTypeField(false);
      setFormData(prev => ({ ...prev, type: val }));
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {templateToEdit ? 'Editar Template' : 'Novo Template'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Defina a estrutura visual das mensagens automáticas.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide text-[10px]">Nome de Identificação</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Oferta Relâmpago Noturna"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 text-sm font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide text-[10px]">Tipo / Categoria</label>
              {!showNewTypeField ? (
                <select 
                  value={formData.type || ''}
                  onChange={handleTypeChange}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 text-sm font-medium"
                >
                  <option value="">Sem Categoria</option>
                  {existingTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  <option value="__new__" className="font-bold text-blue-600">+ Criar Novo Tipo...</option>
                </select>
              ) : (
                <div className="relative">
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Digite o novo tipo..."
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 text-sm font-medium pr-10"
                  />
                  <button 
                    type="button"
                    onClick={() => { setShowNewTypeField(false); setNewType(''); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide text-[10px]">Editor de Conteúdo</label>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase self-center mr-1">Inserir:</span>
                {['nome_msg', 'oferta', 'link_afiliado'].map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className="text-[10px] font-mono bg-white text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    {`{{${tag}}}`}
                  </button>
                ))}
              </div>
            </div>
            
            <textarea 
              id="template-content"
              rows={12}
              required
              placeholder="Exemplo:&#10;🔥 *OFERTA IMPERDÍVEL* 🔥&#10;&#10;{{nome_msg}}&#10;&#10;De R$ XXX por apenas {{oferta}}!&#10;&#10;🛒 Garanta aqui: {{link_afiliado}}"
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              className="w-full px-6 py-5 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900 font-mono text-sm leading-relaxed resize-none shadow-inner min-h-[300px]"
            />
            
            <div className="flex items-center gap-2 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 text-blue-700 transition-colors duration-200">
              <Info size={16} className="flex-shrink-0" />
              <p className="text-[11px] leading-tight font-medium">
                Dica: Use asteriscos para *negrito* e hífens para criar listas. As tags serão substituídas automaticamente pelos dados reais do produto.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-black shadow-xl shadow-gray-900/10 transition-all active:scale-95"
            >
              <Save size={20} />
              {templateToEdit ? 'Salvar Alterações' : 'Criar Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplateModal;
