"use server";

import { createClient } from "@/lib/supabase/server";
import { CONSENT_RECORD, isValidEmail, isValidPhone } from "@/lib/demoLead";

export type CaptureLeadResult = { ok: boolean; message?: string };

/**
 * Grava o lead do demo (nome/e-mail/WhatsApp) e o aceite de marketing.
 *
 * O aceite é opcional de propósito: `accepts` false grava o lead do mesmo
 * jeito e a pessoa ganha o teste igual. Condicionar o prêmio ao aceite
 * invalidaria o consentimento — é justamente o risco que se quer evitar.
 *
 * A permissão real mora na RPC (SECURITY DEFINER, só quem está num salão
 * demo pode chamar); aqui só validamos o formato antes de bater no banco.
 */
export async function captureDemoLeadAction(
  name: string,
  email: string,
  phone: string,
  accepts: boolean,
): Promise<CaptureLeadResult> {
  if (!name.trim()) return { ok: false, message: "Como podemos te chamar?" };
  if (!isValidEmail(email)) return { ok: false, message: "Confira o e-mail." };
  if (!isValidPhone(phone)) return { ok: false, message: "Confira o WhatsApp com DDD." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("capture_demo_lead" as never, {
    p_name: name,
    p_email: email,
    p_contact: phone,
    p_accepts_marketing: accepts,
    p_consent_text: CONSENT_RECORD,
  } as never);

  if (error) {
    return { ok: false, message: "Não consegui salvar agora. Tenta de novo?" };
  }
  return { ok: true };
}
