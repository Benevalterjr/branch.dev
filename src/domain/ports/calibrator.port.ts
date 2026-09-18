import { ProbabilityDistribution } from "../entities/probability.vo.js";

/**
 * Opções para calibração estatística
 */
export interface CalibrationOptions {
  /**
   * Temperatura para scaling de logits (padrão: 1.0)
   * Temperaturas mais baixas aumentam o contraste; mais altas suavizam.
   */
  temperature?: number;

  /**
   * Limiar de similaridade mínima para detecção de Out-of-Distribution (OOD).
   * Se o maior logit for inferior a esse limiar, a entrada é classificada como OOD (padrão: 0.15).
   */
  oodThreshold?: number;
}

/**
 * Porta: ICalibrator
 * Transforma pontuações brutas (logits/similaridades) em distribuições calibradas.
 */
export interface ICalibrator {
  calibrate<T extends string = string>(
    choices: readonly T[],
    rawLogits: number[],
    options?: CalibrationOptions
  ): ProbabilityDistribution<T>;
}
