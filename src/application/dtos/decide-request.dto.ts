/**
 * Opção individual estruturada com descrição opcional
 */
export interface ChoiceOption<T extends string = string> {
  id: T;
  description?: string;
}

/**
 * Tipos aceitos de escolhas: Enums, Arrays de strings, Objetos de descrição ou ChoiceOptions
 */
export type ChoiceInput<T extends string = string> =
  | readonly T[]
  | Record<string, T>
  | Record<T, string>
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
   * lança LowConfidenceException.
   */
  minConfidence?: number;
}
