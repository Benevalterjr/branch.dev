import {
  PlattTemperatureCalibrator,
  getCardinalityBucket,
  DEFAULT_CARDINALITY_TEMPERATURES,
} from "../src/index.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALHA: ${message}`);
    process.exit(1);
  }
  console.log(`✅ ${message}`);
}

console.log("=================================================");
console.log("🧪 Teste de Calibração por Bucket de Cardinalidade");
console.log("=================================================\n");

// 1. Teste de mapeamento dos buckets
assert(getCardinalityBucket(1) === "2", "k=1 mapeia para bucket '2'");
assert(getCardinalityBucket(2) === "2", "k=2 mapeia para bucket '2'");
assert(getCardinalityBucket(3) === "3-5", "k=3 mapeia para bucket '3-5'");
assert(getCardinalityBucket(5) === "3-5", "k=5 mapeia para bucket '3-5'");
assert(getCardinalityBucket(6) === "6-10", "k=6 mapeia para bucket '6-10'");
assert(getCardinalityBucket(10) === "6-10", "k=10 mapeia para bucket '6-10'");
assert(getCardinalityBucket(11) === "11+", "k=11 mapeia para bucket '11+'");
assert(getCardinalityBucket(50) === "11+", "k=50 mapeia para bucket '11+'");

console.log("\n📊 Temperaturas Padrão Configuradas:");
console.log(DEFAULT_CARDINALITY_TEMPERATURES);

// 2. Teste de calibração em diferentes cardinalidades
const calibrator = new PlattTemperatureCalibrator();

// k=2 (binário)
const dist2 = calibrator.calibrate(["sim", "nao"], [0.8, 0.2]);
console.log("\n[k=2] Distribuição Binária:", dist2.toRecord());
assert(dist2.get("sim") > dist2.get("nao"), "k=2 ordena corretamente a opção vencedora");

// k=4 (3-5)
const dist4 = calibrator.calibrate(["a", "b", "c", "d"], [0.8, 0.5, 0.3, 0.1]);
console.log("[k=4] Distribuição (3-5):", dist4.toRecord());
assert(dist4.get("a") > dist4.get("b"), "k=4 ordena probabilidades corretamente");

// k=12 (11+)
const choices12 = Array.from({ length: 12 }, (_, i) => `opt_${i}`);
const logits12 = Array.from({ length: 12 }, (_, i) => 1.0 - i * 0.05);
const dist12 = calibrator.calibrate(choices12, logits12);
console.log("[k=12] Distribuição (11+) - Top 3:", {
  opt_0: dist12.get("opt_0"),
  opt_1: dist12.get("opt_1"),
  opt_2: dist12.get("opt_2"),
});
assert(dist12.get("opt_0") > dist12.get("opt_1"), "k=12 preserva monotonicidade");

// 3. Teste de override personalizado por bucket
const customCalibrator = new PlattTemperatureCalibrator(0.5, 0.15, {
  "2": 0.2, // Hiper-contraste em binário
});
const distCustom = customCalibrator.calibrate(["sim", "nao"], [0.8, 0.2]);
console.log("\n[Custom Bucket '2'=0.2] Distribuição com Hiper-Contraste:", distCustom.toRecord());
assert(distCustom.get("sim") > dist2.get("sim"), "Temperatura 0.2 gera maior contraste que default");

// 4. Teste de retrocompatibilidade com options.temperature explícito
const distExplicit = calibrator.calibrate(["sim", "nao"], [0.8, 0.2], { temperature: 2.0 });
console.log("[options.temperature=2.0] Distribuição Suavizada:", distExplicit.toRecord());
assert(distExplicit.get("sim") < dist2.get("sim"), "options.temperature explícito sobrepõe o bucket");

console.log("\n🎉 TODOS OS TESTES DE BUCKET DE CARDINALIDADE PASSARAM COM SUCESSO!");
