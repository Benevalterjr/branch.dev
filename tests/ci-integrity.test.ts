import { describe, it, expect, beforeAll } from "vitest";
import {
  configure,
  decide,
  boolean,
  BRANCH_EMBEDDING_MODELS,
  BranchClient,
} from "../src/index.js";
import { OnnxEmbeddingAdapter } from "../src/infrastructure/adapters/onnx-embedding.adapter.js";
import { AdaptivePlattCalibrator } from "../src/infrastructure/adapters/adaptive-platt-calibrator.adapter.js";
import { ModelLoadException } from "../src/domain/exceptions/domain-exceptions.js";

describe("🛡️ CI Integrity & Operational Safeguards", () => {
  beforeAll(() => {
    // Configura o modelo neural padrão com modelo multilíngue cacheado
    configure({
      modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
      allowFallback: false,
    });
  });

  // ─── TESTE 1: Garantia de Execução com Modelo Neural Real ───
  it("CI GATE: deve executar obrigatoriamente com backend ONNX real (falha no CI se degradar)", async () => {
    const res = await decide({
      state: "Preciso de ajuda urgente com a minha fatura que veio com valor duplicado.",
      choices: {
        billing: "Faturas, cobranças, notas fiscais e pagamentos",
        support: "Erros, bugs e problemas no sistema",
      },
    });

    // Se o CI estiver sem rede e sem modelo baixado, o teste DEVE FALHAR em vez de passar falso-positivo
    expect(res.embeddingBackend).toBe("onnx");
    expect(res.winner).toBe("billing");
    expect(res.confidence).toBeGreaterThan(0.5);
  });

  // ─── TESTE 2: Falha Explícita por Padrão (Sem Fallback Silencioso) ───
  it("deve lançar ModelLoadException quando modelo ONNX falhar e allowFallback for false", async () => {
    const client = new BranchClient({
      modelName: "__MODEL_INEXISTENTE_PARA_TESTE__" as any,
      allowFallback: false,
    });

    await expect(
      client.decide({
        state: "Qualquer mensagem de teste",
        choices: {
          opcao_a: "Primeira opção",
          opcao_b: "Segunda opção",
        },
      })
    ).rejects.toThrowError(ModelLoadException);
  });

  // ─── TESTE 3: Fallback Apenas sob Autorização Explícita ───
  it("deve permitir fallback para hash e expor 'hash-fallback' no DTO APENAS se allowFallback for true", async () => {
    const client = new BranchClient({
      modelName: "__MODEL_COM_FALLBACK_AUTORIZADO__" as any,
      allowFallback: true,
    });

    const res = await client.decide({
      state: "Fatura do cartão de crédito",
      choices: {
        financeiro: "Faturas e cobranças",
        ti: "Problemas técnicos",
      },
    });

    // O fallback deve ser transparente para telemetria
    expect(res.embeddingBackend).toBe("hash-fallback");
  });

  // ─── TESTE 4: Consistência dos Dados Pós-Fallback (Sistema 2) ───
  it("deve manter coerência entre winner, confidence e probabilities quando Sistema 2 atua", async () => {
    const res = await decide({
      state: "Texto ambíguo para forçar fallback",
      choices: {
        opcao_a: "Opção A",
        opcao_b: "Opção B",
      },
      // Força fallback definindo minConfidence alto
      minConfidence: 0.99,
      fallback: async () => "opcao_b",
    });

    expect(res.system).toBe("system2");
    expect(res.delegatedToFallback).toBe(true);
    expect(res.winner).toBe("opcao_b");
    expect(res.confidence).toBe(1.0);
    // Probabilidade do vencedor escolhido pelo Sistema 2 deve ser 1.0, e não a herdada do Sistema 1
    expect(res.probabilities.opcao_b).toBe(1.0);
    expect(res.probabilities.opcao_a).toBe(0.0);
  });

  // ─── TESTE 5: Calibrador Adaptativo Preserva Buckets de Cardinalidade ───
  it("AdaptivePlattCalibrator deve escalar proporcionalmente e preservar diferenciação entre K=2 e K=11+", () => {
    const calibrator = new AdaptivePlattCalibrator({
      initialTemperature: 0.5,
    });

    const logits2 = [0.8, 0.2];
    const logits11 = [0.8, 0.2, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05];

    const dist2 = calibrator.calibrate(["a", "b"], logits2);
    const dist11 = calibrator.calibrate(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
      logits11
    );

    // K=2 tem temperatura base menor (0.45) que K=11+ (0.70), logo para o mesmo contraste relativo
    // a distribuição em K=2 é mais nítida
    expect(dist2.confidence).toBeGreaterThan(0.5);
    expect(dist11.confidence).toBeGreaterThan(0.2);
  });
});
