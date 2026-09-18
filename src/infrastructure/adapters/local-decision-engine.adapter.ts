import { IDecisionEngine, EngineExecutionParams } from "../../domain/ports/decision-engine.port.js";
import { IEmbeddingModel } from "../../domain/ports/embedding-model.port.js";
import { ICalibrator } from "../../domain/ports/calibrator.port.js";
import { Decision } from "../../domain/entities/decision.entity.js";
import { TurboQuant } from "../quant/turbo-quant.js";

/**
 * Adaptador: LocalDecisionEngine
 * Motor de inferência não-autoregressivo de alta performance para CPU.
 * Executa uma passada única (single forward pass), calcula similaridade geométrica,
 * detecta Out-of-Distribution (OOD) e calibra probabilidades.
 */
export class LocalDecisionEngine implements IDecisionEngine {
  constructor(
    private readonly embeddingModel: IEmbeddingModel,
    private readonly calibrator: ICalibrator
  ) {}

  public async evaluate<T extends string = string>(
    params: EngineExecutionParams<T>
  ): Promise<Decision<T>> {
    const startTime = performance.now();

    // 1. Constrói o texto semântico do estado com a descrição de tarefa
    const contextPrompt = params.taskDescription
      ? `Tarefa: ${params.taskDescription}\nContexto do Estado:\n${params.state.canonicalText}`
      : params.state.canonicalText;

    // 2. Extrai o embedding do estado com contexto e direto (para OOD check)
    const stateVector = await this.embeddingModel.embed(contextPrompt);
    const directStateVector = await this.embeddingModel.embed(params.state.canonicalText);

    // 3. Extrai embeddings das opções de decisão com descrições semânticas
    const choiceIds = params.candidates.map((c) => c.id);
    const candidateTexts = params.candidates.map((c) => {
      const label = c.id !== c.description ? `${c.id}: ${c.description}` : c.description;
      return params.taskDescription ? `${params.taskDescription} -> ${label}` : label;
    });
    const choiceVectors = await this.embeddingModel.embedBatch(candidateTexts);

    // 4. Calcula similaridades de cosseno (logits brutos) e similaridade pura para OOD
    const choicePureTexts = params.candidates.map((c) =>
      c.id !== c.description ? `${c.id} ${c.description}` : c.description
    );
    const choicePureVectors = await this.embeddingModel.embedBatch(choicePureTexts);

    const rawLogits: number[] = [];
    let maxPureSim = -Infinity;
    for (let i = 0; i < params.candidates.length; i++) {
      const similarity = TurboQuant.cosineSimilarity(stateVector, choiceVectors[i]);
      rawLogits.push(similarity);

      const pureSim = TurboQuant.cosineSimilarity(directStateVector, choicePureVectors[i]);
      if (pureSim > maxPureSim) maxPureSim = pureSim;
    }

    // 5. Se a similaridade semântica pura for inferior a 0.15, ativa salvaguarda OOD
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
