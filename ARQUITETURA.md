# Arquitetura e Microservicos - Fluxo Detalhado

Objetivo
Receber ofertas via webhook (Evolution), extrair dados, validar produto e cupom, enviar rapidamente para grupos de WhatsApp e manter historico auditavel. O sistema funciona 24x7 no backend, sem depender de usuarios logados.

Premissas Criticas
Oferta e relampago: prioridade total para tempo.
Link recebido na mensagem e apenas para scraping (Gina.ai). Nunca e link final.
Produto precisa estar cadastrado para ter link afiliado. Se nao, entra na fila e a oferta e descartada.
Cupom: aprovado libera envio; bloqueado ou pendente descarta; novo cria pendente.
Mensagem chega como legenda de imagem: a imagem deve ser baixada e salva.

Visao Geral do Fluxo
1. Webhook Evolution -> Receiver
2. Normalizacao, deduplicacao e persistencia da mensagem
3. Switch de marketplace
4. Parser LLM gera ofertas_parseadas (1..N)
5. Scraping opcional para enriquecimento (timeout curto)
6. Pipeline rapido decide enviar ou descartar
7. Template monta legenda final
8. Dispatcher envia para grupos
9. Historico registra envio e resultados

Microservicos (backend)
1. receiver-webhook
Responsabilidade: receber payload do webhook da Evolution, normalizar, deduplicar e registrar.
Entradas: payload raw, instance_id, group_id, legenda, midia.
Saidas: mensagem_recebida + evento de processamento.
Banco: mensagens_recebidas, logs_eventos.
Detalhes: calcular hash da mensagem, checar idempotencia e criar correlation_id.

2. media-worker
Responsabilidade: baixar imagem, salvar no storage e associar a mensagem.
Entradas: mensagem_recebida.
Saidas: media_url armazenada.
Banco: mensagens_recebidas, storage.
Detalhes: processamento assincrono com timeout e retry curto. A imagem e baixada apenas uma vez e reutilizada em todo o fluxo.

3. parser-llm
Responsabilidade: extrair campos do texto e gerar JSON estruturado.
Entradas: texto da legenda + marketplace.
Saidas: ofertas_parseadas (1..N) com batch_id.
Banco: ofertas_parseadas.
Detalhes: timeout curto, modelo principal + fallback, validacao de JSON.

4. marketplace-switch
Responsabilidade: identificar marketplace pelo link e canonizar.
Entradas: mensagem_normalizada.
Saidas: marketplace + link_scrape.
Detalhes: fallback para unknown, com descarte controlado.

5. scraper-mercadolivre
Responsabilidade: usar Gina.ai para markdown e JS extraction sem LLM (apenas fluxo ML).
Entradas: link_scrape.
Saidas: dados_enriquecidos opcionais.
Detalhes: nao bloqueia envio. Se falhar, segue sem enrich.

6. catalog-service
Responsabilidade: checar produto cadastrado e fornecer link afiliado.
Entradas: oferta_parseada.
Saidas: produto_ok ou fila_cadastro_produto.
Banco: produtos, fila_cadastro_produto.
Detalhes: chave de produto por marketplace + url_normalizada ou outro identificador. A imagem associada ao cadastro reutiliza a mesma midia salva no storage (nao refaz download).
Regra de busca por produto principal (nome_oficial):
- Primeiro busca candidatos semelhantes em produtos principais (ativos ou pendentes).
- Se houver match 100% identico, usar direto.
- Se nao houver match exato, enviar os 5 mais semelhantes + nome_oficial para a LLM decidir:
  - retorna o produto principal escolhido, ou
  - retorna "nenhum" se nao bater.
Regra de midia quando nao houver correspondencia:
- O download da midia so acontece quando um novo produto principal for cadastrado como pendente.
- Se a LLM retornar "nenhum" (ou seja, novo produto principal pendente), baixar a foto do WhatsApp usando a API da Evolution.
- Salvar a foto no balde (storage) e reutilizar:
  - como foto do produto no sistema,
  - e como midia padrao quando enviar a oferta.
