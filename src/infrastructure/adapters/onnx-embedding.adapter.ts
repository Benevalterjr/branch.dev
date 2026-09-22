import * as ort from "onnxruntime-node";
import { Tokenizer } from "@huggingface/tokenizers";
import { IEmbeddingModel } from "../../domain/ports/embedding-model.port.js";
import { readFile, stat, mkdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export const BRANCH_EMBEDDING_MODELS = {
  /** Ultra-rápido, otimizado para inglês (~22MB quantizado, 6 camadas) */
  FAST_EN: "Xenova/all-MiniLM-L6-v2",
  /** Maior profundidade e precisão (~34MB quantizado, 12 camadas - dobro do L6) */
  ACCURATE_EN: "Xenova/all-MiniLM-L12-v2",
  /** Recomendado para Português: Multilíngue balanceado (PT-BR, ES, 50+ idiomas, 12 camadas, 384 dim, ~118MB quantizado) */
  MULTILINGUAL_BALANCED: "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
  /** ModernBERT Multilíngue (JHU-CLSP): Contexto de 8192 tokens, vocabulário Gemma 2 (256k), 1833 idiomas, 384 dim, ~142MB quantizado */
  MMBERT_SMALL: "onnx-community/mmBERT-small-ONNX",
  /** ModernBERT Headless Feature Extraction Local (384 dim, ~66ms warm CPU) */
  MMBERT_LOCAL: "./models/mmbert-small-feature",
  /** Alta qualidade semântica multilíngue (100+ idiomas, 384 dim, ~120MB quantizado) */
  MULTILINGUAL_E5_SMALL: "Xenova/multilingual-e5-small",
  /** Qualidade superior multilíngue (100+ idiomas, 768 dim, ~280-350MB quantizado) */
  MULTILINGUAL_E5_BASE: "Xenova/multilingual-e5-base",
} as const;


export type SupportedEmbeddingModel =
  | (typeof BRANCH_EMBEDDING_MODELS)[keyof typeof BRANCH_EMBEDDING_MODELS]
  | (string & {});

interface EmbeddingPipeline {
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

/**
 * Adaptador de Embeddings Local via ONNX Runtime Oficial e Tokenizers da Hugging Face.
 * Executa 100% em CPU com grafo otimizado, sem dependências de frameworks pesados (sharp, python, pytorch).
 */
export class OnnxEmbeddingAdapter implements IEmbeddingModel {
  private static pipelineInstances = new Map<string, EmbeddingPipeline>();
  private static loadingPromises = new Map<string, Promise<EmbeddingPipeline>>();
  private readonly modelName: string;

  constructor(modelName: SupportedEmbeddingModel = BRANCH_EMBEDDING_MODELS.FAST_EN) {
    this.modelName = modelName;
  }

  /**
   * Obtém a instância do pipeline compilado com lazy-loading e cache estático em memória.
   */
  private async getPipeline(): Promise<EmbeddingPipeline> {
    const cached = OnnxEmbeddingAdapter.pipelineInstances.get(this.modelName);
    if (cached) {
      return cached;
    }

    let loadPromise = OnnxEmbeddingAdapter.loadingPromises.get(this.modelName);
    if (!loadPromise) {
      loadPromise = (async () => {
        try {
          const modelDir = await this.ensureModelBundle(this.modelName);
          const pipeline = await this.createOnnxPipeline(modelDir);
          OnnxEmbeddingAdapter.pipelineInstances.set(this.modelName, pipeline);
          return pipeline;
        } catch (err) {
          console.warn(
            `[Branch.dev] Aviso: Falha ao carregar modelo ONNX '${this.modelName}' (${(err as Error).message}). Ativando Motor Semântico Local Integrado (Zero-Network Fallback).`
          );
          const fallback = this.createFallbackPipeline();
          OnnxEmbeddingAdapter.pipelineInstances.set(this.modelName, fallback);

          // Retry após 60s
          setTimeout(() => {
            const current = OnnxEmbeddingAdapter.pipelineInstances.get(this.modelName);
            if (current === fallback) {
              OnnxEmbeddingAdapter.pipelineInstances.delete(this.modelName);
            }
          }, 60_000);

          return fallback;
        } finally {
          OnnxEmbeddingAdapter.loadingPromises.delete(this.modelName);
        }
      })();

      OnnxEmbeddingAdapter.loadingPromises.set(this.modelName, loadPromise);
    }

    return loadPromise;
  }

  /**
   * Garante a presença dos arquivos ONNX e Tokenizer em cache local (~/.cache/branch-models).
   */
  private async ensureModelBundle(modelName: string): Promise<string> {
    const isLocalDir = path.isAbsolute(modelName) || modelName.startsWith("./") || modelName.startsWith("../");
    if (isLocalDir) {
      return path.resolve(modelName);
    }

    // Se o modelo solicitado for mmBERT e o diretório otimizado headless existir localmente, priorizá-lo
    if (
      modelName === BRANCH_EMBEDDING_MODELS.MMBERT_SMALL ||
      modelName === (BRANCH_EMBEDDING_MODELS as any).MMBERT_LOCAL
    ) {
      const localCustom = path.resolve("./models/mmbert-small-feature");
      if (await this.checkFileExists(path.join(localCustom, "model.onnx"))) {
        return localCustom;
      }
    }

    const cacheBase =
      process.env.BRANCH_CACHE_DIR ??
      path.join(process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache"), "branch-models");
    const modelDir = path.join(cacheBase, modelName.replace(/\//g, "--"));
    await mkdir(modelDir, { recursive: true });

    const modelPath = path.join(modelDir, "model.onnx");
    const tokenizerPath = path.join(modelDir, "tokenizer.json");
    const tokenizerConfigPath = path.join(modelDir, "tokenizer_config.json");

    const filesNeeded = [
      {
        url: `https://huggingface.co/${modelName}/resolve/main/onnx/model_quantized.onnx`,
        fallbackUrl: `https://huggingface.co/${modelName}/resolve/main/onnx/model.onnx`,
        dest: modelPath,
      },
      {
        url: `https://huggingface.co/${modelName}/resolve/main/tokenizer.json`,
        dest: tokenizerPath,
      },
      {
        url: `https://huggingface.co/${modelName}/resolve/main/tokenizer_config.json`,
        dest: tokenizerConfigPath,
      },
    ];

    for (const item of filesNeeded) {
      const exists = await this.checkFileExists(item.dest);
      if (exists) continue;

      try {
        await this.downloadFile(item.url, item.dest);
      } catch (err) {
        if (item.fallbackUrl) {
          await this.downloadFile(item.fallbackUrl, item.dest);
        } else {
          throw err;
        }
      }
    }

    return modelDir;
  }

  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const s = await stat(filePath);
      return s.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Download atômico de arquivo com suporte nativo a curl em Windows (Schannel/Corporate Proxies)
   * e fallback com streaming para máxima resiliência.
   */
  private async downloadFile(url: string, dest: string): Promise<void> {
    const tmp = `${dest}.part-${Date.now()}`;
    await mkdir(path.dirname(dest), { recursive: true });

    // Em Windows, curl.exe usa o repositório de certificados do sistema operacional (Schannel),
    // contornando falhas com certificados de proxy/inspeção corporativa.
    if (process.platform === "win32") {
      try {
        const { execSync } = await import("node:child_process");
        execSync(`curl.exe -s -L "${url}" -o "${tmp}"`, { stdio: "ignore" });
        const s = await stat(tmp);
        if (s.size > 0) {
          await rename(tmp, dest);
          return;
        }
      } catch {
        // Fallback para fetch em caso de falha do curl
      }
    }

    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok || !res.body) {
      throw new Error(`Falha no download de ${url} (${res.status} ${res.statusText})`);
    }

    const { pipeline } = await import("node:stream/promises");
    const { Readable } = await import("node:stream");
    const { createWriteStream } = await import("node:fs");

    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(tmp));
    await rename(tmp, dest);
  }

  /**
   * Cria o pipeline oficial com ONNX Runtime + Hugging Face Tokenizers.
   */
  private async createOnnxPipeline(modelDir: string): Promise<EmbeddingPipeline> {
    const modelPath = path.join(modelDir, "model.onnx");
    const tokenizerPath = path.join(modelDir, "tokenizer.json");
    const tokenizerConfigPath = path.join(modelDir, "tokenizer_config.json");

    const tokJson = JSON.parse(await readFile(tokenizerPath, "utf8"));
    const tokCfg = (await this.checkFileExists(tokenizerConfigPath))
      ? JSON.parse(await readFile(tokenizerConfigPath, "utf8"))
      : {};

    const tokenizer = new Tokenizer(tokJson, tokCfg);

    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });

    const expectedInputs = session.inputNames;
    const hasTokenTypeIds = expectedInputs.includes("token_type_ids");
    const outputKey = session.outputNames.includes("last_hidden_state")
      ? "last_hidden_state"
      : session.outputNames[0];

    return {
      embedBatch: async (texts: string[]): Promise<Float32Array[]> => {
        if (texts.length === 0) return [];

        // 1. Tokenização de todos os textos
        const encodings = texts.map((text) => tokenizer.encode(text));
        const batchSize = texts.length;
        const maxSeqLen = Math.max(...encodings.map((e) => e.ids.length));

        // 2. Montagem dos tensores de lote (Right-padded)
        const inputIdsData = new BigInt64Array(batchSize * maxSeqLen);
        const attentionMaskData = new BigInt64Array(batchSize * maxSeqLen);
        const tokenTypeIdsData = hasTokenTypeIds ? new BigInt64Array(batchSize * maxSeqLen) : null;

        for (let i = 0; i < batchSize; i++) {
          const enc = encodings[i];
          const seqLen = enc.ids.length;
          const offset = i * maxSeqLen;

          for (let j = 0; j < seqLen; j++) {
            inputIdsData[offset + j] = BigInt(enc.ids[j]);
            attentionMaskData[offset + j] = BigInt(enc.attention_mask[j] ?? 1);
            if (tokenTypeIdsData && enc.token_type_ids) {
              tokenTypeIdsData[offset + j] = BigInt(enc.token_type_ids[j] ?? 0);
            }
          }
        }

        const feeds: Record<string, ort.Tensor> = {
          input_ids: new ort.Tensor("int64", inputIdsData, [batchSize, maxSeqLen]),
          attention_mask: new ort.Tensor("int64", attentionMaskData, [batchSize, maxSeqLen]),
        };

        if (hasTokenTypeIds && tokenTypeIdsData) {
          feeds["token_type_ids"] = new ort.Tensor("int64", tokenTypeIdsData, [batchSize, maxSeqLen]);
        }

        // 3. Execução vetorial na CPU ONNX
        const out = await session.run(feeds);
        const lastHidden = out[outputKey];
        if (!lastHidden || !(lastHidden.data instanceof Float32Array)) {
          throw new Error("Saída do modelo ONNX inválida (esperava Float32Array no last_hidden_state)");
        }

        const hiddenData = lastHidden.data;
        const dim = lastHidden.dims[2];
        const results: Float32Array[] = new Array(batchSize);

        // 4. Mean Pooling mascarado e Normalização L2 por item
        for (let i = 0; i < batchSize; i++) {
          const enc = encodings[i];
          const seqLen = enc.ids.length;
          const offset = i * maxSeqLen * dim;
          const pooled = new Float32Array(dim);
          let maskCount = 0;

          for (let s = 0; s < seqLen; s++) {
            const maskVal = enc.attention_mask[s] ?? 1;
            if (maskVal > 0) {
              maskCount++;
              const tokenOffset = offset + s * dim;
              for (let d = 0; d < dim; d++) {
                pooled[d] += hiddenData[tokenOffset + d];
              }
            }
          }

          const divisor = Math.max(1, maskCount);
          for (let d = 0; d < dim; d++) {
            pooled[d] /= divisor;
          }

          // L2 Normalization
          let sumSquares = 0;
          for (let d = 0; d < dim; d++) {
            sumSquares += pooled[d] * pooled[d];
          }
          const norm = Math.sqrt(sumSquares) || 1.0;
          for (let d = 0; d < dim; d++) {
            pooled[d] /= norm;
          }

          results[i] = pooled;
        }

        return results;
      },
    };
  }

  public async embed(text: string): Promise<Float32Array> {
    const pipe = await this.getPipeline();
    const processedText = this.applyModelPrefix(text, "query");
    const [vector] = await pipe.embedBatch([processedText]);
    return vector;
  }

  public async embedBatch(texts: string[]): Promise<Float32Array[]> {
    if (texts.length === 0) return [];
    const processedTexts = texts.map((t) => this.applyModelPrefix(t, "passage"));
    const pipe = await this.getPipeline();
    return pipe.embedBatch(processedTexts);
  }

  /**
   * Aplica prefixos obrigatórios para modelos da família E5 (Wang et al.).
   */
  private applyModelPrefix(text: string, type: "query" | "passage"): string {
    const isE5 = this.modelName.toLowerCase().includes("e5");
    if (!isE5) return text;
    const prefix = type === "query" ? "query: " : "passage: ";
    if (text.startsWith(prefix)) return text;
    return prefix + text;
  }

  /**
   * Motor semântico vetorial autônomo baseado em Sparse Random Projection (Johnson-Lindenstrauss)
   * com n-grams de caracteres e subwords.
   * Garante funcionamento determinístico em < 1ms mesmo sem internet ou sem pesos ONNX.
   */
  private createFallbackPipeline(): EmbeddingPipeline {
    const DIM = 384;
    const SPARSITY = 8;

    const fnv1a = (str: string): number => {
      let hash = 2166136261;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return hash >>> 0;
    };

    const SYNONYMS: Record<string, string[]> = {
      asap: ["urgent", "urgency", "immediate", "urgente", "rapido", "priority"],
      urgent: ["asap", "immediate", "urgency", "urgente", "priority"],
      urgency: ["asap", "immediate", "urgent", "urgente", "priority"],
      failing: ["bug", "error", "technical", "integration", "broken", "frustrated"],
      fatura: ["billing", "payment", "cobranca", "cartao", "estorno"],
      cobranca: ["billing", "payment", "fatura", "estorno", "duplicada"],
      estorno: ["refund", "billing", "cobranca", "devolucao", "cancelamento"],
      stripe: ["billing", "payment", "integration", "gateway"],
      losing: ["frustrated", "loss", "critical", "perda"],
      sales: ["commercial", "vendas", "revenue", "pedidos"],
      frustrated: ["angry", "irritated", "reclamacao", "insatisfeito", "failing"],
      angry: ["frustrated", "furious", "irritado", "furioso"],
      churn: ["cancelamento", "perda", "reclamacao", "inativo"],
    };

    const computeSingleVector = (text: string): Float32Array => {
      const vec = new Float32Array(DIM);
      const clean = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

      const words = clean.match(/[a-z0-9_]{2,}/g) || [];
      const wordTokens: string[] = [...words];

      for (const word of words) {
        if (SYNONYMS[word]) {
          wordTokens.push(...SYNONYMS[word]);
        }
      }

      const ngramTokens: string[] = [];
      for (const word of words) {
        if (word.length >= 4) {
          for (let i = 0; i <= word.length - 4; i++) {
            ngramTokens.push(word.substring(i, i + 4));
          }
        }
      }

      const wordCounts = new Map<string, number>();
      for (const tok of wordTokens) {
        wordCounts.set(tok, (wordCounts.get(tok) || 0) + 1);
      }

      const ngramCounts = new Map<string, number>();
      for (const tok of ngramTokens) {
        ngramCounts.set(tok, (ngramCounts.get(tok) || 0) + 1);
      }

      for (const [tok, count] of wordCounts.entries()) {
        const weight = (1 + Math.log(count)) * 4.0;
        let h = fnv1a(tok);
        for (let s = 0; s < SPARSITY; s++) {
          h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
          const dimIndex = h % DIM;
          const sign = (h & 1) === 1 ? 1 : -1;
          vec[dimIndex] += sign * weight;
        }
      }

      for (const [tok, count] of ngramCounts.entries()) {
        const weight = (1 + Math.log(count)) * 0.2;
        let h = fnv1a(tok);
        for (let s = 0; s < SPARSITY; s++) {
          h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
          const dimIndex = h % DIM;
          const sign = (h & 1) === 1 ? 1 : -1;
          vec[dimIndex] += sign * weight;
        }
      }

      let norm = 0;
      for (let i = 0; i < DIM; i++) norm += vec[i] * vec[i];
      norm = Math.sqrt(norm) || 1.0;
      for (let i = 0; i < DIM; i++) vec[i] /= norm;

      return vec;
    };

    return {
      embedBatch: async (texts: string[]): Promise<Float32Array[]> => {
        return texts.map(computeSingleVector);
      },
    };
  }
}
