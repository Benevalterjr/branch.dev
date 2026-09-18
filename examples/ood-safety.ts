import { workflow, decide } from "../src/index.js";

async function main() {
  console.log("==========================================================================");
  console.log("🛡️ Branch.dev: Salvaguarda Out-of-Distribution (OOD) e Mapped Types");
  console.log("==========================================================================\n");

  const Departments = ["faturamento", "suporte_tecnico", "comercial"] as const;

  // --------------------------------------------------------------------------
  // CENÁRIO 1: Entrada Legítima (In-Distribution)
  // --------------------------------------------------------------------------
  console.log("1️⃣ [CENÁRIO 1: ENTRADA DENTRO DO ESCOPO]");
  const legitimateState = {
    mensagem: "Meu pagamento da fatura falhou e o cartão foi recusado duas vezes.",
  };
  console.log("📩 Mensagem:", legitimateState.mensagem);

  const legitimateResult = await workflow({
    state: legitimateState,
    questions: {
      dept: {
        type: "choice",
        choices: Departments,
        instructions: "Determinar o departamento correto",
      },
      isUrgent: {
        type: "noul",
        instructions: "O problema requer ação imediata?",
      },
    },
  });

  // Observe o Autocomplete do TypeScript aqui:
  // legitimateResult.answers.dept.choice é tipado como "faturamento" | "suporte_tecnico" | "comercial"
  const legitDept = legitimateResult.answers.dept;
  console.log(`   Departamento: ${legitDept.choice}`);
  console.log(`   Confiança: ${(legitDept.confidence * 100).toFixed(1)}%`);
  console.log(`   isOOD (Fora de Escopo?): ${legitDept.isOOD ? "SIM ⚠️" : "NÃO ✅"}`);
  console.log(`   isUrgent: ${legitimateResult.answers.isUrgent.value} (${(legitimateResult.answers.isUrgent.probability * 100).toFixed(1)}%)\n`);

  // --------------------------------------------------------------------------
  // CENÁRIO 2: Entrada Desconexa / Absurda (Out-of-Distribution)
  // --------------------------------------------------------------------------
  console.log("2️⃣ [CENÁRIO 2: ENTRADA FORA DO ESCOPO (OOD)]");
  const absurdState = {
    mensagem: "Comprei um papagaio verde e ele não quer comer alpiste na gaiola.",
  };
  console.log("📩 Mensagem:", absurdState.mensagem);

  const oodResult = await workflow({
    state: absurdState,
    questions: {
      dept: {
        type: "choice",
        choices: Departments,
        instructions: "Determinar o departamento correto",
      },
      isUrgent: {
        type: "noul",
        instructions: "O problema requer ação imediata?",
      },
    },
  });

  const oodDept = oodResult.answers.dept;
  console.log(`   Opção mais próxima sugerida: ${oodDept.choice}`);
  console.log(`   Confiança Calibrada: ${oodDept.confidence} (Anulada automaticamente para 0)`);
  console.log(`   isOOD Detectado: ${oodDept.isOOD ? "SIM 🚨 (ENTRADA FORA DO DOMÍNIO)" : "NÃO"}`);

  // --------------------------------------------------------------------------
  // SEGURANÇA DETERMINÍSTICA NO CÓDIGO
  // --------------------------------------------------------------------------
  console.log("\n🤖 Lógica de Negócio com a Salvaguarda OOD:");
  if (oodDept.isOOD) {
    console.log("👉 [AÇÃO DE SEGURANÇA]: A mensagem foi identificada como FORA DO DOMÍNIO do sistema.");
    console.log("   O sistema NÃO cometeu a gafe de rotear para o Financeiro/TI.");
    console.log("   Encaminhado para a fila de Triagem Manual / Resposta Padrão.");
  } else {
    console.log(`👉 [AÇÃO AUTOMÁTICA]: Encaminhado para a fila de ${oodDept.choice}.`);
  }

  // Demonstração direta do decide() com assertConfidence
  console.log("\n3️⃣ [TESTE DE ASSERT CONFIDENCE EM ENTRADA OOD]:");
  try {
    const singleDecision = await decide({
      state: absurdState,
      choices: Departments,
      task: "departamento responsável",
    });
    singleDecision.assertConfidence(0.70);
  } catch (err) {
    console.log(`🛡️ Bloqueio com Sucesso via Exceção de Domínio: ${(err as Error).message}`);
  }
}

main().catch(console.error);
