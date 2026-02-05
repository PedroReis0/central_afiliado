function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

function detectMarketplaceByHost(hostname) {
  if (!hostname) return 'unknown';
  const host = hostname.toLowerCase();

  if (host.includes('mercadolivre.com') || host.includes('mercadolibre.com')) {
    return 'mercadolivre';
  }
  if (host.includes('amazon.')) {
    return 'amazon';
  }
  if (host.includes('shopee.')) {
    return 'shopee';
  }
  if (host.includes('magazineluiza.com') || host.includes('magalu.')) {
    return 'magalu';
  }
  if (host.includes('aliexpress.')) {
    return 'aliexpress';
  }
  if (host.includes('kabum.')) {
    return 'kabum';
  }
  return 'unknown';
}

function extractFirstUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

export function detectMarketplaceFromText(text) {
  const url = extractFirstUrl(text);
  if (!url) {
    return { marketplace: 'unknown', link: null };
  }

  try {
    const u = new URL(url);
    const marketplace = detectMarketplaceByHost(u.hostname);
    return { marketplace, link: normalizeUrl(url) };
  } catch {
    return { marketplace: 'unknown', link: url };
  }
}
