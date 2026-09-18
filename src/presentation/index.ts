import { BranchClient } from "./branch-client.js";
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
const defaultClient = new BranchClient();

/**
 * Primitiva Choice: O 'smart if-statement' discreto do Branch.dev.
 */
export async function decide<T extends string = string>(
  request: DecideRequestDto<T>
): Promise<DecideResponseDto<T>> {
  return defaultClient.decide<T>(request);
}

/**
 * Primitiva Noul / Boolean: Avaliação binária com probabilidade contínua calibrada (0.0 a 1.0).
 */
export async function boolean(
  request: BooleanRequestDto
): Promise<BooleanResponseDto> {
  return defaultClient.boolean(request);
}

/**
 * Primitiva Score: Pontuação contínua em escala ordinal via Valor Esperado E[X].
 */
export async function score(
  request: ScoreRequestDto
): Promise<ScoreResponseDto> {
  return defaultClient.score(request);
}

/**
 * Workflow: Executa múltiplos julgamentos simultâneos sobre o mesmo estado.
 */
export async function workflow<
  TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
>(
  request: WorkflowRequestDto<TQuestions>
): Promise<WorkflowResponseDto<TQuestions>> {
  return defaultClient.workflow<TQuestions>(request);
}

export { BranchClient } from "./branch-client.js";
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
export * from "../infrastructure/quant/turbo-quant.js";
