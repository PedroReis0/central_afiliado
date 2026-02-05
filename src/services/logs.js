import { query } from '../db.js';

export async function logEvent({ correlationId, evento, nivel = 'info', mensagem = null, payload = null }) {
  if (!correlationId || !evento) return;
  await query(
    `insert into logs_eventos (correlation_id, evento, nivel, mensagem, payload)
     values ($1, $2, $3, $4, $5)`,
    [String(correlationId), evento, nivel, mensagem, payload ? JSON.stringify(payload) : null]
  );
}
