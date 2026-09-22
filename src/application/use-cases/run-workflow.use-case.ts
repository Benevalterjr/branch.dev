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
import {
  UnsupportedQuestionTypeException,
  InvalidChoicesException,
  InvalidScaleException,
} from "../../domain/exceptions/domain-exceptions.js";
import { IDecisionEngine, EngineExecutionParams, ChoiceCandidate } from "../../domain/ports/decision-engine.port.js";
import { StateContext } from "../../domain/entities/state-context.vo.js";
import { BooleanDecision } from "../../domain/entities/boolean-decision.entity.js";
import { ScoreDecision } from "../../domain/entities/score-decision.entity.js";

/**
 * Caso de Uso: RunWorkflowUseCase
 * Suporta workflow multi-perguntas com inferência estrita de tipos via Mapped Types.
 * Otimizado com passada única vetorial (single forward pass) para todas as perguntas do estado,
 * suporte a metacognição e fallback automático para Sistema 2 (LLM).
 */
export class RunWorkflowUseCase {
  constructor(
    private readonly makeDecisionUseCase: MakeDecisionUseCase,
    private readonly evaluateBooleanUseCase: EvaluateBooleanUseCase,
    private readonly evaluateScoreUseCase: EvaluateScoreUseCase,
    private readonly decisionEngine?: IDecisionEngine
  ) {}

  public async execute<
    TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
  >(request: WorkflowRequestDto<TQuestions>): Promise<WorkflowResponseDto<TQuestions>> {
    const startTime = performance.now();
    const entries = Object.entries(request.questions);

    // Se o motor suportar execução em lote vetorial, utiliza passada única (single forward pass)
    if (this.decisionEngine && typeof this.decisionEngine.evaluateBatch === "function") {
      return this.executeBatched(request, entries, startTime);
    }

    return this.executeConcurrent(request, entries, startTime);
  }

