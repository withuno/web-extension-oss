import CONFIG from "@/bundle.config";
import { Logger as FlikLogger } from "flik";
import { Project } from "ts-morph";

import { resolveOutDir, resolveProjectRoot } from "./resolvers";
import { BundleContext } from "./types";
import { Logger } from "../utils/logger";
import { SubscribeCallback, createWatcher } from "../utils/watcher";

export async function createTypeChecker(ctx?: BundleContext) {
  if (ctx?.typecheck) {
    const project = new Project({
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        noEmit: false,
        declarationDir: resolveOutDir("types"),
      },
      tsConfigFilePath: "./tsconfig.json",
    });

    Logger.typeCheck.async.pending("Running type-checker...");
    await runTypeScriptDiagnostics(project);

    if (ctx?.watch) {
      const onFileChange: SubscribeCallback = async (err, events) => {
        if (err) {
          return;
        }

        const changedPaths = events.map((evt) => evt.path);
        const allSourceFiles: string[] = project.getSourceFiles().map((file) => file.getFilePath());
        const shouldRunTypeScriptDiagnostics = changedPaths.find((item) => allSourceFiles.includes(item));

        if (shouldRunTypeScriptDiagnostics) {
          Logger.typeCheck.async.pending("File change detected; running type-checker...");
          await runTypeScriptDiagnostics(project);
        }
      };

      await Promise.all(
        CONFIG.watchDirectories.map(async (dir) => {
          const watcher = await createWatcher(resolveProjectRoot(dir));
          watcher.addListener(onFileChange);
        }),
      );
    }
  }
}

async function runTypeScriptDiagnostics(project: Project) {
  await Promise.all(project.getSourceFiles().map((sourceFile) => sourceFile.refreshFromFileSystem()));

  const diagnostics = project.getPreEmitDiagnostics();

  if (diagnostics.length) {
    Logger.typeCheck.error("Found type errors:");
    FlikLogger.visualSeparator();
    console.error(project.formatDiagnosticsWithColorAndContext(diagnostics));
    FlikLogger.visualSeparator();
  } else {
    Logger.typeCheck.async.complete("No type errors found.");
  }
}
