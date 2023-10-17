/* eslint-disable no-global-assign */

import { UnoStore } from "../store";

console = ((origConsole) => {
  const prefix = "[uno]";

  const timestamp = () => {
    const pad = (n: number, s = 2) => `${new Array(s).fill(0)}${n}`.slice(-s);
    const d = new Date();
    return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
      d.getMinutes(),
    )}:${pad(d.getSeconds())}`;
  };

  const applyOriginalConsole = (type: "log" | "info" | "warn" | "error", ...args: any[]) => {
    const firstArg = args.shift();
    const normalizedArgs =
      typeof firstArg === "string"
        ? [`${timestamp()} ${prefix} %s`, firstArg, ...args]
        : [`${timestamp()} ${prefix}`, firstArg, ...args];
    origConsole[type](...normalizedArgs);
  };

  return {
    ...origConsole,

    log(...args) {
      if (process.env.ENV_NAME !== "production") {
        applyOriginalConsole("log", ...args);
      }
    },

    warn(...args) {
      if (process.env.ENV_NAME !== "production") {
        applyOriginalConsole("warn", ...args);
      }
    },

    error(...args) {
      if (process.env.ENV_NAME !== "production") {
        applyOriginalConsole("error", ...args);
      }
    },

    info(...args) {
      if (process.env.ENV_NAME !== "production") {
        applyOriginalConsole("info", ...args);
      }
    },

    debug(...args) {
      if (process.env.ENV_NAME !== "production" && UnoStore.getSnapshot().debugMode) {
        applyOriginalConsole("log", ...args);
      }
    },
  };
})(console);
