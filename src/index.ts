/**
 * @branch/core
 * The smart if-statement for modern code.
 * Clean Architecture Decision Engine - Local-First & Type-Safe.
 */

export * from "./presentation/index.js";
export * from "./domain/ports/embedding-model.port.js";
export * from "./domain/ports/calibrator.port.js";
export * from "./domain/ports/decision-engine.port.js";
export * from "./domain/ports/adaptive-calibrator.port.js";
export * from "./domain/ports/prototype-store.port.js";
export * from "./domain/ports/feedback-store.port.js";
export * from "./infrastructure/adapters/onnx-embedding.adapter.js";
export * from "./infrastructure/adapters/platt-calibrator.adapter.js";
export * from "./infrastructure/adapters/adaptive-platt-calibrator.adapter.js";
export * from "./infrastructure/adapters/in-memory-prototype-store.adapter.js";
export * from "./infrastructure/adapters/in-memory-feedback-store.adapter.js";
export * from "./infrastructure/adapters/local-decision-engine.adapter.js";
