import {
  BranchClient,
  BRANCH_EMBEDDING_MODELS,
  systemOne,
  evaluateAll,
  decide,
  boolean,
  score,
} from "../src/index.js";

async function main() {
  console.log("==================================================================");
  console.log("🧪 Teste: Metacognição, System 1 ➔ System 2 Fallback & systemOne()");
  console.log("==================================================================");

  // 1. Teste de Fallback direto no decide() com entrada OOD ou incerteza
  console.log("\n--- 1. Teste de Fallback no decide() com fallback assíncrono (LLM mock) ---");

  // Entrada semântica ambígua/fora de contexto proposital para acionar incerteza
  const obscureTicket = {
    assunto: "quantum flux fluctuating on sub-ether relay 42",
    gravidade: "desconhecida",
  };

  let fallbackInvoked = false;

  const decision = await decide({
    state: obscureTicket,
    choices: {
      billing: "Dúvidas financeiras e estornos de fatura",
      support: "Problemas com login de senha e acesso ao portal",
    },
    confidenceThreshold: 0.85, // Limiar alto: se confiança < 85%, aciona Sistema 2
    fallback: async (prev) => {
      fallbackInvoked = true;
      console.log(`   [Sistema 2 Acionado!] Confiança Sistema 1 foi ${(prev.confidence * 100).toFixed(1)}% (limiar 85%)`);
      return {
        winner: "support" as const,
        confidence: 0.99,
      };
    },
  });

  console.log("   Vencedor:", decision.winner);
  console.log("   Sistema:", decision.system);
  console.log("   Delegado para Fallback:", decision.delegatedToFallback);
  console.log("   Act Probability:", decision.actProbability);

  if (!fallbackInvoked || decision.system !== "system2" || !decision.delegatedToFallback) {
    throw new Error("Falha no teste: Fallback do decide() não foi acionado!");
  }
  console.log("   ✅ Fallback do decide() validado com sucesso!");

  // 2. Teste de Workflow com systemOne() e Fallback por pergunta
  console.log("\n--- 2. Teste de Workflow multi-perguntas com systemOne() e Fallback ---");

  const clienteState = {
    mensagem: "O sistema apresentou erro 500 ao tentar gerar a nota fiscal da fatura.",
    codigoErro: 500,
  };

  let questionFallbackInvoked = false;

  const res = await systemOne(clienteState, {
    // Pergunta 1: Avaliação clara (deve rodar via Sistema 1)
    isTechnicalError: {
      type: "boolean",
      instructions: "Trata-se de um erro técnico de software ou servidor?",
    },
    // Pergunta 2: Score contínuo
    severidade: {
      type: "score",
      instructions: "Qual o nível de severidade do incidente?",
      criteria: {
        0: "Baixa - dúvida simples",
        1: "Média - lentidão passageira",
        2: "Alta - erro 500 ou indisponibilidade crítica",
      },
    },
    // Pergunta 3: Choice com fallback configurado para limiar impossível (> 99.9%)
    roteamento: {
      type: "choice",
      instructions: "Para qual time direcionar?",
      choices: ["billing", "engineering", "sales"] as const,
      confidenceThreshold: 0.999, // Força acionamento do fallback
      fallback: async (ans) => {
        questionFallbackInvoked = true;
        console.log(`   [Sistema 2 Acionado na pergunta 'roteamento'!]: Confiança Sistema 1 foi ${(ans.confidence * 100).toFixed(1)}%`);
        return "engineering";
      },
    },
  });

  console.log("\n   📊 Respostas do systemOne():");
  console.log("   - isTechnicalError:", res.answers.isTechnicalError.value, `(Sistema: ${res.answers.isTechnicalError.system})`);
  console.log("   - severidade:", res.answers.severidade.score.toFixed(2), `(Sistema: ${res.answers.severidade.system})`);
  console.log("   - roteamento:", res.answers.roteamento.choice, `(Sistema: ${res.answers.roteamento.system}, Fallback: ${res.answers.roteamento.delegatedToFallback})`);
  console.log("   - Latência Total:", res.totalLatencyMs, "ms");
  console.log("   - Sistema Geral do Workflow:", res.system);

  if (!questionFallbackInvoked) {
    throw new Error("Falha no teste: Fallback na pergunta do workflow não foi acionado!");
  }
  if (res.answers.isTechnicalError.system !== "system1") {
    throw new Error("isTechnicalError deveria ter sido resolvido pelo Sistema 1");
  }
  if (res.answers.roteamento.system !== "system2") {
    throw new Error("roteamento deveria ter sido resolvido pelo Sistema 2");
  }
  if (res.system !== "system2") {
    throw new Error("Workflow geral deveria indicar system: system2");
  }

  console.log("\n   ✅ Todos os testes de Metacognição, Batching e Fallback passaram!");
}

main().catch((err) => {
  console.error("Erro no teste:", err);
  process.exit(1);
});
