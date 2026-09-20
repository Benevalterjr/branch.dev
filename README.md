# ⚡ Branch.dev (`@branch/core`)

> **The Smart If-Statement for Modern Code.**
> Decisões probabilísticas tipadas e calibradas em **< 2ms** em CPU pura, sem geração de texto, sem chamadas autoregressivas e sem chaves de API.

Um concorrente de código aberto, local-first e centrado em Clean Architecture para o **TypeSafe / System One / Jev**.

---

## 🎯 Por que o Branch.dev?

Enquanto LLMs generativos (ChatGPT, Claude) levam **2.000ms a 10.000ms** para gerar texto e tentar formatá-lo em JSON, e soluções proprietárias exigem nuvens fechadas e listas de espera:

* **100% Local (Hack 2):** Roda direto no seu processo Node.js / TypeScript em CPU. Zero chave de API, zero cartão de crédito.
* **Clean Architecture:** Desacoplamento estrito entre Domínio, Casos de Uso, Infraestrutura e Apresentação.
* **Zero Tokens & Zero KV Cache (GPULESS):** Elimina a geração autoregressiva. Executa uma única passada vetorial com **TurboQuant** (produto escalar otimizado e quantização online).
* **Latência de ~1.3ms:** Até **50x mais rápido** que o TypeSafe (70-500ms) e **1000x mais rápido** que LLMs tradicionais.
* **Decisões Calibradas:** Probabilidades normalizadas (soma = 100%) com Temperature Scaling e Z-Score Standardization para segurança operacional.

---

## 🏗️ Arquitetura (Clean Architecture)

```
src/
├── domain/                         # Enterprise Business Rules (Zero dependências externas)
│   ├── entities/
│   │   ├── decision.entity.ts      # Entidade Decision (vencedor, probabilidades, guard clauses)
│   │   ├── probability.vo.ts       # Value Object de Distribuição de Probabilidades
│   │   └── state-context.vo.ts     # Value Object para canonicalização semântica do estado
│   ├── ports/                      # Interfaces / Contratos de Domínio
│   │   ├── embedding-model.port.ts # Porta de vetorização
│   │   ├── calibrator.port.ts      # Porta para calibração estatística de logits
│   │   ├── decision-engine.port.ts # Porta abstrata do motor de decisão
│   │   ├── adaptive-calibrator.port.ts # Porta para calibração adaptativa online
│   │   ├── prototype-store.port.ts # Porta para centróides e few-shot exemplars
│   │   └── feedback-store.port.ts  # Porta para rastreabilidade e auditoria de feedbacks
│   └── exceptions/
│       └── domain-exceptions.ts    # Exceções (LowConfidenceException, InvalidState)
│
├── application/                    # Application Business Rules
│   ├── dtos/
│   │   ├── decide-request.dto.ts   # DTOs tipados com suporte a Enums e Arrays
│   │   └── decide-response.dto.ts  # DTOs de retorno
│   └── use-cases/
│       └── make-decision.use-case.ts # Orquestrador da tomada de decisão
│
├── infrastructure/                 # Frameworks & Drivers
│   ├── adapters/
│   │   ├── onnx-embedding.adapter.ts          # Adaptador ONNX + Resilient Local Sparse Projection
│   │   ├── platt-calibrator.adapter.ts        # Calibrador Platt com Z-Score Standardization
│   │   ├── adaptive-platt-calibrator.adapter.ts # Calibrador adaptativo com penalidade de overconfidence
│   │   ├── in-memory-prototype-store.adapter.ts # Protótipos L2 e few-shot centróides em RAM
│   │   ├── in-memory-feedback-store.adapter.ts  # Histórico e auditoria de métricas em RAM
│   │   └── local-decision-engine.adapter.ts   # Motor não-autoregressivo com cache de escolhas
│   └── quant/
│       └── turbo-quant.ts          # Primitivas de quantização rápida e produto escalar (arXiv:2504.19874)
│
└── presentation/                   # Developer Experience (DevEx)
    ├── branch-client.ts            # Fachada configurável com feedback e exemplares
    └── index.ts                    # Função global decide(), configure() e re-exports
```

