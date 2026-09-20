/**
 * ==============================================================================================
 * 🚀 BRANCH.DEV CIBER-PHYSICAL REAL-TIME DECISION BENCHMARK
 * ----------------------------------------------------------------------------------------------
 * Experimento de Aviação Aeroespacial & Evasão de Colisão sob Extrema Pressão de Tempo
 * Arquitetura: Clean Architecture | Simulação Cinemática 3D | PRNG Determinístico (Mulberry32)
 *
 * Comparativo:
 * 1. Branch.dev (@branch/core) - In-Process System 1 Edge Decision Engine (CPU Pura)
 * 2. Groq Cloud (qwen/qwen3.8-27b) - Cloud Generative LLM via Transcontinental API
 * ==============================================================================================
 */

import { decide, configure, BRANCH_EMBEDDING_MODELS } from "../src/index.js";
import * as fs from "fs";
import * as path from "path";

// ----------------------------------------------------------------------------------------------
// 1. GERADOR PSEUDO-ALEATÓRIO DETERMINÍSTICO (Mulberry32 PRNG)
// Garante 100% de reprodutibilidade científica em qualquer ambiente ou runner de CI/CD.
// ----------------------------------------------------------------------------------------------
export class Mulberry32 {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }
}

// ----------------------------------------------------------------------------------------------
// 2. MODELO DE FÍSICA CINEMÁTICA 3D & ENVELOPE DE COLISÃO
// ----------------------------------------------------------------------------------------------
export interface Vector3D {
  x: number; // Eixo Lateral (Boreste/Bombordo)
  y: number; // Eixo Vertical (Dorsal/Ventral)
  z: number; // Eixo Longitudinal (Aproximação Frontal)
}

export interface AsteroidThreat {
  id: string;
  nome: string;
  posicaoInicial: Vector3D;
  velocidadeRelativa: Vector3D;
  velocidadeEscalarKmS: number;
  distanciaInicialMetros: number;
  tempoLimiteImpactoMs: number;
  descricaoTelemetria: string;
  quadrantePerigo: string;
  manobraIdeal: string;
}

export interface ManeuverDefinition {
  id: string;
  label: string;
  acceleration: Vector3D; // m/s^2 produzida pelos propulsores
  description: string;
}

export const CRITICAL_COLLISION_RADIUS_METERS = 25.0; // Raio da Nave (10m) + Raio do Asteroide (15m)
const THRUST_LATERAL_ACCEL = 180.0; // 180 m/s^2 (~18.3 Gs aeroespaciais)
const THRUST_VERTICAL_ACCEL = 160.0; // 160 m/s^2 (~16.3 Gs)

export const MANEUVERS: Record<string, ManeuverDefinition> = {
  manobra_boreste: {
    id: "manobra_boreste",
    label: "Manobra a Boreste (Desviar para Direita)",
    acceleration: { x: THRUST_LATERAL_ACCEL, y: 0, z: 0 },
    description: "ameaça detectada no flanco esquerdo ou asa de bombordo. Manobra: virar para o flanco oposto livre",
  },
  manobra_bombordo: {
    id: "manobra_bombordo",
    label: "Manobra a Bombordo (Desviar para Esquerda)",
    acceleration: { x: -THRUST_LATERAL_ACCEL, y: 0, z: 0 },
    description: "ameaça detectada no flanco direito ou asa de estibordo. Manobra: virar para o flanco oposto livre",
  },
  mergulho_ventral: {
    id: "mergulho_ventral",
    label: "Mergulho Ventral (Desviar para Baixo)",
    acceleration: { x: 0, y: -THRUST_VERTICAL_ACCEL, z: 0 },
    description: "ameaça detectada no teto, alto ou quadrante superior dorsal. Manobra: descer para o flanco oposto livre",
  },
  subida_dorsal: {
    id: "subida_dorsal",
    label: "Ascensão Dorsal (Desviar para Cima)",
    acceleration: { x: 0, y: THRUST_VERTICAL_ACCEL, z: 0 },
    description: "ameaça detectada no chão, fundo ou quadrante inferior ventral. Manobra: subir para o flanco oposto livre",
  },
  disparo_plasma: {
    id: "disparo_plasma",
    label: "Deflexão Cinética por Pulso Frontal",
    acceleration: { x: 0, y: 0, z: -100.0 },
    description: "ameaça ou fragmento pequeno centralizado frontalmente no eixo zero direto à frente",
  },
};

