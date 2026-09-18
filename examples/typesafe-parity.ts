import { boolean, score, decide, workflow } from "../src/index.js";

async function main() {
  console.log("==================================================================");
  console.log("⚡ Branch.dev vs TypeSafe System One (Jev) - Paridade Total 100%");
  console.log("==================================================================\n");

  // 1. Estado Completo (exatamente como prescrito na doc da TypeSafe)
  const caseState = {
    mensagemCliente:
      "Fui cobrado duas vezes pelo mesmo pedido #99231! Exijo o estorno imediato do valor duplicado de R$ 189,00 no meu cartão!",
    transacoes: [
      { id: "TX-101", valor: 189.0, data: "2026-09-18 14:02:10", status: "aprovado" },
      { id: "TX-102", valor: 189.0, data: "2026-09-18 14:03:05", status: "aprovado" },
    ],
    politicaEstorno:
      "Estorno automático permitido para cobranças duplicadas com mesmo valor e menos de 10 minutos de intervalo.",
  };

  console.log("📦 Estado do Caso (State Context):");
  console.dir(caseState, { depth: null });
  console.log("\n------------------------------------------------------------------");
  console.log("🧪 Testando as 3 Primitivas Oficiais da TypeSafe no Branch.dev:");
  console.log("------------------------------------------------------------------\n");

  // --- PRIMITIVA 1: NOUL (BOOLEAN PROBABILITY) ---
  console.log("1️⃣ [Primitiva Noul / Boolean]: 'A mensagem solicita estorno ou reembolso?'");
  const refundCheck = await boolean({
    state: caseState,
    question: "O cliente está solicitando estorno, cancelamento de cobrança ou reembolso?",
  });
  console.log(`   Resultado: ${refundCheck.value ? "TRUE" : "FALSE"}`);
  console.log(`   Probabilidade Calibrada (noul): ${refundCheck.probability}`);
  console.log(`   Latência: ${refundCheck.latencyMs} ms\n`);

  // --- PRIMITIVA 2: SCORE (ORDINAL EXPECTED VALUE) ---
  console.log("2️⃣ [Primitiva Score]: 'Quão frustrado está esse cliente? (0=calmo, 1=frustrado, 2=muito frustrado)'");
  const frustrationScore = await score({
    state: caseState,
    question: "Nível de frustração ou irritação manifestado pelo cliente",
    scale: {
      0: "cliente calmo, linguagem neutra ou amigável",
      1: "cliente frustrado ou insatisfeito com o ocorrido",
      2: "cliente extremamente frustrado, agressivo ou exigindo ação imediata",
    },
  });
  console.log(`   Pontuação Contínua (score E[X]): ${frustrationScore.score}`);
  console.log(`   Distribuição: 0: ${(frustrationScore.probabilities[0] * 100).toFixed(1)}% | 1: ${(frustrationScore.probabilities[1] * 100).toFixed(1)}% | 2: ${(frustrationScore.probabilities[2] * 100).toFixed(1)}%`);
  console.log(`   Latência: ${frustrationScore.latencyMs} ms\n`);

  // --- PRIMITIVA 3: CHOICE (CATEGORICAL DECISION) ---
  console.log("3️⃣ [Primitiva Choice]: 'Qual time deve cuidar do caso? (billing, technical, account)'");
  const teamChoice = await decide({
    state: caseState,
    choices: ["billing", "technical", "account"] as const,
    task: "determinar o departamento responsável",
  });
  console.log(`   Time Escolhido (choice): '${teamChoice.winner}'`);
  console.log(`   Confiança: ${(teamChoice.confidence * 100).toFixed(1)}%`);
  console.log(`   Latência: ${teamChoice.latencyMs} ms\n`);

  // --- WORKFLOW MULTI-PERGUNTAS SIMULTÂNEO ---
  console.log("------------------------------------------------------------------");
  console.log("⚡ Executando Workflow Multi-Perguntas (All-in-one Parallel):");
  console.log("------------------------------------------------------------------\n");

  const workflowResult = await workflow({
    state: caseState,
    questions: {
      isRefund: {
        type: "boolean",
        question: "Solicita estorno?",
      },
      hasDuplicateEvidence: {
        type: "boolean",
        question: "As evidências indicam cobrança duplicada com transações idênticas?",
      },
      frustration: {
        type: "score",
        question: "Frustração",
        scale: { 0: "calmo", 1: "irritado", 2: "furioso" },
      },
      team: {
        type: "choice",
        question: "Departamento",
        choices: ["billing", "technical", "account"] as const,
      },
    },
  });

  console.log("📋 Respostas do Workflow em Lote:");
  console.log(`   Total de Perguntas: ${Object.keys(workflowResult.answers).length}`);
  console.log(`   Latência Total Combinada: ${workflowResult.totalLatencyMs} ms`);
  console.log("   Resumo das Saídas:", {
    isRefund: workflowResult.answers.isRefund.value,
    hasDuplicateEvidence: workflowResult.answers.hasDuplicateEvidence.value,
    frustrationScore: workflowResult.answers.frustration.score,
    team: workflowResult.answers.team.choice,
  });

  // --- FLUXO DE DECISÃO DETERMINÍSTICO NO CÓDIGO ---
  console.log("\n🤖 Executando Lógica de Negócio do Software:");
  const answers = workflowResult.answers;
  if (answers.isRefund.probability > 0.80 && answers.hasDuplicateEvidence.probability > 0.80) {
    console.log("✅ [AUTOMAÇÃO 100%]: Estorno de R$ 189,00 APROVADO AUTOMATICAMENTE conforme política.");
  }

  if (answers.frustration.score >= 1.2) {
    console.log("⚠️ [ALERTA DE PRIORIDADE]: Cliente com alta frustração detectada (" + answers.frustration.score + "). Notificando gestor de atendimento.");
  }
}

main().catch(console.error);
