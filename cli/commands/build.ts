import { Inputs, createCommand } from "flik";

import { bundle } from "../bundle";
import { archiveOutputs } from "../bundle/archive";
import { BundleContext } from "../bundle/types";
import { Logger, sayHello } from "../utils/logger";

export interface BuildOptions extends Inputs.FlagData {
  env: string;
  typecheck: boolean;
  compress?: boolean;
  sourcemap?: BundleContext["sourcemap"];
  uploadSourcemap: boolean;
  removeSourcemap?: boolean;
}

export const flags: Inputs.FlagCollection<BuildOptions> = {
  env: {
    type: String,
    description: "ENV file from which to load environment data.",
    default: "env/dev.env",
  },

  typecheck: {
    type: Boolean,
    description: "Whether to run TypeScript diagnostics for this build.",
    default: true,
  },

  compress: {
    type: Boolean,
    description: "Whether to automatically compress outputs as a ZIP archive.",
    default: process.env.PACKAGE === "true",
  },

  sourcemap: {
    type: String,
    description: `Specify how source-maps should be generated (one of: inline|external).`,
    defaultDescriptor: "disabled (no source-maps will be generated)",
    validate: (value) => {
      if (!["inline", "external"].includes(value)) {
        return `Please specify a source-map strategy as one of: inline|external. Received: ${value}`;
      }
    },
  },

  uploadSourcemap: {
    type: Boolean,
    description: `Whether to automatically upload source-maps to Sentry.`,
    default: false,
  },

  removeSourcemap: {
    type: Boolean,
    description: `Whether to remove source-maps from the build directory (applicable if --upload-sourcemap is omitted).`,
  },
};

export default createCommand(
  {
    command: "build",
    description: "Builds the extension for production.",
    inputs: { flags },
  },

  async ({ shutdown, addShutdownTask, data }) => {
    sayHello("build");

    try {
      const cleanup = await bundle({
        watch: false,
        envFile: data.env,
        typecheck: data.typecheck,
        sourcemap: data.sourcemap,
        uploadSourcemap: data.uploadSourcemap,
        removeSourcemap: data.removeSourcemap,
      });

      addShutdownTask(async () => {
        await cleanup?.();
      });

      if (data.compress) {
        await archiveOutputs();
      }
    } catch (err) {
      Logger.cli.error(String(err));
      await shutdown(1);
    }

    await shutdown();
  },
);
