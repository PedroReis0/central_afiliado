import crypto from 'crypto';
import { query } from '../db.js';
import { logEvent } from '../services/logs.js';

function parseDateParam(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from, to };
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function registerDashboardRoutes(app) {
  app.get('/dashboard/summary', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const fromParam = parseDateParam(request.query?.from);
      const toParam = parseDateParam(request.query?.to);
      const { from, to } = fromParam && toParam ? { from: fromParam, to: toParam } : defaultRange();

      const fromIso = toIsoDate(from);
      const toIso = toIsoDate(to);

      const receivedRes = await query(
        `select count(*)::int as total
         from ofertas_parseadas
         where parsed_at >= $1::date
           and parsed_at < ($2::date + interval '1 day')`,
        [fromIso, toIso]
      );

      const sentRes = await query(
        `select count(*)::int as total
         from ofertas_enviadas
         where enviado_em >= $1::date
           and enviado_em < ($2::date + interval '1 day')`,
        [fromIso, toIso]
      );

      const pendenteMarketplaceRes = await query(
        `select count(*)::int as total
         from fila_cadastro_produto
         where status = 'pendente'`
      );

      const pendentePrincipalRes = await query(
        `select count(*)::int as total
         from produtos
         where ativo = false`
      );

      const cuponsPendentesRes = await query(
        `select count(*)::int as total
         from cupons_pendentes`
      );

      const tokensRes = await query(
        `select coalesce(sum(nullif((payload->>'tokens_total')::int, 0)), 0)::int as total
         from logs_eventos
         where evento = 'llm_usage'
           and criado_em >= $1::date
           and criado_em < ($2::date + interval '1 day')`,
        [fromIso, toIso]
      );

      const received = receivedRes.rows[0]?.total || 0;
      const sent = sentRes.rows[0]?.total || 0;
      const aproveitamento = received > 0 ? Number(((sent / received) * 100).toFixed(1)) : 0;

      return reply.code(200).send({
        ok: true,
        range: { from: fromIso, to: toIso },
        recebidas: received,
        enviadas: sent,
        aproveitamento,
        pendentes_marketplace: pendenteMarketplaceRes.rows[0]?.total || 0,
        pendentes_principal: pendentePrincipalRes.rows[0]?.total || 0,
        cupons_pendentes: cuponsPendentesRes.rows[0]?.total || 0,
        tokens_total: tokensRes.rows[0]?.total || 0
      });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'dashboard_summary_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro dashboard summary',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'dashboard_summary_error', correlation_id: correlationId });
    }
  });

  app.get('/dashboard/ofertas', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const fromParam = parseDateParam(request.query?.from);
      const toParam = parseDateParam(request.query?.to);
      const { from, to } = fromParam && toParam ? { from: fromParam, to: toParam } : defaultRange();

      const fromIso = toIsoDate(from);
      const toIso = toIsoDate(to);

      const res = await query(
        `
        with days as (
          select generate_series($1::date, $2::date, interval '1 day')::date as day
        ),
        recebidas as (
          select date_trunc('day', parsed_at)::date as day, count(*)::int as total
          from ofertas_parseadas
          where parsed_at >= $1::date
            and parsed_at < ($2::date + interval '1 day')
          group by 1
        ),
        enviadas as (
          select date_trunc('day', enviado_em)::date as day, count(*)::int as total
          from ofertas_enviadas
          where enviado_em >= $1::date
            and enviado_em < ($2::date + interval '1 day')
          group by 1
        )
        select d.day,
               coalesce(r.total, 0) as recebidas,
               coalesce(e.total, 0) as enviadas
        from days d
        left join recebidas r on r.day = d.day
        left join enviadas e on e.day = d.day
        order by d.day asc
        `,
        [fromIso, toIso]
      );

      return reply.code(200).send({ ok: true, range: { from: fromIso, to: toIso }, series: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'dashboard_ofertas_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro dashboard ofertas',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'dashboard_ofertas_error', correlation_id: correlationId });
    }
  });

  app.get('/dashboard/tokens', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const fromParam = parseDateParam(request.query?.from);
      const toParam = parseDateParam(request.query?.to);
      const { from, to } = fromParam && toParam ? { from: fromParam, to: toParam } : defaultRange();

      const fromIso = toIsoDate(from);
      const toIso = toIsoDate(to);

      const res = await query(
        `
        with days as (
          select generate_series($1::date, $2::date, interval '1 day')::date as day
        ),
        tokens as (
          select date_trunc('day', criado_em)::date as day,
                 sum(nullif((payload->>'tokens_total')::int, 0))::int as total
          from logs_eventos
          where evento = 'llm_usage'
            and criado_em >= $1::date
            and criado_em < ($2::date + interval '1 day')
          group by 1
        )
        select d.day,
               coalesce(t.total, 0) as tokens
        from days d
        left join tokens t on t.day = d.day
        order by d.day asc
        `,
        [fromIso, toIso]
      );

      return reply.code(200).send({ ok: true, range: { from: fromIso, to: toIso }, series: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'dashboard_tokens_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro dashboard tokens',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'dashboard_tokens_error', correlation_id: correlationId });
    }
  });
}
