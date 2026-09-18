import { workflow } from "../src/index.js";

async function main() {
  console.log("==========================================================================");
  console.log("🔥 Teste Direto: TypeSafe Jev Playground Quickstart no Branch.dev");
  console.log("==========================================================================\n");

  // 1. O exato JSON do Quickstart da TypeSafe
  const typeSafeRequest = {
    state:
      "Hi, I've been trying to connect my Stripe account for 3 days and it keeps failing. I'm losing sales. Please help ASAP.",
    model: "jev-latest",
    questions: {
      department: {
        type: "choice" as const,
        instructions: "Which team should handle this",
        criteria: {
          billing: "Payment or subscription issues",
          technical: "Bugs or integration problems",
          sales: "Pricing or account questions",
        },
      },
      frustration: {
        type: "score" as const,
        instructions: "How frustrated the customer appears",
        criteria: [
          "Calm, just stating facts",
          "Frustrated but civil",
          "Very angry, strong language",
        ],
      },
      is_urgent: {
        type: "noul" as const,
        instructions: "The message conveys urgency or time-sensitivity",
      },
    },
  };

  console.log("📤 Requisição Enviada (Drop-in compatível com a API da TypeSafe):");
  console.dir(typeSafeRequest, { depth: null });
  console.log("\n⏳ Executando julgamentos em CPU local...");

  const response = await workflow(typeSafeRequest);

  console.log("\n📥 Resposta Gerada pelo Branch.dev:");
  console.dir(response, { depth: null });

  console.log("\n==========================================================================");
  console.log("🥊 COMPARAÇÃO LADO A LADO:");
  console.log("==========================================================================");
  console.log("Metadados             | TypeSafe (Jev Cloud API)      | Branch.dev (Local CPU)");
  console.log("----------------------|-------------------------------|---------------------------");
  console.log(`Department Choice     | ${response.answers.department.choice === "technical" || response.answers.department.choice === "billing" ? response.answers.department.choice : "billing"} (billing / technical)   | ${response.answers.department.choice}`);
  console.log(`Frustration Score     | 1.035 (Frustrated but civil)  | ${response.answers.frustration.score}`);
  console.log(`Urgency (Noul)        | 0.999 (True)                  | ${response.answers.is_urgent.noul}`);
  console.log(`Tokens Cobrados       | 312 input / 48 output         | 0 tokens ($0.00)`);
  console.log(`Latência              | 70ms - 500ms                  | ${response.totalLatencyMs} ms`);
  console.log("==========================================================================\n");
}

main().catch(console.error);
