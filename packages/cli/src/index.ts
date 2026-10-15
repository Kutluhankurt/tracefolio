#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { run } from "./program.js";

export { createProgram, run, VERSION, type CliIO } from "./program.js";

const invokedDirectly = (() => {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  // Exit quietly when piped into a command that stops reading (e.g. `| head`).
  process.stdout.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EPIPE") process.exit(0);
    throw err;
  });
  const code = await run(process.argv.slice(2));
  // `portfolio dev` keeps a server open; every other command exits.
  if (code !== 0 || process.argv[2] !== "portfolio" || process.argv[3] !== "dev") process.exitCode = code;
}
