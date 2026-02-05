import crypto from 'crypto';
import { query } from '../db.js';
import { matchProdutoPrincipal } from '../services/llm.js';
import { downloadAndStoreProductPhoto } from '../services/media.js';
import { logEvent } from '../services/logs.js';

function normalizeName(text) {
  return (text || '').trim().toLowerCase();
}

async function findExactProdutoPrincipal(nomeOficial) {
  if (!nomeOficial) return null;
  const res = await query(
    `select produto_id, nome_oficial
     from produtos
     where lower(nome_oficial) = $1
     limit 1`,
    [normalizeName(nomeOficial)]
  );
  return res.rowCount > 0 ? res.rows[0] : null;
}

async function findSimilarProdutos(nomeOficial, limit = 5) {
  if (!nomeOficial) return [];
  const res = await query(
    `select produto_id, nome_oficial
     from produtos
     where similarity(nome_oficial, $1) > 0.2
     order by similarity(nome_oficial, $1) desc
     limit $2`,
    [nomeOficial, limit]
  );
  return res.rows || [];
}


export function registerPipelineRoutes(app) {
  app.post('/pipeline/oferta/processar', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    const { oferta_id: ofertaId, marketplace = 'mercadolivre' } = request.body || {};

    if (!ofertaId) {
      await logEvent({
        correlationId,
        evento: 'pipeline_oferta_invalida',
        nivel: 'warn',
        mensagem: 'oferta_id_required'
      });
      return reply.code(422).send({ ok: false, error: 'oferta_id_required' });
    }

    try {
      const ofertaRes = await query(
        `select id, mensagem_id, nome_produto, nome_oficial, link_scrape, link_limpo, marketplace_product_id, cupons
         from ofertas_parseadas
         where id = $1`,
        [ofertaId]
      );

      if (ofertaRes.rowCount === 0) {
        await logEvent({
          correlationId,
          evento: 'pipeline_oferta_not_found',
          nivel: 'warn',
          mensagem: 'oferta_not_found',
          payload: { oferta_id: ofertaId }
        });
        return reply.code(404).send({ ok: false, error: 'oferta_not_found' });
      }

      const oferta = ofertaRes.rows[0];
      if (marketplace !== 'mercadolivre') {
        await logEvent({
          correlationId,
          evento: 'pipeline_marketplace_not_supported',
          nivel: 'warn',
          mensagem: 'marketplace_not_supported',
          payload: { marketplace }
        });
        return reply.code(422).send({ ok: false, error: 'marketplace_not_supported' });
      }

      const marketplaceProductId = oferta.marketplace_product_id || null;
      const linkLimpo = oferta.link_limpo || null;
      const nomeOficial = oferta.nome_oficial || null;
      const cupons = Array.isArray(oferta.cupons) ? oferta.cupons : [];

      if (cupons.length > 0) {
        const blockedRes = await query(
          `select codigo from cupons_bloqueados where codigo = any($1)`,
          [cupons]
        );
        if (blockedRes.rowCount > 0) {
          await query(`update ofertas_parseadas set status = 'cupom_bloqueado' where id = $1`, [ofertaId]);
          await logEvent({
            correlationId,
            evento: 'cupom_bloqueado',
            nivel: 'warn',
            mensagem: 'Cupom bloqueado',
            payload: { oferta_id: ofertaId, cupons: blockedRes.rows.map((r) => r.codigo) }
          });
          return reply.code(200).send({ ok: false, status: 'cupom_bloqueado' });
        }

        const approvedRes = await query(
          `select codigo from cupons_aprovados where codigo = any($1)`,
          [cupons]
        );
        const approved = approvedRes.rows.map((r) => r.codigo);

        const pendingRes = await query(
          `select codigo from cupons_pendentes where codigo = any($1)`,
          [cupons]
        );
        const pending = new Set(pendingRes.rows.map((r) => r.codigo));

        const notFound = cupons.filter((c) => !approved.includes(c) && !pending.has(c));
        if (notFound.length > 0) {
          await query(
            `insert into cupons_pendentes (codigo)
             select unnest($1::text[])
             on conflict (codigo) do nothing`,
            [notFound]
          );
        }

        if (pending.size > 0 || notFound.length > 0) {
          await query(`update ofertas_parseadas set status = 'cupom_pendente' where id = $1`, [ofertaId]);
          await logEvent({
            correlationId,
            evento: 'cupom_pendente',
            nivel: 'warn',
            mensagem: 'Cupom pendente',
            payload: { oferta_id: ofertaId, cupons: Array.from(pending).concat(notFound) }
          });
          return reply.code(200).send({ ok: false, status: 'cupom_pendente' });
        }

        if (approved.length > 0 && approved.length === cupons.length) {
          await query(`update ofertas_parseadas set status = 'cupom_ok' where id = $1`, [ofertaId]);
        }
      }

      if (!marketplaceProductId) {
        await query(`update ofertas_parseadas set status = 'sem_marketplace_id' where id = $1`, [ofertaId]);
        await logEvent({
          correlationId,
          evento: 'pipeline_sem_marketplace_id',
          nivel: 'warn',
          mensagem: 'Oferta sem marketplace_product_id',
          payload: { oferta_id: ofertaId, marketplace }
        });
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

      // Busca por produto principal (ativo ou pendente)
      let produtoIdPrincipal = null;
      if (nomeOficial) {
        const exact = await findExactProdutoPrincipal(nomeOficial);
        if (exact) {
          produtoIdPrincipal = exact.produto_id;
        } else {
          const similares = await findSimilarProdutos(nomeOficial, 5);
          if (similares.length > 0) {
            const llmChoice = await matchProdutoPrincipal({
              nomeOficial,
              candidatos: similares.map((s) => ({ produto_id: s.produto_id, nome_oficial: s.nome_oficial }))
            });
            if (llmChoice?.match && llmChoice.produto_id) {
              produtoIdPrincipal = llmChoice.produto_id;
            }
          }
        }
      }

      let produtoFotoUrl = null;
      if (!produtoIdPrincipal) {
        const created = await query(
          `insert into produtos (nome, nome_msg, nome_oficial, ativo)
           values ($1, $2, $3, false)
           returning produto_id`,
          [nomeOficial || oferta.nome_produto || 'Produto sem nome', oferta.nome_produto || null, nomeOficial || null]
        );
        produtoIdPrincipal = created.rows[0].produto_id;
        produtoFotoUrl = await downloadAndStoreProductPhoto({ produtoId: produtoIdPrincipal, mensagemId: oferta.mensagem_id });
        if (!produtoFotoUrl) {
          await logEvent({
            correlationId,
            evento: 'produto_foto_download_failed',
            nivel: 'warn',
            mensagem: 'Falha ao baixar foto do produto principal',
            payload: { produto_id: produtoIdPrincipal, mensagem_id: oferta.mensagem_id }
          });
        }
      }
      if (!produtoFotoUrl && produtoIdPrincipal) {
        const fotoRes = await query(
          `select foto_url
           from produtos
           where produto_id = $1`,
          [produtoIdPrincipal]
        );
        if (fotoRes.rowCount > 0) {
          produtoFotoUrl = fotoRes.rows[0].foto_url || null;
        }
      }

      // Evitar duplicar fila
      const filaExistente = await query(
        `select id, produto_id from fila_cadastro_produto
         where marketplace = $1 and marketplace_product_id = $2 and status = 'pendente'
         limit 1`,
        [marketplace, marketplaceProductId]
      );

      if (filaExistente.rowCount > 0) {
        if (!filaExistente.rows[0].produto_id && produtoIdPrincipal) {
          await query(
            `update fila_cadastro_produto
             set produto_id = $1
             where id = $2`,
            [produtoIdPrincipal, filaExistente.rows[0].id]
          );
        }
        await query(`update ofertas_parseadas set status = 'produto_pendente' where id = $1`, [ofertaId]);
        return reply.code(200).send({ ok: true, status: 'produto_pendente', fila_id: filaExistente.rows[0].id });
      }

      const fila = await query(
        `insert into fila_cadastro_produto
          (mensagem_id, oferta_id, produto_id, produto_id_sugerido, marketplace, marketplace_product_id, link_limpo, nome_sugerido, media_url, status)
         values
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pendente')
         returning id`,
        [
          oferta.mensagem_id,
          ofertaId,
          produtoIdPrincipal,
          null,
          marketplace,
          marketplaceProductId,
          linkLimpo,
          oferta.nome_produto || nomeOficial || null,
          produtoFotoUrl
        ]
      );

      await query(`update ofertas_parseadas set status = 'produto_pendente' where id = $1`, [ofertaId]);

      return reply.code(200).send({
        ok: true,
        status: 'produto_pendente',
        fila_id: fila.rows[0].id,
        produto_id_sugerido: produtoIdPrincipal || null
      });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'pipeline_oferta_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro pipeline oferta',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'pipeline_oferta_error', correlation_id: correlationId });
    }
  });

  app.post('/pipeline/produto/decisao', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
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
      await logEvent({
        correlationId,
        evento: 'pipeline_decisao_invalida',
        nivel: 'warn',
        mensagem: 'marketplace_product_id_required'
      });
      return reply.code(422).send({ ok: false, error: 'marketplace_product_id_required' });
    }

    try {
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
      let produtoIdPrincipal = null;
      if (nomeOficial) {
        const exact = await findExactProdutoPrincipal(nomeOficial);
        if (exact) {
          produtoIdPrincipal = exact.produto_id;
        } else {
          const similares = await findSimilarProdutos(nomeOficial, 5);
          if (similares.length > 0) {
            const llmChoice = await matchProdutoPrincipal({
              nomeOficial,
              candidatos: similares.map((s) => ({ produto_id: s.produto_id, nome_oficial: s.nome_oficial }))
            });
            if (llmChoice?.match && llmChoice.produto_id) {
              produtoIdPrincipal = llmChoice.produto_id;
            }
          }
        }
      }

      let produtoFotoUrl = null;
      if (!produtoIdPrincipal) {
        const created = await query(
          `insert into produtos (nome, nome_msg, nome_oficial, ativo)
           values ($1, $2, $3, false)
           returning produto_id`,
          [nomeOficial || nomeMsg || 'Produto sem nome', nomeMsg || null, nomeOficial || null]
        );
        produtoIdPrincipal = created.rows[0].produto_id;
        produtoFotoUrl = await downloadAndStoreProductPhoto({ produtoId: produtoIdPrincipal, mensagemId });
        if (!produtoFotoUrl) {
          await logEvent({
            correlationId,
            evento: 'produto_foto_download_failed',
            nivel: 'warn',
            mensagem: 'Falha ao baixar foto do produto principal',
            payload: { produto_id: produtoIdPrincipal, mensagem_id: mensagemId }
          });
        }
      }

      if (!produtoFotoUrl && produtoIdPrincipal) {
        const fotoRes = await query(
          `select foto_url
           from produtos
           where produto_id = $1`,
          [produtoIdPrincipal]
        );
        if (fotoRes.rowCount > 0) {
          produtoFotoUrl = fotoRes.rows[0].foto_url || null;
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
          produtoIdPrincipal || null,
          null,
          marketplace,
          mpId,
          linkLimpo || null,
          nomeMsg || nomeOficial || null,
          produtoFotoUrl || mediaUrl || null
        ]
      );

      return reply.code(200).send({
        ok: true,
        status: 'produto_pendente',
        produto_id: produtoIdPrincipal || null,
        produto_id_sugerido: null
      });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'pipeline_decisao_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro pipeline decisao',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'pipeline_decisao_error', correlation_id: correlationId });
    }
  });
}
