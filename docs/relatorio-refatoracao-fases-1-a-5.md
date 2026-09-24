# 🛡️ Relatório Técnico Consolidado: Conclusão das 5 Fases de Refatoração do Gauss (`@branch/core`)

Este documento consolida a resolução técnica, matemática e arquitetural dos 8 achados críticos identificados na auditoria do motor de decisão probabilística do Gauss (`@branch/core`).

---

## 📋 Resumo Executivo das 5 Fases

| Fase | Escopo | Problema Raiz do Audit | Solução Arquitetural / Matemática | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Fase 1** | **Integridade & CI Gate** | Fallback silencioso para hash mascarando perda de acurácia de 85% para 37,5%. | • `allowFallback: false` por padrão (`ModelLoadException` obrigatória).<br>• DTOs agora expõem `embeddingBackend` (`"onnx"` ou `"hash-fallback"`).<br>• Estado pós-fallback do Sistema 2 normalizado (Sistema 1 zerado). | ✅ **Concluída** |
| **Fase 2** | **Guardrail OOD & AUROC** | Prefixo de tarefa inflando similaridade; caso de futebol vazando como `AUTOMATE`. | • Passada dupla desacoplada (ranking usa contexto de tarefa; OOD usa representações puras).<br>• Limiar de OOD calibrado para `0.28` (AUROC subiu para **98,50%**).<br>• OOD bloqueado categoricamente de emitir `AUTOMATE`. | ✅ **Concluída** |
| **Fase 3** | **Neutralização Booleana** | Viés léxico hardcoded de "urgente, afirmativo" e "calmo, negativo" invertendo predições. | • Removidos termos de tom emocional das descrições padrão.<br>• Removida injeção de hipótese afirmativa no contexto do estado durante inferência binária. | ✅ **Concluída** |
| **Fase 4** | **Regularização Matemática** | Z-score intra-query colapsando variância em $K=2$ (98,8% fixo) e sobrescrita de buckets. | • Piso de variância `minStdFloor = 0.15` para manter probabilidades contínuas em $K=2$.<br>• Escala proporcional de temperatura nos buckets de cardinalidade no SGD adaptativo ($\alpha = T_{\text{learned}} / T_{\text{initial}}$). | ✅ **Concluída** |
| **Fase 5** | **Alinhamento & Documentação** | Alegações infladas de TurboQuant e falta de transparência da arquitetura no README. | • `README.md` reescrito com precisão técnica (float32 acelerado, sem mitos de quantização generativa).<br>• Cobertura completa na suíte unificada de testes (`npm test`). | ✅ **Concluída** |

---

## 🔬 Detalhamento Técnico das Soluções

### 1. Integridade Operacional e Prevenção de Falha Silenciosa (Fase 1)
- **Localização:** `src/infrastructure/adapters/onnx-embedding.adapter.ts` e `src/domain/exceptions/domain-exceptions.ts`.
- **Mecanismo:** Anteriormente, se o arquivo ONNX estivesse indisponível ou ocorresse erro de carregamento (como ausência de rede para download), o adapter capturava o erro silenciosamente e ativava o `HashFallbackAdapter`. Esse algoritmo rudimentar derrubava a acurácia para 37,5% sem registrar nenhuma bandeira no DTO de resposta.
- **Implementação:** O adapter agora rejeita inicializações com `allowFallback: false` (padrão de produção e CI), disparando `ModelLoadException`. Para ambientes onde o fallback é intencional, o DTO `DecideResponseDto` agora traz obrigatoriamente a propriedade `embeddingBackend: "onnx" | "hash-fallback"`.
- **Validação:** `tests/ci-integrity.test.ts` (5 testes).

---

### 2. Guardrail OOD de Passada Dupla e AUROC 98,5% (Fase 2)
- **Localização:** `src/infrastructure/adapters/local-decision-engine.adapter.ts` e `src/infrastructure/adapters/platt-calibrator.adapter.ts`.
- **Mecanismo:** Ao concatenar `Tarefa: ${taskDescription}` no estado e `${taskDescription} -> ${choice}` em cada opção, o embedding da query e de todas as escolhas absorviam tokens idênticos da instrução. Isso causava uma inflação de cosseno de +0.25 a +0.35, fazendo com que textos completamente desconexos (ex: *"O meio-campista do time foi expulso após falta dura..."*) tivessem similaridade > 0.40 e nunca caíssem no threshold de 0.15.
- **Implementação:**
  1. O motor agora calcula **passada dupla de embeddings**:
     - Logits discriminativos (ranking): Calculados com o contexto da tarefa para máxima precisão semântica.
     - Logits de guardrail OOD (`pureOodLogits`): Calculados comparando o vetor do estado limpo diretamente contra as descrições puras das opções.
  2. O threshold de OOD foi calibrado empiricamente para `0.28`.
  3. A métrica **AUROC** passou de **95,6%** para **98,50%**.
  4. Caso o guardrail identifique OOD (`isOOD: true`), a confiança do Value Object `ProbabilityDistribution` é zerada e o `actionPolicy` é travado em `ESCALATE`, impedindo qualquer autorização autônoma (`AUTOMATE`).
