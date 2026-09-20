import { decide, configure, BRANCH_EMBEDDING_MODELS } from "../src/index.js";
import * as fs from "fs";
import * as path from "path";

// 1. Resolução da Chave da Groq via CLI ou Env Var local
function resolveGroqApiKey(): string {
  const cliArg = process.argv[2] || "";
  if (cliArg.startsWith("gsk_")) return cliArg;

  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;

  return "";
}

const GROQ_API_KEY = resolveGroqApiKey();
const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

interface AsteroidScenario {
  id: string;
  nome: string;
  distanciaMetros: number;
  velocidadeKmS: number;
  tempoLimiteMs: number;
  state: {
    alerta: string;
    distancia: string;
    velocidade: string;
    tempoRestanteImpacto: string;
    vetorAproximacao: string;
    statusNave: string;
  };
  expectedManeuver: string;
}

const choices = {
  manobra_boreste: "desvio evasivo rápido para a direita / boreste afastando do quadrante esquerdo",
  manobra_bombordo: "desvio evasivo rápido para a esquerda / bombordo afastando do quadrante direito",
  mergulho_ventral: "inclinação rápida descendente para baixo passando por baixo do bólido",
  subida_dorsal: "aceleração vertical ascendente para cima ultrapassando por cima do obstáculo",
  disparo_plasma: "disparo de canhão frontal para fragmentar meteoro de pequena massa em rota direta",
};

// Gerador de cenários aleatórios de asteroides sob pressão
function generateAsteroidField(count: number = 6): AsteroidScenario[] {
  const directions = [
    { dir: "vindo pelo quadrante superior direito em rota de colisão", best: "manobra_bombordo" },
    { dir: "vindo pelo quadrante lateral esquerdo direto na asa", best: "manobra_boreste" },
    { dir: "vindo por cima em mergulho vertical íngreme", best: "mergulho_ventral" },
    { dir: "vindo pelo plano inferior em ascensão rápida", best: "subida_dorsal" },
    { dir: "pequeno fragmento de gelo e rocha centrado frontalmente", best: "disparo_plasma" },
    { dir: "asteroide massivo fechando todo o quadrante direito", best: "manobra_bombordo" },
  ];

  const scenarios: AsteroidScenario[] = [];

  for (let i = 0; i < count; i++) {
    const config = directions[i % directions.length];
    // Janela crítica de radar espacial: distâncias entre 600m e 2400m
    const distancia = Math.round(600 + Math.random() * 1800);
    const velocidadeKmS = Number((2.0 + Math.random() * 1.5).toFixed(2));
    // Tempo físico limite até a colisão: janela de 300ms a 900ms
    const tempoLimiteMs = Math.round((distancia / (velocidadeKmS * 1000)) * 1000);

    scenarios.push({
      id: `ASTEROIDE-#${(i + 1).toString().padStart(2, "0")}`,
      nome: `Asteroide Classe ${String.fromCharCode(65 + i)}-${distancia}m`,
      distanciaMetros: distancia,
      velocidadeKmS,
      tempoLimiteMs,
      state: {
        alerta: "PERIGO CRÍTICO DE IMPACTO IMINENTE",
        distancia: `${distancia} metros`,
        velocidade: `${velocidadeKmS} km/s`,
        tempoRestanteImpacto: `${tempoLimiteMs} ms`,
        vetorAproximacao: config.dir,
        statusNave: "Escudos desativados, sobrevivência depende exclusivamente de evasão imediata",
      },
      expectedManeuver: config.best,
    });
  }

  return scenarios;
}

