import { LowConfidenceException } from "../exceptions/domain-exceptions.js";
import type { ActionPolicy, ActionPolicyThresholds } from "./decision.entity.js";

/**
 * Entidade: BooleanDecision (Equivalente à primitiva 'Noul' da TypeSafe)
 * Representa uma decisão booleana com probabilidade contínua calibrada (0.0 a 1.0)
 * e salvaguarda Out-of-Distribution (OOD).
 */
export class BooleanDecision {
  public readonly value: boolean;
  public readonly probability: number; // Probabilidade de ser verdadeiro (0.00 a 1.00)
  public readonly confidence: number;  // Grau de certeza: max(P(true), P(false))
  public readonly actionPolicy: ActionPolicy;
  public readonly isOOD: boolean;
  public readonly latencyMs: number;
  public readonly timestampMs: number;

  constructor(
    trueProbability: number,
    latencyMs: number,
    isOOD: boolean = false,
    timestampMs: number = Date.now(),
    actionPolicyThresholds?: ActionPolicyThresholds
  ) {
    if (!Number.isFinite(trueProbability)) { trueProbability = 0.5; }
    this.isOOD = isOOD;
    this.probability = Math.min(1.0, Math.max(0.0, Number(trueProbability.toFixed(4))));
    this.value = this.probability >= 0.5;
    // Se for OOD, anula a confiança para evitar falsos positivos
    this.confidence = isOOD
      ? 0.0
      : Math.max(this.probability, Number((1 - this.probability).toFixed(4)));
    this.latencyMs = latencyMs;
    this.timestampMs = timestampMs;

    const automateThreshold = actionPolicyThresholds?.automate ?? 0.80;
    const verifyThreshold = actionPolicyThresholds?.verify ?? 0.50;
    if (this.isOOD) {
      this.actionPolicy = "ESCALATE";
    } else if (this.confidence >= automateThreshold) {
      this.actionPolicy = "AUTOMATE";
    } else if (this.confidence >= verifyThreshold) {
      this.actionPolicy = "VERIFY";
    } else {
      this.actionPolicy = "ESCALATE";
    }
  }

  public isConfident(threshold: number = 0.70): boolean {
    if (this.isOOD) return false;
    return this.confidence >= threshold;
  }

  public assertConfidence(threshold: number): void {
    if (!this.isConfident(threshold)) {
      throw new LowConfidenceException(
        this.isOOD ? `[OOD] ${String(this.value)}` : String(this.value),
        this.confidence,
        threshold
      );
    }
  }
}
