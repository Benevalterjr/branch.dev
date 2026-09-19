/**
 * Registro de feedback para auditoria, calibração e rastreabilidade de decisões.
 */
export interface DecisionFeedback {
  /** Identificador único do registro de feedback */
  id: string;
  /** Hash ou resumo identificador do estado avaliado */
  stateHash?: string;
  /** Identificador da escolha associada */
  choice: string;
  /** Indica se a escolha foi validada como correta */
  wasCorrect: boolean;
  /** Confiança atribuída pelo motor no momento da decisão (0.0 a 1.0) */
  confidenceAtDecision: number;
  /** Timestamp Unix em milissegundos */
  timestamp: number;
  /** Metadados adicionais opcionais (ex: ID do usuário, canal, motivo de correção) */
  metadata?: Record<string, unknown>;
}

/**
 * Estatísticas consolidadas de feedback por escolha.
 */
export interface ChoiceFeedbackStats {
  choice: string;
  correct: number;
  incorrect: number;
  total: number;
  accuracy: number;
}

/**
 * Porta: IFeedbackStore
 * Contrato abstrato para persistência e consulta de feedbacks operacionais.
 */
export interface IFeedbackStore {
  /**
   * Registra um novo feedback de decisão.
   */
  record(feedback: DecisionFeedback): Promise<void>;

  /**
   * Recupera os feedbacks mais recentes, ordenados do mais novo para o mais antigo.
   */
  getRecent(limit?: number): Promise<DecisionFeedback[]>;

  /**
   * Retorna métricas de acurácia consolidadas para uma escolha específica.
   */
  getStatsByChoice(choice: string): Promise<ChoiceFeedbackStats>;

  /**
   * Retorna métricas de acurácia de todas as escolhas com registros.
   */
  getAllStats(): Promise<Record<string, ChoiceFeedbackStats>>;

  /**
   * Limpa o histórico de feedbacks.
   */
  clear(): Promise<void>;
}
