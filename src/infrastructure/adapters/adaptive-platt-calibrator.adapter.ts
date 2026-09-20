import {
  IAdaptiveCalibrator,
  FeedbackCalibrationParams,
  CalibrationMetrics,
} from "../../domain/ports/adaptive-calibrator.port.js";
import { CalibrationOptions } from "../../domain/ports/calibrator.port.js";
import { ProbabilityDistribution } from "../../domain/entities/probability.vo.js";
import { PlattTemperatureCalibrator } from "./platt-calibrator.adapter.js";

export interface AdaptiveCalibratorConfig {
  /** Temperatura inicial de escala (padrão: 0.5) */
  initialTemperature?: number;
  /** Limiar mínimo permitido para temperatura (padrão: 0.05) */
  minTemperature?: number;
  /** Limiar máximo permitido para temperatura (padrão: 4.0) */
  maxTemperature?: number;
  /** Taxa de aprendizado do SGD online (padrão: 0.05) */
  learningRate?: number;
  /** Coeficiente de momentum para estabilidade do gradiente (padrão: 0.85) */
  momentum?: number;
  /** Limite de clipping do gradiente para estabilidade numérica (padrão: 5.0) */
  gradientClipping?: number;
  /** Limiar de detecção Out-of-Distribution (padrão: 0.15) */
  oodThreshold?: number;
}

/**
 * Adaptador: AdaptivePlattCalibrator
 * Implementa calibração estatística adaptativa contínua via Online Stochastic Gradient Descent (SGD)
 * com Momentum minimizando o Brier Score (Proper Scoring Rule).
 *
 * Elimina regras manuais empíricas e calibra matematicamente a temperatura T:
 * d(Brier)/dT = - (2 / (K * T^2)) * sum_j [ (p_j - y_j) * p_j * (z'_j - E_p[z']) ]
 *
 * Custo de execução: < 0.005ms em CPU pura (cálculo diferencial analítico).
 */
