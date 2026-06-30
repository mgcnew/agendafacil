import OpenAI from "openai";

// DeepSeek expõe uma API compatível com a da OpenAI — mesmo SDK, baseURL diferente.
// https://api-docs.deepseek.com/
const MODEL = "deepseek-chat";

let client: OpenAI | null = null;

/** Retorna o client DeepSeek, ou null se a chave não estiver configurada (modo stub). */
export function getDeepSeekClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new OpenAI({ apiKey, baseURL: "https://api.deepseek.com" });
  }
  return client;
}

export const DEEPSEEK_MODEL = MODEL;
