export interface LlamaCppArg {
  flag: string;
  longFlag?: string;
  label: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  defaultValue?: string;
  category: string;
  enumOptions?: string[];
  required?: boolean;
}

export const LLAMA_CPP_ARGS: LlamaCppArg[] = [
  // ─── Model ───────────────────────────────────────────────────────────────
  {
    flag: '-m',
    longFlag: '--model',
    label: 'Model Path',
    description: 'Path to the model file (.gguf).',
    type: 'string',
    category: 'model',
    required: true,
  },
  {
    flag: '--model-chat-template',
    label: 'Chat Template',
    description: 'Override the model\'s built-in chat template.',
    type: 'string',
    category: 'model',
  },
  {
    flag: '-h',
    longFlag: '--host',
    label: 'Host',
    description: 'IP address to listen on (default: 127.0.0.1).',
    type: 'string',
    defaultValue: '127.0.0.1',
    category: 'network',
  },
  {
    flag: '--port',
    label: 'Port',
    description: 'Port to listen on (default: 8080).',
    type: 'number',
    defaultValue: '8080',
    category: 'network',
  },
  {
    flag: '--path',
    label: 'Base Path',
    description: 'Base path to serve the API from.',
    type: 'string',
    defaultValue: '/',
    category: 'network',
  },
  {
    flag: '--threads',
    label: 'Threads',
    description: 'Number of threads to use for generation.',
    type: 'number',
    category: 'performance',
  },
  {
    flag: '-np',
    longFlag: '--parallel',
    label: 'Parallel',
    description: 'Number of prompt slots to process in parallel.',
    type: 'number',
    defaultValue: '1',
    category: 'performance',
  },
  {
    flag: '--batch',
    label: 'Batch Size',
    description: 'Maximum number of prompt tokens to batch together.',
    type: 'number',
    defaultValue: '2048',
    category: 'performance',
  },
  {
    flag: '--ubatch',
    label: 'UBatch Size',
    description: 'Size of each urgent batch.',
    type: 'number',
    defaultValue: '512',
    category: 'performance',
  },
  {
    flag: '--prio',
    label: 'Thread Priority',
    description: 'Priority of threads (idle, low, normal, high, realtime).',
    type: 'enum',
    enumOptions: ['idle', 'low', 'normal', 'high', 'realtime'],
    category: 'performance',
  },
  {
    flag: '--prio-batch',
    label: 'Batch Thread Priority',
    description: 'Priority of batch threads.',
    type: 'enum',
    enumOptions: ['idle', 'low', 'normal', 'high', 'realtime'],
    category: 'performance',
  },
  {
    flag: '-ngl',
    longFlag: '--gpu-layers',
    label: 'GPU Layers',
    description: 'Number of layers to offload to GPU (-1 for all).',
    type: 'number',
    defaultValue: '0',
    category: 'gpu',
  },
  {
    flag: '-mg',
    longFlag: '--main-gpu',
    label: 'Main GPU',
    description: 'Main GPU index for split processing.',
    type: 'number',
    defaultValue: '0',
    category: 'gpu',
  },
  {
    flag: '-ts',
    longFlag: '--tensor-split',
    label: 'Tensor Split',
    description: 'Split layers across multiple GPUs (comma-separated ratios).',
    type: 'string',
    category: 'gpu',
  },
  {
    flag: '-sm',
    longFlag: '--split-mode',
    label: 'Split Mode',
    description: 'How to split the model across GPUs.',
    type: 'enum',
    enumOptions: ['none', 'layer', 'row'],
    defaultValue: 'layer',
    category: 'gpu',
  },
  {
    flag: '--temp',
    label: 'Temperature',
    description: 'Temperature for sampling (higher = more random).',
    type: 'number',
    defaultValue: '0.8',
    category: 'sampling',
  },
  {
    flag: '--top-p',
    label: 'Top P',
    description: 'Top-p sampling parameter (nucleus sampling).',
    type: 'number',
    defaultValue: '0.95',
    category: 'sampling',
  },
  {
    flag: '--top-k',
    label: 'Top K',
    description: 'Top-k sampling parameter.',
    type: 'number',
    defaultValue: '40',
    category: 'sampling',
  },
  {
    flag: '--min-p',
    label: 'Min P',
    description: 'Minimum probability threshold for token selection.',
    type: 'number',
    defaultValue: '0.05',
    category: 'sampling',
  },
  {
    flag: '--repeat-penalty',
    label: 'Repeat Penalty',
    description: 'Penalty for repeating tokens.',
    type: 'number',
    defaultValue: '1.1',
    category: 'sampling',
  },
  {
    flag: '--repeat-last-n',
    label: 'Repeat Last N',
    description: 'Number of tokens to consider for repeat penalty (-1 for all).',
    type: 'number',
    defaultValue: '64',
    category: 'sampling',
  },
  {
    flag: '-c',
    longFlag: '--ctx-size',
    label: 'Context Size',
    description: 'Size of the prompt context (default: 4096).',
    type: 'number',
    defaultValue: '4096',
    category: 'context',
  },
  {
    flag: '--ctx-prefix-lines',
    label: 'Context Prefix Lines',
    description: 'Number of lines to use as context prefix.',
    type: 'number',
    defaultValue: '2',
    category: 'context',
  },
  {
    flag: '--no-context-prefix',
    label: 'No Context Prefix',
    description: 'Disable context prefix lines.',
    type: 'boolean',
    category: 'context',
  },
  {
    flag: '--no-mmap',
    label: 'No Memory Map',
    description: 'Disable memory mapping for model loading.',
    type: 'boolean',
    category: 'cache',
  },
  {
    flag: '--mlock',
    label: 'Memory Lock',
    description: 'Force system to keep model in RAM.',
    type: 'boolean',
    category: 'cache',
  },
  {
    flag: '-fa',
    longFlag: '--flash-attn',
    label: 'Flash Attention',
    description: 'Enable flash attention for faster inference.',
    type: 'boolean',
    category: 'cache',
  },
  {
    flag: '-ctk',
    longFlag: '--cache-type-k',
    label: 'Cache Type K',
    description: 'KV cache type for keys (f16, f32, q4_0, q4_1, q8_0).',
    type: 'enum',
    enumOptions: ['f16', 'f32', 'q4_0', 'q4_1', 'q8_0'],
    defaultValue: 'f16',
    category: 'cache',
  },
  {
    flag: '-ctv',
    longFlag: '--cache-type-v',
    label: 'Cache Type V',
    description: 'KV cache type for values (f16, f32, q4_0, q4_1, q8_0).',
    type: 'enum',
    enumOptions: ['f16', 'f32', 'q4_0', 'q4_1', 'q8_0'],
    defaultValue: 'f16',
    category: 'cache',
  },
  {
    flag: '--spec-type',
    label: 'Speculative Type',
    description: 'Type of speculative decoding to use.',
    type: 'enum',
    enumOptions: ['none', 'draft', 'jump'],
    defaultValue: 'none',
    category: 'speculative',
  },
  {
    flag: '--spec-draft-n-max',
    label: 'Spec Draft N Max',
    description: 'Maximum number of draft tokens for speculative decoding.',
    type: 'number',
    defaultValue: '10',
    category: 'speculative',
  },
  {
    flag: '--spec-probs-max',
    label: 'Spec Probs Max',
    description: 'Maximum number of probabilities for speculative decoding.',
    type: 'number',
    defaultValue: '10',
    category: 'speculative',
  },
  {
    flag: '--jinja',
    label: 'Use Jinja',
    description: 'Use Jinja for chat template processing.',
    type: 'boolean',
    category: 'template',
  },
  {
    flag: '--reasoning-preserve',
    label: 'Preserve Reasoning',
    description: 'Preserve reasoning tags in the output.',
    type: 'boolean',
    category: 'template',
  },
];

