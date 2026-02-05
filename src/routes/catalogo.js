import crypto from 'crypto';
import { query } from '../db.js';
import { logEvent } from '../services/logs.js';

export function registerCatalogRoutes(app) {
  app.post('/catalogo/marketplace/busca', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { marketplace_product_id: mpId, catalogo_id: catalogoId, marketplace } = request.body || {};
      const id = mpId || catalogoId;
      if (!id) {
        await logEvent({
          correlationId,
          evento: 'catalogo_busca_invalida',
          nivel: 'warn',
          mensagem: 'marketplace_product_id_required'
        });
        return reply.code(422).send({ ok: false, error: 'marketplace_product_id_required' });
      }

      const mk = marketplace || 'mercadolivre';

      const sql = `
        select id, produto_id, marketplace, marketplace_product_id, link_limpo, link_afiliado, ativo
        from produto_marketplace
        where marketplace = $1 and marketplace_product_id = $2
        limit 1
      `;

      const res = await query(sql, [mk, id]);
      if (res.rowCount === 0) {
        return reply.code(200).send({ ok: true, found: false });
      }

      return reply.code(200).send({ ok: true, found: true, item: res.rows[0] });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'catalogo_busca_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro catalogo/marketplace/busca',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'catalogo_busca_error', correlation_id: correlationId });
    }
  });
}
