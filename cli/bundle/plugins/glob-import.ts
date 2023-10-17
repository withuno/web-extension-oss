import { Plugin } from "esbuild";
import fastGlob from "fast-glob";

/**
 * Enable glob import.
 */
export function globImport(): Plugin {
  const pluginName = `web-ext.cli.build:glob-import`;
  const resolutionNamespace = `web-ext.cli.build:glob-import:resolve`;

  return {
    name: pluginName,
    setup: (build) => {
      build.onResolve({ filter: /\*/ }, async (args) => {
        // Skip unresolvable paths
        if (args.resolveDir === "") {
          return;
        }

        return {
          path: args.path,
          namespace: resolutionNamespace,
          pluginData: { resolveDir: args.resolveDir },
        };
      });

      build.onLoad({ filter: /.*/, namespace: resolutionNamespace }, async (args) => {
        const files = (
          await fastGlob(args.path, {
            cwd: args.pluginData.resolveDir,
          })
        ).sort();

        const importStatements = files.map((filepath, i) => `import * as m_${i} from "${filepath}"`).join(";");
        const importedModulesArray = `[${files.map((_, i) => `m_${i}`).join(",")}]`;
        const importedFilenamesArray = `[${files.map((filepath) => JSON.stringify(filepath)).join(",")}]`;

        const contents = [
          importStatements,
          `const m = ${importedModulesArray};`,
          `export const filenames = ${importedFilenamesArray};`,
          "export default m;",
        ].join("\n");

        return { contents, resolveDir: args.pluginData.resolveDir };
      });
    },
  };
}
