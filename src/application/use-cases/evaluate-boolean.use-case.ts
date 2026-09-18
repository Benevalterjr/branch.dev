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
          `${request.question} - Yes / True (evident, confirmed, urgent, affirmative)`,
      },
      {
        id: "false",
        description:
          request.negativeDescription ??
          `${request.question} - No / False (not evident, denied, calm, negative)`,
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

    if (request.minConfidence !== undefined) {
      booleanDecision.assertConfidence(request.minConfidence);
    }

    return {
      value: booleanDecision.value,
      probability: booleanDecision.probability,
      confidence: booleanDecision.confidence,
      isOOD: booleanDecision.isOOD,
      latencyMs: booleanDecision.latencyMs,
      isConfident: (threshold = 0.7) => booleanDecision.isConfident(threshold),
      assertConfidence: (threshold: number) => booleanDecision.assertConfidence(threshold),
    };
  }
}
