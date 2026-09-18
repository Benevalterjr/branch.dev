import { decide } from "../src/index.js";

async function runBenchmark() {
  console.log("=================================================");
  console.log("⏱️ Branch.dev - Benchmark de Latência e CPU");
  console.log("=================================================\n");

  const sampleStates = [
    { usuario: "Alice", acao: "Tentou acessar página restrita 5 vezes sem autenticação", ip: "192.168.1.50" },
    { usuario: "Bob", acao: "Fez upgrade para plano Enterprise e adicionou 10 membros", ip: "10.0.0.1" },
    { usuario: "Carlos", acao: "Solicitou exclusão de dados pessoais da LGPD", ip: "172.16.0.4" },
    { usuario: "Daniela", acao: "Tentou aplicar cupom expirado 12 vezes seguidas", ip: "192.168.1.99" },
  ];

  const choices = ["alerta_seguranca", "acao_comercial", "conformidade_legal", "tentativa_abuso"] as const;

  // Warm-up
  console.log("🔥 Aquecendo motor de inferência local...");
  await decide({ state: sampleStates[0], choices, task: "classificar evento de sistema" });
  console.log("✅ Motor pronto e calibrado.\n");

  const ITERATIONS = 20;
  const latencies: number[] = [];

  console.log(`🚀 Executando ${ITERATIONS} decisões consecutivas em CPU pura...`);
  const startTime = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    const state = sampleStates[i % sampleStates.length];
    const res = await decide({
      state,
      choices,
      task: "classificar evento de sistema",
    });
    latencies.push(res.latencyMs);
  }

  const totalTime = performance.now() - startTime;
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const p95Latency = [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
  const throughput = (ITERATIONS / (totalTime / 1000)).toFixed(1);

  const memUsage = process.memoryUsage();

  console.log("\n================ RESULTADOS ================");
  console.log(`📊 Decisões Realizadas:   ${ITERATIONS}`);
  console.log(`⚡ Throughput Médio:       ${throughput} decisões/segundo`);
  console.log(`⏱️ Latência Média:         ${avgLatency.toFixed(2)} ms`);
  console.log(`🚀 Latência Mínima:        ${minLatency.toFixed(2)} ms`);
  console.log(`⚠️ Latência Máxima:        ${maxLatency.toFixed(2)} ms`);
  console.log(`🎯 Latência P95:           ${p95Latency.toFixed(2)} ms`);
  console.log(`🧠 Uso de Heap (RAM):      ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`💰 Custo de Tokens:       $0.00 (Zero tokens gerados)`);
  console.log("============================================\n");
}

runBenchmark().catch(console.error);
