// Conversor de Markdown-lite (o formato usado no textarea do admin) para o
// formato de seções renderizado nas páginas do blog. Suporta apenas o que o
// conteúdo do blog realmente usa: "## " para subtítulo, linha em branco
// separa parágrafo, "- " para item de lista.

export type PostSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
};

export function parsePostBody(body: string): PostSection[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sections: PostSection[] = [];
  let current: PostSection = {};
  let paraBuf: string[] = [];
  let bulletBuf: string[] = [];

  const flushParagraph = () => {
    if (paraBuf.length) {
      current.paragraphs = [...(current.paragraphs ?? []), paraBuf.join(" ").trim()];
      paraBuf = [];
    }
  };
  const flushBullets = () => {
    if (bulletBuf.length) {
      current.bullets = [...(current.bullets ?? []), ...bulletBuf];
      bulletBuf = [];
    }
  };
  const flushSection = () => {
    flushParagraph();
    flushBullets();
    if (current.heading || current.paragraphs?.length || current.bullets?.length) {
      sections.push(current);
    }
    current = {};
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flushSection();
      current.heading = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      bulletBuf.push(line.slice(2).trim());
      continue;
    }
    if (line === "") {
      flushParagraph();
      flushBullets();
      continue;
    }
    flushBullets();
    paraBuf.push(line);
  }
  flushSection();
  return sections;
}
