import { decide, configure, BRANCH_EMBEDDING_MODELS } from "../src/index.js";

// Suporte flexível a chaves via linha de comando ou variáveis de ambiente
const cliArg = process.argv[2] || "";
const isGroqCli = cliArg.startsWith("gsk_");
const isGeminiCli = cliArg.startsWith("AIzaSy");

const GEMINI_API_KEY = isGeminiCli ? cliArg : (process.env.GEMINI_API_KEY || "");
const GROQ_API_KEY = isGroqCli ? cliArg : (process.env.GROQ_API_KEY || "");

interface BenchmarkCase {
  id: string;
  name: string;
  state: Record<string, unknown>;
  choices: Record<string, string>;
  task: string;
  condition: (winner: string) => string;
}

const testCases: BenchmarkCase[] = [
  {
    id: "CASE-01",
    name: "Estorno de Cobrança Duplicada",
    state: {
      assunto: "Fui cobrado duas vezes no cartão Master",
      mensagem: "Olá, minha assinatura deste mês veio duas vezes na mesma data. Exijo estorno da segunda cobrança de R$ 99 imediatamente.",
      valorDuplicado: 99.00,
      diasAtraso: 0,
    },
    choices: {
      aprovar_estorno: "solicitação clara de estorno ou reembolso de cobrança indevida ou duplicada",
      suporte_tecnico: "problemas técnicos, erros no sistema, telas travadas ou falhas",
      duvidas_comerciais: "informações de preços, novos planos ou contratação",
    },
    task: "determinar ação para o ticket financeiro",
    condition: (w) => (w === "aprovar_estorno" ? "Emitir reembolso imediato no gateway" : "Encaminhar para fila comum"),
  },
  {
    id: "CASE-02",
    name: "Detecção de Risco de Churn",
    state: {
      usuario: "TechCorp",
      diasSemAcessar: 45,
      ticketsAbertosSemResposta: 3,
      quedaDeUsoPercentual: 80,
      plano: "Enterprise",
    },
    choices: {
      alto_risco: "cliente inativo há muito tempo, com chamados parados e queda drástica de uso",
      medio_risco: "cliente com atividade reduzida mas estável",
      baixo_risco: "cliente saudável e satisfeito",
    },
    task: "avaliar probabilidade de cancelamento do cliente",
    condition: (w) => (w === "alto_risco" ? "Alerta vermelho: Ligar para o tomador de decisão" : "Monitoramento padrão"),
  },
  {
    id: "CASE-03",
    name: "Alerta Crítico de Infraestrutura",
    state: {
      servico: "Auth Service",
      cluster: "prod-us-east-1",
      erro: "Conexões com Postgres esgotadas, pool zerado, latência p99 > 8000ms",
      impacto: "Usuários não conseguem fazer login",
    },
    choices: {
      incidente_critico: "falha grave em produção, indisponibilidade de serviço ou banco travado",
      alerta_moderado: "lentidão isolada ou aviso preventivo",
      informativo: "manutenção rotineira ou log informativo",
    },
    task: "classificar severidade do alerta operacional",
    condition: (w) => (w === "incidente_critico" ? "Disparar PagerDuty para o SRE de plantão" : "Apenas registrar no Slack"),
  },
  {
    id: "CASE-04",
    name: "Tentativa de Fraude / Abuso",
    state: {
      ip: "185.220.101.5",
      pais: "Desconhecido (VPN)",
      tentativasCartao10Min: 14,
      cartoesDiferentesUsados: 8,
      cvvInvalidos: 6,
    },
    choices: {
      bloqueio_fraude: "ataque de card testing, múltiplas tentativas com cartões diferentes e VPN",
      reanalise_manual: "transação suspeita necessitando documento",
      aprovacao_normal: "compra legítima de cliente confiável",
    },
    task: "avaliar risco de fraude da transação",
    condition: (w) => (w === "bloqueio_fraude" ? "Bloquear IP no WAF e recusar pagamento" : "Permitir fluxo"),
  },
];

