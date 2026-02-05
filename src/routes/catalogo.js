import { query } from '../db.js';

export function registerCatalogRoutes(app) {
  app.post('/catalogo/marketplace/busca', async (request, reply) => {
    const { marketplace_product_id: mpId, catalogo_id: catalogoId, marketplace } = request.body || {};
    const id = mpId || catalogoId;
    if (!id) {
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
  });
}
