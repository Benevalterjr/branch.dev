import type { ActionPolicy } from "../../domain/entities/decision.entity.js";

/**
 * DTO de Saída da decisão
 * Dados puros serializáveis (sem métodos/closures) para compatibilidade com JSON, IPC e Web Workers.
 */
export interface DecideResponseDto<T extends string = string> {
  /** A opção vencedora (com maior probabilidade calibrada). */
  winner: T;
  /** Confiança calibrada da opção vencedora (0.0 a 1.0). Se for OOD, o valor é 0.0. */
  confidence: number;
  /** Semáforo operacional de decisão: "AUTOMATE" | "VERIFY" | "ESCALATE" */
  actionPolicy: ActionPolicy;
  /** Indica se a opção vencedora ficou abaixo do limiar de confiança individual ou global requerido. */
  isBelowConfidence?: boolean;
  /** Indica se a entrada é Out-of-Distribution (fora do escopo semântico das opções). */
  isOOD: boolean;
  /** Entropia de Shannon da distribuição: H(P) = -sum( p_i * log2(p_i) ). */
  entropy: number;
  /** Entropia normalizada (0.0 a 1.0) relativa à máxima incerteza. */
  normalizedEntropy: number;
  /** Distribuição completa de probabilidades por opção. */
  probabilities: Record<T, number>;
  /** Tempo de processamento em milissegundos. */
  latencyMs: number;
  /**
   * Indica se a decisão foi tomada localmente pelo Sistema 1 ou delegada ao Sistema 2 (fallback/LLM).
   */
  system?: "system1" | "system2";
  /**
   * Probabilidade estimada para o agente agir autonomamente (metacognição).
   * Se for Out-of-Distribution (OOD), o valor é 0.0.
   */
  actProbability?: number;
  /**
   * Indica se a decisão foi resolvida por um fallback do Sistema 2.
   */
  delegatedToFallback?: boolean;
  /**
   * Identifica o backend vetorial utilizado ("onnx" para modelo neural real ou "hash-fallback" para fallback).
   */
  embeddingBackend?: "onnx" | "hash-fallback";
}
