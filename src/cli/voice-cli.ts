import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { buildWorkspaceSkillStatus } from "../agents/skills-status.js";
import { loadConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import { theme } from "../terminal/theme.js";
import { runCommandWithRuntime } from "./cli-utils.js";

const XTTS_SKILL_NAME = "xtts-voice";
const XTTS_SAY_BIN = "bin/xtts-say";

function resolveXttsSayPath(): string {
  const config = loadConfig();
  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  if (!workspaceDir) {
    defaultRuntime.error(
      "No agent workspace configured. Run openclaw config set agents.defaults.workspace <dir>",
    );
    defaultRuntime.exit(1);
  }
  const report = buildWorkspaceSkillStatus(workspaceDir, { config });
  const skill = report.skills.find(
    (s) => s.name === XTTS_SKILL_NAME || s.skillKey === XTTS_SKILL_NAME,
  );
  if (!skill) {
    defaultRuntime.error(
      `${theme.command("xtts-voice")} skill not found. Add it to your workspace (e.g. ${theme.muted("workspace/skills/xtts-voice")}) or use the bundled skill.`,
    );
    defaultRuntime.exit(1);
  }
  const scriptPath = path.join(skill.baseDir, XTTS_SAY_BIN);
  if (!fs.existsSync(scriptPath)) {
    defaultRuntime.error(`XTTS script not found: ${scriptPath}`);
    defaultRuntime.exit(1);
  }
  return scriptPath;
}

export function registerVoiceCli(program: Command) {
  const voice = program
    .command("voice")
    .description("Voice cloning and TTS (XTTS) via the xtts-voice skill");

  voice
    .command("speak")
    .description("Synthesize speech with optional voice cloning (delegates to xtts-voice skill)")
    .argument("[text...]", "Text to speak")
    .option("--clone <wav>", "Clone voice from a WAV sample")
    .option("--record <wav>", "Record from microphone to a WAV file")
    .option("--language <code>", "Language code", "en")
    .option("-o, --output <path>", "Output WAV path")
    .option("--no-play", "Skip playback (only write WAV)")
    .action(
      async (
        textParts: string[],
        opts: {
          clone?: string;
          record?: string;
          language?: string;
          output?: string;
          play?: boolean;
        },
      ) => {
        await runCommandWithRuntime(defaultRuntime, async () => {
          const scriptPath = resolveXttsSayPath();
          const args: string[] = [];
          if (opts.clone) {
            args.push("--clone", opts.clone);
          }
          if (opts.record) {
            args.push("--record", opts.record);
          }
          if (opts.language) {
            args.push("--language", opts.language);
          }
          if (opts.output) {
            args.push("-o", opts.output);
          }
          if (opts.play === false) {
            args.push("--no-play");
          }
          const text = textParts.join(" ").trim();
          if (text) {
            args.push(text);
          }

          const child = spawn(scriptPath, args, {
            stdio: "inherit",
            shell: false,
          });
          const exitCode = await new Promise<number>((resolve) => {
            child.on("close", (code, signal) =>
              resolve(signal ? 128 + (signal as number) : (code ?? 0)),
            );
          });
          defaultRuntime.exit(exitCode);
        });
      },
    );
}
