
import { Product, Category, MessageLog, ErrorLog, Coupon, Template, Instance, EvolutionGroup } from './types';

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat_eletronicos', name: 'Eletrônicos' },
  { id: 'cat_casa', name: 'Casa & Cozinha' },
  { id: 'cat_moda', name: 'Moda' },
  { id: 'cat_beleza', name: 'Beleza' },
];

export const MOCK_SUBCATEGORIES = [
  { id: 'sub_smartphones', categoryId: 'cat_eletronicos', name: 'Smartphones' },
  { id: 'sub_audio', categoryId: 'cat_eletronicos', name: 'Áudio' },
  { id: 'sub_smartwatch', categoryId: 'cat_eletronicos', name: 'Smartwatch' },
  { id: 'sub_eletrodomesticos', categoryId: 'cat_casa', name: 'Eletrodomésticos' },
  { id: 'sub_decoracao', categoryId: 'cat_casa', name: 'Decoração' },
  { id: 'sub_maquiagem', categoryId: 'cat_beleza', name: 'Maquiagem' },
  { id: 'sub_perfumaria', categoryId: 'cat_beleza', name: 'Perfumaria' },
  { id: 'sub_calcados', categoryId: 'cat_moda', name: 'Calçados' },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    produto_id: 'prod_1',
    nome: 'iPhone 15 Pro',
    nome_oficial: 'Apple iPhone 15 Pro (128 GB) - Titânio Natural',
    nome_msg: 'iPhone 15 Pro 128GB',
    ativo: true,
    foto_url: 'https://picsum.photos/400/400?random=1',
    categoria_id: 'cat_eletronicos',
    subcategoria_id: 'sub_smartphones',
    criado_em: '2023-11-01T10:00:00Z',
    marketplaces: [
      {
        id: 'mk_1',
        produto_id: 'prod_1',
        marketplace: 'Amazon',
        marketplace_product_id: 'B0CHX1W1S2',
        link_afiliado: 'https://amzn.to/iphone15pro',
        link_limpo: 'https://amazon.com.br/dp/B0CHX1W1S2',
        ativo: true,
        criado_em: '2023-11-01T10:00:00Z',
        price_history: [
            { date: '2023-11-01', value: 8999 },
            { date: '2023-11-10', value: 8799 },
            { date: '2023-11-20', value: 8499 },
            { date: '2023-11-24', value: 7999 },
            { date: '2023-11-30', value: 8299 },
        ]
      }
    ]
  }
];

export const MOCK_MESSAGES: MessageLog[] = [
    { id: '1', received_at: '10:45:12', instance: 'PromoBot_01', group: 'Achadinhos VIP', status: 'processed', latency: 1.2, last_event: 'sent' },
];

export const MOCK_ERRORS: ErrorLog[] = [
    { id: 'e1', timestamp: '2023-10-25 10:50:11', event: 'timeout_handling', message: 'Timeout waiting for AI processing' },
];

export const MOCK_COUPONS: Coupon[] = [
    { id: 'c1', code: 'BLACK10', description: '10% OFF em tudo', status: 'active', expires_at: '2023-11-30' },
];

export const MOCK_TEMPLATES: Template[] = [
    { id: 't1', name: 'Padrão Simples', content: '🔥 *OFERTA IMPERDÍVEL* 🔥\n\n{{nome_msg}}\n\nPor apenas: {{oferta}}\n\n🛒 Compre aqui: {{link_afiliado}}', active: true, type: 'Promoção' },
    { id: 't2', name: 'Urgência', content: '🚨 *CORRE QUE VAI ACABAR* 🚨\n\n{{nome_msg}} está com preço histórico!\n\nLink: {{link_afiliado}}', active: true, type: 'Urgência' },
];

export const MOCK_INSTANCES: Instance[] = [
    { name: 'PromoBot_01', status: 'connected', battery: 98 },
];

export const MOCK_GROUPS_SEND: EvolutionGroup[] = [
    { id: 'g1', name: 'Achadinhos VIP', active: true, instanceName: 'PromoBot_01' },
];

export const MOCK_GROUPS_RECEIVE: EvolutionGroup[] = [
    { id: 'gr1', name: 'Grupo Fonte 1', active: true, instanceName: 'PromoBot_01' },
];