/** Get all unique categories from the catalog */
export const CATEGORIES = Array.from(new Set(LLAMA_CPP_ARGS.map((arg) => arg.category)));

/** Get arguments filtered by category */
export function getArgsByCategory(category: string): LlamaCppArg[] {
  return LLAMA_CPP_ARGS.filter((arg) => arg.category === category);
}

/** Flags that are managed separately by the launch config UI (model path) */
const EXCLUDED_FLAGS = new Set(['-m', '--model']);

/** Search arguments by query (matches flag, label, description) */
export function searchArgs(query: string): LlamaCppArg[] {
  if (!query.trim()) {
    return LLAMA_CPP_ARGS.filter((arg) => !EXCLUDED_FLAGS.has(arg.flag));
  }
  const q = query.toLowerCase();
  return LLAMA_CPP_ARGS.filter(
    (arg) =>
      !EXCLUDED_FLAGS.has(arg.flag) &&
      !EXCLUDED_FLAGS.has(arg.longFlag ?? '') &&
      (arg.flag.toLowerCase().includes(q) ||
        arg.longFlag?.toLowerCase().includes(q) ||
        arg.label.toLowerCase().includes(q) ||
        arg.description.toLowerCase().includes(q) ||
        arg.category.toLowerCase().includes(q))
  );
}
