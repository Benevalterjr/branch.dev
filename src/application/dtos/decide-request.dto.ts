import type { DecideResponseDto } from "./decide-response.dto.js";

/**
 * Opção individual estruturada com descrição opcional
 */
export interface ChoiceOption<T extends string = string> {
  id: T;
  description?: string;
  /** Limiar de confiança específico para esta opção (Risk-Aware Threshold) */
  minConfidence?: number;
}

export interface ChoiceDetail {
  description?: string;
  /** Limiar de confiança específico para esta opção (Risk-Aware Threshold) */
  minConfidence?: number;
}

/**
 * Tipos aceitos de escolhas: Enums, Arrays de strings, Objetos de descrição ou ChoiceOptions
 */
export type ChoiceInput<T extends string = string> =
  | readonly T[]
  | Record<string, T>
  | Record<T, string | ChoiceDetail>
  | readonly ChoiceOption<T>[];

/**
 * DTO de Entrada para o caso de uso MakeDecision
 */
export interface DecideRequestDto<T extends string = string> {
  /**
   * O estado da aplicação (objeto complexo, métricas, texto ou JSON).
   */
  state: unknown;

  /**
   * As opções possíveis de decisão.
   */
  choices: ChoiceInput<T>;

  /**
   * Descrição semântica da tarefa (ex: "avaliar probabilidade e risco de churn do cliente").
   */
  task?: string;

  /**
   * Fator de temperatura para calibração estatística (padrão: 1.0).
   */
  temperature?: number;

  /**
   * Limiar de confiança mínima (0.0 a 1.0). Se definido e a decisão não atingir esse valor,
   * aciona o fallback (se fornecido) ou lança LowConfidenceException.
   */
  minConfidence?: number;

  /**
   * Alias semântico para minConfidence (0.0 a 1.0).
   */
  confidenceThreshold?: number;

  /**
   * Limiar de corte para detecção de Out-of-Distribution (OOD).
   * Padrão: 0.15.
   */
  oodThreshold?: number;

  /**
   * Handler de fallback acionado automaticamente quando a decisão do Sistema 1 for insegura
   * (confiança abaixo do limiar ou entrada Out-of-Distribution).
   * Permite delegar transparentemente para um LLM (Groq, Claude, OpenAI) ou regra determinística.
   */
  fallback?: (
    decision: DecideResponseDto<T>
  ) => Promise<T | DecideResponseDto<T>> | T | DecideResponseDto<T>;
}
