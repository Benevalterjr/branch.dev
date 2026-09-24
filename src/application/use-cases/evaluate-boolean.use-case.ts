import { IDecisionEngine, ChoiceCandidate } from "../../domain/ports/decision-engine.port.js";
import { StateContext } from "../../domain/entities/state-context.vo.js";
import { BooleanDecision } from "../../domain/entities/boolean-decision.entity.js";
import { BooleanRequestDto, BooleanResponseDto } from "../dtos/boolean-request.dto.js";

/**
 * Caso de Uso: EvaluateBooleanUseCase (Primitiva Noul)
 * Avalia se uma afirmação sobre o estado é verdadeira ou falsa com probabilidade calibrada.
 */
export class EvaluateBooleanUseCase {
  constructor(private readonly decisionEngine: IDecisionEngine) {}

  public async execute(request: BooleanRequestDto): Promise<BooleanResponseDto> {
    const stateContext = new StateContext(request.state);

    const cleanQuestion = request.question.replace(/^[\s¿?]+|[\s?]+$/g, "").trim();

    const candidates: readonly ChoiceCandidate<"true" | "false">[] = [
      {
        id: "true",
        description:
          request.affirmativeDescription ??
          `Sim, confirmação afirmativa: ${cleanQuestion}`,
      },
      {
        id: "false",
        description:
          request.negativeDescription ??
          `Não, refutação ou inexistência: ${cleanQuestion}`,
      },
    ];

    const decision = await this.decisionEngine.evaluate<"true" | "false">({
      state: stateContext,
      candidates,
      taskDescription: undefined,
      temperature: request.temperature,
    });

    const trueProbability = decision.probabilities["true"] ?? 0;
    const booleanDecision = new BooleanDecision(
      trueProbability,
      decision.latencyMs,
      decision.isOOD
    );

    const effectiveThreshold = request.confidenceThreshold ?? request.minConfidence;
    const isBelowConfidence = effectiveThreshold !== undefined && booleanDecision.confidence < effectiveThreshold;
    const isUncertain = booleanDecision.isOOD || isBelowConfidence;

    const baseResponse: BooleanResponseDto = {
      value: booleanDecision.value,
      probability: booleanDecision.probability,
      confidence: booleanDecision.confidence,
      actionPolicy: booleanDecision.actionPolicy,
      isOOD: booleanDecision.isOOD,
      latencyMs: booleanDecision.latencyMs,
      system: "system1",
      actProbability: booleanDecision.isOOD ? 0.0 : booleanDecision.confidence,
      delegatedToFallback: false,
      embeddingBackend: decision.embeddingBackend,
    };

    if (request.fallback && isUncertain) {
      const fallbackResult = await request.fallback(baseResponse);
      if (typeof fallbackResult === "boolean") {
        return {
          ...baseResponse,
          value: fallbackResult,
          probability: fallbackResult ? 1.0 : 0.0,
          confidence: 1.0,
          system: "system2",
          delegatedToFallback: true,
          actionPolicy: "AUTOMATE",
        };
      }
      const valueChanged = fallbackResult.value !== undefined && fallbackResult.value !== baseResponse.value;
      return {
        ...baseResponse,
        ...fallbackResult,
        probability: fallbackResult.probability ?? (valueChanged ? (fallbackResult.value ? 1.0 : 0.0) : baseResponse.probability),
        confidence: fallbackResult.confidence ?? (valueChanged ? 1.0 : baseResponse.confidence),
        system: "system2",
        delegatedToFallback: true,
        actionPolicy: fallbackResult.actionPolicy ?? "AUTOMATE",
      };
    }

    if (request.minConfidence !== undefined) {
      booleanDecision.assertConfidence(request.minConfidence);
    }

    return baseResponse;
  }
}

