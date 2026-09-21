import { IDecisionEngine, ChoiceCandidate } from "../../domain/ports/decision-engine.port.js";
import { StateContext } from "../../domain/entities/state-context.vo.js";
import { InvalidChoicesException } from "../../domain/exceptions/domain-exceptions.js";
import { DecideRequestDto, ChoiceInput, ChoiceOption } from "../dtos/decide-request.dto.js";
import { DecideResponseDto } from "../dtos/decide-response.dto.js";

/**
 * Caso de Uso: MakeDecisionUseCase
 * Orquestra a validação, normalização de opções candidatas e inferência probabilística.
 */
export class MakeDecisionUseCase {
  constructor(private readonly decisionEngine: IDecisionEngine) {}

  public async execute<T extends string = string>(
    request: DecideRequestDto<T>
  ): Promise<DecideResponseDto<T>> {
    // 1. Normalização de escolhas
    const candidates = this.normalizeCandidates(request.choices);

    if (candidates.length < 2) {
      throw new InvalidChoicesException();
    }

    // 2. Canonicalização do Estado
    const stateContext = new StateContext(request.state);

    // 3. Avaliação via Motor de Decisão
    const decision = await this.decisionEngine.evaluate<T>({
      state: stateContext,
      candidates,
      taskDescription: request.task,
      temperature: request.temperature,
    });

    // 4. Validação de confiança mínima opcional
    if (request.minConfidence !== undefined) {
      decision.assertConfidence(request.minConfidence);
    }

    // 5. Mapeamento para DTO de Resposta
    return {
      winner: decision.winner,
      confidence: decision.confidence,
      isOOD: decision.isOOD,
      entropy: decision.entropy,
      normalizedEntropy: decision.normalizedEntropy,
      probabilities: decision.probabilities,
      latencyMs: decision.latencyMs,
    };
  }

  /**
   * Normaliza qualquer formato de entrada de escolhas em uma lista padronizada de ChoiceCandidate
   */
  private normalizeCandidates<T extends string>(choices: ChoiceInput<T>): ChoiceCandidate<T>[] {
    const seen = new Set<string>();
    const candidates: ChoiceCandidate<T>[] = [];

    if (Array.isArray(choices)) {
      for (const item of choices) {
        if (typeof item === 'string') {
          if (!seen.has(item)) {
            seen.add(item);
            candidates.push({ id: item as T, description: item });
          }
        } else if (typeof item === 'object' && item !== null && 'id' in item) {
          const opt = item as ChoiceOption<T>;
          if (!seen.has(opt.id)) {
            seen.add(opt.id);
            candidates.push({ id: opt.id, description: opt.description ?? opt.id });
          }
        }
      }
      return candidates;
    }

    if (typeof choices === 'object' && choices !== null) {
      const entries = Object.entries(choices);

      // Detecta TypeScript Enum compilado: enums numéricos geram mapeamento bidirecional
      // ex: enum E { A = "x" } compila para { A: "x" }, enum E { A = 0 } compila para { "0": "A", A: 0 }
      // String enums: as chaves são os nomes e os valores são strings.
      // Heurística segura: é um string enum se TODOS os valores são strings E
      // existem chaves numéricas reversas (mapeamento bidirecional de enum numérico).
      const hasNumericReverseMapping = entries.some(
        ([key, val]) => !isNaN(Number(key)) && typeof val === 'string'
      );

      if (hasNumericReverseMapping) {
        // Enum numérico do TypeScript: ignorar as chaves numéricas reversas
        for (const [key, val] of entries) {
          if (typeof val === 'string' && !isNaN(Number(key))) {
            // Chave numérica reversa, pular
            continue;
          }
          if (typeof val === 'number') {
            // Chave nominal -> valor numérico: usar a chave como id
            const id = key as T;
            if (!seen.has(id)) {
              seen.add(id);
              candidates.push({ id, description: id });
            }
          }
        }
      } else {
        // Objeto literal ou string enum: chave = id, valor = descrição
        for (const [key, val] of entries) {
          const id = key as T;
          if (!seen.has(id)) {
            seen.add(id);
            candidates.push({ id, description: String(val) });
          }
        }
      }
    }

    return candidates;
  }
}
