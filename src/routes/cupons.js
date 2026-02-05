import crypto from 'crypto';
import { query } from '../db.js';
import { logEvent } from '../services/logs.js';

const TABLES = {
  aprovado: 'cupons_aprovados',
  bloqueado: 'cupons_bloqueados',
  pendente: 'cupons_pendentes'
};

function normalizeCode(code) {
  return (code || '').trim().toUpperCase();
}

export function registerCuponsRoutes(app) {
  app.get('/cupons', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const status = request.query?.status || 'aprovado';
      const table = TABLES[status];
      if (!table) {
        await logEvent({
          correlationId,
          evento: 'cupons_listar_invalido',
          nivel: 'warn',
          mensagem: 'status_invalido',
          payload: { status }
        });
        return reply.code(422).send({ ok: false, error: 'status_invalido' });
      }

      const res = await query(
        `select id, codigo, criado_em
         from ${table}
         order by criado_em desc`
      );
      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'cupons_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar cupons',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'cupons_listar_error', correlation_id: correlationId });
    }
  });

  app.post('/cupons/aprovar', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const codigo = normalizeCode(request.body?.codigo);
      if (!codigo) {
        await logEvent({
          correlationId,
          evento: 'cupons_aprovar_invalido',
          nivel: 'warn',
          mensagem: 'codigo_required'
        });
        return reply.code(422).send({ ok: false, error: 'codigo_required' });
      }

      await query(
        `insert into cupons_aprovados (codigo)
         values ($1)
         on conflict (codigo) do nothing`,
        [codigo]
      );
      await query(`delete from cupons_bloqueados where codigo = $1`, [codigo]);
      await query(`delete from cupons_pendentes where codigo = $1`, [codigo]);

      return reply.code(200).send({ ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'cupons_aprovar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao aprovar cupom',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'cupons_aprovar_error', correlation_id: correlationId });
    }
  });

  app.post('/cupons/bloquear', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const codigo = normalizeCode(request.body?.codigo);
      if (!codigo) {
        await logEvent({
          correlationId,
          evento: 'cupons_bloquear_invalido',
          nivel: 'warn',
          mensagem: 'codigo_required'
        });
        return reply.code(422).send({ ok: false, error: 'codigo_required' });
      }

      await query(
        `insert into cupons_bloqueados (codigo)
         values ($1)
         on conflict (codigo) do nothing`,
        [codigo]
      );
      await query(`delete from cupons_aprovados where codigo = $1`, [codigo]);
      await query(`delete from cupons_pendentes where codigo = $1`, [codigo]);

      return reply.code(200).send({ ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'cupons_bloquear_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao bloquear cupom',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'cupons_bloquear_error', correlation_id: correlationId });
    }
  });

  app.post('/cupons/pendente', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const codigo = normalizeCode(request.body?.codigo);
      if (!codigo) {
        await logEvent({
          correlationId,
          evento: 'cupons_pendente_invalido',
          nivel: 'warn',
          mensagem: 'codigo_required'
        });
        return reply.code(422).send({ ok: false, error: 'codigo_required' });
      }

      await query(
        `insert into cupons_pendentes (codigo)
         values ($1)
         on conflict (codigo) do nothing`,
        [codigo]
      );
      await query(`delete from cupons_aprovados where codigo = $1`, [codigo]);
      await query(`delete from cupons_bloqueados where codigo = $1`, [codigo]);

      return reply.code(200).send({ ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'cupons_pendente_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao marcar cupom pendente',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'cupons_pendente_error', correlation_id: correlationId });
    }
  });

  app.post('/cupons/remover', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const codigo = normalizeCode(request.body?.codigo);
      if (!codigo) {
        await logEvent({
          correlationId,
          evento: 'cupons_remover_invalido',
          nivel: 'warn',
          mensagem: 'codigo_required'
        });
        return reply.code(422).send({ ok: false, error: 'codigo_required' });
      }

      await query(`delete from cupons_aprovados where codigo = $1`, [codigo]);
      await query(`delete from cupons_bloqueados where codigo = $1`, [codigo]);
      await query(`delete from cupons_pendentes where codigo = $1`, [codigo]);

      return reply.code(200).send({ ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'cupons_remover_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao remover cupom',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'cupons_remover_error', correlation_id: correlationId });
    }
  });
}
