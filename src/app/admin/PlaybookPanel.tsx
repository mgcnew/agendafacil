"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import {
  Compass,
  Target,
  Crosshair,
  Tag,
  Brain,
  ShieldWarning,
  DoorOpen,
  InstagramLogo,
  ChartLineUp,
  TrendUp,
  ListChecks,
  CheckCircle,
  ArrowRight,
  Quotes,
  WarningCircle,
  Lightbulb,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

/**
 * Playbook de divulgação do Zulan — guia estratégico de go-to-market para a
 * fase inicial (porta-a-porta + canais de custo zero, sem gastar com ads/infra
 * paga). Conteúdo estático, organizado por seções navegáveis. Fica no /admin
 * para ficar sempre à mão (inclusive no celular, em campo).
 *
 * As estimativas de crescimento são premissas explícitas, não promessas —
 * servem de meta e são recalibráveis com os números reais do painel.
 */

type SectionId =
  | "norte"
  | "publico"
  | "posicao"
  | "oferta"
  | "gatilhos"
  | "objecoes"
  | "campo"
  | "redes"
  | "metricas"
  | "projecao"
  | "roteiro";

const SECTIONS: { id: SectionId; label: string; icon: PhosphorIcon }[] = [
  { id: "norte", label: "O Norte", icon: Compass },
  { id: "publico", label: "Público", icon: Target },
  { id: "posicao", label: "Posicionamento", icon: Crosshair },
  { id: "oferta", label: "Oferta e preço", icon: Tag },
  { id: "gatilhos", label: "Gatilhos", icon: Brain },
  { id: "objecoes", label: "Objeções", icon: ShieldWarning },
  { id: "campo", label: "Porta a porta", icon: DoorOpen },
  { id: "redes", label: "Redes e canais", icon: InstagramLogo },
  { id: "metricas", label: "Métricas", icon: ChartLineUp },
  { id: "projecao", label: "Projeção", icon: TrendUp },
  { id: "roteiro", label: "Roteiro", icon: ListChecks },
];

export function PlaybookPanel() {
  const [section, setSection] = useState<SectionId>("norte");

  return (
    <div className="space-y-6">
      {/* Sub-navegação por seção (chips com scroll horizontal no mobile) */}
      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex gap-1.5 px-1 min-w-max">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition ${
                section === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {section === "norte" && <Norte />}
      {section === "publico" && <Publico />}
      {section === "posicao" && <Posicao />}
      {section === "oferta" && <Oferta />}
      {section === "gatilhos" && <Gatilhos />}
      {section === "objecoes" && <Objecoes />}
      {section === "campo" && <Campo />}
      {section === "redes" && <Redes />}
      {section === "metricas" && <Metricas />}
      {section === "projecao" && <Projecao />}
      {section === "roteiro" && <Roteiro />}
    </div>
  );
}

/* ---------------- Blocos reutilizáveis ---------------- */

