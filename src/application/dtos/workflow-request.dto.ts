import { ChoiceInput } from "./decide-request.dto.js";

export type NoulOrBooleanQuestion = {
  type: "boolean" | "noul";
  question?: string;
  instructions?: string; // TypeSafe alias
  affirmativeDescription?: string;
  negativeDescription?: string;
  temperature?: number;
};

export type ScoreQuestion = {
  type: "score";
  question?: string;
  instructions?: string; // TypeSafe alias
  scale?: Record<number, string>;
  criteria?: readonly string[] | Record<number, string>; // TypeSafe alias
  temperature?: number;
};

export type ChoiceQuestion<C extends string = string> = {
  type: "choice";
  question?: string;
  instructions?: string; // TypeSafe alias
  choices?: readonly C[] | Record<string, C> | Record<C, string> | ChoiceInput<C>;
  criteria?: Record<C, string> | readonly C[]; // TypeSafe alias
  temperature?: number;
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
        isOOD: boolean;
        latencyMs: number;
      }
    : Q extends ScoreQuestion
    ? {
        type: "score";
        score: number;
        legend: Record<number, string>;
        probabilities: Record<number, number>;
        confidence: number;
        latencyMs: number;
      }
    : Q extends ChoiceQuestion<string>
    ? {
        type: "choice";
        choice: InferChoice<Q>;
        probabilities: Record<InferChoice<Q>, number>;
        confidence: number;
        isOOD: boolean;
        latencyMs: number;
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
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  };
}
