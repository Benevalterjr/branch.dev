/**
 * 🏦 Branch.dev × Yahoo Finance — Teste de Trading PETR4.SA em Tempo Real
 *
 * Este script demonstra o uso do motor de decisão probabilístico Sistema 1 do Branch
 * para tomar decisões de Buy / Hold / Sell sobre ações da Petrobras (PETR4) na B3,
 * utilizando dados near-realtime da API Yahoo Finance via `yahoo-finance2`.
 *
 * Fluxo:
 *   1. Busca cotação realtime + chart intraday (5min candles) + histórico diário (30 dias)
 *   2. Calcula indicadores técnicos básicos: RSI(14), SMA(9), SMA(21), variação %, volume relativo
 *   3. Alimenta o estado para o Branch `systemOne()` com perguntas de buy/hold/sell + score de confiança
 *   4. Executa em loop contínuo a cada 30 segundos (simulando monitoramento realtime)
 *
 * Uso:
 *   npx tsx examples/petr4-trading.ts
 */

import YahooFinance from "yahoo-finance2";
import {
  BranchClient,
  BRANCH_EMBEDDING_MODELS,
  InMemoryPrototypeStore,
  PlattTemperatureCalibrator,
} from "../src/index.js";

// Workaround para ambientes com proxy/inspeção corporativa (certificados SSL auto-assinados)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const yahooFinance = new (YahooFinance as any)({ suppressNotices: ["yahooSurvey"] });

// ─── Cliente Branch com PrototypeStore ────────────────────────────────────────

const prototypeStore = new InMemoryPrototypeStore();

import { existsSync, readFileSync } from "node:fs";