- **Validação:** `tests/ood-guardrail.test.ts` (3 testes).

---

### 3. Neutralização da Primitiva Booleana (Fase 3)
- **Localização:** `src/application/use-cases/evaluate-boolean.use-case.ts`.
- **Mecanismo:** A implementação antiga definia como descrições padrão:
  - `True`: `${pergunta} - Sim / Yes / True (evidente, confirmado, urgente, afirmativo)`
  - `False`: `${pergunta} - Não / No / False (não evidente, negado, calmo, negativo)`
  O modelo bi-encoder associava mensagens contendo palavras de alta energia ("URGENTE", "RÁPIDO") à opção `True` mesmo em fatos negativos, e mensagens cordiais/calmas à opção `False`.
- **Implementação:**
  - Descrições padrão foram limpas de qualquer termo adjetivo emocional:
    - Afirmativa: `Sim, confirmação afirmativa: ${cleanQuestion}`
    - Negativa: `Não, refutação ou inexistência: ${cleanQuestion}`
  - Em decisões booleanas, a pergunta afirmativa não é mais concatenada no contexto do estado como premissa dada, eliminando a atração vetorial assimétrica.
- **Validação:** `tests/boolean-neutral.test.ts` (4 testes).

---

### 4. Regularização Matemática de Variância em $K=2$ e Buckets Adaptativos (Fase 4)
- **Localização:** `src/infrastructure/adapters/platt-calibrator.adapter.ts` e `src/infrastructure/adapters/adaptive-platt-calibrator.adapter.ts`.
- **Mecanismo:**
  1. Em problemas binários ($K=2$), a média é $\mu = (s_1 + s_2)/2$ e o desvio padrão intra-query é $\sigma = |s_1 - s_2|/2$. A divisão por $\sigma$ anulava a magnitude real da diferença $|s_1 - s_2|$, resultando sempre em $z_1 = +1.0$ e $z_2 = -1.0$. Com $T = 0.45$, isso gerava uma probabilidade artificial fixa de ~98,8% tanto para deltas minúsculos (0.01) quanto gigantescos (0.80).
  2. No calibrador adaptativo via SGD, a temperatura aprendida global sobrescrevia os valores específicos de cada bucket de cardinalidade.
- **Implementação:**
  - Introduzido piso de variância `minStdFloor = 0.15` (`effectiveStd = Math.max(std, minStdFloor)`), garantindo probabilidades moderadas e proporcionais para margens pequenas.
  - O `AdaptivePlattCalibrator` agora ajusta as temperaturas dos buckets de cardinalidade proporcionalmente pelo multiplicador $\alpha = T_{\text{learned}} / T_{\text{initial}}$.
- **Validação:** Suíte de regressão de receitas em `tests/sandbox-recipes.test.ts` (7 testes) e testes unitários de cardinalidade.

---

### 5. Alinhamento de Documentação e Transparência Técnica (Fase 5)
- **Localização:** `README.md`.
- **Ajustes:**
  - Descrição técnica do TurboQuant clarificada como acelerador de produto escalar float32 na CPU (com suporte opcional a quantização int8 para memória), eliminando afirmações de quantização mágica em pipeline generativo.
  - Documentação completa da nova arquitetura de calibração por buckets de cardinalidade, regularização de variância e guardrail OOD de passada dupla.

---

## 📊 Matriz de Resultados da Suíte de Testes

```
 ✓ tests/ci-integrity.test.ts     (5 testes)   --> 100% aprovado
 ✓ tests/ood-guardrail.test.ts    (3 testes)   --> 100% aprovado
 ✓ tests/boolean-neutral.test.ts  (4 testes)   --> 100% aprovado
 ✓ tests/sandbox-recipes.test.ts  (7 testes)   --> 100% aprovado

 Test Files  4 passed (4)
      Tests  19 passed (19)
   Duration  ~14s
```

Suíte unificada executada via `npm test`:
- `test:cardinality` (Buckets $K=2, 3-5, 6-10, 11+$) ✅
- `test:adaptive` (Online SGD com Brier Score) ✅
- `test:fallback` (Metacognição e Fallback Sistema 2) ✅
- `test:prototype` (Centróides semânticos em RAM) ✅
- `test:risk` (Semáforo de risco e políticas operacionais) ✅
- `test:sandbox` (Receitas do Playground) ✅
- `test:ci` (Gate de Integridade ONNX) ✅
- `test:ood` (Guardrail OOD de Passada Dupla) ✅
- `test:boolean` (Neutralidade Booleana) ✅

Build TypeScript (`npm run build` / `tsc`): **0 erros de compilação**.
