import { ICalibrator } from "./calibrator.port.js";

/**
 * Parâmetros para atualização adaptativa do calibrador baseada em feedback de execução.
 */
export interface FeedbackCalibrationParams {
  /**
   * Logits brutos ou similaridades calculadas no momento da decisão.
   */
  logits?: number[];

  /**
   * Índice da escolha prevista pelo motor.
   */
  predictedIndex?: number;

  /**
   * Nível de confiança (0.0 a 1.0) emitido pelo motor para o vencedor.
   */
  confidence?: number;

  /**
   * Se a decisão do motor foi considerada correta pelo validador/humano.
   */
  wasCorrect: boolean;

  /**
   * Índice da escolha que era a correta (opcional, útil quando conhecido em feedbacks negativos).
   */
  actualIndex?: number;
}

/**
 * Métricas de rastreabilidade do aprendizado de calibração em tempo real.
 */
export interface CalibrationMetrics {
  /** Temperatura de calibração atual */
  temperature: number;
  /** Total de feedbacks de calibração processados */
  totalFeedbacks: number;
  /** Brier score médio móvel ponderado (menor é melhor, 0.0 é calibração perfeita) */
  runningBrierScore: number;
  /** Taxa acumulada de acurácia observada */
  accuracy: number;
  /** Magnitude do último gradiente dL/dT calculado */
  lastGradient: number;
}

/**
 * Porta: IAdaptiveCalibrator
 * Contrato abstrato para calibradores estatísticos capazes de aprender
 * e ajustar a temperatura de escala dinamicamente com base em feedback real.
 */
export interface IAdaptiveCalibrator extends ICalibrator {
  /**
   * Registra um feedback de acerto ou erro para atualizar a temperatura dinamicamente.
   */
  recordFeedback(params: FeedbackCalibrationParams): void;

  /**
   * Retorna o valor atual da temperatura de scaling.
   */
  getTemperature(): number;

  /**
   * Ajusta explicitamente a temperatura de scaling.
   */
  setTemperature(temperature: number): void;

  /**
   * Retorna as métricas estatísticas e de calibração atuais.
   */
  getMetrics?(): CalibrationMetrics;

  /**
   * Reseta o estado do otimizador para os parâmetros iniciais.
   */
  reset?(): void;
}
