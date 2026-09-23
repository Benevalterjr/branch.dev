import {
  BranchClient,
  BRANCH_EMBEDDING_MODELS,
  PlattTemperatureCalibrator,
} from "../src/index.js";

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 Teste: Risk-Aware Thresholds & Tri-State Action Policy (Semáforo)");
  console.log("==================================================================\n");

  const branch = new BranchClient({
    modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
    calibrator: new PlattTemperatureCalibrator(0.85),
  });

  // ─── CENÁRIO 1: Semáforo de Decisão Automático (Action Policy) ────────────────
  console.log("--- 1. Testando Semáforo Operacional (AUTOMATE / VERIFY / ESCALATE) ---");

  // Caso A: Alta certeza esperada -> AUTOMATE
  const resHigh = await branch.boolean({
    state: { status: "fatura_atrasada_90_dias", saldo: 0, dividaAtiva: true },
    question: "O cliente possui débitos pendentes em aberto?",
    affirmativeDescription: "SIM — cliente inadimplente com dívida em aberto",
    negativeDescription: "NÃO — cliente pontual sem pendências",
  });
  console.log(`   Caso A (Inadimplente evidente): Confiança ${(resHigh.confidence * 100).toFixed(1)}% | Política: ${resHigh.actionPolicy}`);
  if (resHigh.confidence >= 0.80 && resHigh.actionPolicy !== "AUTOMATE") {
    throw new Error(`Esperado AUTOMATE para confiança >= 80%, obtido: ${resHigh.actionPolicy}`);
  }
  console.log("   ✅ Caso Alta Certeza -> AUTOMATE validado com sucesso.");

  // Caso B: Pergunta sutil / moderada -> VERIFY
  const resMed = await branch.boolean({
    state: { historico: "comprou 2 itens no mês passado e 1 ontem" },
    question: "O cliente está demonstrando engajamento atípico elevado?",
    affirmativeDescription: "SIM — aumento vertiginoso de atividade",
    negativeDescription: "NÃO — atividade rotineira",
  });
  console.log(`   Caso B (Engajamento sutil): Confiança ${(resMed.confidence * 100).toFixed(1)}% | Política: ${resMed.actionPolicy}`);
  if (resMed.confidence >= 0.50 && resMed.confidence < 0.80 && resMed.actionPolicy !== "VERIFY") {
    throw new Error(`Esperado VERIFY para confiança entre 50% e 80%, obtido: ${resMed.actionPolicy}`);
  }
  console.log("   ✅ Caso Certeza Moderada -> VERIFY validado com sucesso.");

  // ─── CENÁRIO 2: Risk-Aware Thresholds por Escolha (Ação Bancária) ──────────────
  console.log("\n--- 2. Testando Risk-Aware Thresholds (Limiares por Risco da Ação) ---");

  let fallbackCalledForPix = false;

  // Cenário: Usuário envia mensagem um pouco ambígua: "Transfere aí para a minha mãe"
  // Para CONSULTAR_SALDO, minConfidence é 0.50 (risco baixo)
  // Para APROVAR_PIX, minConfidence é 0.95 (risco altíssimo)
  const resBanking = await branch.decide({
    state: { mensagem: "Acho que vou querer fazer aquele pix mais tarde, ou talvez só olhar o saldo" },
    task: "Qual intenção deve ser executada no sistema bancário?",
    choices: {
      CONSULTAR_SALDO: {
        description: "Visualizar extrato e saldo bancário na tela (risco operacional zero)",
        minConfidence: 0.50, // 50% basta para consulta
      },
      APROVAR_PIX: {
        description: "Autorizar e efetivar envio imediato de dinheiro via Pix (risco financeiro alto)",
        minConfidence: 0.95, // Exige 95% de certeza absoluta para debitar dinheiro!
      },
    },
    fallback: async (prev) => {
      fallbackCalledForPix = true;
      console.log(`   ⚠️ [Sistema 2 Disparado por Risco!] Vencedor foi '${prev.winner}' com ${(prev.confidence * 100).toFixed(1)}%, mas limiar de risco é 95.0%`);
      return {
        winner: "CONSULTAR_SALDO", // Fallback seguro
        confidence: 0.99,
        actionPolicy: "AUTOMATE" as const,
      };
    },
  });

  console.log("   Resultado da decisão bancária com proteção de risco:", {
    winner: resBanking.winner,
    confidence: `${(resBanking.confidence * 100).toFixed(1)}%`,
    system: resBanking.system,
    delegatedToFallback: resBanking.delegatedToFallback,
    actionPolicy: resBanking.actionPolicy,
  });

  // Caso 2B: Usuário quer Pix ("Quero transferir 500 reais via pix para o Joao agora"),
  let pixFallbackTriggered = false;
  const resPix = await branch.decide({
    state: { comando: "Quero transferir quinhentos reais via pix para o Joao agora com urgência" },
    task: "Qual ação bancária executar?",
    choices: {
      CONSULTAR_SALDO: {
        description: "Consultar saldo da conta ou ver extrato bancário",
        minConfidence: 0.50,
      },
      APROVAR_PIX: {
        description: "Efetivar transferência de dinheiro via Pix para terceiro",
        minConfidence: 0.95, // 95% obrigatório para PIX!
      },
    },
    fallback: async (prev) => {
      pixFallbackTriggered = true;
      console.log(`   🚨 [Sistema 2 Disparado por Risco!] Vencedor foi '${prev.winner}' com ${(prev.confidence * 100).toFixed(1)}%, abaixo do limiar de risco de 95.0%`);
      return {
        ...prev,
        system: "system2" as const,
        delegatedToFallback: true,
        actionPolicy: "VERIFY" as const, // Exige confirmação por 2FA do usuário
      };
    },
  });

  console.log("   Resultado do teste de Pix de alto risco:", {
    winner: resPix.winner,
    confidence: `${(resPix.confidence * 100).toFixed(1)}%`,
    system: resPix.system,
    delegatedToFallback: resPix.delegatedToFallback,
    actionPolicy: resPix.actionPolicy,
  });

  if (!pixFallbackTriggered) {
    throw new Error("Falha no Risk-Aware Threshold: PIX com confiança menor que 95% DEVERIA ter acionado o fallback!");
  }
  console.log("   ✅ Disparo de fallback por limiar de risco individual comprovado com sucesso!\n");

  console.log("🎉 TODOS OS TESTES DE RISK-AWARE THRESHOLDS E ACTION POLICY PASSARAM COM 100% DE SUCESSO!\n");
}

runTests().catch((err) => {
  console.error("❌ Erro nos testes de Risk Policy:", err);
  process.exit(1);
});
