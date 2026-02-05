function normalizeLine(line) {
  return line.replace(/\s+/g, ' ').trim();
}

function removeHeroEmoji(text) {
  return text.replaceAll('🦸🏻‍♂️', '');
}

function toAscii(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function extractLines(text) {
  if (!text) return [];
  return removeHeroEmoji(text)
    .split(/\r?\n/)
    .map((l) => normalizeLine(l))
    .filter((l) => l.length > 0);
}

function stripLeadingMarkers(line) {
  return line.replace(/^[*_~>\-–•\s]+/, '').trim();
}

function stripTrailingMarkers(line) {
  return line.replace(/[*_~\s]+$/, '').trim();
}

function isPriceLine(line) {
  return /(\bde\b|\bpor\b|\br\$\b|\$)\s*\d/i.test(line);
}

function hasUrl(line) {
  return /https?:\/\//i.test(line);
}

function parsePriceToNumber(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractMercadoLivreLink(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s]*mercadolivre\.com[^\s]*/i);
  return match ? match[0] : null;
}

function isCouponNoise(line) {
  const l = toAscii(line.toLowerCase());
  return /(%\s*off|off\b|cupom no anuncio|ja aplicado|ative abaixo do produto)/i.test(l);
}

function extractCoupons(lines) {
  const found = new Set();
  for (const line of lines) {
    const l = toAscii(line.toLowerCase());
    if (!/(cupom|codigo|use o cupom)/i.test(l)) continue;
    if (isCouponNoise(line)) continue;
    if (/sem\s+cupom/i.test(l)) continue;
    const upper = line.toUpperCase();
    const matches = upper.match(/[A-Z0-9_-]{4,20}/g) || [];
    for (const code of matches) {
      if (code === 'CUPOM' || code === 'CODIGO') continue;
      found.add(code);
    }
  }
  return Array.from(found);
}

function pickTitle(lines) {
  if (lines.length === 0) return null;
  const first = lines[0];
  const isHeadline = first.length <= 40 && !isPriceLine(first) && !hasUrl(first) && !/cupom/i.test(first);
  const startIndex = isHeadline ? 1 : 0;
  for (let i = startIndex; i < lines.length; i += 1) {
    const l = stripTrailingMarkers(stripLeadingMarkers(lines[i]));
    if (!l) continue;
    if (hasUrl(l)) continue;
    if (/cupom/i.test(l)) continue;
    if (isPriceLine(l)) continue;
    return l;
  }
  return null;
}

function extractFinalPrice(lines) {
  const candidates = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (/%\s*off|off\b/.test(lower)) continue;
    if (/parcel|frete/.test(lower)) continue;

    const dePor = line.match(/de\s+([^\s]+)\s+por\s+([^\s]+)/i);
    if (dePor) {
      const val = parsePriceToNumber(dePor[2]);
      if (val !== null) {
        candidates.push({ value: val, line, pix: /pix/i.test(line) });
        continue;
      }
    }

    const por = line.match(/\bpor\b\s*(r\$)?\s*([\d.,]+)/i);
    if (por) {
      const val = parsePriceToNumber(por[2]);
      if (val !== null) {
        candidates.push({ value: val, line, pix: /pix/i.test(line) });
        continue;
      }
    }

    const price = line.match(/r\$\s*[\d.,]+/i);
    if (price && /pix/i.test(line)) {
      const val = parsePriceToNumber(price[0]);
      if (val !== null) candidates.push({ value: val, line, pix: true });
    }
  }

  if (candidates.length === 0) return { value: null, line: null };

  const pixCandidates = candidates.filter((c) => c.pix);
  const list = pixCandidates.length > 0 ? pixCandidates : candidates;
  list.sort((a, b) => a.value - b.value);
  return { value: list[0].value, line: list[0].line };
}

function buildOferta(lines, title, link, priceLine, couponLine) {
  const useful = [];
  for (const line of lines) {
    if (line === title) continue;
    if (line === link) continue;
    if (hasUrl(line)) continue;
    if (priceLine && line === priceLine) {
      useful.push(line);
      continue;
    }
    if (couponLine && line === couponLine) {
      useful.push(line);
      continue;
    }
    if (isPriceLine(line) || /cupom|codigo|use o cupom/i.test(toAscii(line))) {
      if (!isCouponNoise(line)) useful.push(line);
    }
  }
  if (useful.length === 0) return null;
  return useful.join('\\n');
}

function splitBlocks(text) {
  if (!text) return [];
  const cleaned = removeHeroEmoji(text).replace(/\r\n/g, '\n');
  const blocks = cleaned.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks.length > 0 ? blocks : [cleaned.trim()];
}

function parseSingleBlock(text, fallbackLink) {
  const lines = extractLines(text);
  const blockLink = extractMercadoLivreLink(text) || fallbackLink || null;
  const title = pickTitle(lines);
  const { value, line: priceLine } = extractFinalPrice(lines);
  const coupons = extractCoupons(lines);
  const couponLine = coupons.length > 0 ? lines.find((l) => coupons.some((c) => l.toUpperCase().includes(c))) : null;
  const oferta = buildOferta(lines, title, blockLink, priceLine, couponLine);

  const status = Boolean(blockLink && title && (value !== null || oferta));

  return {
    status,
    nome: title,
    valor: value,
    cupons: coupons,
    oferta,
    link: blockLink
  };
}

export function parseOffersDeterministic(text) {
  const globalLink = extractMercadoLivreLink(text);
  const blocks = splitBlocks(text);
  const items = blocks.map((b) => parseSingleBlock(b, globalLink));

  if (!items.some((i) => i.status)) {
    return [parseSingleBlock(text, globalLink)];
  }

  const valid = items.filter((i) => i.status);
  return valid.length > 0 ? valid : items;
}
