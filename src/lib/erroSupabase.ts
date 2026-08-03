/**
 * Traduz erro do Postgres em frase de dono de salão — e, quando não souber
 * traduzir, grita no console.
 *
 * Existe por um bug de dois dias: um `grant` faltando derrubava toda escrita em
 * `clients`, e a tela só dizia "Não foi possível salvar. Tente novamente.". A
 * mensagem estava certa em tom e errada em consequência — engolir `error.code`
 * transformou uma causa de uma linha em investigação de log de servidor.
 *
 * Quem chama continua decidindo o texto padrão; isto só cobre os códigos que o
 * usuário consegue provocar sozinho e garante o rastro dos demais.
 */
export function mensagemErro(
  error: { code?: string; message?: string } | null | undefined,
  padrao: string,
  /** Traduções específicas da tela, por código do Postgres. */
  porCodigo?: Record<string, string>,
): string {
  if (!error) return padrao;

  const especifica = error.code ? porCodigo?.[error.code] : undefined;
  if (especifica) return especifica;

  // Erro que não previmos. O usuário vê a frase neutra; o console guarda o
  // suficiente pra descobrir a causa sem abrir o log do banco.
  console.error("[supabase]", error.code ?? "sem_codigo", error.message ?? error);
  return padrao;
}

/** Violação de unicidade — no nosso schema, quase sempre telefone repetido. */
export const DUPLICADO = "23505";

/**
 * Violação de CHECK. Hoje só um pode chegar na tela do dono: o telefone
 * inválido em `clients`. Sem traduzir, quem tentar editar uma das fichas
 * antigas com telefone quebrado leva um "não foi possível salvar" e não tem
 * como adivinhar que o problema é um campo que ele nem tocou.
 */
export const REGRA_VIOLADA = "23514";

/**
 * Exceções que as funções do caixa levantam por nome (`raise exception
 * 'session_closed'`). O PostgREST devolve isso como `message`, e as telas
 * mostravam o texto cru: a dona do salão lia "session_closed" na cara dela.
 */
const CAIXA: Record<string, string> = {
  tx_not_found: "Essa movimentação não existe mais — atualize a página.",
  session_closed: "Esse caixa já foi fechado. Reabra antes de estornar.",
  forbidden: "Você não tem permissão para isso.",
  "not authorized": "Você não tem permissão para isso.",
  session_open: "Já existe um caixa aberto.",
  not_found: "Não encontramos esse registro — atualize a página.",
  muitas_sugestoes:
    "Você já mandou várias sugestões hoje. Continue amanhã — vamos ler todas.",
  titulo_vazio: "Escreva um título.",
  texto_vazio: "Escreva o texto.",
  nao_encontrado: "Esse item não existe mais — atualize a página.",
};

/**
 * Traduz o erro que veio de um `throw` de RPC. Aceita tanto as exceções por
 * nome quanto as que já vêm escritas em português (o banco tem das duas).
 */
export function mensagemRpc(e: unknown, padrao: string): string {
  const msg = (e as { message?: string } | null)?.message?.trim();
  if (!msg) return padrao;
  const conhecida = CAIXA[msg];
  if (conhecida) return conhecida;
  // Já em português (termina com ponto e tem espaço) — o banco escreve várias
  // assim, e reescrevê-las aqui só faria a mensagem envelhecer em dois lugares.
  if (/\s/.test(msg) && /[.!?]$/.test(msg) && !/^[a-z_]+$/.test(msg)) return msg;
  console.error("[rpc]", msg);
  return padrao;
}
