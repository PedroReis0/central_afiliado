import crypto from 'crypto';
import { query } from '../db.js';
import { logEvent } from '../services/logs.js';

export function registerProdutosRoutes(app) {
  app.post('/produtos/criar', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    const { nome_msg: nomeMsg, nome_oficial: nomeOficial } = request.body || {};

    if (!nomeOficial) {
      await logEvent({
        correlationId,
        evento: 'produtos_criar_invalido',
        nivel: 'warn',
        mensagem: 'nome_oficial_required'
      });
      return reply.code(422).send({ ok: false, error: 'nome_oficial_required' });
    }

    try {
      const created = await query(
        `insert into produtos (nome, nome_msg, nome_oficial, ativo)
         values ($1, $2, $3, true)
         returning produto_id`,
        [nomeOficial, nomeMsg || null, nomeOficial]
      );

      const produtoId = created.rows[0].produto_id;

      // Reprocessa fila: sugere este produto principal para itens pendentes semelhantes
      await query(
        `update fila_cadastro_produto
         set produto_id_sugerido = $1
         where status = 'pendente'
           and produto_id_sugerido is null
           and nome_sugerido ilike $2`,
        [produtoId, `%${nomeOficial}%`]
      );

      return reply.code(200).send({ ok: true, produto_id: produtoId });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'produtos_criar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao criar produto',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'produtos_criar_error', correlation_id: correlationId });
    }
  });

  app.post('/fila/produto/confirmar', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    const {
      fila_id: filaId,
      produto_id: produtoId,
      marketplace,
      marketplace_product_id: mpId,
      link_limpo: linkLimpo,
      link_afiliado: linkAfiliado
    } = request.body || {};

    if (!filaId || !produtoId) {
      await logEvent({
        correlationId,
        evento: 'fila_confirmar_invalido',
        nivel: 'warn',
        mensagem: 'fila_id_and_produto_id_required'
      });
      return reply.code(422).send({ ok: false, error: 'fila_id_and_produto_id_required' });
    }
    if (!marketplace || !mpId || !linkLimpo || !linkAfiliado) {
      await logEvent({
        correlationId,
        evento: 'fila_confirmar_invalido',
        nivel: 'warn',
        mensagem: 'marketplace_data_required'
      });
      return reply.code(422).send({ ok: false, error: 'marketplace_data_required' });
    }

    try {
      const created = await query(
        `insert into produto_marketplace
          (produto_id, marketplace, marketplace_product_id, link_limpo, link_afiliado, ativo)
         values ($1,$2,$3,$4,$5,true)
         returning id`,
        [produtoId, marketplace, mpId, linkLimpo, linkAfiliado]
      );

      await query(
        `update fila_cadastro_produto
         set status = 'concluido', produto_id = $1
         where id = $2`,
        [produtoId, filaId]
      );

      return reply.code(200).send({ ok: true, produto_marketplace_id: created.rows[0].id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'fila_confirmar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao confirmar fila',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'fila_confirmar_error', correlation_id: correlationId });
    }
  });

  app.get('/fila/produto', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const status = request.query?.status || 'pendente';
      const limit = Math.min(Number(request.query?.limit || 50), 200);
      const offset = Number(request.query?.offset || 0);

      const res = await query(
        `select id, mensagem_id, oferta_id, produto_id, produto_id_sugerido,
                marketplace, marketplace_product_id, link_limpo, nome_sugerido, media_url, status, criado_em
         from fila_cadastro_produto
         where status = $1
         order by criado_em desc
         limit $2 offset $3`,
        [status, limit, offset]
      );

      return reply.code(200).send({ ok: true, items: res.rows, limit, offset });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'fila_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar fila',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'fila_listar_error', correlation_id: correlationId });
    }
  });
}
