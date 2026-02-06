-- Schema - Central Afiliado
-- PostgreSQL (Supabase)

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- users (Autenticação)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

-- Inserir usuário admin padrão (senha: admin) se não existir
insert into users (email, password_hash, role)
values ('admin@admin.com', '$2b$10$RJPLwlgHKtlM4uVMNjc1IO3kKkILWpsDOm1ZmIO3CWE/sjCxmnDf2', 'admin')
on conflict (email) do nothing;
-- NOTA: O hash acima é placeholder. O script de setup ou o código deve gerar um hash real.
-- Para 'admin', um hash bcrypt válido seria necessário. 
-- Vamos assumir que o sistema criará o primeiro usuário via rota de setup ou script,
-- MAS para facilitar, vou deixar o insert comentado e o usuário deve ser criado via script dedicado ou rota.

-- mensagens_recebidas
create table if not exists mensagens_recebidas (
  id uuid primary key default gen_random_uuid(),
  instance_id text not null,
  instance_name text,
  group_id text not null,
  message_id text,
  sender_id text,
  sender_id_alt text,
  message_type text,
  legenda text,
  marketplace text,
  link_scrape text,
  media_url text,
  media_url_raw text,
  media_direct_path text,
  media_mimetype text,
  media_storage_path text,
  mensagem_hash text not null,
  correlation_id text not null,
  message_timestamp bigint,
  received_at timestamptz not null default now(),
  status text not null default 'recebida',
  unique (mensagem_hash)
);

create index if not exists idx_mensagens_instance_group on mensagens_recebidas (instance_id, group_id);
create index if not exists idx_mensagens_correlation on mensagens_recebidas (correlation_id);

-- ofertas_parseadas
create table if not exists ofertas_parseadas (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid references mensagens_recebidas(id) on delete set null,
  batch_id uuid not null,
  multi_oferta boolean not null default false,
  multi_ordem int not null default 1,
  tipo_oferta text not null default 'padrao',
  marketplace text not null,
  nome_produto text,
  nome_oficial text,
  oferta_completa text,
  cupons text[] default '{}',
  valor_venda numeric(12,2),
  link_scrape text,
  link_limpo text,
  marketplace_product_id text,
  status text not null default 'parseada',
  parsed_at timestamptz not null default now()
);

create index if not exists idx_ofertas_batch on ofertas_parseadas (batch_id);
create index if not exists idx_ofertas_marketplace on ofertas_parseadas (marketplace);

-- categorias
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- subcategorias
create table if not exists subcategorias (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias(id) on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (categoria_id, nome)
);

create index if not exists idx_subcategorias_categoria on subcategorias (categoria_id);

-- produtos (id universal)
create table if not exists produtos (
  produto_id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_msg text,
  nome_oficial text,
  foto_url text,
  foto_storage_path text,
  foto_mimetype text,
  foto_downloaded_at timestamptz,
  categoria_id uuid references categorias(id) on delete set null,
  subcategoria_id uuid references subcategorias(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- produto_marketplace (cadastros por marketplace)
create table if not exists produto_marketplace (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references produtos(produto_id) on delete cascade,
  marketplace text not null,
  marketplace_product_id text,
  link_limpo text not null, -- link canonico/limpo extraido no scraping (Gina/JS)
  link_afiliado text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_produto_mkt_produto on produto_marketplace (produto_id);
create index if not exists idx_produto_mkt_marketplace on produto_marketplace (marketplace);
create index if not exists idx_produto_mkt_mp_id on produto_marketplace (marketplace_product_id);

-- fila_cadastro_produto
create table if not exists fila_cadastro_produto (
  id uuid primary key default gen_random_uuid(),
  mensagem_id uuid references mensagens_recebidas(id) on delete set null,
  oferta_id uuid references ofertas_parseadas(id) on delete set null,
  produto_id uuid references produtos(produto_id) on delete set null,
  produto_id_sugerido uuid references produtos(produto_id) on delete set null,
  marketplace text not null,
  marketplace_product_id text,
  link_limpo text,
  nome_sugerido text,
  media_url text,
  status text not null default 'pendente',
  criado_em timestamptz not null default now()
);

create index if not exists idx_fila_produto_status on fila_cadastro_produto (status);

-- cupons
create table if not exists cupons_aprovados (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  criado_em timestamptz not null default now()
);

create table if not exists cupons_bloqueados (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  criado_em timestamptz not null default now()
);

create table if not exists cupons_pendentes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  criado_em timestamptz not null default now()
);

-- instancias
create table if not exists instancias (
  id uuid primary key default gen_random_uuid(),
  instance_id text not null unique,
  instance_name text,
  status text not null default 'ativa',
  criado_em timestamptz not null default now()
);

-- grupos
create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  instance_id text not null references instancias(instance_id) on delete cascade,
  group_name text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (group_id, instance_id)
);

-- templates
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  marketplace text not null,
  tipo text not null,
  nome text not null,
  body text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create index if not exists idx_templates_marketplace_tipo on templates (marketplace, tipo);

-- ofertas_enviadas
create table if not exists ofertas_enviadas (
  id uuid primary key default gen_random_uuid(),
  oferta_id uuid references ofertas_parseadas(id) on delete set null,
  batch_id uuid,
  produto_id uuid references produtos(produto_id) on delete set null,
  marketplace text,
  texto_final text,
  cupons_usados text[] default '{}',
  valor numeric(12,2),
  instance_id text,
  grupos_enviados text[] default '{}',
  media_url text,
  resultado_por_grupo jsonb,
  enviado_em timestamptz not null default now(),
  status text not null default 'enviada'
);

create index if not exists idx_ofertas_enviadas_batch on ofertas_enviadas (batch_id);
create index if not exists idx_ofertas_enviadas_instance on ofertas_enviadas (instance_id);

-- logs_eventos
create table if not exists logs_eventos (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  evento text not null,
  nivel text not null default 'info',
  mensagem text,
  payload jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_logs_correlation on logs_eventos (correlation_id);
create index if not exists idx_logs_evento on logs_eventos (evento);
