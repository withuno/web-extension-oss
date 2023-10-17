const javascriptRules = {
  // Core ESLint
  eqeqeq: "off",
  radix: "off",
  "no-new": "off",
  "no-empty": "off",
  "no-shadow": "off",
  "no-bitwise": "off",
  "no-console": "off",
  "func-names": "off",
  "no-continue": "off",
  "no-lonely-if": "off",
  "default-case": "off",
  "guard-for-in": "off",
  "no-loop-func": "off",
  "prefer-const": "off",
  "no-lone-blocks": "off",
  "no-cond-assign": "off",
  "global-require": "off",
  "no-else-return": "off",
  "no-multi-assign": "off",
  "no-return-await": "off",
  "no-return-assign": "off",
  "no-empty-pattern": "off",
  "no-throw-literal": "off",
  "no-param-reassign": "off",
  "no-useless-return": "off",
  "no-nested-ternary": "off",
  "consistent-return": "off", // TypeScript effectively obsoletes this rule with static type inference
  "symbol-description": "off",
  "default-param-last": "off",
  "no-underscore-dangle": "off",
  "prefer-destructuring": "off",
  "no-case-declarations": "off",
  "array-callback-return": "off",
  "prefer-regex-literals": "off",
  "no-unused-expressions": "off",
  "no-restricted-globals": "off",
  "no-inner-declarations": "off",
  "no-useless-constructor": "off",
  "class-methods-use-this": "off",
  "no-promise-executor-return": "off",
  "prefer-promise-reject-errors": "off",

  // React
  "react/jsx-no-bind": "off",
  "react/button-has-type": "off",
  "react/jsx-pascal-case": "off",
  "react/react-in-jsx-scope": "off", // Not required with >= React 18
  "react/no-unused-prop-types": "off", // TODO: Revisit this rule once Popup/Onboard/etc. is refactored to use V2 code
  "react/require-default-props": "off", // Allow non-defined react props as undefined
  "react/jsx-props-no-spreading": "off",
  "react/jsx-no-useless-fragment": "off",
  "react/destructuring-assignment": "off", // VSCode doesn't support automatically destructuring; sometimes it's annoying to add a new variable

  // A11Y
  "jsx-a11y/no-autofocus": "off",
  "jsx-a11y/anchor-is-valid": "off", // We use an internal <Router> with custom <Link> component

  // A11Y (TODOs)
  "jsx-a11y/alt-text": "off", // TODO: Fix A11Y deficiencies
  "jsx-a11y/role-supports-aria-props": "off", // TODO: Fix A11Y deficiencies
  "jsx-a11y/click-events-have-key-events": "off", // TODO: Fix A11Y deficiencies
  "jsx-a11y/label-has-associated-control": "off", // TODO: turn this rule back on when the following issue closes: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/174
  "jsx-a11y/no-static-element-interactions": "off", // TODO: Fix A11Y deficiencies

  // Imports
  "import/no-dynamic-require": "off",
  "import/no-extraneous-dependencies": "off",
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": "off",

  // Tailwind
  "tailwindcss/no-custom-classname": "off", // Disabled, otherwise it's a nightmare to allow custom Tailwind classes
  "tailwindcss/classnames-order": "off", // We use Tailwind's official Prettier plugin

  // Prettier
  "prettier/prettier": ["error", {}, { usePrettierrc: true }],
};

const typescriptRules = {
  ...javascriptRules,
  "@typescript-eslint/no-shadow": "off",
  "@typescript-eslint/ban-types": "off",
  "@typescript-eslint/no-namespace": "off",
  "@typescript-eslint/comma-dangle": "off", // Avoid conflict between ESLint and Prettier
  "@typescript-eslint/no-redeclare": "off",
  "@typescript-eslint/ban-ts-comment": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unused-vars": "off",
  "@typescript-eslint/await-thenable": "off",
  "@typescript-eslint/no-var-requires": "off",
  "@typescript-eslint/no-for-in-array": "off",
  "@typescript-eslint/no-unsafe-return": "off",
  "@typescript-eslint/no-empty-function": "off",
  "@typescript-eslint/no-unsafe-argument": "off",
  "@typescript-eslint/no-floating-promises": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/restrict-plus-operands": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/restrict-template-expressions": "off",
};

module.exports = {
  // JavaScript configuration
  plugins: ["unused-imports", "tailwindcss"],
  extends: [
    "plugin:tailwindcss/recommended",
    require.resolve("@ikscodes/eslint-config/rules/airbnb"),
    require.resolve("@ikscodes/eslint-config/rules/eslint"),
    require.resolve("@ikscodes/eslint-config/rules/prettier"),
  ],
  rules: javascriptRules,

  overrides: [
    // TypeScript configuration
    {
      files: ["**/*.ts", "**/*.tsx"],
      plugins: ["unused-imports", "tailwindcss"],
      extends: [
        "plugin:tailwindcss/recommended",
        require.resolve("@ikscodes/eslint-config/rules/airbnb"),
        require.resolve("@ikscodes/eslint-config/rules/typescript"),
        require.resolve("@ikscodes/eslint-config/rules/eslint"),
        require.resolve("@ikscodes/eslint-config/rules/prettier"),
      ],
      parserOptions: { project: "**/tsconfig.json" },
      settings: {
        "import/resolver": {
          typescript: {
            project: "**/tsconfig.json",
          },
        },
      },
      rules: typescriptRules,
    },
  ],
};
