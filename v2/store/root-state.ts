import { AiAssistSlice, initialAiAssistSlice } from "./slices/ai-assist.slice";
import { DebugSlice, initialDebugSlice } from "./slices/debug.slice";
import { LayerSlice, initialLayerSlice } from "./slices/layer.slice";
import { ProductHintsSlice, initialProductHintsSlice } from "./slices/product-hints.slice";
import { SettingsSlice, initialSettingsSlice } from "./slices/settings.slice";
import { V1CompatSlice, initialV1CompatSlice } from "./slices/v1-compat.slice";
import { WhatsNewSlice, initialWhatsNewSlice } from "./slices/whats-new.slice";

export interface RootState
  extends AiAssistSlice,
    DebugSlice,
    LayerSlice,
    ProductHintsSlice,
    SettingsSlice,
    V1CompatSlice,
    WhatsNewSlice {}

export const initialRootState: RootState = {
  ...initialAiAssistSlice,
  ...initialDebugSlice,
  ...initialLayerSlice,
  ...initialProductHintsSlice,
  ...initialSettingsSlice,
  ...initialV1CompatSlice,
  ...initialWhatsNewSlice,
};