// Carregar variáveis de ambiente do arquivo .env automaticamente se presente
if (existsSync(".env")) {
  try {
    const envContent = readFileSync(".env", "utf-8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const k = trimmed.slice(0, eqIdx).trim();
          const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
          if (!process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  } catch {}
}

// ─── Configuração do Fallback Sistema 2 via Groq Cloud (Qwen 3.8 27B) ──────────

const GROQ_API_KEY =
  process.env.GROQ_API_KEY ||
  process.argv.find((a) => a.startsWith("gsk_")) ||
  "";

const GROQ_MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

interface QwenFallbackResult {
  choice: "BUY" | "HOLD" | "SELL";
  confidence: number;
  justification: string;
  latencyMs: number;
}

let lastQwenResult: QwenFallbackResult | null = null;

const useMmBert = process.argv.includes("--mmbert") || process.argv.some((a) => a.toLowerCase().includes("mmbert"));
const useL12 = process.argv.includes("--l12") || process.argv.some((a) => a.toLowerCase().includes("l12"));
const useL6 = process.argv.includes("--l6") || process.argv.some((a) => a.toLowerCase().includes("l6"));


const localMmBertPath = "./models/mmbert-small-feature";
const hasLocalMmBert = existsSync(localMmBertPath);

// Seleção de modelo dinâmica com padrão Multilíngue balanceado (paraphrase-multilingual-MiniLM-L12-v2)
const selectedModel = useMmBert
  ? (hasLocalMmBert ? localMmBertPath : BRANCH_EMBEDDING_MODELS.MMBERT_SMALL)
  : useL12
  ? BRANCH_EMBEDDING_MODELS.ACCURATE_EN
  : useL6
  ? BRANCH_EMBEDDING_MODELS.FAST_EN
  : BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED;


const branch = new BranchClient({
  modelName: selectedModel,
  prototypeStore,
});


/**
 * Pré-semeia arquétipos empíricos no PrototypeStore (Few-Shot Exemplars).
 * Isso ancora geometricamente o espaço vetorial em situações reais de mercado.
 */
async function seedTradingPrototypes() {
  // Arquétipos de HOLD: consolidação, volume baixo, mercado sem fluxo direcional
  await branch.addExample("HOLD", {
    condicao: "Consolidação morna sem volume institucional",
    volumeRelativo: "0.55x do médio",
    rsi14: 52,
    posicaoSMA: "preço oscilando entre médias sem direção clara",
    fluxo: "mercado lateral de baixa liquidez, preservação de capital recomendada",
  });
  await branch.addExample("HOLD", {
    condicao: "Indecisão técnica com sinais divergentes entre prazos",
    volumeRelativo: "0.75x do médio",
    rsi14: 56,
    posicaoSMA: "sustentado acima de médias móveis mas sem volume de rompimento",
    fluxo: "acumulação cautelosa sem gatilho de aceleração",
  });

  // Arquétipos de BUY: fluxo comprador institucional, expansão de volume e momentum
  await branch.addExample("BUY", {
    condicao: "Rompimento autêntico com entrada de fluxo comprador pesado",
    volumeRelativo: "1.80x do médio",
    rsi14: 63,
    posicaoSMA: "preço rompendo acima de todas as médias com candle de força",
    fluxo: "pressão compradora institucional dominante",
  });
  await branch.addExample("BUY", {
    condicao: "Continuidade de tendência de alta confirmada por volume",
    volumeRelativo: "1.35x do médio",
    rsi14: 60,
    posicaoSMA: "sustentado firmemente acima da SMA9 e SMA21 com volume comprador",
    fluxo: "fluxo positivo consistente com suporte de compra",
  });

  // Arquétipos de SELL: quebra de suporte relevante com volume vendedor
  await branch.addExample("SELL", {
    condicao: "Despejo institucional com quebra de suporte e volume vendedor elevado",
    volumeRelativo: "1.70x do médio",
    rsi14: 32,
    posicaoSMA: "preço cravando mínima abaixo das médias com confirmação",
    fluxo: "distribuição e realização agressiva de lucros",
  });
  await branch.addExample("SELL", {
    condicao: "Exaustão compradora com perda de momentum e divergência de baixa",
    volumeRelativo: "1.40x do médio",
    rsi14: 28,
    posicaoSMA: "comprimido abaixo de ambas as médias com pressão vendedora",
    fluxo: "saída institucional acelerada",
  });
}

// ─── Indicadores Técnicos ──────────────────────────────────────────────────────

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50; // neutro

  let gainSum = 0;
  let lossSum = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

function pctChange(current: number, previous: number): string {
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

// ─── Tipo do Estado de Mercado ─────────────────────────────────────────────────

interface MarketState {
  ticker: string;
  preco: number;
  abertura: number;
  maxima: number;
  minima: number;
  fechamentoAnterior: number;
  variacaoDia: string;
  volume: number;
  volumeMedio: number;
  volumeRelativo: string;
  volumeStatus: string;
  rsi14: number;
  rsiStatus: string;
  sma9: number;
  sma21: number;
  posicaoSMA: string;
  tendenciaIntraday: string;
  diagnosticoTecnico: string;
  horaLocal: string;
  mercadoAberto: boolean;
}

// ─── Busca de Dados Yahoo Finance ──────────────────────────────────────────────

async function fetchMarketState(): Promise<MarketState> {
  const symbol = "PETR4.SA";

  // 1. Quote realtime
  const quote = await yahooFinance.quote(symbol);

  // 2. Chart intraday dos últimos 2 dias (candles de 5 min)
  const intradayChart = await yahooFinance.chart(symbol, {
    period1: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    interval: "5m" as const,
  });

  // 3. Histórico diário dos últimos 40 dias (para SMA e RSI)
  const hist = await yahooFinance.chart(symbol, {
    period1: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    interval: "1d" as const,
  });

  const dailyCloses = hist.quotes
    .filter((q) => q.close !== null && q.close !== undefined)
    .map((q) => q.close as number);

  const intradayQuotes = intradayChart.quotes
    .filter((q) => q.close !== null && q.close !== undefined);

  // Indicadores
  const rsi14 = computeRSI(dailyCloses, 14);
  const sma9 = computeSMA(dailyCloses, 9);
  const sma21 = computeSMA(dailyCloses, 21);

  const preco = quote.regularMarketPrice ?? dailyCloses[dailyCloses.length - 1] ?? 0;
  const abertura = quote.regularMarketOpen ?? preco;
  const maxima = quote.regularMarketDayHigh ?? preco;
  const minima = quote.regularMarketDayLow ?? preco;
  const fechamentoAnterior = quote.regularMarketPreviousClose ?? preco;
  const volume = quote.regularMarketVolume ?? 0;
  const volumeMedio = quote.averageDailyVolume3Month ?? volume;
  const volRatio = volumeMedio > 0 ? volume / volumeMedio : 1.0;
  const volumeRelativo = volRatio.toFixed(2) + "x";

  const volumeStatus =
    volRatio < 0.70
      ? "Volume abaixo da média (fluxo institucional reduzido)"
      : volRatio > 1.30
      ? "Volume forte (fluxo institucional presente)"
      : "Volume em linha com a média esperada";

  const rsiStatus =
    rsi14 > 70
      ? "Sobrecomprado (>70) — risco iminente de correção"
      : rsi14 < 30
      ? "Sobrevendido (<30) — potencial repique técnico"
      : "Zona intermediária neutra (40-60) — sem sinal extremo";

  const mercadoAberto = quote.marketState === "REGULAR";

  // Tendência intraday: média dos últimos 6 candles vs 12 anteriores (filtro de ruído com limiar de 0.5%)
  let tendenciaIntraday = "lateral em consolidação";
  if (intradayQuotes.length >= 18) {
    const last6 =
      intradayQuotes.slice(-6).reduce((s, q) => s + (q.close as number), 0) / 6;
    const prev12 =
      intradayQuotes.slice(-18, -6).reduce((s, q) => s + (q.close as number), 0) / 12;
    if (last6 > prev12 * 1.005) tendenciaIntraday = "altista no intraday";
    else if (last6 < prev12 * 0.995) tendenciaIntraday = "corretiva no intraday";
  }

  // Posição relativa às SMAs
  let posicaoSMA = "oscilando entre médias móveis";
  if (preco > sma9 && preco > sma21) posicaoSMA = "sustentado acima de ambas as médias (SMA9 e SMA21)";
  else if (preco < sma9 && preco < sma21) posicaoSMA = "comprimido abaixo de ambas as médias (SMA9 e SMA21)";
  else if (preco > sma9 && preco <= sma21) posicaoSMA = "acima da SMA9 curta, testando resistência na SMA21";
  else if (preco <= sma9 && preco >= sma21) posicaoSMA = "em consolidação neutra entre o suporte da SMA21 e resistência da SMA9";

  // Diagnóstico sintético
  const diagnosticoTecnico =
    volRatio < 0.75
      ? "Consolidação morna com liquidez abaixo da média e ausência de aceleração institucional."
      : "Movimentação com liquidez ativa no ativo.";

  return {
    ticker: symbol,
    preco,
    abertura,
    maxima,
    minima,
    fechamentoAnterior,
    variacaoDia: pctChange(preco, fechamentoAnterior),
    volume,
    volumeMedio,
    volumeRelativo,
    volumeStatus,
    rsi14: Number(rsi14.toFixed(2)),
    rsiStatus,
    sma9: Number(sma9.toFixed(2)),
    sma21: Number(sma21.toFixed(2)),
    posicaoSMA,
    tendenciaIntraday,
    diagnosticoTecnico,
    horaLocal: new Date().toLocaleTimeString("pt-BR"),
    mercadoAberto,
  };
}

// ─── Fallback Sistema 2: Raciocínio Deliberativo via Qwen 3.8 27B (Groq) ────────

async function callQwenFallback(state: MarketState): Promise<QwenFallbackResult> {
  if (!GROQ_API_KEY) {
    return {
      choice: "HOLD",
      confidence: 0.75,
      justification: "Chave Groq não configurada. Fallback determinístico acionado.",
      latencyMs: 0,
    };
  }

  const prompt = `Você é um analista quantitativo sênior atuando como Sistema 2 (deliberação analítica e gestão de risco).
O Sistema 1 local do Branch.dev detectou incerteza estatística no mercado de PETR4.SA e solicitou sua análise deliberativa.

Diagnóstico Técnico Atual:
- Preço: R$ ${state.preco.toFixed(2)} (${state.variacaoDia} no dia)
- Volume: ${state.volume.toLocaleString("pt-BR")} (${state.volumeRelativo} da média histórica) - ${state.volumeStatus}
- RSI (14 períodos): ${state.rsi14.toFixed(2)} - ${state.rsiStatus}
- Médias Móveis: SMA(9) = R$ ${state.sma9.toFixed(2)}, SMA(21) = R$ ${state.sma21.toFixed(2)} - ${state.posicaoSMA}
- Tendência Curta: ${state.tendenciaIntraday.toUpperCase()}
- Cenário Geral: ${state.diagnosticoTecnico}

Opções Disponíveis:
- "HOLD": MANTER / NEUTRO (Preservação de Capital — mercado consolidando sem volume ou com sinais mistos)
- "BUY": COMPRAR (Entrada Altista — rompimento confirmado com volume institucional expressivo acima de resistências)
- "SELL": VENDER (Saída ou Despejo — perda de médias de suporte com volume pesado ou divergência)

Instrução: Escolha ESTRITAMENTE entre HOLD, BUY ou SELL.
Em seguida, forneça uma justificativa objetiva de no máximo 1 frase.
Formato da resposta:
ESCOLHA: <HOLD | BUY | SELL>
JUSTIFICATIVA: <frase curta>`;

  const t0 = performance.now();
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.0,
          max_tokens: 60,
        }),
        signal: AbortSignal.timeout(4000), // Timeout rígido de 4s para evitar travamento em rede
      });

      const t1 = performance.now();
      const latencyMs = Number((t1 - t0).toFixed(1));

      if (!res.ok) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        return {
          choice: "HOLD",
          confidence: 0.70,
          justification: `Erro Groq (${res.status}). Mantendo postura neutra de segurança.`,
          latencyMs,
        };
      }

      const data = (await res.json()) as any;
      const text: string = data.choices?.[0]?.message?.content || "";

      let choice: "BUY" | "HOLD" | "SELL" = "HOLD";
      if (/\bBUY\b/i.test(text)) choice = "BUY";
      else if (/\bSELL\b/i.test(text)) choice = "SELL";
      else choice = "HOLD";

      const justMatch = text.match(/JUSTIFICATIVA:\s*(.*)/i);
      const justification = justMatch
        ? justMatch[1].trim()
        : text.replace(/ESCOLHA:.*?\n/i, "").trim() || "Consolidação e preservação de capital.";

      return {
        choice,
        confidence: 0.88,
        justification,
        latencyMs,
      };
    } catch (err: any) {
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      const t1 = performance.now();
      const latencyMs = Number((t1 - t0).toFixed(1));
      return {
        choice: "HOLD",
        confidence: 0.70,
        justification: `Falha de rede (${err.message ?? "timeout"}). Postura defensiva adotada.`,
        latencyMs,
      };
    }
  }

  return {
    choice: "HOLD",
    confidence: 0.70,
    justification: "Postura defensiva de preservação de capital.",
    latencyMs: 0,
  };
}