// Chamada para LLM via Gemini
async function callGemini(c: BenchmarkCase): Promise<{ winner: string; latencyMs: number; tokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `Você é um motor de decisão if-statement.
Estado: ${JSON.stringify(c.state)}
Tarefa: ${c.task}
Opções permitidas: [${Object.keys(c.choices).join(", ")}]

Responda APENAS com uma única palavra contendo a opção escolhida. Não use markdown, não explique nada.`;

  const t0 = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.0, maxOutputTokens: 20 },
    }),
  });

  const t1 = performance.now();
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || "";
  const tokens = data.usageMetadata?.totalTokenCount || 0;

  // Extrai a opção correspondente
  let winner = "indefinido";
  for (const choiceKey of Object.keys(c.choices)) {
    if (rawText.includes(choiceKey.toLowerCase())) {
      winner = choiceKey;
      break;
    }
  }

  return { winner, latencyMs: Number((t1 - t0).toFixed(2)), tokens };
}

// Chamada para LLM via Groq (Qwen / LLaMA)
async function callGroq(c: BenchmarkCase): Promise<{ winner: string; latencyMs: number; tokens: number }> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const prompt = `Estado: ${JSON.stringify(c.state)}
Tarefa: ${c.task}
Opções permitidas: [${Object.keys(c.choices).join(", ")}]
Responda APENAS com o nome da opção escolhida.`;

  const t0 = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      max_tokens: 20,
    }),
  });

  const t1 = performance.now();
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawText = data.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
  const tokens = data.usage?.total_tokens || 0;

  let winner = "indefinido";
  for (const choiceKey of Object.keys(c.choices)) {
    if (rawText.includes(choiceKey.toLowerCase())) {
      winner = choiceKey;
      break;
    }
  }

  return { winner, latencyMs: Number((t1 - t0).toFixed(2)), tokens };
}

