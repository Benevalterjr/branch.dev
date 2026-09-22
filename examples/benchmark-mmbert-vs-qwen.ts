process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { existsSync } from "node:fs";
import { BranchClient, InMemoryPrototypeStore, PlattTemperatureCalibrator } from "../src/index.js";

// Chave fornecida via ENV (GROQ_API_KEY) ou via argumento de linha de comando
const GROQ_API_KEY =
  process.env.GROQ_API_KEY ||
  process.argv.find((a) => a.startsWith("gsk_")) ||
  "";

const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

interface BenchmarkCase {
  id: string;
  name: string;
  category: "Trading & B3" | "Risco Financeiro" | "Infra & Segurança";
  state: Record<string, unknown>;
  choices: Record<string, string>;
  task: string;
}

const benchmarkCases: BenchmarkCase[] = [
  {
    id: "TRD-01",
    name: "PETR4 — Consolidação em Resistência na B3",
    category: "Trading & B3",
    state: {
      ticker: "PETR4.SA",
      preco: 48.42,
      variacaoDia: "+0.88%",
      rsi14: 58.62,
      sma9: 48.85,
      sma21: 46.77,
      volumeRatio: 0.90,
      cenario: "preço abaixo da resistência SMA9 em consolidação sem volume forte de rompimento",
    },
    choices: {
      manter_neutro: "consolidação técnica entre médias sem volume de rompimento, prudência em aguardar",
      comprar_agressivo: "rompimento confirmado com volume institucional massivo acima das resistências",
      vender_despejo: "perda de suporte crítico da SMA21 com fluxo vendedor pesado",
    },
    task: "determinar decisão de trading para a posição em PETR4",
  },
  {
    id: "TRD-02",
    name: "VALE3 — Detecção de Falsa Ruptura (Bull Trap)",
    category: "Trading & B3",
    state: {
      ticker: "VALE3.SA",
      preco: 62.10,
      evento: "preço furou topo anterior por 3 centavos",
      volumeDelta: -0.45,
      divergenciaRSI: "baixa clara no tempo gráfico de 15min",
      saldoAgressao: -4800000,
    },
    choices: {
      alerta_bull_trap: "falso rompimento de topo sem confirmação de volume e com agressão vendedora",
      compra_rompimento: "rompimento legítimo de topo histórico com fluxo comprador acelerado",
      mercado_lateral: "mercado estável sem sinais operacionais relevantes",
    },
    task: "classificar o padrão de rompimento técnico",
  },
  {
    id: "RISK-01",
    name: "Gestão de Risco — Drawdown Crítico e Notícia",
    category: "Risco Financeiro",
    state: {
      carteira: "Fundo Quantitativo L/S",
      drawdownDiario: "-3.95%",
      limiteDiarioRisco: "-4.00%",
      eventoNoticioso: "Abertura de investigação regulatória com leilão de volatilidade",
      spreadLivro: "abertura atípica de 2.4%",
    },
    choices: {
      estancar_risco: "interrupção preventiva imediata e fechamento de risco no limite de perda diário",
      dobrar_aposta: "aumento de margem para abaixar preço médio acreditando em exagero",
      ignorar_noticia: "manter posições abertas sem nenhuma intervenção",
    },
    task: "executar protocolo de controle de risco de capital",
  },
  {
    id: "FIN-01",
    name: "Conciliação — Cobrança em Duplicidade no Gateway",
    category: "Risco Financeiro",
    state: {
      clienteId: "USR-9921",
      valor: 249.90,
      ocorrencia: "duas cobranças idênticas em intervalo de 4 segundos",
      gatewayStatus: "ambas capturadas",
      historicoCliente: "18 meses adimplente, zero chargebacks",
    },
    choices: {
      estorno_automatico: "devolução imediata da segunda transação duplicada de forma automatizada",
      bloqueio_fraude: "cancelar conta do cliente por suspeita de fraude",
      recusar_contato: "negar devolução alegando que cobrança foi processada",
    },
    task: "definir resolução do incidente financeiro",
  },
  {
    id: "INFRA-01",
    name: "SRE — Saturação de Conexões de Banco em Produção",
    category: "Infra & Segurança",
    state: {
      servico: "Checkout & Pagamentos",
      postgresPoolAtivo: "100%",
      pedidosFilaEspera: 1840,
      latenciaP99: "8400ms",
      erro500Taxa: "14.2%",
    },
    choices: {
      acionamento_sre_critico: "incidente P0 de produção com bloqueio de receita, acionar plantão e failover",
      observacao_passiva: "oscilação passageira de tráfego, registrar apenas em log informativo",
      agendar_reuniao: "marcar alinhamento na semana que vem para avaliar capacidade",
    },
    task: "classificar severidade e resposta para o alerta de infraestrutura",
  },
  {
    id: "SEC-01",
    name: "Defesa — Ataque de Card Testing via Tor",
    category: "Infra & Segurança",
    state: {
      ipOrigem: "Tor Exit Node",
      tentativasMinuto: 48,
      cartoesDistintos: 15,
      taxaRejeicao: "94%",
      valorTransacao: "R$ 1,50",
    },
    choices: {
      bloqueio_imediato_waf: "ataque automatizado de teste de cartões furtados, bloquear IP e fingerprint no WAF",
      desafio_captcha: "exibir captcha simples para o bot",
      permitir_transacoes: "aprovar pagamentos normalmente",
    },
    task: "determinar medida de contenção de segurança",
  },
];

