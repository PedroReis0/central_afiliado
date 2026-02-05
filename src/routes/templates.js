import crypto from 'crypto';
import { query } from '../db.js';
import { getRandomTemplate, renderTemplate } from '../services/templates.js';
import { logEvent } from '../services/logs.js';

export function registerTemplatesRoutes(app) {
  app.get('/templates', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const marketplace = request.query?.marketplace;
      const tipo = request.query?.tipo;
      const ativo = request.query?.ativo;
      const conditions = [];
      const params = [];

      if (marketplace) {
        params.push(marketplace);
        conditions.push(`marketplace = $${params.length}`);
      }
      if (tipo) {
        params.push(tipo);
        conditions.push(`tipo = $${params.length}`);
      }
      if (ativo !== undefined) {
        params.push(ativo === 'true');
        conditions.push(`ativo = $${params.length}`);
      }

      const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : '';
      const res = await query(
        `select id, marketplace, tipo, nome, body, ativo, criado_em
         from templates
         ${where}
         order by criado_em desc`,
        params
      );

      return reply.code(200).send({ ok: true, items: res.rows });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'templates_listar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao listar templates',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'templates_listar_error', correlation_id: correlationId });
    }
  });

  app.post('/templates', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { marketplace = 'mercadolivre', tipo = 'padrao', nome, body, ativo = true } = request.body || {};
      if (!nome || !body) {
        await logEvent({
          correlationId,
          evento: 'templates_criar_invalido',
          nivel: 'warn',
          mensagem: 'nome_and_body_required'
        });
        return reply.code(422).send({ ok: false, error: 'nome_and_body_required' });
      }

      const res = await query(
        `insert into templates (marketplace, tipo, nome, body, ativo)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [marketplace, tipo, nome, body, Boolean(ativo)]
      );

      return reply.code(200).send({ ok: true, id: res.rows[0].id });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'templates_criar_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao criar template',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'templates_criar_error', correlation_id: correlationId });
    }
  });

  app.post('/templates/render', async (request, reply) => {
    const correlationId = request.headers['x-correlation-id'] || crypto.randomUUID();
    try {
      const { marketplace = 'mercadolivre', tipo = 'padrao', nome_msg, oferta, link_afiliado } = request.body || {};

      const template = await getRandomTemplate({ marketplace, tipo });
      if (!template) {
        await logEvent({
          correlationId,
          evento: 'templates_render_sem_template',
          nivel: 'warn',
          mensagem: 'Nenhum template ativo encontrado',
          payload: { marketplace, tipo }
        });
        return reply.code(404).send({ ok: false, error: 'template_not_found' });
      }

      const texto = renderTemplate(template.body, { nome_msg, oferta, link_afiliado });
      return reply.code(200).send({
        ok: true,
        template_id: template.id,
        template_nome: template.nome,
        texto
      });
    } catch (err) {
      await logEvent({
        correlationId,
        evento: 'templates_render_error',
        nivel: 'error',
        mensagem: err?.message || 'Erro ao renderizar template',
        payload: { stack: err?.stack }
      });
      return reply.code(500).send({ ok: false, error: 'templates_render_error', correlation_id: correlationId });
    }
  });
}