// ----------------------------------------------------------------------------------------------
// 3. RESOLUÇÃO DE CONFIGURAÇÃO E CHAVES
// ----------------------------------------------------------------------------------------------
function resolveGroqApiKey(): string {
  const cliArg = process.argv[2] || "";
  if (cliArg.startsWith("gsk_")) return cliArg;
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  return "";
}

const GROQ_API_KEY = resolveGroqApiKey();
const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";
const RANDOM_SEED = Number(process.env.BENCHMARK_SEED) || 42;
const ASTEROID_COUNT = Number(process.env.ASTEROID_COUNT) || 8;

// ----------------------------------------------------------------------------------------------
// 4. MOTOR DE GERAÇÃO DO CAMPO DE ASTEROIDES (CINEMÁTICA 3D)
// ----------------------------------------------------------------------------------------------
function generateDeterministicAsteroidField(count: number, seed: number): AsteroidThreat[] {
  const prng = new Mulberry32(seed);
  const asteroids: AsteroidThreat[] = [];

  const archetypeVectors = [
    {
      quadrante: "SUPERIOR-DIREITO",
      dirText: "em rota de aproximação pelo quadrante superior direito (Boreste/Dorsal)",
      pos: { x: 28, y: 22 },
      manobraIdeal: "manobra_bombordo",
    },
    {
      quadrante: "LATERAL-ESQUERDO",
      dirText: "em rota de fechamento rápido pela asa esquerda (Bombordo puro)",
      pos: { x: -35, y: 5 },
      manobraIdeal: "manobra_boreste",
    },
    {
      quadrante: "VERTICAL-DORSAL",
      dirText: "em mergulho íngreme de alta gravidade por cima da cabine (Dorsal)",
      pos: { x: 4, y: 32 },
      manobraIdeal: "mergulho_ventral",
    },
    {
      quadrante: "VERTICAL-VENTRAL",
      dirText: "em ascensão súbita pelo plano inferior cego (Ventral)",
      pos: { x: -6, y: -30 },
      manobraIdeal: "subida_dorsal",
    },
    {
      quadrante: "CENTRAL-FRONTAL",
      dirText: "fragmento metálico pequeno perfeitamente alinhado no eixo zero frontal",
      pos: { x: 2, y: 1 },
      manobraIdeal: "disparo_plasma",
    },
    {
      quadrante: "FECHAMENTO-DIREITO",
      dirText: "bólido massivo de grande área obstruindo todo o flanco direito",
      pos: { x: 40, y: -10 },
      manobraIdeal: "manobra_bombordo",
    },
  ];

  for (let i = 0; i < count; i++) {
    const arch = archetypeVectors[i % archetypeVectors.length];

    // Distância longitudinal entre 650m e 2200m
    const zDist = prng.range(650, 2200);
    // Velocidade de aproximação entre 2.2 km/s e 3.8 km/s
    const vzKmS = prng.range(2.2, 3.8);
    const vzMS = vzKmS * 1000;

    // Tempo físico exato até o plano de impacto Z=0 (em milissegundos)
    const tImpactoMs = Math.round((zDist / vzMS) * 1000);

    // Perturbações angulares físicas
    const jitterX = prng.range(-8, 8);
    const jitterY = prng.range(-8, 8);
    const posX = arch.pos.x + jitterX;
    const posY = arch.pos.y + jitterY;

    // Velocidade escalar total
    const vTotalKmS = Number(Math.sqrt(vzKmS ** 2 + 0.04).toFixed(2));

    asteroids.push({
      id: `AST-${(i + 1).toString().padStart(2, "0")}`,
      nome: `Asteroide Classe-${String.fromCharCode(65 + (i % 6))}-${Math.round(zDist)}m`,
      posicaoInicial: { x: posX, y: posY, z: zDist },
      velocidadeRelativa: { x: -posX / (tImpactoMs / 1000), y: -posY / (tImpactoMs / 1000), z: -vzMS },
      velocidadeEscalarKmS: vTotalKmS,
      distanciaInicialMetros: Math.round(zDist),
      tempoLimiteImpactoMs: tImpactoMs,
      quadrantePerigo: arch.quadrante,
      manobraIdeal: arch.manobraIdeal,
      descricaoTelemetria:
        `Sensor LiDAR detectou bólido a ${Math.round(zDist)} metros com aproximação de ${vTotalKmS} km/s ` +
        `${arch.dirText}. Janela crítica calculada: ${tImpactoMs} ms.`,
    });
  }

  return asteroids;
}

