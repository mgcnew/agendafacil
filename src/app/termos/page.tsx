import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Termos de Uso — AgendeFácil",
  description: "Termos e condições de uso da plataforma AgendeFácil.",
};

export default function TermosPage() {
  return (
    <LegalShell title="Termos de Uso" updatedAt="17 de junho de 2026">
      <p>
        Estes Termos regem o uso da plataforma <strong>AgendeFácil</strong>,
        operada por <strong>[RAZÃO SOCIAL]</strong>, CNPJ <strong>[CNPJ]</strong>{" "}
        (&quot;nós&quot;). Ao criar uma conta ou usar a plataforma, você
        (&quot;Estabelecimento&quot; ou &quot;Usuário&quot;) concorda com estes
        Termos.
      </p>

      <LegalSection heading="1. O serviço">
        <p>
          O AgendeFácil oferece ferramentas de agendamento, gestão de equipe,
          comissões, caixa, estoque, campanhas e relatórios para salões,
          barbearias e profissionais de estética, disponibilizadas via web.
        </p>
      </LegalSection>

      <LegalSection heading="2. Conta e responsabilidades do Usuário">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Você é responsável por manter a confidencialidade das credenciais de
            acesso e por toda atividade realizada na sua conta.
          </li>
          <li>
            Você declara que os dados de clientes finais inseridos foram obtidos
            de forma lícita e que possui base legal para tratá-los, atuando como
            Controlador desses dados nos termos da LGPD.
          </li>
          <li>
            É vedado usar a plataforma para fins ilícitos, enviar conteúdo
            indevido ou tentar comprometer a segurança do sistema.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Planos, período de teste e pagamento">
        <p>
          A plataforma pode ser oferecida com período de teste gratuito e planos
          pagos por assinatura. Valores, forma e periodicidade de cobrança serão
          informados no momento da contratação. A assinatura pode ser cancelada a
          qualquer momento, sem multa; o acesso permanece até o fim do período já
          pago. A falta de pagamento pode resultar na suspensão do acesso.
        </p>
      </LegalSection>

      <LegalSection heading="4. Disponibilidade">
        <p>
          Empregamos esforços para manter a plataforma disponível, mas o serviço
          é fornecido &quot;no estado em que se encontra&quot;, podendo haver
          interrupções para manutenção ou por fatores externos. Não garantimos
          disponibilidade ininterrupta.
        </p>
      </LegalSection>

      <LegalSection heading="5. Propriedade intelectual">
        <p>
          O software, marca e materiais do AgendeFácil são de nossa titularidade.
          Os dados inseridos pelo Estabelecimento permanecem de sua propriedade;
          concedemos a você uma licença de uso da plataforma, não exclusiva e
          intransferível, enquanto durar a contratação.
        </p>
      </LegalSection>

      <LegalSection heading="6. Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida em lei, não nos responsabilizamos por
          lucros cessantes ou danos indiretos decorrentes do uso ou da
          impossibilidade de uso da plataforma. Você é o único responsável pela
          relação com suas clientes e pela exatidão dos dados que registra.
        </p>
      </LegalSection>

      <LegalSection heading="7. Encerramento">
        <p>
          Você pode encerrar sua conta a qualquer momento. Podemos suspender ou
          encerrar contas que violem estes Termos. Após o encerramento, os dados
          serão tratados conforme a{" "}
          <a href="/privacidade" className="text-primary">
            Política de Privacidade
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="8. Lei aplicável e foro">
        <p>
          Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da
          comarca de <strong>[CIDADE/UF]</strong> para dirimir controvérsias,
          salvo disposição legal em contrário.
        </p>
      </LegalSection>

      <p className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
        <strong>Aviso:</strong> este documento é um modelo inicial e deve ser
        revisado por um(a) advogado(a) antes do uso comercial. Substitua os
        campos entre colchetes pelos dados reais da empresa.
      </p>
    </LegalShell>
  );
}
