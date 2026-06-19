"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

const ERR_MSG: Record<string, string> = {
  link: "O link de acesso é inválido. Solicite um novo.",
  expirado: "O link expirou ou já foi usado. Tente novamente.",
};

function EntrarForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/painel";
  const erro = params.get("erro");
  const msg = erro ? ERR_MSG[erro] ?? "Não foi possível concluir pelo link." : null;
  return (
    <>
      {msg && (
        <p className="mb-4 rounded-[var(--radius)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
          {msg}
        </p>
      )}
      <LoginForm next={next} />
    </>
  );
}

export default function EntrarPage() {
  return (
    <AuthShell
      title="Bem-vinda de volta"
      subtitle="Acesse o painel do seu salão."
      footer={
        <>
          Ainda não tem salão?{" "}
          <Link href="/criar-salao" className="text-primary font-medium">
            Criar agora
          </Link>
        </>
      }
    >
      <Suspense>
        <EntrarForm />
      </Suspense>
    </AuthShell>
  );
}
