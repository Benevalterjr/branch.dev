import {
  IAdaptiveCalibrator,
  FeedbackCalibrationParams,
} from "../../domain/ports/adaptive-calibrator.port.js";
import { CalibrationOptions } from "../../domain/ports/calibrator.port.js";
import { ProbabilityDistribution } from "../../domain/entities/probability.vo.js";
import { PlattTemperatureCalibrator } from "./platt-calibrator.adapter.js";

export interface AdaptiveCalibratorConfig {
  /** Temperatura inicial de escala (padrão: 0.5) */
  initialTemperature?: number;
  /** Limiar mínimo permitido para temperatura (padrão: 0.05) */
  minTemperature?: number;
  /** Limiar máximo permitido para temperatura (padrão: 3.0) */
  maxTemperature?: number;
  /** Taxa de aprendizado/ajuste dinâmico (padrão: 0.02) */
  learningRate?: number;
  /** Limiar de detecção Out-of-Distribution (padrão: 0.15) */
  oodThreshold?: number;
}

/**
 * Adaptador: AdaptivePlattCalibrator
 * Estende PlattTemperatureCalibrator adicionando aprendizado online de temperatura.
 * Ajusta o contraste estatístico das probabilidades em tempo real sem dependências externas.
 */
export class AdaptivePlattCalibrator
  extends PlattTemperatureCalibrator
  implements IAdaptiveCalibrator
{
  private temperature: number;
  private readonly minTemperature: number;
  private readonly maxTemperature: number;
  private readonly learningRate: number;

  constructor(config: AdaptiveCalibratorConfig = {}) {
    const initialTemp = config.initialTemperature ?? 0.5;
    const oodThreshold = config.oodThreshold ?? 0.15;
    super(initialTemp, oodThreshold);

    this.temperature = initialTemp;
    this.minTemperature = config.minTemperature ?? 0.05;
    this.maxTemperature = config.maxTemperature ?? 3.0;
    this.learningRate = config.learningRate ?? 0.02;
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
   * Registra feedback operacional e ajusta dinamicamente a temperatura:
   * - Erro com alta confiança (overconfidence) -> Eleva a temperatura para suavizar a distribuição.
   * - Acerto com baixa confiança (underconfidence) -> Reduz a temperatura para aumentar o contraste.
   */
  public recordFeedback(params: FeedbackCalibrationParams): void {
    let conf = params.confidence;

    // Se a confiança não foi informada diretamente, calcula via softmax numericamente estável
    if (conf === undefined && params.logits && params.predictedIndex !== undefined) {
      const logits = params.logits;
      const idx = params.predictedIndex;
      if (idx >= 0 && idx < logits.length) {
        let maxLogit = -Infinity;
        for (const l of logits) {
          if (l > maxLogit) maxLogit = l;
        }

        let sumExp = 0;
        for (const l of logits) {
          sumExp += Math.exp((l - maxLogit) / this.temperature);
        }

        conf = sumExp > 0 ? Math.exp((logits[idx] - maxLogit) / this.temperature) / sumExp : 0.5;
      }
    }

    const effectiveConfidence = conf ?? 0.5;

    if (!params.wasCorrect) {
      // Penalidade de excesso de confiança: aumenta a temperatura proporcionalmente à certeza errônea
      const penaltyFactor = effectiveConfidence > 0.5 ? effectiveConfidence : 0.5;
      const delta = this.learningRate * penaltyFactor;
      this.temperature = Math.min(this.maxTemperature, this.temperature + delta);
    } else {
      // Reforço de confiança: se acertou com hesitação (baixa confiança), estreita a margem
      if (effectiveConfidence < 0.7) {
        const boostFactor = (1.0 - effectiveConfidence) * 0.5;
        const delta = this.learningRate * boostFactor;
        this.temperature = Math.max(this.minTemperature, this.temperature - delta);
      }
    }
  }

  public getTemperature(): number {
    return this.temperature;
  }

  public setTemperature(temperature: number): void {
    this.temperature = Math.max(
      this.minTemperature,
      Math.min(this.maxTemperature, temperature)
    );
  }
}
