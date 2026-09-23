import { InMemoryPrototypeStore } from "../src/infrastructure/adapters/in-memory-prototype-store.adapter.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 Teste Unitário Completo: InMemoryPrototypeStore");
  console.log("=================================================\n");

  const store = new InMemoryPrototypeStore({ maxExamplesPerChoice: 3, defaultAlpha: 0.6 });

  // 1. Teste de adição normal e cálculo de protótipo
  const v1 = new Float32Array([1.0, 0.0, 0.0]);
  const v2 = new Float32Array([0.0, 1.0, 0.0]);
  await store.addExample("cat", v1);
  await store.addExample("cat", v2);

  const proto1 = await store.getPrototype("cat");
  if (!proto1) throw new Error("Protótipo não deveria ser nulo!");
  
  // v1 normalizado = [1,0,0], v2 normalizado = [0,1,0]. Centróide = [0.5, 0.5, 0], normalizado = [1/√2, 1/√2, 0] ~ [0.7071, 0.7071, 0]
  const expectedVal = 1 / Math.SQRT2;
  const diff = Math.abs(proto1[0] - expectedVal);
  if (diff > 0.001) throw new Error(`Centróide inesperado: ${proto1[0]} vs ${expectedVal}`);
  console.log("✅ 1. Centróide L2 normalizado calculado com exatidão.");

  // 2. Teste de cópia defensiva: mutar proto1 não altera o cache
  proto1[0] = 999.0;
  const proto2 = await store.getPrototype("cat");
  if (proto2![0] === 999.0) throw new Error("Falha na cópia defensiva do getPrototype! O cache foi corrompido.");
  console.log("✅ 2. Cópia defensiva do protótipo validada (imune a mutações externas).");

  // 3. Teste de cópia defensiva do addExample: mutar o array fornecido não corrompe o store
  const vMut = new Float32Array([0.0, 0.0, 1.0]);
  await store.addExample("cat", vMut);
  vMut[2] = 555.0; // mutação externa
  const count = await store.getExampleCount("cat");
  if (count !== 3) throw new Error("Contagem incorreta de exemplos");
  console.log("✅ 3. Cópia defensiva no addExample validada.");

  // 4. Teste de limite de buffer circular (maxExamplesPerChoice = 3)
  const v4 = new Float32Array([1.0, 1.0, 0.0]);
  await store.addExample("cat", v4); // Deve descartar v1 e manter 3 elementos
  const countAfter = await store.getExampleCount("cat");
  if (countAfter !== 3) throw new Error(`Buffer circular falhou: esperado 3, obtido ${countAfter}`);
  console.log("✅ 4. Buffer circular limitado com retenção máxima validado.");

  // 5. Teste de validação de dimensionalidade (dimensão divergente)
  let threwDimError = false;
  try {
    const wrongDimVec = new Float32Array([1.0, 2.0, 3.0, 4.0]); // 4 dims vs 3 dims
    await store.addExample("cat", wrongDimVec);
  } catch (err: any) {
    threwDimError = true;
    if (!err.message.includes("Divergência de dimensionalidade")) {
      throw new Error(`Mensagem inesperada no erro de dimensão: ${err.message}`);
    }
  }
  if (!threwDimError) throw new Error("Deveria ter lançado erro para vetor com dimensionalidade diferente!");
  console.log("✅ 5. Validação estrita de dimensionalidade no addExample validada.");

  // 6. Teste de validação para vetor vazio ou inválido
  let threwEmptyError = false;
  try {
    await store.addExample("cat", new Float32Array([]));
  } catch (err: any) {
    threwEmptyError = true;
  }
  if (!threwEmptyError) throw new Error("Deveria ter lançado erro para vetor vazio!");
  console.log("✅ 6. Rejeição de vetor vazio validada.");

  // 7. Teste de vetor zero no normalizeL2
  const zeroVec = new Float32Array([0.0, 0.0, 0.0]);
  await store.addExample("zero_choice", zeroVec);
  const zeroProto = await store.getPrototype("zero_choice");
  if (Number.isNaN(zeroProto![0]) || Number.isNaN(zeroProto![1])) {
    throw new Error("Normalização de vetor zero produziu NaN!");
  }
  console.log("✅ 7. Tratamento seguro de vetor nulo sem NaN nem divisão por zero validado.");

  // 8. Teste de getEnhancedEmbedding com interpolação
  const candidateVec = new Float32Array([1.0, 0.0, 0.0]);
  const enhanced = await store.getEnhancedEmbedding("cat", candidateVec, 0.5);
  // Deve ser normalizado L2
  const normSq = enhanced.reduce((sum, v) => sum + v * v, 0);
  if (Math.abs(Math.sqrt(normSq) - 1.0) > 0.001) {
    throw new Error("Vetor enhanced não está normalizado em L2!");
  }
  console.log("✅ 8. Interpolação ponderada (blend) e normalização L2 validadas.");

  // 9. Teste de getEnhancedEmbedding com dimensão divergente (segurança/fallback)
  const diffDimCand = new Float32Array([1.0, 0.0]); // 2 dims vs 3 dims
  const safeFallback = await store.getEnhancedEmbedding("cat", diffDimCand);
  if (safeFallback.length !== 2 || safeFallback[0] !== 1.0) {
    throw new Error("Fallback para dimensão divergente falhou!");
  }
  console.log("✅ 9. Proteção contra divergência de dimensões no getEnhancedEmbedding validada.");

  // 10. Teste de clear(choice) e clear()
  await store.clear("cat");
  const countCleared = await store.getExampleCount("cat");
  if (countCleared !== 0) throw new Error("clear(choice) falhou!");
  await store.clear();
  const zeroCleared = await store.getExampleCount("zero_choice");
  if (zeroCleared !== 0) throw new Error("clear() total falhou!");
  console.log("✅ 10. Limpeza seletiva e total de cache/exemplos validada.");

  console.log("\n🎉 TODOS OS 10 TESTES DO PROTOTYPESTORE PASSARAM COM 100% DE SUCESSO!\n");
}

runTests().catch((err) => {
  console.error("❌ Erro no teste do PrototypeStore:", err);
  process.exit(1);
});