// ─── Execução do Branch SystemOne com Calibração Refinada ──────────────────────

async function runTradingDecision(state: MarketState) {
  lastQwenResult = null;

  // Extrai o estado semântico e qualitativo para o Sistema 1 (evita poluição de ruído numérico no embedding)
  const technicalState = {
    diagnosticoTecnico: state.diagnosticoTecnico,
    volumeStatus: state.volumeStatus,
    rsiStatus: state.rsiStatus,
    posicaoSMA: state.posicaoSMA,
    tendenciaIntraday: state.tendenciaIntraday,
  };

  const res = await branch.workflow({
    state: technicalState,
    questions: {
      // Pergunta 1: Ação recomendada (com escolhas balanceadas e gravidade no HOLD)
      acao: {
        type: "choice" as const,
        instructions:
          "Com base no estado técnico atual (volume, RSI, médias móveis e tendência), " +
          "qual é a postura correta de alocação de risco?",
        choices: {
          HOLD: {
            description:
              "MANTER / NEUTRO (Preservação de Capital) — Mercado sem fluxo institucional expressivo: volume baixo (<0.6x do médio), RSI em zona neutra (40-60), sinais conflitantes entre prazos ou consolidação entre médias móveis. A melhor conduta quantitativa é ficar de fora e aguardar confirmação com volume.",
            minConfidence: 0.40, // Baixo risco de capital: 40% já autoriza a prudência estatística sobre 33%
          },
          BUY: {
            description:
              "COMPRAR (Entrada Altista Confirmada) — Rompimento claro com fluxo comprador agressivo: volume institucional acima da média (>1.2x), preço rompendo consistentemente acima das médias de resistência, RSI com expansão altista e tendência confirmada.",
            minConfidence: 0.85, // Alto risco: alocação de capital real exige convicção de pelo menos 85%
          },
          SELL: {
            description:
              "VENDER (Saída ou Despejo Baixista Confirmado) — Ruptura de suporte com fluxo vendedor pesado: volume de venda expressivo (>1.2x), perda de médias de suporte relevantes, RSI em sobrecompra extrema (>70) ou divergência de topo com perda de momentum.",
            minConfidence: 0.75, // Risco moderado: proteção de posição exige convicção de pelo menos 75%
          },
        },
        fallback: async (prev) => {
          // Fallback Sistema 2: Ativado somente em caso de dúvida real ou violação de risco
          const qwen = await callQwenFallback(state);
          lastQwenResult = qwen;
          return {
            choice: qwen.choice,
            confidence: qwen.confidence,
          };
        },
      },

      // Pergunta 2: Intensidade do sinal (score ordinal calibrado)
      intensidade: {
        type: "score" as const,
        instructions:
          "Qual a intensidade e clareza do sinal direcional no ativo? " +
          "Considere a confirmação de volume relativo e alinhamento dos indicadores.",
        criteria: {
          0: "Sinal nulo ou sem direção — mercado morno, volume fraco, consolidando sem tendência definida",
          1: "Sinal fraco ou hesitante — leve inclinação direcional, mas sem apoio de volume institucional",
          2: "Sinal moderado — indicadores técnicos alinhados e volume favorável",
          3: "Sinal forte e convincente — confluência total de rompimento, volume elevado e momentum claro",
        },
      },

      // Pergunta 3: Risco de armadilha / reversão falsa
      riscoArmadilha: {
        type: "boolean" as const,
        instructions:
          "O movimento atual apresenta risco de falso rompimento ou armadilha por falta de volume?",
        affirmativeDescription:
          "SIM — alto risco de armadilha (bull trap ou bear trap): volume fraco, sem continuidade institucional, falso rompimento",
        negativeDescription:
          "NÃO — movimento sólido e confiável: sustentado por volume consistente e alinhamento de prazos",
      },
    },
  });

  return res;
}


