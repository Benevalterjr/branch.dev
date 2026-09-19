import {
  IFeedbackStore,
  DecisionFeedback,
  ChoiceFeedbackStats,
} from "../../domain/ports/feedback-store.port.js";

export interface FeedbackStoreConfig {
  /** Capacidade máxima de registros em memória (padrão: 1000) */
  maxRecords?: number;
}

/**
 * Adaptador: InMemoryFeedbackStore
 * Armazena registros de feedback operacional com histórico delimitado em memória.
 */
export class InMemoryFeedbackStore implements IFeedbackStore {
  private readonly records: DecisionFeedback[] = [];
  private readonly maxRecords: number;

  constructor(config: FeedbackStoreConfig = {}) {
    this.maxRecords = Math.max(10, config.maxRecords ?? 1000);
  }

  public async record(feedback: DecisionFeedback): Promise<void> {
    this.records.unshift(feedback);
    if (this.records.length > this.maxRecords) {
      this.records.pop();
    }
  }

  public async getRecent(limit: number = 50): Promise<DecisionFeedback[]> {
    return this.records.slice(0, Math.max(1, limit));
  }

  public async getStatsByChoice(choice: string): Promise<ChoiceFeedbackStats> {
    let correct = 0;
    let total = 0;

    for (const r of this.records) {
      if (r.choice === choice) {
        total++;
        if (r.wasCorrect) {
          correct++;
        }
      }
    }

    const incorrect = total - correct;
    const accuracy = total > 0 ? Number((correct / total).toFixed(4)) : 0.0;

    return {
      choice,
      correct,
      incorrect,
      total,
      accuracy,
    };
  }

  public async getAllStats(): Promise<Record<string, ChoiceFeedbackStats>> {
    const statsMap: Record<string, { correct: number; total: number }> = {};

    for (const r of this.records) {
      if (!statsMap[r.choice]) {
        statsMap[r.choice] = { correct: 0, total: 0 };
      }
      statsMap[r.choice].total++;
      if (r.wasCorrect) {
        statsMap[r.choice].correct++;
      }
    }

    const result: Record<string, ChoiceFeedbackStats> = {};
    for (const [choice, counts] of Object.entries(statsMap)) {
      const incorrect = counts.total - counts.correct;
      const accuracy = counts.total > 0 ? Number((counts.correct / counts.total).toFixed(4)) : 0.0;
      result[choice] = {
        choice,
        correct: counts.correct,
        incorrect,
        total: counts.total,
        accuracy,
      };
    }

    return result;
  }

  public async clear(): Promise<void> {
    this.records.length = 0;
  }
}
