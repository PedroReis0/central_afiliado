import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Edit3, Store, Filter, ChevronLeft, ChevronRight, LayoutGrid, ListFilter, X
} from 'lucide-react';
import { Product, Category, Subcategory, MarketplaceProduct } from '../types';
import ProductModal from './ProductModal';
import MarketplaceManager from './MarketplaceManager';
import { apiGet, apiPost, apiPatch } from '../api';

type TabView = 'active' | 'pending';
type SortOption = 'name_asc' | 'name_desc' | 'created_newest' | 'created_oldest';

const ProductCatalog: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [marketplaceOptions, setMarketplaceOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<TabView>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMarketplaceMgrOpen, setIsMarketplaceMgrOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [marketplaceProduct, setMarketplaceProduct] = useState<Product | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('created_newest');

  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubcategory, setFilterSubcategory] = useState('');
  const [filterMarketplace, setFilterMarketplace] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const hasPendingMarketplaceLinks = (p: Product) => p.marketplaces?.some(m => !m.ativo) || false;
  const countPendingLinks = (p: Product) => p.marketplaces?.filter(m => !m.ativo).length || 0;

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const [{ data: productsData }, { data: categoriesData }, { data: subData }, { data: marketplacesData }] =
        await Promise.all([
          apiGet<Product[]>('/api/v1/products'),
          apiGet<Category[]>('/api/v1/categories'),
          apiGet<Subcategory[]>('/api/v1/subcategories'),
          apiGet<string[]>('/api/v1/marketplaces')
        ]);

      setProducts(Array.isArray(productsData) ? productsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setSubcategories(Array.isArray(subData) ? subData : []);
      setMarketplaceOptions(Array.isArray(marketplacesData) ? marketplacesData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeTab === 'active') {
      result = result.filter(p => p.ativo);
    } else {
      result = result.filter(p => !p.ativo || hasPendingMarketplaceLinks(p));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.nome.toLowerCase().includes(q) ||
        (p.nome_oficial || '').toLowerCase().includes(q) ||
        (p.nome_msg || '').toLowerCase().includes(q)
      );
    }

    if (filterCategory) result = result.filter(p => p.categoria_id === filterCategory);
    if (filterSubcategory) result = result.filter(p => p.subcategoria_id === filterSubcategory);
    if (filterMarketplace) {
      result = result.filter(p =>
        p.marketplaces?.some(m => m.marketplace === filterMarketplace)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return a.nome.localeCompare(b.nome);
        case 'name_desc': return b.nome.localeCompare(a.nome);
        case 'created_newest': return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime();
        case 'created_oldest': return new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime();
        default: return 0;
      }
    });

    return result;
  }, [products, activeTab, searchQuery, filterCategory, filterSubcategory, filterMarketplace, sortBy]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const countActiveTab = products.filter(p => p.ativo).length;
  const countPendingTab = products.filter(p => !p.ativo || hasPendingMarketplaceLinks(p)).length;

  const handleOpenNew = () => { setEditingProduct(undefined); setIsModalOpen(true); };
  const handleOpenEdit = (product: Product) => { setEditingProduct(product); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingProduct(undefined); };

  const handleOpenMarketplaceMgr = (product: Product) => {
    setMarketplaceProduct(product);
    setIsMarketplaceMgrOpen(true);
  };

  const handleCloseMarketplaceMgr = () => {
    setIsMarketplaceMgrOpen(false);
    setMarketplaceProduct(undefined);
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      if (editingProduct) {
        await apiPatch(`/api/v1/products/${editingProduct.produto_id}`, productData);
      } else {
        await apiPost('/api/v1/products', productData);
      }
      await loadCatalog();
    } catch (err) {
      console.error(err);
    } finally {
      handleCloseModal();
    }
  };

  const handleUpdateMarketplaces = (list: MarketplaceProduct[]) => {
    if (!marketplaceProduct) return;
    setProducts(prev => prev.map(p => p.produto_id === marketplaceProduct.produto_id ? { ...p, marketplaces: list } : p));
  };

  const resetFilters = () => {
    setFilterCategory('');
    setFilterSubcategory('');
    setFilterMarketplace('');
    setIsFilterOpen(false);
  };

  const activeFiltersCount = [filterCategory, filterSubcategory, filterMarketplace].filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-xl font-bold text-gray-900">Catálogo de Produtos</h1>
            <p className="text-xs text-gray-500">Gerencie o acervo e vínculos de afiliados.</p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full md:w-48 pl-8 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <button
            onClick={() => setIsFilterOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeFiltersCount > 0 ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <Filter size={14} />
            Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </button>
          <button
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Novo</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-200">
        <div className="flex items-center gap-6">
            <button
            onClick={() => { setActiveTab('active'); setCurrentPage(1); }}
            className={`flex items-center gap-2 pb-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
            Ativos <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md text-[10px]">{countActiveTab}</span>
            </button>
            <button
            onClick={() => { setActiveTab('pending'); setCurrentPage(1); }}
            className={`flex items-center gap-2 pb-2 text-xs font-bold border-b-2 transition-all ${activeTab === 'pending' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
            Aguardando <span className="bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md text-[10px]">{countPendingTab}</span>
            </button>
        </div>

        <div className="flex items-center gap-2 mb-2 sm:mb-0">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Ordem:</span>
            <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-[11px] bg-transparent border-none focus:ring-0 font-semibold text-gray-600 cursor-pointer"
            >
                <option value="created_newest">Mais recentes</option>
                <option value="created_oldest">Mais antigos</option>
                <option value="name_asc">A - Z</option>
                <option value="name_desc">Z - A</option>
            </select>
        </div>
      </div>

      {loading && (
        <div className="text-xs text-gray-500">Carregando dados do catálogo...</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {paginatedProducts.map((product) => {
          const pendingLinks = countPendingLinks(product);
          const isProductPending = !product.ativo;
          const isLinkPending = product.ativo && pendingLinks > 0;
          const category = categories.find(c => c.id === product.categoria_id)?.name;
          const subcategory = subcategories.find(s => s.id === product.subcategoria_id)?.name;

          return (
            <div key={product.produto_id} className="group bg-white border border-gray-100 rounded-lg overflow-hidden hover:shadow-md transition-all flex flex-col relative">
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                <img
                  src={product.foto_url || 'https://via.placeholder.com/200'}
                  alt={product.nome}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-1 left-1 flex flex-col gap-0.5">
                  {isProductPending && <div className="bg-amber-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-sm">REVISAR</div>}
                  {isLinkPending && <div className="bg-purple-600 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow-sm">+{pendingLinks} LINKS</div>}
                </div>
              </div>

              <div className="p-2 flex-1 flex flex-col">
                <p className="text-[8px] font-bold uppercase text-gray-400 truncate mb-0.5">
                    {category}{subcategory ? ` • ${subcategory}` : ''}
                </p>
                <h3 className="text-xs font-bold text-gray-900 line-clamp-1 mb-0.5" title={product.nome}>{product.nome}</h3>
                <p className="text-[10px] text-gray-500 line-clamp-1 mb-2" title={product.nome_oficial}>{product.nome_oficial || 'Sem detalhes'}</p>

                <div className="flex gap-1 pt-2 border-t border-gray-50 mt-auto">
                   <button
                    onClick={() => handleOpenMarketplaceMgr(product)}
                    className={`flex-1 flex items-center justify-center p-1.5 rounded-md transition-colors ${isLinkPending ? 'bg-purple-50 text-purple-600 hover:bg-purple-100' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                    title="Marketplaces"
                   >
                     <Store size={14} />
                   </button>
                   <button
                    onClick={() => handleOpenEdit(product)}
                    className="flex-1 flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 p-1.5 rounded-md transition-colors"
                    title="Editar"
                   >
                     <Edit3 size={14} />
                   </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
            <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
                <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-100'}`}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
            <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 disabled:opacity-30 hover:bg-gray-50 transition-colors"
            >
                <ChevronRight size={18} />
            </button>
        </div>
      )}

      {paginatedProducts.length === 0 && !loading && (
          <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
              <LayoutGrid size={48} className="mb-4 text-gray-300" />
              <p className="text-sm font-medium">Nenhum produto encontrado com os filtros atuais.</p>
              <button onClick={resetFilters} className="mt-2 text-blue-600 text-xs font-bold hover:underline">Limpar filtros</button>
          </div>
      )}

      {isModalOpen && (
        <ProductModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveProduct}
          productToEdit={editingProduct}
          categories={categories}
          subcategories={subcategories}
        />
      )}

      {isMarketplaceMgrOpen && marketplaceProduct && (
        <MarketplaceManager
          isOpen={isMarketplaceMgrOpen}
          onClose={handleCloseMarketplaceMgr}
          product={marketplaceProduct}
          onUpdateMarketplaces={handleUpdateMarketplaces}
        />
      )}

      {isFilterOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-150 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2"><ListFilter size={18} /> Filtros Avançados</h3>
                      <button onClick={() => setIsFilterOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full transition-colors"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-5">
                      <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Categoria</label>
                          <select
                            value={filterCategory}
                            onChange={(e) => { setFilterCategory(e.target.value); setFilterSubcategory(''); }}
                            className="w-full bg-white rounded-lg border-gray-200 p-2.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none cursor-pointer transition-all"
                          >
                              <option value="">Todas</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Subcategoria</label>
                          <select
                            value={filterSubcategory}
                            onChange={(e) => setFilterSubcategory(e.target.value)}
                            disabled={!filterCategory}
                            className="w-full bg-white rounded-lg border-gray-200 p-2.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none cursor-pointer disabled:opacity-50 disabled:bg-gray-50 transition-all"
                          >
                              <option value="">Todas</option>
                              {subcategories.filter(s => s.category_id === filterCategory).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Marketplace</label>
                          <select
                            value={filterMarketplace}
                            onChange={(e) => setFilterMarketplace(e.target.value)}
                            className="w-full bg-white rounded-lg border-gray-200 p-2.5 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none cursor-pointer transition-all"
                          >
                              <option value="">Todos</option>
                              {marketplaceOptions.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                          </select>
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50/50 flex gap-2">
                      <button onClick={resetFilters} className="flex-1 py-2.5 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors active:scale-95">Limpar</button>
                      <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-2.5 text-xs font-bold text-white bg-[#111827] rounded-lg hover:bg-black transition-colors shadow-lg shadow-gray-900/10 active:scale-95">Ver Resultados</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ProductCatalog;
