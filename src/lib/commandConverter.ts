/**
 * Detects the shell format of a command string based on continuation characters.
 * - 'cmd': lines end with trailing ^ (caret)
 * - 'powershell': lines end with trailing ` (backtick)
 * - 'plain': no continuation characters detected
 */
export function detectShellFormat(input: string): 'cmd' | 'powershell' | 'plain' {
  const lines = input.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.endsWith('^')) return 'cmd';
    if (trimmed.endsWith('`')) return 'powershell';
  }
  return 'plain';
}

/**
 * Normalizes a command string to an array of clean lines.
 * Strips continuation characters (^ or `) from line ends,
 * splits by any newline format, trims each line, and filters empty lines.
 */
export function normalizeToLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((line) => {
      let trimmed = line.trimEnd();
      // Strip trailing continuation character ONLY when it appears at the end of the line
      // (followed only by optional whitespace before EOL). This avoids corrupting
      // legitimate ^ or ` characters in the middle of content (e.g., file paths, prices).
      trimmed = trimmed.replace(/[\^`]\s*$/, '');
      return trimmed.trim();
    })
    .filter((line) => line.length > 0);
}

/**
 * Converts a command to the target shell format.
 * Algorithm: detect format → normalize lines → rebuild with target continuation + \r\n endings.
 *
 * CMD continuation: ` ^\r\n`
 * PowerShell continuation: `` ` \r\n``
 * Last line has NO continuation character.
 */
export function convertCommand(input: string, targetShell: 'cmd' | 'powershell'): string {
  const lines = normalizeToLines(input);

  if (lines.length === 0) return input;
  if (lines.length === 1) return lines[0];

  const continuation = targetShell === 'cmd' ? '^' : '`';

  return lines
    .map((line, index) => {
      const isLast = index === lines.length - 1;
      if (isLast) {
        return line;
      }
      return `${line} ${continuation}`;
    })
    .join('\r\n');
}
