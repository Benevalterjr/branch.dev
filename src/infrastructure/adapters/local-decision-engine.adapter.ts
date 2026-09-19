import { IDecisionEngine, EngineExecutionParams } from "../../domain/ports/decision-engine.port.js";
import { IEmbeddingModel } from "../../domain/ports/embedding-model.port.js";
import { ICalibrator } from "../../domain/ports/calibrator.port.js";
import { IPrototypeStore } from "../../domain/ports/prototype-store.port.js";
import { Decision } from "../../domain/entities/decision.entity.js";
import { TurboQuant } from "../quant/turbo-quant.js";

/**
 * Adaptador: LocalDecisionEngine
 * Motor de inferência não-autoregressivo de alta performance para CPU.
 * Executa uma passada única (single forward pass), calcula similaridade geométrica,
 * detecta Out-of-Distribution (OOD) e calibra probabilidades.
 */
export class LocalDecisionEngine implements IDecisionEngine {
  private readonly choiceEmbeddingCache = new Map<string, Float32Array>();

  constructor(
    private readonly embeddingModel: IEmbeddingModel,
    private readonly calibrator: ICalibrator,
    private readonly prototypeStore?: IPrototypeStore
  ) {}

  /**
   * Obtém embeddings de lote utilizando cache para escolhas estáticas
   */
  private async getOrEmbedBatch(texts: string[]): Promise<Float32Array[]> {
    const results: (Float32Array | null)[] = texts.map(
      (t) => this.choiceEmbeddingCache.get(t) ?? null
    );
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      if (!results[i]) {
        missingIndices.push(i);
        missingTexts.push(texts[i]);
      }
    }

    if (missingTexts.length > 0) {
      const embedded = await this.embeddingModel.embedBatch(missingTexts);
      for (let j = 0; j < missingTexts.length; j++) {
        const text = missingTexts[j];
        const vec = embedded[j];
        if (this.choiceEmbeddingCache.size > 1000) {
          const firstKey = this.choiceEmbeddingCache.keys().next().value;
          if (firstKey) this.choiceEmbeddingCache.delete(firstKey);
        }
        this.choiceEmbeddingCache.set(text, vec);
        results[missingIndices[j]] = vec;
      }
    }

    return results as Float32Array[];
  }

  public async evaluate<T extends string = string>(
    params: EngineExecutionParams<T>
  ): Promise<Decision<T>> {
    const startTime = performance.now();

    // 1. Constrói o texto semântico do estado com a descrição de tarefa
    const hasTask = Boolean(params.taskDescription && params.taskDescription.trim().length > 0);
    const contextPrompt = hasTask
      ? `Tarefa: ${params.taskDescription}\nContexto do Estado:\n${params.state.canonicalText}`
      : params.state.canonicalText;

    // 2. Extrai embeddings das opções de decisão (armazenadas em cache persistente em memória)
    const choiceIds = params.candidates.map((c) => c.id);
    const candidateTexts = params.candidates.map((c) => {
      const label = c.id !== c.description ? `${c.id}: ${c.description}` : c.description;
      return params.taskDescription ? `${params.taskDescription} -> ${label}` : label;
    });
    const choiceVectors = await this.getOrEmbedBatch(candidateTexts);

    // 2.1 Aprimora as representações vetoriais das escolhas com protótipos reais (Few-Shot Exemplars)
    if (this.prototypeStore) {
      for (let i = 0; i < choiceVectors.length; i++) {
        choiceVectors[i] = await this.prototypeStore.getEnhancedEmbedding(
          choiceIds[i],
          choiceVectors[i]
        );
      }
    }

    // 3. Extrai embeddings de estado (em lote único se contexto e estado direto divergirem)
    let stateVector: Float32Array;
    let directStateVector: Float32Array;

    if (hasTask && contextPrompt !== params.state.canonicalText) {
      const stateBatch = await this.embeddingModel.embedBatch([
        contextPrompt,
        params.state.canonicalText,
      ]);
      stateVector = stateBatch[0];
      directStateVector = stateBatch[1];
    } else {
      stateVector = await this.embeddingModel.embed(params.state.canonicalText);
      directStateVector = stateVector;
    }

    // 4. Calcula similaridades de cosseno (logits brutos) e similaridade pura para OOD
    const rawLogits: number[] = new Array(params.candidates.length);
    let maxPureSim = -Infinity;

    for (let i = 0; i < params.candidates.length; i++) {
      const similarity = TurboQuant.cosineSimilarity(stateVector, choiceVectors[i]);
      rawLogits[i] = similarity;

      const pureSim = TurboQuant.cosineSimilarity(directStateVector, choiceVectors[i]);
      if (pureSim > maxPureSim) maxPureSim = pureSim;
    }

    // 5. Se a similaridade semântica direta for inferior a 0.15, ativa salvaguarda OOD
    const isDirectOOD = maxPureSim < 0.15;

    const distribution = this.calibrator.calibrate<T>(
      choiceIds,
      rawLogits,
      {
        temperature: params.temperature,
        oodThreshold: isDirectOOD ? 999 : 0.0,
      }
    );

    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    return new Decision<T>(distribution, latencyMs);
  }
}
