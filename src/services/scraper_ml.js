function normalizeUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  u = u.replace(/[)\],.]+$/g, '');
  u = u.replace(/^["']|["']$/g, '');
  if (/^www\./i.test(u)) u = `https://${u}`;
  return u;
}

function toAscii(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseUrlParts(raw) {
  const s = normalizeUrl(raw);
  if (!s) return null;
  const m = s.match(/^https?:\/\/([^\/?#]+)(\/[^?#]*)?/i);
  if (!m) return null;
  return {
    url: s,
    host: (m[1] || '').toLowerCase(),
    path: m[2] || '/'
  };
}

function isMercadoLivreHost(host) {
  if (!host) return false;
  const h = host.toLowerCase();
  return (
    h === 'mercadolivre.com' ||
    h.endsWith('.mercadolivre.com') ||
    h === 'mercadolivre.com.br' ||
    h.endsWith('.mercadolivre.com.br')
  );
}

function extractCatalogFromPath(path) {
  if (!path) return null;
  let m = path.match(/\/(MLB)-(\d{6,})/i);
  if (m) return `${m[1]}${m[2]}`.toUpperCase();

  m = path.match(/\/(MLB\d{6,})/i);
  if (m) return m[1].toUpperCase();

  m = path.match(/\/p\/(MLB\d+)/i);
  if (m) return m[1].toUpperCase();

  m = path.match(/\/up\/(MLBU\d+)/i);
  if (m) return m[1].toUpperCase();

  return null;
}

function findCtaUrl(md) {
  const re = /\[Ir para produto\]\(\s*([^) \n]+)\s*\)/i;
  const m = md.match(re);
  return m ? normalizeUrl(m[1]) : null;
}

function extractUrlsFromMarkdown(md) {
  const images = [];
  const links = [];

  const imgRe = /!\[[^\]]*\]\(\s*([^) \n]+)\s*\)/gi;
  let m;
  while ((m = imgRe.exec(md)) !== null) {
    const u = normalizeUrl(m[1]);
    if (u) images.push(u);
  }

  const linkRe = /\[[^\]]+\]\(\s*([^) \n]+)\s*\)/gi;
  while ((m = linkRe.exec(md)) !== null) {
    const startIndex = m.index;
    const prevChar = md[startIndex - 1];
    if (prevChar === '!') continue;
    const u = normalizeUrl(m[1]);
    if (u) links.push(u);
  }

  return {
    images: Array.from(new Set(images)),
    links: Array.from(new Set(links))
  };
}

function isListOrProfileContent(text) {
  const t = toAscii(text).toLowerCase();
  const patterns = [
    'perfil social',
    'minhas listas',
    'minhas recomendacoes',
    'ir para a lista',
    '/social/minutoreview/lists',
    'compartilhar'
  ];
  return patterns.some((p) => t.includes(p));
}

function sanitizeBloco(raw) {
  let t = String(raw || '').replace(/\r\n/g, '\n');
  t = t.replace(/!\[([^\]]*)\]\(\s*([^)]+?)\s*\)/g, '![$1]');
  t = t.replace(/\[([^\]]+)\]\(\s*(https?:\/\/[^\)\s]+)\s*\)/gi, (full, text) => {
    const isCta = /^\s*Ir\s+para\s+produto\s*$/i.test(String(text || ''));
    return isCta ? full : `[${text}]`;
  });
  return t;
}

