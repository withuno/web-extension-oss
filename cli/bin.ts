#!/usr/bin/env ts-node

import { start } from "flik";

// Commands
import buildCommand from "./commands/build";
import loadEnv from "./commands/load-env";
import typecheck from "./commands/typecheck";
import watchCommand from "./commands/watch";

start({
  binaryName: "web-ext.cli",
  version: "∞",
  commands: [buildCommand, watchCommand, typecheck, loadEnv],
});
