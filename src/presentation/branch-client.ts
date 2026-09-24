import {
  OnnxEmbeddingAdapter,
  SupportedEmbeddingModel,
  BRANCH_EMBEDDING_MODELS,
} from "../infrastructure/adapters/onnx-embedding.adapter.js";
import { PlattTemperatureCalibrator } from "../infrastructure/adapters/platt-calibrator.adapter.js";
import { AdaptivePlattCalibrator } from "../infrastructure/adapters/adaptive-platt-calibrator.adapter.js";
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
import { IAdaptiveCalibrator } from "../domain/ports/adaptive-calibrator.port.js";
import { IPrototypeStore } from "../domain/ports/prototype-store.port.js";
import { IFeedbackStore } from "../domain/ports/feedback-store.port.js";
import { StateContext } from "../domain/entities/state-context.vo.js";
import { ConfigurationException } from '../domain/exceptions/domain-exceptions.js';

export interface BranchClientConfig {
  /**
   * Nome do modelo ONNX / HuggingFace ou preset do BRANCH_EMBEDDING_MODELS.
   * Padrão: BRANCH_EMBEDDING_MODELS.FAST_EN ("Xenova/all-MiniLM-L6-v2")
   */
  modelName?: SupportedEmbeddingModel;
  /** Instância customizada de IEmbeddingModel (sobrescreve modelName se fornecido) */
  embeddingModel?: IEmbeddingModel;
  /** Instância customizada de calibrador */
  calibrator?: ICalibrator;
  /** Habilita calibrador adaptativo ou injeta instância de IAdaptiveCalibrator */
  adaptiveCalibrator?: boolean | IAdaptiveCalibrator;
  /** Armazenamento de protótipos empíricos (Few-Shot Exemplars) */
  prototypeStore?: IPrototypeStore;
  /** Armazenamento e auditoria de feedbacks operacionais */
  feedbackStore?: IFeedbackStore;
  /** Temperatura padrão para Platt scaling */
  defaultTemperature?: number;
  /**
   * Permite fallback para o motor de hash caso o carregamento do modelo ONNX falhe.
   * Padrão: false (falha explícita com ModelLoadException).
   */
  allowFallback?: boolean;
}

/**
 * BranchClient
 * Fachada completa com as 3 primitivas (Choice, Boolean/Noul, Score), Workflow multi-questões,
 * suporte a protótipos semânticos e calibração adaptativa contínua.
 */
export class BranchClient {
  private readonly embeddingModel: IEmbeddingModel;
  private readonly calibrator: ICalibrator;
  private readonly prototypeStore?: IPrototypeStore;
  private readonly feedbackStore?: IFeedbackStore;

  private readonly makeDecisionUseCase: MakeDecisionUseCase;
  private readonly evaluateBooleanUseCase: EvaluateBooleanUseCase;
  private readonly evaluateScoreUseCase: EvaluateScoreUseCase;
  private readonly runWorkflowUseCase: RunWorkflowUseCase;

