import { describe, it, expect, beforeAll } from "vitest";
import {
  configure,
  decide,
  workflow,
  BRANCH_EMBEDDING_MODELS,
} from "../src/index.js";

describe("🛡️ OOD Guardrail Validation", () => {
  beforeAll(() => {
    configure({
      modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
      allowFallback: false,
    });
  });

  it("deve detectar entrada totalmente desconexa (papagaio) como OOD", async () => {
    const res = await decide({
      state: "Comprei um papagaio verde e ele não quer comer alpiste na gaiola.",
      task: "Determinar categoria de atendimento",
      choices: {
        faturamento: "Cobranças indevidas, faturas, notas fiscais e reembolsos",
        suporte_tecnico: "Bugs, lentidão e erros no aplicativo",
        comercial: "Planos corporativos e contratação",
      },
    });

    expect(res.isOOD).toBe(true);
    expect(res.actionPolicy).toBe("ESCALATE");
  });

  it("deve detectar lance de futebol como OOD em vez de dar AUTOMATE para cancelamento", async () => {
    const res = await decide({
      state: "O meio-campista do time foi expulso após falta dura perto da área aos 40 do segundo tempo.",
      task: "Determinar categoria de atendimento",
      choices: {
        faturamento: "Cobranças indevidas, faturas, notas fiscais e reembolsos",
        suporte_tecnico: "Bugs, lentidão e erros no aplicativo",
        cancelamento: "Rescisão de contrato, cancelamento definitivo e encerramento de conta",
      },
    });

    expect(res.isOOD).toBe(true);
    expect(res.actionPolicy).toBe("ESCALATE");
    expect(res.actionPolicy).not.toBe("AUTOMATE");
  });

  it("deve manter entradas legítimas in-domain como válidas (isOOD: false)", async () => {
    const res = await decide({
      state: "Não consigo emitir a segunda via do boleto de cobrança que venceu ontem.",
      task: "Determinar categoria de atendimento",
      choices: {
        faturamento: "Cobranças indevidas, faturas, boletos, notas fiscais e reembolsos",
        suporte_tecnico: "Bugs, lentidão e erros no aplicativo",
        comercial: "Planos corporativos e contratação",
      },
    });

    expect(res.isOOD).toBe(false);
    expect(res.winner).toBe("faturamento");
  });
});
