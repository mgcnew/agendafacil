import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * O único motivo desta configuração existir é o alias `@/`.
 *
 * Os testes antigos só importavam por caminho relativo, então o vitest rodava
 * sem config nenhuma. Assim que um módulo testado passou a importar outro por
 * `@/lib/...` — como todo o resto do projeto faz — a suíte quebrou na
 * resolução, não no código.
 *
 * Alias declarado à mão em vez de plugin: é uma linha, sem dependência nova, e
 * espelha exatamente o `paths` do tsconfig.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