---

## 🚀 Como Usar

### 1. Predição de Risco com TypeScript Enum (Exemplo do Artigo)

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

console.log(result.winner); // "alto"
console.log(result.confidence); // 0.999 (99.9%)
console.log(result.probabilities);
// { baixo: 0.00, medio: 0.001, alto: 0.999 }

// Smart If-Statement com lógica determinística:
if (result.probabilities[ChurnRisk.HIGH] > 0.60) {
  await offerRetentionDiscount();
}
```

### 2. Primitiva Noul / Boolean (True/False com Probabilidade Calibrada)

```typescript
import { boolean } from "@branch/core";

const refundCheck = await boolean({
  state: ticketContext,
  question: "O cliente está solicitando cancelamento de cobrança ou estorno?"
});

console.log(refundCheck.value); // true
console.log(refundCheck.probability); // 0.982 (98.2% de certeza)
```

### 3. Primitiva Score (Valor Esperado em Escala Ordinal)

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

console.log(frustration.score); // 1.89 (na escala de 0 a 2)
```

### 4. Workflow Multi-Perguntas Simultâneo (All-in-One Parallel)

```typescript
import { workflow } from "@branch/core";

const result = await workflow({
  state: caseState,
  questions: {
    isRefund: { type: "boolean", question: "Solicita estorno?" },
    duplicateEvidence: { type: "boolean", question: "Há evidência de cobrança duplicada?" },
    frustration: {
      type: "score",
      question: "Frustração",
      scale: { 0: "calmo", 1: "irritado", 2: "furioso" }
    },
    team: {
      type: "choice",
      question: "Qual time deve cuidar?",
      choices: ["billing", "technical", "account"] as const
    }
  }
});

if (result.answers.isRefund.probability > 0.8 && result.answers.duplicateEvidence.probability > 0.8) {
  await approveRefundAutomatically();
}
```

### 5. Suporte Multilíngue e Modelos Customizados (PT-BR, ES, 50+ idiomas)

Por padrão, o Branch.dev utiliza `Xenova/all-MiniLM-L6-v2` (~22MB, ultrarrápido em inglês). Para máxima precisão em **Português** e mais de 50 idiomas, você pode configurar o modelo global ou instanciar o `BranchClient`:

```typescript
import { BranchClient, BRANCH_EMBEDDING_MODELS, configure } from "@branch/core";

// Opção A: Reconfigurar globalmente (afeta decide(), boolean(), score(), workflow())
configure({
  modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED, // Xenova/paraphrase-multilingual-MiniLM-L12-v2 (~118MB)
});

// Opção B: Instância dedicada
const client = new BranchClient({
  modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
});
```

Modelos pré-configurados disponíveis via `BRANCH_EMBEDDING_MODELS`:
* `FAST_EN`: `Xenova/all-MiniLM-L6-v2` (384 dim, ~22MB, latência mínima em inglês)
* `MULTILINGUAL_BALANCED`: `Xenova/paraphrase-multilingual-MiniLM-L12-v2` (384 dim, ~118MB, recomendado para PT-BR e 50+ idiomas)
* `MULTILINGUAL_E5_SMALL`: `Xenova/multilingual-e5-small` (384 dim, ~120MB, alta precisão semântica)

### 6. Fail-Safe com Trava de Confiabilidade

```typescript
// Se a IA não tiver pelo menos 80% de certeza, envia para um humano
try {
  result.assertConfidence(0.80);
  await executeAutomatically();
} catch (e) {
  if (e instanceof LowConfidenceException) {
    await sendToHumanReviewQueue(customer, e.winner, e.confidence);
  }
}
```

### 7. Aprendizado Contínuo (Few-Shot Prototypes & Calibração Adaptativa)

Sem modelos pesados ou re-treinamentos caros, o Branch.dev aprende com feedbacks de operadores e exemplos em produção mantendo inferência em **< 2ms**:

