import { createCommand } from "flik";

import { createTypeChecker } from "../bundle/type-checker";
import { Logger, sayHello } from "../utils/logger";

export default createCommand(
  {
    command: "typecheck",
    description: "Runs TypeScript diagnostics.",
  },

  async ({ shutdown }) => {
    sayHello("typecheck");

    try {
      await createTypeChecker({ typecheck: true });
    } catch (err) {
      Logger.cli.error(String(err));
      await shutdown(1);
    }

    await shutdown();
  },
);