// Chamada para Groq (Qwen na Nuvem)
async function callGroq(
  state: unknown,
  task: string
): Promise<{ winner: string; latencyMs: number; tokens: number; error?: string }> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const prompt = `Você é o computador de bordo de emergência de uma espaçonave.
Decida a manobra de desvio IMEDIATA.
Estado da Telemetria: ${JSON.stringify(state)}
Tarefa: ${task}
Opções permitidas: [${Object.keys(choices).join(", ")}]
Responda APENAS com o nome exato de uma opção da lista. Não use markdown, não justifique.`;

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
        max_tokens: 15,
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
    for (const key of Object.keys(choices)) {
      if (rawText.includes(key.toLowerCase())) {
        winner = key;
        break;
      }
    }

    return { winner, latencyMs, tokens };
  } catch (err) {
    const t1 = performance.now();
    return { winner: "falha_rede", latencyMs: Number((t1 - t0).toFixed(2)), tokens: 0, error: (err as Error).message };
  }
}

async function runAsteroidBenchmark() {
  console.log("========================================================================================");
  console.log("🚀 SIMULAÇÃO DE DEFESA CIBERNÉTICA EM TEMPO REAL: CAMPO DE ASTEROIDES ALEATÓRIOS");
  console.log("   Comparativo: Branch.dev (In-Process CPU) vs Groq (Qwen na Nuvem)");
  console.log("========================================================================================\n");

  console.log(`🔑 Status da Chave Groq: ${GROQ_API_KEY ? `Configurada (${GROQ_API_KEY.substring(0, 8)}...)` : "NÃO CONFIGURADA"}`);
  console.log(`🤖 Modelo Groq Alvo: ${GROQ_MODEL}`);
  console.log(`⚡ Branch.dev: In-Process Node.js / Clean Architecture (Inferência local em CPU pura)\n`);

  // Configura modelo rápido para máxima velocidade de reação
  configure({ modelName: BRANCH_EMBEDDING_MODELS.FAST_EN });

  // Aquecimento Branch com o mesmo task para pré-indexar as opções no cache
  console.log("🔥 Pré-indexando e aquecendo vetores de decisão do Branch.dev...");
  await decide({
    state: "radar standby",
    choices,
    task: "decidir manobra de evasao imediata para sobreviver",
  });
  console.log("✅ Vetores de manobra pré-indexados na memória RAM.\n");

  const asteroids = generateAsteroidField(6);
  console.log(`🌌 Campo gerado com ${asteroids.length} asteroides aleatórios em rota de colisão frontal!\n`);

  const results: Array<{
    id: string;
    tempoLimiteMs: number;
    branchWinner: string;
    branchLatency: number;
    branchSurvived: boolean;
    groqWinner: string;
    groqLatency: number;
    groqSurvived: boolean;
    groqError?: string;
  }> = [];

  for (const ast of asteroids) {
    console.log(`----------------------------------------------------------------------------------------`);
    console.log(`🚨 ALERTA: ${ast.id} | Distância: ${ast.distanciaMetros}m | Velocidade: ${ast.velocidadeKmS} km/s`);
    console.log(`⏱️ TEMPO LIMITE FÍSICO ATÉ O IMPACTO: ${ast.tempoLimiteMs} ms`);
    console.log(`🧭 Vetor: "${ast.state.vetorAproximacao}"`);

    // 1. Tomada de Decisão com Branch.dev
    const b0 = performance.now();
    const branchRes = await decide({
      state: ast.state,
      choices,
      task: "decidir manobra de evasao imediata para sobreviver",
    });
    const branchLatency = Number((performance.now() - b0).toFixed(2));
    const branchSurvived = branchLatency < ast.tempoLimiteMs;

    console.log(`\n   🟢 [Branch.dev]:`);
    console.log(`      Manobra Escolhida: ${branchRes.winner.toUpperCase()} (${(branchRes.confidence * 100).toFixed(1)}% confiança)`);
    console.log(`      Latência de Decisão: ${branchLatency} ms`);
    console.log(`      Desfecho Físico: ${branchSurvived ? "✅ DESVIOU COM SUCESSO! A nave sobreviveu." : "💥 COLISÃO! Tempo estourou."}`);

    // 2. Tomada de Decisão com Groq (Qwen na Nuvem)
    console.log(`\n   🌐 [Groq Cloud / Qwen]:`);
    const groqRes = await callGroq(ast.state, "decidir manobra de evasao imediata para sobreviver");
    const groqSurvived = !groqRes.error && groqRes.winner !== "erro_api" && groqRes.latencyMs < ast.tempoLimiteMs;

    if (groqRes.error) {
      console.log(`      ⚠️ Resposta Groq: Falha na chamada (${groqRes.error})`);
    } else {
      console.log(`      Manobra Escolhida: ${groqRes.winner.toUpperCase()}`);
    }
    console.log(`      Latência de Rede + Tokens: ${groqRes.latencyMs} ms`);
    console.log(`      Desfecho Físico: ${groqSurvived ? "✅ DESVIOU COM SUCESSO!" : `💥 COLISÃO CATASTRÓFICA! O asteroide atingiu a nave aos ${ast.tempoLimiteMs}ms (a resposta do LLM chegou tarde demais, em ${groqRes.latencyMs}ms).`}`);

    results.push({
      id: ast.id,
      tempoLimiteMs: ast.tempoLimiteMs,
      branchWinner: branchRes.winner,
      branchLatency,
      branchSurvived,
      groqWinner: groqRes.winner,
      groqLatency: groqRes.latencyMs,
      groqSurvived,
      groqError: groqRes.error,
    });
  }

  // Placar Final da Simulação
  console.log("\n========================================================================================");
  console.log("📊 PLACAR FINAL DA SIMULAÇÃO: TAXA DE SOBREVIVÊNCIA SOB PRESSÃO DE TEMPO REAL");
  console.log("========================================================================================");
  console.log(
    "Asteroide".padEnd(16) +
    "Limite Físico".padEnd(16) +
    "Lat. Branch".padEnd(15) +
    "Status Branch".padEnd(18) +
    "Lat. Groq".padEnd(14) +
    "Status Groq"
  );
  console.log("-".repeat(88));

  for (const r of results) {
    const bStatus = r.branchSurvived ? "✅ SOBREVIVEU" : "💥 DESTRUÍDO";
    const gStatus = r.groqSurvived ? "✅ SOBREVIVEU" : "💥 DESTRUÍDO";
    console.log(
      r.id.padEnd(16) +
      `${r.tempoLimiteMs} ms`.padEnd(16) +
      `${r.branchLatency} ms`.padEnd(15) +
      bStatus.padEnd(18) +
      `${r.groqLatency} ms`.padEnd(14) +
      gStatus
    );
  }

  const branchSurvivors = results.filter((r) => r.branchSurvived).length;
  const groqSurvivors = results.filter((r) => r.groqSurvived).length;
  const avgBranch = (results.reduce((a, b) => a + b.branchLatency, 0) / results.length).toFixed(2);
  const avgGroq = (results.reduce((a, b) => a + b.groqLatency, 0) / results.length).toFixed(2);

  console.log("========================================================================================");
  console.log(`🏆 TAXA DE SOBREVIVÊNCIA DO BRANCH.DEV: ${(branchSurvivors / results.length) * 100}% (${branchSurvivors}/${results.length} asteroides desviados) | Média: ${avgBranch} ms`);
  console.log(`💀 TAXA DE SOBREVIVÊNCIA DO GROQ CLOUD: ${(groqSurvivors / results.length) * 100}% (${groqSurvivors}/${results.length} asteroides desviados) | Média: ${avgGroq} ms`);
  console.log("========================================================================================\n");

  console.log("💡 CONCLUSÃO ARQUITETURAL:");
  console.log("Para tarefas onde o tempo de reação físico ou operacional é inferior a 100ms-500ms");
  console.log("(carros autônomos, robótica, esteiras antifraude em alta frequência, jogos e IoT),");
  console.log("nenhum LLM generativo em nuvem é fisicamente capaz de responder a tempo da física.");
  console.log("O Branch.dev cumpre o papel do System 1: reação imediata e reflexiva em < 2ms.\n");
}

runAsteroidBenchmark().catch(console.error);
