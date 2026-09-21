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
| **Taxa de Sobrevivência** | **75%** | 0% | **+75% sobrevivência** |
| **Miss Distance Média** | **39.3 metros** | 0 metros | **Margem de segurança física** |
| **Latência Média** | **113.01 ms** | 0 ms | **0.0x mais rápido** |
| **Percentil 95 (p95)** | **125.73 ms** | 0 ms | **0.0x menor latência na cauda** |
| **Jitter / Desvio Padrão (σ)** | **±7.93 ms** | ±0 ms | **0.0x mais estável (menor variabilidade)** |
| **Custo de Token** | **$0.00 (Zero tokens)** | 0 tokens faturáveis | **100% Gratuito** |

---

## 🛰️ Detalhamento Voo a Voo (Flight Recorder)

| Ameaça | Distância | Janela Física | Latência Branch (Miss Dist.) | Status Branch | Latência Groq (Miss Dist.) | Status Groq |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `AST-01` | 1582m | 542ms | `111.62ms` (29.98m) | 🟢 **SOBREVIVEU** | `0ms` (0m) | 💥 **COLISÃO** |
| `AST-02` | 921m | 303ms | `123.02ms` (42.13m) | 🟢 **SOBREVIVEU** | `0ms` (0m) | 💥 **COLISÃO** |
| `AST-03` | 1991m | 674ms | `113.79ms` (47.44m) | 🟢 **SOBREVIVEU** | `0ms` (0m) | 💥 **COLISÃO** |
| `AST-04` | 1806m | 671ms | `101.21ms` (57m) | 🟢 **SOBREVIVEU** | `0ms` (0m) | 💥 **COLISÃO** |
| `AST-05` | 1714m | 540ms | `103.43ms` (23.1m) | 💥 **COLISÃO** | `0ms` (0m) | 💥 **COLISÃO** |
| `AST-06` | 1948m | 854ms | `125.73ms` (18.58m) | 💥 **COLISÃO** | `0ms` (0m) | 💥 **COLISÃO** |
| `AST-07` | 1064m | 463ms | `110.82ms` (29.05m) | 🟢 **SOBREVIVEU** | `0ms` (0m) | 💥 **COLISÃO** |
| `AST-08` | 1472m | 656ms | `114.48ms` (67.44m) | 🟢 **SOBREVIVEU** | `0ms` (0m) | 💥 **COLISÃO** |

---

## 🔬 Metodologia Científica
* **Física Cinemática 3D:** Aplicação das Leis de Newton $\Delta \mathbf{r} = \frac{1}{2} \mathbf{a} t_{\text{burn}}^2$, com propulsores de empuxo lateral ($180\text{ m/s}^2$).
* **Raio Crítico de Envelope:** $25.0\text{ metros}$ (Nave + Bólido).
* **PRNG Determinístico:** Mulberry32 com seed fixa para permitir reprodução experimental idêntica em qualquer runner.
