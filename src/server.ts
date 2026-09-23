import * as http from "node:http";
import { decide, boolean } from "./presentation/index.js";

const PORT = Number(process.env.PORT) || 10000;

const HTML_PAGE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ Branch.dev Playground</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --border: #1f2937;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --success: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 860px;
      width: 100%;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 2.2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 1.05rem;
    }
    .badge {
      display: inline-block;
      margin-top: 0.6rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-family: 'JetBrains Mono', monospace;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #93c5fd;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.75rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      font-size: 0.95rem;
    }
    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .btn-preset {
      background: #1f2937;
      color: var(--text);
      border: 1px solid #374151;
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      transition: all 0.2s;
    }
    .btn-preset:hover {
      background: #374151;
      border-color: #4b5563;
    }
    textarea, input {
      width: 100%;
      background: #0d121f;
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.75rem;
      border-radius: 8px;
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }
    textarea:focus, input:focus {
      border-color: var(--accent);
    }
    .btn-submit {
      width: 100%;
      background: var(--accent);
      color: white;
      border: none;
      padding: 0.85rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      transition: background 0.2s;
    }
    .btn-submit:hover {
      background: var(--accent-hover);
    }
    .btn-submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #result {
      display: none;
    }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    .winner-tag {
      font-size: 1.4rem;
      font-weight: 700;
      color: #60a5fa;
    }
    .meta-tag {
      font-size: 0.85rem;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
    }
    .prob-bar-container {
      margin-bottom: 0.75rem;
    }
    .prob-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      margin-bottom: 0.25rem;
    }
    .prob-bar-bg {
      background: #1f2937;
      height: 10px;
      border-radius: 999px;
      overflow: hidden;
    }
    .prob-bar-fill {
      background: linear-gradient(90deg, #3b82f6, #60a5fa);
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease-out;
    }
    pre {
      background: #0d121f;
      padding: 1rem;
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      overflow-x: auto;
      border: 1px solid var(--border);
      margin-top: 1rem;
    }
    footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    footer a {
      color: #60a5fa;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>⚡ Branch.dev</h1>
      <p class="subtitle">The Smart If-Statement — Decisões Probabilísticas em CPU Pura</p>
      <div class="badge">🚀 100% Local-First &bull; Zero Chaves de API &bull; CPU-Native</div>
    </header>

    <div class="card">
      <div class="form-group">
        <label>Escolha um Cenário Rápido:</label>
        <div class="presets">
          <button class="btn-preset" onclick="loadPreset('support')">🎧 Triagem de Suporte</button>
          <button class="btn-preset" onclick="loadPreset('churn')">📉 Risco de Churn</button>
          <button class="btn-preset" onclick="loadPreset('lead')">🎯 Lead Comercial</button>
          <button class="btn-preset" onclick="loadPreset('moderation')">🛡️ Moderação</button>
        </div>
      </div>

      <div class="form-group">
        <label for="state">Situação / Texto de Entrada:</label>
        <textarea id="state" rows="3" placeholder="Digite ou cole uma situação..."></textarea>
      </div>

      <div class="form-group">
        <label for="choices">Opções Possíveis (separadas por vírgula):</label>
        <input type="text" id="choices" placeholder="Ex: suporte_tecnico, financeiro, comercial">
      </div>

      <button id="btnRun" class="btn-submit" onclick="runDecision()">
        <span>⚡ Executar Decisão com Branch.dev</span>
      </button>
    </div>

    <div id="result" class="card">
      <div class="result-header">
        <div>
          <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Vencedor Calibrado:</div>
          <div id="resWinner" class="winner-tag">-</div>
        </div>
        <div style="text-align:right;">
          <div id="resConfidence" style="font-size:1.1rem; font-weight:700; color:var(--success);">-</div>
          <div id="resLatency" class="meta-tag">-</div>
        </div>
      </div>

      <div id="probBars"></div>

      <div style="margin-top:1.25rem;">
        <label style="font-size:0.85rem; color:var(--text-muted);">JSON Retornado pela Decisão:</label>
        <pre><code id="jsonOutput"></code></pre>
      </div>
    </div>

    <footer>
      Branch.dev &bull; Open Source sob licença MIT &bull; <a href="https://github.com/Benevalterjr/branch.dev" target="_blank">Ver no GitHub</a>
    </footer>
  </div>

  <script>
    const presets = {
      support: {
        state: "O aplicativo fecha com tela branca imediatamente após o login do usuário.",
        choices: "suporte_tecnico, financeiro, duvidas_gerais, vendas"
      },
      churn: {
        state: "Cliente há 2 anos, abriu 3 reclamações nesta semana e ameaçou cancelar no ReclameAqui.",
        choices: "baixo_risco, medio_risco, alto_risco"
      },
      lead: {
        state: "Sou diretor de tecnologia em uma empresa com 500 colaboradores e precisamos migrar o sistema com urgência neste mês.",
        choices: "lead_frio, lead_morno, lead_quente"
      },
      moderation: {
        state: "Excelente atendimento, o produto chegou antes do prazo e muito bem embalado! Recomendo!",
        choices: "aprovado, suspeito, ofensivo_ou_spam"
      }
    };

    function loadPreset(key) {
      const p = presets[key];
      if (p) {
        document.getElementById('state').value = p.state;
        document.getElementById('choices').value = p.choices;
      }
    }

    // Carregar preset inicial
    loadPreset('support');

    async function runDecision() {
      const state = document.getElementById('state').value.trim();
      const rawChoices = document.getElementById('choices').value.split(',').map(s => s.trim()).filter(Boolean);
      const btn = document.getElementById('btnRun');
      const resCard = document.getElementById('result');

      if (!state || rawChoices.length < 2) {
        alert("Preencha o estado e informe pelo menos 2 opções.");
        return;
      }

      btn.disabled = true;
      btn.innerText = "⏳ Processando em CPU pura...";

      try {
        const resp = await fetch('/api/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, choices: rawChoices })
        });
        const data = await resp.json();

        document.getElementById('resWinner').innerText = data.winner;
        document.getElementById('resConfidence').innerText = (data.confidence * 100).toFixed(1) + "% confiança";
        document.getElementById('resLatency').innerText = data.latencyMs.toFixed(1) + " ms (" + (data.system || "system1") + ")";

        // Render bars
        const barsContainer = document.getElementById('probBars');
        barsContainer.innerHTML = '';
        const sorted = Object.entries(data.probabilities || {}).sort((a,b) => b[1] - a[1]);

        for (const [opt, p] of sorted) {
          const pct = (p * 100).toFixed(1);
          barsContainer.innerHTML += \`
            <div class="prob-bar-container">
              <div class="prob-label">
                <span>\${opt}</span>
                <span style="font-family:'JetBrains Mono',monospace;">\${pct}%</span>
              </div>
              <div class="prob-bar-bg">
                <div class="prob-bar-fill" style="width: \${pct}%;"></div>
              </div>
            </div>
          \`;
        }

        document.getElementById('jsonOutput').innerText = JSON.stringify(data, null, 2);
        resCard.style.display = 'block';
      } catch (err) {
        alert("Erro na chamada: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerText = "⚡ Executar Decisão com Branch.dev";
      }
    }
  </script>
</body>
</html>
`;

function setCors(res: http.ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer(async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url?.split("?")[0] || "/";

  // Health check endpoint
  if (url === "/health" || url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
    return;
  }

  // Página web interativa
  if (url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML_PAGE);
    return;
  }

  // API POST /api/decide
  if (url === "/api/decide" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        if (!payload.state || !payload.choices) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'state' or 'choices'" }));
          return;
        }

        const result = await decide({
          state: payload.state,
          choices: payload.choices,
          task: payload.task,
          temperature: payload.temperature,
          confidenceThreshold: payload.confidenceThreshold,
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Internal error" }));
      }
    });
    return;
  }

  // API POST /api/boolean
  if (url === "/api/boolean" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        if (!payload.state || !payload.question) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'state' or 'question'" }));
          return;
        }

        const result = await boolean({
          state: payload.state,
          question: payload.question,
          affirmativeDescription: payload.affirmativeDescription,
          negativeDescription: payload.negativeDescription,
          temperature: payload.temperature,
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err: any) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message || "Internal error" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ Branch.dev server listening on port ${PORT}`);
});
