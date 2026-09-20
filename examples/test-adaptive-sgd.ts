import { AdaptivePlattCalibrator } from "../src/infrastructure/adapters/adaptive-platt-calibrator.adapter.js";

async function runTest() {
  console.log("===============================================================");
  console.log("⚡ Teste de Aprendizado Paramétrico Automático via Online SGD");
  console.log("   Métrica de Otimização: Brier Score (Proper Scoring Rule)");
  console.log("===============================================================\n");

  const calibrator = new AdaptivePlattCalibrator({
    initialTemperature: 0.5,
    learningRate: 0.1,
    momentum: 0.8,
    minTemperature: 0.05,
    maxTemperature: 4.0,
  });

  const choices = ["devops", "billing", "comercial"] as const;

  // -------------------------------------------------------------
  // CENÁRIO 1: Modelo Superconfiante Erra (Overconfidence Penalty)
  // -------------------------------------------------------------
  console.log("🧪 CENÁRIO 1: Ajuste Automático contra Superconfiança (Overconfidence)");
  console.log("   Situação: O motor emite decisões com 90%+ de certeza, mas o humano rejeita.");
  console.log(`   Temperatura Inicial: ${calibrator.getTemperature().toFixed(4)}`);

  // Logits onde a classe 0 ('devops') é prevista com muita convicção:
  const confidentLogits = [0.85, 0.20, 0.15];
  const initialDist = calibrator.calibrate(choices, confidentLogits);
  console.log(`   Probabilidade inicial para '${initialDist.winner}': ${(initialDist.confidence * 100).toFixed(1)}%`);

  console.log("\n   --> Aplicando 5 feedbacks negativos sucessivos via Online SGD:");
  for (let i = 1; i <= 5; i++) {
    calibrator.recordFeedback({
      logits: confidentLogits,
      predictedIndex: 0,
      wasCorrect: false, // ERRO!
    });
    const metrics = calibrator.getMetrics();
    console.log(
      `   [Passo ${i}] Temp: ${metrics.temperature.toFixed(4)} | ` +
      `Grad: ${metrics.lastGradient.toFixed(4)} | ` +
      `Brier Score: ${metrics.runningBrierScore.toFixed(4)}`
    );
  }

  const softenedDist = calibrator.calibrate(choices, confidentLogits);
  console.log(`\n   Resultado após SGD:`);
  console.log(`   - Nova Temperatura: ${calibrator.getTemperature().toFixed(4)} (aumentou suavemente)`);
  console.log(`   - Nova Probabilidade para '${softenedDist.winner}': ${(softenedDist.confidence * 100).toFixed(1)}% (suavizou a certeza falsa)`);

  if (calibrator.getTemperature() > 0.5 && softenedDist.confidence < initialDist.confidence) {
    console.log("   ✅ SUCESSO: O SGD elevou a temperatura e desinflou a superconfiança errônea.");
  } else {
    throw new Error("Falha no teste de superconfiança!");
  }

  // -------------------------------------------------------------
  // CENÁRIO 2: Modelo Hesitante Acerta (Underconfidence Boost)
  // -------------------------------------------------------------
  console.log("\n---------------------------------------------------------------");
  console.log("🧪 CENÁRIO 2: Ajuste Automático para Aumentar Contraste (Underconfidence)");
  console.log("   Situação: O motor acerta repetidamente, mas a temperatura estava alta demais.");
  
  // Reseta para testar sob alta temperatura inicial
  calibrator.setTemperature(2.0);
  console.log(`   Temperatura Inicial Alta: ${calibrator.getTemperature().toFixed(4)}`);
  
  const moderateLogits = [0.65, 0.40, 0.35];
  const initialHesitantDist = calibrator.calibrate(choices, moderateLogits);
  console.log(`   Probabilidade hesitante para '${initialHesitantDist.winner}': ${(initialHesitantDist.confidence * 100).toFixed(1)}%`);

  console.log("\n   --> Aplicando 8 feedbacks positivos sucessivos via Online SGD:");
  for (let i = 1; i <= 8; i++) {
    calibrator.recordFeedback({
      logits: moderateLogits,
      predictedIndex: 0,
      wasCorrect: true, // ACERTO!
    });
    const metrics = calibrator.getMetrics();
    console.log(
      `   [Passo ${i}] Temp: ${metrics.temperature.toFixed(4)} | ` +
      `Grad: ${metrics.lastGradient.toFixed(4)} | ` +
      `Brier Score: ${metrics.runningBrierScore.toFixed(4)}`
    );
  }

  const sharpenedDist = calibrator.calibrate(choices, moderateLogits);
  console.log(`\n   Resultado após SGD:`);
  console.log(`   - Nova Temperatura: ${calibrator.getTemperature().toFixed(4)} (reduziu para afiar a nitidez)`);
  console.log(`   - Nova Probabilidade para '${sharpenedDist.winner}': ${(sharpenedDist.confidence * 100).toFixed(1)}% (aumentou a convicção justificada)`);

  if (calibrator.getTemperature() < 2.0 && sharpenedDist.confidence > initialHesitantDist.confidence) {
    console.log("   ✅ SUCESSO: O SGD reduziu a temperatura e aumentou o contraste em acertos confirmados.");
  } else {
    throw new Error("Falha no teste de subconfiança!");
  }

  // -------------------------------------------------------------
  // CENÁRIO 3: Auditoria Final de Métricas
  // -------------------------------------------------------------
  console.log("\n---------------------------------------------------------------");
  console.log("📊 Métricas Consolidadas do Calibrador:");
  const finalMetrics = calibrator.getMetrics();
  console.dir(finalMetrics, { depth: null });
  console.log("===============================================================");
}

runTest().catch((err) => {
  console.error("❌ Erro durante execução do teste:", err);
  process.exit(1);
});
