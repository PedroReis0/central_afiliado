# 🗺️ Mapa de Conectividade: Frontend -> Backend

Este documento serve como a ponte técnica para conectar o sistema **Central Afiliado** aos fluxos já existentes no seu backend.

---

## 1. Mapeamento de Telas e Endpoints

### 1.1. Dashboard (`Dashboard.tsx`)
*   **Ação:** Carregamento inicial e troca de filtros temporais.
*   **Conexão:** `GET /api/v1/stats?range={today|7days|month|custom}&start={date}&end={date}`
*   **Dados Esperados:** Objeto contendo os totais (ofertas, aproveitamento, produtos, tokens) e o array de séries temporais para os gráficos de fluxo e consumo.

### 1.2. Monitor de Processamento (`Monitor.tsx`)
*   **Ação:** Visualização em tempo real e histórico de logs.
*   **Conexão:** `GET /api/v1/logs?page={n}&limit=10`
*   **Fluxo Backend:** Deve ler da sua tabela de histórico de mensagens processadas pela IA e Evolution API.
*   **Status de Sistema:** O indicador "Sistema Online" deve ser atrelado a um endpoint de healthcheck `GET /api/v1/health`.

### 1.3. Catálogo de Produtos (`ProductCatalog.tsx`)
*   **Ação:** Listagem, Busca e Filtros Avançados.
*   **Conexão:** `GET /api/v1/products?search={q}&category={id}&status={active|pending}`
*   **Fluxo de Edição:** `PATCH /api/v1/products/{id}` para atualizar dados mestre (nome, foto, categoria).
*   **Fluxo de Criação:** `POST /api/v1/products` para cadastrar o SKU principal.

### 1.4. Gestão de Vínculos (`MarketplaceManager.tsx`)
Este é o módulo mais complexo e requer conectividade precisa:
*   **Listagem de Links:** `GET /api/v1/products/{produto_id}/links`
*   **Adição de Link:** `POST /api/v1/links` (Deve validar se o link já é um link de afiliado ou se precisa ser convertido).
*   **Histórico de Preços:** `GET /api/v1/links/{id}/prices` para alimentar o componente `PriceChart`.
*   **Remoção:** `DELETE /api/v1/links/{id}`.

### 1.5. Automação (`Integrations.tsx`)
*   **Instâncias:** `GET /api/v1/evolution/instances` (Proxy para a Evolution API para mostrar bateria e status).
*   **Sincronização:** `POST /api/v1/evolution/sync` para forçar a atualização dos nomes dos grupos.
*   **Whitelists:** `PATCH /api/v1/groups/{id}/toggle` para ativar/desativar o monitoramento de entrada ou saída.

---

## 2. Fluxo de Dados: Processamento de Oferta

Quando uma mensagem chega no seu Backend via Webhook da Evolution API:

1.  **Origem:** Backend verifica se o `remoteJid` está na sua `whitelist_entrada`.
2.  **IA:** Envia para o Gemini para extrair SKU e Preço.
3.  **Frontend Sync:** O Backend deve salvar o log. Se o administrador estiver na tela **Monitor**, ele verá o novo registro (via Polling ou WebSocket).
4.  **Match:** O Backend busca no Catálogo de Produtos o SKU identificado.
5.  **Envio:** Se houver match e o produto estiver ativo, dispara o link de afiliado usando o template correspondente.

---

## 3. Estrutura de Resposta Padrão (Sugestão)

Para que o Frontend funcione sem ajustes de tipagem, o Backend deve retornar:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "current_page": 1,
    "total_pages": 10
  }
}
```

---

## 4. Requisitos para o Marketplace Manager (Dashboard Interno)
O componente `MarketplaceManager` espera um array de histórico de preços para gerar os gráficos. Certifique-se de que o backend armazene:
- `valor_centavos` (Integer para evitar erros de ponto flutuante).
- `data_captura` (Timestamp).

---

## 5. Dicas de Integração
- **Headers:** Certifique-se de configurar CORS no seu backend para permitir a origem do frontend.
- **Tokens:** O componente `Login.tsx` espera que o backend retorne um token JWT e os dados básicos do usuário admin.
- **Imagens:** O frontend faz upload/referência via URL. Se o backend processar imagens, deve retornar o link público acessível.