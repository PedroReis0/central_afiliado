import crypto from 'crypto';
import { query } from '../db.js';
import { fetchAllGroups } from '../services/evolution.js';
import { logEvent } from '../services/logs.js';

function normalizeGroup(item) {
  const groupId =
    item?.id ||
    item?.groupId ||
    item?.jid ||
    item?.remoteJid ||
    null;
  const groupName =
    item?.subject ||
    item?.name ||
    item?.title ||
    null;
  return { groupId, groupName };
}

async function resolveInstance({ instanceId, instanceName }) {
  if (instanceId) {
    const res = await query(
      `select instance_id, instance_name
       from instancias
       where instance_id = $1
       limit 1`,
      [instanceId]
    );
    if (res.rowCount > 0) return res.rows[0];
  }

  if (instanceName) {
    const res = await query(
      `select instance_id, instance_name
       from instancias
       where instance_name = $1 or instance_id = $1
       limit 1`,
      [instanceName]
    );
    if (res.rowCount > 0) return res.rows[0];
  }

  return null;
}

export function registerGruposRoutes(app) {
  app.post('/grupos/sync', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { instance_id: instanceId, instance_name: instanceName } = request.body || {};
      if (!instanceId && !instanceName) {
        await logEvent({
          correlationId,
          evento: 'grupos_sync_invalido',
          nivel: 'warn',
          mensagem: 'instance_id_or_instance_name_required'
        });
        return reply.code(422).send({ ok: false, error: 'instance_id_or_instance_name_required' });
      }

      const instance = await resolveInstance({ instanceId, instanceName });
      if (!instance) {
        await logEvent({
          correlationId,
          evento: 'grupos_sync_instance_not_found',
          nivel: 'warn',
          mensagem: 'instance_not_found',
          payload: { instance_id: instanceId, instance_name: instanceName }
        });
        return reply.code(404).send({ ok: false, error: 'instance_not_found' });
      }

      const resolvedName = instance.instance_name || instance.instance_id;
      const data = await fetchAllGroups(resolvedName);
      const list = Array.isArray(data) ? data : data?.groups || data?.data || [];
      const normalized = list.map(normalizeGroup).filter((g) => g.groupId);

      for (const group of normalized) {
        await query(
          `insert into grupos (group_id, instance_id, group_name, ativo)
           values ($1, $2, $3, false)
           on conflict (group_id, instance_id)
           do update set group_name = excluded.group_name`,
          [group.groupId, instance.instance_id, group.groupName]
        );
      }

      return reply.code(200).send({ ok: true, total: normalized.length, instance_id: instance.instance_id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'grupos_sync_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao sincronizar grupos',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'grupos_sync_error', correlation_id: correlationId });
    }
  });

  app.post('/grupos/ativar', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { instance_id: instanceId, group_id: groupId, ativo = true } = request.body || {};
      if (!instanceId || !groupId) {
        await logEvent({
          correlationId,
          evento: 'grupos_ativar_invalido',
          nivel: 'warn',
          mensagem: 'instance_id_and_group_id_required'
        });
        return reply.code(422).send({ ok: false, error: 'instance_id_and_group_id_required' });
      }

      await query(
        `update grupos
         set ativo = $1
         where instance_id = $2 and group_id = $3`,
        [Boolean(ativo), instanceId, groupId]
      );

      return reply.code(200).send({ ok: true });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'grupos_ativar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao ativar grupo',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'grupos_ativar_error', correlation_id: correlationId });
    }
  });

  app.get('/grupos', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const ativo = request.query?.ativo;
      const instanceId = request.query?.instance_id;
      const conditions = [];
      const params = [];

      if (instanceId) {
        params.push(instanceId);
        conditions.push(`instance_id = $${params.length}`);
      }
      if (ativo !== undefined) {
        params.push(ativo === 'true');
        conditions.push(`ativo = $${params.length}`);
      }

      const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
      const res = await query(
        `select id, group_id, group_name, instance_id, ativo, criado_em
         from grupos
         ${where}
         order by criado_em desc`,
        params
      );

      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'grupos_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar grupos',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'grupos_listar_error', correlation_id: correlationId });
    }
  });
}
