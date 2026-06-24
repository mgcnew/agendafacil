import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Política de Privacidade — Zulan",
  description:
    "Como o Zulan coleta, usa e protege dados pessoais, em conformidade com a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <LegalShell title="Política de Privacidade" updatedAt="17 de junho de 2026">
      <p>
        Esta Política descreve como o <strong>Zulan</strong>{" "}
        (&quot;nós&quot;, operado por <strong>[RAZÃO SOCIAL]</strong>, CNPJ{" "}
        <strong>[CNPJ]</strong>) trata dados pessoais de quem usa a plataforma,
        em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados
        — LGPD).
      </p>

      <LegalSection heading="1. Quem somos e papéis (LGPD)">
        <p>
          O Zulan é uma plataforma de agendamento usada por salões,
          barbearias e profissionais de estética (&quot;Estabelecimentos&quot;).
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Em relação aos dados <strong>do Estabelecimento e da sua equipe</strong>{" "}
            (cadastro, login, dados de uso), atuamos como{" "}
            <strong>Controlador</strong>.
          </li>
          <li>
            Em relação aos dados <strong>das clientes finais</strong> inseridos
            pelo Estabelecimento (nome, telefone, histórico, anamnese), atuamos
            como <strong>Operador</strong>, tratando os dados em nome e sob
            instrução do Estabelecimento, que é o Controlador desses dados.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. Dados que coletamos">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Cadastro:</strong> nome, e-mail, telefone e senha (armazenada
            de forma criptografada).
          </li>
          <li>
            <strong>Dados do salão:</strong> nome, endereço, serviços, equipe,
            horários, logotipo.
          </li>
          <li>
            <strong>Dados de clientes finais</strong> (inseridos pelo salão):
            nome, telefone, data de nascimento, histórico de atendimentos e
            fichas de anamnese.
          </li>
          <li>
            <strong>Dados financeiros operacionais:</strong> lançamentos de
            caixa, comissões e pagamentos registrados pelo salão.
          </li>
          <li>
            <strong>Dados técnicos:</strong> endereço IP, tipo de dispositivo e
            logs de acesso, para segurança e funcionamento.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Para que usamos os dados">
        <p>
          Tratamos dados para: criar e autenticar contas; operar a agenda,
          caixa, estoque e relatórios; enviar comunicações sobre o serviço;
          prevenir fraudes e abusos; e cumprir obrigações legais. As bases legais
          aplicáveis incluem execução de contrato, legítimo interesse,
          cumprimento de obrigação legal e consentimento, conforme o caso.
        </p>
      </LegalSection>

      <LegalSection heading="4. Compartilhamento">
        <p>
          Não vendemos dados pessoais. Compartilhamos dados apenas com
          provedores de infraestrutura necessários ao funcionamento (por
          exemplo, hospedagem de banco de dados e e-mail transacional), que
          atuam como suboperadores sob obrigações de segurança, e quando exigido
          por lei ou ordem de autoridade competente.
        </p>
      </LegalSection>

      <LegalSection heading="5. Armazenamento e segurança">
        <p>
          Os dados são armazenados em servidores com criptografia em trânsito
          (SSL/TLS) e em repouso, com backups e controle de acesso por papéis. A
          infraestrutura de banco de dados está hospedada na região do Brasil
          (São Paulo).
        </p>
      </LegalSection>

      <LegalSection heading="6. Seus direitos (titular de dados)">
        <p>
          Você pode solicitar acesso, correção, anonimização, portabilidade ou
          exclusão dos seus dados, bem como informações sobre o tratamento.
          Clientes finais devem dirigir suas solicitações ao Estabelecimento
          (Controlador) que cadastrou seus dados; o Zulan dará suporte ao
          Estabelecimento para atendê-las. Solicitações relativas à sua conta de
          usuário do Zulan podem ser enviadas para{" "}
          <a href="mailto:contato@agendefacil.com.br" className="text-primary">
            contato@agendefacil.com.br
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="7. Retenção e exclusão">
        <p>
          Mantemos os dados enquanto a conta estiver ativa e pelo prazo
          necessário para cumprir obrigações legais. Após o encerramento da
          conta, os dados podem ser excluídos ou anonimizados, ressalvadas as
          hipóteses de guarda obrigatória previstas em lei.
        </p>
      </LegalSection>

      <LegalSection heading="8. Alterações">
        <p>
          Podemos atualizar esta Política. Mudanças relevantes serão comunicadas
          pelos canais da plataforma. A data da última atualização consta no topo
          deste documento.
        </p>
      </LegalSection>

      <p className="rounded-[var(--radius)] border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
        <strong>Aviso:</strong> este documento é um modelo inicial e deve ser
        revisado por um(a) advogado(a) antes do uso comercial. Substitua os
        campos entre colchetes ([RAZÃO SOCIAL], [CNPJ], e-mail e endereço) pelos
        dados reais da empresa.
      </p>
    </LegalShell>
  );
}
