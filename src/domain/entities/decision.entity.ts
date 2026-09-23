import { ProbabilityDistribution } from "./probability.vo.js";
import { LowConfidenceException } from "../exceptions/domain-exceptions.js";

/**
 * Política de Ação recomendada (Semáforo de Decisão):
 * - "AUTOMATE": Alta certeza (>= 0.80) -> Execução direta e autônoma.
 * - "VERIFY": Certeza intermediária (0.50 a 0.80) -> Requer confirmação, 2FA, log de auditoria.
 * - "ESCALATE": Certeza baixa (< 0.50) ou Out-of-Distribution (OOD) -> Escalar para Sistema 2 ou humano.
 */
export type ActionPolicy = "AUTOMATE" | "VERIFY" | "ESCALATE";

export interface ActionPolicyThresholds {
  automate?: number;
  verify?: number;
}

/**
 * Entidade de Domínio: Decision
 * Representa uma decisão tomada pelo sistema, seus metadados de confiabilidade, entropia e latência.
 */
export class Decision<T extends string = string> {
  public readonly winner: T;
  public readonly confidence: number;
  public readonly actionPolicy: ActionPolicy;
  public readonly distribution: ProbabilityDistribution<T>;
  public readonly isOOD: boolean;
  public readonly entropy: number;
  public readonly normalizedEntropy: number;
  public readonly latencyMs: number;
  public readonly timestampMs: number;

  constructor(
    distribution: ProbabilityDistribution<T>,
    latencyMs: number,
    timestampMs: number = Date.now(),
    actionPolicyThresholds?: ActionPolicyThresholds
  ) {
    this.distribution = distribution;
    this.winner = distribution.winner;
    this.confidence = distribution.confidence;
    this.isOOD = distribution.isOOD;
    this.entropy = distribution.entropy;
    this.normalizedEntropy = distribution.normalizedEntropy;
    this.latencyMs = latencyMs;
    this.timestampMs = timestampMs;

    const keys = Object.keys(distribution.toRecord());
    const k = keys.length || 2;

    let defaultAutomate = 0.80;
    let defaultVerify = 0.50;

    if (k <= 2) {
      defaultAutomate = 0.80;
      defaultVerify = 0.50;
    } else if (k <= 5) {
      defaultAutomate = 0.70;
      defaultVerify = 0.42;
    } else if (k <= 10) {
      defaultAutomate = 0.58;
      defaultVerify = 0.28;
    } else {
      defaultAutomate = 0.45;
      defaultVerify = 0.18;
    }

    const automateThreshold = actionPolicyThresholds?.automate ?? defaultAutomate;
    const verifyThreshold = actionPolicyThresholds?.verify ?? defaultVerify;
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

  /**
   * Facilidade de acesso direto: retorna um mapa com as probabilidades por chave.
   */
  public get probabilities(): Record<T, number> {
    return this.distribution.toRecord();
  }

  /**
   * Verifica se o nível de calibração atingiu a meta estipulada e se NÃO é Out-of-Distribution.
   */
  public isConfident(threshold: number = 0.70): boolean {
    if (this.isOOD) return false;
    return this.confidence >= threshold;
  }

  /**
   * Guard clause: garante que o fluxo só continue se a decisão for segura.
   * Lança LowConfidenceException se for OOD ou confiança for insuficiente.
   */
  public assertConfidence(threshold: number): void {
    if (!this.isConfident(threshold)) {
      throw new LowConfidenceException(
        this.isOOD ? `[OOD - Fora de Domínio] ${this.winner}` : this.winner,
        this.confidence,
        threshold
      );
    }
  }
}
