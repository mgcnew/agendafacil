# Galeria

Rota: `/painel/[slug]/galeria`
Arquivo principal: `src/app/painel/[slug]/galeria/page.tsx`, `src/app/painel/[slug]/galeria/GaleriaManager.tsx`

## Objetivo

Gerenciar as fotos do salão exibidas no link público de agendamento (portfólio de trabalhos/ambiente).

## Funcionalidades

- Upload de múltiplas fotos por vez (drag & drop ou seletor de arquivo), com compressão automática no navegador para WebP (máx. 1200px, qualidade 0.85) antes do envio.
- Grade de fotos com hover mostrando ações de ampliar e remover.
- Lightbox em tela cheia com navegação por setas, teclado (setas/Esc) e swipe touch, além de tira de miniaturas.
- Remoção de foto individual (com confirmação via `confirm()`).
- Estado vazio com área de drop dedicada quando não há fotos.

## Permissões

- Visualização: qualquer membro com acesso ao salão (`getMembershipBySlug`).
- Upload e remoção (`canManage`): exige permissão `salon.manage`, tanto na renderização condicional do botão/áreas de drop quanto reforçada no servidor (`assertCanManage` em `actions.ts`).

## Inteligência (IA)

Nenhuma funcionalidade de IA implementada nesta página até o momento.

## Dados / Backend

- Tabela: `salon_gallery` (`id`, `url`, `caption`, `sort_order`, `salon_id`).
- Storage: bucket `gallery` (upload/remoção via `createAdminClient`, path `{salonId}/{photoId}.{ext}`).
- Limite de tamanho de arquivo: 8 MB por foto no servidor.

## Observações

Novas fotos entram sempre no fim (maior `sort_order` + 1); não há reordenação manual implementada na UI.
