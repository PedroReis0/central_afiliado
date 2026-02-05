-- Seed inicial: templates e cupons

-- Templates (padrao)
insert into templates (marketplace, tipo, nome, body, ativo)
values
  ('mercadolivre', 'padrao', 'padrao_1', '*{{nome_msg}}*\n{{oferta}}\n{{link_afiliado}}', true),
  ('mercadolivre', 'padrao', 'padrao_2', '*{{nome_msg}}*\n{{oferta}}\n\nCompre aqui: {{link_afiliado}}', true);

-- Cupons (exemplos)
insert into cupons_aprovados (codigo)
values ('CUPOM10')
on conflict (codigo) do nothing;

insert into cupons_bloqueados (codigo)
values ('CUPOMFRAUDE')
on conflict (codigo) do nothing;
