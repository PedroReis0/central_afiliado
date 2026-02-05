import crypto from 'crypto';
import { query } from '../db.js';
import { getRandomTemplate, renderTemplate } from '../services/templates.js';
import { sendMedia, sendText } from '../services/evolution.js';
import { logEvent } from '../services/logs.js';

export function registerDispatcherRoutes(app) {
  app.post('/dispatcher/enviar', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    const { oferta_id: ofertaId } = request.body || {};

    if (!ofertaId) {
      await logEvent({
        correlationId,
        evento: 'dispatcher_invalido',
        nivel: 'warn',
        mensagem: 'oferta_id_required'
      });
      return reply.code(422).send({ ok: false, error: 'oferta_id_required' });
    }

    try {
      const ofertaRes = await query(
        `select id, mensagem_id, nome_produto, oferta_completa, marketplace, tipo_oferta, marketplace_product_id
         from ofertas_parseadas
         where id = $1`,
        [ofertaId]
      );

      if (ofertaRes.rowCount === 0) {
        await logEvent({
          correlationId,
          evento: 'dispatcher_oferta_not_found',
          nivel: 'warn',
          mensagem: 'oferta_not_found',
          payload: { oferta_id: ofertaId }
        });
        return reply.code(404).send({ ok: false, error: 'oferta_not_found' });
      }

      const oferta = ofertaRes.rows[0];
      const marketplace = oferta.marketplace || 'mercadolivre';
      const tipo = oferta.tipo_oferta || 'padrao';

      const produtoRes = await query(
        `select id, produto_id, link_afiliado
         from produto_marketplace
         where marketplace = $1 and marketplace_product_id = $2 and ativo = true
         limit 1`,
        [marketplace, oferta.marketplace_product_id]
      );

      if (produtoRes.rowCount === 0) {
        await logEvent({
          correlationId,
          evento: 'dispatcher_sem_produto',
          nivel: 'warn',
          mensagem: 'Produto marketplace nao encontrado',
          payload: { oferta_id: ofertaId, marketplace }
        });
        return reply.code(200).send({ ok: false, error: 'produto_marketplace_not_found' });
      }

      const produtoMarketplace = produtoRes.rows[0];

      const produtoFotoRes = await query(
        `select foto_url, foto_mimetype
         from produtos
         where produto_id = $1`,
        [produtoMarketplace.produto_id]
      );

      const fotoUrl = produtoFotoRes.rowCount > 0 ? produtoFotoRes.rows[0].foto_url : null;
      const fotoMimetype = produtoFotoRes.rowCount > 0 ? produtoFotoRes.rows[0].foto_mimetype : null;

      if (!fotoUrl) {
        await query(`update ofertas_parseadas set status = 'sem_foto' where id = $1`, [oferta.id]);
        await logEvent({
          correlationId,
          evento: 'dispatcher_sem_foto',
          nivel: 'warn',
          mensagem: 'Envio bloqueado: produto sem foto',
          payload: { oferta_id: ofertaId, produto_id: produtoMarketplace.produto_id }
        });
        return reply.code(200).send({ ok: false, error: 'produto_sem_foto' });
      }

      const template = await getRandomTemplate({ marketplace, tipo });
      if (!template) {
        await logEvent({
          correlationId,
          evento: 'dispatcher_sem_template',
          nivel: 'warn',
          mensagem: 'Nenhum template ativo encontrado',
          payload: { marketplace, tipo }
        });
        return reply.code(404).send({ ok: false, error: 'template_not_found' });
      }

      const textoFinal = renderTemplate(template.body, {
        nome_msg: oferta.nome_produto || '',
        oferta: oferta.oferta_completa || '',
        link_afiliado: produtoMarketplace.link_afiliado || ''
      });

      const mensagemRes = await query(
        `select instance_id
         from mensagens_recebidas
         where id = $1`,
        [oferta.mensagem_id]
      );

      if (mensagemRes.rowCount === 0) {
        await logEvent({
          correlationId,
          evento: 'dispatcher_mensagem_not_found',
          nivel: 'warn',
          mensagem: 'mensagem_not_found',
          payload: { mensagem_id: oferta.mensagem_id }
        });
        return reply.code(404).send({ ok: false, error: 'mensagem_not_found' });
      }

      const instanceId = mensagemRes.rows[0].instance_id;
      const instanceRes = await query(
        `select instance_name
         from instancias
         where instance_id = $1`,
        [instanceId]
      );
      const instanceName = instanceRes.rowCount > 0 ? (instanceRes.rows[0].instance_name || instanceId) : instanceId;

      const gruposRes = await query(
        `select group_id
         from grupos
         where instance_id = $1 and ativo = true`,
        [instanceId]
      );

      if (gruposRes.rowCount === 0) {
        await logEvent({
          correlationId,
          evento: 'dispatcher_sem_grupos',
          nivel: 'warn',
          mensagem: 'Nenhum grupo ativo para a instancia',
          payload: { instance_id: instanceId }
        });
        return reply.code(200).send({ ok: false, error: 'no_active_groups' });
      }

      const resultados = [];
      for (const grupo of gruposRes.rows) {
        const resp = await sendMedia({
          instanceName,
          remoteJid: grupo.group_id,
          mediaUrl: fotoUrl,
          mimetype: fotoMimetype || 'image/jpeg',
          caption: textoFinal,
          fileName: 'produto.jpg'
        });
        resultados.push({ group_id: grupo.group_id, ok: Boolean(resp) });
      }

      await query(
        `insert into ofertas_enviadas
          (oferta_id, batch_id, produto_id, marketplace, texto_final, cupons_usados, valor, instance_id,
           grupos_enviados, media_url, resultado_por_grupo, status)
         values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'enviada')`,
        [
          oferta.id,
          null,
          produtoMarketplace.produto_id,
          marketplace,
          textoFinal,
          [],
          null,
          instanceId,
          resultados.map((r) => r.group_id),
          fotoUrl,
          JSON.stringify(resultados)
        ]
      );

      await query(`update ofertas_parseadas set status = 'enviada' where id = $1`, [oferta.id]);

      return reply.code(200).send({
        ok: true,
        status: 'enviada',
        grupos: resultados
      });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'dispatcher_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao enviar oferta',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'dispatcher_error', correlation_id: correlationId });
    }
  });
}
