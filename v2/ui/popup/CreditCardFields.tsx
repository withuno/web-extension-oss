import { useState, useMemo, useCallback, useRef, useEffect } from "react";

import creditCardType from "credit-card-type";
import {
  InputAttributes,
  NumberFormatBaseProps,
  usePatternFormat,
  NumberFormatBase,
  OnValueChange,
  NumberFormatValues,
  SourceInfo,
} from "react-number-format";

export type { OnValueChange };

/**
 * Base HTML `<input>` props mixed-in with `react-number-format` props.
 */
interface BaseInputProps
  extends Pick<
    NumberFormatBaseProps<InputAttributes>,
    Exclude<keyof React.InputHTMLAttributes<HTMLInputElement>, "children">
  > {
  onValueChange?: NumberFormatBaseProps["onValueChange"];
}

/**
 * `OnValueChange` from `react-number-format`, but `sourceInfo` is overloaded
 * with arbitrary `Enrichments`.
 */
type EnrichedOnValueChange<Enrichments> = (values: NumberFormatValues, sourceInfo: SourceInfo & Enrichments) => void;

// -------------------------------------------------------------------------- //

function useCreditCardExpirationMask<Props extends { value?: string | number | null }>(props: Props) {
  const patternProps = usePatternFormat({
    ...props,
    format: "##/##",
    mask: "_",
  });

  const format = useCallback(
    (val: string) => {
      let month = val.substring(0, 2);
      let year = val.substring(2, 4);

      if (month.length === 1 && Number(month[0]) > 1) {
        month = `0${month[0]}`;
      } else if (month.length === 2) {
        // set the lower and upper boundary
        if (Number(month) === 0) {
          month = `01`;
        } else if (Number(month) > 12) {
          year = month[1];
          month = "01";
        }
      }

      return patternProps.format(`${month}${year}`);
    },
    [patternProps.format],
  );

  return { ...patternProps, format };
}

export function CreditCardExpirationInput(props: BaseInputProps) {
  const patternProps = useCreditCardExpirationMask(props);
  return <NumberFormatBase {...patternProps} valueIsNumericString />;
}

export interface CreditCardExpirationDisplayProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  value?: string | number | null;
}

export function CreditCardExpirationDisplay(props: CreditCardExpirationDisplayProps) {
  const patternProps = useCreditCardExpirationMask(props);
  return <NumberFormatBase {...patternProps} displayType="text" valueIsNumericString />;
}

// -------------------------------------------------------------------------- //

export type CreditCardProvider = (typeof creditCardType.types)[string] | "unknown";

function useCreditCardNumberMask<Props extends { value?: string | number | null }>(props: Props) {
  const getType = useCallback((val?: string | number | null) => {
    const numericString = String(val);
    return numericString.length ? creditCardType(String(val))[0] : undefined;
  }, []);

  const getPattern = useCallback((val?: string | number | null) => {
    const numericString = String(val);
    const ccType = getType(numericString);

    if (ccType) {
      const maxLengthForCardType = Math.max(...ccType.lengths);
      const offsets = [0].concat(ccType.gaps, maxLengthForCardType);

      let pattern = "•".repeat(maxLengthForCardType); // e.g.: "•••• •••• •••• ••••"
      pattern = `####${pattern.slice(4, -4)}####`; // e.g.: "#### •••• •••• ####"

      const components = [];
      for (let i = 0; offsets[i] < maxLengthForCardType; i++) {
        const start = offsets[i];
        const end = Math.min(offsets[i + 1], maxLengthForCardType);
        components.push(pattern.substring(start, end));
      }

      return components.join(" ");
    }

    // Default to 4-4-4-[4,5,6,7] pattern
    // Note: hard-coded knowledge that credit cards cannot exceed 19-digits...
    return "#### •••• •••• #######";
  }, []);

  const isValidLength = useCallback((val?: string | number | null) => {
    const numericString = String(val);
    const ccType = getType(numericString);
    return ccType ? ccType.lengths.some((l) => l === numericString.length) : false;
  }, []);

  const [isObfuscated, setIsObfuscated] = useState(() => {
    return isValidLength(props.value);
  });

  const currentPattern = useMemo(() => getPattern(props.value), [props.value]);
  const patternProps = usePatternFormat({
    ...props,
    format: isObfuscated ? currentPattern : currentPattern.replace(/•/g, "#"),
    mask: "",
  });

  const valueBeforeObfuscation = useRef<string | null>(null);
  const format = useCallback(
    (val: string) => {
      if (isObfuscated) {
        if (valueBeforeObfuscation.current == null) {
          valueBeforeObfuscation.current = val;
        }

        const ccType = getType(val);
        const offsets = [0].concat(ccType?.gaps ?? [4, 8, 12], val.length);
        const first4 = val.slice(0, 4);
        const last4 = val.slice(-4);
        let pattern = "•".repeat(val.length);
        pattern = first4 + pattern.slice(4, -4) + last4;

        const components = [];
        for (let i = 0; offsets[i] < val.length; i++) {
          const start = offsets[i];
          const end = Math.min(offsets[i + 1], val.length);
          components.push(pattern.substring(start, end));
        }

        return components.join(" ");
      }

      if (valueBeforeObfuscation.current != null) {
        const nextValue = patternProps.format(valueBeforeObfuscation.current);
        valueBeforeObfuscation.current = null;
        return nextValue;
      }

      return patternProps.format(val);
    },
    [isObfuscated, patternProps.format],
  );

  const removeFormatting = useCallback(
    (val: string) => {
      return patternProps.removeFormatting(
        valueBeforeObfuscation.current != null
          ? valueBeforeObfuscation.current.replace(/\D/g, "")
          : val.replace(/\D/g, ""),
      );
    },
    [patternProps.removeFormatting],
  );

  return {
    patternProps: { ...patternProps, format, removeFormatting },
    getType,
    getPattern,
    isValidLength,
    isObfuscated,
    setIsObfuscated,
  };
}

