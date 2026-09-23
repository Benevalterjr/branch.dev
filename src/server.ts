import * as http from "node:http";
import { decide, boolean } from "./presentation/index.js";

const PORT = Number(process.env.PORT) || 10000;

const HTML_PAGE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>⚡ Branch.dev — Playground</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
      padding: 2.5rem 1rem;
    }
    .container {
      max-width: 880px;
      width: 100%;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 2.4rem;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 1.05rem;
    }
    .badges {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
      flex-wrap: wrap;
    }
    .badge {
      display: inline-block;
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
      border-radius: 14px;
      padding: 1.75rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.5);
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.4rem;
      font-size: 0.92rem;
    }
    .label-hint {
      font-weight: normal;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-left: 0.25rem;
    }
    .presets {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.6rem;
      margin-bottom: 1.25rem;
    }
    .btn-preset {
      background: #1e293b;
      color: var(--text);
      border: 1px solid #334155;
      padding: 0.6rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 500;
      transition: all 0.2s;
      text-align: left;
    }
    .btn-preset:hover, .btn-preset.active {
      background: #334155;
      border-color: var(--accent);
      color: #93c5fd;
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
      padding: 0.9rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 1.05rem;
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
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .winner-tag {
      font-size: 1.5rem;
      font-weight: 700;
      color: #60a5fa;
    }
    .meta-tag {
      font-size: 0.85rem;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-muted);
    }
    .prob-bar-container {
      margin-bottom: 0.85rem;
    }
    .prob-label {
      display: flex;
      justify-content: space-between;
      font-size: 0.88rem;
      margin-bottom: 0.35rem;
    }
    .prob-bar-bg {
      background: #1f2937;
      height: 12px;
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
      <p class="subtitle">The Smart If-Statement — Decisões Probabilísticas Tipadas em CPU Pura</p>
      <div class="badges">
        <span class="badge">🚀 100% Local-First</span>
        <span class="badge">🔑 Zero Chaves de API</span>
        <span class="badge">⚡ Sub-segundo em CPU</span>
      </div>
    </header>

    <div class="card">
      <div class="form-group">
        <label>Escolha um Cenário de Demonstração:</label>
        <div class="presets">
          <button class="btn-preset active" id="btn-support" onclick="loadPreset('support')">🎧 Triagem de Suporte</button>
          <button class="btn-preset" id="btn-churn" onclick="loadPreset('churn')">📉 Risco de Churn</button>
          <button class="btn-preset" id="btn-lead" onclick="loadPreset('lead')">🎯 Lead Comercial</button>
          <button class="btn-preset" id="btn-moderation" onclick="loadPreset('moderation')">🛡️ Moderação</button>
        </div>
      </div>

      <div class="form-group">
        <label for="task">Objetivo da Tarefa: <span class="label-hint">(Contextualiza o domínio da decisão)</span></label>
        <input type="text" id="task" placeholder="Ex: identificar o departamento de atendimento adequado">
      </div>

      <div class="form-group">
        <label for="state">Situação / Dados de Entrada:</label>
        <textarea id="state" rows="3" placeholder="Digite ou cole uma situação..."></textarea>
      </div>

      <div class="form-group">
        <label for="choices">Opções Possíveis: <span class="label-hint">(uma por linha no formato 'id: descrição' ou lista simples)</span></label>
        <textarea id="choices" rows="4" placeholder="opcao1: descricao semantica&#10;opcao2: descricao semantica"></textarea>
      </div>

      <button id="btnRun" class="btn-submit" onclick="runDecision()">
        <span>⚡ Executar Decisão com Branch.dev</span>
      </button>
    </div>

    <div id="result" class="card">
      <div class="result-header">
        <div>
          <div style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Vencedor Calibrado:</div>
          <div id="resWinner" class="winner-tag">-</div>
        </div>
        <div style="text-align:right;">
          <div id="resConfidence" style="font-size:1.15rem; font-weight:700; color:var(--success);">-</div>
          <div id="resLatency" class="meta-tag">-</div>
        </div>
      </div>

      <div id="probBars"></div>

      <div style="margin-top:1.25rem;">
        <label style="font-size:0.85rem; color:var(--text-muted);">JSON Retornado pelo Motor:</label>
        <pre><code id="jsonOutput"></code></pre>
      </div>
    </div>

    <footer>
      Branch.dev &bull; Open Source sob licença MIT &bull; <a href="https://github.com/Benevalterjr/branch.dev" target="_blank">Ver código no GitHub</a>
    </footer>
  </div>

  <script>
    const presets = {
      support: {
        task: "identificar o departamento de atendimento adequado",
        state: "O aplicativo fecha com tela branca imediatamente após o login do usuário.",
        choices: [
          "suporte_tecnico: bugs no aplicativo, tela branca, falhas de software, travamentos técnicos e erros no login",
          "financeiro: questões sobre pagamentos, faturas, estornos ou cobranças no cartão",
          "vendas: dúvidas sobre contratação de planos e propostas comerciais"
        ].join('\\n')
      },
      churn: {
        task: "avaliar o risco de cancelamento do cliente",
        state: "Cliente há 2 anos, abriu 3 reclamações nesta semana e ameaçou cancelar no ReclameAqui.",
        choices: [
          "alto_risco: cliente insatisfeito com múltiplas reclamações graves e ameaça de cancelamento iminente",
          "medio_risco: cliente em dúvida com uso moderado",
          "baixo_risco: cliente satisfeito, feliz e sem reclamações"
        ].join('\\n')
      },
      lead: {
        task: "avaliar o nível de prioridade comercial do cliente",
        state: "Sou diretor de tecnologia em uma empresa com 500 colaboradores e precisamos migrar o sistema com urgência neste mês.",
        choices: [
          "alta_prioridade: empresa de grande porte com urgência imediata e alto valor comercial",
          "media_prioridade: empresa avaliando sem urgência imediata",
          "baixa_prioridade: estudante ou curioso sem interesse comercial real"
        ].join('\\n')
      },
      moderation: {
        task: "moderar avaliação de cliente",
        state: "Excelente atendimento, o produto chegou antes do prazo e muito bem embalado! Recomendo!",
        choices: [
          "aprovado: elogio legítimo sobre a entrega rápida e excelente qualidade do produto",
          "suspeito: conteúdo duvidoso ou propaganda",
          "rejeitado_ofensivo: linguagem imprópria, ofensas e spam malicioso"
        ].join('\\n')
      }
    };

    function loadPreset(key) {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      const activeBtn = document.getElementById('btn-' + key);
      if (activeBtn) activeBtn.classList.add('active');

      const p = presets[key];
      if (p) {
        document.getElementById('task').value = p.task;
        document.getElementById('state').value = p.state;
        document.getElementById('choices').value = p.choices;
      }
    }

    // Carregar suporte por padrão
    loadPreset('support');

    function parseChoices(text) {
      const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
      
      // Se tiver apenas 1 linha com vírgulas e sem ":"
      if (lines.length === 1 && lines[0].includes(',') && !lines[0].includes(':')) {
        return lines[0].split(',').map(s => s.trim()).filter(Boolean);
      }

      const dict = {};
      let hasColon = false;

      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          hasColon = true;
          const key = line.slice(0, colonIdx).trim();
          const val = line.slice(colonIdx + 1).trim();
          dict[key] = val;
        } else {
          dict[line] = line;
        }
      }

      return hasColon ? dict : Object.keys(dict);
    }

    async function runDecision() {
      const state = document.getElementById('state').value.trim();
      const task = document.getElementById('task').value.trim();
      const rawChoicesText = document.getElementById('choices').value.trim();
      const btn = document.getElementById('btnRun');
      const resCard = document.getElementById('result');

      const choices = parseChoices(rawChoicesText);

      const count = Array.isArray(choices) ? choices.length : Object.keys(choices).length;
      if (!state || count < 2) {
        alert("Preencha a situação e informe pelo menos 2 opções.");
        return;
      }

      btn.disabled = true;
      btn.innerText = "⏳ Processando na CPU local...";

      try {
        const resp = await fetch('/api/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, task, choices })
        });
        const data = await resp.json();

        if (data.error) {
          alert("Erro: " + data.error);
          return;
        }

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
                <span><strong>\${opt}</strong></span>
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
