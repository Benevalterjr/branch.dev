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
      // Para escolhas booleanas primitivas ("true" | "false"), a descrição já contém a semântica direta
      if (c.id === "true" || c.id === "false") {
        return c.description;
      }
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

    // 3. Extrai embedding do estado no contexto da tarefa (passada única otimizada para ranking discriminativo)
    const stateVector = await this.embeddingModel.embed(contextPrompt);

    // 4. Calcula similaridades de cosseno para ranking (logits brutos)
    const rawLogits: number[] = new Array(params.candidates.length);
    for (let i = 0; i < params.candidates.length; i++) {
      rawLogits[i] = TurboQuant.dotProduct(stateVector, choiceVectors[i]);
    }

    // 4.1 Logits puros exclusivos para detecção OOD (desacoplados de qualquer prefixo de tarefa)
    let pureOodLogits: number[] | undefined;
    if (hasTask) {
      const pureCandidateTexts = params.candidates.map((c) => {
        if (c.id === "true" || c.id === "false") {
          return c.description;
        }
        return c.id !== c.description ? `${c.id}: ${c.description}` : c.description;
      });
      const [pureStateVector, pureChoiceVectors] = await Promise.all([
        this.embeddingModel.embed(params.state.canonicalText),
        this.getOrEmbedBatch(pureCandidateTexts),
      ]);
      pureOodLogits = new Array(params.candidates.length);
      for (let i = 0; i < params.candidates.length; i++) {
        pureOodLogits[i] = TurboQuant.dotProduct(pureStateVector, pureChoiceVectors[i]);
      }
    }

    // 5. Detecção de Out-of-Distribution e calibração estatística
    const distribution = this.calibrator.calibrate<T>(
      choiceIds,
      rawLogits,
      {
        temperature: params.temperature,
        oodThreshold: params.oodThreshold,
        pureOodLogits,
      }
    );

    const latencyMs = Number((performance.now() - startTime).toFixed(2));
    const backend = this.embeddingModel.backend ?? "onnx";

    return new Decision<T>(distribution, latencyMs, Date.now(), undefined, backend);
  }

  /**
   * Avalia um lote de decisões em uma única passada de inferência vetorial (single forward pass),
   * agrupando todas as opções e contextos de estado em um único tensor de entrada.
   */
  public async evaluateBatch<T extends string = string>(
    batchParams: EngineExecutionParams<T>[]
  ): Promise<Decision<T>[]> {
    if (batchParams.length === 0) return [];
    if (batchParams.length === 1) {
      const single = await this.evaluate<T>(batchParams[0]);
      return [single];
    }

    const startTime = performance.now();

    // 1. Prepara descrições de contexto e de escolhas para todos os itens do lote
    const preparedItems = batchParams.map((params) => {
      const hasTask = Boolean(params.taskDescription && params.taskDescription.trim().length > 0);
      const pureStateText = params.state.canonicalText;
      const contextPrompt = hasTask
        ? `Tarefa: ${params.taskDescription}\nContexto do Estado:\n${pureStateText}`
        : pureStateText;

      const choiceIds = params.candidates.map((c) => c.id);
      const candidateTexts = params.candidates.map((c) => {
        if (c.id === "true" || c.id === "false") {
          return c.description;
        }
        const label = c.id !== c.description ? `${c.id}: ${c.description}` : c.description;
        return params.taskDescription ? `${params.taskDescription} -> ${label}` : label;
      });

      const pureCandidateTexts = params.candidates.map((c) => {
        if (c.id === "true" || c.id === "false") {
          return c.description;
        }
        return c.id !== c.description ? `${c.id}: ${c.description}` : c.description;
      });

      return {
        params,
        hasTask,
        pureStateText,
        contextPrompt,
        choiceIds,
        candidateTexts,
        pureCandidateTexts,
      };
    });

    // 2. Coleta todos os textos únicos necessários que ainda não estão em cache
    const textToVectorMap = new Map<string, Float32Array>();
    const missingTextsSet = new Set<string>();

    for (const item of preparedItems) {
      const cachedPrompt = this.choiceEmbeddingCache.get(item.contextPrompt);
      if (cachedPrompt) {
        textToVectorMap.set(item.contextPrompt, cachedPrompt);
      } else {
        missingTextsSet.add(item.contextPrompt);
      }

      if (item.hasTask) {
        const cachedPure = this.choiceEmbeddingCache.get(item.pureStateText);
        if (cachedPure) {
          textToVectorMap.set(item.pureStateText, cachedPure);
        } else {
          missingTextsSet.add(item.pureStateText);
        }

        for (const pureText of item.pureCandidateTexts) {
          const cachedCand = this.choiceEmbeddingCache.get(pureText);
          if (cachedCand) {
            textToVectorMap.set(pureText, cachedCand);
          } else {
            missingTextsSet.add(pureText);
          }
        }
      }

      for (const candText of item.candidateTexts) {
        const cachedCand = this.choiceEmbeddingCache.get(candText);
        if (cachedCand) {
          textToVectorMap.set(candText, cachedCand);
        } else {
          missingTextsSet.add(candText);
        }
      }
    }

    // 3. Executa um único forward pass no ONNX para todos os textos pendentes do lote
    if (missingTextsSet.size > 0) {
      const missingTexts = Array.from(missingTextsSet);
      const missingVectors = await this.embeddingModel.embedBatch(missingTexts);

      for (let i = 0; i < missingTexts.length; i++) {
        const text = missingTexts[i];
        const vec = missingVectors[i];
        textToVectorMap.set(text, vec);

        if (this.choiceEmbeddingCache.size > 1000) {
          const firstKey = this.choiceEmbeddingCache.keys().next().value;
          if (firstKey) this.choiceEmbeddingCache.delete(firstKey);
        }
        this.choiceEmbeddingCache.set(text, vec);
      }
    }

    // 4. Calcula similaridades e distribuições calibradas para cada item
    const decisions: Decision<T>[] = [];
    const sharedElapsed = Number((performance.now() - startTime).toFixed(2));
    const perItemLatency = Number((sharedElapsed / batchParams.length).toFixed(2));

    for (const item of preparedItems) {
      const stateVector = textToVectorMap.get(item.contextPrompt)!;
      const choiceVectors: Float32Array[] = item.candidateTexts.map(
        (t) => textToVectorMap.get(t)!
      );

      // Aprimora com protótipos se configurado
      if (this.prototypeStore) {
        for (let i = 0; i < choiceVectors.length; i++) {
          choiceVectors[i] = await this.prototypeStore.getEnhancedEmbedding(
            item.choiceIds[i],
            choiceVectors[i]
          );
        }
      }

      const rawLogits: number[] = new Array(item.params.candidates.length);
      for (let i = 0; i < item.params.candidates.length; i++) {
        rawLogits[i] = TurboQuant.dotProduct(stateVector, choiceVectors[i]);
      }

      // Logits puros exclusivos para avaliação de OOD no lote
      let pureOodLogits: number[] | undefined;
      if (item.hasTask) {
        const pureVec = textToVectorMap.get(item.pureStateText)!;
        const pureChoiceVectors: Float32Array[] = item.pureCandidateTexts.map(
          (t) => textToVectorMap.get(t)!
        );
        pureOodLogits = new Array(item.params.candidates.length);
        for (let i = 0; i < item.params.candidates.length; i++) {
          pureOodLogits[i] = TurboQuant.dotProduct(pureVec, pureChoiceVectors[i]);
        }
      }

      const distribution = this.calibrator.calibrate<T>(
        item.choiceIds,
        rawLogits,
        {
          temperature: item.params.temperature,
          oodThreshold: item.params.oodThreshold,
          pureOodLogits,
        }
      );

      const backend = this.embeddingModel.backend ?? "onnx";
      decisions.push(new Decision<T>(distribution, perItemLatency, Date.now(), undefined, backend));
    }

    return decisions;
  }
}

