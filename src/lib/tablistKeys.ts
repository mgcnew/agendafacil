/**
 * Teclado das faixas de abas do painel.
 *
 * Todas elas já usam `tabIndex={ativa ? 0 : -1}` — o padrão de "roving
 * tabindex", em que só a aba selecionada entra na ordem do Tab. Ele existe
 * justamente para o Tab pular a faixa inteira de uma vez, em vez de obrigar a
 * pessoa a passar por aba por aba. Mas a outra metade do padrão é trocar de
 * aba com as setas, e essa metade nunca foi escrita: sem ela, as abas não
 * selecionadas não recebem foco por Tab (têm -1) nem por seta, e ficam
 * inalcançáveis por teclado.
 *
 * O handler vai no contêiner com `role="tablist"`, então `currentTarget` é a
 * própria faixa: as abas saem de lá na ordem do DOM, que é a mesma ordem da
 * lista passada aqui.
 */
export function tablistKeys<T extends string>(
  ids: readonly T[],
  value: T,
  onChange: (id: T) => void,
) {
  return function aoTeclar(e: React.KeyboardEvent<HTMLElement>) {
    const i = ids.indexOf(value);
    if (i < 0) return;
    let alvo = -1;
    if (e.key === "ArrowRight") alvo = (i + 1) % ids.length;
    else if (e.key === "ArrowLeft") alvo = (i - 1 + ids.length) % ids.length;
    else if (e.key === "Home") alvo = 0;
    else if (e.key === "End") alvo = ids.length - 1;
    else return;

    e.preventDefault();
    onChange(ids[alvo]);
    // `preventScroll`: a faixa rolável se posiciona sozinha; sem isto o
    // navegador também rolaria, e os dois brigariam.
    const botoes = e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]');
    botoes[alvo]?.focus({ preventScroll: true });
  };
}
