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
}
