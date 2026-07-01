# Serviços

Rota: `/painel/[slug]/servicos`
Arquivo principal: `src/app/painel/[slug]/servicos/page.tsx` + `ServicesManager.tsx`

## Objetivo

Cadastro e organização do catálogo de serviços do salão: preço, duração, comissão, cor na agenda, receita de insumos e categorias.

## Funcionalidades

- Listagem de serviços agrupada por categoria (incluindo agrupamento "sem categoria").
- Criação/edição de serviço: nome, categoria (opcional), duração, tipo de preço (valor exato / a partir de / sob consulta), preço, comissão (%), cor (usada na agenda), tempo de "processamento" opcional (ex.: tempo de pausa entre etapas) com tempo de finalização, e "receita" de insumos (produtos consumidos por atendimento, com quantidade) — usada para calcular margem.
- Ativar/desativar serviço (toggle `is_active`) sem excluir.
- Exclusão de serviço (remove também os vínculos em `service_products`).
- Gestão de categorias de serviço: criar, listar, excluir (ao excluir uma categoria, os serviços vinculados ficam sem categoria).
- Seletor de "serviços comuns" por nicho (`PresetPicker`, usa `SERVICE_PRESETS[niche]`) para adicionar vários serviços pré-configurados de uma vez.
- Indicadores por serviço na lista:
  - Margem estimada (preço − comissão − custo de insumo do cadastro) e margem real (baseada no histórico real de 90 dias, quando há atendimentos concluídos).
  - Contagem de atendimentos concluídos nos últimos 90 dias (badge "Nx").
  - Badge "parado há 90+ dias" para serviços ativos sem nenhum atendimento no período.

## Permissões

Sem checagem de permissão (`perms.has`/role) nesta página — qualquer membro com acesso ao painel pode criar, editar, excluir e ativar/desativar serviços e categorias.

## Inteligência (IA)

Não há LLM nesta página. Há cálculo de "insights" de uso real, classificado no roadmap como v1 de IA para Serviços mas implementado como cálculo direto (SQL), sem narração por modelo:
- RPC `service_insights` retorna, por serviço, número de agendamentos concluídos, receita, comissão média e data do último agendamento nos últimos 90 dias.
- Usado para: margem real (preço/comissão médios reais em vez dos valores cadastrados), contagem de atendimentos, e sinalização de serviço "parado" (ativo mas sem nenhum atendimento na janela de 90 dias).
- Sem texto gerado por IA nem componente de narrador — os números aparecem como badges/valores diretamente na lista.

## Dados / Backend

- Tabelas: `services`, `service_categories`, `service_products`, `products`.
- RPC: `service_insights`.
- Helper: `buildServiceInsightMap` (`src/lib/serviceInsights.ts`).

## Observações

- Página roda com `export const dynamic = "force-dynamic"`.
- O catálogo de "serviços comuns" (`SERVICE_PRESETS`) e a paleta de cores (`SERVICE_COLORS`) variam por nicho do salão.
