import { IDecisionEngine } from "../../domain/ports/decision-engine.port.js";
import { StateContext } from "../../domain/entities/state-context.vo.js";
import { ScoreDecision } from "../../domain/entities/score-decision.entity.js";
import { ScoreRequestDto, ScoreResponseDto } from "../dtos/score-request.dto.js";
import { InvalidScaleException } from '../../domain/exceptions/domain-exceptions.js';

/**
 * Caso de Uso: EvaluateScoreUseCase (Primitiva Score)
 * Calcula a pontuação esperada E[X] em uma escala ordinal ponderada pelas probabilidades.
 */
export class EvaluateScoreUseCase {
  constructor(private readonly decisionEngine: IDecisionEngine) {}

  public async execute(request: ScoreRequestDto): Promise<ScoreResponseDto> {
    const stateContext = new StateContext(request.state);

    const scaleEntries = Object.entries(request.scale).map(([numStr, desc]) => ({
      num: Number(numStr),
      id: numStr,
      description: desc,
    }));

    if (scaleEntries.length < 2) {
      throw new InvalidScaleException();
    }

    const candidates = scaleEntries.map((e) => ({
      id: e.id,
      description: e.description,
    }));

    const decision = await this.decisionEngine.evaluate<string>({
      state: stateContext,
      candidates,
      taskDescription: request.question,
      temperature: request.temperature,
    });

    // Calcula o Valor Esperado: E[X] = sum( valor * probabilidade )
    let expectedScore = 0;
    const numericProbs: Record<number, number> = {};

    for (const entry of scaleEntries) {
      const prob = decision.probabilities[entry.id] ?? 0;
      numericProbs[entry.num] = prob;
      expectedScore += entry.num * prob;
    }

    const scoreDecision = new ScoreDecision(
      expectedScore,
      scaleEntries.map((e) => e.num),
      decision.distribution,
      decision.latencyMs
    );

    return {
      score: scoreDecision.score,
      probabilities: numericProbs,
      confidence: scoreDecision.confidence,
      isOOD: decision.isOOD,
      latencyMs: scoreDecision.latencyMs,
    };
  }
}
