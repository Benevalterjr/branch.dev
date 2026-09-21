/**
 * @branch/core
 * The smart if-statement for modern code.
 * Clean Architecture Decision Engine - Local-First & Type-Safe.
 */

// Public API (Presentation Layer)
export * from './presentation/index.js';

// Domain Ports (for custom implementations)
export * from './domain/ports/embedding-model.port.js';
export * from './domain/ports/calibrator.port.js';
export * from './domain/ports/decision-engine.port.js';

// Infrastructure Adapters (for advanced usage)
export { OnnxEmbeddingAdapter, BRANCH_EMBEDDING_MODELS, type SupportedEmbeddingModel } from './infrastructure/adapters/onnx-embedding.adapter.js';
export { PlattTemperatureCalibrator } from './infrastructure/adapters/platt-calibrator.adapter.js';
export { LocalDecisionEngine } from './infrastructure/adapters/local-decision-engine.adapter.js';
