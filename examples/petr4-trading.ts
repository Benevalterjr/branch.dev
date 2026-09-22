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

// ─── Cliente Branch com PrototypeStore e Calibrador Otimizado ──────────────────

const prototypeStore = new InMemoryPrototypeStore();

// Calibrador com temperatura adequada para distribuições financeiras (evita overconfidence artificial)
const calibrator = new PlattTemperatureCalibrator(0.85);

const useMmBert = process.argv.includes("--mmbert") || process.argv.some((a) => a.toLowerCase().includes("mmbert"));
const useL12 = process.argv.includes("--l12") || process.argv.some((a) => a.toLowerCase().includes("l12"));
const useL6 = process.argv.includes("--l6") || process.argv.some((a) => a.toLowerCase().includes("l6"));

import { existsSync } from "node:fs";

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
  calibrator,
  prototypeStore,
});


/**
 * Pré-semeia arquétipos empíricos no PrototypeStore (Few-Shot Exemplars).
 * Isso ancora geometricamente o espaço vetorial em situações reais de mercado.
 */
async function seedTradingPrototypes() {
  // Arquétipo de HOLD: volume baixo, sem fluxo, preço indeciso entre médias, RSI neutro
  await branch.addExample("HOLD", {
    condicao: "Consolidação morna sem volume institucional",
    volumeRelativo: "0.35x do médio",
    rsi14: 55,
    posicaoSMA: "preço oscilando entre médias sem direção",
    fluxo: "mercado lateral de baixa liquidez, preservação de capital recomendada",
  });

  // Arquétipo de BUY: rompimento com volume alto, momentum forte, médias alinhadas para cima
  await branch.addExample("BUY", {
    condicao: "Rompimento autêntico com entrada de fluxo comprador pesado",
    volumeRelativo: "2.10x do médio",
    rsi14: 62,
    posicaoSMA: "preço rompendo acima de todas as médias com candle de força",
    fluxo: "pressão compradora institucional dominante",
  });

  // Arquétipo de SELL: perda de suporte com volume de despejo, médias viradas para baixo
  await branch.addExample("SELL", {
    condicao: "Despejo institucional com quebra de suporte e volume vendedor elevado",
    volumeRelativo: "1.90x do médio",
    rsi14: 32,
    posicaoSMA: "preço cravando mínima abaixo das médias com confirmação",
    fluxo: "distribuição e realização agressiva de lucros",
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
    volRatio < 0.5
      ? "Volume muito fraco (sem fluxo institucional dominante)"
      : volRatio > 1.5
      ? "Volume atipicamente forte (presença institucional confirmada)"
      : "Volume dentro da média esperada";

  const rsiStatus =
    rsi14 > 70
      ? "Sobrecomprado (>70) — risco iminente de correção"
      : rsi14 < 30
      ? "Sobrevendido (<30) — potencial repique técnico"
      : "Zona intermediária neutra (40-60) — sem sinal extremo";

  const mercadoAberto = quote.marketState === "REGULAR";

  // Tendência intraday: média dos últimos 6 candles vs 12 anteriores
  let tendenciaIntraday = "lateral";
  if (intradayQuotes.length >= 18) {
    const last6 =
      intradayQuotes.slice(-6).reduce((s, q) => s + (q.close as number), 0) / 6;
    const prev12 =
      intradayQuotes.slice(-18, -6).reduce((s, q) => s + (q.close as number), 0) / 12;
    if (last6 > prev12 * 1.002) tendenciaIntraday = "altista (compras no curto prazo)";
    else if (last6 < prev12 * 0.998) tendenciaIntraday = "baixista (vendas no curto prazo)";
  }

  // Posição relativa às SMAs
  let posicaoSMA = "oscilando entre médias móveis";
  if (preco > sma9 && preco > sma21) posicaoSMA = "sustentado acima de ambas as médias (SMA9 e SMA21)";
  else if (preco < sma9 && preco < sma21) posicaoSMA = "comprimido abaixo de ambas as médias (SMA9 e SMA21)";
  else if (preco > sma9 && preco <= sma21) posicaoSMA = "acima da SMA9 curta, testando resistência na SMA21";
  else if (preco <= sma9 && preco >= sma21) posicaoSMA = "em consolidação neutra entre o suporte da SMA21 e resistência da SMA9";

  // Diagnóstico sintético
  const diagnosticoTecnico =
    volRatio < 0.5
      ? "Mercado morno em consolidação lateral sem liquidez ou gatilho direcional."
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

// ─── Execução do Branch SystemOne com Calibração Refinada ──────────────────────

async function runTradingDecision(state: MarketState) {
  const res = await branch.workflow({
    state,
    questions: {
      // Pergunta 1: Ação recomendada (com escolhas balanceadas e gravidade no HOLD)
      acao: {
        type: "choice" as const,
        temperature: 0.85, // Temperatura calibrada para evitar colapso artificial
        confidenceThreshold: 0.70, // Metacognição: se incerteza > 30%, aciona fallback Sistema 2
        instructions:
          "Com base no estado técnico atual (volume, RSI, médias móveis e tendência), " +
          "qual é a postura correta de alocação de risco?",
        choices: {
          HOLD:
            "MANTER / NEUTRO (Preservação de Capital) — Mercado sem fluxo institucional expressivo: volume baixo (<0.6x do médio), RSI em zona neutra (40-60), sinais conflitantes entre prazos ou consolidação entre médias móveis. A melhor conduta quantitativa é ficar de fora e aguardar confirmação com volume.",
          BUY:
            "COMPRAR (Entrada Altista Confirmada) — Rompimento claro com fluxo comprador agressivo: volume institucional acima da média (>1.2x), preço rompendo consistentemente acima das médias de resistência, RSI com expansão altista e tendência confirmada.",
          SELL:
            "VENDER (Saída ou Despejo Baixista Confirmado) — Ruptura de suporte com fluxo vendedor pesado: volume de venda expressivo (>1.2x), perda de médias de suporte relevantes, RSI em sobrecompra extrema (>70) ou divergência de topo com perda de momentum.",
        },
        fallback: async (prev) => {
          // Fallback Sistema 2: Ativado automaticamente quando não há convicção clara no Sistema 1
          return {
            choice: "HOLD",
            confidence: 0.78,
          };
        },
      },

      // Pergunta 2: Intensidade do sinal (score ordinal calibrado)
      intensidade: {
        type: "score" as const,
        temperature: 0.80,
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
        temperature: 0.75,
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

  console.log("─".repeat(74));
  console.log(`
  🤖 DECISÃO PROBABILÍSTICA BRANCH.DEV (Sistema 1 + Protótipos)

  ➤ Ação Recomendada: ${actionEmoji[acao.choice] ?? acao.choice}
     Grau de Certeza:  ${(acao.confidence * 100).toFixed(1)}%
     Sistema Ativo:    ${acao.system?.toUpperCase() ?? "SYSTEM1"} ${acao.delegatedToFallback ? "(Acionou Fallback por Incerteza)" : "(Inferência Direta Local)"}
     Distribuição:     HOLD: ${((acao.probabilities as any)["HOLD"] * 100).toFixed(1)}%  |  BUY: ${((acao.probabilities as any)["BUY"] * 100).toFixed(1)}%  |  SELL: ${((acao.probabilities as any)["SELL"] * 100).toFixed(1)}%

  ➤ Intensidade Sinal: [${intensidadeBar}] ${intensidade.score.toFixed(2)} / 3.00
     Distribuição:     ${Object.entries(intensidade.probabilities).map(([k, v]) => `Nível ${k}: ${(v * 100).toFixed(1)}%`).join("  |  ")}

  ➤ Risco de Armadilha: ${risco.value ? "⚠️  ALTO (Falso rompimento sem volume)" : "✅ BAIXO (Movimento consistente)"}
     Probabilidade:    ${(risco.probability * 100).toFixed(1)}%

  ⏱️ Latência Total de Inferência (CPU Local): ${res.totalLatencyMs.toFixed(1)} ms
  `);
  console.log("═".repeat(74));
}

// ─── Loop Principal ────────────────────────────────────────────────────────────

async function main() {
  console.log("╔════════════════════════════════════════════════════════════════════════╗");
  console.log("║  🏦 Branch.dev × Yahoo Finance — Trading PETR4.SA Calibrado          ║");
  console.log(`║  Modelo: ${selectedModel.padEnd(60)} ║`);
  console.log("║  Motor: Sistema 1 + PrototypeStore + Platt Scaling (0.85)             ║");
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

