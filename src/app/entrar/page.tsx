"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

function EntrarForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/painel";
  return <LoginForm next={next} />;
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
