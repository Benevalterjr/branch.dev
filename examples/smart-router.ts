import { decide } from "../src/index.js";

const Departments = [
  "faturamento_e_cobranca",
  "suporte_tecnico_bugs",
  "solicitacao_de_funcionalidade",
  "cancelamento_de_conta",
] as const;

type Department = (typeof Departments)[number];

async function main() {
  console.log("=================================================");
  console.log("⚡ Branch.dev - Exemplo: Roteador de Atendimento");
  console.log("=================================================\n");

  const incomingTicket = {
    assunto: "Cobrança duplicada no cartão",
    mensagem: "Olá, notei que a minha fatura deste mês veio cobrada duas vezes no meu cartão Master. Podem estornar?",
    prioridadeSugerida: "urgente",
  };

  console.log("📩 Ticket Recebido:");
  console.dir(incomingTicket);

  const decision = await decide<Department>({
    state: incomingTicket,
    choices: Departments,
    task: "determinar o departamento correto para encaminhar a solicitação",
  });

  console.log(`\n🎯 Departamento Destino: ${decision.winner}`);
  console.log(`🔒 Confiança: ${(decision.confidence * 100).toFixed(1)}%`);
  console.log(`⏱️ Latência: ${decision.latencyMs} ms`);

  console.log("\n📊 Distribuição:");
  for (const [dept, prob] of Object.entries(decision.probabilities)) {
    console.log(`  - ${dept}: ${(Number(prob) * 100).toFixed(1)}%`);
  }

  // Branching no código
  switch (decision.winner) {
    case "faturamento_e_cobranca":
      console.log("\n➡️ [ROTEAMENTO]: Encaminhado para a fila prioritária do Financeiro.");
      break;
    case "cancelamento_de_conta":
      console.log("\n➡️ [ROTEAMENTO]: Encaminhado para o time de Retenção.");
      break;
    default:
      console.log("\n➡️ [ROTEAMENTO]: Encaminhado para a fila geral de Suporte.");
  }
}

main().catch(console.error);
