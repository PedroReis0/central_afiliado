# Resumo das Ultimas 20 Mensagens

## Resumo (16 itens)
1. Ajustamos o fluxo para **nao fazer segundo scrape**; a Jina roda uma unica vez.
2. A quebra da mensagem fornece: **valor, nome_msg, cupom, link, oferta**.
3. A Jina fornece: **nome_oficial, url_base, catalogo_id (marketplace_product_id)**.
4. O pipeline usa apenas os dados ja salvos na oferta (sem re-scrape).
5. Se `marketplace_product_id` estiver ausente, a oferta **nao segue** e o erro vai para metricas.
6. A validacao apos a Jina aprova apenas quando ha `link_limpo` + `marketplace_product_id`.
7. O IF de cadastro consulta `produto_marketplace`: se existir, **produto_ok**.
8. Se nao existir, vai para **fila de cadastro de produto** (nao cria automaticamente).
9. A fila recebe dados **pre-preenchidos** para o operador validar.
10. `nome_oficial` serve para sugerir produto principal; se nao houver, fica sem sugestao.
11. O operador cria o produto principal manualmente e confirma o cadastro do marketplace.
12. O cadastro nao pode concluir sem `produto_id` principal definido.
13. A imagem sera baixada **apenas quando entrar na fila de cadastro**.
14. `marketplace_product_id` no ML = `catalogo_id`.
15. O endpoint `/scrape/mercadolivre/oferta` salva `nome_oficial`, `link_limpo`, `marketplace_product_id` na oferta.
16. O endpoint `/pipeline/oferta/processar` decide produto_ok ou fila com base nesses campos.
17. O `parser-llm` vem antes do `marketplace-switch` no fluxo.
18. O scraper da Jina fica nomeado/vinculado ao fluxo de Mercado Livre para evitar confusao com outros marketplaces.
19. Na verificacao do produto principal por `nome_oficial`, se nao houver match exato, enviamos os 5 mais semelhantes para a LLM decidir (ou retornar "nenhum").
20. Se a LLM indicar "nenhum" (novo produto principal pendente), baixamos a foto do WhatsApp via API da Evolution.
21. A foto baixada e salva no balde (storage) e reutilizada como foto do produto no sistema e como midia padrao no envio da oferta.
22. Regra: existe apenas 1 foto por produto principal, e os cadastros de produto marketplace reutilizam a foto do principal.
23. Storage da foto: Supabase Storage, bucket `produtos`, caminho `produtos/{produto_id}/principal.*`; referencia salva no produto principal.
24. O download da midia so ocorre quando um novo produto principal for cadastrado como pendente.
25. Registrar a data do download da foto no produto principal (foto_downloaded_at).

## Ultimas 4 mensagens (literais)
1. "calma, estamos falando de duas filas diferentes"
2. "vou para por hj salve as nossa uktimas 20 msg em um documento depois suba para https://github.com/PedroReis0/central_afiliado"
3. "pode se um resumo, mais as ultiams 4 msg seja literal, pode rodar o git"
