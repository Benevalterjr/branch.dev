import { ProbabilityDistribution } from "./probability.vo.js";
import { LowConfidenceException } from "../exceptions/domain-exceptions.js";
import type { ActionPolicy, ActionPolicyThresholds } from "./decision.entity.js";

/**
 * Entidade: ScoreDecision (Equivalente à primitiva 'Score' da TypeSafe)
 * Avalia um valor numérico contínuo ponderado em uma escala ordinal via Valor Esperado:
 * E[X] = sum( escala[i] * P(escala[i]) )
 */
export class ScoreDecision {
  public readonly score: number;
  public readonly scale: readonly number[];
  public readonly actionPolicy: ActionPolicy;
  public readonly distribution: ProbabilityDistribution<string>;
  public readonly isOOD: boolean;
  public readonly latencyMs: number;
  public readonly timestampMs: number;

  constructor(
    score: number,
    scale: readonly number[],
    distribution: ProbabilityDistribution<string>,
    latencyMs: number,
    timestampMs: number = Date.now(),
    actionPolicyThresholds?: ActionPolicyThresholds
  ) {
    if (!Number.isFinite(score)) { score = 0; }
    this.score = Number(score.toFixed(2));
    this.scale = scale;
    this.distribution = distribution;
    this.isOOD = distribution.isOOD;
    this.latencyMs = latencyMs;
    this.timestampMs = timestampMs;

    const automateThreshold = actionPolicyThresholds?.automate ?? 0.80;
    const verifyThreshold = actionPolicyThresholds?.verify ?? 0.50;
    if (this.isOOD) {
      this.actionPolicy = "ESCALATE";
    } else if (this.distribution.confidence >= automateThreshold) {
      this.actionPolicy = "AUTOMATE";
    } else if (this.distribution.confidence >= verifyThreshold) {
      this.actionPolicy = "VERIFY";
    } else {
      this.actionPolicy = "ESCALATE";
    }
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
