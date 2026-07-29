"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import {
  ArrowClockwise,
  CheckCircle,
  CircleNotch,
  Power,
  WarningCircle,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";

type State = "disconnected" | "connecting" | "connected" | "paused";

type Settings = {
  bookingReceipt: boolean;
  thankYou: boolean;
  reminderConfirm: boolean;
  reviewRequest: boolean;
};

type StatusResponse = {
  state?: State;
  configured?: boolean;
  stale?: boolean;
  phoneNumber?: string | null;
  pausedReason?: string | null;
  lastError?: string | null;
  settings?: Settings;
  error?: string;
};

const MESSAGES: { key: keyof Settings; label: string; hint: string; soon?: boolean }[] = [
  {
    key: "bookingReceipt",
    label: "Comprovante do agendamento",
    hint: "Assim que a cliente agenda, ela recebe a confirmação com data, hora e serviço.",
  },
  {
    key: "thankYou",
    label: "Agradecimento após o atendimento",
    hint: "Enviado 20 minutos depois de concluir — tempo de a cliente sair do salão.",
  },
  {
    key: "reminderConfirm",
    label: "Confirmação na véspera",
    hint: "Às 10h do dia anterior, pergunta se o horário está de pé. Quem responde SIM confirma sozinho; quem responde NÃO libera o horário e você é avisado.",
  },
  {
    key: "reviewRequest",
    label: "Pedido de avaliação",
    hint: "Convida a cliente a avaliar o atendimento.",
    soon: true,
  },
];

/**
 * Conexão do WhatsApp do salão.
 *
 * O número é do próprio salão (uma instância Evolution por salão): a cliente
 * recebe de quem ela já conhece, o que gera menos bloqueio — e um número
 * banido derruba só aquele salão, não a base inteira.
 */
