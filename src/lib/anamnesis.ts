import type { Tables } from "@/lib/database.types";

export type Anamnesis = Tables<"client_anamnesis">;

/** Condições de saúde marcáveis. `critical` entra no alerta de segurança. */
export const HEALTH_CONDITIONS = [
  { key: "is_pregnant", label: "Gestante", critical: true },
  { key: "is_breastfeeding", label: "Lactante", critical: true },
  { key: "has_diabetes", label: "Diabetes", critical: true },
  { key: "has_hypertension", label: "Hipertensão", critical: true },
  { key: "has_heart_condition", label: "Problema cardíaco / marcapasso", critical: true },
  { key: "has_coagulation_issue", label: "Coagulação / anticoagulante", critical: true },
  { key: "has_epilepsy", label: "Epilepsia", critical: true },
  { key: "has_cancer_treatment", label: "Tratamento oncológico", critical: true },
  { key: "has_thyroid", label: "Tireoide", critical: false },
] as const;

export type ConditionKey = (typeof HEALTH_CONDITIONS)[number]["key"];

export type AnamnesisForm = {
  is_pregnant: boolean;
  is_breastfeeding: boolean;
  has_diabetes: boolean;
  has_hypertension: boolean;
  has_heart_condition: boolean;
  has_coagulation_issue: boolean;
  has_epilepsy: boolean;
  has_cancer_treatment: boolean;
  has_thyroid: boolean;
  allergies: string;
  medications: string;
  recent_procedures: string;
  skin_hair_notes: string;
  general_notes: string;
  consent_given: boolean;
  consent_name: string;
};

export const EMPTY_ANAMNESIS: AnamnesisForm = {
  is_pregnant: false,
  is_breastfeeding: false,
  has_diabetes: false,
  has_hypertension: false,
  has_heart_condition: false,
  has_coagulation_issue: false,
  has_epilepsy: false,
  has_cancer_treatment: false,
  has_thyroid: false,
  allergies: "",
  medications: "",
  recent_procedures: "",
  skin_hair_notes: "",
  general_notes: "",
  consent_given: false,
  consent_name: "",
};

/** Monta o resumo de alerta (string curta) ou null se não houver risco. */
export function computeAlertSummary(f: AnamnesisForm): string | null {
  const parts: string[] = [];
  for (const c of HEALTH_CONDITIONS) {
    if (c.critical && f[c.key]) parts.push(c.label);
  }
  if (f.allergies.trim()) parts.push("Alergias");
  return parts.length ? parts.join(" · ") : null;
}

export function anamnesisToForm(a: Anamnesis | null): AnamnesisForm {
  if (!a) return { ...EMPTY_ANAMNESIS };
  return {
    is_pregnant: a.is_pregnant,
    is_breastfeeding: a.is_breastfeeding,
    has_diabetes: a.has_diabetes,
    has_hypertension: a.has_hypertension,
    has_heart_condition: a.has_heart_condition,
    has_coagulation_issue: a.has_coagulation_issue,
    has_epilepsy: a.has_epilepsy,
    has_cancer_treatment: a.has_cancer_treatment,
    has_thyroid: a.has_thyroid,
    allergies: a.allergies ?? "",
    medications: a.medications ?? "",
    recent_procedures: a.recent_procedures ?? "",
    skin_hair_notes: a.skin_hair_notes ?? "",
    general_notes: a.general_notes ?? "",
    consent_given: a.consent_given,
    consent_name: a.consent_name ?? "",
  };
}
