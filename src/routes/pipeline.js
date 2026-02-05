import { query } from '../db.js';

export function registerPipelineRoutes(app) {
  app.post('/pipeline/oferta/processar', async (request, reply) => {
    const { oferta_id: ofertaId, marketplace = 'mercadolivre' } = request.body || {};

    if (!ofertaId) {
      return reply.code(422).send({ ok: false, error: 'oferta_id_required' });
    }

    const ofertaRes = await query(
      `select id, mensagem_id, nome_produto, nome_oficial, link_scrape, link_limpo, marketplace_product_id
       from ofertas_parseadas
       where id = $1`,
      [ofertaId]
    );

    if (ofertaRes.rowCount === 0) {
      return reply.code(404).send({ ok: false, error: 'oferta_not_found' });
    }

    const oferta = ofertaRes.rows[0];
    if (marketplace !== 'mercadolivre') {
      return reply.code(422).send({ ok: false, error: 'marketplace_not_supported' });
    }

    const marketplaceProductId = oferta.marketplace_product_id || null;
    const linkLimpo = oferta.link_limpo || null;
    const nomeOficial = oferta.nome_oficial || null;

    if (!marketplaceProductId) {
      await query(`update ofertas_parseadas set status = 'sem_marketplace_id' where id = $1`, [ofertaId]);
      await query(
        `insert into logs_eventos (correlation_id, evento, nivel, mensagem, payload)
         values ($1, 'pipeline_sem_marketplace_id', 'warn', 'Oferta sem marketplace_product_id', $2)`,
        [
          String(ofertaId),
          JSON.stringify({ oferta_id: ofertaId, marketplace })
        ]
      );
      return reply.code(200).send({ ok: false, status: 'sem_marketplace_id' });
    }

    const exists = await query(
      `select id, produto_id
       from produto_marketplace
       where marketplace = $1 and marketplace_product_id = $2 and ativo = true
       limit 1`,
      [marketplace, marketplaceProductId]
    );

    if (exists.rowCount > 0) {
      await query(`update ofertas_parseadas set status = 'produto_ok' where id = $1`, [ofertaId]);
      return reply.code(200).send({
        ok: true,
        status: 'produto_ok',
        produto_marketplace_id: exists.rows[0].id,
        produto_id: exists.rows[0].produto_id
      });
    }

    // Evitar duplicar fila
    const filaExistente = await query(
      `select id from fila_cadastro_produto
       where marketplace = $1 and marketplace_product_id = $2 and status = 'pendente'
       limit 1`,
      [marketplace, marketplaceProductId]
    );

    if (filaExistente.rowCount > 0) {
      await query(`update ofertas_parseadas set status = 'produto_pendente' where id = $1`, [ofertaId]);
      return reply.code(200).send({ ok: true, status: 'produto_pendente', fila_id: filaExistente.rows[0].id });
    }

    // Sugestao por nome_oficial
    let produtoIdSugerido = null;
    if (nomeOficial) {
      const similar = await query(
        `select produto_id
         from produtos
         where nome_oficial ilike $1
         order by criado_em desc
         limit 1`,
        [`%${nomeOficial}%`]
      );
      if (similar.rowCount > 0) {
        produtoIdSugerido = similar.rows[0].produto_id;
      }
    }

    const mensagemRes = await query(
      `select media_url
       from mensagens_recebidas
       where id = $1`,
      [oferta.mensagem_id]
    );

    const mediaUrl = mensagemRes.rowCount > 0 ? mensagemRes.rows[0].media_url : null;

    const fila = await query(
      `insert into fila_cadastro_produto
        (mensagem_id, oferta_id, produto_id, produto_id_sugerido, marketplace, marketplace_product_id, link_limpo, nome_sugerido, media_url, status)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendente')
       returning id`,
      [
        oferta.mensagem_id,
        ofertaId,
        null,
        produtoIdSugerido,
        marketplace,
        marketplaceProductId,
        linkLimpo,
        oferta.nome_produto || nomeOficial || null,
        mediaUrl
      ]
    );

    await query(`update ofertas_parseadas set status = 'produto_pendente' where id = $1`, [ofertaId]);

    return reply.code(200).send({
      ok: true,
      status: 'produto_pendente',
      fila_id: fila.rows[0].id,
      produto_id_sugerido: produtoIdSugerido || null
    });
  });

  app.post('/pipeline/produto/decisao', async (request, reply) => {
    const {
      mensagem_id: mensagemId,
      oferta_id: ofertaId,
      marketplace = 'mercadolivre',
      marketplace_product_id: mpId,
      nome_msg: nomeMsg,
      nome_oficial: nomeOficial,
      link_limpo: linkLimpo,
      media_url: mediaUrl
    } = request.body || {};

    if (!mpId) {
      return reply.code(422).send({ ok: false, error: 'marketplace_product_id_required' });
    }

    // 1) Busca por marketplace_product_id
    const found = await query(
      `select id, produto_id
       from produto_marketplace
       where marketplace = $1 and marketplace_product_id = $2 and ativo = true
       limit 1`,
      [marketplace, mpId]
    );

    if (found.rowCount > 0) {
      return reply.code(200).send({
        ok: true,
        status: 'produto_ok',
        produto_marketplace_id: found.rows[0].id,
        produto_id: found.rows[0].produto_id
      });
    }

    // 2) Busca por nome_oficial (produto principal)
    let produtoIdSugerido = null;
    if (nomeOficial) {
      const similar = await query(
        `select produto_id
         from produtos
         where nome_oficial ilike $1
         order by criado_em desc
         limit 1`,
        [`%${nomeOficial}%`]
      );
      if (similar.rowCount > 0) {
        produtoIdSugerido = similar.rows[0].produto_id;
      }
    }

    // 3) Enfileira cadastro
    await query(
      `insert into fila_cadastro_produto
        (mensagem_id, oferta_id, produto_id, produto_id_sugerido, marketplace, marketplace_product_id, link_limpo, nome_sugerido, media_url, status)
       values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendente')`,
      [
        mensagemId || null,
        ofertaId || null,
        null,
        produtoIdSugerido || null,
        marketplace,
        mpId,
        linkLimpo || null,
        nomeMsg || nomeOficial || null,
        mediaUrl || null
      ]
    );

    return reply.code(200).send({
      ok: true,
      status: 'produto_pendente',
      produto_id: null,
      produto_id_sugerido: produtoIdSugerido || null
    });
  });
}
