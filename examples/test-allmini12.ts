import { OnnxEmbeddingAdapter, BRANCH_EMBEDDING_MODELS, BranchClient } from "../src/index.js";

async function main() {
  console.log("==================================================================");
  console.log("🧪 Testando modelo all-MiniLM-L12-v2 (Xenova/all-MiniLM-L12-v2)");
  console.log("==================================================================");

  const start = performance.now();
  const adapter = new OnnxEmbeddingAdapter(BRANCH_EMBEDDING_MODELS.ACCURATE_EN);

  console.log("⏳ Baixando / Carregando modelo ONNX all-MiniLM-L12-v2...");
  const vec = await adapter.embed("PETR4 Petrobras mercado financeiro bolsa B3");
  const elapsed = (performance.now() - start).toFixed(2);

  console.log(`✅ Embedding gerado com sucesso em ${elapsed} ms!`);
  console.log("   Dimensões do vetor:", vec.length);
  console.log("   Amostra:", Array.from(vec.slice(0, 5)).map(v => v.toFixed(4)));

  // Testando decisão direta no BranchClient com all-MiniLM-L12-v2
  console.log("\n🧪 Testando decisão via BranchClient com all-MiniLM-L12-v2...");
  const client = new BranchClient({
    modelName: BRANCH_EMBEDDING_MODELS.ACCURATE_EN,
  });

  const decisionStart = performance.now();
  const decision = await client.decide({
    state: {
      acao: "PETR4",
      situacao: "Mercado lateral com baixo volume de negociacao",
      rsi: 55,
    },
    choices: {
      HOLD: "Manter posicao e aguardar definicao de volume",
      BUY: "Comprar rompimento com volume forte",
      SELL: "Vender rompimento de suporte",
    },
  });
  const decisionElapsed = (performance.now() - decisionStart).toFixed(2);

  console.log(`✅ Decisão concluída em ${decisionElapsed} ms!`);
  console.log("   Vencedor:", decision.winner);
  console.log("   Confiança:", (decision.confidence * 100).toFixed(1) + "%");
  console.log("   Distribuição:", decision.probabilities);
}

main().catch(console.error);
