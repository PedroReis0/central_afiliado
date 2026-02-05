import { scrapeMercadoLivre } from '../services/scraper_ml.js';

export function registerScraperRoutes(app) {
  app.post('/scrape/mercadolivre', async (request, reply) => {
    const { link } = request.body || {};
    if (!link) {
      return reply.code(422).send({ ok: false, error: 'link_required' });
    }

    try {
      const result = await scrapeMercadoLivre(link);
      return reply.code(200).send(result);
    } catch (err) {
      request.log.error({ err }, 'scrape_failed');
      return reply.code(500).send({ ok: false, error: 'scrape_failed' });
    }
  });

  app.post('/scrape/mercadolivre/oferta', async (request, reply) => {
    const { oferta_id: ofertaId } = request.body || {};
    if (!ofertaId) {
      return reply.code(422).send({ ok: false, error: 'oferta_id_required' });
    }

    const ofertaRes = await import('../db.js').then(({ query }) =>
      query('select id, link_scrape from ofertas_parseadas where id = $1', [ofertaId])
    );

    if (ofertaRes.rowCount === 0) {
      return reply.code(404).send({ ok: false, error: 'oferta_not_found' });
    }

    const link = ofertaRes.rows[0].link_scrape;
    if (!link) {
      return reply.code(200).send({ ok: false, error: 'sem_link' });
    }

    try {
      const result = await scrapeMercadoLivre(link);
      if (result.ok) {
        const { query } = await import('../db.js');
        await query(
          `update ofertas_parseadas
           set nome_oficial = $1, link_limpo = $2, marketplace_product_id = $3
           where id = $4`,
          [
            result.dados?.titulo || null,
            result.dados?.url_base || null,
            result.dados?.marketplace_product_id || null,
            ofertaId
          ]
        );
      }
      return reply.code(200).send(result);
    } catch (err) {
      request.log.error({ err }, 'scrape_failed');
      return reply.code(500).send({ ok: false, error: 'scrape_failed' });
    }
  });
}
