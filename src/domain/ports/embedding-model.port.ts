/**
 * Porta: IEmbeddingModel
 * Contrato abstrato para geração de vetores semânticos latentes.
 */
export interface IEmbeddingModel {
  /**
   * Gera o embedding para um texto em ponto flutuante de 32 bits.
   */
  embed(text: string): Promise<Float32Array>;

  /**
   * Gera múltiplos embeddings em lote (batching).
   */
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}
