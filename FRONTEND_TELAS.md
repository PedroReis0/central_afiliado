# Frontend - Descrição de Telas e Fluxos

Este documento descreve as telas do sistema **Central Afiliado**, seus objetivos e os principais componentes/funcionalidades esperados.

## Observacao importante
- Todo o processamento (pipeline, validacoes, regras de negocio, cadastro automatico, processamento de imagens, validacao de cupons e envio de mensagens) ocorre no **backend**.
- O frontend tem papel de **visualizar dados, acionar endpoints e permitir cadastros manuais**. Ele nao executa regras de negocio.

## 1. Login
- Objetivo: autenticar o usuário com Supabase.
- Componentes:
  - Logo/brand da Central Afiliado.
  - Campos: `email`, `senha`.
  - Botão: `Entrar`.
  - Mensagem de erro em caso de credencial inválida.
  - Informações de apoio (texto lateral com benefícios).
- Regras:
  - Ao autenticar com sucesso, redireciona para `Dashboard`.
  - Sessão persistida via Supabase.
  - Se Supabase não estiver configurado, exibir erro “Supabase não configurado”.

## 2. Dashboard
- Objetivo: visão geral do desempenho.
- Componentes:
  - Cards principais:
    - Ofertas recebidas
    - Ofertas enviadas
    - Aproveitamento
    - Pend. marketplace
    - Pend. produto principal
    - Cupons pendentes
    - Tokens IA
  - Gráficos em linha:
    - Ofertas recebidas (linha por dia)
    - Ofertas enviadas (linha por dia)
    - Consumo de tokens IA (linha por dia)
  - Filtros de período:
    - Últimos 7 dias
    - Este mês
    - Último mês
    - Personalizado (data início/fim)
- Regras:
  - Filtro de período afeta cards e gráficos.
  - Botão “Atualizar” recarrega dados.
  - Modo claro/escuro disponível no topo.

## 3. Monitor
- Objetivo: acompanhar o fluxo e erros.
- Componentes:
  - Tabela “Últimas mensagens”
    - Recebido, Instância, Grupo, Status, Envio, Latência (s), Último evento.
  - Tabela “Erros recentes”
    - Data, Evento, Mensagem.
- Regras:
  - Mostra últimas mensagens processadas (com status do pipeline).
  - Erros exibem evento + mensagem para diagnóstico rápido.

## 4. Produtos (submenu)
O menu **Produtos** possui 2 sub-telas:

### 4.1 Catálogo (Produtos Principais)
- Objetivo: gestão de produtos principais.
- Estrutura:
  - Header com ícone, título e subtítulo.
  - Campo de busca.
  - Botão `+ Novo Produto`.
  - Abas:
    - Produtos Ativos
    - Aguardando Cadastro
  - Filtros em linha:
    - Categoria
    - Subcategoria
    - Marketplace
- Cards (layout do modelo):
  - Imagem do produto
  - Badge `Ativo/Pendente`
  - Tag `Produto Principal`
  - Nome oficial
  - Nome curto (nome_msg)
  - Ações: `Ofertas`, `Editar`
- Modais:
  - Novo produto principal:
    - Nome oficial (obrigatório)
    - Nome mensagem (opcional)
  - Editar produto:
    - Foto (URL)
    - Status (ativo/pendente)
    - Nome curto (interno)
    - Nome oficial
    - Categoria/Subcategoria (quando houver)
    - Mensagem promocional (opcional)
- Regras:
  - Aba “Produtos Ativos” mostra somente ativos.
  - Aba “Aguardando Cadastro” mostra pendentes.
  - Filtros devem responder dinamicamente (subcategoria depende da categoria).

### 4.2 Produtos (Marketplace)
- Objetivo: gestão de produtos por marketplace.
- Estrutura:
  - Header com título e subtítulo.
  - Abas:
    - Produtos cadastrados
    - Aguardando Cadastro
  - Botão `Fila de cadastro` (para alternar)
  - Botão `+ Novo Produto`
  - Lista/tabela com:
    - Produto
    - ID
    - Status
    - Afiliado
    - Ações
- Modal de edição:
  - Link afiliado
  - Status ativo/inativo
- Fila de cadastro:
  - Lista produtos pendentes vindos do pipeline.
  - Ação “Confirmar” para vincular `produto_id` e adicionar `link_afiliado`.
- Regras:
  - Só permite salvar produto marketplace se o produto principal existir.
  - Produtos pendentes aparecem até confirmação.

## 5. Cupons
- Objetivo: visão e gestão de cupons.
- Esperado:
  - Abas ou filtros: Aprovados, Pendentes, Bloqueados.
  - Lista com código, data, status.
  - Ações rápidas: Aprovar, Bloquear, Remover (conforme status).

## 6. Templates
- Objetivo: gerenciar modelos de mensagem.
- Esperado:
  - Lista de templates ativos/inativos.
  - Botão “Novo template”.
  - Campos obrigatórios: `{{nome_msg}}`, `{{oferta}}`, `{{link_afiliado}}`.
- Regras:
  - Sempre usar modelo do tipo “padrão” (por enquanto).
  - Ao enviar oferta, escolher aleatoriamente entre os templates ativos.

## 7. Instâncias
- Objetivo: listar e sincronizar instâncias da Evolution.
- Esperado:
  - Lista com instâncias disponíveis.
  - Botão para sincronizar.
- Regras:
  - Exibir status da instância (conectada/desconectada quando disponível).

## 8. Grupos
- Objetivo: ativar grupos para envio automático.
- Esperado:
  - Lista de grupos (buscado da Evolution).
  - Toggle para ativar/desativar.
  - Selecionar instância responsável pelo envio.
- Regras:
  - Ao enviar oferta, enviar para todos os grupos ativos.
  - Cada grupo ativo tem uma instância vinculada.

## 9. Grupos de Recebimento (filtro de entrada)
- Objetivo: controlar quais `@g.us` são aceitos para processamento.
- Componentes:
  - Botão “Sincronizar da Evolution”.
  - Lista de grupos encontrados.
  - Toggle “Permitir recebimento”.
  - Campo opcional de observação.
- Regras:
  - Se o grupo não estiver permitido, o webhook registra mas não processa.
  - Esta lista é independente da lista de grupos de envio.

## Layout e Diretrizes Visuais
- Layout inspirado no modelo “Gestor de Produtos”.
- Tema claro/escuro.
- Botão principal escuro.
- Cards com imagem, tag e badges.
- Interface simples e objetiva.

## Alteracoes recentes
- Login com Supabase: fluxo de autenticacao por e-mail e senha.
- Grupos de recebimento (filtro de entrada): criar tela especifica para permitir quais `@g.us` podem entrar no pipeline.
- Grupos de envio permanecem separados: usados somente para despacho de ofertas.
