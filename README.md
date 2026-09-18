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
│   │   └── decision-engine.port.ts # Porta abstrata do motor de decisão
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
│   │   ├── onnx-embedding.adapter.ts      # Adaptador ONNX + Resilient Local Sparse Projection
│   │   ├── platt-calibrator.adapter.ts    # Calibrador Platt com Z-Score Standardization
│   │   └── local-decision-engine.adapter.ts # Motor não-autoregressivo de passada única
│   └── quant/
│       └── turbo-quant.ts          # Primitivas de quantização rápida e produto escalar (arXiv:2504.19874)
│
└── presentation/                   # Developer Experience (DevEx)
    ├── branch-client.ts            # Fachada configurável
    └── index.ts                    # Função global decide() e re-exports
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

### 3. Fail-Safe com Trava de Confiabilidade

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

---

## 📊 Benchmark Real em CPU (Sem GPU)

Executado em ambiente local (Node.js v20, CPU comum):

```bash
npm run benchmark
```

| Métrica | LLM Tradicional (ex: GPT-4o-mini) | TypeSafe / Jev | **Branch.dev** |
| :--- | :--- | :--- | :--- |
| **Latência Média** | 1.800 ms – 5.000 ms | 70 ms – 500 ms | **1.35 ms** |
| **Throughput** | ~0.5 req/s | ~10 req/s | **671 decisões/s** |
| **Custo de Token** | $0.15 a $5.00 / 1k req | Preço de nuvem | **$0.00 (Grátis)** |
| **Consumo de Memória** | Gigabytes de VRAM | Servidor externo | **18 MB de RAM** |
| **Dependência Externa** | Chave OpenAI / Cartão | Nuvem proprietária | **Zero (100% Local)** |