// ─── Chamada Groq Cloud (Qwen) com Decomposição de Latência ───────────────────

interface GroqResponse {
  winner: string;
  totalRoundtripMs: number;
  queueTimeMs: number;
  chipTimeMs: number;
  networkRttMs: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  rawResponse: string;
}

async function callGroqQwen(c: BenchmarkCase): Promise<GroqResponse> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const prompt = `Você é um motor analítico determinístico de alta precisão.
Estado atual: ${JSON.stringify(c.state, null, 2)}
Tarefa de Decisão: ${c.task}
Opções Disponíveis:
${Object.entries(c.choices)
  .map(([k, desc]) => `- "${k}": ${desc}`)
  .join("\n")}

Instrução: Escolha a melhor opção técnica. Responda ESTRITAMENTE com o identificador da opção (apenas o nome exato entre as opções, sem comentários).`;

  const t0 = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      max_tokens: 30,
    }),
  });
  const t1 = performance.now();

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as any;
  const totalRoundtripMs = Number((t1 - t0).toFixed(1));
  const rawResponse = data.choices?.[0]?.message?.content?.trim() || "";

  // Decomposição de telemetria da nuvem Groq
  const queueTimeMs = Number(((data.usage?.queue_time || 0) * 1000).toFixed(1));
  const promptTimeMs = (data.usage?.prompt_time || 0) * 1000;
  const completionTimeMs = (data.usage?.completion_time || 0) * 1000;
  const chipTimeMs = Number((promptTimeMs + completionTimeMs).toFixed(1));

  // O tempo de rede transcontinental (RTT) é o roundtrip total menos o tempo que o Groq passou processando na LPU
  const networkRttMs = Math.max(0, Number((totalRoundtripMs - chipTimeMs - queueTimeMs).toFixed(1)));

  // Resolução da opção escolhida
  const normalized = rawResponse.toLowerCase();
  let winner = "indefinido";
  for (const choiceKey of Object.keys(c.choices)) {
    if (normalized.includes(choiceKey.toLowerCase())) {
      winner = choiceKey;
      break;
    }
  }

  return {
    winner,
    totalRoundtripMs,
    queueTimeMs,
    chipTimeMs,
    networkRttMs,
    tokens: data.usage?.total_tokens || 0,
    promptTokens: data.usage?.prompt_tokens || 0,
    completionTokens: data.usage?.completion_tokens || 0,
    rawResponse,
  };
}

// ─── Execução do Benchmark Científico ──────────────────────────────────────────

