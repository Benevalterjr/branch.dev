import { IPrototypeStore } from "../../domain/ports/prototype-store.port.js";

export interface PrototypeStoreConfig {
  /** Número máximo de vetores de exemplo retidos por escolha (padrão: 50) */
  maxExamplesPerChoice?: number;
  /** Peso padrão da descrição textual original na interpolação (padrão: 0.65) */
  defaultAlpha?: number;
}

/**
 * Adaptador: InMemoryPrototypeStore
 * Armazena vetores empíricos em memória e calcula centróides semânticos normalizados (L2)
 * para fusão vetorial (Few-Shot Prototypes) sem alocação excessiva de memória.
 */
export class InMemoryPrototypeStore implements IPrototypeStore {
  private readonly examples = new Map<string, Float32Array[]>();
  private readonly cachedPrototypes = new Map<string, Float32Array>();
  private readonly maxExamplesPerChoice: number;
  private readonly defaultAlpha: number;

  constructor(config: PrototypeStoreConfig = {}) {
    this.maxExamplesPerChoice = Math.max(1, config.maxExamplesPerChoice ?? 50);
    this.defaultAlpha = Math.min(1.0, Math.max(0.0, config.defaultAlpha ?? 0.65));
  }

  public async addExample(choice: string, embedding: Float32Array): Promise<void> {
    if (!embedding || embedding.length === 0) {
      throw new Error("[Branch.dev PrototypeStore] Embedding inválido ou vazio fornecido para addExample.");
    }

    if (!this.examples.has(choice)) {
      this.examples.set(choice, []);
    }
    const list = this.examples.get(choice)!;

    // 1. Validação estrita de dimensionalidade: impede misturar embeddings com dimensões conflitantes
    if (list.length > 0 && list[0].length !== embedding.length) {
      throw new Error(
        `[Branch.dev PrototypeStore] Divergência de dimensionalidade para '${choice}': esperado ${list[0].length} dimensões, recebido ${embedding.length}.`
      );
    }

    // 2. Garante que o vetor adicionado está normalizado em L2 e é uma cópia defensiva imutável
    const normalized = this.normalizeL2(embedding);
    list.push(normalized);

    // 3. Buffer circular limitado para evitar consumo descontrolado de RAM
    if (list.length > this.maxExamplesPerChoice) {
      list.shift();
    }

    // 4. Invalida cache de protótipo para esta escolha
    this.cachedPrototypes.delete(choice);
  }

  public async getPrototype(choice: string): Promise<Float32Array | null> {
    const cached = this.cachedPrototypes.get(choice);
    if (cached) {
      return new Float32Array(cached); // Cópia defensiva
    }

    const list = this.examples.get(choice);
    if (!list || list.length === 0) {
      return null;
    }

    const dim = list[0].length;
    const centroid = new Float32Array(dim);

    // Soma vetorial elemento a elemento com validação de segurança
    for (const emb of list) {
      if (emb.length !== dim) {
        continue;
      }
      for (let i = 0; i < dim; i++) {
        centroid[i] += emb[i];
      }
    }

    // Média do centróide
    const count = list.length;
    for (let i = 0; i < dim; i++) {
      centroid[i] /= count;
    }

    // Normalização L2 do centróide (gera cópia limpa)
    const normalizedCentroid = this.normalizeL2(centroid);
    this.cachedPrototypes.set(choice, normalizedCentroid);
    return new Float32Array(normalizedCentroid);
  }

  public async getEnhancedEmbedding(
    choice: string,
    originalEmbedding: Float32Array,
    alpha: number = this.defaultAlpha
  ): Promise<Float32Array> {
    const prototype = await this.getPrototype(choice);
    if (!prototype) {
      return new Float32Array(originalEmbedding);
    }

    const dim = originalEmbedding.length;
    if (prototype.length !== dim) {
      // Divergência de dimensões entre modelos: preserva original com segurança
      return new Float32Array(originalEmbedding);
    }

    const effectiveAlpha = Math.min(1.0, Math.max(0.0, alpha));
    const blended = new Float32Array(dim);

    // v_final = alpha * v_orig + (1 - alpha) * v_proto
    for (let i = 0; i < dim; i++) {
      blended[i] = effectiveAlpha * originalEmbedding[i] + (1 - effectiveAlpha) * prototype[i];
    }

    return this.normalizeL2(blended);
  }

  public async getExampleCount(choice: string): Promise<number> {
    return this.examples.get(choice)?.length ?? 0;
  }

  public async clear(choice?: string): Promise<void> {
    if (choice) {
      this.examples.delete(choice);
      this.cachedPrototypes.delete(choice);
    } else {
      this.examples.clear();
      this.cachedPrototypes.clear();
    }
  }

  /**
   * Normalização L2 pura e segura (não muta o vetor original de entrada)
   * Trata vetores nulos ou com componentes inválidos (evita NaN e divisão por zero).
   */
  private normalizeL2(vec: Float32Array): Float32Array {
    let sumSq = 0;
    for (let i = 0; i < vec.length; i++) {
      sumSq += vec[i] * vec[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm === 0 || !Number.isFinite(norm)) {
      return new Float32Array(vec.length);
    }

    const out = new Float32Array(vec.length);
    for (let i = 0; i < vec.length; i++) {
      out[i] = vec[i] / norm;
    }
    return out;
  }
}
