import type { ExtensionContext } from "@/v1/uno_types";

export interface V1CompatSlice {
  v1: {
    extensionContext: ExtensionContext | null;
  };
}

export const initialV1CompatSlice: V1CompatSlice = {
  v1: {
    extensionContext: null,
  },
};
