import crypto from 'crypto';
import { query } from '../db.js';
import { detectMarketplaceFromText } from '../services/marketplace.js';
import { parseOffersDeterministic } from '../services/parser.js';
import { parseWithGemini, parseWithOpenAI } from '../services/llm.js';
import { logEvent } from '../services/logs.js';

function stableHash(payload) {
  const json = JSON.stringify(payload);
  return crypto.createHash('sha256').update(json).digest('hex');
}

function pickMediaUrl(payload) {
  return (
    payload.media_url ||
    payload.mediaUrl ||
    payload.image_url ||
    payload.imageUrl ||
    payload.image?.url ||
    payload.media?.url ||
    payload.data?.message?.imageMessage?.url ||
    null
  );
}

function extractFromEvolution(body) {
  const root = Array.isArray(body) ? body[0] : body;
  const bodyRoot = root?.body || root || {};
  const data = bodyRoot?.data || root?.data || {};
  const key = data?.key || {};
  const message = data?.message || {};
  const imageMessage = message?.imageMessage || {};

  const instanceId =
    bodyRoot?.instanceId ||
    root?.instanceId ||
    bodyRoot?.instance ||
    root?.instance ||
    data?.instanceId ||
    data?.instance ||
    '';

  const instanceName =
    bodyRoot?.instance ||
    root?.instance ||
    bodyRoot?.instanceName ||
    root?.instanceName ||
    '';

  const groupId =
    key?.remoteJid ||
    bodyRoot?.group_id ||
    root?.group_id ||
    root?.groupId ||
    '';

  const legenda =
    imageMessage?.caption ||
    message?.conversation ||
    bodyRoot?.caption ||
    bodyRoot?.text ||
    bodyRoot?.legenda ||
    root?.caption ||
    root?.text ||
    root?.legenda ||
    '';

  return {
    instanceId,
    instanceName,
    groupId,
    legenda,
    mediaUrl: pickMediaUrl(bodyRoot),
    mediaUrlRaw: imageMessage?.url || null,
    mediaDirectPath: imageMessage?.directPath || null,
    mediaMimetype: imageMessage?.mimetype || null,
    messageId: key?.id || '',
    senderId: key?.participant || null,
    senderIdAlt: key?.participantAlt || null,
    messageType: data?.messageType || null,
    messageTimestamp: data?.messageTimestamp || null
  };
}

function validateMinimum({ instanceId, groupId, legenda }) {
  const missing = [];
  if (!instanceId) missing.push('instance_id');
  if (!groupId) missing.push('group_id');
  if (!legenda) missing.push('legenda');
  return missing;
}

export function registerWebhookRoutes(app) {
  app.post('/webhook', async (request, reply) => {
    let correlationId = crypto.randomUUID();
    const payload = request.body || {};
    try {
      const {
        instanceId,
        instanceName,
        groupId,
        legenda,
        mediaUrl,
        mediaUrlRaw,
        mediaDirectPath,
        mediaMimetype,
        messageId,
        senderId,
        senderIdAlt,
        messageType,
        messageTimestamp
      } = extractFromEvolution(payload);

      const missing = validateMinimum({ instanceId, groupId, legenda });
      if (missing.length > 0) {
        request.log.warn({ missing }, 'webhook_payload_invalido');
        await logEvent({
          correlationId,
          evento: 'webhook_payload_invalido',
          nivel: 'warn',
          mensagem: 'Campos obrigatorios ausentes',
          payload: { missing }
        });
        return reply.code(422).send({
          ok: false,
          error: 'missing_required_fields',
          missing
        });
      }

      let parsedItems = parseOffersDeterministic(legenda);
      const hasValidDeterministic = parsedItems.some((i) => i.status);

      if (!hasValidDeterministic) {
        const geminiModel = process.env.GEMINI_MODEL;
        const openaiModel = process.env.OPENAI_MODEL;
        let llmParsed = (await parseWithGemini(legenda, geminiModel)) || null;
        if (!llmParsed || (Array.isArray(llmParsed) && llmParsed.length === 0) || (llmParsed && !llmParsed.status && !Array.isArray(llmParsed))) {
          llmParsed = (await parseWithOpenAI(legenda, openaiModel)) || llmParsed;
        }
        if (llmParsed) {
          parsedItems = Array.isArray(llmParsed) ? llmParsed : [llmParsed];
        }
      }

      const { marketplace, link: linkScrape } = detectMarketplaceFromText(legenda);
      const mensagemHash = stableHash({ instanceId, groupId, messageId, legenda, mediaUrl, linkScrape, payload });

      const insertSql = `
        insert into mensagens_recebidas
          (instance_id, instance_name, group_id, message_id, sender_id, sender_id_alt, message_type,
           legenda, marketplace, link_scrape, media_url, media_url_raw, media_direct_path, media_mimetype,
           message_timestamp, mensagem_hash, correlation_id, status)
        values
          ($1, $2, $3, $4, $5, $6, $7,
           $8, $9, $10, $11, $12, $13, $14,
           $15, $16, $17, 'recebida')
        on conflict (mensagem_hash) do nothing
        returning id
      `;

      const result = await query(insertSql, [
        instanceId,
        instanceName || null,
        groupId,
        messageId,
        senderId,
        senderIdAlt,
        messageType,
        legenda,
        marketplace,
        linkScrape,
        mediaUrl,
        mediaUrlRaw,
        mediaDirectPath,
        mediaMimetype,
        messageTimestamp,
        mensagemHash,
        correlationId
      ]);

      const inserted = result.rowCount > 0;
      const mensagemId = inserted ? result.rows[0]?.id : null;

      if (inserted) {
        const batchId = crypto.randomUUID();
        const multi = parsedItems.length > 1;
        let ordem = 1;

        const offerSql = `
          insert into ofertas_parseadas
            (mensagem_id, batch_id, multi_oferta, multi_ordem, marketplace, nome_produto, oferta_completa, cupons, valor_venda, link_scrape, status)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'parseada')
        `;

        for (const item of parsedItems) {
          const nome = item?.nome || null;
          const valor = typeof item?.valor === 'number' ? item.valor : null;
        const cupomArray = Array.isArray(item?.cupons) ? item.cupons : (item?.cupom ? [item.cupom] : []);
          const oferta = item?.oferta || null;
          const link = item?.link || linkScrape || null;

          await query(offerSql, [
            mensagemId,
            batchId,
            multi,
            ordem,
            marketplace,
            nome,
            oferta,
            cupomArray,
            valor,
            link
          ]);

          ordem += 1;
        }
      }

      request.log.info({
        instanceId,
        groupId,
        legenda,
        mediaUrl,
        marketplace,
        linkScrape,
        parsed: inserted ? 'ok' : 'skip',
        mensagemHash,
        correlationId,
        inserted
      }, 'mensagem_recebida');

      return reply.code(200).send({
        ok: true,
        correlation_id: correlationId,
        duplicate: !inserted
      });
    } catch (err) {
      request.log.error({ err }, 'webhook_error');
      await logEvent({
        correlationId,
        evento: 'webhook_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro no webhook',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'webhook_error', correlation_id: correlationId });
    }
  });

  app.get('/health', async () => ({ ok: true }));
}