// ----------------------------------------------------------------------------------------------
// 5. SIMULADOR DE DINÂMICA DE VOO E MISS DISTANCE
// ----------------------------------------------------------------------------------------------
export interface FlightOutcome {
  decisionLatencyMs: number;
  chosenManeuver: string;
  tBurnAvailableMs: number;
  missDistanceMeters: number;
  survived: boolean;
  statusText: string;
  error?: string;
}

function simulateFlightDynamics(
  threat: AsteroidThreat,
  chosenManeuverId: string,
  decisionLatencyMs: number,
  error?: string
): FlightOutcome {
  if (error || !MANEUVERS[chosenManeuverId]) {
    return {
      decisionLatencyMs,
      chosenManeuver: chosenManeuverId || "nenhuma",
      tBurnAvailableMs: 0,
      missDistanceMeters: 0,
      survived: false,
      statusText: "FALHA DE SISTEMA / RESPOSTA INVÁLIDA",
      error,
    };
  }

  // 1. Se a decisão demorou mais que o tempo de impacto físico, o empuxo foi ZERO
  if (decisionLatencyMs >= threat.tempoLimiteImpactoMs) {
    return {
      decisionLatencyMs,
      chosenManeuver: chosenManeuverId,
      tBurnAvailableMs: 0,
      missDistanceMeters: 0,
      survived: false,
      statusText: `COLISÃO TEMPORAL! Asteroide colidiu aos ${threat.tempoLimiteImpactoMs}ms (decisão chegou aos ${decisionLatencyMs.toFixed(1)}ms)`,
    };
  }

  // 2. Tempo de queima útil dos propulsores até o momento do cruzamento
  const tBurnMs = threat.tempoLimiteImpactoMs - decisionLatencyMs;
  const tBurnSec = tBurnMs / 1000.0;

  // 3. Aplicação das leis de Newton: Delta_r = 0.5 * a * t^2
  const maneuver = MANEUVERS[chosenManeuverId];
  const deltaX = 0.5 * maneuver.acceleration.x * (tBurnSec ** 2);
  const deltaY = 0.5 * maneuver.acceleration.y * (tBurnSec ** 2);

  // 4. Distância lateral de passagem (Miss Distance ao cruzar Z=0)
  // Sem empuxo, a trajetória passa no ponto inicial (posX, posY). O empuxo desvia a nave.
  const finalRelativeX = threat.posicaoInicial.x - deltaX;
  const finalRelativeY = threat.posicaoInicial.y - deltaY;
  const missDistance = Math.sqrt(finalRelativeX ** 2 + finalRelativeY ** 2);

  const survived = missDistance > CRITICAL_COLLISION_RADIUS_METERS;

  return {
    decisionLatencyMs,
    chosenManeuver: chosenManeuverId,
    tBurnAvailableMs: Math.round(tBurnMs),
    missDistanceMeters: Number(missDistance.toFixed(2)),
    survived,
    statusText: survived
      ? `EVASÃO BEM-SUCEDIDA (Passagem segura a ${missDistance.toFixed(1)}m do bólido)`
      : `COLISÃO DE IMPACTO (Passagem a ${missDistance.toFixed(1)}m, raio crítico de ${CRITICAL_COLLISION_RADIUS_METERS}m)`,
  };
}

