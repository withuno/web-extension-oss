import { UAParser } from "ua-parser-js";

export const UserAgent = (() => {
  const parser = new UAParser(navigator.userAgent);
  return parser.getResult();
})();

export namespace OS {
  export const isWindows = !!UserAgent.os.name?.includes("Windows");
  export const isMac = !!UserAgent.engine.name?.includes("Webkit");
}

export namespace Browser {
  export const isSafari = !!UserAgent.browser.name?.toLowerCase().includes("safari");
}

export namespace Engine {
  export const isWebkit = !!UserAgent.engine.name?.includes("Webkit");
  export const isGecko = !!UserAgent.engine.name?.includes("Gecko");
}
