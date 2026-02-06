# 📑 Documentação do Sistema: Central Afiliado

## 1. Visão Geral
A **Central Afiliado** é uma plataforma de controle operacional (Back-office) para administradores de grupos de ofertas. O sistema resolve o problema da fragmentação de links, permitindo que um único produto "mestre" possua múltiplos vínculos com diferentes marketplaces (Amazon, Shopee, Magalu, etc.), além de automatizar a formatação dessas ofertas via templates dinâmicos e monitorar a saúde das instâncias de disparo (WhatsApp via Evolution API).

---

## 2. Arquitetura de Software
*   **Frontend:** React 19 com TypeScript.
*   **Estilização:** Tailwind CSS (Design System focado em legibilidade e alta densidade de informação).
*   **Ícones:** Lucide-React.
*   **Gráficos:** Recharts (Análise de fluxo e histórico de preços).
*   **Estado:** Gerenciamento de estado via React Hooks (useState, useMemo, useEffect).

---

## 3. Módulos e Funcionalidades

### 3.1. Dashboard (Painel de Controle)
O centro analítico do sistema. Fornece uma visão macro da operação.
*   **KPIs em Tempo Real:** Total de ofertas enviadas, taxa de aproveitamento, produtos pendentes e consumo de tokens de IA.
*   **Gráfico de Fluxo:** Comparativo entre mensagens recebidas (fontes) e processadas/enviadas (saídas).
*   **Filtros Temporais:** Alternância entre hoje, ontem, 7 dias, mês atual ou períodos personalizados com calendário integrado.
*   **Monitor de Consumo:** Rastreio de custos operacionais baseados no processamento da IA.

### 3.2. Monitor de Processamento
A "caixa-preta" do sistema, essencial para Debug e auditoria.
*   **Logs de Mensagens:** Visualização em tempo real de cada mensagem processada, com dados de latência, instância de origem e grupo de destino.
*   **Status de Processamento:** Identificação visual para sucessos (`processed`), falhas (`failed`) ou mensagens descartadas (`ignored`).
*   **Histórico Completo:** Visualização expandida com paginação para auditoria de grandes volumes de dados.
*   **Log de Erros:** Painel crítico que destaca falhas de API, timeouts ou problemas de conexão.

### 3.3. Catálogo de Produtos (Gestão Mestre)
Diferencia-se de um e-commerce comum pela estrutura de vínculos múltiplos.
*   **Produto Mestre:** Cadastro central com Nome Oficial, Foto, Categoria e Subcategoria.
*   **Abas de Status:** Separação entre produtos "Ativos" e "Aguardando" (que precisam de revisão ou novos links).
*   **Filtros Avançados:** Busca refinada por Categoria, Subcategoria e Marketplace específico.
*   **Marketplace Manager (Vínculos):**
    *   Cada produto mestre pode ter N links de marketplaces.
    *   **Gestão de Links:** Armazenamento do "Link Limpo" (original) e do "Link Afiliado" (comissionado).
    *   **Analytics de Preço:** Gráfico interno por marketplace mostrando a flutuação de preço daquele SKU específico.
    *   **Rank de Preços:** Identifica automaticamente qual marketplace oferece a melhor oferta no momento para aquele produto.

### 3.4. Gestão de Cupons
Centralizador de códigos promocionais.
*   **Controle de Validade:** Rastreio de expiração.
*   **Status Dinâmico:** Aprovação de novos cupons, suspensão ou bloqueio de códigos expirados.
*   **Categorização:** Filtros por status para facilitar a manutenção de campanhas.

### 3.5. Templates de Mensagens
O motor de formatação das ofertas enviadas aos grupos.
*   **Editor de Tags:** Sistema de "Placeholder" onde o usuário insere tags dinâmicas como `{{nome_msg}}`, `{{oferta}}` e `{{link_afiliado}}`.
*   **Categorização de Templates:** Organização por tipo (Promoção, Urgência, Informativo).
*   **Status de Ativação:** Permite desativar templates sem excluí-los.

### 3.6. Integrações & Automação (Evolution API)
Configuração técnica da ponte entre o sistema e o WhatsApp.
*   **Instâncias:** Monitoramento de bateria, status de conexão e sincronização de instâncias da Evolution API.
*   **Grupos de Envio:** Whitelist de grupos de destino onde as ofertas formatadas serão postadas.
*   **Filtro de Entrada:** Configuração de "Whitelist de Entrada" para definir quais grupos a IA deve monitorar.

---

## 4. Fluxo de Operação Ideal
1.  **Captura:** O sistema detecta uma mensagem em um grupo monitorado.
2.  **Identificação:** A IA identifica o produto. Se o produto já existir no **Catálogo**, ela busca o link de afiliado correspondente.
3.  **Formatação:** O sistema aplica o **Template** ativo correspondente à categoria.
4.  **Disparo:** A mensagem formatada é enviada para os **Grupos de Envio** através da **Instância** conectada.
5.  **Monitoramento:** O administrador acompanha a latência e o sucesso do disparo no **Monitor**.

---

## 5. UI/UX e Princípios de Design
*   **Tema Claro (Light Mode):** Interface limpa e profissional focada em produtividade.
*   **Densidade de Dados:** Tabelas e cards compactos para visualização de grandes inventários.
*   **Feedback Visual:** Cores semânticas consistentes (Verde = Sucesso, Azul = Info/Primário, Âmbar = Pendente, Vermelho = Erro).
*   **Responsividade:** Sidebar colapsável e layouts adaptáveis para diferentes resoluções.