import { OnnxEmbeddingAdapter } from "../infrastructure/adapters/onnx-embedding.adapter.js";
import { PlattTemperatureCalibrator } from "../infrastructure/adapters/platt-calibrator.adapter.js";
import { LocalDecisionEngine } from "../infrastructure/adapters/local-decision-engine.adapter.js";
import { MakeDecisionUseCase } from "../application/use-cases/make-decision.use-case.js";
import { EvaluateBooleanUseCase } from "../application/use-cases/evaluate-boolean.use-case.js";
import { EvaluateScoreUseCase } from "../application/use-cases/evaluate-score.use-case.js";
import { RunWorkflowUseCase } from "../application/use-cases/run-workflow.use-case.js";

import { DecideRequestDto } from "../application/dtos/decide-request.dto.js";
import { DecideResponseDto } from "../application/dtos/decide-response.dto.js";
import { BooleanRequestDto, BooleanResponseDto } from "../application/dtos/boolean-request.dto.js";
import { ScoreRequestDto, ScoreResponseDto } from "../application/dtos/score-request.dto.js";
import {
  WorkflowRequestDto,
  WorkflowResponseDto,
  WorkflowQuestion,
} from "../application/dtos/workflow-request.dto.js";

import { IEmbeddingModel } from "../domain/ports/embedding-model.port.js";
import { ICalibrator } from "../domain/ports/calibrator.port.js";

export interface BranchClientConfig {
  embeddingModel?: IEmbeddingModel;
  calibrator?: ICalibrator;
  defaultTemperature?: number;
}

/**
 * BranchClient
 * Fachada completa com as 3 primitivas (Choice, Boolean/Noul, Score) e Workflow multi-questões.
 */
export class BranchClient {
  private readonly makeDecisionUseCase: MakeDecisionUseCase;
  private readonly evaluateBooleanUseCase: EvaluateBooleanUseCase;
  private readonly evaluateScoreUseCase: EvaluateScoreUseCase;
  private readonly runWorkflowUseCase: RunWorkflowUseCase;

  constructor(config: BranchClientConfig = {}) {
    const embedding = config.embeddingModel ?? new OnnxEmbeddingAdapter();
    const calibrator =
      config.calibrator ?? new PlattTemperatureCalibrator(config.defaultTemperature ?? 0.5);
    const engine = new LocalDecisionEngine(embedding, calibrator);

    this.makeDecisionUseCase = new MakeDecisionUseCase(engine);
    this.evaluateBooleanUseCase = new EvaluateBooleanUseCase(engine);
    this.evaluateScoreUseCase = new EvaluateScoreUseCase(engine);
    this.runWorkflowUseCase = new RunWorkflowUseCase(
      this.makeDecisionUseCase,
      this.evaluateBooleanUseCase,
      this.evaluateScoreUseCase
    );
  }

  /**
   * Primitiva Choice: Escolhe entre opções discretas com distribuição calibrada.
   */
  public async decide<T extends string = string>(
    request: DecideRequestDto<T>
  ): Promise<DecideResponseDto<T>> {
    return this.makeDecisionUseCase.execute<T>(request);
  }

  /**
   * Primitiva Noul / Boolean: Avalia afirmação como True/False com probabilidade contínua (0.0 a 1.0).
   */
  public async boolean(request: BooleanRequestDto): Promise<BooleanResponseDto> {
    return this.evaluateBooleanUseCase.execute(request);
  }

  /**
   * Primitiva Score: Calcula pontuação contínua em escala ordinal via Valor Esperado E[X].
   */
  public async score(request: ScoreRequestDto): Promise<ScoreResponseDto> {
    return this.evaluateScoreUseCase.execute(request);
  }

  /**
   * Workflow: Executa múltiplas perguntas independentes sobre o mesmo estado.
   */
  public async workflow<
    TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
  >(request: WorkflowRequestDto<TQuestions>): Promise<WorkflowResponseDto<TQuestions>> {
    return this.runWorkflowUseCase.execute<TQuestions>(request);
  }
}
