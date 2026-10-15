/**
 * Paths that must never contribute to career output: their names, stats and
 * inferred skills are dropped before anything is stored.
 */
export const DEFAULT_SENSITIVE_PATTERNS: readonly string[] = [
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "*.p12",
  "*.pfx",
  "*.keystore",
  "*.jks",
  "*.kdbx",
  "id_rsa*",
  "id_ed25519*",
  ".npmrc",
  ".pypirc",
  ".netrc",
  "*credentials*",
  "*secret*",
  "secrets/**",
  "**/secrets/**",
];

function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else {
        out += "[^/]*";
      }
    } else if (c === "?") {
      out += "[^/]";
    } else {
      out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`, "i");
}

export function createSensitivePathMatcher(extraPatterns: readonly string[] = []): (path: string) => boolean {
  const patterns = [...DEFAULT_SENSITIVE_PATTERNS, ...extraPatterns].map((p) => ({
    hasSlash: p.includes("/"),
    re: globToRegExp(p),
  }));
  return (path: string) => {
    const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "");
    const base = normalized.split("/").pop() ?? normalized;
    return patterns.some(({ hasSlash, re }) => (hasSlash ? re.test(normalized) : re.test(base)));
  };
}

const SECRET_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----|$)/g, "[REDACTED PRIVATE KEY]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[REDACTED]"],
  [/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[REDACTED]"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, "[REDACTED]"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, "[REDACTED]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED]"],
  [/\b(password|passwd|pwd|secret|token|api[_-]?key)(\s*[:=]\s*)("[^"]*"|'[^']*'|\S+)/gi, "$1$2[REDACTED]"],
  [/(https?:\/\/)[^\s/@:]+(:[^\s/@]*)?@/g, "$1"],
];

/** Remove credentials and secret-looking tokens from free text. */
export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((acc, [re, replacement]) => acc.replace(re, replacement), text);
}

/** Strip embedded credentials from a remote URL and turn SSH remotes into web URLs. */
export function sanitizeRemoteUrl(remote: string): string | undefined {
  const trimmed = remote.trim();
  if (!trimmed) return undefined;
  const scp = /^[\w.-]+@([\w.-]+):(.+?)(\.git)?\/?$/.exec(trimmed);
  if (scp) return `https://${scp[1]}/${scp[2]}`;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "file:") return undefined;
    url.username = "";
    url.password = "";
    const protocol = url.protocol === "ssh:" || url.protocol === "git:" ? "https:" : url.protocol;
    return `${protocol}//${url.host}${url.pathname.replace(/\.git\/?$/, "").replace(/\/$/, "")}`;
  } catch {
    return undefined;
  }
}
