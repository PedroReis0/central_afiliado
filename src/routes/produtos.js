import { query } from '../db.js';

export function registerProdutosRoutes(app) {
  app.post('/produtos/criar', async (request, reply) => {
    const { nome_msg: nomeMsg, nome_oficial: nomeOficial } = request.body || {};

    if (!nomeOficial) {
      return reply.code(422).send({ ok: false, error: 'nome_oficial_required' });
    }

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
  });

  app.post('/fila/produto/confirmar', async (request, reply) => {
    const {
      fila_id: filaId,
      produto_id: produtoId,
      marketplace,
      marketplace_product_id: mpId,
      link_limpo: linkLimpo,
      link_afiliado: linkAfiliado
    } = request.body || {};

    if (!filaId || !produtoId) {
      return reply.code(422).send({ ok: false, error: 'fila_id_and_produto_id_required' });
    }
    if (!marketplace || !mpId || !linkLimpo || !linkAfiliado) {
      return reply.code(422).send({ ok: false, error: 'marketplace_data_required' });
    }

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
  });

  app.get('/fila/produto', async (request, reply) => {
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
  });
}
