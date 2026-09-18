/**
 * DTO de Entrada para a Primitiva Boolean (Noul)
 */
export interface BooleanRequestDto {
  /**
   * O estado do sistema a ser analisado
   */
  state: unknown;

  /**
   * A pergunta ou afirmação a ser testada (ex: "A mensagem solicita estorno ou reembolso?")
   */
  question: string;

  /**
   * Descrição semântica opcional para o caso verdadeiro
   */
  affirmativeDescription?: string;

  /**
   * Descrição semântica opcional para o caso falso
   */
  negativeDescription?: string;

  /**
   * Temperatura para calibração de probabilidade
   */
  temperature?: number;

  /**
   * Confiança mínima requerida (0.0 a 1.0)
   */
  minConfidence?: number;
}

/**
 * DTO de Saída para a Primitiva Boolean (Noul)
 */
export interface BooleanResponseDto {
  /**
   * Resultado booleano principal (true se probabilidade >= 0.5)
   */
  value: boolean;

  /**
   * Probabilidade calibrada de ser verdadeiro (0.00 a 1.00)
   */
  probability: number;

  /**
   * Nível de certeza geral da decisão (max(P(true), P(false)))
   */
  confidence: number;

  /**
   * Indica se a entrada é Out-of-Distribution (fora do domínio esperado)
   */
  isOOD: boolean;

  /**
   * Latência da inferência em milissegundos
   */
  latencyMs: number;

  /**
   * Verifica se a confiança atinge o limiar
   */
  isConfident(threshold?: number): boolean;

  /**
   * Assegura a confiança mínima ou lança LowConfidenceException
   */
  assertConfidence(threshold: number): void;
}