export function cutPrimaryBlock(fullText) {
  if (!fullText) return null;
  const ANCORA_BOTAO = '[Ir para produto]';
  let blocoFinal = null;

  const indiceAncora = fullText.indexOf(ANCORA_BOTAO);
  if (indiceAncora !== -1) {
    const indiceFim = fullText.indexOf(')', indiceAncora) + 1;
    const inicioJanelaSegura = Math.max(0, indiceAncora - 2000);
    const textoParaTras = fullText.substring(inicioJanelaSegura, indiceAncora);
    const ultimoIndiceImagemRelativo = textoParaTras.lastIndexOf('![Image');

    if (ultimoIndiceImagemRelativo !== -1 && indiceFim > indiceAncora) {
      const indiceInicio = inicioJanelaSegura + ultimoIndiceImagemRelativo;
      blocoFinal = fullText.substring(indiceInicio, indiceFim).trim();
    }
  }

  if (!blocoFinal) {
    const partes = fullText.split(/!\[Image/);
    for (const parte of partes) {
      const blocoCandidato = `![Image${parte}`;
      if (
        blocoCandidato.includes('mercadolivre.com.br') &&
        blocoCandidato.includes('R$') &&
        (blocoCandidato.includes('MAIS VENDIDO') || blocoCandidato.length > 300)
      ) {
        const fimLinkFallback = blocoCandidato.indexOf(')') + 1;
        blocoFinal = fimLinkFallback > 1 ? blocoCandidato.substring(0, fimLinkFallback) : blocoCandidato;
        break;
      }
    }
  }

  return blocoFinal || null;
}

export function validateBlock(block) {
  const motivos = [];

  if (isListOrProfileContent(block)) motivos.push('pagina_lista_ou_perfil');

  const { images: imageUrls, links: linkUrls } = extractUrlsFromMarkdown(block);
  const hasImageTag = imageUrls.length > 0;
  if (!hasImageTag) motivos.push('sem_imagem_markdown');

  const hasMlStaticImg = imageUrls.some((u) => /mlstatic/i.test(u));
  if (!hasMlStaticImg) motivos.push('sem_imagem_mlstatic');

  const hasPrice = /R\$\s*\d{1,3}(?:\.\d{3})*(?:[.,]\d{2})?/i.test(block);
  if (!hasPrice) motivos.push('sem_preco');

  const ctaUrl = findCtaUrl(block);
  if (!ctaUrl) motivos.push('sem_cta_ir_para_produto');

  const allowedProductLinks = [];
  const disallowedLinks = [];
  for (const raw of linkUrls) {
    const parts = parseUrlParts(raw);
    if (!parts) {
      disallowedLinks.push({ url: normalizeUrl(raw) || raw, reason: 'url_invalida' });
      continue;
    }
    if (!isMercadoLivreHost(parts.host)) {
      disallowedLinks.push({ url: parts.url, reason: 'host_nao_ml' });
      continue;
    }
    const catalogId = extractCatalogFromPath(parts.path);
    if (catalogId) {
      allowedProductLinks.push({ url: parts.url, catalog_id: catalogId });
    } else {
      disallowedLinks.push({ url: parts.url, reason: 'sem_catalog_id_no_path' });
    }
  }

  if (disallowedLinks.length > 0) motivos.push('link_nao_permitido_no_bloco');

  const catalogIds = Array.from(new Set(allowedProductLinks.map((x) => x.catalog_id)));
  if (catalogIds.length === 0) motivos.push('sem_catalog_id_no_bloco');
  if (catalogIds.length > 1) motivos.push('mais_de_um_catalog_id_no_bloco');

  let ctaOk = false;
  let ctaCatalog = null;
  if (ctaUrl) {
    const ctaParts = parseUrlParts(ctaUrl);
    if (!ctaParts) {
      motivos.push('cta_url_invalida');
    } else {
      ctaCatalog = extractCatalogFromPath(ctaParts.path);
      if (!ctaCatalog) {
        motivos.push('cta_nao_aponta_para_catalogo');
      } else if (catalogIds.length === 1 && ctaCatalog !== catalogIds[0]) {
        motivos.push('cta_catalog_diferente_do_bloco');
      } else {
        ctaOk = true;
      }
    }
  }

  const aprovado =
    !isListOrProfileContent(block) &&
    hasImageTag &&
    hasMlStaticImg &&
    hasPrice &&
    Boolean(ctaUrl) &&
    ctaOk &&
    disallowedLinks.length === 0 &&
    catalogIds.length === 1;

  return {
    resultado: aprovado ? 'aprovado' : 'reprovado',
    motivo: aprovado ? null : motivos.join('|'),
    debug: {
      catalog_id: catalogIds[0] || null,
      cta_catalog_id: ctaCatalog || null,
      images_count: imageUrls.length,
      links_count: linkUrls.length,
      allowed_product_links_count: allowedProductLinks.length,
      disallowed_links_count: disallowedLinks.length,
      disallowed_links: disallowedLinks.slice(0, 10)
    }
  };
}

function decodeSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function extractUrlBase(url) {
  if (!url) return null;
  return String(url).split('#')[0].split('?')[0] || null;
}

function extractCatalogoIdFromUrl(url) {
  if (!url) return null;
  const base = extractUrlBase(url);
  const parts = parseUrlParts(base);
  if (!parts) return null;
  const path = parts.path;

  let m = path.match(/\/(MLB)-(\d{6,})/i);
  if (m) return `${m[1].toUpperCase()}-${m[2]}`;

  m = path.match(/\/p\/(MLB[A-Z0-9]+)\b/i);
  if (m) return m[1].toUpperCase();

  m = path.match(/\/up\/(MLBU\d+)\b/i);
  if (m) return m[1].toUpperCase();

  m = path.match(/\/(MLB\d{6,})\b/i);
  if (m) return m[1].toUpperCase();

  return null;
}

function normalizeCatalogoId(id) {
  return id ? String(id).replace('-', '') : null;
}

function extractItemId(urlFull, fallbackCatalogoId) {
  if (urlFull) {
    const m = String(urlFull).match(/[?&#]wid=(MLB\d+)/i);
    if (m) return m[1].toUpperCase();
  }

  const norm = normalizeCatalogoId(fallbackCatalogoId);
  if (norm && /^MLB\d+$/i.test(norm)) return norm.toUpperCase();
  return null;
}

function findCtaUrlFull(text) {
  const m = String(text || '').match(/\[Ir para produto\]\(\s*([^) \n]+)\s*\)/i);
  return m ? decodeSafe(m[1]) : null;
}

function extractTituloEUrlDoCard(rawText) {
  const s = String(rawText || '');
  const linkRe = /\[([^\]]+)\]\(\s*(https?:\/\/[^\)\s]+)\s*\)/gi;
  let m;
  while ((m = linkRe.exec(s)) !== null) {
    const txt = (m[1] || '').trim();
    const url = decodeSafe(m[2]);
    if (/^Ir\s+para\s+produto$/i.test(txt)) continue;
    const prevChar = s[m.index - 1];
    if (prevChar === '!') continue;
    return { titulo: txt || null, url_card_full: url || null };
  }
  return { titulo: null, url_card_full: null };
}

