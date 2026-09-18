import { ProbabilityDistribution } from "./probability.vo.js";

/**
 * Entidade: ScoreDecision (Equivalente à primitiva 'Score' da TypeSafe)
 * Avalia um valor numérico contínuo ponderado em uma escala ordinal via Valor Esperado:
 * E[X] = sum( escala[i] * P(escala[i]) )
 */
export class ScoreDecision {
  public readonly score: number;
  public readonly scale: readonly number[];
  public readonly distribution: ProbabilityDistribution<string>;
  public readonly latencyMs: number;
  public readonly timestamp: Date;

  constructor(
    score: number,
    scale: readonly number[],
    distribution: ProbabilityDistribution<string>,
    latencyMs: number,
    timestamp: Date = new Date()
  ) {
    this.score = Number(score.toFixed(2));
    this.scale = scale;
    this.distribution = distribution;
    this.latencyMs = latencyMs;
    this.timestamp = timestamp;
  }

  public get probabilities(): Record<string, number> {
    return this.distribution.toRecord();
  }

  public get confidence(): number {
    return this.distribution.confidence;
  }
}