function SectionHead({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: PhosphorIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid place-items-center h-10 w-10 shrink-0 rounded-xl bg-primary/12 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className="font-display text-xl font-bold leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "win" | "warn";
  children: React.ReactNode;
}) {
  const meta = {
    info: { cls: "bg-primary/8 border-primary/25 text-foreground", Icon: Lightbulb, ic: "text-primary" },
    win: { cls: "bg-emerald-500/8 border-emerald-500/25 text-foreground", Icon: CheckCircle, ic: "text-emerald-600" },
    warn: { cls: "bg-amber-500/10 border-amber-500/30 text-foreground", Icon: WarningCircle, ic: "text-amber-600" },
  }[tone];
  const Icon = meta.Icon;
  return (
    <div className={`flex gap-3 rounded-[var(--radius)] border p-4 ${meta.cls}`}>
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${meta.ic}`} />
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}

/** Cartão de script — fala pronta pra usar em campo. */
function Script({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary mb-1.5">
        <Quotes className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-sm leading-relaxed italic text-foreground/90">{children}</p>
    </div>
  );
}

/* ---------------- 1. O Norte ---------------- */

function Norte() {
  return (
    <div className="space-y-5">
      <SectionHead
        icon={Compass}
        title="O Norte — a estratégia em uma tela"
        subtitle="Leia isto sempre que sentir que se perdeu. O resto do playbook detalha cada ponto."
      />

      <Card className="p-5 space-y-3">
        <p className="text-sm leading-relaxed">
          <b>A ideia central:</b> no começo você não vence por marketing — vence
          por <b>presença</b>. Grandes concorrentes não batem na porta do salão
          do bairro. Você bate. Seu diferencial imbatível nesta fase é ser{" "}
          <b>local, presente e humano</b>: você aparece, monta o sistema junto
          com a dona e volta pra ajudar. Isso nenhum anúncio compra.
        </p>
        <p className="text-sm leading-relaxed">
          Com meio período (~10–20h/semana) e meta de renda complementar
          (~10–20 salões pagando), o caminho é: <b>porta a porta bem feito</b>{" "}
          como motor principal + <b>prova social</b> (depoimentos dos primeiros
          clientes) + <b>indicação</b>. Redes sociais entram como apoio e
          credibilidade, não como fonte principal de venda no início.
        </p>
      </Card>

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motor 1 · 70%</div>
          <div className="font-display font-bold mt-1">Porta a porta</div>
          <p className="text-sm text-muted-foreground mt-1">Visitar, demonstrar ao vivo, montar o salão na hora e acompanhar o teste.</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motor 2 · 20%</div>
          <div className="font-display font-bold mt-1">Prova social + indicação</div>
          <p className="text-sm text-muted-foreground mt-1">Depoimento do 1º cliente feliz vira sua melhor propaganda. Peça indicação sempre.</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Motor 3 · 10%</div>
          <div className="font-display font-bold mt-1">Conteúdo (redes)</div>
          <p className="text-sm text-muted-foreground mt-1">Instagram/WhatsApp mostrando o produto. Serve de vitrine e credibilidade.</p>
        </Card>
      </div>

      <Note tone="win">
        <b>A ordem que evita se perder:</b> (1) prepare o material e um salão-demo
        pronto → (2) escolha 1 bairro denso → (3) faça as primeiras visitas e
        ajuste o discurso → (4) feche os primeiros trials e <i>acompanhe de
        perto</i> até virarem pagantes → (5) colha depoimento e peça indicação →
        (6) repita e só então pense em ampliar. Veja a aba <b>Roteiro</b>.
      </Note>

      <Note tone="warn">
        <b>Regra de ouro:</b> conseguir um trial é fácil; fazer o trial virar
        pagante é o jogo todo. A maioria não cancela por preço — cancela por{" "}
        <b>não ter usado</b>. Seu trabalho não acaba no cadastro; começa nele.
      </Note>
    </div>
  );
}

/* ---------------- 2. Público ---------------- */

function Publico() {
  const tiers = [
    {
      tier: "Alvo primário",
      cls: "bg-emerald-500/12 text-emerald-600",
      who: "Salões e barbearias de 1 a 4 profissionais, com movimento, dona(o) que atende e cuida da agenda no WhatsApp.",
      why: "Sente a dor todo dia (bagunça de horário, mensagem na madrugada, confusão de comissão) e decide sozinho, sem burocracia. Ticket cabe no bolso.",
    },
    {
      tier: "Alvo secundário",
      cls: "bg-blue-500/12 text-blue-600",
      who: "Profissionais autônomos que alugam cadeira/sala (manicure, cabeleireiro, esteticista, lash designer) e clínicas de estética pequenas.",
      why: "Precisam de agenda e ficha de cliente. Convertem bem, mas ticket e urgência menores. Bom volume, boa indicação.",
    },
    {
      tier: "Evite no início",
      cls: "bg-amber-500/15 text-amber-600",
      who: "Redes grandes, franquias, salões com recepção/sistema consolidado, ou o dono que 'nunca está'.",
      why: "Venda longa, muitos decisores, exige integração. Consome seu tempo escasso. Volte quando tiver estrutura e cases.",
    },
  ];
  return (
    <div className="space-y-5">
      <SectionHead
        icon={Target}
        title="Quem procurar primeiro (e quem deixar pra depois)"
        subtitle="Com tempo limitado, priorizar quem tem dor + poder de decisão + ticket viável é metade da venda."
      />
      <div className="space-y-3">
        {tiers.map((t) => (
          <Card key={t.tier} className="p-4">
            <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${t.cls}`}>{t.tier}</span>
            <p className="text-sm font-medium mt-2">{t.who}</p>
            <p className="text-sm text-muted-foreground mt-1"><b>Por quê:</b> {t.why}</p>
          </Card>
        ))}
      </div>
      <Note>
        <b>Sinais de bom alvo (bata aqui primeiro):</b> agenda escrita em caderno
        ou só no WhatsApp; fila de espera na cadeira; dona reclamando de
        "furos" e faltas; equipe de 2–4 pessoas; salão organizado e cheio (quem
        já cuida do negócio valoriza organização). <b>Sinais de alvo ruim:</b>{" "}
        movimento fraco, dono ausente, "já tenho sistema e adoro".
      </Note>
    </div>
  );
}

/* ---------------- 3. Posicionamento ---------------- */

