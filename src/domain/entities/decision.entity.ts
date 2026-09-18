import { ProbabilityDistribution } from "./probability.vo.js";
import { LowConfidenceException } from "../exceptions/domain-exceptions.js";

/**
 * Entidade de Domínio: Decision
 * Representa uma decisão tomada pelo sistema, seus metadados de confiabilidade, entropia e latência.
 */
export class Decision<T extends string = string> {
  public readonly winner: T;
  public readonly confidence: number;
  public readonly distribution: ProbabilityDistribution<T>;
  public readonly isOOD: boolean;
  public readonly entropy: number;
  public readonly normalizedEntropy: number;
  public readonly latencyMs: number;
  public readonly timestamp: Date;

  constructor(
    distribution: ProbabilityDistribution<T>,
    latencyMs: number,
    timestamp: Date = new Date()
  ) {
    this.distribution = distribution;
    this.winner = distribution.winner;
    this.confidence = distribution.confidence;
    this.isOOD = distribution.isOOD;
    this.entropy = distribution.entropy;
    this.normalizedEntropy = distribution.normalizedEntropy;
    this.latencyMs = latencyMs;
    this.timestamp = timestamp;
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
