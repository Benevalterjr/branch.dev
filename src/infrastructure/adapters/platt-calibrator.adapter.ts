import { ICalibrator, CalibrationOptions, CardinalityBucket } from "../../domain/ports/calibrator.port.js";
import { ProbabilityDistribution } from "../../domain/entities/probability.vo.js";

/**
 * Determina o bucket de cardinalidade a partir do número de escolhas (K).
 * Categorização adaptativa por cardinalidade de escolhas.
 */

export function getCardinalityBucket(k: number): CardinalityBucket {
  if (k <= 2) return "2";
  if (k <= 5) return "3-5";
  if (k <= 10) return "6-10";
  return "11+";
}

/**
 * Temperaturas padrão por bucket de cardinalidade.
 * - k=2: 0.45 (equilíbrio para decisões binárias)
 * - k=3-5: 0.50 (padrão balanceado)
 * - k=6-10: 0.58 (evita subconfiança em cauda média)
 * - k=11+: 0.70 (evita colapso excessivo de probabilidade em grandes conjuntos)
 */
export const DEFAULT_CARDINALITY_TEMPERATURES: Record<CardinalityBucket, number> = {
  "2": 0.45,
  "3-5": 0.50,
  "6-10": 0.58,
  "11+": 0.70,
};

/**
 * Adaptador de Calibração Estatística: PlattTemperatureCalibrator
 * Implementa Temperature Scaling sensível à cardinalidade (tempBucket), Z-Score Standardization
 * e Detecção de Out-of-Distribution (OOD).
 */
export class PlattTemperatureCalibrator implements ICalibrator {
  private readonly defaultTemperature: number;
  private readonly defaultOodThreshold: number;
  private readonly temperatureByCardinality: Partial<Record<CardinalityBucket, number>>;

  constructor(
    defaultTemperature: number = 0.5,
    defaultOodThreshold: number = 0.15,
    temperatureByCardinality: Partial<Record<CardinalityBucket, number>> = {}
  ) {
    this.defaultTemperature = defaultTemperature;
    this.defaultOodThreshold = defaultOodThreshold;
    this.temperatureByCardinality = temperatureByCardinality;
  }

  public calibrate<T extends string = string>(
    choices: readonly T[],
    rawLogits: number[],
    options?: CalibrationOptions
  ): ProbabilityDistribution<T> {
    const n = rawLogits.length;
    const bucket = getCardinalityBucket(n);

    // Resolução hierárquica de temperatura:
    // 1. options.temperature explícito (prioridade máxima / retrocompatibilidade)
    // 2. options.temperatureByCardinality[bucket]
    // 3. this.temperatureByCardinality[bucket]
    // 4. DEFAULT_CARDINALITY_TEMPERATURES[bucket]
    // 5. this.defaultTemperature
    const rawTemp =
      options?.temperature ??
      options?.temperatureByCardinality?.[bucket] ??
      this.temperatureByCardinality[bucket] ??
      DEFAULT_CARDINALITY_TEMPERATURES[bucket] ??
      this.defaultTemperature;

    const temperature = Math.max(0.05, rawTemp);
    const oodThreshold = options?.oodThreshold ?? this.defaultOodThreshold;

    // 1. Verificação de Out-of-Distribution (Distância Mínima ao Espaço das Opções)
    let maxRawLogit = -Infinity;
    for (const val of rawLogits) {
      if (val > maxRawLogit) maxRawLogit = val;
    }
    const isOOD = maxRawLogit < oodThreshold;

    // Nota arquitetural: Dividir pelo desvio padrão sigma por consulta (Z-Score intra-query)
    // amplifica o contraste entre logits próximos. Isso é intencional para maximizar
    // a discriminação, mas pode gerar falsa confiança quando os logits são quase
    // idênticos (sigma ≈ 0). O guard `std < 1e-6` abaixo mitiga esse risco
    // retornando distribuição uniforme quando a dispersão é insuficiente.
    // Trade-off: Z-Score intra-query vs Temperature Scaling puro (Guo et al., 2017).
    // 2. Média e Desvio Padrão (Z-score dos logits)
    const mean = rawLogits.reduce((acc, val) => acc + val, 0) / n;
    const variance = rawLogits.reduce((acc, val) => acc + (val - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);

    // Se a dispersão for nula (todas opções iguais), retorna distribuição uniforme
    if (std < 1e-6) {
      const uniform: Record<string, number> = {};
      const prob = Number((1 / n).toFixed(4));
      for (const c of choices) uniform[c] = prob;
      return new ProbabilityDistribution<T>(uniform as Record<T, number>, isOOD);
    }

    // 2.1 Regularização de Variância (Variance Floor):
    // Em decisões binárias (k <= 2), std = |x1 - x2| / 2. Dividir puramente por std anula matematicamente
    // a magnitude da diferença |x1 - x2|, colapsando (x1 - mean) / std em identicamente +1 e -1,
    // o que força qualquer decisão binária a uma probabilidade fixa (ex: 93.5% em T=0.75).
    // O piso mínimo (effectiveStd = Math.max(std, minStdFloor)) garante que deltas sutis gerem
    // probabilidades proporcionais e moderadas, preservando o contraste em deltas expressivos.
    const minStdFloor = options?.minStdFloor ?? 0.15;
    const effectiveStd = Math.max(std, minStdFloor);

    // 3. Logits padronizados com escala de temperatura e variância regularizada
    const zScores = rawLogits.map((val) => (val - mean) / (effectiveStd * temperature));

    let maxZ = -Infinity;
    for (const z of zScores) {
      if (z > maxZ) maxZ = z;
    }

    // 4. Softmax numericamente estável
    let sumExp = 0;
    const expScores = zScores.map((z) => {
      const exp = Math.exp(z - maxZ);
      sumExp += exp;
      return exp;
    });

    // 5. Normalização das probabilidades
    const rawDistribution: Record<string, number> = {};
    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      rawDistribution[choice] = sumExp > 0 ? expScores[i] / sumExp : 1 / n;
    }

    return new ProbabilityDistribution<T>(rawDistribution as Record<T, number>, isOOD);
  }
}
