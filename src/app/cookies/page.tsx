import type { Metadata } from "next";
import { LegalShell, LegalSection } from "@/components/LegalShell";

export const metadata: Metadata = {
  title: "Política de Cookies — AgendeFácil",
  description: "Como o AgendeFácil usa cookies e tecnologias semelhantes.",
};

export default function CookiesPage() {
  return (
    <LegalShell title="Política de Cookies" updatedAt="17 de junho de 2026">
      <p>
        Esta Política explica como o <strong>AgendeFácil</strong> usa cookies e
        tecnologias de armazenamento local no navegador.
      </p>

      <LegalSection heading="1. O que são cookies">
        <p>
          Cookies são pequenos arquivos guardados no seu dispositivo. Também
          usamos <em>local storage</em> do navegador para guardar preferências e
          informações de sessão.
        </p>
      </LegalSection>

      <LegalSection heading="2. Cookies que utilizamos">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Essenciais:</strong> autenticação e sessão (login), sem os
            quais a plataforma não funciona. Inclui os cookies de sessão do
            provedor de autenticação.
          </li>
          <li>
            <strong>Preferências:</strong> dados guardados localmente para
            agilizar o uso, como informações de contato preenchidas no
            agendamento público.
          </li>
        </ul>
        <p>
          No momento <strong>não utilizamos cookies de publicidade nem de
          rastreamento de terceiros</strong> para fins de marketing.
        </p>
      </LegalSection>

      <LegalSection heading="3. Como gerenciar">
        <p>
          Você pode bloquear ou apagar cookies nas configurações do seu
          navegador. Observe que desativar os cookies essenciais impedirá o login
          e o uso do painel.
        </p>
      </LegalSection>

      <LegalSection heading="4. Mais informações">
        <p>
          O tratamento de dados pessoais associado a estas tecnologias está
          descrito na{" "}
          <a href="/privacidade" className="text-primary">
            Política de Privacidade
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
