import crypto from 'crypto';
import { query } from '../db.js';
import { detectMarketplaceFromText } from '../services/marketplace.js';
import { parseOffersDeterministic } from '../services/parser.js';
import { parseWithGemini, parseWithOpenAI } from '../services/llm.js';

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
  const data = root?.body?.data || root?.data || {};
  const key = data?.key || {};
  const message = data?.message || {};
  const imageMessage = message?.imageMessage || {};

  const instanceId =
    root?.body?.instanceId ||
    root?.instanceId ||
    root?.body?.instance ||
    root?.instance ||
    data?.instanceId ||
    data?.instance ||
    '';

  const groupId =
    key?.remoteJid ||
    root?.body?.group_id ||
    root?.group_id ||
    root?.groupId ||
    '';

  const legenda =
    imageMessage?.caption ||
    message?.conversation ||
    root?.body?.caption ||
    root?.body?.text ||
    root?.body?.legenda ||
    root?.caption ||
    root?.text ||
    root?.legenda ||
    '';

  return {
    instanceId,
    groupId,
    legenda,
    mediaUrl: pickMediaUrl(root?.body || root),
    messageId: key?.id || ''
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
    const payload = request.body || {};
    const { instanceId, groupId, legenda, mediaUrl, messageId } = extractFromEvolution(payload);

    const missing = validateMinimum({ instanceId, groupId, legenda });
    if (missing.length > 0) {
      request.log.warn({ missing }, 'webhook_payload_invalido');
      return reply.code(422).send({
        ok: false,
        error: 'missing_required_fields',
        missing
      });
    }

    const { marketplace, link: linkScrape } = detectMarketplaceFromText(legenda);

    const mensagemHash = stableHash({ instanceId, groupId, messageId, legenda, mediaUrl, linkScrape, payload });
    const correlationId = crypto.randomUUID();

    const insertSql = `
      insert into mensagens_recebidas
        (instance_id, group_id, message_id, legenda, marketplace, link_scrape, media_url, mensagem_hash, correlation_id, status)
      values
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'recebida')
      on conflict (mensagem_hash) do nothing
      returning id
    `;

    const result = await query(insertSql, [
      instanceId,
      groupId,
      messageId,
      legenda,
      marketplace,
      linkScrape,
      mediaUrl,
      mensagemHash,
      correlationId
    ]);

    const inserted = result.rowCount > 0;
    const mensagemId = inserted ? result.rows[0]?.id : null;

    if (inserted) {
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
        const cupomArray = item?.cupom ? [item.cupom] : [];
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
  });

  app.get('/health', async () => ({ ok: true }));
}