  /**
   * Execução em passada única vetorial agrupada
   * Todos os textos do estado e escolhas são tokenizados e projetados em lote.
   */
  private async executeBatched<
    TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
  >(
    request: WorkflowRequestDto<TQuestions>,
    entries: [string, WorkflowQuestion][],
    startTime: number
  ): Promise<WorkflowResponseDto<TQuestions>> {
    const stateContext = new StateContext(request.state);

    // 1. Prepara os metadados de cada pergunta e os parâmetros do motor
    const preparedQuestions = entries.map(([key, q]) => {
      const instructions = q.instructions ?? q.question ?? "";

      if (q.type === "boolean" || q.type === "noul") {
        const candidates: ChoiceCandidate<string>[] = [
          {
            id: "true",
            description:
              q.affirmativeDescription ??
              `${instructions} - Sim / Yes / True (evidente, confirmado, urgente, afirmativo)`,
          },
          {
            id: "false",
            description:
              q.negativeDescription ??
              `${instructions} - Não / No / False (não evidente, negado, calmo, negativo)`,
          },
        ];

        const engineParams: EngineExecutionParams<string> = {
          state: stateContext,
          candidates,
          taskDescription: instructions,
          temperature: q.temperature,
        };

        return { key, q, instructions, engineParams, type: q.type as "boolean" | "noul" };
      }

      if (q.type === "score") {
        const scale: Record<number, string> = {};
        if (Array.isArray(q.criteria)) {
          q.criteria.forEach((desc, idx) => {
            scale[idx] = desc;
          });
        } else if (q.criteria) {
          Object.assign(scale, q.criteria);
        } else if (q.scale) {
          Object.assign(scale, q.scale);
        }

        const scaleEntries = Object.entries(scale).map(([numStr, desc]) => ({
          num: Number(numStr),
          id: numStr,
          description: desc,
        }));

        if (scaleEntries.length < 2) {
          throw new InvalidScaleException();
        }

        const candidates: ChoiceCandidate<string>[] = scaleEntries.map((e) => ({
          id: e.id,
          description: e.description,
        }));

        const engineParams: EngineExecutionParams<string> = {
          state: stateContext,
          candidates,
          taskDescription: instructions,
          temperature: q.temperature,
        };

        return { key, q, instructions, engineParams, scale, scaleEntries, type: "score" as const };
      }

      if (q.type === "choice") {
        const rawChoices: ChoiceInput<string> = (q.criteria ?? q.choices ?? []) as ChoiceInput<string>;
        const candidates = MakeDecisionUseCase.normalizeCandidates(rawChoices);

        if (candidates.length < 2) {
          throw new InvalidChoicesException();
        }

        const engineParams: EngineExecutionParams<string> = {
          state: stateContext,
          candidates,
          taskDescription: instructions,
          temperature: q.temperature,
        };

        return { key, q, instructions, engineParams, type: "choice" as const };
      }

      throw new UnsupportedQuestionTypeException((q as { type: string }).type);
    });

    // 2. Executa todas as avaliações em UMA única passada vetorial pelo modelo ONNX
    const batchParams = preparedQuestions.map((p) => p.engineParams);
    const decisions = await this.decisionEngine!.evaluateBatch!(batchParams);

    // 3. Processa resultados, incerteza e fallbacks
    const answers: Record<string, unknown> = {};

    for (let i = 0; i < preparedQuestions.length; i++) {
      const item = preparedQuestions[i];
      const decision = decisions[i];
      const effectiveThreshold =
        item.q.confidenceThreshold ?? item.q.minConfidence ?? request.confidenceThreshold;

      if (item.type === "boolean" || item.type === "noul") {
        const trueProbability = decision.probabilities["true"] ?? 0;
        const booleanDecision = new BooleanDecision(
          trueProbability,
          decision.latencyMs,
          decision.isOOD
        );

        const isBelowConfidence =
          effectiveThreshold !== undefined && booleanDecision.confidence < effectiveThreshold;
        const isUncertain = booleanDecision.isOOD || isBelowConfidence;

        let ans: Record<string, unknown> = {
          type: item.type,
          noul: booleanDecision.probability,
          value: booleanDecision.value,
          probability: booleanDecision.probability,
          confidence: booleanDecision.confidence,
          isOOD: booleanDecision.isOOD,
          latencyMs: booleanDecision.latencyMs,
          system: "system1",
          actProbability: booleanDecision.isOOD ? 0.0 : booleanDecision.confidence,
          delegatedToFallback: false,
        };

        if (item.q.fallback && isUncertain) {
          const fallbackRes = await item.q.fallback(ans as any);
          if (typeof fallbackRes === "boolean") {
            ans = { ...ans, value: fallbackRes, system: "system2", delegatedToFallback: true };
          } else if (typeof fallbackRes === "object" && fallbackRes !== null) {
            ans = { ...ans, ...fallbackRes, system: "system2", delegatedToFallback: true };
          }
        } else if (item.q.minConfidence !== undefined) {
          booleanDecision.assertConfidence(item.q.minConfidence);
        }

        answers[item.key] = ans;
        continue;
      }

      if (item.type === "score") {
        let expectedScore = 0;
        const numericProbs: Record<number, number> = {};

        for (const entry of item.scaleEntries!) {
          const prob = decision.probabilities[entry.id] ?? 0;
          numericProbs[entry.num] = prob;
          expectedScore += entry.num * prob;
        }

        const scoreDecision = new ScoreDecision(
          expectedScore,
          item.scaleEntries!.map((e) => e.num),
          decision.distribution,
          decision.latencyMs
        );

        const isBelowConfidence =
          effectiveThreshold !== undefined && scoreDecision.confidence < effectiveThreshold;
        const isUncertain = decision.isOOD || isBelowConfidence;

        let ans: Record<string, unknown> = {
          type: "score",
          score: scoreDecision.score,
          legend: item.scale!,
          probabilities: numericProbs,
          confidence: scoreDecision.confidence,
          isOOD: decision.isOOD,
          latencyMs: scoreDecision.latencyMs,
          system: "system1",
          actProbability: decision.isOOD ? 0.0 : scoreDecision.confidence,
          delegatedToFallback: false,
        };

        if (item.q.fallback && isUncertain) {
          const fallbackRes = await item.q.fallback(ans as any);
          if (typeof fallbackRes === "number") {
            ans = { ...ans, score: fallbackRes, system: "system2", delegatedToFallback: true };
          } else if (typeof fallbackRes === "object" && fallbackRes !== null) {
            ans = { ...ans, ...fallbackRes, system: "system2", delegatedToFallback: true };
          }
        } else if (item.q.minConfidence !== undefined) {
          scoreDecision.assertConfidence(item.q.minConfidence);
        }

        answers[item.key] = ans;
        continue;
      }

      if (item.type === "choice") {
        const isBelowConfidence =
          effectiveThreshold !== undefined && decision.confidence < effectiveThreshold;
        const isUncertain = decision.isOOD || isBelowConfidence;

        let ans: Record<string, unknown> = {
          type: "choice",
          choice: decision.winner,
          probabilities: decision.probabilities,
          confidence: decision.confidence,
          isOOD: decision.isOOD,
          latencyMs: decision.latencyMs,
          system: "system1",
          actProbability: decision.isOOD ? 0.0 : decision.confidence,
          delegatedToFallback: false,
        };

        if (item.q.fallback && isUncertain) {
          const fallbackRes = await item.q.fallback(ans as any);
          if (typeof fallbackRes === "string") {
            ans = { ...ans, choice: fallbackRes, system: "system2", delegatedToFallback: true };
          } else if (typeof fallbackRes === "object" && fallbackRes !== null) {
            ans = { ...ans, ...fallbackRes, system: "system2", delegatedToFallback: true };
          }
        } else if (item.q.minConfidence !== undefined) {
          decision.assertConfidence(item.q.minConfidence);
        }

        answers[item.key] = ans;
        continue;
      }
    }

    const totalLatencyMs = Number((performance.now() - startTime).toFixed(2));
    const anySystem2 = Object.values(answers).some(
      (a: any) => a?.system === "system2" || a?.delegatedToFallback === true
    );

    return {
      model: request.model ?? "branch-local-cpu",
      answers: answers as { [K in keyof TQuestions]: InferAnswer<TQuestions[K]> },
      totalLatencyMs,
      system: anySystem2 ? "system2" : "system1",
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0.0,
      },
    };
  }

  /**
   * Execução concorrente alternativa (fallback para motores que não implementam evaluateBatch)
   */
  private async executeConcurrent<
    TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
  >(
    request: WorkflowRequestDto<TQuestions>,
    entries: [string, WorkflowQuestion][],
    startTime: number
  ): Promise<WorkflowResponseDto<TQuestions>> {
    const promises = entries.map(async ([key, q]) => {
      const instructions = q.instructions ?? q.question ?? "";

      if (q.type === "boolean" || q.type === "noul") {
        const res = await this.evaluateBooleanUseCase.execute({
          state: request.state,
          question: instructions,
          affirmativeDescription: q.affirmativeDescription,
          negativeDescription: q.negativeDescription,
          temperature: q.temperature,
          confidenceThreshold: q.confidenceThreshold ?? request.confidenceThreshold,
          minConfidence: q.minConfidence,
          fallback: q.fallback as any,
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
            system: res.system,
            actProbability: res.actProbability,
            delegatedToFallback: res.delegatedToFallback,
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
          confidenceThreshold: q.confidenceThreshold ?? request.confidenceThreshold,
          minConfidence: q.minConfidence,
          fallback: q.fallback as any,
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
            system: res.system,
            actProbability: res.actProbability,
            delegatedToFallback: res.delegatedToFallback,
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
          confidenceThreshold: q.confidenceThreshold ?? request.confidenceThreshold,
          minConfidence: q.minConfidence,
          fallback: q.fallback as any,
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
            system: res.system,
            actProbability: res.actProbability,
            delegatedToFallback: res.delegatedToFallback,
          },
        ] as const;
      }

      throw new UnsupportedQuestionTypeException((q as { type: string }).type);
    });

    const settled = await Promise.allSettled(promises);
    const answers: Record<string, unknown> = {};

    for (const result of settled) {
      if (result.status === "fulfilled") {
        const [k, v] = result.value;
        answers[k] = v;
      }
    }

    const totalLatencyMs = Number((performance.now() - startTime).toFixed(2));
    const anySystem2 = Object.values(answers).some(
      (a: any) => a?.system === "system2" || a?.delegatedToFallback === true
    );

    return {
      model: request.model ?? "branch-local-cpu",
      answers: answers as { [K in keyof TQuestions]: InferAnswer<TQuestions[K]> },
      totalLatencyMs,
      system: anySystem2 ? "system2" : "system1",
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0.0,
      },
    };
  }
}

