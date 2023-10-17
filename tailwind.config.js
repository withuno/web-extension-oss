const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  important: "uno-container",
  content: ["./v1/**/*.{ejs,html,js,ts,tsx}", "./v2/**/*.{ejs,html,js,ts,tsx}"],
  corePlugins: { preflight: false },
  theme: rem2px({
    ...defaultTheme,
    fontFamily: {
      sans: [
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
      ],
      serif: [...defaultTheme.fontFamily.serif],
      mono: [...defaultTheme.fontFamily.mono],
    },
  }),
  plugins: [require("@tailwindcss/forms")],
};

/**
 * Replace "rem" with "px" units across the provided Tailwind config.
 *
 * Because Uno works across a variety of websites, which can sometimes use an
 * unpredictable base font-size, we need to throw "rem" units out the window,
 * lest we render some unreasonably over-or-under-sized text.
 *
 * @param config {import('tailwindcss').Config}
 * @param baseFontSize {number}
 */
function rem2px(config, baseFontSize = 16) {
  if (config == null) {
    return config;
  }
  switch (typeof config) {
    case "object": {
      if (Array.isArray(config)) {
        return config.map((val) => rem2px(val, baseFontSize));
      }
      const ret = {};
      for (const key in config) {
        ret[key] = rem2px(config[key], baseFontSize);
      }
      return ret;
    }

    case "string": {
      return config.replace(/(\d*\.?\d+)rem$/, (_, val) => `${parseFloat(val) * baseFontSize}px`);
    }

    case "function": {
      // eslint-disable-next-line no-eval
      return eval(config.toString().replace(/(\d*\.?\d+)rem/g, (_, val) => `${parseFloat(val) * baseFontSize}px`));
    }

    default: {
      return config;
    }
  }
}
