import crypto from 'crypto';
import { query } from '../db.js';
import { logEvent } from '../services/logs.js';

export function registerProdutosAdminRoutes(app) {
  app.get('/produtos', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const ativo = request.query?.ativo;
      const categoriaId = request.query?.categoria_id;
      const subcategoriaId = request.query?.subcategoria_id;
      const conditions = [];
      const params = [];

      if (ativo !== undefined) {
        params.push(ativo === 'true');
        conditions.push(`ativo = $${params.length}`);
      }
      if (categoriaId) {
        params.push(categoriaId);
        conditions.push(`categoria_id = $${params.length}`);
      }
      if (subcategoriaId) {
        params.push(subcategoriaId);
        conditions.push(`subcategoria_id = $${params.length}`);
      }

      const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
      const res = await query(
        `select produto_id, nome, nome_msg, nome_oficial, ativo, foto_url, foto_downloaded_at, criado_em
         from produtos
         ${where}
         order by criado_em desc
         limit 200`,
        params
      );
      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'produtos_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar produtos',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'produtos_listar_error', correlation_id: correlationId });
    }
  });

  app.put('/produtos/:id', async (request, reply) => {
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
          evento: 'produtos_update_invalido',
          nivel: 'warn',
          mensagem: 'produto_id_required'
        });
        return reply.code(422).send({ ok: false, error: 'produto_id_required' });
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

      return reply.code(200).send({ ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'produtos_update_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao atualizar produto',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'produtos_update_error', correlation_id: correlationId });
    }
  });

  app.get('/produtos/marketplace', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const marketplace = request.query?.marketplace;
      const categoriaId = request.query?.categoria_id;
      const subcategoriaId = request.query?.subcategoria_id;
      const conditions = [];
      const params = [];
      if (marketplace) {
        params.push(marketplace);
        conditions.push(`pm.marketplace = $${params.length}`);
      }
      if (categoriaId) {
        params.push(categoriaId);
        conditions.push(`p.categoria_id = $${params.length}`);
      }
      if (subcategoriaId) {
        params.push(subcategoriaId);
        conditions.push(`p.subcategoria_id = $${params.length}`);
      }
      const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
      const res = await query(
        `select pm.id, pm.marketplace, pm.marketplace_product_id, pm.link_limpo, pm.link_afiliado, pm.ativo,
                p.produto_id, p.nome_oficial, p.foto_url
         from produto_marketplace pm
         join produtos p on p.produto_id = pm.produto_id
         ${where}
         order by pm.criado_em desc
         limit 200`,
        params
      );
      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'produtos_marketplace_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar produtos marketplace',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'produtos_marketplace_listar_error', correlation_id: correlationId });
    }
  });

  app.get('/categorias', async (request, reply) => {
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
      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'categorias_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar categorias',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'categorias_listar_error', correlation_id: correlationId });
    }
  });

  app.get('/subcategorias', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const categoriaId = request.query?.categoria_id;
      const conditions = [];
      const params = [];
      if (categoriaId) {
        params.push(categoriaId);
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
      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'subcategorias_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar subcategorias',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'subcategorias_listar_error', correlation_id: correlationId });
    }
  });

  app.get('/marketplaces', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const res = await query(
        `select distinct marketplace
         from produto_marketplace
         where marketplace is not null
         order by marketplace`
      );
      return reply.code(200).send({ ok: true, items: res.rows.map((r) => r.marketplace) });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'marketplaces_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar marketplaces',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'marketplaces_listar_error', correlation_id: correlationId });
    }
  });

  app.put('/produtos/marketplace/:id', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const id = request.params?.id;
      const { link_afiliado: linkAfiliado, ativo } = request.body || {};
      if (!id) {
        await logEvent({
          correlationId,
          evento: 'produtos_marketplace_update_invalido',
          nivel: 'warn',
          mensagem: 'id_required'
        });
        return reply.code(422).send({ ok: false, error: 'id_required' });
      }

      await query(
        `update produto_marketplace
         set link_afiliado = coalesce($2, link_afiliado),
             ativo = coalesce($3, ativo)
         where id = $1`,
        [
          id,
          linkAfiliado || null,
          typeof ativo === 'boolean' ? ativo : null
        ]
      );

      return reply.code(200).send({ ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'produtos_marketplace_update_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao atualizar produto marketplace',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'produtos_marketplace_update_error', correlation_id: correlationId });
    }
  });
}
