import {
  BranchClient,
  BRANCH_EMBEDDING_MODELS,
  InMemoryPrototypeStore,
  InMemoryFeedbackStore,
  AdaptivePlattCalibrator,
} from "../src/index.js";

async function main() {
  console.log("=================================================");
  console.log("🧠 Branch.dev - Aprendizado Adaptativo & Protótipos");
  console.log("=================================================\n");

  const prototypeStore = new InMemoryPrototypeStore();
  const feedbackStore = new InMemoryFeedbackStore();

  const client = new BranchClient({
    modelName: BRANCH_EMBEDDING_MODELS.MULTILINGUAL_BALANCED,
    adaptiveCalibrator: true,
    prototypeStore,
    feedbackStore,
  });

  const calibrator = client.getCalibrator() as AdaptivePlattCalibrator;
  console.log(`🌡️ Temperatura inicial do calibrador: ${calibrator.getTemperature().toFixed(3)}`);

  // Caso ambíguo / gíria interna de suporte:
  // "Drop de conexão no worker #4 com status 503"
  const ticketAmbiguo = {
    assunto: "Drop intermitente",
    mensagem: "Worker 4 parou de responder, dando timeout e status 503 intermitente na rota de webhook.",
  };

  const escolhas = {
    infraestrutura_devops: "problemas de servidores, clusters kubernetes, carga de memoria ou crash de workers",
    atendimento_comercial: "duvidas sobre contratacao, precos ou planos",
    suporte_financeiro: "questoes sobre faturamento, cartao e estorno",
  };

  console.log("\n📦 Cenário 1: Decisão inicial sem protótipos prévios");
  const decisaoInicial = await client.decide({
    state: ticketAmbiguo,
    choices: escolhas,
    task: "direcionar para o time responsavel",
  });

  console.log(`   🏆 Vencedor: ${decisaoInicial.winner}`);
  console.log(`   🎯 Confiança: ${(decisaoInicial.confidence * 100).toFixed(1)}%`);
  console.log(`   ⏱️ Latência: ${decisaoInicial.latencyMs} ms`);

  // Simulando feedback humano:
  console.log("\n👤 Validação Operacional Humana:");
  console.log("   Operador confirma que 'infraestrutura_devops' está correto.");
  await client.recordFeedback({
    state: ticketAmbiguo,
    choice: "infraestrutura_devops",
    wasCorrect: true,
    confidence: decisaoInicial.confidence,
    addAsExample: true, // Adiciona o embedding como protótipo!
  });

  // Adicionando mais 2 exemplos reais típicos de devops para enriquecer o protótipo:
  await client.addExample("infraestrutura_devops", {
    descricao: "O pod de redis esta caindo por OOM killer e reiniciando a cada 5 minutos",
  });
  await client.addExample("infraestrutura_devops", {
    descricao: "Alta latencia no banco de dados com conexoes esgotadas no pool pgbouncer",
  });

  console.log(`   ✅ Exemplos registrados no PrototypeStore para 'infraestrutura_devops': ${await prototypeStore.getExampleCount("infraestrutura_devops")}`);

  // Testando um novo caso com gíria técnica similar:
  console.log("\n📦 Cenário 2: Nova decisão após aprendizado de protótipos");
  const novoTicketDevops = {
    assunto: "Alerta no cluster",
    mensagem: "Node com spike de CPU e timeout 504 no ingress controller",
  };

  const decisaoComPrototipo = await client.decide({
    state: novoTicketDevops,
    choices: escolhas,
    task: "direcionar para o time responsavel",
  });

  console.log(`   🏆 Vencedor: ${decisaoComPrototipo.winner}`);
  console.log(`   🎯 Confiança Refinada: ${(decisaoComPrototipo.confidence * 100).toFixed(1)}%`);
  console.log(`   ⏱️ Latência: ${decisaoComPrototipo.latencyMs} ms`);

  // Testando adaptação de temperatura com feedback de erro em caso de overconfidence
  console.log("\n🌡️ Testando Calibração Adaptativa (Penalidade de Overconfidence):");
  const tempAntes = calibrator.getTemperature();
  console.log(`   Temperatura antes da penalidade: ${tempAntes.toFixed(3)}`);

  // Simulando que o motor errou uma decisão com 85% de certeza
  calibrator.recordFeedback({
    wasCorrect: false,
    confidence: 0.85,
  });

  const tempDepois = calibrator.getTemperature();
  console.log(`   Temperatura após erro overconfident: ${tempDepois.toFixed(3)} (aumentou para suavizar incertezas)`);

  // Consultando métricas do FeedbackStore
  console.log("\n📊 Auditoria do FeedbackStore:");
  const stats = await feedbackStore.getAllStats();
  for (const [ch, st] of Object.entries(stats)) {
    console.log(`   - [${ch}]: ${st.correct}/${st.total} acertos (${(st.accuracy * 100).toFixed(1)}% acurácia)`);
  }

  console.log("\n✨ Demonstração concluída com sucesso!");
}

main().catch(console.error);
