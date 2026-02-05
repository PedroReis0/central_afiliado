function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function buildBaseUrl() {
  return requiredEnv('EVOLUTION_API_URL').replace(/\/+$/, '');
}

function buildHeaders() {
  const apiKey = requiredEnv('EVOLUTION_API_KEY');
  return {
    'Content-Type': 'application/json',
    apikey: apiKey
  };
}

export async function fetchInstances() {
  const url = `${buildBaseUrl()}/instance/fetchInstances`;
  const res = await fetch(url, { method: 'GET', headers: buildHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchAllGroups(instanceName) {
  if (!instanceName) return null;
  const url = `${buildBaseUrl()}/group/fetchAllGroups/${encodeURIComponent(instanceName)}?getParticipants=false`;
  const res = await fetch(url, { method: 'GET', headers: buildHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function sendText({ instanceName, remoteJid, text }) {
  if (!instanceName || !remoteJid || !text) return null;
  const url = `${buildBaseUrl()}/message/sendText/${encodeURIComponent(instanceName)}`;
  const body = { number: remoteJid, textMessage: { text } };
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) return null;
  return res.json();
}

export async function sendMedia({ instanceName, remoteJid, mediaUrl, mimetype, caption, fileName }) {
  if (!instanceName || !remoteJid || !mediaUrl) return null;
  const url = `${buildBaseUrl()}/message/sendMedia/${encodeURIComponent(instanceName)}`;
  const body = {
    number: remoteJid,
    mediaMessage: {
      mediatype: 'image',
      media: mediaUrl,
      mimetype: mimetype || 'image/jpeg',
      fileName: fileName || 'media.jpg',
      caption: caption || ''
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body)
  });
  if (!res.ok) return null;
  return res.json();
}