export class AdaptivePlattCalibrator
  extends PlattTemperatureCalibrator
  implements IAdaptiveCalibrator
{
  private temperature: number;
  private readonly initialTemperature: number;
  private readonly minTemperature: number;
  private readonly maxTemperature: number;
  private readonly learningRate: number;
  private readonly momentum: number;
  private readonly gradientClipping: number;

  // Estado do otimizador de ML
  private velocity: number = 0;
  private totalFeedbacks: number = 0;
  private correctFeedbacks: number = 0;
  private runningBrierScore: number = 0;
  private lastGradient: number = 0;

  constructor(config: AdaptiveCalibratorConfig = {}) {
    const initialTemp = config.initialTemperature ?? 0.5;
    const oodThreshold = config.oodThreshold ?? 0.15;
    super(initialTemp, oodThreshold);

    this.initialTemperature = initialTemp;
    this.temperature = initialTemp;
    this.minTemperature = config.minTemperature ?? 0.05;
    this.maxTemperature = config.maxTemperature ?? 4.0;
    this.learningRate = config.learningRate ?? 0.05;
    this.momentum = config.momentum ?? 0.85;
    this.gradientClipping = config.gradientClipping ?? 5.0;
  }

  /**
   * Calibra utilizando a temperatura adaptativa acumulada na instância.
   */
  public override calibrate<T extends string = string>(
    choices: readonly T[],
    rawLogits: number[],
    options?: CalibrationOptions
  ): ProbabilityDistribution<T> {
    const effectiveOptions: CalibrationOptions = {
      ...options,
      temperature: options?.temperature ?? this.temperature,
    };
    return super.calibrate<T>(choices, rawLogits, effectiveOptions);
  }

  /**
   * Registra feedback operacional e atualiza a temperatura via SGD no Brier Score.
   */
  public recordFeedback(params: FeedbackCalibrationParams): void {
    let grad = 0;
    let currentBrier = 0;

    if (params.logits && params.logits.length >= 2 && params.predictedIndex !== undefined) {
      // Caso 1: Vetor completo de logits disponível (Cálculo Multiclasse Analítico)
      const { gradient, brierScore } = this.computeMultiClassBrierGradient(
        params.logits,
        params.predictedIndex,
        params.wasCorrect,
        params.actualIndex
      );
      grad = gradient;
      currentBrier = brierScore;
    } else {
      // Caso 2: Fallback quando apenas a confiança final foi informada
      const conf = Math.max(0.01, Math.min(0.99, params.confidence ?? 0.5));
      const { gradient, brierScore } = this.computeBinaryBrierGradient(conf, params.wasCorrect);
      grad = gradient;
      currentBrier = brierScore;
    }

    // 1. Gradient Clipping para estabilidade numérica absoluta
    if (grad > this.gradientClipping) grad = this.gradientClipping;
    else if (grad < -this.gradientClipping) grad = -this.gradientClipping;
    this.lastGradient = grad;

    // 2. Atualização via Momentum SGD
    this.velocity = this.momentum * this.velocity + (1 - this.momentum) * grad;

    // 3. Atualização do parâmetro da temperatura
    const newTemp = this.temperature - this.learningRate * this.velocity;
    this.temperature = Math.max(this.minTemperature, Math.min(this.maxTemperature, newTemp));

    // 4. Atualização das métricas de rastreabilidade
    this.totalFeedbacks++;
    if (params.wasCorrect) this.correctFeedbacks++;

    const emaAlpha = 0.1;
    this.runningBrierScore =
      this.runningBrierScore === 0
        ? currentBrier
        : (1 - emaAlpha) * this.runningBrierScore + emaAlpha * currentBrier;
  }

  /**
   * Derivada analítica exata da perda de Brier Score em relação à temperatura T (Multiclasse):
   * dL/dT = - (2 / (K * T^2)) * sum_j [ (p_j - y_j) * p_j * (z'_j - E_p[z']) ]
   */
  private computeMultiClassBrierGradient(
    logits: number[],
    predictedIndex: number,
    wasCorrect: boolean,
    actualIndex?: number
  ): { gradient: number; brierScore: number } {
    const k = logits.length;

    // 1. Z-Score Standardization dos logits
    const mean = logits.reduce((acc, val) => acc + val, 0) / k;
    const variance = logits.reduce((acc, val) => acc + (val - mean) ** 2, 0) / k;
    const std = Math.sqrt(variance);

    if (std < 1e-6) {
      return { gradient: 0, brierScore: 0.5 };
    }

    const zScores = logits.map((val) => (val - mean) / std);

    // 2. Softmax numericamente estável com temperatura atual
    const s = zScores.map((z) => z / this.temperature);
    let maxS = -Infinity;
    for (const val of s) {
      if (val > maxS) maxS = val;
    }

    let sumExp = 0;
    const exps = s.map((val) => {
      const e = Math.exp(val - maxS);
      sumExp += e;
      return e;
    });

    const p = exps.map((e) => (sumExp > 0 ? e / sumExp : 1 / k));

    // 3. Vetor de alvos reais (y):
    // Se correto: 1 no previsto, 0 no resto
    // Se errado: 1 no real (se informado) ou 0 no previsto distribuindo a massa restante
    const y = new Array(k).fill(0);
    if (wasCorrect) {
      y[predictedIndex] = 1.0;
    } else if (actualIndex !== undefined && actualIndex >= 0 && actualIndex < k) {
      y[actualIndex] = 1.0;
    } else {
      y[predictedIndex] = 0.0;
      const otherMass = 1.0 / (k - 1);
      for (let i = 0; i < k; i++) {
        if (i !== predictedIndex) y[i] = otherMass;
      }
    }

    // 4. Brier Score Loss: L = (1/K) * sum( (p_i - y_i)^2 )
    let brierScore = 0;
    for (let i = 0; i < k; i++) {
      brierScore += (p[i] - y[i]) ** 2;
    }
    brierScore /= k;

    // 5. Média ponderada dos logits padronizados: E_p[z'] = sum( p_j * z'_j )
    let expectedZ = 0;
    for (let i = 0; i < k; i++) {
      expectedZ += p[i] * zScores[i];
    }

    // 6. Derivada analítica dL/dT
    let gradientSum = 0;
    for (let i = 0; i < k; i++) {
      gradientSum += (p[i] - y[i]) * p[i] * (zScores[i] - expectedZ);
    }

    const gradient = (-2.0 / (k * this.temperature * this.temperature)) * gradientSum;

    return { gradient, brierScore };
  }

  /**
   * Cálculo diferencial binário quando apenas a confiança escalar está disponível.
   */
  private computeBinaryBrierGradient(
    conf: number,
    wasCorrect: boolean
  ): { gradient: number; brierScore: number } {
    const p0 = conf;
    const p1 = 1 - conf;
    const y0 = wasCorrect ? 1.0 : 0.0;
    const y1 = wasCorrect ? 0.0 : 1.0;

    const brierScore = ((p0 - y0) ** 2 + (p1 - y1) ** 2) / 2;

    // Logit delta implícito
    const deltaZ = this.temperature * Math.log(p0 / p1);
    const z0 = deltaZ / 2;
    const z1 = -deltaZ / 2;
    const expectedZ = p0 * z0 + p1 * z1;

    const gradSum = (p0 - y0) * p0 * (z0 - expectedZ) + (p1 - y1) * p1 * (z1 - expectedZ);
    const gradient = (-1.0 / (this.temperature * this.temperature)) * gradSum;

    return { gradient, brierScore };
  }

  public getTemperature(): number {
    return this.temperature;
  }

  public setTemperature(temperature: number): void {
    this.temperature = Math.max(
      this.minTemperature,
      Math.min(this.maxTemperature, temperature)
    );
    this.velocity = 0;
  }

  public getMetrics(): CalibrationMetrics {
    return {
      temperature: Number(this.temperature.toFixed(4)),
      totalFeedbacks: this.totalFeedbacks,
      runningBrierScore: Number(this.runningBrierScore.toFixed(4)),
      accuracy:
        this.totalFeedbacks > 0
          ? Number((this.correctFeedbacks / this.totalFeedbacks).toFixed(4))
          : 1.0,
      lastGradient: Number(this.lastGradient.toFixed(4)),
    };
  }

  public reset(): void {
    this.temperature = this.initialTemperature;
    this.velocity = 0;
    this.totalFeedbacks = 0;
    this.correctFeedbacks = 0;
    this.runningBrierScore = 0;
    this.lastGradient = 0;
  }
}
