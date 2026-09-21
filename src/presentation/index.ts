import { BranchClient, BranchClientConfig } from "./branch-client.js";
import {
  BRANCH_EMBEDDING_MODELS,
  SupportedEmbeddingModel,
} from "../infrastructure/adapters/onnx-embedding.adapter.js";
import { DecideRequestDto } from "../application/dtos/decide-request.dto.js";
import { DecideResponseDto } from "../application/dtos/decide-response.dto.js";
import { BooleanRequestDto, BooleanResponseDto } from "../application/dtos/boolean-request.dto.js";
import { ScoreRequestDto, ScoreResponseDto } from "../application/dtos/score-request.dto.js";
import {
  WorkflowRequestDto,
  WorkflowResponseDto,
  WorkflowQuestion,
} from "../application/dtos/workflow-request.dto.js";

// Instância singleton padrão para conveniência e DevEx imediata
let defaultClient: BranchClient | null = null;

function ensureClient(): BranchClient {
  if (!defaultClient) {
    defaultClient = new BranchClient();
  }
  return defaultClient;
}

/**
 * Reconfigura o cliente padrão global (ex: alterar modelo de embedding para multilíngue ou calibrador).
 */
export function configure(config: BranchClientConfig): BranchClient {
  defaultClient = new BranchClient(config);
  return defaultClient;
}

/**
 * Retorna a instância padrão atual do BranchClient.
 */
export function getDefaultClient(): BranchClient {
  return ensureClient();
}

/**
 * Primitiva Choice: O 'smart if-statement' discreto do Branch.dev.
 */
export async function decide<T extends string = string>(
  request: DecideRequestDto<T>
): Promise<DecideResponseDto<T>> {
  return ensureClient().decide<T>(request);
}

/**
 * Primitiva Noul / Boolean: Avaliação binária com probabilidade contínua calibrada (0.0 a 1.0).
 */
export async function boolean(
  request: BooleanRequestDto
): Promise<BooleanResponseDto> {
  return ensureClient().boolean(request);
}

/**
 * Primitiva Score: Pontuação contínua em escala ordinal via Valor Esperado E[X].
 */
export async function score(
  request: ScoreRequestDto
): Promise<ScoreResponseDto> {
  return ensureClient().score(request);
}

/**
 * Workflow: Executa múltiplos julgamentos simultâneos sobre o mesmo estado.
 */
export async function workflow<
  TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
>(
  request: WorkflowRequestDto<TQuestions>
): Promise<WorkflowResponseDto<TQuestions>> {
  return ensureClient().workflow<TQuestions>(request);
}

export { BranchClient, BranchClientConfig } from "./branch-client.js";
export { BRANCH_EMBEDDING_MODELS, SupportedEmbeddingModel };
export * from "../application/dtos/decide-request.dto.js";
export * from "../application/dtos/decide-response.dto.js";
export * from "../application/dtos/boolean-request.dto.js";
export * from "../application/dtos/score-request.dto.js";
export * from "../application/dtos/workflow-request.dto.js";
export * from "../domain/exceptions/domain-exceptions.js";
export * from "../domain/entities/decision.entity.js";
export * from "../domain/entities/boolean-decision.entity.js";
export * from "../domain/entities/score-decision.entity.js";
export * from "../domain/entities/probability.vo.js";
export * from "../domain/entities/state-context.vo.js";
export * from "../domain/ports/adaptive-calibrator.port.js";
export * from "../domain/ports/prototype-store.port.js";
export * from "../domain/ports/feedback-store.port.js";
export * from "../infrastructure/adapters/adaptive-platt-calibrator.adapter.js";
export * from "../infrastructure/adapters/in-memory-prototype-store.adapter.js";
export * from "../infrastructure/adapters/in-memory-feedback-store.adapter.js";
export * from "../infrastructure/quant/turbo-quant.js";
