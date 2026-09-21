import { MakeDecisionUseCase } from "./make-decision.use-case.js";
import { EvaluateBooleanUseCase } from "./evaluate-boolean.use-case.js";
import { EvaluateScoreUseCase } from "./evaluate-score.use-case.js";
import {
  WorkflowRequestDto,
  WorkflowResponseDto,
  WorkflowQuestion,
  InferAnswer,
} from "../dtos/workflow-request.dto.js";
import { ChoiceInput } from "../dtos/decide-request.dto.js";
import { UnsupportedQuestionTypeException } from '../../domain/exceptions/domain-exceptions.js';

/**
 * Caso de Uso: RunWorkflowUseCase
 * Suporta o workflow multi-perguntas com inferência estrita de tipos via Mapped Types.
 */
export class RunWorkflowUseCase {
  constructor(
    private readonly makeDecisionUseCase: MakeDecisionUseCase,
    private readonly evaluateBooleanUseCase: EvaluateBooleanUseCase,
    private readonly evaluateScoreUseCase: EvaluateScoreUseCase
  ) {}

  public async execute<
    TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
  >(request: WorkflowRequestDto<TQuestions>): Promise<WorkflowResponseDto<TQuestions>> {
    const startTime = performance.now();
    const entries = Object.entries(request.questions);

    const promises = entries.map(async ([key, q]) => {
      const instructions = q.instructions ?? q.question ?? "";

      if (q.type === "boolean" || q.type === "noul") {
        const res = await this.evaluateBooleanUseCase.execute({
          state: request.state,
          question: instructions,
          affirmativeDescription: q.affirmativeDescription,
          negativeDescription: q.negativeDescription,
          temperature: q.temperature,
        });

        return [
          key,
          {
            type: q.type,
            noul: res.probability,
            value: res.value,
            probability: res.probability,
            confidence: res.confidence,
            isOOD: res.isOOD,
            latencyMs: res.latencyMs,
          },
        ] as const;
      }

      if (q.type === "score") {
        let scale: Record<number, string> = {};
        if (Array.isArray(q.criteria)) {
          q.criteria.forEach((desc, idx) => {
            scale[idx] = desc;
          });
        } else if (q.criteria) {
          scale = q.criteria as Record<number, string>;
        } else if (q.scale) {
          scale = q.scale;
        }

        const res = await this.evaluateScoreUseCase.execute({
          state: request.state,
          question: instructions,
          scale,
          temperature: q.temperature,
        });

        return [
          key,
          {
            type: "score",
            score: res.score,
            legend: scale,
            probabilities: res.probabilities,
            confidence: res.confidence,
            latencyMs: res.latencyMs,
          },
        ] as const;
      }

      if (q.type === "choice") {
        const choices: ChoiceInput<string> = (q.criteria ?? q.choices ?? []) as ChoiceInput<string>;
        const res = await this.makeDecisionUseCase.execute({
          state: request.state,
          choices,
          task: instructions,
          temperature: q.temperature,
        });

        return [
          key,
          {
            type: "choice",
            choice: res.winner,
            probabilities: res.probabilities,
            confidence: res.confidence,
            isOOD: res.isOOD,
            latencyMs: res.latencyMs,
          },
        ] as const;
      }

      throw new UnsupportedQuestionTypeException((q as { type: string }).type);
    });

    const settled = await Promise.allSettled(promises);
    const evaluated: (readonly [string, unknown])[] = [];
    const errors: Array<{ key: string; error: unknown }> = [];

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        evaluated.push(result.value);
      } else {
        errors.push({ key: 'unknown', error: result.reason });
      }
    }
    const answers: Record<string, unknown> = {};
    for (const [key, res] of evaluated) {
      answers[key] = res;
    }

    const totalLatencyMs = Number((performance.now() - startTime).toFixed(2));

    return {
      model: request.model ?? "branch-local-cpu",
      answers: answers as { [K in keyof TQuestions]: InferAnswer<TQuestions[K]> },
      totalLatencyMs,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0.0,
      },
    };
  }
}
