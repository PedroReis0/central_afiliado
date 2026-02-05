const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';

const BASE_PROMPT = `Extraia dados de UMA mensagem de WhatsApp e retorne APENAS um JSON válido (sem markdown, sem explicações).

Campos:
status (boolean)           // true = aprovado | false = reprovado
nome (string|null)
valor (number|null)
cupons (string[]|null)
oferta (string|null)
link (string|null)

Se houver multiplas ofertas na mesma mensagem, retorne um ARRAY JSON de objetos com esses mesmos campos, preservando a ordem original.

ENTRADA:
- A mensagem pode conter quebras de linha REAIS (enter), asteriscos *...* e itálico _..._.

NORMALIZAÇÃO (OBRIGATÓRIA):
- Remova SEMPRE o emoji "🦸🏻‍♂️" de todo o texto antes de extrair.
- Normalize espaços (múltiplos => 1) e remova espaços no início/fim das linhas.

REGRAS:
link:
- Pegue o primeiro URL que contenha "mercadolivre.com" (somente o URL). Se não houver, link=null.

nome:
- Ignore a linha de “chamada” (primeira linha curta com tom de headline/meme).
- nome = primeira linha não-vazia que pareça produto (título do item). Remova emojis/marcadores apenas no início.
- Se não houver produto (ex: lista de cupons), nome=null.

cupons:
- Preencher com TODOS os códigos digitáveis após "cupom"/"código"/"use o cupom"/"Cupom:".
- Código: 4-20 chars [A-Z0-9_-], normalize para MAIÚSCULO.
- Se a linha tiver "Cupom: CODE1 ou CODE2", salve ambos se forem códigos válidos.
- Se for "R$ X OFF", "% OFF", "cupom no anúncio/já aplicado/ative abaixo do produto", então cupons=null.

valor:
- Preço final (novo). Priorize "De X por Y" => Y, ou "Por R$ Y"/"por R$ Y".
- Ignore OFF/%OFF, parcelas, frete.
- Se houver múltiplos valores finais, priorize o valor associado a "Pix"; senão o menor.
- Retorne number.

oferta:
- Junte SOMENTE linhas úteis de preço/pagamento e linhas sobre cupons.
- NÃO inclua chamada nem link.
- REGRA FORTE: se valor != null e existir uma linha de preço que gerou esse valor, essa linha DEVE estar em oferta (a menos que seja OFF/%OFF).
- IMPORTANTE: ao unir múltiplas linhas em "oferta", use o separador "\\n" (escape dentro da string JSON), não quebras reais.
- Se realmente não existir nenhuma linha útil, oferta=null.

STATUS (BOOLEANO):
- status=true se: link != null E nome != null E (valor != null OU oferta != null).
- Caso contrário status=false.

Não invente dados. Se incerto, use null e status=false.
Retorne APENAS um JSON válido.`;

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractTextFromGeminiResponse(response) {
  const text = response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return text.trim();
}

function extractTextFromOpenAIResponse(response) {
  if (response?.output_text) return response.output_text.trim();
  const output = response?.output || [];
  for (const item of output) {
    const content = item?.content || [];
    for (const c of content) {
      if (c?.type === 'output_text' && c?.text) return c.text.trim();
      if (c?.text) return c.text.trim();
    }
  }
  return '';
}

export async function parseWithGemini(message, model) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !model) return null;

  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: BASE_PROMPT },
          { text: `\n\nMENSAGEM:\n${message}` }
        ]
      }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = extractTextFromGeminiResponse(data);
  return safeJsonParse(text);
}

export async function parseWithOpenAI(message, model) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !model) return null;

  const body = {
    model,
    input: `${BASE_PROMPT}\n\nMENSAGEM:\n${message}`
  };

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = extractTextFromOpenAIResponse(data);
  return safeJsonParse(text);
}

const MATCH_PROMPT = `Voce recebe um nome de produto e uma lista de produtos principais candidatos.
Responda APENAS com JSON valido (sem markdown, sem explicacoes):

Campos:
match (boolean) // true se algum candidato corresponde ao produto informado
produto_id (string|null) // o produto_id escolhido, ou null se nao houver

Regras:
- Considere que nomes de marketplace variam (cor, loja, palavras extras).
- Se nenhum candidato corresponder claramente, responda match=false e produto_id=null.
- Nao invente ids. Use apenas ids da lista de candidatos.
`;

async function matchWithGemini({ nomeOficial, candidatos, model }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !model) return null;

  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: MATCH_PROMPT },
          { text: `\n\nNOME_OFICIAL:\n${nomeOficial}` },
          { text: `\n\nCANDIDATOS:\n${JSON.stringify(candidatos)}` }
        ]
      }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = extractTextFromGeminiResponse(data);
  return safeJsonParse(text);
}

async function matchWithOpenAI({ nomeOficial, candidatos, model }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !model) return null;

  const body = {
    model,
    input: `${MATCH_PROMPT}\n\nNOME_OFICIAL:\n${nomeOficial}\n\nCANDIDATOS:\n${JSON.stringify(candidatos)}`
  };

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = extractTextFromOpenAIResponse(data);
  return safeJsonParse(text);
}

export async function matchProdutoPrincipal({ nomeOficial, candidatos }) {
  if (!nomeOficial || !Array.isArray(candidatos) || candidatos.length === 0) return null;

  const geminiModel = process.env.GEMINI_MODEL;
  const openaiModel = process.env.OPENAI_MODEL;

  let result = await matchWithGemini({ nomeOficial, candidatos, model: geminiModel });
  if (!result || typeof result.match !== 'boolean') {
    result = await matchWithOpenAI({ nomeOficial, candidatos, model: openaiModel });
  }

  if (!result || result.match !== true || !result.produto_id) return { match: false, produto_id: null };
  return { match: true, produto_id: result.produto_id };
}
