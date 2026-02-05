import crypto from 'crypto';
import { query } from '../db.js';
import { logEvent } from '../services/logs.js';

export function registerMonitorRoutes(app) {
  app.get('/monitor/flow', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const limit = Math.min(Number(request.query?.limit || 50), 200);

      const res = await query(
        `
        select
          mr.id as mensagem_id,
          mr.instance_id,
          mr.group_id,
          mr.received_at,
          mr.status as mensagem_status,
          op.id as oferta_id,
          op.status as oferta_status,
          oe.enviado_em,
          oe.status as envio_status,
          extract(epoch from (oe.enviado_em - mr.received_at))::int as latency_s,
          le.evento as ultimo_evento,
          le.nivel as ultimo_nivel,
          le.mensagem as ultimo_msg
        from mensagens_recebidas mr
        left join ofertas_parseadas op on op.mensagem_id = mr.id
        left join ofertas_enviadas oe on oe.oferta_id = op.id
        left join lateral (
          select evento, nivel, mensagem
          from logs_eventos
          where correlation_id = mr.correlation_id
          order by criado_em desc
          limit 1
        ) le on true
        order by mr.received_at desc
        limit $1
        `,
        [limit]
      );

      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'monitor_flow_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro monitor flow',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'monitor_flow_error', correlation_id: correlationId });
    }
  });

  app.get('/monitor/errors', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const limit = Math.min(Number(request.query?.limit || 50), 200);
      const res = await query(
        `
        select id, correlation_id, evento, nivel, mensagem, criado_em
        from logs_eventos
        where nivel = 'error'
        order by criado_em desc
        limit $1
        `,
        [limit]
      );
      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'monitor_errors_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro monitor errors',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'monitor_errors_error', correlation_id: correlationId });
    }
  });
}
