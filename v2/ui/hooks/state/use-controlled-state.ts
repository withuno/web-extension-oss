import { useRef, useEffect, useState } from "react";

import { useCallbackRef } from "usable-react";

export interface UseControlledStateParams<T> {
  value?: T | undefined;
  defaultValue?: T | undefined;
  onChange?: (state: T) => void;
}

/**
 * Creates a stateful variable that can be in
 * either a controlled or uncontrolled state.
 */
export function useControlledState<T>(options: UseControlledStateParams<T>) {
  const { value: propValue, defaultValue, onChange = () => {} } = options;

  const [uncontrolledProp, setUncontrolledProp] = useUncontrolledState({ defaultValue, onChange });
  const isControlled = propValue !== undefined;
  const value = isControlled ? propValue : uncontrolledProp;
  const handleChange = useCallbackRef(onChange);

  const setValue: React.Dispatch<React.SetStateAction<T | undefined>> = useCallbackRef((nextValue) => {
    if (isControlled) {
      const setter = nextValue as (prevState?: T) => T;
      const nextValueResolved = typeof nextValue === "function" ? setter(propValue) : nextValue;
      if (nextValueResolved !== propValue) handleChange(nextValueResolved as T);
    } else {
      setUncontrolledProp(nextValue);
    }
  });

  return [value, setValue, isControlled] as const;
}

function useUncontrolledState<T>(options: Omit<UseControlledStateParams<T>, "prop">) {
  const { defaultValue: defaultPropValue, onChange } = options;

  const uncontrolledState = useState<T | undefined>(defaultPropValue);
  const [value] = uncontrolledState;
  const prevValueRef = useRef(value);
  const handleChange = useCallbackRef(onChange);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      handleChange(value as T);
      prevValueRef.current = value;
    }
  }, [value, prevValueRef, handleChange]);

  return uncontrolledState;
}
