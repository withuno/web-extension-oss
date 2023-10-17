import { Inputs, createCommand } from "flik";

import { BuildOptions, flags as buildFlags } from "./build";
import { bundle } from "../bundle";
import { Logger, sayHello } from "../utils/logger";

type WatchOptions = Pick<BuildOptions, "env" | "typecheck">;

const { env, typecheck } = buildFlags;

const flags: Inputs.FlagCollection<WatchOptions> = { env, typecheck };

export default createCommand(
  {
    command: "watch",
    description: "Builds the extension for development.",
    inputs: { flags },
  },

  async ({ shutdown, addShutdownTask, keepAlive, data }) => {
    sayHello("watch");

    try {
      const cleanup = await bundle({
        watch: true,
        envFile: data.env,
        typecheck: data.typecheck,
        sourcemap: "inline",
        uploadSourcemap: false,
        removeSourcemap: false,
      });

      addShutdownTask(async () => {
        await cleanup?.();
      });

      return keepAlive;
    } catch (err) {
      Logger.cli.error(String(err));
      await shutdown(1);
    }
  },
);
