import { ChoiceInput } from "./decide-request.dto.js";

export type NoulOrBooleanQuestion = {
  type: "boolean" | "noul";
  question?: string;
  instructions?: string; // TypeSafe alias
  affirmativeDescription?: string;
  negativeDescription?: string;
  temperature?: number;
  confidenceThreshold?: number;
  minConfidence?: number;
  fallback?: (res: {
    type: "boolean" | "noul";
    noul: number;
    value: boolean;
    probability: number;
    confidence: number;
    isOOD: boolean;
    latencyMs: number;
  }) =>
    | Promise<boolean | { value: boolean; confidence?: number }>
    | boolean
    | { value: boolean; confidence?: number };
};

export type ScoreQuestion = {
  type: "score";
  question?: string;
  instructions?: string; // TypeSafe alias
  scale?: Record<number, string>;
  criteria?: readonly string[] | Record<number, string>; // TypeSafe alias
  temperature?: number;
  confidenceThreshold?: number;
  minConfidence?: number;
  fallback?: (res: {
    type: "score";
    score: number;
    legend: Record<number, string>;
    probabilities: Record<number, number>;
    confidence: number;
    latencyMs: number;
  }) =>
    | Promise<number | { score: number; confidence?: number }>
    | number
    | { score: number; confidence?: number };
};

export type ChoiceQuestion<C extends string = string> = {
  type: "choice";
  question?: string;
  instructions?: string; // TypeSafe alias
  choices?: readonly C[] | Record<string, C> | Record<C, string> | ChoiceInput<C>;
  criteria?: Record<C, string> | readonly C[]; // TypeSafe alias
  temperature?: number;
  confidenceThreshold?: number;
  minConfidence?: number;
  fallback?: (res: {
    type: "choice";
    choice: C;
    probabilities: Record<C, number>;
    confidence: number;
    isOOD: boolean;
    latencyMs: number;
  }) =>
    | Promise<C | { choice: C; confidence?: number }>
    | C
    | { choice: C; confidence?: number };
};

/**
 * União de todas as definições de perguntas do Workflow
 */
export type WorkflowQuestion =
  | NoulOrBooleanQuestion
  | ScoreQuestion
  | ChoiceQuestion<string>;

/**
 * Inferência estática das opções do Choice
 */
export type InferChoice<Q> =
  Q extends { criteria: Record<infer C, string> }
    ? C
    : Q extends { criteria: readonly (infer C)[] }
    ? C
    : Q extends { choices: readonly (infer C)[] }
    ? C
    : Q extends { choices: Record<string, infer C> }
    ? C
    : Q extends { choices: Record<infer C, string> }
    ? C
    : string;

import type { ActionPolicy } from "../../domain/entities/decision.entity.js";

/**
 * Mapped Type avançado para inferir a resposta exata de cada pergunta na IDE
 */
export type InferAnswer<Q extends WorkflowQuestion> =
  Q extends NoulOrBooleanQuestion
    ? {
        type: Q["type"];
        noul: number;
        value: boolean;
        probability: number;
        confidence: number;
        actionPolicy: ActionPolicy;
        isOOD: boolean;
        latencyMs: number;
        system?: "system1" | "system2";
        actProbability?: number;
        delegatedToFallback?: boolean;
      }
    : Q extends ScoreQuestion
    ? {
        type: "score";
        score: number;
        legend: Record<number, string>;
        probabilities: Record<number, number>;
        confidence: number;
        actionPolicy: ActionPolicy;
        isOOD: boolean;
        latencyMs: number;
        system?: "system1" | "system2";
        actProbability?: number;
        delegatedToFallback?: boolean;
      }
    : Q extends ChoiceQuestion<string>
    ? {
        type: "choice";
        choice: InferChoice<Q>;
        probabilities: Record<InferChoice<Q>, number>;
        confidence: number;
        actionPolicy: ActionPolicy;
        isOOD: boolean;
        latencyMs: number;
        system?: "system1" | "system2";
        actProbability?: number;
        delegatedToFallback?: boolean;
      }
    : never;

/**
 * DTO de Entrada para Workflow com múltiplas perguntas tipadas
 */
export interface WorkflowRequestDto<
  TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
> {
  state: unknown;
  model?: string;
  questions: TQuestions;
  /** Limiar de confiança global opcional aplicado a todas as perguntas do workflow */
  confidenceThreshold?: number;
}

/**
 * DTO de Saída com os resultados fortemente tipados via Mapped Types
 */
export interface WorkflowResponseDto<
  TQuestions extends Record<string, WorkflowQuestion> = Record<string, WorkflowQuestion>
> {
  model?: string;
  answers: { [K in keyof TQuestions]: InferAnswer<TQuestions[K]> };
  totalLatencyMs: number;
  /** Indica se todas as perguntas foram Sistema 1 ou se alguma recorreu a fallback (Sistema 2) */
  system?: "system1" | "system2";
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
}