Regra de foto por produto:
- Existe apenas 1 foto por produto principal.
- Cadastros de produto marketplace reutilizam a foto do produto principal.
Storage (Supabase):
- Bucket: produtos
- Caminho: produtos/{produto_id}/principal.jpg (ou .png conforme mimetype)
- A referencia da foto fica salva no produto principal (foto_url/foto_storage_path).
- Registrar a data de download da foto no produto principal (foto_downloaded_at).
Regras de Identificacao:
- produto_id universal: gerado no primeiro cadastro do produto e reutilizado entre marketplaces.
- marketplace_product_id: identificador do produto dentro de cada marketplace.
- Um produto pode ter varios cadastros no mesmo marketplace, cada um com seu proprio link de afiliado.
- Cada cadastro representa um anuncio especifico dentro do marketplace, com seu proprio link limpo e link de afiliado.
Fluxo de Cadastro:
- Primeira vez que o produto aparece: criar produto (id universal) + cadastro em produto_marketplace.
- Novas aparicoes (outro marketplace ou outro anuncio): criar apenas produto_marketplace e vincular ao produto_id existente.
Padrao Mercado Livre:
- marketplace_product_id recebe o catalogo_id extraido pelo scraping.
Sugestao de Vinculo:
- Ao criar item na fila de cadastro, buscar produtos existentes por nome semelhante.
- Preencher produto_id_sugerido na fila para facilitar a validacao pelo usuario.
- O usuario confirma o vinculo final no painel.
Nomes do Produto:
- nome_msg: nome vindo da mensagem (exibido no frontend).
- nome_oficial: nome padronizado da loja (usado para busca e similaridade).
Exemplo:
produto_id = 123 (Iphone)
cadastros:
marketplace=mercadolivre, marketplace_product_id=mlb123, link_afiliado=...
marketplace=amazon, marketplace_product_id=8181, link_afiliado=...
marketplace=shopee, marketplace_product_id=12344, link_afiliado=...
marketplace=mercadolivre, marketplace_product_id=998998, link_afiliado=...

7. coupon-service
Responsabilidade: validar cupons e criar pendentes.
Entradas: cupons da oferta.
Saidas: cupons_aprovados ou descarte.
Banco: cupons_aprovados, cupons_bloqueados, cupons_pendentes.
Detalhes: nao duplicar pendentes. Ignorar cupons nao aprovados no envio.

8. offer-pipeline
Responsabilidade: orquestrar decisao rapida vai ou nao vai.
Entradas: oferta_parseada + dados opcionais.
Saidas: pronta_envio ou descartada.
Banco: ofertas_parseadas, logs_eventos.
Detalhes: latencia em milissegundos, evita chamadas lentas.

9. template-service
Responsabilidade: preencher template com dados finais.
Entradas: produto, cupom, preco, imagem.
Saidas: mensagem_final.
Banco: templates.
Detalhes: condicoes para cupom e variacoes.

10. dispatcher
Responsabilidade: enviar midia + legenda via Evolution, com rate limit e retries.
Entradas: mensagem_final.
Saidas: status por grupo.
Banco: ofertas_enviadas.
Detalhes: circuit breaker por instancia e tentativas curtas.

11. history-service
Responsabilidade: registrar envio completo e auditoria.
Entradas: resultado do dispatcher.
Saidas: log final.
Banco: ofertas_enviadas, logs_eventos.

12. admin-ui-api
Responsabilidade: endpoints para telas administrativas.
Entradas: requisicoes do frontend.
Saidas: CRUD de produtos, cupons, templates, instancias, grupos.
Banco: todas as tabelas operacionais.

Fluxo Detalhado - Ingestao
1. Evolution envia webhook
2. receiver-webhook valida assinatura e schema
3. receiver normaliza campos
4. receiver calcula hash e verifica duplicidade
5. receiver grava mensagens_recebidas
6. receiver publica evento process_message

Fluxo Detalhado - Midia
1. media-worker recebe evento
2. baixa imagem com timeout
3. salva no storage
4. atualiza mensagens_recebidas.media_url
5. loga evento de sucesso ou falha
Observacao: imagem e baixada uma unica vez e reutilizada para cadastro e envio.

