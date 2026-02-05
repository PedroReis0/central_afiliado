import crypto from 'crypto';
import { query } from '../db.js';
import { fetchInstances } from '../services/evolution.js';
import { logEvent } from '../services/logs.js';

function normalizeInstance(item) {
  const instanceId =
    item?.instanceId ||
    item?.instance_id ||
    item?.id ||
    item?.uuid ||
    item?.instance ||
    item?.name ||
    null;
  const instanceName =
    item?.instance ||
    item?.instanceName ||
    item?.name ||
    item?.instance_name ||
    null;
  const status =
    item?.status ||
    item?.connectionStatus ||
    item?.state ||
    'ativa';
  return { instanceId, instanceName, status };
}

export function registerInstanciasRoutes(app) {
  app.post('/instancias/sync', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const data = await fetchInstances();
      const list = Array.isArray(data) ? data : data?.instances || data?.data || [];
      const normalized = list
        .map(normalizeInstance)
        .filter((i) => i.instanceId);

      for (const item of normalized) {
        await query(
          `insert into instancias (instance_id, instance_name, status)
           values ($1, $2, $3)
           on conflict (instance_id)
           do update set instance_name = excluded.instance_name, status = excluded.status`,
          [item.instanceId, item.instanceName, item.status || 'ativa']
        );
      }

      return reply.code(200).send({ ok: true, total: normalized.length });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'instancias_sync_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao sincronizar instancias',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'instancias_sync_error', correlation_id: correlationId });
    }
  });

  app.get('/instancias', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const res = await query(
        `select id, instance_id, instance_name, status, criado_em
         from instancias
         order by criado_em desc`
      );
      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'instancias_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar instancias',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'instancias_listar_error', correlation_id: correlationId });
    }
  });
}