```typescript
import {
  BranchClient,
  InMemoryPrototypeStore,
  InMemoryFeedbackStore,
  BRANCH_EMBEDDING_MODELS,
} from "@branch/core";

const client = new BranchClient({
  modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
  adaptiveCalibrator: true, // Ajusta temperatura dinamicamente com base em acertos/erros
  prototypeStore: new InMemoryPrototypeStore(), // Centróides semânticos com interpolação L2
  feedbackStore: new InMemoryFeedbackStore(), // Auditoria e métricas de acurácia
});

// 1. Enriquecer uma escolha com exemplos empíricos do mundo real:
await client.addExample("devops", {
  log: "Pod redis reiniciando por OOM killer e timeout no ingress",
});

// 2. Registrar feedback humano em produção para refinar a calibração:
await client.recordFeedback({
  choice: "devops",
  wasCorrect: true,
  confidence: 0.95,
  addAsExample: true,
});
```

---

## 📊 Benchmarks Reais

### 1. Branch.dev vs LLM em Nuvem (Qwen 3.8 27B na Groq / Gemini)

Executado comparando decisões idênticas de *Smart If-Statement* contra modelos de ponta em nuvem:

```bash
npm run benchmark:llm
```

| Métrica / Critério | LLM em Nuvem (Qwen na Groq / Gemini) | **Branch.dev (`@branch/core`)** |
| :--- | :--- | :--- |
| **Custo de Token** | ~$0.15 a $2.50 / 1k decisões (500+ tokens/caso) | **$0.00 (Grátis, zero tokens)** |
| **Latência no Brasil** | 240 ms – 900 ms *(limitado por tráfego de rede e rota internacional)* | **In-Process local (zero rede)** |
| **Privacidade / LGPD** | Dados do cliente trafegam para servidores externos | **100% Local (dados nunca saem da memória)** |
| **Risco de Hallucination / JSON** | Risco de formato inválido, requer retry/regex | **Zero (retorno tipado estrito via TypeScript)** |
| **Resiliência Offline** | Dependência obrigatória de internet / API | **100% Funcional offline sem conexão** |
| **Throughput em Produção** | Sujeito a Rate Limits (HTTP 429) e filas | **Decisões concorrentes ilimitadas em CPU** |

### 2. Micro-Benchmark de Inferência TurboQuant (CPU Pura)

Executado em ambiente local (Node.js, CPU comum sem GPU):

```bash
npm run benchmark
```

| Métrica | LLM Tradicional (ex: GPT-4o-mini) | TypeSafe / Jev | **Branch.dev** |
| :--- | :--- | :--- | :--- |
| **Latência da Decisão Geométrica** | 1.800 ms – 5.000 ms | 70 ms – 500 ms | **< 2 ms** |
| **Consumo de Memória** | Gigabytes de VRAM | Servidor externo | **~25 MB de RAM** |
| **Dependência Externa** | Chave OpenAI / Cartão | Nuvem proprietária | **Zero (100% Local)** |

---

## 💻 Scripts Disponíveis

```bash
npm run build                 # Compila o projeto TypeScript para dist/
npm run typecheck             # Validação estrita de tipos (zero erros)
npm run example:churn         # Predição de risco de churn em português
npm run example:router        # Roteamento inteligente de tickets de suporte
npm run example:parity        # Paridade com as 3 primitivas da TypeSafe (Boolean, Score, Choice)
npm run example:multilingual  # Teste prático do modelo multilíngue (PT-BR)
npm run example:adaptive      # Aprendizado contínuo com Few-Shot Prototypes e feedback
npm run test:adaptive         # Validação empírica do otimizador SGD no Brier Score
npm run benchmark             # Micro-benchmark de throughput de CPU
npm run benchmark:llm         # Benchmark comparativo: Branch.dev vs Qwen (Groq) / Gemini
npm run benchmark:asteroid    # Simulação aeroespacial 3D sob pressão: Branch.dev vs Groq (Qwen)
```
