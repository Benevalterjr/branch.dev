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

  /**
   * Confiança mínima requerida (0.0 a 1.0)
   */
  minConfidence?: number;

  /**
   * Limiar de confiança para acionamento de fallback (0.0 a 1.0).
   * Se a confiança for menor que esse valor ou o estado for OOD, o fallback é invocado.
   */
  confidenceThreshold?: number;

  /**
   * Função de fallback acionada automaticamente quando a pontuação for incerta ou Out-of-Distribution.
   * Permite delegar graciosamente ao Sistema 2.
   */
  fallback?: (
    decision: ScoreResponseDto
  ) =>
    | Promise<number | Partial<ScoreResponseDto>>
    | number
    | Partial<ScoreResponseDto>;
}

/**
 * DTO de Saída para a Primitiva Score
 * Dados puros serializáveis.
 */
export interface ScoreResponseDto {
  /** Pontuação contínua calculada via Valor Esperado E[X] (ex: 1.4) */
  score: number;
  /** Distribuição de probabilidades em cada ponto da escala */
  probabilities: Record<number, number>;
  /** Grau de confiança na categoria de maior probabilidade */
  confidence: number;
  /** Indica se a entrada é Out-of-Distribution */
  isOOD: boolean;
  /** Latência da inferência em milissegundos */
  latencyMs: number;
  /**
   * Indica se a resposta veio do Sistema 1 (rápido, determinístico) ou do Sistema 2 (fallback/LLM).
   */
  system?: "system1" | "system2";
  /**
   * Probabilidade estimada para o agente agir autonomamente (metacognição).
   * Se for Out-of-Distribution (OOD), o valor é 0.0.
   */
  actProbability?: number;
  /**
   * Indica se a decisão foi resolvida por um fallback do Sistema 2.
   */
  delegatedToFallback?: boolean;
}