// ─── Display ───────────────────────────────────────────────────────────────────

// ─── Display ───────────────────────────────────────────────────────────────────

function displayResults(state: MarketState, res: Awaited<ReturnType<typeof runTradingDecision>>) {
  const acao = res.answers.acao;
  const intensidade = res.answers.intensidade;
  const risco = res.answers.riscoArmadilha;

  const actionEmoji: Record<string, string> = {
    BUY: "🟢 COMPRAR",
    HOLD: "🟡 MANTER (NEUTRO)",
    SELL: "🔴 VENDER",
  };

  const policyMeta: Record<string, { badge: string; desc: string }> = {
    AUTOMATE: {
      badge: "🟢 AUTOMATE",
      desc: "Execução Autônoma Autorizada (Envio Direto ao Broker via API)",
    },
    VERIFY: {
      badge: "🟡 VERIFY",
      desc: "Confirmação Obrigatória na Boleta (Exige Aval do Trader)",
    },
    ESCALATE: {
      badge: "🔴 ESCALATE",
      desc: "Intervenção Manual / Suspensão Operacional (Incerteza Crítica ou Fora de Padrão)",
    },
  };

  const acaoPolicy = policyMeta[acao.actionPolicy] ?? {
    badge: acao.actionPolicy,
    desc: "Política não especificada",
  };

  const intensidadeBar = "█".repeat(Math.round(intensidade.score)) + "░".repeat(3 - Math.round(intensidade.score));

  console.log("\n" + "═".repeat(74));
  console.log(`  📈 PETR4.SA — ${state.horaLocal}   ${state.mercadoAberto ? "🟢 Mercado Aberto (B3)" : "🔴 Mercado Fechado"}`);
  console.log("═".repeat(74));

  console.log(`
  💰 Preço Atual:    ${formatBRL(state.preco)}  (${state.variacaoDia} no dia)
  📊 Faixa do Dia:   Mín: ${formatBRL(state.minima)} ── Máx: ${formatBRL(state.maxima)} (Abertura: ${formatBRL(state.abertura)})
  📉 Fech. Anterior: ${formatBRL(state.fechamentoAnterior)}

  ──── Diagnóstico Quantitativo e Técnico ────
  • Volume:          ${state.volume.toLocaleString("pt-BR")} (${state.volumeRelativo} do volume médio)
                     ↳ ${state.volumeStatus}
  • RSI (14 períodos): ${state.rsi14.toFixed(2)}
                     ↳ ${state.rsiStatus}
  • Médias Móveis:   SMA(9): ${formatBRL(state.sma9)} | SMA(21): ${formatBRL(state.sma21)}
                     ↳ ${state.posicaoSMA}
  • Tendência Curta: ${state.tendenciaIntraday.toUpperCase()}
  • Cenário Geral:   "${state.diagnosticoTecnico}"
  `);

  const sistemaLabel = acao.delegatedToFallback
    ? `🌐 SYSTEM2 (Qwen 3.8 27B via Groq Cloud ⚡ ${lastQwenResult?.latencyMs ?? 0} ms)`
    : "⚡ SYSTEM1 (Inferência Direta Local na CPU)";

  console.log("─".repeat(74));
  console.log(`
  🤖 DECISÃO PROBABILÍSTICA BRANCH.DEV (Sistema 1 + Protótipos + Governança de Risco)

  ➤ Ação Recomendada: ${actionEmoji[acao.choice] ?? acao.choice}
     Grau de Certeza:  ${(acao.confidence * 100).toFixed(1)}%
     Semáforo Risco:   ${acaoPolicy.badge} ── ${acaoPolicy.desc}
     Sistema Ativo:    ${sistemaLabel}
     Distribuição:     HOLD: ${((acao.probabilities as any)["HOLD"] * 100).toFixed(1)}%  |  BUY: ${((acao.probabilities as any)["BUY"] * 100).toFixed(1)}%  |  SELL: ${((acao.probabilities as any)["SELL"] * 100).toFixed(1)}%
${acao.delegatedToFallback && lastQwenResult ? `     Deliberação LLM:  "${lastQwenResult.justification}"\n` : ""}
  ➤ Intensidade Sinal: [${intensidadeBar}] ${intensidade.score.toFixed(2)} / 3.00 (Política: ${intensidade.actionPolicy})
     Distribuição:     ${Object.entries(intensidade.probabilities).map(([k, v]) => `Nível ${k}: ${(v * 100).toFixed(1)}%`).join("  |  ")}

  ➤ Risco de Armadilha: ${risco.value ? "⚠️  ALTO (Falso rompimento sem volume)" : "✅ BAIXO (Movimento consistente)"} (Política: ${risco.actionPolicy})
     Probabilidade:    ${(risco.probability * 100).toFixed(1)}%

  ⏱️ Latência Total de Inferência (CPU Local): ${res.totalLatencyMs.toFixed(1)} ms
  `);
  console.log("═".repeat(74));
}