async function runBenchmark() {
  console.log("╔═══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║ 🔬 BENCHMARK COMPARATIVO DE TOMADA DE DECISÃO:                                 ║");
  console.log("║    Branch.dev (mmBERT-small Feature Extraction) vs Groq Cloud (Qwen-3.8 27B)  ║");
  console.log("╚═══════════════════════════════════════════════════════════════════════════════╝\n");

  const localModelPath = "./models/mmbert-small-feature";
  if (!existsSync(localModelPath)) {
    console.error(`❌ Erro: Pasta '${localModelPath}' não encontrada!`);
    process.exit(1);
  }

  if (!GROQ_API_KEY) {
    console.error("❌ Erro: Chave da Groq não encontrada!");
    console.error("   Forneça via variável GROQ_API_KEY ou argumento de linha de comando:");
    console.error("   npm run benchmark:mmbert -- gsk_...");
    process.exit(1);
  }

  console.log("💻 CONFIGURAÇÃO DOS MOTORES:");
  console.log(`   🟢 Branch.dev:       ${localModelPath} (ModernBERT 384 dim headless)`);
  console.log("                        In-Process CPU Local | 0 chamadas de rede | 0 tokens");
  console.log(`   🌐 Groq Cloud:       ${GROQ_MODEL} (27 Bilhões de Parâmetros)`);
  console.log(`                        API Transcontinental HTTPS (${GROQ_API_KEY.substring(0, 10)}...)`);
  console.log("\n🌱 Inicializando Branch.dev com Platt Temperature Scaling (0.85)...");

  const branch = new BranchClient({
    modelName: localModelPath,
    calibrator: new PlattTemperatureCalibrator(0.85),
    prototypeStore: new InMemoryPrototypeStore(),
  });

  // Aquecimento local
  console.log("🔥 Aquecendo motor local (carregamento de grafo ONNX em memória)...");
  const warmStart = performance.now();
  await branch.decide({
    state: benchmarkCases[0].state,
    choices: benchmarkCases[0].choices,
    task: benchmarkCases[0].task,
  });
  const warmUpMs = (performance.now() - warmStart).toFixed(1);
  console.log(`✅ Motor Branch aquecido em ${warmUpMs} ms.\n`);

  interface CaseResult {
    id: string;
    name: string;
    category: string;
    branchDecision: string;
    branchConfidence: number;
    branchLatencyMs: number;
    groqDecision: string;
    groqRoundtripMs: number;
    groqNetworkRttMs: number;
    groqChipMs: number;
    groqTokens: number;
    concordance: boolean;
    speedup: number;
  }

  const results: CaseResult[] = [];

  for (const c of benchmarkCases) {
    console.log(`─────────────────────────────────────────────────────────────────────────────────`);
    console.log(`▶️ Caso [${c.id}]: ${c.name} (${c.category})`);

    // 1. Execução no Branch.dev (mmBERT local)
    const b0 = performance.now();
    const branchRes = await branch.decide({
      state: c.state,
      choices: c.choices,
      task: c.task,
    });
    const b1 = performance.now();
    const branchLatencyMs = Number((b1 - b0).toFixed(1));

    // 2. Execução no Groq (Qwen na nuvem)
    let groqRes: GroqResponse;
    try {
      groqRes = await callGroqQwen(c);
    } catch (err) {
      console.error(`   ❌ Falha na chamada ao Groq: ${(err as Error).message}`);
      groqRes = {
        winner: "erro",
        totalRoundtripMs: 0,
        queueTimeMs: 0,
        chipTimeMs: 0,
        networkRttMs: 0,
        tokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        rawResponse: (err as Error).message,
      };
    }

    const concordance = branchRes.winner.toLowerCase() === groqRes.winner.toLowerCase();
    const speedup = Number((groqRes.totalRoundtripMs / branchLatencyMs).toFixed(1));

    results.push({
      id: c.id,
      name: c.name,
      category: c.category,
      branchDecision: branchRes.winner,
      branchConfidence: branchRes.confidence,
      branchLatencyMs,
      groqDecision: groqRes.winner,
      groqRoundtripMs: groqRes.totalRoundtripMs,
      groqNetworkRttMs: groqRes.networkRttMs,
      groqChipMs: groqRes.chipTimeMs,
      groqTokens: groqRes.tokens,
      concordance,
      speedup,
    });

    const concLabel = concordance ? "✅ ACORDO TOTAL" : "⚠️ DIVERGÊNCIA";
    console.log(`   🟢 Branch.dev:  [${branchRes.winner}] (${(branchRes.confidence * 100).toFixed(1)}% conf) em ${branchLatencyMs} ms`);
    console.log(`   🌐 Groq Qwen:   [${groqRes.winner}] em ${groqRes.totalRoundtripMs} ms (Rede: ${groqRes.networkRttMs}ms | Chip: ${groqRes.chipTimeMs}ms | ${groqRes.tokens} tok)`);
    console.log(`   ⚖️ Avaliação:    ${concLabel} | Branch foi ${speedup}x mais rápido\n`);
  }

  // ─── Tabela Resumo ────────────────────────────────────────────────────────────

  console.log("═════════════════════════════════════════════════════════════════════════════════");
  console.log("📊 TABELA COMPARATIVA DE DECISÃO E QUALIDADE SEMÂNTICA");
  console.log("═════════════════════════════════════════════════════════════════════════════════");
  console.log(
    "Caso".padEnd(9) +
    "Decisão mmBERT (Branch)".padEnd(26) +
    "Decisão Qwen (Groq)".padEnd(25) +
    "Acordo?".padEnd(12) +
    "Speedup"
  );
  console.log("-".repeat(81));

  for (const r of results) {
    const bText = `${r.branchDecision} (${(r.branchConfidence * 100).toFixed(0)}%)`;
    const acord = r.concordance ? "✅ Sim" : "❌ Não";
    console.log(
      r.id.padEnd(9) +
      bText.padEnd(26) +
      r.groqDecision.padEnd(25) +
      acord.padEnd(12) +
      `⚡ ${r.speedup}x`
    );
  }

  // ─── Análise de Latência e Decomposição de Rede ────────────────────────────────

  const avgBranchLat = Number((results.reduce((a, b) => a + b.branchLatencyMs, 0) / results.length).toFixed(1));
  const avgGroqTotal = Number((results.reduce((a, b) => a + b.groqRoundtripMs, 0) / results.length).toFixed(1));
  const avgGroqNet = Number((results.reduce((a, b) => a + b.groqNetworkRttMs, 0) / results.length).toFixed(1));
  const avgGroqChip = Number((results.reduce((a, b) => a + b.groqChipMs, 0) / results.length).toFixed(1));
  const totalTokens = results.reduce((a, b) => a + b.groqTokens, 0);
  const concordanceCount = results.filter((r) => r.concordance).length;
  const concordanceRate = ((concordanceCount / results.length) * 100).toFixed(1);

  console.log("\n═════════════════════════════════════════════════════════════════════════════════");
  console.log("⏱️ DECOMPOSIÇÃO DE LATÊNCIA (CPU LOCAL vs IMPACTO DA NUVEM)");
  console.log("═════════════════════════════════════════════════════════════════════════════════");
  console.log(`• Taxa de Concordância Decisória: ${concordanceRate}% (${concordanceCount}/${results.length} casos idênticos)`);
  console.log(`• Latência Média mmBERT Local:     ${avgBranchLat} ms (100% computação determinística na CPU)`);
  console.log(`• Latência Média Groq Total:      ${avgGroqTotal} ms`);
  console.log(`    ↳ Latência de Rede (RTT):      ${avgGroqNet} ms (${((avgGroqNet / avgGroqTotal) * 100).toFixed(1)}% do tempo total no trânsito HTTPS)`);
  console.log(`    ↳ Computação Groq LPU (Chip):  ${avgGroqChip} ms`);
  console.log(`• Speedup Médio do Branch.dev:    ${(avgGroqTotal / avgBranchLat).toFixed(1)}x mais rápido!`);
  console.log(`• Consumo de Tokens Groq:         ${totalTokens} tokens (Branch: ZERO tokens, custo R$ 0,00)`);

  // ─── Teste de Estresse de Repetição em Lote (Warm Throughput) ─────────────────

  console.log("\n═════════════════════════════════════════════════════════════════════════════════");
  console.log("🚀 TESTE DE THROUGHPUT REPETIDO: 5 CICLOS NO CASO PETR4 (Alta Frequência)");
  console.log("═════════════════════════════════════════════════════════════════════════════════");
  console.log("Simulando 5 decisões seguidas em tempo real...\n");

  const petrCase = benchmarkCases[0];
  const bTimes: number[] = [];
  const gTimes: number[] = [];

  for (let i = 1; i <= 5; i++) {
    const t0 = performance.now();
    await branch.decide({
      state: petrCase.state,
      choices: petrCase.choices,
      task: petrCase.task,
    });
    bTimes.push(performance.now() - t0);

    const g0 = performance.now();
    await callGroqQwen(petrCase);
    gTimes.push(performance.now() - g0);

    console.log(`   [Ciclo #${i}] Branch: ${bTimes[bTimes.length - 1].toFixed(1)} ms | Groq: ${gTimes[gTimes.length - 1].toFixed(1)} ms`);
  }

  const avgWarmBranch = (bTimes.reduce((a, b) => a + b, 0) / bTimes.length).toFixed(1);
  const avgWarmGroq = (gTimes.reduce((a, b) => a + b, 0) / gTimes.length).toFixed(1);

  console.log(`\n🏆 RESULTADO FINAL EM ALTA FREQUÊNCIA:`);
  console.log(`   🟢 Branch.dev (mmBERT CPU):  ${avgWarmBranch} ms por decisão`);
  console.log(`   🌐 Groq Cloud (Qwen Nuvem):  ${avgWarmGroq} ms por decisão`);
  console.log(`   ⚡ Aceleração Física:        ${(Number(avgWarmGroq) / Number(avgWarmBranch)).toFixed(1)}x mais rápido no Branch.dev!`);
  console.log("═════════════════════════════════════════════════════════════════════════════════\n");
}

runBenchmark().catch((err) => {
  console.error("❌ Erro fatal no benchmark:", err);
});
