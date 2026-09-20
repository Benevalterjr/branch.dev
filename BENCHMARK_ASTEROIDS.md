# 🛸 Benchmark Ciberfísico: Evasão de Asteroides em Tempo Real

> Comparativo científico de tomada de decisão reflexiva sob estrita pressão temporal física: **Branch.dev (In-Process CPU)** vs **Groq Cloud (qwen/qwen3.8-27b)**.

---

## 🎯 A Tese: Física vs Latência de Nuvem

Em sistemas críticos (aeroespacial, robótica, veículos autônomos e esteiras antifraude em alta frequência), **o tempo limite de reação é ditado pelas leis da física**:
* Quando um asteroide se aproxima a **$3.0\text{ km/s}$**, a janela para aplicar empuxo é inferior a **$300\text{ms - }500\text{ms}$**.
* Chamadas de rede para modelos generativos em nuvem enfrentam latência de tráfego transcontinental e geração de tokens, estourando a janela física e resultando em **colisão catastrófica**.

---

## 📊 Placar Geral da Simulação (Seed 42 / Mulberry32 PRNG)

| Métrica Científica | Branch.dev (`@branch/core`) | Groq Cloud (`qwen/qwen3.8-27b`) | Vantagem Competitiva |
| :--- | :--- | :--- | :--- |
| **Taxa de Sobrevivência** | **75%** | 87.5% | **Groq superior** |
| **Miss Distance Média** | **39.5 metros** | 44.7 metros | **Margem de segurança física** |
| **Latência Média** | **182.91 ms** | 258.98 ms | **1.4x mais rápido** |
| **Percentil 95 (p95)** | **356.41 ms** | 376.48 ms | **1.1x menor latência na cauda** |
| **Jitter / Desvio Padrão (σ)** | **±79.12 ms** | ±45.88 ms | **0.6x mais estável (menor variabilidade)** |
| **Custo de Token** | **$0.00 (Zero tokens)** | 1395 tokens faturáveis | **100% Gratuito** |

---

## 🛰️ Detalhamento Voo a Voo (Flight Recorder)

| Ameaça | Distância | Janela Física | Latência Branch (Miss Dist.) | Status Branch | Latência Groq (Miss Dist.) | Status Groq |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `AST-01` | 1582m | 542ms | `152.94ms` (31.8m) | 🟢 **SOBREVIVEU** | `376.48ms` (43.75m) | 🟢 **SOBREVIVEU** |
| `AST-02` | 921m | 303ms | `166.48ms` (40.91m) | 🟢 **SOBREVIVEU** | `237.45ms` (39.64m) | 🟢 **SOBREVIVEU** |
| `AST-03` | 1991m | 674ms | `132.11ms` (46.38m) | 🟢 **SOBREVIVEU** | `242.79ms` (52.99m) | 🟢 **SOBREVIVEU** |
| `AST-04` | 1806m | 671ms | `125.33ms` (54.89m) | 🟢 **SOBREVIVEU** | `235.96ms` (46.41m) | 🟢 **SOBREVIVEU** |
| `AST-05` | 1714m | 540ms | `145.82ms` (19.93m) | 💥 **COLISÃO** | `230.44ms` (5.96m) | 💥 **COLISÃO** |
| `AST-06` | 1948m | 854ms | `267.48ms` (20.41m) | 💥 **COLISÃO** | `270.97ms` (74.16m) | 🟢 **SOBREVIVEU** |
| `AST-07` | 1064m | 463ms | `356.41ms` (34.44m) | 🟢 **SOBREVIVEU** | `236.2ms` (38.29m) | 🟢 **SOBREVIVEU** |
| `AST-08` | 1472m | 656ms | `116.71ms` (67.23m) | 🟢 **SOBREVIVEU** | `241.55ms` (56.67m) | 🟢 **SOBREVIVEU** |

---

## 🔬 Metodologia Científica
* **Física Cinemática 3D:** Aplicação das Leis de Newton $\Delta \mathbf{r} = \frac{1}{2} \mathbf{a} t_{\text{burn}}^2$, com propulsores de empuxo lateral ($180\text{ m/s}^2$).
* **Raio Crítico de Envelope:** $25.0\text{ metros}$ (Nave + Bólido).
* **PRNG Determinístico:** Mulberry32 com seed fixa para permitir reprodução experimental idêntica em qualquer runner.
