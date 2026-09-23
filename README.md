<p align="center">
  <img src="assets/logo.svg" width="72" height="72" alt="Branch.dev Logo" />
</p>

# ⚡ Branch.dev (`@branch/core`)

[![CI](https://github.com/Benevalterjr/branch.dev/actions/workflows/ci.yml/badge.svg)](https://github.com/Benevalterjr/branch.dev/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933.svg)](https://nodejs.org/)

> **The Smart If-Statement for Modern Code.**  
> Decisões probabilísticas tipadas, calibradas e auditáveis em **CPU pura**, sem geração de texto, sem chamadas autoregressivas e sem chaves de API.

---

## 🎯 Por que o Branch.dev?

Enquanto LLMs generativos (ChatGPT, Claude) levam **2.000 ms a 10.000 ms** para gerar texto, torram tokens a cada decisão e quebram contratos de tipo em JSON:

* **100% Local & CPU-Native:** Roda direto no processo Node.js / TypeScript sobre **`onnxruntime-node` oficial** e **`@huggingface/tokenizers` (Rust)**. Zero chave de API, zero cartão de crédito e 0 vulnerabilidades.
* **Metacognição & Fallback Sistema 1 ➔ Sistema 2:** O motor estima a própria certeza (`confidence`, `isOOD`, `actProbability`). Se a incerteza for alta ou o dado for Out-of-Distribution, delega graciosamente a um fallback (LLM em nuvem ou operador humano).
* **Single Forward Pass Batching:** Avalia múltiplas perguntas sobre o mesmo estado em uma única passada vetorial pelo modelo na CPU, reduzindo a latência de workflows para ~200 ms.
* **Calibração por Bucket de Cardinalidade (`tempBucket`):** Mapeamento empírico da temperatura de Platt scaling para 2, 3-5, 6-10 e 11+ opções, evitando subconfiança em binárias e colapso de entropia em conjuntos amplos.
* **Zero Tokens & Zero KV Cache (GPULESS):** Elimina a geração autoregressiva. Executa similaridade geométrica com **TurboQuant** (produto escalar otimizado e quantização online).
* **Aprendizado Contínuo Sem Re-treinamento:** Ancoragem por **`PrototypeStore`** (centróides semânticos few-shot) e calibração adaptativa online via SGD e Brier Score.
* **Clean Architecture Estrita:** Desacoplamento total entre Domínio, Casos de Uso, Infraestrutura e Apresentação.

---

## 🏗️ Arquitetura (Clean Architecture)

```
src/
├── domain/                         # Enterprise Business Rules (Zero dependências externas)
│   ├── entities/
│   │   ├── decision.entity.ts      # Entidade Decision (vencedor, probabilidades, guard clauses)
│   │   ├── boolean-decision.entity.ts # Entidade de Decisão Binária / Noul
│   │   ├── score-decision.entity.ts   # Entidade de Decisão Ordinal / Valor Esperado E[X]
│   │   ├── probability.vo.ts       # Value Object de Distribuição de Probabilidades
│   │   └── state-context.vo.ts     # Value Object para canonicalização semântica do estado
│   ├── ports/                      # Interfaces / Contratos de Domínio
│   │   ├── embedding-model.port.ts # Porta de vetorização
│   │   ├── calibrator.port.ts      # Porta de calibração estatística e CardinalityBucket
│   │   ├── decision-engine.port.ts # Porta abstrata do motor (evaluate e evaluateBatch)
│   │   ├── adaptive-calibrator.port.ts # Porta para calibração adaptativa online
│   │   ├── prototype-store.port.ts # Porta para centróides e few-shot exemplars
│   │   └── feedback-store.port.ts  # Porta para rastreabilidade e auditoria de feedbacks
│   └── exceptions/
│       └── domain-exceptions.ts    # Exceções de Domínio (LowConfidenceException, InvalidState)
│
├── application/                    # Application Business Rules
│   ├── dtos/
│   │   ├── decide-request.dto.ts   # DTOs tipados com fallback e confidenceThreshold
│   │   ├── decide-response.dto.ts  # DTOs de retorno (system, actProbability, delegatedToFallback)
│   │   ├── boolean-request.dto.ts  # DTOs da Primitiva Boolean
│   │   ├── score-request.dto.ts    # DTOs da Primitiva Score
│   │   └── workflow-request.dto.ts # DTOs de Workflow com Mapped Types e inferência estrita
│   └── use-cases/
│       ├── make-decision.use-case.ts   # Orquestrador da primitiva Choice + Fallback
│       ├── evaluate-boolean.use-case.ts# Orquestrador da primitiva Boolean + Fallback
│       ├── evaluate-score.use-case.ts  # Orquestrador da primitiva Score + Fallback
│       └── run-workflow.use-case.ts    # Execução em lote vetorial unificado (Single Pass)
│
├── infrastructure/                 # Frameworks & Drivers
│   ├── adapters/
│   │   ├── onnx-embedding.adapter.ts          # ONNX Runtime CPU + HF Tokenizers + Schannel download
│   │   ├── platt-calibrator.adapter.ts        # Calibrador Platt com buckets de cardinalidade
│   │   ├── adaptive-platt-calibrator.adapter.ts # Calibrador adaptativo com penalidade de overconfidence
│   │   ├── in-memory-prototype-store.adapter.ts # Protótipos L2 e few-shot centróides em RAM
│   │   ├── in-memory-feedback-store.adapter.ts  # Histórico e auditoria de métricas em RAM
│   │   └── local-decision-engine.adapter.ts   # Motor com cache vetorial e evaluateBatch
│   └── quant/
│       └── turbo-quant.ts          # Primitivas de quantização rápida e produto escalar
│
└── presentation/                   # Developer Experience (DevEx)
    ├── branch-client.ts            # Fachada configurável (decide, boolean, score, systemOne)
    └── index.ts                    # Funções globais e atalhos ergonômicos
```

---

## 🚀 Como Usar

### 1. Primitiva Choice (Smart If-Statement com Enum ou Objeto)

```typescript
import { decide } from "@branch/core";

enum ChurnRisk {
  LOW = "baixo",
  MEDIUM = "medio",
  HIGH = "alto",
}

const customer = {
  comprasRealizadas: 3,
  diasDesdeUltimaCompra: 74,
  reclamacoesAbertas: 1,
  planoAtual: "Premium",
  historicoRecente: "Cliente parou de interagir no app após a reclamação não resolvida"
};

const result = await decide<ChurnRisk>({
  state: customer,
  choices: {
    [ChurnRisk.LOW]: "baixo risco, cliente satisfeito com compras frequentes",
    [ChurnRisk.MEDIUM]: "risco moderado, cliente estável",
    [ChurnRisk.HIGH]: "alto risco de churn, cliente inativo com reclamação aberta",
  },
  task: "avaliar probabilidade e risco de churn do cliente"
});

console.log(result.winner);        // "alto"
console.log(result.confidence);    // 0.999 (99.9%)
console.log(result.probabilities); // { baixo: 0.00, medio: 0.001, alto: 0.999 }

// Decisão determinística em código:
if (result.probabilities[ChurnRisk.HIGH] > 0.60) {
  await offerRetentionDiscount();
}
```

---

### 2. Primitiva Noul / Boolean (Avaliação Binária Contínua)

```typescript
import { boolean } from "@branch/core";

const refundCheck = await boolean({
  state: ticketContext,
  question: "O cliente está solicitando cancelamento de cobrança ou estorno?",
});

console.log(refundCheck.value);       // true
console.log(refundCheck.probability); // 0.982 (98.2% de probabilidade)
console.log(refundCheck.system);      // "system1"
```

---

### 3. Primitiva Score (Valor Esperado $E[X]$ em Escala Ordinal)

```typescript
import { score } from "@branch/core";

const frustration = await score({
  state: ticketContext,
  question: "Nível de frustração do cliente",
  scale: {
    0: "calmo e paciente",
    1: "frustrado",
    2: "extremamente irritado"
  }
});

console.log(frustration.score); // 1.89 (pontuação contínua ponderada pelas probabilidades)
```

---

### 4. Workflow Multi-Perguntas & Atalho `systemOne()`

Avalie dezenas de perguntas sobre o mesmo estado em uma **única passada vetorial pelo modelo na CPU**:

```typescript
import { systemOne } from "@branch/core";

const result = await systemOne(caseState, {
  isRefund: {
    type: "boolean",
    instructions: "Solicita estorno?",
  },
  frustration: {
    type: "score",
    instructions: "Nível de frustração",
    criteria: { 0: "calmo", 1: "irritado", 2: "furioso" },
  },
  team: {
    type: "choice",
    instructions: "Qual time deve cuidar?",
    choices: ["billing", "technical", "account"] as const,
  }
});

// Acesso 100% tipado via Mapped Types na IDE:
console.log(result.answers.isRefund.value);      // boolean
console.log(result.answers.frustration.score);   // number
console.log(result.answers.team.choice);         // "billing" | "technical" | "account"
console.log(result.totalLatencyMs);              // ~200 ms total na CPU
```

---

### 5. Metacognição e Fallback Sistema 1 ➔ Sistema 2

Se a confiança do modelo local for insuficiente ou o dado for Out-of-Distribution (OOD), o Branch aciona o fallback de forma totalmente transparente:

```typescript
import { decide } from "@branch/core";

const decision = await decide({
  state: complexTicket,
  choices: ["billing", "devops", "legal"],
  confidenceThreshold: 0.80, // Se confiança local < 80% ou OOD
  fallback: async (prev) => {
    console.log(`Sistema 1 incerto (${(prev.confidence * 100).toFixed(1)}%). Acionando LLM...`);
    return await callClaudeOrGptFallback(complexTicket);
  }
});

console.log(decision.winner);              // ex: "legal"
console.log(decision.system);              // "system1" (resolvido localmente) ou "system2" (via fallback)
console.log(decision.delegatedToFallback); // true / false
console.log(decision.actProbability);      // probabilidade para agir autonomamente (0.0 se for OOD)
```

---

### 6. Catálogo de Modelos Suportados (`BRANCH_EMBEDDING_MODELS`)

| Constante | Modelo Hugging Face | Camadas | Dim | Tamanho | Recomendação de Uso |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FAST_EN` | `Xenova/all-MiniLM-L6-v2` | 6 | 384 | ~22 MB | **Padrão:** Latência ultra-baixa em inglês |
| `ACCURATE_EN` | `Xenova/all-MiniLM-L12-v2` | 12 | 384 | ~34 MB | Maior profundidade analítica em inglês |
| `MULTILINGUAL_BALANCED` | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | 12 | 384 | ~118 MB | **Recomendado para Português (PT-BR)** e 50+ línguas |
| `MMBERT_SMALL` / `MMBERT_LOCAL` | `jhu-clsp/mmBERT-small` (ModernBERT) | 22 | 384 | ~140 MB | **Estado da Arte Multilíngue:** 1833 idiomas, vocabulário Gemma 2 (256k), contexto 8k, ~66ms warm na CPU |
| `MULTILINGUAL_E5_SMALL` | `Xenova/multilingual-e5-small` | 12 | 384 | ~120 MB | Alta densidade semântica multilíngue |

```typescript
import { BranchClient, BRANCH_EMBEDDING_MODELS } from "@branch/core";

const client = new BranchClient({
  modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
});
```

---

### 7. Aprendizado Contínuo com Protótipos e Calibração Adaptativa

Enriqueça opções com exemplos empíricos de produção (**Few-Shot Exemplars**) e ajuste a temperatura dinamicamente com base em feedback humano via Online SGD (Brier Score):

```typescript
import {
  BranchClient,
  InMemoryPrototypeStore,
  InMemoryFeedbackStore,
  BRANCH_EMBEDDING_MODELS,
} from "@branch/core";

const client = new BranchClient({
  modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
  adaptiveCalibrator: true, // Ajusta a temperatura automaticamente via SGD
  prototypeStore: new InMemoryPrototypeStore(), // Centróides semânticos L2 em RAM
  feedbackStore: new InMemoryFeedbackStore(),
});

// Ancorar um arquétipo empírico:
await client.addExample("HOLD", {
  cenario: "Mercado em consolidação lateral sem volume expressivo",
});

// Registrar feedback operacional de acerto/erro:
await client.recordFeedback({
  choice: "HOLD",
  wasCorrect: true,
  confidence: 0.90,
  addAsExample: true,
});
```

---

### 8. Caso Real: Trading de Alta Frequência PETR4.SA na B3

Demonstração prática conectando o Branch ao **Yahoo Finance em tempo real** para calcular indicadores técnicos (RSI, SMAs, volume relativo) e tomar decisões de `HOLD / BUY / SELL` com metacognição:

```bash
# Execução pontual:
npx tsx examples/petr4-trading.ts

# Monitoramento contínuo em loop a cada 30 segundos:
npx tsx examples/petr4-trading.ts --loop
```

---

## 📊 Benchmarks Reais

### 1. Branch.dev vs LLM em Nuvem (Qwen na Groq / Gemini)

Executado comparando decisões idênticas de *Smart If-Statement* contra modelos de ponta em nuvem (`npm run benchmark:llm`):

| Métrica / Critério | LLM em Nuvem (Qwen na Groq / Gemini) | **Branch.dev (`@branch/core`)** |
| :--- | :--- | :--- |
| **Custo de Token** | ~$0.15 a $2.50 / 1k decisões (500+ tokens/caso) | **$0.00 (Grátis, zero tokens)** |
| **Latência no Brasil** | 240 ms – 900 ms *(tráfego de rede e rota internacional)* | **In-Process local (zero tráfego de rede)** |
| **Privacidade / LGPD** | Dados do cliente trafegam para servidores externos | **100% Local (dados nunca saem da memória)** |
| **Risco de Hallucination / JSON** | Risco de formato inválido, requer retry/regex | **Zero (retorno tipado estrito via TypeScript)** |
| **Resiliência Offline** | Dependência obrigatória de internet / API | **100% Funcional offline sem conexão** |
| **Throughput em Produção** | Sujeito a Rate Limits (HTTP 429) e filas | **Decisões concorrentes ilimitadas na CPU** |

---

### 2. mmBERT Feature Extraction (CPU Local) vs Groq Cloud (Qwen-3.8 27B)

Benchmark científico executado com chave real da Groq comparando o modelo local **`mmBERT-small` (ModernBERT headless, 140M parâmetros)** na CPU contra o **`qwen/qwen3.8-27b` (27 Bilhões de parâmetros)** em cluster de LPUs na nuvem (`npm run benchmark:mmbert`):

#### Concordância e Paridade Semântica (83.3% de Acordo Idêntico)

| Caso | Cenário Avaliado | Decisão mmBERT Local (Branch) | Decisão Qwen 27B (Groq Cloud) | Paridade | Latência Branch | Latência Groq | Speedup |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **TRD-01** | PETR4: Consolidação na Resistência B3 | `comprar_agressivo` *(51% conf)* | `manter_neutro` | ⚠️ Divergência | **153.8 ms** | 489.3 ms | ⚡ **3.2x** |
| **TRD-02** | VALE3: Detecção de Bull Trap (Falso Rompimento) | `alerta_bull_trap` *(92% conf)* | `alerta_bull_trap` | ✅ **Idêntico** | 284.9 ms | 222.7 ms | 0.8x |
| **RISK-01** | Gestão de Risco: Drawdown Crítico (-3.95%) | `estancar_risco` *(87% conf)* | `estancar_risco` | ✅ **Idêntico** | **269.5 ms** | 467.3 ms | ⚡ **1.7x** |
| **FIN-01** | Conciliação: Cobrança Duplicada no Gateway | `estorno_automatico` *(96% conf)* | `estorno_automatico` | ✅ **Idêntico** | **242.3 ms** | 1.451.7 ms | ⚡ **6.0x** |
| **INFRA-01**| SRE: Pool de Banco Esgotado em Produção | `acionamento_sre_critico` *(89% conf)* | `acionamento_sre_critico` | ✅ **Idêntico** | 258.4 ms | 245.8 ms | 1.0x |
| **SEC-01** | Antifraude: Card Testing Botnet via Tor | `bloqueio_imediato_waf` *(93% conf)* | `bloqueio_imediato_waf` | ✅ **Idêntico** | **228.1 ms** | 349.7 ms | ⚡ **1.5x** |

#### Decomposição Físico-Temporal da Latência

| Camada de Execução | Branch.dev (mmBERT CPU Local) | Groq Cloud (Qwen-3.8 27B) | Vantagem Competitiva |
| :--- | :--- | :--- | :--- |
| **Tempo de Rede (RTT)** | **0.0 ms** *(In-process)* | 53.6 ms *(transcontinental HTTPS)* | **Sem latência de tráfego** |
| **Tempo de Fila / Gateway** | **0.0 ms** *(Execução imediata)* | ~450 ms *(concorrência / picos)* | **Sem fila de nuvem** |
| **Latência Média Total** | **239.5 ms** *(167.7 ms em warm loop)* | 537.8 ms *(pico de 1.451 ms)* | ⚡ **2.2x a 6.0x mais rápido** |
| **Consumo de Tokens** | **0 tokens (R$ 0,00)** | 1.472 tokens gastos | **Zero custo operacional** |

> **Otimização Headless (~1.800x mais rápida):** O checkpoint padrão do mmBERT no Hugging Face possui uma cabeça de predição Masked LM projetando $256.000$ tokens do Gemma 2 (~121s na CPU). O Branch.dev exporta e suporta o modelo em modo **Feature Extraction puro** (`last_hidden_state` com 384 dimensões), reduzindo o cálculo para apenas **~66 ms na CPU**.

---

### 3. Micro-Benchmark de Inferência TurboQuant (CPU Pura)

Executado em ambiente local (Node.js, CPU comum sem GPU):

| Métrica | LLM Tradicional (ex: GPT-4o-mini) | TypeSafe / Jev | **Branch.dev** |
| :--- | :--- | :--- | :--- |
| **Latência da Decisão Geométrica** | 1.800 ms – 5.000 ms | 70 ms – 500 ms | **< 2 ms** *(cache quente)* |
| **Consumo de Memória** | Gigabytes de VRAM | Servidor proprietário | **~35 MB de RAM** |
| **Dependência Externa** | Chave OpenAI / Cartão | Nuvem proprietária | **Zero (100% Local)** |

---

## 💻 Scripts Disponíveis

```bash
# Compilação e Tipagem
npm run build                 # Compila o projeto TypeScript para dist/
npm run typecheck             # Validação estrita de tipos (zero erros)

# Exemplos de Negócio
npm run example:churn         # Predição de risco de churn em português
npm run example:router        # Roteamento inteligente de chamados de suporte
npm run example:parity        # Paridade com as 3 primitivas da TypeSafe (Boolean, Score, Choice)
npm run example:multilingual  # Teste prático do modelo multilíngue (PT-BR)
npm run example:adaptive      # Aprendizado contínuo com Few-Shot Prototypes e feedback
npm run trading:petr4         # Trading algorítmico de PETR4.SA na B3 em tempo real

# Testes de Sistema e Calibração
npm run test:cardinality      # Validação dos buckets de Platt scaling (tempBucket)
npm run test:fallback         # Teste de metacognição e transição Sistema 1 ➔ Sistema 2
npm run test:adaptive         # Validação empírica do otimizador SGD no Brier Score

# Benchmarks
npm run benchmark             # Micro-benchmark de throughput de CPU
npm run benchmark:llm         # Benchmark comparativo: Branch.dev vs Qwen (Groq) / Gemini
npm run benchmark:asteroid    # Simulação aeroespacial 3D sob pressão: Branch.dev vs Groq (Qwen)
npm run benchmark:mmbert      # Comparativo empírico: mmBERT Local CPU vs Groq Cloud (Qwen 27B)
```

---

## 📄 Licença

MIT © [Branch.dev](https://github.com/Benevalterjr/branch.dev)
