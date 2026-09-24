export type EmbeddingBackend = "onnx" | "hash-fallback";

/**
 * Porta: IEmbeddingModel
 * Contrato abstrato para geração de vetores semânticos latentes.
 */
export interface IEmbeddingModel {
  /**
   * Identifica o motor de inferência ativo ("onnx" para modelo neural real, "hash-fallback" para fallback local).
   */
  readonly backend?: EmbeddingBackend;

  /**
   * Gera o embedding para um texto em ponto flutuante de 32 bits.
   */
  embed(text: string): Promise<Float32Array>;

  /**
   * Gera múltiplos embeddings em lote (batching).
   * Para modelos assimétricos (ex: família E5), type diferencia consultas ("query") de passagens/candidatos ("passage").
   */
  embedBatch(texts: string[], type?: "query" | "passage"): Promise<Float32Array[]>;
}
