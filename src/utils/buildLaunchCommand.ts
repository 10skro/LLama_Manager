import type { LaunchConfigArg } from '@/types';

/**
 * Escapes a value for CMD shell.
 * Wraps in double quotes and escapes internal quotes.
 */
function escapeCmdValue(value: string): string {
  // Escape internal double quotes by doubling them
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Escapes a value for PowerShell.
 * Wraps in double quotes and escapes internal quotes.
 */
function escapePsValue(value: string): string {
  // Escape internal double quotes with backtick
  const escaped = value.replace(/"/g, '`"');
  return `"${escaped}"`;
}

/**
 * Builds a shell launch command for llama-server.exe.
 *
 * CMD format uses ^ for line continuation.
 * PowerShell format uses backtick (`) for line continuation.
 *
 * Rules:
 * - Model path is always quoted
 * - String values are always quoted
 * - Boolean flags have no value
 * - Last line has NO continuation character
 * - Proper escaping per shell type
 */
export function buildLaunchCommand(
  exePath: string,
  modelPath: string,
  args: LaunchConfigArg[],
  shellType: 'cmd' | 'powershell'
): string {
  const isCmd = shellType === 'cmd';
  const continuation = isCmd ? '^' : '`';

  const lines: string[] = [];

  // First line: executable path
  const exeEscaped = isCmd ? escapeCmdValue(exePath) : escapePsValue(exePath);
  lines.push(`${exeEscaped} ${continuation}`);

  // Model argument (always first after exe)
  const modelEscaped = isCmd ? escapeCmdValue(modelPath) : escapePsValue(modelPath);
  lines.push(`-m ${modelEscaped} ${continuation}`);

  // Additional arguments in order
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const isLast = i === args.length - 1;

    // Skip if value is empty for non-boolean args
    if (!arg.value && arg.value !== 'true' && arg.value !== 'false') {
      continue;
    }

    // Skip boolean flags set to false (presence of flag means true)
    if (arg.value === 'false') {
      continue;
    }

    if (isLast) {
      // Last line: no continuation character
      if (arg.value === 'true') {
        // Boolean flag - no value
        lines.push(`${arg.argKey}`);
      } else {
        // String/number value - quoted
        const valEscaped = isCmd ? escapeCmdValue(arg.value) : escapePsValue(arg.value);
        lines.push(`${arg.argKey} ${valEscaped}`);
      }
    } else {
      // Non-last line: with continuation character
      if (arg.value === 'true') {
        lines.push(`${arg.argKey} ${continuation}`);
      } else {
        const valEscaped = isCmd ? escapeCmdValue(arg.value) : escapePsValue(arg.value);
        lines.push(`${arg.argKey} ${valEscaped} ${continuation}`);
      }
    }
  }

  return lines.join('\n');
}
