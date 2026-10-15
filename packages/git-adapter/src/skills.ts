const EXTENSIONS: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", ipynb: "Python",
  go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", kts: "Kotlin", scala: "Scala",
  swift: "Swift", m: "Objective-C", mm: "Objective-C",
  c: "C", h: "C", cc: "C++", cpp: "C++", cxx: "C++", hpp: "C++", hh: "C++",
  cs: "C#", fs: "F#", rb: "Ruby", php: "PHP", dart: "Dart", lua: "Lua",
  ex: "Elixir", exs: "Elixir", erl: "Erlang", hs: "Haskell", clj: "Clojure", r: "R", jl: "Julia",
  sh: "Shell", bash: "Shell", zsh: "Shell", ps1: "PowerShell",
  sql: "SQL", graphql: "GraphQL", gql: "GraphQL", proto: "Protocol Buffers",
  html: "HTML", css: "CSS", scss: "Sass", sass: "Sass", less: "Less",
  vue: "Vue", svelte: "Svelte", astro: "Astro",
  tf: "Terraform", hcl: "Terraform", nix: "Nix",
  sol: "Solidity", zig: "Zig",
};

const FILENAMES: Array<[RegExp, string]> = [
  [/(^|\/)Dockerfile(\.[\w-]+)?$/i, "Docker"],
  [/(^|\/)(docker-)?compose\.ya?ml$/i, "Docker"],
  [/(^|\/)\.github\/workflows\//, "GitHub Actions"],
  [/(^|\/)\.gitlab-ci\.yml$/, "GitLab CI"],
  [/(^|\/)Jenkinsfile$/, "Jenkins"],
  [/(^|\/)(Chart\.yaml|values\.ya?ml)$/, "Helm"],
  [/(^|\/)k8s\/|(^|\/)kubernetes\//i, "Kubernetes"],
  [/(^|\/)CMakeLists\.txt$/, "CMake"],
  [/(^|\/)Makefile$/, "Make"],
  [/\.(test|spec)\.[jt]sx?$|(^|\/)tests?\/.*\.py$|(^|\/)test_[^/]+\.py$/, "Testing"],
];

/** Infer the technologies a set of changed files demonstrates. */
export function inferSkills(paths: string[]): string[] {
  const found = new Set<string>();
  for (const path of paths) {
    for (const [re, skill] of FILENAMES) if (re.test(path)) found.add(skill);
    const ext = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
    const lang = ext ? EXTENSIONS[ext] : undefined;
    if (lang) found.add(lang);
  }
  return [...found].sort();
}