export function WhatsAppPanel({ slug }: { slug: string }) {
  const [state, setState] = useState<State | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [pausedReason, setPausedReason] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  // Alternativa ao QR: quem abre o painel no próprio celular não tem como
  // escanear um código exibido nesse mesmo aparelho.
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  // Evita que o polling continue depois de sair da aba.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/status?slug=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      const data: StatusResponse = await res.json();
      if (!alive.current) return null;

      if (!res.ok) {
        setError(
          data.error === "evolution_nao_configurada"
            ? "A integração ainda não está configurada no servidor."
            : "Não foi possível ler o status da conexão.",
        );
        return null;
      }

      setError(null);
      setState(data.state ?? "disconnected");
      setPhone(data.phoneNumber ?? null);
      setPausedReason(data.pausedReason ?? null);
      setStale(!!data.stale);
      if (data.settings) setSettings(data.settings);
      return data.state ?? "disconnected";
    } catch {
      if (alive.current) setError("Não foi possível falar com o servidor.");
      return null;
    }
  }, [slug]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  // Enquanto o QR está na tela, pergunta o status a cada 3s — é assim que a
  // gente descobre que a pessoa escaneou (a Evolution não avisa).
  const pareando = !!qr || !!pairingCode;
  useEffect(() => {
    if (!pareando) return;
    const id = setInterval(async () => {
      const s = await loadStatus();
      if (s === "connected") {
        setQr(null);
        setPairingCode(null);
        clearInterval(id);
      }
    }, 3000);
    // O código da Evolution expira; depois de 2min some e a pessoa pede outro.
    const stop = setTimeout(() => {
      clearInterval(id);
      setQr(null);
      setPairingCode(null);
    }, 120_000);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [pareando, loadStatus]);

  /**
   * `phone` preenchido = pedido de código de pareamento. O WhatsApp vincula o
   * código ao número que vai digitá-lo, então sem ele a Evolution só devolve
   * QR — era exatamente por isso que "gerar código" não mostrava nada.
   */
  async function connect(phone?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(phone ? { slug, phone } : { slug }),
      });
      const data = await res.json();
      // Código de pareamento sozinho já basta pra conectar — exigir o QR
      // deixava de fora justamente quem está no celular.
      if (!res.ok || (!data.qrCode && !data.pairingCode)) {
        setError(
          data.error === "evolution_nao_configurada"
            ? "A integração ainda não está configurada no servidor."
            : data.error === "ja_conectada"
            ? "Este número já está conectado. Clique em Desconectar antes de parear outro aparelho."
            : data.error === "telefone_invalido"
            ? "Confira o número: precisa ser um celular com DDD, como (11) 98765-4321."
            : data.error === "codigo_indisponivel"
            ? // O detalhe técnico vai junto de propósito: é uma tela de dono,
              // e sem ele não dá pra saber por que o código não veio.
              `O WhatsApp não devolveu o código para esse número. Use o QR code acima. ${
                Array.isArray(data.campos) && data.campos.length
                  ? `(resposta do servidor: ${data.campos.join(", ")})`
                  : ""
              }`.trim()
            : "Não foi possível gerar o código agora. Tente de novo em alguns segundos.",
        );
        return;
      }
      setQr(data.qrCode ?? null);
      setPairingCode(data.pairingCode ?? null);
      setState("connecting");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Desconectar o WhatsApp? As mensagens automáticas param de sair.")) return;
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/whatsapp/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      setQr(null);
      setPairingCode(null);
      await loadStatus();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: keyof Settings) {
    if (!settings) return;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next); // otimista: a troca precisa parecer instantânea
    const res = await fetch("/api/whatsapp/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, settings: { [key]: next[key] } }),
    });
    if (!res.ok) {
      setSettings(settings); // desfaz
      setError("Não foi possível salvar. Tente de novo.");
    }
  }

  if (state === null && !error) {
    return (
      <Card className="p-6 flex items-center gap-3 text-sm text-muted-foreground">
        <CircleNotch className="h-4 w-4 animate-spin" /> Carregando…
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
              <WhatsappLogo className="h-6 w-6" weight="fill" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold">WhatsApp do salão</h3>
              <p className="mt-0.5 max-w-md text-sm text-muted-foreground">
                Conecte o número que você já usa com suas clientes. As mensagens
                saem dele — por isso elas reconhecem e confiam.
              </p>
            </div>
          </div>
          <StatusBadge state={state} stale={stale} />
        </div>

        {error && (
          <p className="mt-4 flex items-start gap-2 text-sm text-red-600">
            <WarningCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        {state === "paused" && (
          <div className="mt-4 rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Envios pausados automaticamente
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-200/80">
              {pausedReason === "falhas_consecutivas"
                ? "Várias mensagens seguidas falharam. Pausamos para proteger a reputação do seu número — reconecte para voltar a enviar."
                : "A conexão foi pausada. Reconecte para voltar a enviar."}
            </p>
          </div>
        )}

        {/* Pareamento: QR pra quem está no computador, código pra quem está
            no celular — nesse caso não há como escanear a própria tela. */}
        {pareando && (
          <div className="mt-5 rounded-[var(--radius)] border border-border bg-muted/40 p-5">
            {qr && (
              <div className="flex flex-col items-center gap-3">
                <Image
                  src={qr}
                  alt="QR code para conectar o WhatsApp"
                  width={240}
                  height={240}
                  unoptimized
                  className="rounded-lg bg-white p-2"
                />
                <ol className="max-w-xs space-y-1 text-center text-xs text-muted-foreground">
                  <li>1. Abra o WhatsApp no celular do salão</li>
                  <li>2. Toque em <b className="text-foreground">Aparelhos conectados</b></li>
                  <li>3. Toque em <b className="text-foreground">Conectar aparelho</b> e aponte para o código</li>
                </ol>
              </div>
            )}

            <div className={qr ? "mt-5 border-t border-border pt-5" : ""}>
              {pairingCode ? (
                <>
                  <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Seu código de pareamento
                  </p>
                  <p className="mt-2 text-center font-display text-3xl font-bold tracking-[0.2em]">
                    {pairingCode}
                  </p>
                  <ol className="mx-auto mt-3 max-w-xs space-y-1 text-center text-xs text-muted-foreground">
                    <li>1. Abra o WhatsApp no celular do salão</li>
                    <li>2. Toque em <b className="text-foreground">Aparelhos conectados</b></li>
                    <li>3. Toque em <b className="text-foreground">Conectar com número de telefone</b></li>
                    <li>4. Digite o código acima</li>
                  </ol>
                  {/* O código vale por cerca de um minuto e some sem aviso do
                      WhatsApp — que responde "código incorreto", não
                      "expirado". Sem esta linha a pessoa culpa o sistema. */}
                  <p className="mx-auto mt-3 max-w-xs text-center text-xs text-amber-600">
                    Digite agora: o código vale por cerca de 1 minuto. Se demorar,
                    o WhatsApp diz &quot;código incorreto&quot; — é só gerar outro.
                  </p>
                </>
              ) : (
                // O código só existe vinculado a um número — por isso o campo.
                // É o caminho de quem abriu o painel no próprio celular e não
                // tem como escanear a tela em que está.
                <>
                  <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {qr ? "Está no celular? Conecte pelo número" : "Conecte pelo número"}
                  </p>
                  <div className="mx-auto mt-3 flex max-w-sm flex-col gap-2 sm:flex-row">
                    <Input
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="(11) 98765-4321"
                      inputMode="tel"
                      aria-label="Número do WhatsApp do salão"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => void connect(phoneInput)}
                      disabled={busy || phoneInput.trim().length < 10}
                    >
                      {busy && <CircleNotch className="h-4 w-4 animate-spin" />} Gerar código
                    </Button>
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    O número do aparelho que vai receber as mensagens. Gerar o
                    código invalida o QR code acima.
                  </p>
                </>
              )}
            </div>

            {/* Só quando há de fato um código na tela: antes aparecia junto do
                formulário vazio e dava a impressão de que algo estava em
                andamento quando nada tinha sido gerado. */}
            {(qr || pairingCode) && (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <CircleNotch className="h-3 w-3 animate-spin" /> Aguardando conexão…
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {state === "connected" ? (
            <>
              <Button variant="outline" onClick={disconnect} disabled={busy}>
                <Power className="h-4 w-4" /> Desconectar
              </Button>
              <Button variant="ghost" onClick={() => void loadStatus()} disabled={busy}>
                <ArrowClockwise className="h-4 w-4" /> Atualizar status
              </Button>
            </>
          ) : (
            <>
              {/* Sem argumento: o React passaria o evento de clique como se
                  fosse o telefone. */}
              <Button onClick={() => void connect()} disabled={busy}>
                {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <WhatsappLogo className="h-4 w-4" weight="fill" />}
                {pareando ? "Gerar outro código" : state === "paused" ? "Reconectar" : "Conectar WhatsApp"}
              </Button>
              {/* Saída pra instância que ficou presa em "conectando": o código
                  expirou, ninguém escaneou e sem isto o único caminho era
                  pedir código novo pra sempre. */}
              {state === "connecting" && (
                <Button variant="ghost" onClick={disconnect} disabled={busy}>
                  <Power className="h-4 w-4" /> Cancelar e recomeçar
                </Button>
              )}
            </>
          )}
        </div>

        {state === "connected" && phone && (
          <p className="mt-3 text-xs text-muted-foreground">
            Número conectado: <b className="text-foreground">{phone}</b>
          </p>
        )}
      </Card>

      {/* Mensagens */}
      {state === "connected" && settings && (
        <Card className="p-6">
          <h4 className="font-semibold">Mensagens automáticas</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Enviamos só para quem tem agendamento com você, em horário comercial
            e com intervalo entre uma mensagem e outra — para o WhatsApp não
            tratar seu número como robô.
          </p>

          <div className="mt-4 space-y-3">
            {MESSAGES.map((m) => (
              <label
                key={m.key}
                className={`flex items-start gap-3 rounded-[var(--radius)] border border-border p-3 ${
                  m.soon ? "opacity-60" : "cursor-pointer hover:border-primary/50"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
                  checked={settings[m.key]}
                  disabled={m.soon}
                  onChange={() => toggle(m.key)}
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {m.label}
                    {m.soon && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                        Em breve
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Toda mensagem termina com uma saída fácil (&ldquo;responda SAIR&rdquo;). Quem pedir
            para sair não recebe mais nada — o que também protege seu número.
          </p>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ state, stale }: { state: State | null; stale: boolean }) {
  const meta: Record<State, { text: string; cls: string; icon: typeof CheckCircle }> = {
    connected: {
      text: "Conectado",
      cls: "bg-green-500/15 text-green-700 dark:text-green-400",
      icon: CheckCircle,
    },
    connecting: {
      text: "Aguardando leitura",
      cls: "bg-accent/15 text-accent",
      icon: CircleNotch,
    },
    paused: {
      text: "Pausado",
      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      icon: WarningCircle,
    },
    disconnected: {
      text: "Desconectado",
      cls: "bg-muted text-muted-foreground",
      icon: Power,
    },
  };
  const m = meta[state ?? "disconnected"];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${m.cls}`}
      title={stale ? "Último estado conhecido — o servidor não respondeu agora" : undefined}
    >
      <Icon className={`h-3.5 w-3.5 ${state === "connecting" ? "animate-spin" : ""}`} />
      {m.text}
      {stale && " (?)"}
    </span>
  );
}
