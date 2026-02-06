import React, { useState, useEffect } from 'react';
import { X, Save, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { Product, Category, Subcategory } from '../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Partial<Product>) => void;
  productToEdit?: Product;
  categories: Category[];
  subcategories: Subcategory[];
}

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  categories,
  subcategories,
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    ativo: true,
    foto_url: '',
    nome: '',
    nome_oficial: '',
    nome_msg: '',
    categoria_id: '',
    subcategoria_id: '',
  });

  useEffect(() => {
    if (productToEdit) {
      setFormData(productToEdit);
    } else {
      setFormData({
        ativo: true,
        foto_url: '',
        nome: '',
        nome_oficial: '',
        nome_msg: '',
        categoria_id: '',
        subcategoria_id: '',
      });
    }
  }, [productToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const filteredSubcategories = subcategories.filter(
    (sub) => sub.category_id === formData.categoria_id
  );

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {productToEdit ? 'Editar Produto Principal' : 'Novo Produto Principal'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 mb-4">
            Este é o cadastro mestre do produto. Para adicionar links de afiliados ou ofertas específicas, salve este produto e use o botão "Marketplaces" na lista.
          </div>

          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-full sm:w-1/3 space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Foto do Produto</label>
              <div className="aspect-square bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden relative group">
                {formData.foto_url ? (
                  <img 
                    src={formData.foto_url} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/200/200?grayscale';
                    }}
                  />
                ) : (
                  <div className="text-center p-4">
                    <ImageIcon className="mx-auto h-10 w-10 text-gray-400" />
                    <p className="mt-1 text-xs text-gray-500">Insira a URL ao lado</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">URL da Imagem</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon size={16} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="foto_url"
                    value={formData.foto_url || ''}
                    onChange={handleChange}
                    className="pl-10 block w-full rounded-lg border-gray-300 border bg-gray-50 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-900"
                    placeholder="https://exemplo.com/foto.jpg"
                  />
                </div>
              </div>
              
               <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status do Cadastro</label>
                <select
                  name="ativo"
                  value={formData.ativo ? 'true' : 'false'}
                  onChange={(e) => setFormData(prev => ({ ...prev, ativo: e.target.value === 'true' }))}
                  className="block w-full rounded-lg border-gray-300 border bg-white p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                >
                  <option value="true">Cadastrado (Ativo)</option>
                  <option value="false">Aguardando (Pendente)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Curto (Interno)</label>
              <input
                type="text"
                name="nome"
                required
                value={formData.nome || ''}
                onChange={handleChange}
                className="block w-full rounded-lg border-gray-300 border bg-gray-50 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                placeholder="Ex: iPhone 13"
              />
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Categoria</label>
              <select
                name="categoria_id"
                value={formData.categoria_id || ''}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, categoria_id: e.target.value, subcategoria_id: '' }));
                }}
                className="block w-full rounded-lg border-gray-300 border bg-gray-50 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
              >
                <option value="">Selecione...</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Subcategoria</label>
              <select
                name="subcategoria_id"
                value={formData.subcategoria_id || ''}
                onChange={handleChange}
                disabled={!formData.categoria_id}
                className="block w-full rounded-lg border-gray-300 border bg-gray-50 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 disabled:opacity-50"
              >
                <option value="">Selecione...</option>
                {filteredSubcategories.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Oficial (Título Completo)</label>
              <input
                type="text"
                name="nome_oficial"
                value={formData.nome_oficial || ''}
                onChange={handleChange}
                className="block w-full rounded-lg border-gray-300 border bg-gray-50 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                placeholder="Ex: Smartphone Apple iPhone 13 128GB Meia-noite"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Descrição / Mensagem Geral</label>
              <textarea
                name="nome_msg"
                rows={3}
                value={formData.nome_msg || ''}
                onChange={handleChange}
                className="block w-full rounded-lg border-gray-300 border bg-gray-50 p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                placeholder="Descrição geral do produto para uso interno..."
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-colors"
            >
              <Save size={18} />
              Salvar Principal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