function Posicao() {
  const rivals = [
    { name: "Caderno / agenda de papel", weak: "Perde dado, não confirma, não avisa falta, some se molhar.", pitch: "Tudo que você anota, só que não se perde e ainda confirma sozinho." },
    { name: "Só WhatsApp", weak: "Bagunça, mensagem de madrugada, esquece de responder e perde cliente.", pitch: "A cliente agenda sozinha pelo link, você só aparece pra atender." },
    { name: "Sistemas grandes/caros", weak: "Caros, complexos, suporte robô, feitos pra rede grande.", pitch: "Simples como o WhatsApp, preço de salão de bairro, e eu monto com você." },
  ];
  return (
    <div className="space-y-5">
      <SectionHead
        icon={Crosshair}
        title="Posicionamento — a frase que gruda"
        subtitle="Você não vende 'software'. Vende agenda organizada, tempo livre e dinheiro que não escapa."
      />
      <Card className="p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Frase de posicionamento</div>
        <p className="font-display text-lg font-semibold leading-snug">
          "O sistema de agenda feito pro salão brasileiro de verdade: simples
          como o WhatsApp, organizado como uma recepção profissional — e com
          alguém de carne e osso pra te ajudar a começar."
        </p>
      </Card>

      <Note>
        <b>Venda a transformação, não a função.</b> Ninguém acorda querendo
        "software de agendamento". Querem: parar de responder WhatsApp de
        madrugada, parar de perder horário, saber quanto cada profissional
        rendeu sem brigar, e passar imagem de salão profissional. Fale sempre do{" "}
        <i>resultado</i>, mostre a função como prova.
      </Note>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Como se posicionar contra cada alternativa:</p>
        {rivals.map((r) => (
          <Card key={r.name} className="p-4">
            <p className="font-medium text-sm">{r.name}</p>
            <p className="text-sm text-muted-foreground mt-1"><b>Fraqueza deles:</b> {r.weak}</p>
            <p className="text-sm mt-1"><b className="text-primary">Sua fala:</b> "{r.pitch}"</p>
          </Card>
        ))}
      </div>

      <Note tone="win">
        <b>Seu trunfo único:</b> "Eu sou daqui, eu apareço, eu monto pra você e
        volto pra ajudar." Nenhum concorrente grande faz isso. Repita isso — é o
        que fecha.
      </Note>
    </div>
  );
}

/* ---------------- 4. Oferta e preço ---------------- */

function Oferta() {
  return (
    <div className="space-y-5">
      <SectionHead
        icon={Tag}
        title="Oferta e preço — como apresentar sem parecer caro"
        subtitle="O preço já é acessível. O trabalho é ancorar contra o que ela perde, não contra 'mais uma mensalidade'."
      />

      <div className="grid sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="font-display font-bold">Básico</div>
          <div className="text-2xl font-bold text-primary mt-1">R$ 39,90<span className="text-sm text-muted-foreground font-normal">/mês</span></div>
          <p className="text-sm text-muted-foreground mt-2">Só agendamento: agenda, clientes, serviços e equipe. A porta de entrada.</p>
        </Card>
        <Card className="p-4 ring-2 ring-primary">
          <div className="font-display font-bold">Pro <span className="text-[11px] bg-primary/12 text-primary rounded-full px-2 py-0.5 align-middle">foco da venda</span></div>
          <div className="text-2xl font-bold text-primary mt-1">R$ 69,90<span className="text-sm text-muted-foreground font-normal">/mês</span></div>
          <p className="text-sm text-muted-foreground mt-2">Tudo: caixa, comissões, estoque, pacotes, campanhas e relatórios.</p>
        </Card>
        <Card className="p-4">
          <div className="font-display font-bold">Max <span className="text-[11px] bg-muted text-muted-foreground rounded-full px-2 py-0.5 align-middle">em breve</span></div>
          <div className="text-2xl font-bold text-muted-foreground mt-1">R$ 99,90<span className="text-sm font-normal">/mês</span></div>
          <p className="text-sm text-muted-foreground mt-2">Tudo do Pro + WhatsApp. Use como âncora: faz o Pro parecer o certo.</p>
        </Card>
      </div>

      <Note tone="win">
        <b>14 dias grátis, sem cartão</b> — esse é o seu maior ativo de venda.
        "Você testa 2 semanas sem pagar nada e sem cadastrar cartão. Se não te
        ajudar, é só parar." Remove todo o risco da decisão.
      </Note>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Ancoragem — as 3 contas que você faz na frente dela:</p>
        <Card className="p-4 space-y-2 text-sm">
          <p><b>1. Contra o prejuízo:</b> "Quantos horários você perde por mês porque não respondeu o WhatsApp a tempo? Um só já paga o mês inteiro do sistema."</p>
          <p><b>2. Por dia:</b> "R$ 69,90 dá menos de R$ 2,40 por dia — menos que um café. Por menos que um café você tem agenda, caixa e comissão no automático."</p>
          <p><b>3. Contra o concorrente:</b> "Sistema grande cobra R$ 150, R$ 200 e não te dá suporte de gente. Aqui é R$ 69,90 e sou eu que te atendo."</p>
        </Card>
      </div>

      <Note>
        <b>Oferta de lançamento (opcional, poderosa):</b> "Estou fechando os
        primeiros salões do bairro — pros primeiros, seguro o valor de
        lançamento pra sempre" ou "primeiro mês com desconto". Cria urgência e
        exclusividade sem queimar preço a longo prazo. Use o recurso de{" "}
        <b>Campanhas</b> ou um desconto combinado. Não invente escassez falsa —
        combine algo que você realmente honre.
      </Note>

      <Note tone="warn">
        <b>Não lidere pelo preço.</b> Só fale de valor <i>depois</i> de mostrar a
        dor e a solução funcionando. Preço cedo demais = objeção cedo demais.
      </Note>
    </div>
  );
}

