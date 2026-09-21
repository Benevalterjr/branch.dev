/**
 * DTO de Saída da decisão
 * Dados puros serializáveis (sem métodos/closures) para compatibilidade com JSON, IPC e Web Workers.
 */
export interface DecideResponseDto<T extends string = string> {
  /** A opção vencedora (com maior probabilidade calibrada). */
  winner: T;
  /** Confiança calibrada da opção vencedora (0.0 a 1.0). Se for OOD, o valor é 0.0. */
  confidence: number;
  /** Indica se a entrada é Out-of-Distribution (fora do escopo semântico das opções). */
  isOOD: boolean;
  /** Entropia de Shannon da distribuição: H(P) = -sum( p_i * log2(p_i) ). */
  entropy: number;
  /** Entropia normalizada (0.0 a 1.0) relativa à máxima incerteza. */
  normalizedEntropy: number;
  /** Distribuição completa de probabilidades por opção. */
  probabilities: Record<T, number>;
  /** Tempo de processamento em milissegundos. */
  latencyMs: number;
}