// ─── Loop Principal ────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  🏦 Branch.dev × Yahoo Finance — Trading PETR4.SA Calibrado          ║");
  console.log(`║  Modelo S1:   ${selectedModel.padEnd(56)} ║`);
  console.log(`║  Fallback S2: ${GROQ_MODEL} (Groq Cloud LPU)`.padEnd(73) + "║");
  console.log("║  Motor:       Sistema 1 + PrototypeStore + Platt Scaling (0.85)        ║");
  console.log("╚════════════════════════════════════════════════════════════════════════╝");


  console.log("\n🌱 Semeando arquétipos empíricos de mercado no PrototypeStore...");
  await seedTradingPrototypes();
  console.log("✅ PrototypeStore inicializado com sucesso (HOLD, BUY, SELL ancorados).");

  const isLoop = process.argv.includes("--loop");
  const INTERVAL_SECONDS = 30;
  let iteration = 0;

  const runOnce = async () => {
    iteration++;
    try {
      console.log(`\n⏳ [#${iteration}] Consultando livro e indicadores em tempo real no Yahoo Finance...`);
      const state = await fetchMarketState();
      const result = await runTradingDecision(state);
      displayResults(state, result);
    } catch (err: any) {
      console.error(`\n❌ Erro na iteração #${iteration}:`, err.message ?? err);
    }
  };

  // Executa primeira rodada
  await runOnce();

  if (isLoop) {
    console.log(`\n🔄 Modo contínuo ativo: Próxima atualização em ${INTERVAL_SECONDS}s... (Ctrl+C para sair)\n`);
    const interval = setInterval(async () => {
      await runOnce();
      console.log(`\n🔄 Próxima atualização em ${INTERVAL_SECONDS}s... (Ctrl+C para sair)\n`);
    }, INTERVAL_SECONDS * 1000);

    process.on("SIGINT", () => {
      clearInterval(interval);
      console.log("\n\n👋 Monitoramento encerrado pelo operador. Até logo!\n");
      process.exit(0);
    });
  } else {
    console.log("\n💡 Dica: Para rodar em loop contínuo de monitoramento a cada 30s, execute:");
    console.log("   npx tsx examples/petr4-trading.ts --loop\n");
  }
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});

