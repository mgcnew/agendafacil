import { describe, it, expect } from "vitest";
import { instagramUrl, facebookUrl, googleUrl, socialLinks, hasSocial, instagramHandle } from "./social";

describe("instagramUrl", () => {
  it("aceita as formas que o dono realmente digita", () => {
    for (const entrada of [
      "barbeariamarcos",
      "@barbeariamarcos",
      "instagram.com/barbeariamarcos",
      "www.instagram.com/barbeariamarcos",
      "https://instagram.com/barbeariamarcos",
      "https://www.instagram.com/barbeariamarcos/",
      "  @barbeariamarcos  ",
    ]) {
      expect(instagramUrl(entrada)).toBe("https://instagram.com/barbeariamarcos");
    }
  });

  it("descarta o lixo do botão de compartilhar", () => {
    expect(instagramUrl("https://www.instagram.com/barbeariamarcos/?igsh=MXY5")).toBe(
      "https://instagram.com/barbeariamarcos",
    );
  });

  it("guarda o perfil, não o post", () => {
    expect(instagramUrl("instagram.com/barbeariamarcos/reel/CxYz123/")).toBe(
      "https://instagram.com/barbeariamarcos",
    );
  });

  it("aceita ponto e underline no usuário", () => {
    expect(instagramUrl("@salao.da.ana_")).toBe("https://instagram.com/salao.da.ana_");
  });

  it("recusa o que não é usuário", () => {
    expect(instagramUrl("")).toBeNull();
    expect(instagramUrl("   ")).toBeNull();
    expect(instagramUrl(null)).toBeNull();
    expect(instagramUrl(undefined)).toBeNull();
    expect(instagramUrl("meu salão")).toBeNull();
    expect(instagramUrl("a".repeat(31))).toBeNull();
  });
});

describe("facebookUrl", () => {
  it("normaliza usuário e link", () => {
    for (const entrada of [
      "barbeariamarcos",
      "@barbeariamarcos",
      "facebook.com/barbeariamarcos",
      "fb.com/barbeariamarcos",
      "https://web.facebook.com/barbeariamarcos/",
    ]) {
      expect(facebookUrl(entrada)).toBe("https://facebook.com/barbeariamarcos");
    }
  });

  it("preserva a página antiga sem nome de usuário", () => {
    expect(facebookUrl("https://facebook.com/profile.php?id=100012345678")).toBe(
      "https://facebook.com/profile.php?id=100012345678",
    );
  });

  it("recusa o que não é página", () => {
    expect(facebookUrl("")).toBeNull();
    expect(facebookUrl("minha barbearia no face")).toBeNull();
  });
});

describe("googleUrl", () => {
  it("aceita os formatos que o Google gera", () => {
    expect(googleUrl("https://g.page/barbearia-marcos")).toBe("https://g.page/barbearia-marcos");
    expect(googleUrl("https://maps.app.goo.gl/AbC123")).toBe("https://maps.app.goo.gl/AbC123");
    expect(googleUrl("https://share.google/xYz")).toBe("https://share.google/xYz");
  });

  it("preserva a query, que carrega o id do lugar", () => {
    expect(googleUrl("https://www.google.com/maps/place/Barbearia?entry=ttu")).toBe(
      "https://google.com/maps/place/Barbearia?entry=ttu",
    );
  });

  it("não adivinha: sem link do Google, não há botão", () => {
    expect(googleUrl("Barbearia Marcos")).toBeNull();
    expect(googleUrl("@barbeariamarcos")).toBeNull();
    expect(googleUrl("https://exemplo.com/barbearia")).toBeNull();
    expect(googleUrl("")).toBeNull();
  });
});

describe("socialLinks", () => {
  it("vazio some por completo", () => {
    const links = socialLinks({ instagram: "", facebook: null, google_business: undefined });
    expect(links).toEqual({ instagram: null, facebook: null, google: null });
    expect(hasSocial(links)).toBe(false);
  });

  it("uma rede preenchida já basta pra mostrar o bloco", () => {
    const links = socialLinks({ instagram: "@barbeariamarcos" });
    expect(hasSocial(links)).toBe(true);
    expect(links.facebook).toBeNull();
  });

  it("valor inválido não vira link quebrado", () => {
    const links = socialLinks({ instagram: "meu perfil lá", google_business: "procura no google" });
    expect(hasSocial(links)).toBe(false);
  });
});

describe("instagramHandle", () => {
  it("mostra o que a pessoa reconhece", () => {
    expect(instagramHandle("https://instagram.com/barbeariamarcos")).toBe("@barbeariamarcos");
    expect(instagramHandle(null)).toBeNull();
  });
});
