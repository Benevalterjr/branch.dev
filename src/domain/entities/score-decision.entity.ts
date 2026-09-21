import { ProbabilityDistribution } from "./probability.vo.js";
import { LowConfidenceException } from "../exceptions/domain-exceptions.js";

/**
 * Entidade: ScoreDecision (Equivalente à primitiva 'Score' da TypeSafe)
 * Avalia um valor numérico contínuo ponderado em uma escala ordinal via Valor Esperado:
 * E[X] = sum( escala[i] * P(escala[i]) )
 */
export class ScoreDecision {
  public readonly score: number;
  public readonly scale: readonly number[];
  public readonly distribution: ProbabilityDistribution<string>;
  public readonly isOOD: boolean;
  public readonly latencyMs: number;
  public readonly timestampMs: number;

  constructor(
    score: number,
    scale: readonly number[],
    distribution: ProbabilityDistribution<string>,
    latencyMs: number,
    timestampMs: number = Date.now()
  ) {
    if (!Number.isFinite(score)) { score = 0; }
    this.score = Number(score.toFixed(2));
    this.scale = scale;
    this.distribution = distribution;
    this.isOOD = distribution.isOOD;
    this.latencyMs = latencyMs;
    this.timestampMs = timestampMs;
  }

  public get probabilities(): Record<string, number> {
    return this.distribution.toRecord();
  }

  public get confidence(): number {
    return this.distribution.confidence;
  }

  public isConfident(threshold: number = 0.70): boolean {
    if (this.isOOD) return false;
    return this.confidence >= threshold;
  }

  public assertConfidence(threshold: number): void {
    if (!this.isConfident(threshold)) {
      throw new LowConfidenceException(
        this.isOOD ? `[OOD] score=${this.score}` : `score=${this.score}`,
        this.confidence,
        threshold
      );
    }
  }
}
