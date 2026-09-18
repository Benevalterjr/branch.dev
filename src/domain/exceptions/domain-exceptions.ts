/**
 * Exceções de Domínio do Branch.dev
 */

export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidStateContextException extends DomainException {
  constructor(message: string = "O estado fornecido não pôde ser serializado ou está vazio.") {
    super(message);
  }
}

export class InvalidChoicesException extends DomainException {
  constructor(message: string = "É necessário fornecer pelo menos 2 opções para uma decisão.") {
    super(message);
  }
}

export class LowConfidenceException extends DomainException {
  public readonly winner: string;
  public readonly confidence: number;
  public readonly threshold: number;

  constructor(winner: string, confidence: number, threshold: number) {
    super(
      `Decisão descartada por baixa confiança: '${winner}' obteve ${(confidence * 100).toFixed(1)}%, que é inferior ao limiar mínimo de ${(threshold * 100).toFixed(1)}%.`
    );
    this.winner = winner;
    this.confidence = confidence;
    this.threshold = threshold;
  }
}
