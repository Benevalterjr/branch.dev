/**
 * DTO de Entrada para a Primitiva Score
 */
export interface ScoreRequestDto {
  /**
   * O estado do sistema a ser analisado
   */
  state: unknown;

  /**
   * Pergunta a ser pontuada (ex: "Quão frustrado está esse cliente?")
   */
  question: string;

  /**
   * Escala ordinal mapeando valores numéricos a descrições semânticas.
   * Exemplo: { 0: "calmo", 1: "frustrado", 2: "muito frustrado" }
   */
  scale: Record<number, string>;

  /**
   * Temperatura para calibração estatística
   */
  temperature?: number;
}

/**
 * DTO de Saída para a Primitiva Score
 */
export interface ScoreResponseDto {
  /**
   * Pontuação contínua calculada via Valor Esperado E[X] (ex: 1.4)
   */
  score: number;

  /**
   * Distribuição de probabilidades em cada ponto da escala
   */
  probabilities: Record<number, number>;

  /**
   * Grau de confiança na categoria de maior probabilidade
   */
  confidence: number;

  /**
   * Latência da inferência em milissegundos
   */
  latencyMs: number;
}