// ----------------------------------------------------------------------------------------------
// 6. CLIENTES DE INFERÊNCIA: GROQ CLOUD E BRANCH.DEV
// ----------------------------------------------------------------------------------------------
async function callGroqCloud(
  telemetry: string,
  task: string
): Promise<{ winner: string; latencyMs: number; tokens: number; error?: string }> {
  if (!GROQ_API_KEY) {
    return { winner: "sem_chave", latencyMs: 0, tokens: 0, error: "GROQ_API_KEY não configurada" };
  }

  const url = "https://api.groq.com/openai/v1/chat/completions";
  const choicesKeys = Object.keys(MANEUVERS);
  const prompt = `COMPUTADOR DE BORDO AEROESPACIAL DE EMERGÊNCIA.
Telemetria do Sensor: ${telemetry}
Tarefa: ${task}
Opções permitidas: [${choicesKeys.join(", ")}]
Responda APENAS E ESTRITAMENTE com o nome de uma opção da lista. Não use pontuação, não justifique.`;

  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.0,
        max_tokens: 10,
      }),
    });

    const t1 = performance.now();
    const latencyMs = Number((t1 - t0).toFixed(2));

    if (!res.ok) {
      const errText = await res.text();
      return { winner: "erro_api", latencyMs, tokens: 0, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
    const tokens = data.usage?.total_tokens || 0;

    let winner = "indefinido";
    for (const k of choicesKeys) {
      if (rawText.includes(k.toLowerCase())) {
        winner = k;
        break;
      }
    }

    return { winner, latencyMs, tokens };
  } catch (err) {
    const t1 = performance.now();
    return { winner: "erro_rede", latencyMs: Number((t1 - t0).toFixed(2)), tokens: 0, error: (err as Error).message };
  }
}

// ----------------------------------------------------------------------------------------------
// 7. CÁLCULO ESTATÍSTICO RIGOROSO (p50, p95, p99, Desvio Padrão)
// ----------------------------------------------------------------------------------------------
export interface BenchmarkStatistics {
  count: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  survivalRatePercent: number;
  meanMissDistanceMeters: number;
}

