import { query } from '../db.js';

export async function getRandomTemplate({ marketplace = 'mercadolivre', tipo = 'padrao' }) {
  const res = await query(
    `select id, nome, body
     from templates
     where marketplace = $1 and tipo = $2 and ativo = true`,
    [marketplace, tipo]
  );

  if (res.rowCount === 0) return null;
  const idx = Math.floor(Math.random() * res.rows.length);
  return res.rows[idx];
}

export function renderTemplate(body, data) {
  if (!body) return '';
  const map = {
    nome_msg: data?.nome_msg || '',
    oferta: data?.oferta || '',
    link_afiliado: data?.link_afiliado || ''
  };

  return body.replace(/\{\{\s*(nome_msg|oferta|link_afiliado)\s*\}\}/g, (_, key) => {
    return map[key] ?? '';
  }).trim();
}
