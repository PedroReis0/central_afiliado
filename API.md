# API - Endpoints do Backend

## Webhook
### POST /webhook
Recebe mensagens da Evolution, normaliza dados, deduplica e grava em `mensagens_recebidas`. Em seguida faz o parse da mensagem e grava em `ofertas_parseadas` (suporta multi-oferta).

Body (exemplo): payload raw da Evolution (qualquer JSON).

Resposta (exemplo):
```json
{
  "ok": true,
  "correlation_id": "2882a93e-5a77-4fc6-9bd4-841dc973d16b",
  "duplicate": false
}
```

---

## Health
### GET /health
Verifica se o servidor esta no ar.

Resposta:
- ok: true

---

## Scraper Mercado Livre
### POST /scrape/mercadolivre
Busca o markdown via Jina, corta o bloco principal, valida e extrai dados essenciais.

Body (exemplo):
```json
{
  "link": "https://mercadolivre.com/sec/1puiKcr"
}
```

Resposta (exemplo):
```json
{
  "ok": true,
  "validacao": {
    "resultado": "aprovado",
    "motivo": null,
    "debug": {
      "catalog_id": "MLB18725403",
      "cta_catalog_id": "MLB18725403",
      "images_count": 1,
      "links_count": 2,
      "allowed_product_links_count": 2,
      "disallowed_links_count": 0,
      "disallowed_links": []
    }
  },
  "bloco_raw": "...",
  "bloco": "...",
  "dados": {
    "titulo": "Basic Whey 1kg Growth Supplements - Chocolate",
    "url_base": "https://www.mercadolivre.com.br/basic-whey-1kg-growth-supplements-chocolate/p/MLB18725403",
    "catalogo_id": "MLB18725403",
    "marketplace_product_id": "MLB18725403"
  }
}
```

---

## Scraper Mercado Livre (por oferta)
### POST /scrape/mercadolivre/oferta
Executa o scraper usando o `link_scrape` salvo na oferta e atualiza `ofertas_parseadas` com:
- nome_oficial
- link_limpo
- marketplace_product_id

Body (exemplo):
```json
{
  "oferta_id": "66666666-7777-8888-9999-000000000000"
}
```

Resposta (exemplo):
```json
{
  "ok": true,
  "validacao": { "resultado": "aprovado" },
  "dados": {
    "titulo": "Basic Whey 1kg Growth Supplements - Chocolate",
    "url_base": "https://www.mercadolivre.com.br/basic-whey-1kg-growth-supplements-chocolate/p/MLB18725403",
    "catalogo_id": "MLB18725403",
    "marketplace_product_id": "MLB18725403"
  }
}
```

---

## Catalogo (Busca por marketplace_product_id)
### POST /catalogo/marketplace/busca
Consulta `produto_marketplace` usando `marketplace_product_id` (ou `catalogo_id`).

Body (exemplo):
```json
{
  "marketplace_product_id": "MLB18725403",
  "marketplace": "mercadolivre"
}
```

Resposta (exemplo):
```json
{
  "ok": true,
  "found": true,
  "item": {
    "id": "b2c2c3f1-0d64-4c8a-9b2b-11a3e6d9f0d1",
    "produto_id": "a1b1a1a1-2222-3333-4444-555555555555",
    "marketplace": "mercadolivre",
    "marketplace_product_id": "MLB18725403",
    "link_limpo": "https://www.mercadolivre.com.br/basic-whey-1kg-growth-supplements-chocolate/p/MLB18725403",
    "link_afiliado": "https://www.mercadolivre.com.br/?aff=...",
    "ativo": true
  }
}
```

---

## Pipeline - Processar Oferta (sem re-scrape)
### POST /pipeline/oferta/processar
Usa os dados ja enriquecidos em `ofertas_parseadas`:
- marketplace_product_id
- link_limpo
- nome_oficial

Se `marketplace_product_id` estiver vazio, retorna `sem_marketplace_id`.

Body (exemplo):
```json
{
  "oferta_id": "66666666-7777-8888-9999-000000000000",
  "marketplace": "mercadolivre"
}
```

