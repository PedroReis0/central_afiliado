import crypto from 'crypto';
import { downloadAndStoreProductPhoto } from '../services/media.js';
import { logEvent } from '../services/logs.js';

export function registerMediaRoutes(app) {
  app.post('/media/download', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    const { produto_id: produtoId, mensagem_id: mensagemId } = request.body || {};

    if (!produtoId || !mensagemId) {
      await logEvent({
        correlationId,
        evento: 'media_download_invalido',
        nivel: 'warn',
        mensagem: 'produto_id_and_mensagem_id_required'
      });
      return reply.code(422).send({ ok: false, error: 'produto_id_and_mensagem_id_required' });
    }

    try {
      const fotoUrl = await downloadAndStoreProductPhoto({ produtoId, mensagemId });
      if (!fotoUrl) {
        await logEvent({
          correlationId,
          evento: 'media_download_failed',
          nivel: 'error',
          mensagem: 'media_download_failed',
          payload: { produto_id: produtoId, mensagem_id: mensagemId }
        });
        return reply.code(500).send({ ok: false, error: 'media_download_failed', correlation_id: correlationId });
      }

      return reply.code(200).send({ ok: true, foto_url: fotoUrl });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'media_download_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro download media',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'media_download_error', correlation_id: correlationId });
    }
  });
}
