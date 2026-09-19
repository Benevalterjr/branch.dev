/**
 * Porta: IPrototypeStore
 * Contrato abstrato para armazenamento e computação de protótipos semânticos (Few-Shot Exemplars).
 * Permite ao motor de decisão refinar as representações vetoriais das escolhas a partir
 * de exemplos confirmados no mundo real, sem necessidade de re-treinamento autoregressivo.
 */
export interface IPrototypeStore {
  /**
   * Armazena um embedding confirmado como exemplo positivo de uma escolha.
   */
  addExample(choice: string, embedding: Float32Array): Promise<void>;

  /**
   * Obtém o vetor protótipo consolidado (centróide L2-normalizado) para a escolha informada.
   * Retorna null caso não haja exemplos registrados.
   */
  getPrototype(choice: string): Promise<Float32Array | null>;

  /**
   * Combina o embedding descritivo original com o protótipo empírico da escolha via interpolação linear (alpha blending):
   * v_final = normalize_L2(alpha * v_original + (1 - alpha) * v_prototype)
   *
   * @param choice Identificador da escolha
   * @param originalEmbedding Embedding vetorial da descrição textual
   * @param alpha Peso da descrição textual (padrão recomendado: 0.65)
   */
  getEnhancedEmbedding(
    choice: string,
    originalEmbedding: Float32Array,
    alpha?: number
  ): Promise<Float32Array>;

  /**
   * Retorna a quantidade de exemplos empíricos armazenados para uma escolha.
   */
  getExampleCount(choice: string): Promise<number>;

  /**
   * Limpa os exemplos armazenados de uma escolha específica ou de todas.
   */
  clear(choice?: string): Promise<void>;
}
