import { InvalidStateContextException } from "../exceptions/domain-exceptions.js";

/**
 * Value Object: StateContext
 * Encapsula e canonicaliza o estado do sistema para representação latente.
 */
export class StateContext {
  private readonly _raw: unknown;
  private readonly _canonicalText: string;

  constructor(state: unknown) {
    if (state === null || state === undefined) {
      throw new InvalidStateContextException("Estado não pode ser nulo ou indefinido.");
    }
    this._raw = state;
    this._canonicalText = this.canonicalize(state);
  }

  /**
   * Converte qualquer objeto de estado para StateContext com idempotência.
   */
  public static from(state: unknown): StateContext {
    return state instanceof StateContext ? state : new StateContext(state);
  }

  public get raw(): unknown {
    return this._raw;
  }

  public get canonicalText(): string {
    return this._canonicalText;
  }

  /**
   * Converte objetos aninhados, arrays e tipos primitivos em um formato
   * semântico denso e estruturado, ideal para encoders neurais.
   */
  private canonicalize(val: unknown, prefix = ""): string {
    if (typeof val === "string") {
      return val.trim();
    }

    if (typeof val === "number" || typeof val === "boolean") {
      return String(val);
    }

    if (Array.isArray(val)) {
      return val.map((item, idx) => `${prefix}[${idx}]: ${this.canonicalize(item)}`).join("\n");
    }

    if (typeof val === "object" && val !== null) {
      const entries = Object.entries(val);
      if (entries.length === 0) {
        throw new InvalidStateContextException("Objeto de estado não contém propriedades.");
      }

      return entries
        .map(([k, v]) => {
          const keyLabel = k
            .replace(/([A-Z])/g, " $1")
            .toLowerCase()
            .replace(/_/g, " ")
            .trim();

          if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            return `${keyLabel}:\n${this.canonicalize(v, "  ")}`;
          }
          return `${prefix}${keyLabel}: ${this.canonicalize(v)}`;
        })
        .join("\n");
    }

    return String(val);
  }
}
