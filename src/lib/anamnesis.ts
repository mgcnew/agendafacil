import type { Tables, Enums } from "@/lib/database.types";

export type Anamnesis = Tables<"client_anamnesis">;
export type Niche = Enums<"salon_niche">;

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

/* ─────────────────────────────────────────────────────────────────────────
 * Ficha por nicho. As COLUNAS do banco são as mesmas; o que muda é quais
 * condições mostrar e os rótulos/exemplos dos campos de texto. Assim a
 * barbearia tem uma ficha própria (pele/barba, cortes de navalha) sem migração.
 * ──────────────────────────────────────────────────────────────────────── */

export type ConditionDef = { key: ConditionKey; label: string; critical: boolean };
export type TextFieldKey =
  | "allergies" | "medications" | "recent_procedures" | "skin_hair_notes" | "general_notes";
export type TextFieldDef = { key: TextFieldKey; label: string; placeholder: string };
export type AnamnesisConfig = {
  conditions: ConditionDef[];
  textFields: TextFieldDef[];
};

const BY_KEY: Record<ConditionKey, ConditionDef> = Object.fromEntries(
  HEALTH_CONDITIONS.map((c) => [c.key, { key: c.key, label: c.label, critical: c.critical }]),
) as Record<ConditionKey, ConditionDef>;

const pick = (keys: ConditionKey[]): ConditionDef[] => keys.map((k) => BY_KEY[k]);

// Salão/estética/neutro: ficha completa (foco em química, pele, unhas).
const DEFAULT_TEXT: TextFieldDef[] = [
  { key: "allergies", label: "Alergias e sensibilidades", placeholder: "Amônia, henna, látex, esmalte, anestésico, níquel..." },
  { key: "medications", label: "Medicamentos em uso", placeholder: "Ex.: anticoagulante, isotretinoína (Roacutan)..." },
  { key: "recent_procedures", label: "Procedimentos / cirurgias recentes", placeholder: "Botox, preenchimento, peeling, cirurgia..." },
  { key: "skin_hair_notes", label: "Histórico de pele / cabelo / unhas", placeholder: "Química recente, dermatite, lesão ativa, micose..." },
  { key: "general_notes", label: "Outras observações de saúde", placeholder: "" },
];

// Barbearia: foco em pele e barba e em cortes de navalha (sangramento/cicatrização).
const BARBER_TEXT: TextFieldDef[] = [
  { key: "allergies", label: "Alergias e sensibilidades", placeholder: "Lâmina/navalha, produtos, perfume, níquel, propilenoglicol..." },
  { key: "medications", label: "Medicamentos em uso", placeholder: "Ex.: anticoagulante, isotretinoína (Roacutan)..." },
  { key: "skin_hair_notes", label: "Pele e barba", placeholder: "Pelos encravados, foliculite, dermatite, acne, sensibilidade, lesão ativa..." },
  { key: "recent_procedures", label: "Procedimentos recentes na pele/barba", placeholder: "Laser, tatuagem recente, cicatriz, peeling..." },
  { key: "general_notes", label: "Outras observações", placeholder: "" },
];

const BARBER_CONDITIONS: ConditionKey[] = [
  "has_diabetes",          // cicatrização/infecção em cortes
  "has_coagulation_issue", // sangramento na navalha
  "has_hypertension",
  "has_heart_condition",
  "has_epilepsy",
  "has_thyroid",
  "has_cancer_treatment",
];

/** Configuração da ficha conforme o nicho do salão. */
export function getAnamnesisConfig(niche: Niche): AnamnesisConfig {
  if (niche === "barbearia") {
    return { conditions: pick(BARBER_CONDITIONS), textFields: BARBER_TEXT };
  }
  return {
    conditions: HEALTH_CONDITIONS.map((c) => ({ key: c.key, label: c.label, critical: c.critical })),
    textFields: DEFAULT_TEXT,
  };
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
