import { TemplateBuilder } from "./plugins/templates";

export interface BundleContext {
  watch?: boolean;
  envFile?: string;
  typecheck?: boolean;
  sourcemap?: "inline" | "external";
  uploadSourcemap?: boolean;
  removeSourcemap?: boolean;
}

export interface DisposeFunction {
  (): Promise<void>;
}

export interface BundleConfig {
  outdir: string;
  entryPoints: string[];
  templates: TemplateBuilder;
  watchDirectories: string[];
}
