
export interface PriceRecord {
  date: string;
  value: number;
}

export interface MarketplaceProduct {
  id: string;
  produto_id: string;
  marketplace: string;
  marketplace_product_id?: string;
  link_limpo: string;
  link_afiliado: string;
  ativo: boolean;
  criado_em: string;
  price_history?: PriceRecord[];
}

export interface Product {
  produto_id: string;
  nome: string;
  nome_msg?: string;
  nome_oficial?: string;
  foto_url?: string;
  categoria_id?: string;
  subcategoria_id?: string;
  ativo: boolean;
  criado_em: string;
  marketplaces?: MarketplaceProduct[];
}

export interface Category {
  id: string;
  name: string;
}

export interface Subcategory {
  id: string;
  name: string;
  category_id: string;
}

export interface Coupon {
  id: string;
  code: string;
  status: 'active' | 'pending' | 'blocked';
  description?: string;
  expires_at?: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  active: boolean;
  type?: string;
}

export interface Instance {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'ativa' | 'inactive';
  battery?: number;
}

export interface EvolutionGroup {
  id: string;
  name: string;
  active: boolean;
  instanceName?: string;
  instanceId?: string;
}

export interface MessageLog {
  id: string;
  received_at: string;
  instance: string;
  group: string;
  status: 'processed' | 'pending' | 'failed' | 'ignored';
  latency: number;
  last_event?: string;
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  event: string;
  message: string;
}

export type ViewState = 
  | 'dashboard' 
  | 'monitor' 
  | 'products' 
  | 'coupons' 
  | 'templates' 
  | 'integrations';
