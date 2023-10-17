export interface ProductHintsSlice {
  seenProductHints: {
    autocomplete: boolean;
    passwordGenerator: boolean;
    saveLogin: boolean;
    saveAddress: boolean;
    saveCreditCard: boolean;
    magicLogin: boolean;
  };
}

export const initialProductHintsSlice: ProductHintsSlice = {
  seenProductHints: {
    autocomplete: false,
    passwordGenerator: false,
    saveLogin: false,
    saveAddress: false,
    saveCreditCard: false,
    magicLogin: false,
  },
};
