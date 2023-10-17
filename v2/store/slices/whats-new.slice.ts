export interface WhatsNewSlice {
  whatsNew: {
    lastSeenVersion: number | null;
  };
}

export const initialWhatsNewSlice: WhatsNewSlice = {
  whatsNew: {
    lastSeenVersion: null,
  },
};