async function runBenchmark() {
  console.log("================================================================================");
  console.log("⚡ BENCHMARK: Branch.dev (Smart If-Statement) vs LLM Generativo em Nuvem");
  console.log("================================================================================\n");

  const useGroq = Boolean(GROQ_API_KEY);
  const llmName = useGroq ? "Groq (Qwen-2.5-32B)" : "Gemini 2.5 Flash Lite (Google AI)";
  console.log(`🤖 Comparador LLM: ${llmName}`);
  console.log(`💻 Branch.dev: In-Process CPU Local (Sem rede, Sem tokens, Sem chave)\n`);

  // Configura Branch.dev com o modelo multilíngue para português (PT-BR)
  configure({ modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED });

  // Aquecimento Branch
  console.log("🔥 Aquecendo Branch.dev localmente...");
  await decide({ state: testCases[0].state, choices: testCases[0].choices });
  console.log("✅ Branch aquecido.\n");

  const results: Array<{
    caseId: string;
    caseName: string;
    branchWinner: string;
    branchConfidence: number;
    branchLatency: number;
    branchAction: string;
    llmWinner: string;
    llmLatency: number;
    llmTokens: number;
    llmAction: string;
    speedup: number;
  }> = [];

  for (const tc of testCases) {
    console.log(`▶️ Executando Caso: ${tc.id} - "${tc.name}"`);

    // 1. Execução no Branch.dev
    const bStart = performance.now();
    const branchRes = await decide({
      state: tc.state,
      choices: tc.choices,
      task: tc.task,
    });
    const branchDuration = Number((performance.now() - bStart).toFixed(2));
    const branchAction = tc.condition(branchRes.winner);

    // 2. Execução no LLM
    let llmRes = { winner: "erro", latencyMs: 0, tokens: 0 };
    try {
      if (useGroq) {
        llmRes = await callGroq(tc);
      } else {
        llmRes = await callGemini(tc);
      }
    } catch (e) {
      console.warn(`   ⚠️ Erro ao chamar LLM: ${(e as Error).message}`);
    }
    const llmAction = tc.condition(llmRes.winner);
    const speedup = Number((llmRes.latencyMs / branchRes.latencyMs).toFixed(1));

    results.push({
      caseId: tc.id,
      caseName: tc.name,
      branchWinner: branchRes.winner,
      branchConfidence: branchRes.confidence,
      branchLatency: branchRes.latencyMs,
      branchAction,
      llmWinner: llmRes.winner,
      llmLatency: llmRes.latencyMs,
      llmTokens: llmRes.tokens,
      llmAction,
      speedup,
    });

    console.log(`   🟢 Branch.dev: ${branchRes.winner.toUpperCase()} (${(branchRes.confidence * 100).toFixed(1)}%) em ${branchRes.latencyMs}ms -> Ação: "${branchAction}"`);
    console.log(`   🌐 ${llmName}: ${llmRes.winner.toUpperCase()} em ${llmRes.latencyMs}ms (${llmRes.tokens} tokens) -> Ação: "${llmAction}"`);
    console.log(`   🚀 Branch foi ${speedup}x mais rápido neste teste!\n`);
  }

  // Tabela Comparativa
  console.log("================================================================================");
  console.log("📊 TABELA COMPARATIVA DE IF-STATEMENTS E DECISÕES");
  console.log("================================================================================");
  console.log(
    "Caso".padEnd(9) +
    "Decisão Branch".padEnd(22) +
    "Decisão LLM".padEnd(20) +
    "Lat. Branch".padEnd(14) +
    "Lat. LLM".padEnd(14) +
    "Speedup"
  );
  console.log("-".repeat(80));

  for (const r of results) {
    const bWin = `${r.branchWinner} (${(r.branchConfidence * 100).toFixed(0)}%)`;
    console.log(
      r.caseId.padEnd(9) +
      bWin.padEnd(22) +
      r.llmWinner.padEnd(20) +
      `${r.branchLatency} ms`.padEnd(14) +
      `${r.llmLatency} ms`.padEnd(14) +
      `⚡ ${r.speedup}x`
    );
  }

  const avgBranchLat = results.reduce((a, b) => a + b.branchLatency, 0) / results.length;
  const avgLlmLat = results.reduce((a, b) => a + b.llmLatency, 0) / results.length;
  const totalTokens = results.reduce((a, b) => a + b.llmTokens, 0);
  const avgSpeedup = (avgLlmLat / avgBranchLat).toFixed(1);

  console.log("================================================================================");
  console.log("🔥 TESTE DE REPETIÇÃO & THROUGHPUT EM PRODUÇÃO (5 Requisições Consecutivas)");
  console.log("================================================================================");
  console.log("Simulando endpoint de produção recebendo 5 requisições do mesmo smart if-statement:\n");

  const tc = testCases[0];
  const branchTimes: number[] = [];
  const llmTimes: number[] = [];

  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await decide({ state: tc.state, choices: tc.choices, task: tc.task });
    branchTimes.push(performance.now() - t0);

    const l0 = performance.now();
    if (useGroq) {
      await callGroq(tc);
    } else {
      await callGemini(tc);
    }
    llmTimes.push(performance.now() - l0);
  }

  const bAvgWarm = (branchTimes.reduce((a, b) => a + b, 0) / branchTimes.length).toFixed(2);
  const lAvgWarm = (llmTimes.reduce((a, b) => a + b, 0) / llmTimes.length).toFixed(2);

  console.log(`   🟢 Branch.dev (Warm): Média de ${bAvgWarm} ms por decisão`);
  console.log(`   🌐 ${llmName}: Média de ${lAvgWarm} ms por chamada HTTP`);
  console.log(`   ⚡ Speedup no endpoint repetido: ${(Number(lAvgWarm) / Number(bAvgWarm)).toFixed(1)}x mais rápido no Branch.dev!`);
  console.log("================================================================================\n");
}

runBenchmark().catch(console.error);
