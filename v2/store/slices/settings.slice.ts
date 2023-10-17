export enum FeatureFlag {
  AiAssist = "ai-assist",
  AiAssistDebugMode = "ai-assist-debug-mode",
}

export interface SettingsSlice {
  settings: {
    enabledFeatures: FeatureFlag[];
  };
}

export const initialSettingsSlice: SettingsSlice = {
  settings: {
    enabledFeatures: [],
  },
};
