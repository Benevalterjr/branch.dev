import { EmptyDistributionException } from "../exceptions/domain-exceptions.js";

/**
 * Value Object: ProbabilityDistribution
 * Representa uma distribuição discreta de probabilidades tipada e normalizada (soma ~ 1.0)
 * com métricas de Entropia de Shannon e salvaguarda Out-of-Distribution (OOD).
 */
export class ProbabilityDistribution<T extends string = string> {
  private readonly _distribution: Readonly<Record<T, number>>;
  private readonly _winner: T;
  private readonly _confidence: number;
  private readonly _entropy: number;
  private readonly _normalizedEntropy: number;
  private readonly _isOOD: boolean;

  constructor(rawProbabilities: Record<T, number>, isOOD: boolean = false) {
    const keys = Object.keys(rawProbabilities) as T[];
    if (keys.length === 0) {
      throw new EmptyDistributionException('A distribuição de probabilidades não pode ser vazia.');
    }

    let highestKey = keys[0];
    let maxProb = -Infinity;
    const normalized: Record<string, number> = {};

    let sum = 0;
    for (const key of keys) {
      const val = Math.max(0, rawProbabilities[key]);
      normalized[key] = val;
      sum += val;
      if (val > maxProb) {
        maxProb = val;
        highestKey = key;
      }
    }

    if (sum <= 0) {
      throw new EmptyDistributionException('Todos os valores da distribuição são zero ou negativos. Não é possível normalizar.');
    }

    if (sum > 0 && Math.abs(sum - 1.0) > 1e-6) {
      for (const key of keys) {
        normalized[key] = Number((normalized[key] / sum).toFixed(4));
        if (!Number.isFinite(normalized[key])) { normalized[key] = 0; }
      }
      maxProb = normalized[highestKey];
    } else {
      for (const key of keys) {
        normalized[key] = Number(normalized[key].toFixed(4));
        if (!Number.isFinite(normalized[key])) { normalized[key] = 0; }
      }
      maxProb = normalized[highestKey];
    }

    // Cálculo da Entropia de Shannon: H(P) = -sum( p_i * log2(p_i) )
    let entropy = 0;
    for (const key of keys) {
      const p = normalized[key];
      if (p > 1e-9) {
        entropy -= p * Math.log2(p);
      }
    }

    const maxEntropy = keys.length > 1 ? Math.log2(keys.length) : 1.0;
    this._entropy = Number(entropy.toFixed(4));
    this._normalizedEntropy = Number((entropy / maxEntropy).toFixed(4));

    this._isOOD = isOOD;
    this._distribution = Object.freeze(normalized as Record<T, number>);
    this._winner = highestKey;
    // Se for Out-of-Distribution, anula a confiança para evitar falsos positivos
    this._confidence = isOOD ? 0.0 : maxProb;
  }

  public get winner(): T {
    return this._winner;
  }

  public get confidence(): number {
    return this._confidence;
  }

  public get isOOD(): boolean {
    return this._isOOD;
  }

  public get entropy(): number {
    return this._entropy;
  }

  public get normalizedEntropy(): number {
    return this._normalizedEntropy;
  }

  public get(choice: T): number {
    return this._distribution[choice] ?? 0;
  }

  public toRecord(): Record<T, number> {
    return { ...this._distribution };
  }

  public toString(): string {
    return Object.entries(this._distribution)
      .map(([k, v]) => `${k}: ${(Number(v) * 100).toFixed(1)}%`)
      .join(", ");
  }
}
