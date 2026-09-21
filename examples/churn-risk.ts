import { decide } from "../src/index.js";

// 1. Definição estrita das escolhas usando TypeScript Enum
enum ChurnRisk {
  LOW = "baixo",
  MEDIUM = "medio",
  HIGH = "alto",
}

async function main() {
  console.log("=================================================");
  console.log("🚀 Branch.dev - Exemplo: Predição de Risco de Churn");
  console.log("=================================================\n");

  // 2. Estado do cliente (exatamente o exemplo do artigo)
  const customerState = {
    comprasRealizadas: 3,
    diasDesdeUltimaCompra: 74,
    emailsAbertos: 2,
    reclamacoesAbertas: 1,
    planoAtual: "Premium",
    historicoRecente: "Cliente parou de interagir no app após a reclamação não resolvida",
  };

  console.log("📦 Estado do Cliente de Entrada:");
  console.dir(customerState, { depth: null });
  console.log("\n⏳ Calculando decisão probabilística em CPU local (sem API key, sem tokens)...");

  // 3. Chamada da função decide() com descrições semânticas e tipagem estrita
  const result = await decide<ChurnRisk>({
    state: customerState,
    choices: {
      [ChurnRisk.LOW]: "baixo risco de churn, cliente satisfeito com compras frequentes e engajamento alto",
      [ChurnRisk.MEDIUM]: "risco moderado, cliente estável com histórico mediano de compras",
      [ChurnRisk.HIGH]: "alto risco de churn, cliente inativo há mais de 70 dias, com reclamação aberta e perda de engajamento",
    },
    task: "avaliar probabilidade e risco de churn do cliente",
  });

  // 4. Exibição dos resultados
  console.log("\n✅ Decisão Computada com Sucesso!");
  console.log(`⏱️ Latência da Decisão: ${result.latencyMs} ms`);
  console.log(`🏆 Vencedor: ${result.winner.toUpperCase()}`);
  console.log(`🎯 Confiança Calibrada: ${(result.confidence * 100).toFixed(1)}%`);
  console.log("\n📊 Distribuição Calibrada de Probabilidades:");
  for (const [choice, prob] of Object.entries(result.probabilities)) {
    const bar = "█".repeat(Math.round((prob as number) * 30));
    console.log(`  ${choice.padEnd(8)}: ${(Number(prob) * 100).toFixed(1).padStart(5)}% | ${bar}`);
  }

  // 5. Smart If-Statement: Código determinístico consumindo a probabilidade
  console.log("\n🤖 Execução da Lógica de Negócio (Smart If-Statement):");
  if (result.probabilities[ChurnRisk.HIGH] > 0.60) {
    console.log("👉 [AÇÃO AUTOMÁTICA]: Oferecer cupom de 20% de retenção e acionar gerente de contas.");
  } else if (result.probabilities[ChurnRisk.MEDIUM] > 0.40) {
    console.log("👉 [AÇÃO AUTOMÁTICA]: Enviar e-mail de reengajamento com novidades da plataforma.");
  } else {
    console.log("👉 [AÇÃO AUTOMÁTICA]: Nenhuma ação necessária, cliente saudável.");
  }

  // 6. Teste de segurança de calibração
  console.log(`\n🛡️ Verificação de Segurança (confidence >= 70%): ${result.confidence >= 0.70 && !result.isOOD}`);
}

main().catch(console.error);
