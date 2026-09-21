import { Decision } from "../entities/decision.entity.js";
import { StateContext } from "../entities/state-context.vo.js";

/**
 * Representação de uma opção candidata com seu identificador de tipo e descrição semântica
 */
export interface ChoiceCandidate<T extends string = string> {
  id: T;
  description: string;
}

/**
 * Parâmetros de execução do motor de decisão
 */
export interface EngineExecutionParams<T extends string = string> {
  state: StateContext;
  candidates: readonly ChoiceCandidate<T>[];
  taskDescription?: string;
  temperature?: number;
  oodThreshold?: number;
}

/**
 * Porta: IDecisionEngine
 * Contrato abstrato para motores de inferência e cálculo de probabilidades.
 */
export interface IDecisionEngine {
  evaluate<T extends string = string>(
    params: EngineExecutionParams<T>
  ): Promise<Decision<T>>;
}