Resposta (exemplo - produto_ok):
```json
{
  "ok": true,
  "status": "produto_ok",
  "produto_marketplace_id": "b2c2c3f1-0d64-4c8a-9b2b-11a3e6d9f0d1",
  "produto_id": "a1b1a1a1-2222-3333-4444-555555555555"
}
```

Resposta (exemplo - produto_pendente):
```json
{
  "ok": true,
  "status": "produto_pendente",
  "fila_id": "f1f1f1f1-2222-3333-4444-555555555555",
  "produto_id_sugerido": "a1b1a1a1-2222-3333-4444-555555555555"
}
```

---

## Pipeline - Decisao de Produto
### POST /pipeline/produto/decisao
Fluxo:
1) Busca por `marketplace_product_id` em `produto_marketplace`.
2) Se nao encontrar, sugere produto principal por `nome_oficial`.
3) Enfileira em `fila_cadastro_produto` (sem criar produto automaticamente).

Body (exemplo):
```json
{
  "mensagem_id": "11111111-2222-3333-4444-555555555555",
  "oferta_id": "66666666-7777-8888-9999-000000000000",
  "marketplace": "mercadolivre",
  "marketplace_product_id": "MLB18725403",
  "nome_msg": "Basic Whey 1kg",
  "nome_oficial": "Basic Whey 1kg Growth Supplements - Chocolate",
  "link_limpo": "https://www.mercadolivre.com.br/basic-whey-1kg-growth-supplements-chocolate/p/MLB18725403",
  "media_url": "https://..."
}
```

Resposta (exemplo):
```json
{
  "ok": true,
  "status": "produto_pendente",
  "produto_id": null,
  "produto_id_sugerido": "a1b1a1a1-2222-3333-4444-555555555555"
}
```

---

## Produtos
### POST /produtos/criar
Cria produto principal (nome oficial) e reprocessa a fila, sugerindo este produto para itens pendentes com nome semelhante.

Body (exemplo):
```json
{
  "nome_oficial": "Basic Whey 1kg Growth Supplements - Chocolate",
  "nome_msg": "Basic Whey 1kg"
}
```

Resposta (exemplo):
```json
{
  "ok": true,
  "produto_id": "a1b1a1a1-2222-3333-4444-555555555555"
}
```

---

## Fila de Cadastro de Produto
### GET /fila/produto
Lista itens pendentes (ou outro status) da fila de cadastro.

Query (exemplo):
- status=pendente
- limit=50
- offset=0

Resposta (exemplo):
```json
{
  "ok": true,
  "items": [
    {
      "id": "f1f1f1f1-2222-3333-4444-555555555555",
      "mensagem_id": "11111111-2222-3333-4444-555555555555",
      "oferta_id": "66666666-7777-8888-9999-000000000000",
      "produto_id": null,
      "produto_id_sugerido": "a1b1a1a1-2222-3333-4444-555555555555",
      "marketplace": "mercadolivre",
      "marketplace_product_id": "MLB18725403",
      "link_limpo": "https://www.mercadolivre.com.br/basic-whey-1kg-growth-supplements-chocolate/p/MLB18725403",
      "nome_sugerido": "Basic Whey 1kg",
      "media_url": "https://...",
      "status": "pendente",
      "criado_em": "2026-02-05T12:00:00Z"
    }
  ],
  "limit": 50,
  "offset": 0
}
```

---

## Confirmar Cadastro (Marketplace)
### POST /fila/produto/confirmar
Confirma o cadastro do produto no marketplace. Exige produto principal definido.

Body (exemplo):
```json
{
  "fila_id": "f1f1f1f1-2222-3333-4444-555555555555",
  "produto_id": "a1b1a1a1-2222-3333-4444-555555555555",
  "marketplace": "mercadolivre",
  "marketplace_product_id": "MLB18725403",
  "link_limpo": "https://www.mercadolivre.com.br/basic-whey-1kg-growth-supplements-chocolate/p/MLB18725403",
  "link_afiliado": "https://www.mercadolivre.com.br/?aff=..."
}
```

Resposta (exemplo):
```json
{
  "ok": true,
  "produto_marketplace_id": "b2c2c3f1-0d64-4c8a-9b2b-11a3e6d9f0d1"
}
```

---

## Observacao
Todos os endpoints acima rodam no backend (VPS) e nao dependem de operador logado.