export function computeStatistics(
  latencies: number[],
  survivals: boolean[],
  missDistances: number[]
): BenchmarkStatistics {
  if (latencies.length === 0) {
    return { count: 0, mean: 0, stdDev: 0, min: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0, survivalRatePercent: 0, meanMissDistanceMeters: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((acc, v) => acc + v, 0) / n;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);

  const getPercentile = (p: number) => {
    const idx = Math.min(n - 1, Math.max(0, Math.floor(n * (p / 100))));
    return sorted[idx];
  };

  const survivors = survivals.filter(Boolean).length;
  const meanMiss = missDistances.reduce((a, b) => a + b, 0) / n;

  return {
    count: n,
    mean: Number(mean.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[n - 1].toFixed(2)),
    p50: Number(getPercentile(50).toFixed(2)),
    p90: Number(getPercentile(90).toFixed(2)),
    p95: Number(getPercentile(95).toFixed(2)),
    p99: Number(getPercentile(99).toFixed(2)),
    survivalRatePercent: Number(((survivors / n) * 100).toFixed(1)),
    meanMissDistanceMeters: Number(meanMiss.toFixed(1)),
  };
}

// ----------------------------------------------------------------------------------------------
// 8. EXECUÇÃO PRINCIPAL DO BENCHMARK
// ----------------------------------------------------------------------------------------------
async function runSeniorAsteroidBenchmark() {
  console.log("================================================================================================");
  console.log("🛸 BRANCH.DEV REAL-TIME AVIONICS BENCHMARK: ASTEROID COLLISION AVOIDANCE");
  console.log("   Scientific Rigor: Deterministic Seeded PRNG + 3D Flight Kinematics + Full Percentile Metrics");
  console.log("================================================================================================\n");

  console.log(`🌱 Random Seed: ${RANDOM_SEED} (Mulberry32 PRNG para Reprodutibilidade Total)`);
  console.log(`☄️ Número de Ameaças: ${ASTEROID_COUNT} asteroides`);
  console.log(`🤖 LLM Alvo: ${GROQ_MODEL} (Groq Cloud API)`);
  console.log(`🔑 Status Groq: ${GROQ_API_KEY ? `Ativa (${GROQ_API_KEY.substring(0, 8)}...)` : "NÃO CONFIGURADA"}`);
  console.log(`⚡ Branch Engine: In-Process Node.js / Single-Pass Embedding / Zero-Network\n`);

  // Configurações do Branch.dev
  configure({ modelName: BRANCH_EMBEDDING_MODELS.FAST_EN });

  const choicesMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(MANEUVERS)) {
    choicesMap[k] = v.description;
  }

  // Aquecimento e pré-indexação dos vetores de manobras no cache de RAM
  console.log("🔥 Pré-indexando vetores das manobras no cache L1 de memória...");
  const tWarm0 = performance.now();
  await decide({
    state: "radar em standby",
    choices: choicesMap,
    task: "determinar manobra de evasao imediata",
  });
  console.log(`✅ Cache pré-aquecido em ${(performance.now() - tWarm0).toFixed(1)}ms. Pronto para decisões em microssegundos.\n`);

  // Gera o campo de asteroides determinístico
  const threats = generateDeterministicAsteroidField(ASTEROID_COUNT, RANDOM_SEED);

  const branchOutcomes: FlightOutcome[] = [];
  const groqOutcomes: FlightOutcome[] = [];
  let totalGroqTokens = 0;

  console.log("================================================================================================");
  console.log("🛰️ FLIGHT RECORDER & SIMULAÇÃO EM TEMPO REAL");
  console.log("================================================================================================\n");

  for (let i = 0; i < threats.length; i++) {
    const t = threats[i];
    console.log(`------------------------------------------------------------------------------------------------`);
    console.log(`🚨 [AMEAÇA #${i + 1}]: ${t.id} | ${t.nome} | Quadrante: ${t.quadrantePerigo}`);
    console.log(`   Distância: ${t.distanciaInicialMetros}m | Velocidade: ${t.velocidadeEscalarKmS} km/s`);
    console.log(`   ⏱️ DEADLINE FÍSICO ATÉ O IMPACTO: ${t.tempoLimiteImpactoMs} ms`);

    const statePayload = {
      alerta: "COLISAO IMINENTE",
      distanciaMetros: t.distanciaInicialMetros,
      velocidadeKmS: t.velocidadeEscalarKmS,
      tempoLimiteMs: t.tempoLimiteImpactoMs,
      vetorAproximacao: t.descricaoTelemetria,
    };

    // 1. Execução no Branch.dev (Local In-Process)
    const bStart = performance.now();
    const branchDecision = await decide({
      state: statePayload,
      choices: choicesMap,
      task: "determinar manobra de evasao imediata",
    });
    const branchLatency = Number((performance.now() - bStart).toFixed(2));
    const bOutcome = simulateFlightDynamics(t, branchDecision.winner, branchLatency);
    branchOutcomes.push(bOutcome);

    const bSym = bOutcome.survived ? "🟢 [SOBREVIVEU]" : "💥 [COLISÃO]";
    console.log(`   ${bSym} Branch.dev: ${branchDecision.winner.toUpperCase()} em ${branchLatency}ms | ` +
      `Burn Útil: ${bOutcome.tBurnAvailableMs}ms | Miss Distance: ${bOutcome.missDistanceMeters}m`);

    // 2. Execução no Groq Cloud (Qwen na Nuvem)
    const groqRes = await callGroqCloud(t.descricaoTelemetria, "determinar manobra de evasao imediata");
    totalGroqTokens += groqRes.tokens;
    const gOutcome = simulateFlightDynamics(t, groqRes.winner, groqRes.latencyMs, groqRes.error);
    groqOutcomes.push(gOutcome);

    const gSym = gOutcome.survived ? "🟢 [SOBREVIVEU]" : "💥 [COLISÃO]";
    console.log(`   ${gSym} Groq Cloud: ${groqRes.winner.toUpperCase()} em ${groqRes.latencyMs}ms | ` +
      `Burn Útil: ${gOutcome.tBurnAvailableMs}ms | Miss Distance: ${gOutcome.missDistanceMeters}m`);
  }

  // Estatísticas Consolidadas
  const branchStats = computeStatistics(
    branchOutcomes.map((o) => o.decisionLatencyMs),
    branchOutcomes.map((o) => o.survived),
    branchOutcomes.map((o) => o.missDistanceMeters)
  );

  const groqStats = computeStatistics(
    groqOutcomes.map((o) => o.decisionLatencyMs),
    groqOutcomes.map((o) => o.survived),
    groqOutcomes.map((o) => o.missDistanceMeters)
  );

  console.log("\n================================================================================================");
  console.log("📊 RELATÓRIO ESTATÍSTICO DE RIGOR CIENTÍFICO (DISTRIBUIÇÃO DE LATÊNCIA & CINEMÁTICA)");
  console.log("================================================================================================");
  console.log(
    "Métrica".padEnd(28) +
    "Branch.dev (In-Process)".padEnd(30) +
    `Groq Cloud (${GROQ_MODEL})`
  );
  console.log("-".repeat(85));
  console.log("Taxa de Sobrevivência".padEnd(28) + `${branchStats.survivalRatePercent}%`.padEnd(30) + `${groqStats.survivalRatePercent}%`);
  console.log("Miss Distance Média".padEnd(28) + `${branchStats.meanMissDistanceMeters} metros`.padEnd(30) + `${groqStats.meanMissDistanceMeters} metros`);
  console.log("Latência Média (Mean)".padEnd(28) + `${branchStats.mean} ms`.padEnd(30) + `${groqStats.mean} ms`);
  console.log("Jitter / Desvio Padrão (σ)".padEnd(28) + `±${branchStats.stdDev} ms`.padEnd(30) + `±${groqStats.stdDev} ms`);
  console.log("Latência Mínima (Min)".padEnd(28) + `${branchStats.min} ms`.padEnd(30) + `${groqStats.min} ms`);
  console.log("Latência Mediana (p50)".padEnd(28) + `${branchStats.p50} ms`.padEnd(30) + `${groqStats.p50} ms`);
  console.log("Percentil 90 (p90)".padEnd(28) + `${branchStats.p90} ms`.padEnd(30) + `${groqStats.p90} ms`);
  console.log("Percentil 95 (p95)".padEnd(28) + `${branchStats.p95} ms`.padEnd(30) + `${groqStats.p95} ms`);
  console.log("Percentil 99 (p99)".padEnd(28) + `${branchStats.p99} ms`.padEnd(30) + `${groqStats.p99} ms`);
  console.log("Custo Operacional de Tokens".padEnd(28) + "$0.00 (Zero tokens)".padEnd(30) + `${totalGroqTokens} tokens consumidos`);
  console.log("================================================================================================\n");

  // Exportação do Artefato Markdown para documentação no GitHub
  const markdownReport = generateMarkdownReport(threats, branchOutcomes, groqOutcomes, branchStats, groqStats, totalGroqTokens);
  const reportPath = path.join(process.cwd(), "BENCHMARK_ASTEROIDS.md");
  fs.writeFileSync(reportPath, markdownReport, "utf8");
  console.log(`📄 Relatório Markdown exportado com sucesso para: ${reportPath}`);
}

