import crypto from 'crypto';
import { query } from '../db.js';
import { logEvent } from '../services/logs.js';
import { fetchInstances, fetchAllGroups } from '../services/evolution.js';

const COUPON_TABLES = {
  active: 'cupons_aprovados',
  pending: 'cupons_pendentes',
  blocked: 'cupons_bloqueados'
};

function respondSuccess(reply, data, meta) {
  const payload = { success: true, data };
  if (meta) payload.meta = meta;
  return reply.code(200).send(payload);
}

function respondError(reply, code, error, correlationId) {
  return reply.code(code).send({ success: false, error, correlation_id: correlationId });
}

function parseDateParam(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function resolveRange(query) {
  const range = query?.range || '7days';
  const now = new Date();
  let from;
  let to;

  if (range === 'today') {
    from = new Date(now);
    to = new Date(now);
  } else if (range === '7days') {
    to = new Date(now);
    from = new Date(now);
    from.setDate(to.getDate() - 6);
  } else if (range === 'month') {
    to = new Date(now);
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (range === 'custom') {
    const start = parseDateParam(query?.start);
    const end = parseDateParam(query?.end);
    if (start && end) {
      from = start;
      to = end;
    }
  }

  if (!from || !to) {
    to = new Date(now);
    from = new Date(now);
    from.setDate(to.getDate() - 6);
  }

  return { from, to };
}

function normalizeStatus({ envioStatus, ofertaStatus, mensagemStatus }) {
  const all = [envioStatus, ofertaStatus, mensagemStatus].filter(Boolean).map((s) => String(s).toLowerCase());
  if (all.some((s) => ['enviada', 'sent', 'processed', 'ok', 'sucesso'].includes(s))) return 'processed';
  if (all.some((s) => ['falha', 'failed', 'erro', 'error'].includes(s))) return 'failed';
  if (all.some((s) => ['ignorada', 'ignored', 'skip', 'skipped'].includes(s))) return 'ignored';
  return 'pending';
}

async function fetchProductsWithMarketplaces(products) {
  if (!products.length) return products;
  const productIds = products.map((p) => p.produto_id);
  const linksRes = await query(
    `select id, produto_id, marketplace, marketplace_product_id, link_limpo, link_afiliado, ativo, criado_em
     from produto_marketplace
     where produto_id = any($1::uuid[])
     order by criado_em desc`,
    [productIds]
  );

  const byProduct = new Map();
  for (const link of linksRes.rows) {
    if (!byProduct.has(link.produto_id)) byProduct.set(link.produto_id, []);
    byProduct.get(link.produto_id).push({
      id: link.id,
      produto_id: link.produto_id,
      marketplace: link.marketplace,
      marketplace_product_id: link.marketplace_product_id,
      link_limpo: link.link_limpo,
      link_afiliado: link.link_afiliado,
      ativo: link.ativo,
      criado_em: link.criado_em,
      price_history: []
    });
  }

  return products.map((p) => ({
    ...p,
    marketplaces: byProduct.get(p.produto_id) || []
  }));
}

export function registerApiV1Routes(app) {
  app.get('/api/v1/health', async (request, reply) => {
    return respondSuccess(reply, { status: 'ok' });
  });

  app.get('/api/v1/stats', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { from, to } = resolveRange(request.query);
      const fromIso = toIsoDate(from);
      const toIso = toIsoDate(to);

      const receivedRes = await query(
        `select count(*)::int as total
         from ofertas_parseadas
         where parsed_at >= $1::date
           and parsed_at < ($2::date + interval '1 day')`,
        [fromIso, toIso]
      );

      const sentRes = await query(
        `select count(*)::int as total
         from ofertas_enviadas
         where enviado_em >= $1::date
           and enviado_em < ($2::date + interval '1 day')`,
        [fromIso, toIso]
      );

      const pendenteMarketplaceRes = await query(
        `select count(*)::int as total
         from fila_cadastro_produto
         where status = 'pendente'`
      );

      const pendentePrincipalRes = await query(
        `select count(*)::int as total
         from produtos
         where ativo = false`
      );

      const tokensRes = await query(
        `select coalesce(sum(nullif((payload->>'tokens_total')::int, 0)), 0)::int as total
         from logs_eventos
         where evento = 'llm_usage'
           and criado_em >= $1::date
           and criado_em < ($2::date + interval '1 day')`,
        [fromIso, toIso]
      );

      const flowRes = await query(
        `
        with days as (
          select generate_series($1::date, $2::date, interval '1 day')::date as day
        ),
        recebidas as (
          select date_trunc('day', parsed_at)::date as day, count(*)::int as total
          from ofertas_parseadas
          where parsed_at >= $1::date
            and parsed_at < ($2::date + interval '1 day')
          group by 1
        ),
        enviadas as (
          select date_trunc('day', enviado_em)::date as day, count(*)::int as total
          from ofertas_enviadas
          where enviado_em >= $1::date
            and enviado_em < ($2::date + interval '1 day')
          group by 1
        )
        select d.day,
               coalesce(r.total, 0) as recebidas,
               coalesce(e.total, 0) as enviadas
        from days d
        left join recebidas r on r.day = d.day
        left join enviadas e on e.day = d.day
        order by d.day asc
        `,
        [fromIso, toIso]
      );

      const tokensSeriesRes = await query(
        `
        with days as (
          select generate_series($1::date, $2::date, interval '1 day')::date as day
        ),
        tokens as (
          select date_trunc('day', criado_em)::date as day,
                 sum(nullif((payload->>'tokens_total')::int, 0))::int as total
          from logs_eventos
          where evento = 'llm_usage'
            and criado_em >= $1::date
            and criado_em < ($2::date + interval '1 day')
          group by 1
        )
        select d.day,
               coalesce(t.total, 0) as tokens
        from days d
        left join tokens t on t.day = d.day
        order by d.day asc
        `,
        [fromIso, toIso]
      );

      const received = receivedRes.rows[0]?.total || 0;
      const sent = sentRes.rows[0]?.total || 0;
      const aproveitamento = received > 0 ? Number(((sent / received) * 100).toFixed(1)) : 0;

      return respondSuccess(reply, {
        range: { start: fromIso, end: toIso },
        totals: {
          ofertas_enviadas: sent,
          ofertas_recebidas: received,
          aproveitamento,
          produtos_pendentes: (pendenteMarketplaceRes.rows[0]?.total || 0) + (pendentePrincipalRes.rows[0]?.total || 0),
          tokens_total: tokensRes.rows[0]?.total || 0
        },
        series: {
          flow: flowRes.rows,
          tokens: tokensSeriesRes.rows
        }
      });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_stats_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/stats',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_stats_error', correlationId);
    }
  });

  app.get('/api/v1/logs', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const limit = Math.min(Number(request.query?.limit || 10), 100);
      const page = Math.max(Number(request.query?.page || 1), 1);
      const offset = (page - 1) * limit;

      const totalRes = await query(`select count(*)::int as total from mensagens_recebidas`);
      const total = totalRes.rows[0]?.total || 0;
      const totalPages = Math.max(Math.ceil(total / limit), 1);

      const res = await query(
        `
        select
          mr.id as mensagem_id,
          mr.received_at,
          mr.status as mensagem_status,
          op.status as oferta_status,
          oe.status as envio_status,
          oe.enviado_em,
          extract(epoch from (oe.enviado_em - mr.received_at))::int as latency_s,
          i.instance_id,
          i.instance_name,
          g.group_id,
          g.group_name
        from mensagens_recebidas mr
        left join ofertas_parseadas op on op.mensagem_id = mr.id
        left join ofertas_enviadas oe on oe.oferta_id = op.id
        left join instancias i on i.instance_id = mr.instance_id
        left join grupos g on g.group_id = mr.group_id and g.instance_id = mr.instance_id
        order by mr.received_at desc
        limit $1 offset $2
        `,
        [limit, offset]
      );

      const items = res.rows.map((row) => ({
        id: row.mensagem_id,
        received_at: row.received_at,
        instance: row.instance_name || row.instance_id,
        group: row.group_name || row.group_id,
        status: normalizeStatus({
          envioStatus: row.envio_status,
          ofertaStatus: row.oferta_status,
          mensagemStatus: row.mensagem_status
        }),
        latency: row.latency_s
      }));

      return respondSuccess(reply, items, {
        current_page: page,
        total_pages: totalPages,
        total_items: total
      });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_logs_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/logs',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_logs_error', correlationId);
    }
  });

  app.get('/api/v1/errors', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const limit = Math.min(Number(request.query?.limit || 10), 100);
      const page = Math.max(Number(request.query?.page || 1), 1);
      const offset = (page - 1) * limit;

      const totalRes = await query(
        `select count(*)::int as total
         from logs_eventos
         where nivel = 'error'`
      );
      const total = totalRes.rows[0]?.total || 0;
      const totalPages = Math.max(Math.ceil(total / limit), 1);

      const res = await query(
        `select id, evento, mensagem, criado_em
         from logs_eventos
         where nivel = 'error'
         order by criado_em desc
         limit $1 offset $2`,
        [limit, offset]
      );

      const items = res.rows.map((row) => ({
        id: row.id,
        event: row.evento,
        message: row.mensagem,
        timestamp: row.criado_em
      }));

      return respondSuccess(reply, items, {
        current_page: page,
        total_pages: totalPages,
        total_items: total
      });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_errors_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/errors',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_errors_error', correlationId);
    }
  });

  app.get('/api/v1/products', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const search = request.query?.search;
      const category = request.query?.category;
      const status = request.query?.status;
      const conditions = [];
      const params = [];

      if (status === 'active') {
        params.push(true);
        conditions.push(`ativo = $${params.length}`);
      } else if (status === 'pending') {
        params.push(false);
        conditions.push(`ativo = $${params.length}`);
      }

      if (category) {
        params.push(category);
        conditions.push(`categoria_id = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(nome ilike $${params.length} or nome_oficial ilike $${params.length} or nome_msg ilike $${params.length})`);
      }

      const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
      const res = await query(
        `select produto_id, nome, nome_msg, nome_oficial, ativo, foto_url, categoria_id, subcategoria_id, criado_em
         from produtos
         ${where}
         order by criado_em desc
         limit 200`,
        params
      );

      const products = await fetchProductsWithMarketplaces(res.rows);
      return respondSuccess(reply, products);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_products_list_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/products',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_products_error', correlationId);
    }
  });

  app.get('/api/v1/categories', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const res = await query(
        `select c.id, c.nome,
                count(p.produto_id)::int as total
         from categorias c
         left join produtos p on p.categoria_id = c.id
         group by c.id
         order by c.nome`
      );

      const items = res.rows.map((row) => ({
        id: row.id,
        name: row.nome,
        total: row.total
      }));

      return respondSuccess(reply, items);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_categories_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/categories',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_categories_error', correlationId);
    }
  });

  app.get('/api/v1/subcategories', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const category = request.query?.category;
      const conditions = [];
      const params = [];

      if (category) {
        params.push(category);
        conditions.push(`s.categoria_id = $${params.length}`);
      }

      const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
      const res = await query(
        `select s.id, s.nome, s.categoria_id,
                count(p.produto_id)::int as total
         from subcategorias s
         left join produtos p on p.subcategoria_id = s.id
         ${where}
         group by s.id
         order by s.nome`,
        params
      );

      const items = res.rows.map((row) => ({
        id: row.id,
        name: row.nome,
        category_id: row.categoria_id,
        total: row.total
      }));

      return respondSuccess(reply, items);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_subcategories_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/subcategories',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_subcategories_error', correlationId);
    }
  });

  app.get('/api/v1/marketplaces', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const res = await query(
        `select distinct marketplace
         from produto_marketplace
         where marketplace is not null
         order by marketplace`
      );
      const items = res.rows.map((row) => row.marketplace).filter(Boolean);
      return respondSuccess(reply, items);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_marketplaces_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/marketplaces',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_marketplaces_error', correlationId);
    }
  });

  app.post('/api/v1/products', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const {
        nome,
        nome_msg: nomeMsg,
        nome_oficial: nomeOficial,
        ativo = true,
        foto_url: fotoUrl,
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId
      } = request.body || {};

      const resolvedNome = nome || nomeOficial;
      if (!resolvedNome) {
        await logEvent({
          correlationId,
          evento: 'api_v1_products_create_invalid',
          nivel: 'warn',
          mensagem: 'nome_required'
        });
        return respondError(reply, 422, 'nome_required', correlationId);
      }

      const res = await query(
        `insert into produtos (nome, nome_msg, nome_oficial, ativo, foto_url, categoria_id, subcategoria_id)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning produto_id`,
        [
          resolvedNome,
          nomeMsg || null,
          nomeOficial || resolvedNome,
          Boolean(ativo),
          fotoUrl || null,
          categoriaId || null,
          subcategoriaId || null
        ]
      );

      return respondSuccess(reply, { produto_id: res.rows[0].produto_id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_products_create_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/products POST',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_products_create_error', correlationId);
    }
  });

  app.patch('/api/v1/products/:id', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const produtoId = request.params?.id;
      const {
        nome,
        nome_msg: nomeMsg,
        nome_oficial: nomeOficial,
        ativo,
        foto_url: fotoUrl,
        categoria_id: categoriaId,
        subcategoria_id: subcategoriaId
      } = request.body || {};

      if (!produtoId) {
        await logEvent({
          correlationId,
          evento: 'api_v1_products_update_invalid',
          nivel: 'warn',
          mensagem: 'produto_id_required'
        });
        return respondError(reply, 422, 'produto_id_required', correlationId);
      }

      await query(
        `update produtos
         set nome = coalesce($2, nome),
             nome_msg = coalesce($3, nome_msg),
             nome_oficial = coalesce($4, nome_oficial),
             ativo = coalesce($5, ativo),
             foto_url = coalesce($6, foto_url),
             categoria_id = coalesce($7, categoria_id),
             subcategoria_id = coalesce($8, subcategoria_id)
         where produto_id = $1`,
        [
          produtoId,
          nome || null,
          nomeMsg || null,
          nomeOficial || null,
          typeof ativo === 'boolean' ? ativo : null,
          fotoUrl || null,
          categoriaId || null,
          subcategoriaId || null
        ]
      );

      return respondSuccess(reply, { ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_products_update_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/products PATCH',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_products_update_error', correlationId);
    }
  });

  app.get('/api/v1/products/:id/links', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const produtoId = request.params?.id;
      if (!produtoId) {
        return respondError(reply, 422, 'produto_id_required', correlationId);
      }

      const res = await query(
        `select id, produto_id, marketplace, marketplace_product_id, link_limpo, link_afiliado, ativo, criado_em
         from produto_marketplace
         where produto_id = $1
         order by criado_em desc`,
        [produtoId]
      );

      return respondSuccess(reply, res.rows.map((row) => ({
        ...row,
        price_history: []
      })));
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_product_links_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/products/:id/links',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_product_links_error', correlationId);
    }
  });

  app.post('/api/v1/links', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const {
        produto_id: produtoId,
        marketplace,
        marketplace_product_id: mpId,
        link_limpo: linkLimpo,
        link_afiliado: linkAfiliado,
        ativo = true
      } = request.body || {};

      if (!produtoId || !marketplace || !linkAfiliado) {
        await logEvent({
          correlationId,
          evento: 'api_v1_links_create_invalid',
          nivel: 'warn',
          mensagem: 'produto_id_marketplace_link_afiliado_required'
        });
        return respondError(reply, 422, 'produto_id_marketplace_link_afiliado_required', correlationId);
      }

      const finalLinkLimpo = linkLimpo || linkAfiliado;

      const res = await query(
        `insert into produto_marketplace (produto_id, marketplace, marketplace_product_id, link_limpo, link_afiliado, ativo)
         values ($1, $2, $3, $4, $5, $6)
         returning id`,
        [produtoId, marketplace, mpId || null, finalLinkLimpo, linkAfiliado, Boolean(ativo)]
      );

      return respondSuccess(reply, { id: res.rows[0].id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_links_create_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/links POST',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_links_create_error', correlationId);
    }
  });

  app.patch('/api/v1/links/:id', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const id = request.params?.id;
      const {
        marketplace,
        marketplace_product_id: mpId,
        link_limpo: linkLimpo,
        link_afiliado: linkAfiliado,
        ativo
      } = request.body || {};

      if (!id) {
        return respondError(reply, 422, 'link_id_required', correlationId);
      }

      await query(
        `update produto_marketplace
         set marketplace = coalesce($2, marketplace),
             marketplace_product_id = coalesce($3, marketplace_product_id),
             link_limpo = coalesce($4, link_limpo),
             link_afiliado = coalesce($5, link_afiliado),
             ativo = coalesce($6, ativo)
         where id = $1`,
        [
          id,
          marketplace || null,
          mpId || null,
          linkLimpo || null,
          linkAfiliado || null,
          typeof ativo === 'boolean' ? ativo : null
        ]
      );

      return respondSuccess(reply, { id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_links_update_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/links PATCH',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_links_update_error', correlationId);
    }
  });

  app.delete('/api/v1/links/:id', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const id = request.params?.id;
      if (!id) {
        return respondError(reply, 422, 'link_id_required', correlationId);
      }

      await query(
        `update produto_marketplace
         set ativo = false
         where id = $1`,
        [id]
      );

      return respondSuccess(reply, { ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_links_delete_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/links DELETE',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_links_delete_error', correlationId);
    }
  });

  app.get('/api/v1/links/:id/prices', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const id = request.params?.id;
      if (!id) {
        return respondError(reply, 422, 'link_id_required', correlationId);
      }

      const linkRes = await query(
        `select produto_id, marketplace
         from produto_marketplace
         where id = $1`,
        [id]
      );

      if (linkRes.rowCount === 0) {
        return respondError(reply, 404, 'link_not_found', correlationId);
      }

      const link = linkRes.rows[0];
      const historyRes = await query(
        `select date_trunc('day', enviado_em)::date as date,
                avg(valor)::numeric as value
         from ofertas_enviadas
         where produto_id = $1
           and marketplace = $2
           and valor is not null
         group by 1
         order by 1 asc`,
        [link.produto_id, link.marketplace]
      );

      const history = historyRes.rows.map((row) => ({
        date: new Date(row.date).toISOString(),
        value: Number(row.value)
      }));

      return respondSuccess(reply, history);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_links_prices_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/links/:id/prices',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_links_prices_error', correlationId);
    }
  });

  app.get('/api/v1/evolution/instances', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const data = await fetchInstances();
      const list = Array.isArray(data) ? data : data?.instances || data?.data || [];
      const normalized = list.map((item) => ({
        id: item?.instanceId || item?.instance_id || item?.id || item?.uuid || item?.instance || item?.name || null,
        name: item?.instance || item?.instanceName || item?.name || item?.instance_name || null,
        status: item?.status || item?.connectionStatus || item?.state || 'ativa',
        battery: item?.battery || item?.batteryLevel || item?.battery_level || null
      })).filter((i) => i.id);

      // Persistir no banco local para garantir que o sync de grupos funcione
      for (const inst of normalized) {
        await query(
          `insert into instancias (instance_id, instance_name, status)
           values ($1, $2, $3)
           on conflict (instance_id)
           do update set instance_name = excluded.instance_name, status = excluded.status`,
          [inst.id, inst.name, inst.status]
        );
      }

      return respondSuccess(reply, normalized);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_evolution_instances_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/evolution/instances',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_evolution_instances_error', correlationId);
    }
  });

  app.post('/api/v1/evolution/sync', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { instance_id: instanceId, instance_name: instanceName } = request.body || {};
      if (!instanceId && !instanceName) {
        return respondError(reply, 422, 'instance_id_or_instance_name_required', correlationId);
      }

      const instanceRes = await query(
        `select instance_id, instance_name
         from instancias
         where instance_id = $1 or instance_name = $1
         limit 1`,
        [instanceId || instanceName]
      );

      if (instanceRes.rowCount === 0) {
        // Fallback: Tentar buscar na API da Evolution se não estiver no banco
        const apiData = await fetchInstances();
        const apiList = Array.isArray(apiData) ? apiData : apiData?.instances || apiData?.data || [];
        const found = apiList.find(i =>
          (i?.instanceId === instanceId) ||
          (i?.instanceName === instanceName) ||
          (i?.name === instanceName) ||
          (i?.instance === instanceName)
        );

        if (found) {
          const norm = {
            id: found?.instanceId || found?.instance_id || found?.id || found?.uuid || found?.instance || found?.name,
            name: found?.instance || found?.instanceName || found?.name || found?.instance_name,
            status: found?.status || found?.connectionStatus || found?.state || 'ativa'
          };

          if (norm.id && norm.name) {
            await query(
              `insert into instancias (instance_id, instance_name, status)
                values ($1, $2, $3)
                on conflict (instance_id)
                do update set instance_name = excluded.instance_name, status = excluded.status`,
              [norm.id, norm.name, norm.status]
            );
            // Atualizar a variável instance para prosseguir
            instanceRes.rows[0] = { instance_id: norm.id, instance_name: norm.name };
            instanceRes.rowCount = 1;
          }
        }

        if (instanceRes.rowCount === 0) {
          return respondError(reply, 404, 'instance_not_found_locally_or_remote', correlationId);
        }
      }

      const instance = instanceRes.rows[0];
      const resolvedName = instance.instance_name || instance.instance_id;
      const data = await fetchAllGroups(resolvedName);
      const list = Array.isArray(data) ? data : data?.groups || data?.data || [];

      const normalized = list.map((item) => ({
        groupId: item?.id || item?.groupId || item?.jid || item?.remoteJid || null,
        groupName: item?.subject || item?.name || item?.title || null
      })).filter((g) => g.groupId);

      for (const group of normalized) {
        await query(
          `insert into grupos (group_id, instance_id, group_name, ativo)
           values ($1, $2, $3, false)
           on conflict (group_id, instance_id)
           do update set group_name = excluded.group_name`,
          [group.groupId, instance.instance_id, group.groupName]
        );
      }

      return respondSuccess(reply, { total: normalized.length, instance_id: instance.instance_id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_evolution_sync_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/evolution/sync',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_evolution_sync_error', correlationId);
    }
  });

  app.get('/api/v1/groups', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const active = request.query?.active;
      const instanceId = request.query?.instance_id;
      const conditions = [];
      const params = [];

      if (instanceId) {
        params.push(instanceId);
        conditions.push(`instance_id = $${params.length}`);
      }
      if (active !== undefined) {
        params.push(active === 'true');
        conditions.push(`ativo = $${params.length}`);
      }

      const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
      const res = await query(
        `select id, group_id, group_name, instance_id, ativo
         from grupos
         ${where}
         order by group_name`,
        params
      );

      const items = res.rows.map((row) => ({
        id: row.id,
        group_id: row.group_id,
        name: row.group_name || row.group_id,
        instance_id: row.instance_id,
        active: row.ativo
      }));

      return respondSuccess(reply, items);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_groups_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/groups',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_groups_error', correlationId);
    }
  });

  app.patch('/api/v1/groups/:id/toggle', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const id = request.params?.id;
      if (!id) {
        return respondError(reply, 422, 'group_id_required', correlationId);
      }

      const currentRes = await query(
        `select ativo from grupos where id = $1`,
        [id]
      );

      if (currentRes.rowCount === 0) {
        return respondError(reply, 404, 'group_not_found', correlationId);
      }

      const current = currentRes.rows[0].ativo;
      const nextValue = typeof request.body?.active === 'boolean' ? request.body.active : !current;

      await query(
        `update grupos set ativo = $2 where id = $1`,
        [id, nextValue]
      );

      return respondSuccess(reply, { id, ativo: nextValue });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_groups_toggle_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/groups/:id/toggle',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_groups_toggle_error', correlationId);
    }
  });

  app.get('/api/v1/coupons', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const status = request.query?.status || 'all';
      const statuses = status === 'all' ? Object.keys(COUPON_TABLES) : [status];
      const items = [];

      for (const key of statuses) {
        const table = COUPON_TABLES[key];
        if (!table) continue;
        const res = await query(
          `select id, codigo, criado_em
           from ${table}
           order by criado_em desc`
        );
        for (const row of res.rows) {
          items.push({
            id: row.id,
            code: row.codigo,
            status: key,
            created_at: row.criado_em
          });
        }
      }

      return respondSuccess(reply, items);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_coupons_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/coupons',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_coupons_error', correlationId);
    }
  });

  app.post('/api/v1/coupons/approve', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const code = (request.body?.code || '').trim().toUpperCase();
      if (!code) return respondError(reply, 422, 'code_required', correlationId);

      await query(
        `insert into cupons_aprovados (codigo)
         values ($1)
         on conflict (codigo) do nothing`,
        [code]
      );
      await query(`delete from cupons_bloqueados where codigo = $1`, [code]);
      await query(`delete from cupons_pendentes where codigo = $1`, [code]);

      return respondSuccess(reply, { code });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_coupons_approve_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/coupons/approve',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_coupons_approve_error', correlationId);
    }
  });

  app.post('/api/v1/coupons/block', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const code = (request.body?.code || '').trim().toUpperCase();
      if (!code) return respondError(reply, 422, 'code_required', correlationId);

      await query(
        `insert into cupons_bloqueados (codigo)
         values ($1)
         on conflict (codigo) do nothing`,
        [code]
      );
      await query(`delete from cupons_aprovados where codigo = $1`, [code]);
      await query(`delete from cupons_pendentes where codigo = $1`, [code]);

      return respondSuccess(reply, { code });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_coupons_block_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/coupons/block',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_coupons_block_error', correlationId);
    }
  });

  app.post('/api/v1/coupons/pending', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const code = (request.body?.code || '').trim().toUpperCase();
      if (!code) return respondError(reply, 422, 'code_required', correlationId);

      await query(
        `insert into cupons_pendentes (codigo)
         values ($1)
         on conflict (codigo) do nothing`,
        [code]
      );
      await query(`delete from cupons_aprovados where codigo = $1`, [code]);
      await query(`delete from cupons_bloqueados where codigo = $1`, [code]);

      return respondSuccess(reply, { code });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_coupons_pending_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/coupons/pending',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_coupons_pending_error', correlationId);
    }
  });

  app.post('/api/v1/coupons/remove', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const code = (request.body?.code || '').trim().toUpperCase();
      if (!code) return respondError(reply, 422, 'code_required', correlationId);

      await query(`delete from cupons_aprovados where codigo = $1`, [code]);
      await query(`delete from cupons_bloqueados where codigo = $1`, [code]);
      await query(`delete from cupons_pendentes where codigo = $1`, [code]);

      return respondSuccess(reply, { code });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_coupons_remove_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/coupons/remove',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_coupons_remove_error', correlationId);
    }
  });

  app.get('/api/v1/templates', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const active = request.query?.active;
      const type = request.query?.type;
      const conditions = [];
      const params = [];

      if (active !== undefined) {
        params.push(active === 'true');
        conditions.push(`ativo = $${params.length}`);
      }
      if (type) {
        params.push(type);
        conditions.push(`tipo = $${params.length}`);
      }

      const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
      const res = await query(
        `select id, nome, body, tipo, ativo, criado_em
         from templates
         ${where}
         order by criado_em desc`,
        params
      );

      const items = res.rows.map((row) => ({
        id: row.id,
        name: row.nome,
        content: row.body,
        type: row.tipo,
        active: row.ativo,
        created_at: row.criado_em
      }));

      return respondSuccess(reply, items);
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_templates_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/templates',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_templates_error', correlationId);
    }
  });

  app.post('/api/v1/templates', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { name, content, type, active = true, marketplace = 'mercadolivre' } = request.body || {};
      if (!name || !content) return respondError(reply, 422, 'name_and_content_required', correlationId);

      const res = await query(
        `insert into templates (marketplace, tipo, nome, body, ativo)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [marketplace, type || 'padrao', name, content, Boolean(active)]
      );

      return respondSuccess(reply, { id: res.rows[0].id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_templates_create_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/templates POST',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_templates_create_error', correlationId);
    }
  });

  app.patch('/api/v1/templates/:id', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const id = request.params?.id;
      const { name, content, type, active } = request.body || {};
      if (!id) return respondError(reply, 422, 'template_id_required', correlationId);

      await query(
        `update templates
         set nome = coalesce($2, nome),
             body = coalesce($3, body),
             tipo = coalesce($4, tipo),
             ativo = coalesce($5, ativo)
         where id = $1`,
        [
          id,
          name || null,
          content || null,
          type || null,
          typeof active === 'boolean' ? active : null
        ]
      );

      return respondSuccess(reply, { id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_templates_update_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/templates PATCH',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_templates_update_error', correlationId);
    }
  });

  app.delete('/api/v1/templates/:id', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const id = request.params?.id;
      if (!id) return respondError(reply, 422, 'template_id_required', correlationId);

      await query(`delete from templates where id = $1`, [id]);
      return respondSuccess(reply, { id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'api_v1_templates_delete_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro api/v1/templates DELETE',
        payload: { stack: err?.stack }
      });
      return respondError(reply, 500, 'api_v1_templates_delete_error', correlationId);
    }
  });
}
