import * as ort from "onnxruntime-node";
import { Tokenizer } from "@huggingface/tokenizers";
import { OnnxEmbeddingAdapter, BRANCH_EMBEDDING_MODELS } from "../src/index.js";

async function probe() {
  console.log("🔍 Iniciando teste de inspeção do mmBERT-small-feature local...");
  const adapter = new OnnxEmbeddingAdapter("./models/mmbert-small-feature");
  
  // Teste de embedding com texto em português
  const start = performance.now();
  const vec = await adapter.embed("PETR4 Petrobras mercado de capitais B3 acoes ordinarias preferenciais");
  const elapsed = (performance.now() - start).toFixed(1);
  
  console.log(`✅ mmBERT-small-feature carregado (Cold load: ${elapsed} ms)`);
  console.log("   Dimensões do vetor:", vec.length);
  console.log("   Primeiros 5 valores:", Array.from(vec.slice(0, 5)).map(v => v.toFixed(4)));

  console.log("\n⚡ Medindo latência 'warm' (5 inferências consecutivas na CPU)...");
  const latencies: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const t0 = performance.now();
    await adapter.embed(`Ação PETR4 em tendência de alta com RSI em 58 e volume moderado [iter #${i}]`);
    const lat = performance.now() - t0;
    latencies.push(lat);
    console.log(`   Inferência #${i}: ${lat.toFixed(1)} ms`);
  }
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);
  console.log(`\n🚀 Latência média warm na CPU: ${avg} ms!`);
}

probe().catch((err) => {
  console.error("❌ Erro no probe do mmBERT:", err);
});
