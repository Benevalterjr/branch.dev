/**
 * DTO de Entrada para a Primitiva Boolean (Noul)
 */
export interface BooleanRequestDto {
  /**
   * O estado do sistema a ser analisado
   */
  state: unknown;

  /**
   * A pergunta ou afirmação a ser testada (ex: "A mensagem solicita estorno ou reembolso?")
   */
  question: string;

  /**
   * Descrição semântica opcional para o caso verdadeiro
   */
  affirmativeDescription?: string;

  /**
   * Descrição semântica opcional para o caso falso
   */
  negativeDescription?: string;

  /**
   * Temperatura para calibração de probabilidade
   */
  temperature?: number;

  /**
   * Confiança mínima requerida (0.0 a 1.0)
   */
  minConfidence?: number;

  /**
   * Limiar de confiança para acionamento de fallback (0.0 a 1.0).
   * Se a confiança for menor que esse valor ou o estado for OOD, o fallback é invocado.
   */
  confidenceThreshold?: number;

  /**
   * Função de fallback acionada automaticamente quando a decisão for incerta ou Out-of-Distribution.
   * Permite delegar graciosamente ao Sistema 2 (ex: LLM via LangChain, Vercel AI SDK ou handler customizado).
   */
  fallback?: (
    decision: BooleanResponseDto
  ) =>
    | Promise<boolean | Partial<BooleanResponseDto>>
    | boolean
    | Partial<BooleanResponseDto>;
}

import type { ActionPolicy } from "../../domain/entities/decision.entity.js";

/**
 * DTO de Saída para a Primitiva Boolean (Noul)
 * Dados puros serializáveis (sem métodos/closures).
 */
export interface BooleanResponseDto {
  /** Resultado booleano principal (true se probabilidade >= 0.5) */
  value: boolean;
  /** Probabilidade calibrada de ser verdadeiro (0.00 a 1.00) */
  probability: number;
  /** Nível de certeza geral da decisão (max(P(true), P(false))) */
  confidence: number;
  /** Semáforo operacional de decisão: "AUTOMATE" | "VERIFY" | "ESCALATE" */
  actionPolicy: ActionPolicy;
  /** Indica se a entrada é Out-of-Distribution (fora do domínio esperado) */
  isOOD: boolean;
  /** Latência da inferência em milissegundos */
  latencyMs: number;
  /**
   * Indica se a resposta veio do Sistema 1 (rápido, determinístico) ou do Sistema 2 (fallback/LLM).
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
}