Regras de Download de Midia
- A midia so e baixada quando a oferta entrar na fila de cadastro de produto.
- Somente para o produto principal do lote (multi_oferta), para evitar peso.
- A mesma imagem e reutilizada para todos os marketplaces.
- Storage: Supabase Storage.

Fluxo Detalhado - Parser
1. parser-llm recebe texto + marketplace (se ainda nao resolvido, usar heuristica inicial)
2. marketplace-switch detecta marketplace e canoniza URL
3. parser retorna JSON estruturado
4. valida JSON e cria batch_id
5. salva ofertas_parseadas (1..N)
6. se JSON invalido, usa fallback
7. se falha definitiva, descarta com motivo

Fluxo Detalhado - Scraper (opcional, ML)
1. scraper-mercadolivre recebe link_scrape
2. Gina.ai gera markdown
3. JS extraction corta bloco e extrai campos
4. salva dados_enriquecidos
5. se timeout, ignora e segue

Fluxo Detalhado - Pipeline Rapido
1. offer-pipeline recebe oferta_parseada
2. consulta catalogo de produtos
3. se produto nao cadastrado, cria fila e descarta oferta
4. valida cupons
5. se cupom bloqueado ou pendente, descarta oferta
6. se cupom novo, cria pendente e descarta
7. se cupom aprovado, segue
8. se sem cupom, segue
9. monta payload final para template

Fluxo Detalhado - Template e Envio
1. template-service gera legenda
2. dispatcher resolve grupos ativos da instancia
3. dispatcher envia midia + legenda
4. registra status por grupo
5. history-service grava log final

Fluxo Detalhado - Descartes
Produto nao cadastrado: criar fila de cadastro e descartar oferta
Cupom bloqueado: descartar
Cupom pendente: descartar
Cupom novo: criar pendente e descartar
Sem cupom aprovado: descartar

Estados da Fila de Ofertas
recebida
parseada
produto_ok ou produto_pendente
cupom_ok ou cupom_pendente ou cupom_bloqueado
pronta_envio
enviada
descartada

Contratos Minimos (exemplo)
Mensagem Normalizada
id, instance_id, group_id, legenda, midia_url, received_at, hash

Oferta Parseada
id, batch_id, multi_oferta, multi_ordem, marketplace, nome_produto, oferta_completa, cupons[], valor_venda, link_scrape

Decisao
status, motivo, cupom_usado[], link_afiliado_final

Template Final
texto, media_url, grupos[], instance_id

Regras de Cupom
Sem cupom: enviar.
Com cupom: usar apenas aprovados. Se houver bloqueado ou pendente, descartar.
Cupom novo: criar pendente.
Se nenhum aprovado: descartar.

Regras de Produto
Produto nao cadastrado: criar fila e descartar a oferta.
Produto cadastrado: usar link afiliado final.

Banco de Dados (minimo)
mensagens_recebidas
ofertas_parseadas
produtos
produto_marketplace
fila_cadastro_produto
cupons_aprovados
cupons_bloqueados
cupons_pendentes
instancias
grupos
templates
ofertas_enviadas
logs_eventos

Infraestrutura e Deploy
Ambiente: VPS com Docker Swarm gerenciado por Portainer.
Tudo roda no backend 24x7. O sistema funciona mesmo sem usuarios logados.
Servicos sugeridos no Swarm
api-gateway (opcional)
receiver-webhook
media-worker
parser-llm
scraper
offer-pipeline
dispatcher
admin-ui

Supabase
Usar Postgres do Supabase como banco principal.
Usar Supabase Storage para midia.
Usar Supabase Auth para logins do painel admin.

Fluxo de Autenticacao (Admin UI)
1. Usuario acessa o painel admin.
2. React chama Supabase Auth (login por email/senha ou provider configurado).
3. Supabase retorna access_token e refresh_token.
4. Frontend armazena tokens de forma segura (session) e inclui access_token nas chamadas da API.
5. Backend valida o JWT do Supabase em cada requisicao protegida.
6. Roles/permissions podem ser derivados de claims do JWT ou tabela de perfis no Postgres.
7. Refresh token renova a sessao automaticamente.

Redis
Nao obrigatorio no inicio.
Recomendado quando houver alto volume, necessidade de retries e rate limit mais agressivo.
Pode ser adicionado depois sem refatorar o dominio.