/* ---------------- 5. Gatilhos ---------------- */

function Gatilhos() {
  const items = [
    { name: "Prova social", desc: "As pessoas fazem o que veem os pares fazendo.", how: "\"O salão da [rua/nome] aqui perto já está usando e adorou.\" Mostre nomes reais assim que tiver. Um print de depoimento vale mil argumentos." },
    { name: "Demonstração / autoridade", desc: "Ver funcionando ao vivo derrete a desconfiança.", how: "Não descreva — mostre. Faça um agendamento na frente dela pelo celular. \"Olha, sua cliente faria assim, ó.\"" },
    { name: "Aversão à perda", desc: "Perder dói mais que ganhar agrada.", how: "\"Cada horário furado é dinheiro que não volta. Cada cliente que desiste porque você demorou a responder, foi pro concorrente.\"" },
    { name: "Reciprocidade", desc: "Quem recebe algo sente que deve retribuir.", how: "Monte o salão dela no sistema ali, de graça, na hora — serviços, preços, horários. Ela já sai com valor recebido e inclinada a continuar." },
    { name: "Escassez / exclusividade", desc: "O que é limitado vale mais.", how: "\"Estou pegando só alguns salões do bairro agora pra dar atenção de verdade a cada um.\" Verdadeiro, porque seu tempo é limitado mesmo." },
    { name: "Compromisso e coerência", desc: "Quem diz 'sim' pequeno tende ao 'sim' grande.", how: "Faça micro-perguntas de 'sim': \"Faz sentido pra você organizar a agenda, né?\" → \"Ia ser bom parar de perder horário?\" → aí ofereça o teste." },
    { name: "Facilidade (redução de atrito)", desc: "O esforço percebido mata a venda.", how: "\"Você não precisa fazer nada — eu cadastro tudo com você agora e te mostro em 5 minutos. E é sem cartão.\"" },
  ];
  return (
    <div className="space-y-5">
      <SectionHead
        icon={Brain}
        title="Gatilhos mentais — com a fala pronta"
        subtitle="Gatilho sem exemplo de fala é teoria. Aqui vai o quê e o como dizer."
      />
      <div className="space-y-3">
        {items.map((g) => (
          <Card key={g.name} className="p-4">
            <p className="font-semibold text-sm text-primary">{g.name}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{g.desc}</p>
            <p className="text-sm mt-2 italic text-foreground/90">{g.how}</p>
          </Card>
        ))}
      </div>
      <Note tone="warn">
        Use gatilho como <b>verdade bem contada</b>, nunca como manipulação. Salão
        é relacionamento e boca a boca — uma promessa quebrada volta como fama
        ruim no bairro inteiro.
      </Note>
    </div>
  );
}

/* ---------------- 6. Objeções ---------------- */

