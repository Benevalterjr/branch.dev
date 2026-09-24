/**
 * Exceções de Domínio do Branch.dev
 * Cada exceção possui um código de máquina padronizado para serialização em APIs.
 */

export class DomainException extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'DOMAIN_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class InvalidStateContextException extends DomainException {
  constructor(message: string = 'O estado fornecido não pôde ser serializado ou está vazio.') {
    super(message, 'DOMAIN_INVALID_STATE');
  }
}

export class InvalidChoicesException extends DomainException {
  constructor(message: string = 'É necessário fornecer pelo menos 2 opções para uma decisão.') {
    super(message, 'DOMAIN_INVALID_CHOICES');
  }
}

export class EmptyDistributionException extends DomainException {
  constructor(message: string = 'A distribuição de probabilidades não pode ser vazia ou ter soma zero.') {
    super(message, 'DOMAIN_EMPTY_DISTRIBUTION');
  }
}

export class InvalidScaleException extends DomainException {
  constructor(message: string = 'A escala para primitiva Score deve ter pelo menos 2 pontos.') {
    super(message, 'DOMAIN_INVALID_SCALE');
  }
}

export class UnsupportedQuestionTypeException extends DomainException {
  public readonly questionType: string;

  constructor(questionType: string) {
    super(`Tipo de pergunta não suportado: ${questionType}`, 'DOMAIN_UNSUPPORTED_QUESTION');
    this.questionType = questionType;
  }
}

export class ConfigurationException extends DomainException {
  constructor(message: string) {
    super(message, 'DOMAIN_CONFIGURATION_ERROR');
  }
}

export class DimensionMismatchException extends DomainException {
  public readonly expected: number;
  public readonly received: number;

  constructor(expected: number, received: number) {
    super(
      `Dimensões de vetores incompatíveis: esperado ${expected}, recebido ${received}.`,
      'DOMAIN_DIMENSION_MISMATCH'
    );
    this.expected = expected;
    this.received = received;
  }
}

export class LowConfidenceException extends DomainException {
  public readonly winner: string;
  public readonly confidence: number;
  public readonly threshold: number;

  constructor(winner: string, confidence: number, threshold: number) {
    super(
      `Decisão descartada por baixa confiança: '${winner}' obteve ${(confidence * 100).toFixed(1)}%, que é inferior ao limiar mínimo de ${(threshold * 100).toFixed(1)}%.`,
      'DOMAIN_LOW_CONFIDENCE'
    );
    this.winner = winner;
    this.confidence = confidence;
    this.threshold = threshold;
  }
}

export class ModelLoadException extends DomainException {
  constructor(message: string) {
    super(message, 'DOMAIN_MODEL_LOAD_FAILED');
  }
}