Observabilidade
Logs por etapa com correlation_id.
Metricas: tempo ate envio, taxa de descarte, erros por instancia.

Dashboard (Admin UI)
Tela com filtros por periodo (data_inicio, data_fim) e opcionalmente por marketplace.
Metricas principais:
- Ofertas recebidas por marketplace
- Ofertas enviadas por marketplace
- Mensagens recebidas: aproveitadas vs lixo/ruido
- Produtos na fila de cadastro (pendentes)
- Cupons pendentes
- Consumo de tokens (LLM) por periodo
 - Erros do pipeline (por tipo de evento em logs_eventos)
Observacao: todas as metricas devem poder ser filtradas por periodo.

Fontes e Consultas (exemplos)
Ofertas recebidas por marketplace
Tabela: ofertas_parseadas
Filtro: parsed_at entre data_inicio e data_fim
SQL:
select marketplace, count(*) as total
from ofertas_parseadas
where parsed_at between :data_inicio and :data_fim
group by marketplace;

Ofertas enviadas por marketplace
Tabela: ofertas_enviadas
Filtro: enviado_em entre data_inicio e data_fim
SQL:
select marketplace, count(*) as total
from ofertas_enviadas
where enviado_em between :data_inicio and :data_fim
group by marketplace;

Mensagens recebidas: aproveitadas vs lixo/ruido
Tabela: mensagens_recebidas + ofertas_enviadas (ou logs_eventos)
Filtro: received_at entre data_inicio e data_fim
SQL (aproveitadas = tem envio):
select
  count(*) filter (where mr.id in (select mensagem_id from ofertas_parseadas op join ofertas_enviadas oe on oe.oferta_id = op.id)) as aproveitadas,
  count(*) filter (where mr.id not in (select mensagem_id from ofertas_parseadas op join ofertas_enviadas oe on oe.oferta_id = op.id)) as lixo_ruido
from mensagens_recebidas mr
where mr.received_at between :data_inicio and :data_fim;

Produtos na fila de cadastro (pendentes)
Tabela: fila_cadastro_produto
Filtro: criado_em entre data_inicio e data_fim
SQL:
select count(*) as pendentes
from fila_cadastro_produto
where status = 'pendente'
and criado_em between :data_inicio and :data_fim;

Cupons pendentes
Tabela: cupons_pendentes
Filtro: criado_em entre data_inicio e data_fim
SQL:
select count(*) as pendentes
from cupons_pendentes
where criado_em between :data_inicio and :data_fim;

Consumo de tokens (LLM) por periodo
Tabela sugerida: logs_eventos (payload com tokens) ou tabela llm_usage dedicada
Filtro: criado_em entre data_inicio e data_fim
SQL (logs_eventos):
select sum((payload->>'tokens_total')::int) as tokens_total
from logs_eventos
where evento = 'llm_usage'
and criado_em between :data_inicio and :data_fim;

Erros do pipeline (por tipo)
Tabela: logs_eventos
Filtro: criado_em entre data_inicio e data_fim
SQL:
select evento, count(*) as total
from logs_eventos
where evento like 'pipeline_%'
and criado_em between :data_inicio and :data_fim
group by evento
order by total desc;

Monitor (Admin UI)
Tela de acompanhamento em tempo real do processamento.
Objetivo: ver se as mensagens estao sendo processadas e em qual etapa.
Dados exibidos:
- Ultimas mensagens recebidas (instance_id, group_id, received_at, status)
- Etapa atual (parseada, produto_ok, cupom_ok, pronta_envio, enviada, descartada)
- Motivo de descarte (se houver)
- Latencia por etapa (received_at -> enviado_em)
- Ultimos erros por instancia
Filtro: periodo e status.
Fonte principal: mensagens_recebidas, ofertas_parseadas, ofertas_enviadas, logs_eventos.

Seguranca e Confiabilidade
Deduplicacao no receiver.
Timeouts curtos em LLM e scraping.
Circuit breaker por instancia no dispatcher.
Retentativas curtas com backoff.

Sequencia resumida
receiver -> switch -> parser -> pipeline -> catalog -> coupon -> template -> dispatcher -> history

Fim