  constructor(config: BranchClientConfig = {}) {
    this.embeddingModel =
      config.embeddingModel ??
      new OnnxEmbeddingAdapter(config.modelName ?? BRANCH_EMBEDDING_MODELS.FAST_EN, {
        allowFallback: config.allowFallback ?? false,
      });

    if (config.calibrator) {
      this.calibrator = config.calibrator;
    } else if (config.adaptiveCalibrator === true) {
      this.calibrator = new AdaptivePlattCalibrator({
        initialTemperature: config.defaultTemperature ?? 0.5,
      });
    } else if (typeof config.adaptiveCalibrator === "object") {
      this.calibrator = config.adaptiveCalibrator;
    } else {
      this.calibrator = new PlattTemperatureCalibrator(config.defaultTemperature ?? 0.5);
    }

    this.prototypeStore = config.prototypeStore;
    this.feedbackStore = config.feedbackStore;

    const engine = new LocalDecisionEngine(
      this.embeddingModel,
      this.calibrator,
      this.prototypeStore
    );

    this.makeDecisionUseCase = new MakeDecisionUseCase(engine);
    this.evaluateBooleanUseCase = new EvaluateBooleanUseCase(engine);
    this.evaluateScoreUseCase = new EvaluateScoreUseCase(engine);
    this.runWorkflowUseCase = new RunWorkflowUseCase(
      this.makeDecisionUseCase,
      this.evaluateBooleanUseCase,
      this.evaluateScoreUseCase,
      engine
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

  /**
   * Avalia todas as perguntas sobre o estado em uma única passada vetorial (Batch forward pass).
   * Atalho de conveniência ergonômico para workflow.
   */
  public async evaluateAll<
    TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
  >(
    state: unknown,
    questions: TQuestions,
    options?: { confidenceThreshold?: number; model?: string }
  ): Promise<WorkflowResponseDto<TQuestions>> {
    return this.workflow<TQuestions>({
      state,
      questions,
      confidenceThreshold: options?.confidenceThreshold,
      model: options?.model,
    });
  }

  /**
   * Executa a inferência não-autoregressiva do Sistema 1.
   * Avalia múltiplas perguntas tipadas sobre o mesmo estado em uma única passada de rede neural na CPU.
   */

  public async systemOne<
    TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
  >(
    state: unknown,
    questions: TQuestions,
    options?: { confidenceThreshold?: number; model?: string }
  ): Promise<WorkflowResponseDto<TQuestions>> {
    return this.evaluateAll<TQuestions>(state, questions, options);
  }


  /**
   * Registra um exemplo empírico confirmado para uma escolha no PrototypeStore.
   * Converte automaticamente o objeto/texto de estado em embedding vetorial.
   */
  public async addExample(choice: string, state: unknown): Promise<void> {
    if (!this.prototypeStore) {
      throw new ConfigurationException(
        "[Branch.dev] PrototypeStore não configurado no BranchClient. Inicialize com 'prototypeStore' (ex: new InMemoryPrototypeStore())."
      );
    }
    const stateContext = state instanceof StateContext ? state : StateContext.from(state);
    const emb = await this.embeddingModel.embed(stateContext.canonicalText);
    await this.prototypeStore.addExample(choice, emb);
  }

  private isAdaptiveCalibrator(calibrator: ICalibrator): calibrator is IAdaptiveCalibrator {
    return 'recordFeedback' in calibrator && typeof (calibrator as IAdaptiveCalibrator).recordFeedback === 'function';
  }

  /**
   * Registra feedback operacional de validação de decisão:
   * 1. Atualiza dinamicamente a temperatura do IAdaptiveCalibrator (se ativo)
   * 2. Persiste histórico de auditoria no IFeedbackStore (se configurado)
   * 3. Opcionalmente adiciona o estado como exemplo positivo no PrototypeStore (se wasCorrect = true e addAsExample = true)
   */
  public async recordFeedback(params: {
    choice: string;
    wasCorrect: boolean;
    state?: unknown;
    confidence?: number;
    logits?: number[];
    predictedIndex?: number;
    addAsExample?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const confidence = params.confidence ?? 0.5;

    // 1. Atualização do calibrador adaptativo
    if (this.isAdaptiveCalibrator(this.calibrator)) {
      this.calibrator.recordFeedback({
        wasCorrect: params.wasCorrect,
        confidence,
        logits: params.logits,
        predictedIndex: params.predictedIndex,
      });
    }

    // 2. Persistência de feedback para auditoria
    if (this.feedbackStore) {
      let statePreview: string | undefined;
      if (params.state) {
        const stateContext =
          params.state instanceof StateContext ? params.state : StateContext.from(params.state);
        statePreview = stateContext.canonicalText.substring(0, 100);
      }

      await this.feedbackStore.record({
        id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        choice: params.choice,
        wasCorrect: params.wasCorrect,
        confidenceAtDecision: confidence,
        timestamp: Date.now(),
        stateHash: statePreview,
        metadata: params.metadata,
      });
    }

    // 3. Adição automática a protótipos se confirmado
    if (params.wasCorrect && params.addAsExample && params.state && this.prototypeStore) {
      await this.addExample(params.choice, params.state);
    }
  }

  /** Retorna a instância do calibrador utilizado pelo cliente */
  public getCalibrator(): ICalibrator {
    return this.calibrator;
  }

  /** Retorna o calibrador adaptativo, ou undefined se o calibrador não for adaptativo */
  public getAdaptiveCalibrator(): IAdaptiveCalibrator | undefined {
    return this.isAdaptiveCalibrator(this.calibrator) ? this.calibrator : undefined;
  }

  /** Retorna a instância do PrototypeStore (ou undefined se não configurado) */
  public getPrototypeStore(): IPrototypeStore | undefined {
    return this.prototypeStore;
  }

  /** Retorna a instância do FeedbackStore (ou undefined se não configurado) */
  public getFeedbackStore(): IFeedbackStore | undefined {
    return this.feedbackStore;
  }

  /** Retorna a instância do modelo de embeddings configurado */
  public getEmbeddingModel(): IEmbeddingModel {
    return this.embeddingModel;
  }

  /**
   * Pré-carrega o modelo de embeddings em memória para evitar latência no primeiro request.
   */
  public async warmup(): Promise<void> {
    await this.embeddingModel.embed('warmup');
  }

  /**
   * Libera recursos mantidos pelo cliente (prototype store, feedback store).
   */
  public async dispose(): Promise<void> {
    if (this.prototypeStore) await this.prototypeStore.clear();
    if (this.feedbackStore) await this.feedbackStore.clear();
  }
}
