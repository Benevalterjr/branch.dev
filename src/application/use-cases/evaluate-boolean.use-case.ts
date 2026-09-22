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

    const candidates: readonly ChoiceCandidate<"true" | "false">[] = [
      {
        id: "true",
        description:
          request.affirmativeDescription ??
          `${request.question} - Sim / Yes / True (evidente, confirmado, urgente, afirmativo)`,
      },
      {
        id: "false",
        description:
          request.negativeDescription ??
          `${request.question} - Não / No / False (não evidente, negado, calmo, negativo)`,
      },
    ];

    const decision = await this.decisionEngine.evaluate<"true" | "false">({
      state: stateContext,
      candidates,
      taskDescription: request.question,
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
      isOOD: booleanDecision.isOOD,
      latencyMs: booleanDecision.latencyMs,
      system: "system1",
      actProbability: booleanDecision.isOOD ? 0.0 : booleanDecision.confidence,
      delegatedToFallback: false,
    };

    if (request.fallback && isUncertain) {
      const fallbackResult = await request.fallback(baseResponse);
      if (typeof fallbackResult === "boolean") {
        return {
          ...baseResponse,
          value: fallbackResult,
          system: "system2",
          delegatedToFallback: true,
        };
      }
      return {
        ...baseResponse,
        ...fallbackResult,
        system: "system2",
        delegatedToFallback: true,
      };
    }

    if (request.minConfidence !== undefined) {
      booleanDecision.assertConfidence(request.minConfidence);
    }

    return baseResponse;
  }
}