export interface CreditCardNumberInputProps extends Omit<BaseInputProps, "onValueChange"> {
  onValueChange?: EnrichedOnValueChange<{
    cardProvider: CreditCardProvider;
    cardProviderDisplayName?: string;
  }>;
}

export function CreditCardNumberInput(props: BaseInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { patternProps, getType, isObfuscated, setIsObfuscated } = useCreditCardNumberMask({
    ...props,
    getInputRef: inputRef,
  });

  // Patch the caret position after re-focusing an obfuscated `CreditCardNumberInput`.
  // We have to do this to solve for a limitation in the caret positioning engine
  // behind `react-number-format` that doesn't suit our use-case here.
  const selectionStartUponFocus = useRef<number | null>(null);
  const selectionEndUponFocus = useRef<number | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (
        !isObfuscated &&
        inputRef.current &&
        selectionStartUponFocus.current &&
        selectionEndUponFocus.current &&
        selectionStartUponFocus.current === selectionEndUponFocus.current
      ) {
        inputRef.current.selectionStart = selectionStartUponFocus.current;
        inputRef.current.selectionEnd = selectionEndUponFocus.current;
      }
      selectionStartUponFocus.current = null;
      selectionEndUponFocus.current = null;
    }, 0);
    return () => {
      clearTimeout(timeout);
    };
  }, [isObfuscated]);

  const handleFocus = useCallback<React.FocusEventHandler<HTMLInputElement>>(
    (e) => {
      if (isObfuscated) {
        selectionStartUponFocus.current = e.target.selectionStart;
        selectionEndUponFocus.current = e.target.selectionEnd;
        setIsObfuscated(false);
      }
      patternProps.onFocus?.(e);
    },
    [patternProps.onFocus, isObfuscated],
  );

  const handleBlur = useCallback<React.FocusEventHandler<HTMLInputElement>>(
    (e) => {
      setIsObfuscated(true);
      patternProps.onBlur?.(e);
    },
    [patternProps.onBlur, props.value],
  );

  const handleValueChange = useCallback<OnValueChange>(
    (values, sourceInfo) => {
      if (!isObfuscated) {
        const enrichedOnValueChange = patternProps.onValueChange as CreditCardNumberInputProps["onValueChange"];

        const ccType = getType(values.value);

        enrichedOnValueChange?.(values, {
          ...sourceInfo,
          cardProvider: (ccType?.type as CreditCardProvider) ?? "unknown",
          cardProviderDisplayName: ccType?.niceType,
        });
      }
    },
    [patternProps.onValueChange, isObfuscated, getType],
  );

  const _getCaretBoundary = (formattedValue: string) => {
    const boundaryArr = Array.from({ length: formattedValue.length + 1 }).map(() => true);

    for (let i = 0, ln = boundaryArr.length; i < ln; i++) {
      // Consider the caret to be in boundary if it is before or
      // after a numeric value, or is an obfuscated value ("●").
      boundaryArr[i] = Boolean(formattedValue[i]?.match(/\d|•/) || formattedValue[i - 1]?.match(/\d|•/));
    }

    return boundaryArr;
  };

  return (
    <NumberFormatBase
      {...patternProps}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onValueChange={handleValueChange}
      isValidInputCharacter={() => true}
      getCaretBoundary={_getCaretBoundary}
      valueIsNumericString
    />
  );
}

export interface CreditCardNumberDisplayProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  value?: string | number | null;
}

export function CreditCardNumberDisplay(props: CreditCardNumberDisplayProps) {
  const { patternProps, isObfuscated, setIsObfuscated } = useCreditCardNumberMask(props);

  const handleClick = useCallback(() => {
    setIsObfuscated(false);
  }, []);

  return (
    <NumberFormatBase
      {...patternProps}
      displayType="text"
      onClick={handleClick}
      isValidInputCharacter={() => true}
      valueIsNumericString
      style={{ cursor: isObfuscated ? "pointer" : "text" }}
    />
  );
}
