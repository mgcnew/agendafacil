"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { CaretDown, MagnifyingGlass, Plus, UserPlus, X } from "@phosphor-icons/react/dist/ssr";

export type ComboClient = { id: string; full_name: string; phone: string | null };

/** Tira acento e caixa: "Antônio" acha por "antonio". */
function chave(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Só os dígitos, pra busca por telefone funcionar com ou sem máscara. */
const digitos = (s: string) => s.replace(/\D/g, "");

/** Quantos resultados desenhar de uma vez. */
const MAX_VISIVEL = 50;

/**
 * Campo de cliente que busca enquanto se digita.
 *
 * O `<select>` anterior listava todo mundo em ordem alfabética: com 12
 * clientes funciona, com 300 a recepcionista rola a lista com a pessoa
 * esperando no telefone. Aqui ela digita as primeiras letras — ou o final do
 * número, que é como ela costuma identificar quem está ligando.
 *
 * Busca sem acento de propósito: quem digita rápido não digita "Antônio", e
 * fazer o acento importar transforma o cadastro correto em resultado vazio.
 *
 * "Nova cliente" fica fixo no topo e nunca é filtrado: é a saída quando a
 * busca não achou nada, que é exatamente quando ela mais precisa dele.
 */
export function ClientCombobox({
  clients,
  value,
  onChange,
  id,
}: {
  clients: ComboClient[];
  /** "" = nova cliente. */
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [theme, setTheme] = React.useState<{ niche?: string; color?: string }>({});
  const [ativo, setAtivo] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const escolhida = clients.find((c) => c.id === value) ?? null;

  // Normaliza uma vez por lista, não uma vez por tecla: `normalize("NFD")` é a
  // parte cara da busca, e refazê-la para todo mundo a cada letra digitada é
  // trabalho jogado fora.
  const indice = React.useMemo(
    () => clients.map((c) => ({ c, nome: chave(c.full_name), fone: digitos(c.phone ?? "") })),
    [clients],
  );

  const { filtrados, cortados } = React.useMemo(() => {
    const q = busca.trim();
    const base = !q
      ? indice
      : (() => {
          const k = chave(q);
          const d = digitos(q);
          return indice.filter(
            (r) => r.nome.includes(k) || (d.length >= 3 && r.fone.includes(d)),
          );
        })();
    // Teto de itens desenhados: uma agenda madura tem centenas de clientes, e
    // montar todos os botões a cada tecla trava a digitação no celular. Quem
    // não achou nos 50 primeiros acha digitando mais uma letra.
    return { filtrados: base.slice(0, MAX_VISIVEL).map((r) => r.c), cortados: Math.max(0, base.length - MAX_VISIVEL) };
  }, [indice, busca]);

  // Índice 0 é sempre "+ Nova cliente"; os clientes começam em 1.
  const totalItens = filtrados.length + 1;

  const posicionar = React.useCallback(() => {
    if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
  }, []);

  function abrir() {
    posicionar();
    const host = wrapRef.current?.closest("[data-niche]") as HTMLElement | null;
    setTheme({ niche: host?.dataset.niche, color: host?.dataset.color });
    setOpen(true);
    setAtivo(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function fechar() {
    setOpen(false);
    setBusca("");
  }

  function escolher(idCliente: string) {
    onChange(idCliente);
    fechar();
  }

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      fechar();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", posicionar, true);
    window.addEventListener("resize", posicionar);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", posicionar, true);
      window.removeEventListener("resize", posicionar);
    };
  }, [open, posicionar]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { fechar(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((i) => (i + 1) % totalItens); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((i) => (i - 1 + totalItens) % totalItens); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (ativo === 0) escolher("");
      else {
        const c = filtrados[ativo - 1];
        if (c) escolher(c.id);
      }
    }
  }

  // Mesma regra do Select: abre para cima quando não há espaço embaixo, para
  // não sumir atrás do rodapé do modal.
  function menuStyle(r: DOMRect): React.CSSProperties {
    const GAP = 4;
    const MAX = 264;
    const abaixo = window.innerHeight - r.bottom;
    const acima = r.top;
    const paraCima = abaixo < Math.min(MAX, 200) && acima > abaixo;
    const maxHeight = Math.max(140, Math.min(MAX, (paraCima ? acima : abaixo) - GAP - 4));
    return paraCima
      ? { position: "fixed", bottom: window.innerHeight - r.top + GAP, left: r.left, width: r.width, maxHeight }
      : { position: "fixed", top: r.bottom + GAP, left: r.left, width: r.width, maxHeight };
  }

  // Destaque do mouse é CSS (`hover:`), não estado: marcar o item sob o cursor
  // com setState re-renderizava a lista inteira a cada item que o ponteiro
  // cruzava. `ativo` existe só para o teclado, que muda um item por vez.
  const itemCls = (on: boolean, destacado: boolean) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-[calc(var(--radius)-0.35rem)] px-2.5 py-2 text-left text-sm transition",
      on ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted",
      destacado && !on && "bg-muted",
    );

  return (
    <div ref={wrapRef} className="relative">
      {open ? (
        <div className="flex h-11 w-full items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-3 ring-2 ring-[var(--ring)]">
          <MagnifyingGlass className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            id={id}
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setAtivo(0); }}
            onKeyDown={onKey}
            placeholder="Digite o nome ou o telefone…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar busca"
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          id={id}
          onClick={abrir}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-card px-3 text-sm text-foreground transition hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {escolhida ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{escolhida.full_name}</span>
              {escolhida.phone && (
                <span className="shrink-0 text-xs text-muted-foreground">{escolhida.phone}</span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <UserPlus className="h-4 w-4" /> Nova cliente
            </span>
          )}
          <CaretDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}

      {open && rect && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          data-niche={theme.niche}
          data-color={theme.color}
          style={menuStyle(rect)}
          className="z-[70] overflow-auto rounded-[var(--radius)] border border-border bg-card p-1 text-foreground shadow-xl"
        >
          {/* Nunca filtrado: é a saída para quando a busca não achou nada. */}
          <button
            type="button"
            role="option"
            aria-selected={value === ""}
            onClick={() => escolher("")}
            className={itemCls(value === "", ativo === 0)}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Nova cliente</span>
          </button>

          {filtrados.length > 0 && <div className="my-1 h-px bg-border/70" />}

          {filtrados.map((c, i) => {
            const on = c.id === value;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => escolher(c.id)}
                className={itemCls(on, ativo === i + 1)}
              >
                <span className="min-w-0 flex-1 truncate">{c.full_name}</span>
                {c.phone && (
                  <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span>
                )}
              </button>
            );
          })}

          {cortados > 0 && (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              +{cortados} {cortados === 1 ? "cliente" : "clientes"} — digite mais para afinar.
            </p>
          )}

          {busca.trim() !== "" && filtrados.length === 0 && (
            <p className="px-2.5 py-3 text-sm text-muted-foreground">
              Ninguém com esse nome. Use <b className="text-foreground">Nova cliente</b> acima.
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
