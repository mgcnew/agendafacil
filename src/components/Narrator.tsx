import { Card } from "@/components/ui";
import { Flame, Sparkle } from "@phosphor-icons/react/dist/ssr";

/**
 * Card "funcionário narrando": frases em linguagem natural sobre os dados da
 * tela, nunca uma ação autônoma — só fala e, quando cabe, o próprio conteúdo
 * já linka pra uma ação existente. Usado em Relatórios e Caixa & Comissões.
 */
export function Narrator({ lines, alert }: { lines: string[]; alert?: string }) {
  if (lines.length === 0 && !alert) return null;
  return (
    <Card className="p-4 min-w-0 border-primary/25 bg-primary/[0.03]">
      <div className="flex items-start gap-2.5">
        <Sparkle className="h-4.5 w-4.5 shrink-0 text-primary mt-0.5" />
        <div className="space-y-1.5 text-sm">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
          {alert && (
            <p className="flex items-start gap-1.5 text-amber-700">
              <Flame className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{alert}</span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export const narratorPct = (n: number) => `${n >= 0 ? "" : "-"}${Math.abs(Math.round(n))}%`;