function Objecoes() {
  const objs = [
    {
      o: "\"Já uso o WhatsApp / caderno e funciona.\"",
      r: "\"Funciona até o dia que dá errado — some uma folha, você esquece de responder, marca dois no mesmo horário. O sistema faz tudo isso não acontecer, e continua tão fácil quanto o WhatsApp. Testa 14 dias de graça e me diz se voltaria pro caderno.\"",
    },
    {
      o: "\"Minhas clientes são mais velhas, não vão saber usar.\"",
      r: "\"Elas não precisam baixar nada — só clicam num link, igual abrir uma mensagem. E quem prefere, você mesma agenda por dentro em segundos. Ninguém fica de fora.\"",
    },
    {
      o: "\"Já tentei um sistema e era complicado, larguei.\"",
      r: "\"Foi por isso que fiz esse simples e vim aqui pessoalmente. A diferença é que eu monto com você e fico de olho na primeira semana. Você não vai ficar sozinha pra descobrir sozinha.\"",
    },
    {
      o: "\"Tá caro / não tenho como pagar mais uma mensalidade.\"",
      r: "\"Dá menos de R$ 2,40 por dia. Um horário que você deixa de perder no mês já paga o sistema. Não é gasto, é o que impede o dinheiro de escapar. E os primeiros 14 dias são de graça pra você ver isso acontecer.\"",
    },
    {
      o: "\"Não tenho tempo de cadastrar tudo.\"",
      r: "\"Você não vai cadastrar — eu faço agora com você, em uns 10 minutos, seus serviços e horários. Sai daqui já funcionando.\"",
    },
    {
      o: "\"E se eu parar de pagar, perco tudo?\"",
      r: "\"Seus dados são seus. E como é sem cartão no teste, você nunca paga sem querer. Só continua se fizer sentido pra você.\"",
    },
    {
      o: "\"Vou pensar / depois eu vejo.\"  (a mais comum)",
      r: "\"Claro, sem pressa pra decidir pagar. Mas o teste é grátis e leva 10 minutos pra montar — que tal deixarmos rodando esses dias e você decide com o sistema já funcionando, não no escuro? Se não gostar, é só parar.\"",
    },
    {
      o: "\"Minha recepcionista já cuida disso.\"",
      r: "\"Ótimo — o sistema é a melhor ferramenta dela. Ela para de anotar em papel, vê a agenda do dia inteira e fecha comissão sem calculadora. Facilita a vida dela, não substitui.\"",
    },
  ];
  return (
    <div className="space-y-5">
      <SectionHead
        icon={ShieldWarning}
        title="Objeções — e a resposta pronta"
        subtitle="Objeção não é 'não'. Quase sempre é medo ou dúvida. Concorde, reduza o risco, reconduza ao teste grátis."
      />
      <Note>
        <b>Fórmula pra qualquer objeção:</b> 1) Concorde ("Entendo, faz
        sentido") → 2) Reenquadre (mostre o outro lado) → 3) Reduza o risco
        (teste grátis, sem cartão, eu monto) → 4) Micro-compromisso ("bora deixar
        rodando esses dias?").
      </Note>
      <div className="space-y-3">
        {objs.map((x) => (
          <Card key={x.o} className="p-4">
            <p className="font-semibold text-sm flex items-start gap-2">
              <WarningCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
              {x.o}
            </p>
            <p className="text-sm mt-2 italic text-foreground/90 pl-6">{x.r}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 7. Porta a porta ---------------- */

function Campo() {
  return (
    <div className="space-y-5">
      <SectionHead
        icon={DoorOpen}
        title="Porta a porta — o passo a passo"
        subtitle="Seu motor principal. Preparação + roteiro + follow-up. Decore o fluxo, improvise as palavras."
      />

      <Card className="p-4 space-y-2">
        <p className="text-sm font-semibold">Antes de sair (uma vez só, na semana 1):</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Um <b>salão-demo pronto</b> no celular (serviços, agenda com horários, um fechamento de comissão) pra mostrar funcionando.</li>
          <li>Cartão simples com seu nome, WhatsApp e o link. (Custa pouco e fica na mão da dona.)</li>
          <li>Escolha <b>1 bairro denso</b> de salões. Trabalhe rua por rua — não pule por toda a cidade.</li>
          <li>Roteiro decorado (abaixo) e a oferta de lançamento definida.</li>
          <li>Boa aparência e uma pasta/celular carregado. Você é a cara do produto.</li>
        </ul>
      </Card>

      <Note tone="warn">
        <b>Horário certo muda tudo.</b> Vá nos horários <i>mortos</i> do salão —
        meio da manhã e meio da tarde, começo de semana (seg–qua). Nunca no pico
        (fim de tarde, sábado). Dona ocupada com cliente não ouve ninguém.
      </Note>

      <div className="space-y-3">
        <p className="text-sm font-semibold">O fluxo da visita (5 passos):</p>

        <Script label="1. Abertura (30 segundos, sem vender)">
          "Oi, tudo bem? Sou o [nome], sou daqui da região. Criei um sistema de
          agenda pra salões e barbearias e tô passando nos daqui pra mostrar.
          Você tem 2 minutinhos numa hora que não esteja com cliente?"
        </Script>

        <Script label="2. Descoberta (deixe ela falar a dor)">
          "Como você marca os horários hoje? … Já aconteceu de perder horário ou
          marcar dois na mesma hora? … E pra saber quanto cada profissional
          rendeu no mês, como você faz?" — anote a dor que mais incomodar, é
          nela que você aperta.
        </Script>

        <Script label="3. Demonstração (2–3 min, no celular, ao vivo)">
          "Olha como fica: sua cliente abre esse link, escolhe o serviço, o
          profissional e o horário livre — e você recebe já confirmado, sem
          precisar responder. E aqui, ó, o fechamento do dia com a comissão de
          cada um, calculada sozinha." Mostre só as 1–2 dores dela, não o sistema
          inteiro.
        </Script>

        <Script label="4. Oferta + fechamento (reduza o atrito a zero)">
          "Tem 14 dias grátis, sem cartão. E o melhor: eu monto seu salão aqui
          agora com você, uns 10 minutos, e você já sai usando. Bora fazer?"
        </Script>

        <Script label="5. Se não fechar agora (nunca saia de mãos vazias)">
          "Sem problema! Deixa eu te passar meu contato e pegar o seu — te mando
          o link e, se quiser, montamos essa semana. Posso passar aqui de novo
          na [dia]?" Sempre capture o WhatsApp.
        </Script>
      </div>

      <Card className="p-4 space-y-2">
        <p className="text-sm font-semibold">Follow-up (é aqui que a venda acontece de verdade):</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li><b>No mesmo dia:</b> mensagem curta agradecendo + link. "Foi ótimo te conhecer! Aqui o link. Qualquer coisa é só chamar."</li>
          <li><b>Quem iniciou o teste — acompanhe:</b> D+1 ("conseguiu criar seu primeiro agendamento?"), D+3 ("te ajudo a colocar seus serviços?"), D+7 ("como tá indo?"), D+12 ("seu teste acaba em 2 dias, bora continuar?").</li>
          <li><b>Quem não fechou:</b> uma passada de volta em ~1 semana costuma converter quem "ia pensar".</li>
        </ul>
      </Card>

      <Note tone="win">
        Meta realista de meio período: <b>3 a 4 saídas de campo por semana</b>,
        ~5–7 conversas reais por saída. Não é sobre bater em 100 portas por dia —
        é bater nas certas e <b>acompanhar quem demonstrou interesse</b>.
      </Note>
    </div>
  );
}

/* ---------------- 8. Redes e canais ---------------- */

function Redes() {
  return (
    <div className="space-y-5">
      <SectionHead
        icon={InstagramLogo}
        title="Redes sociais e canais de custo zero"
        subtitle="Apoio, não motor. Servem de vitrine e prova de que você existe e é sério — enquanto o porta a porta traz os clientes."
      />

      <Card className="p-4 space-y-2">
        <p className="text-sm font-semibold">Instagram / TikTok (o mínimo que dá resultado):</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Perfil profissional com bio clara ("Sistema de agenda pra salões e barbearias · teste grátis") e o link.</li>
          <li><b>Reels curtos de dor:</b> "3 confusões que o caderninho causa no salão", "como sua cliente pode agendar sozinha em 20 segundos".</li>
          <li><b>Antes/depois:</b> a bagunça do WhatsApp × a agenda organizada.</li>
          <li><b>Bastidor:</b> você montando o salão de um cliente, depoimento em vídeo (ouro puro).</li>
          <li>Cadência sustentável: 2–3 posts/semana &gt; 1 post/dia por 1 semana e sumir.</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-2">
        <p className="text-sm font-semibold">Canais gratuitos de alto retorno:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li><b>WhatsApp:</b> status mostrando o produto; grupos de profissionais de beleza da cidade (participe, ajude, não faça spam).</li>
          <li><b>Google Meu Negócio:</b> perfil grátis pra aparecer quando buscarem "sistema de agenda salão [cidade]".</li>
          <li><b>Indicação (programa simples):</b> "Indicou e o salão assinou? Você ganha 1 mês / desconto." Boca a boca de salão é forte.</li>
          <li><b>Parcerias B2B2C:</b> distribuidoras de produtos de beleza, cursos de estética/barbearia — eles falam com dezenas de salões e podem te apresentar.</li>
        </ul>
      </Card>

      <Note>
        <b>Regra de conteúdo:</b> cada post responde "o que a dona ganha?", nunca
        "que legal meu sistema". Mostre a dor dela e o alívio. Um depoimento real
        vale mais que dez posts bonitos.
      </Note>
      <Note tone="warn">
        Não caia na armadilha de passar o tempo todo produzindo conteúdo e
        fugindo do porta a porta (é mais confortável, mas vende menos no início).
        Conteúdo é <b>10% do esforço</b> nesta fase.
      </Note>
    </div>
  );
}

/* ---------------- 9. Métricas ---------------- */

function Metricas() {
  const steps = [
    { etapa: "Abordagens reais", meta: "~20/semana", nota: "Conversas em que a dona ouviu o pitch." },
    { etapa: "Demonstrações", meta: "~50% das abordagens", nota: "Conseguiu mostrar funcionando." },
    { etapa: "Trials iniciados", meta: "~25% das abordagens", nota: "Criou conta e você montou o salão." },
    { etapa: "Trials ativos", meta: "≥70% dos trials", nota: "Usaram de verdade (agendaram algo). Métrica que prevê conversão." },
    { etapa: "Convertidos em pagante", meta: "~30% dos trials", nota: "O número que importa. Acompanhe no painel." },
    { etapa: "Churn mensal", meta: "< 8%", nota: "Quantos pagantes cancelam por mês. Baixe cuidando da adoção." },
  ];
  return (
    <div className="space-y-5">
      <SectionHead
        icon={ChartLineUp}
        title="O funil e o que medir"
        subtitle="O que não se mede não melhora. Anote toda semana — o painel já mostra trials, conversão e churn."
      />
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-semibold px-4 py-2.5">Etapa do funil</th>
              <th className="text-left font-semibold px-4 py-2.5 whitespace-nowrap">Meta</th>
              <th className="text-left font-semibold px-4 py-2.5">O que é</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={s.etapa} className={i % 2 ? "bg-muted/20" : ""}>
                <td className="px-4 py-2.5 font-medium">{s.etapa}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-primary font-semibold">{s.meta}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{s.nota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Note tone="win">
        <b>A métrica que mais prevê sucesso:</b> "trials ativos" (usaram de
        verdade). Um trial que nunca criou um agendamento quase nunca vira
        pagante. Foque energia em fazer o trial <i>usar</i> na primeira semana —
        não em abrir mais trials mortos.
      </Note>
      <Note>
        Revise seus números <b>toda sexta</b>: quantas abordagens, quantos
        trials, quantos ativos, quantos pagantes. Ajuste o discurso no ponto que
        mais vaza. Ex.: muitas demos e poucos trials = seu fechamento precisa de
        mais "eu monto agora"; muitos trials e poucos pagantes = falta
        acompanhamento na semana do teste.
      </Note>
    </div>
  );
}

/* ---------------- 10. Projeção ---------------- */

function Projecao() {
  const realista = [
    { m: "Mês 1", pag: 2, mrr: "R$ 110" },
    { m: "Mês 2", pag: 5, mrr: "R$ 275" },
    { m: "Mês 3", pag: 8, mrr: "R$ 440" },
    { m: "Mês 4", pag: 11, mrr: "R$ 605" },
    { m: "Mês 5", pag: 14, mrr: "R$ 770" },
    { m: "Mês 6", pag: 16, mrr: "R$ 880" },
  ];
  const otimista = [
    { m: "Mês 1", pag: 4, mrr: "R$ 240" },
    { m: "Mês 2", pag: 9, mrr: "R$ 540" },
    { m: "Mês 3", pag: 15, mrr: "R$ 900" },
    { m: "Mês 4", pag: 21, mrr: "R$ 1.260" },
    { m: "Mês 5", pag: 28, mrr: "R$ 1.680" },
    { m: "Mês 6", pag: 35, mrr: "R$ 2.100" },
  ];
  return (
    <div className="space-y-5">
      <SectionHead
        icon={TrendUp}
        title="Projeção de crescimento — 2 cenários"
        subtitle="Estimativas, não promessas. Servem de meta e de régua. Recalibre com seus números reais do painel."
      />

      <Card className="p-4 space-y-1.5 text-sm">
        <p className="font-semibold">Premissas (meio período, ~80 abordagens/mês):</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
          <p><b>Realista:</b> 25% iniciam trial · 30% viram pagante · churn 7%/mês · ticket médio R$ 55</p>
          <p><b>Otimista:</b> 38% iniciam trial · 42% viram pagante · churn 4%/mês · ticket R$ 60 + indicações a partir do mês 3</p>
        </div>
        <p className="text-muted-foreground pt-1">Os 2 primeiros meses crescem menos: é a curva de aprendizado do discurso. A partir do mês 3 a eficiência e a indicação puxam.</p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 font-semibold text-sm flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Cenário realista
          </div>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr><th className="text-left px-4 py-2">Período</th><th className="text-left px-4 py-2">Pagantes</th><th className="text-left px-4 py-2">MRR</th></tr>
            </thead>
            <tbody>
              {realista.map((r, i) => (
                <tr key={r.m} className={i % 2 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2">{r.m}</td>
                  <td className="px-4 py-2 font-semibold">{r.pag}</td>
                  <td className="px-4 py-2 text-primary font-medium">{r.mrr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-2.5 bg-muted/50 font-semibold text-sm flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Cenário otimista
          </div>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs">
              <tr><th className="text-left px-4 py-2">Período</th><th className="text-left px-4 py-2">Pagantes</th><th className="text-left px-4 py-2">MRR</th></tr>
            </thead>
            <tbody>
              {otimista.map((r, i) => (
                <tr key={r.m} className={i % 2 ? "bg-muted/20" : ""}>
                  <td className="px-4 py-2">{r.m}</td>
                  <td className="px-4 py-2 font-semibold">{r.pag}</td>
                  <td className="px-4 py-2 text-primary font-medium">{r.mrr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Note tone="win">
        Sua meta de <b>renda complementar (10–20 pagantes)</b> cai no <b>mês 4–6
        no realista</b> e já no <b>mês 3 no otimista</b>. Totalmente factível com
        meio período — desde que o follow-up seja levado a sério.
      </Note>

      <Card className="p-4 text-sm space-y-1">
        <p className="font-semibold">Régua "por unidade" (pra escalar pro tamanho da sua cidade):</p>
        <p className="text-muted-foreground">A cada <b>100 salões abordados</b> → realista ~25 trials → <b>~7–8 pagantes</b>; otimista ~38 trials → <b>~16 pagantes</b>. Multiplique pelo número de salões alcançáveis no seu bairro/cidade.</p>
      </Card>

      <Note tone="warn">
        <b>Quando começar a pagar infra (Vercel/VPS/domínio):</b> quando tiver{" "}
        <b>3–5 pagantes</b> (o MRR já cobre com folga). Antes disso, mantenha
        custo zero. Reinvista em anúncios locais só depois de o porta a porta
        estar previsível e o caixa permitir.
      </Note>
    </div>
  );
}

/* ---------------- 11. Roteiro ---------------- */

function Roteiro() {
  const fases = [
    {
      fase: "Fase 0 — Semana 1",
      titulo: "Preparação (não pule)",
      itens: [
        "Montar o salão-demo no celular (serviços, agenda, comissão).",
        "Fazer cartão simples com nome, WhatsApp e link.",
        "Escolher 1 bairro denso e mapear as ruas com salões.",
        "Decorar o roteiro de visita e definir a oferta de lançamento.",
        "Criar perfil no Instagram e no Google Meu Negócio.",
      ],
    },
    {
      fase: "Fase 1 — Semanas 2 a 4",
      titulo: "Primeiras visitas e ajuste do discurso",
      itens: [
        "3–4 saídas de campo por semana, rua por rua.",
        "Meta: primeiras conversas, demos e os primeiros trials montados na hora.",
        "Anotar toda objeção que aparecer e afinar as respostas.",
        "Acompanhar de perto cada trial (D+1, D+3, D+7, D+12).",
        "Objetivo do mês: 2–4 primeiros pagantes + aprender o que converte.",
      ],
    },
    {
      fase: "Fase 2 — Mês 2",
      titulo: "Prova social e indicação",
      itens: [
        "Gravar depoimento em vídeo do 1º cliente feliz.",
        "Dobrar a aposta no tipo de salão que mais converteu.",
        "Ativar o programa de indicação com cada cliente satisfeito.",
        "Começar a postar 2–3x/semana (dor + depoimento).",
        "Revisar o funil toda sexta e corrigir o ponto que mais vaza.",
      ],
    },
    {
      fase: "Fase 3 — Mês 3 em diante",
      titulo: "Sistematizar e ampliar",
      itens: [
        "Pedir indicação de forma sistemática (vira 30–40% dos novos).",
        "Expandir pro bairro vizinho quando o primeiro estiver coberto.",
        "Com 3–5 pagantes: migrar a infra paga (Vercel Pro, domínio próprio).",
        "Buscar 1–2 parcerias (distribuidora, curso de beleza).",
        "Só então testar um pequeno anúncio local, se o caixa permitir.",
      ],
    },
  ];
  return (
    <div className="space-y-5">
      <SectionHead
        icon={ListChecks}
        title="Roteiro de execução — a ordem certa"
        subtitle="Isto resolve o 'não quero ficar perdido'. Siga as fases na ordem; não pule a preparação nem o follow-up."
      />
      <div className="space-y-4">
        {fases.map((f, i) => (
          <Card key={f.fase} className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="grid place-items-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-display font-bold text-sm shrink-0">
                {i}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{f.fase}</p>
                <p className="font-display font-bold leading-tight">{f.titulo}</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {f.itens.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <Note tone="win">
        <b>Se você fizer só uma coisa certa:</b> montar o salão na hora, de graça,
        e acompanhar o trial na primeira semana. É o que transforma "achei legal"
        em cliente que paga e fica. <ArrowRight className="inline h-4 w-4" /> Volte
        pro <b>Norte</b> sempre que precisar de foco.
      </Note>
    </div>
  );
}
