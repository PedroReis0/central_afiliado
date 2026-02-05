import { query } from '../db.js';

const DEFAULT_BUCKET = 'produtos';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeBase64(raw) {
  if (!raw) return null;
  if (raw.includes(',')) {
    const parts = raw.split(',');
    return parts[parts.length - 1];
  }
  return raw;
}

function extensionFromMime(mimetype) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  return map[mimetype] || 'bin';
}

export async function fetchEvolutionBase64({ instanceName, messageId, convertToMp4 = false }) {
  if (!instanceName || !messageId) {
    return null;
  }

  const baseUrl = requiredEnv('EVOLUTION_API_URL').replace(/\/+$/, '');
  const apiKey = requiredEnv('EVOLUTION_API_KEY');

  const url = `${baseUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`;
  const body = {
    message: { key: { id: messageId } },
    convertToMp4: Boolean(convertToMp4)
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  const base64 =
    data?.base64 ||
    data?.data?.base64 ||
    data?.message?.base64 ||
    data?.media?.base64 ||
    null;
  const mimetype =
    data?.mimetype ||
    data?.data?.mimetype ||
    data?.media?.mimetype ||
    data?.type ||
    null;

  if (!base64) return null;

  return { base64, mimetype };
}

export async function uploadToSupabaseStorage({ bucket, path, base64, mimetype }) {
  const supabaseUrl = requiredEnv('SUPABASE_URL').replace(/\/+$/, '');
  const supabaseKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const targetBucket = bucket || DEFAULT_BUCKET;
  const cleanBase64 = normalizeBase64(base64);

  if (!cleanBase64 || !path) return null;

  const buffer = Buffer.from(cleanBase64, 'base64');
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(targetBucket)}/${path}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      'Content-Type': mimetype || 'application/octet-stream',
      'x-upsert': 'true'
    },
    body: buffer
  });

  if (!res.ok) {
    return null;
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(targetBucket)}/${path}`;
  return { publicUrl, storagePath: path };
}

export function buildProductPhotoPath(produtoId, mimetype) {
  const ext = extensionFromMime(mimetype);
  return `produtos/${produtoId}/principal.${ext}`;
}

export async function downloadAndStoreProductPhoto({ produtoId, mensagemId }) {
  if (!produtoId || !mensagemId) return null;

  const msgRes = await query(
    `select message_id, instance_name, media_mimetype
     from mensagens_recebidas
     where id = $1`,
    [mensagemId]
  );

  if (msgRes.rowCount === 0) return null;

  const { message_id: messageId, instance_name: instanceName, media_mimetype: mediaMimetype } = msgRes.rows[0];
  if (!messageId || !instanceName) return null;

  const media = await fetchEvolutionBase64({ instanceName, messageId, convertToMp4: false });
  if (!media?.base64) return null;

  const mimetype = media.mimetype || mediaMimetype || 'image/jpeg';
  const path = buildProductPhotoPath(produtoId, mimetype);
  const upload = await uploadToSupabaseStorage({ path, base64: media.base64, mimetype });
  if (!upload?.publicUrl) return null;

  await query(
    `update produtos
     set foto_url = $1, foto_storage_path = $2, foto_mimetype = $3, foto_downloaded_at = now()
     where produto_id = $4`,
    [upload.publicUrl, upload.storagePath, mimetype, produtoId]
  );

  return upload.publicUrl;
}