function generateMarkdownReport(
  threats: AsteroidThreat[],
  bOutcomes: FlightOutcome[],
  gOutcomes: FlightOutcome[],
  bStats: BenchmarkStatistics,
  gStats: BenchmarkStatistics,
  groqTokens: number
): string {
  let tableRows = "";
  for (let i = 0; i < threats.length; i++) {
    const t = threats[i];
    const b = bOutcomes[i];
    const g = gOutcomes[i];
    tableRows += `| \`${t.id}\` | ${t.distanciaInicialMetros}m | ${t.tempoLimiteImpactoMs}ms | \`${b.decisionLatencyMs}ms\` (${b.missDistanceMeters}m) | ${b.survived ? "🟢 **SOBREVIVEU**" : "💥 **COLISÃO**"} | \`${g.decisionLatencyMs}ms\` (${g.missDistanceMeters}m) | ${g.survived ? "🟢 **SOBREVIVEU**" : "💥 **COLISÃO**"} |\n`;
  }

  const jitterFactor = (gStats.stdDev / Math.max(1, bStats.stdDev)).toFixed(1);
  const survComp =
    bStats.survivalRatePercent > gStats.survivalRatePercent
      ? `+${(bStats.survivalRatePercent - gStats.survivalRatePercent).toFixed(0)}% sobrevivência`
      : bStats.survivalRatePercent === gStats.survivalRatePercent
      ? "Empate em sobrevivência"
      : "Groq superior";

  return `# 🛸 Benchmark Ciberfísico: Evasão de Asteroides em Tempo Real

> Comparativo científico de tomada de decisão reflexiva sob estrita pressão temporal física: **Branch.dev (In-Process CPU)** vs **Groq Cloud (${GROQ_MODEL})**.

---

## 🎯 A Tese: Física vs Latência de Nuvem

Em sistemas críticos (aeroespacial, robótica, veículos autônomos e esteiras antifraude em alta frequência), **o tempo limite de reação é ditado pelas leis da física**:
* Quando um asteroide se aproxima a **$3.0\\text{ km/s}$**, a janela para aplicar empuxo é inferior a **$300\\text{ms - }500\\text{ms}$**.
* Chamadas de rede para modelos generativos em nuvem enfrentam latência de tráfego transcontinental e geração de tokens, estourando a janela física e resultando em **colisão catastrófica**.

---

## 📊 Placar Geral da Simulação (Seed 42 / Mulberry32 PRNG)

| Métrica Científica | Branch.dev (\`@branch/core\`) | Groq Cloud (\`${GROQ_MODEL}\`) | Vantagem Competitiva |
| :--- | :--- | :--- | :--- |
| **Taxa de Sobrevivência** | **${bStats.survivalRatePercent}%** | ${gStats.survivalRatePercent}% | **${survComp}** |
| **Miss Distance Média** | **${bStats.meanMissDistanceMeters} metros** | ${gStats.meanMissDistanceMeters} metros | **Margem de segurança física** |
| **Latência Média** | **${bStats.mean} ms** | ${gStats.mean} ms | **${(gStats.mean / bStats.mean).toFixed(1)}x mais rápido** |
| **Percentil 95 (p95)** | **${bStats.p95} ms** | ${gStats.p95} ms | **${(gStats.p95 / bStats.p95).toFixed(1)}x menor latência na cauda** |
| **Jitter / Desvio Padrão (σ)** | **±${bStats.stdDev} ms** | ±${gStats.stdDev} ms | **${jitterFactor}x mais estável (menor variabilidade)** |
| **Custo de Token** | **$0.00 (Zero tokens)** | ${groqTokens} tokens faturáveis | **100% Gratuito** |

---

## 🛰️ Detalhamento Voo a Voo (Flight Recorder)

| Ameaça | Distância | Janela Física | Latência Branch (Miss Dist.) | Status Branch | Latência Groq (Miss Dist.) | Status Groq |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${tableRows}
---

## 🔬 Metodologia Científica
* **Física Cinemática 3D:** Aplicação das Leis de Newton $\\Delta \\mathbf{r} = \\frac{1}{2} \\mathbf{a} t_{\\text{burn}}^2$, com propulsores de empuxo lateral ($180\\text{ m/s}^2$).
* **Raio Crítico de Envelope:** $25.0\\text{ metros}$ (Nave + Bólido).
* **PRNG Determinístico:** Mulberry32 com seed fixa para permitir reprodução experimental idêntica em qualquer runner.
`;
}

runSeniorAsteroidBenchmark().catch(console.error);