function extractTituloFallback(sanitizedText) {
  const s = String(sanitizedText || '');
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    const before = s[m.index - 1];
    if (before === '!') continue;
    const t = (m[1] || '').trim();
    if (!t) continue;
    if (/^Ir\s+para\s+produto$/i.test(t)) continue;
    return t;
  }
  return null;
}

export function extractDataFromBlock(input) {
  const bloco = input?.bloco || '';
  const bloco_raw = input?.bloco_raw || bloco;

  let { titulo, url_card_full } = extractTituloEUrlDoCard(bloco_raw);
  if (!titulo) titulo = extractTituloFallback(bloco);

  const ctaUrl = findCtaUrlFull(bloco_raw) || findCtaUrlFull(bloco);
  if (!url_card_full) url_card_full = ctaUrl;

  const url_base = extractUrlBase(url_card_full);
  const catalogo_id = extractCatalogoIdFromUrl(url_base);

  return {
    titulo,
    url_base,
    catalogo_id,
    marketplace_product_id: catalogo_id
  };
}

export async function scrapeMercadoLivre(linkScrape) {
  const base = process.env.JINA_BASE || 'https://r.jina.ai/http://';
  const url = `${base}${linkScrape}`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`jina_failed:${res.status}`);
  }

  const fullText = await res.text();
  const bloco = cutPrimaryBlock(fullText);
  if (!bloco) {
    return { ok: false, error: 'bloco_nao_encontrado' };
  }

  const valid = validateBlock(bloco);
  const bloco_sanitizado = sanitizeBloco(bloco);
  const extraido = extractDataFromBlock({
    origem: 'produto_principal_dinamico',
    bloco_raw: bloco,
    bloco: bloco_sanitizado
  });

  return {
    ok: valid.resultado === 'aprovado',
    validacao: valid,
    bloco_raw: bloco,
    bloco: bloco_sanitizado,
    dados: extraido
  };
}
