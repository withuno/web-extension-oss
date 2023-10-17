import { spawn } from "cross-spawn";
import { Inputs, createCommand } from "flik";

import { BuildOptions, flags as buildFlags } from "./build";
import { loadEnv } from "../bundle/env";
import { sayHello, Logger } from "../utils/logger";

type LoadEnvOptions = Pick<BuildOptions, "env">;

const { env } = buildFlags;

const flags: Inputs.FlagCollection<LoadEnvOptions> = { env };
const variadicArg: Inputs.PositionalArg = {
  description: `A shell command to execute with the loaded environment variables.`,
};

export default createCommand(
  {
    command: "load-env",
    description: "Loads environment variables, then invokes another script",
    inputs: { flags, variadicArg },
  },

  async ({ shutdown, data, keepAlive }) => {
    sayHello("load-env");

    try {
      const env = await loadEnv(data.env);

      const command = data["..."][0];
      if (!command) {
        Logger.env.warn("No command provided.");
        shutdown();
      }

      spawn(command, data["..."].slice(1), {
        stdio: "inherit",
        env: { ...process.env, ...env },
      }).on("exit", (exitCode, signal) => {
        if (typeof exitCode === "number") {
          process.exit(exitCode);
        } else {
          process.kill(process.pid, signal ?? undefined);
        }
      });

      return keepAlive;
    } catch (err) {
      Logger.cli.error(String(err));
      await shutdown(1);
    }
  },
);
