import { describe, it, expect, beforeAll } from "vitest";
import { configure, boolean, BRANCH_EMBEDDING_MODELS } from "../src/index.js";

describe("⚖️ Boolean Primitive Neutralization & Bias Immunity", () => {
  beforeAll(() => {
    configure({
      modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
      allowFallback: false,
    });
  });

  it("não deve sofrer viés de 'calmo' em fatos afirmativos legítimos", async () => {
    // Cliente extremamente calmo e cortês reportando conta bloqueada
    const res = await boolean({
      state: "Olá, bom dia! Gostaria cordialmente de avisar que minha conta bancária foi bloqueada hoje de manhã.",
      question: "A conta bancária do cliente está bloqueada?",
      affirmativeDescription: "A conta do usuário está bloqueada, suspensa ou com acesso restrito",
      negativeDescription: "A conta do usuário está ativa, desbloqueada ou funcionando normalmente",
    });

    expect(res.value).toBe(true);
    expect(res.probability).toBeGreaterThan(0.50);
  });

  it("não deve sofrer viés de 'urgente' em fatos negativos sem erro", async () => {
    // Tom urgente e alarmista sobre boleto não deve ser classificado como cancelamento
    const res = await boolean({
      state: "URGENTE!!! Preciso da segunda via do boleto para pagar agora de manhã!",
      question: "O cliente está solicitando cancelamento definitivo de contrato?",
      affirmativeDescription: "Cancelamento, encerramento de conta ou rescisão contratual",
      negativeDescription: "Pagamentos, faturas, emissão de boletos ou financeiro",
    });

    expect(res.value).toBe(false);
    expect(res.probability).toBeLessThan(0.50);
  });

  it("deve respeitar descrições afirmativas e negativas customizadas com contraste", async () => {
    const res = await boolean({
      state: {
        perfil: "Empresa corporativa",
        mensagem: "Solicito envio de proposta comercial e orçamento formal para 50 licenças.",
      },
      question: "O lead é qualificado para abordagem comercial?",
      affirmativeDescription: "Lead com perfil corporativo, solicitou orçamento ou demonstrou intenção de compra",
      negativeDescription: "Usuário casual, uso estritamente pessoal sem interesse comercial",
    });

    expect(res.value).toBe(true);
    expect(res.probability).toBeGreaterThan(0.50);
    expect(res.confidence).toBeGreaterThan(0.50);
  });

  it("deve refletir margem contínua em vez de colapsar para 99% em deltas minúsculos", async () => {
    // Entrada ambígua com separação tênue
    const res = await boolean({
      state: "Acho que talvez o serviço esteja um pouco diferente hoje.",
      question: "O cliente confirmou uma falha operacional crítica?",
    });

    // Em K=2, sem o variance floor minStdFloor, isso colapsaria para 98.8%
    // Com regularização, a probabilidade deve ser moderada/incerta
    expect(res.confidence).toBeLessThan(0.95);
  });
});
