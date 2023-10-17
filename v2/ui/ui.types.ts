import React, { HTMLAttributes, DetailedHTMLProps, JSXElementConstructor, PropsWithoutRef } from "react";

/**
 * Infer the `HTMLElement` type from a tag name.
 */
export type ElementTypeFromTag<T extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[T] extends DetailedHTMLProps<infer Props, any>
    ? Props extends HTMLAttributes<infer E>
      ? E
      : never
    : never;

/**
 * Infer the `HTMLElement` type from the given `HTMLAttributes`.
 */
export type ElementTypeFromHTMLAttributes<T extends HTMLAttributes<any>> = T extends HTMLAttributes<infer E>
  ? E
  : never;

/**
 * Extend from this type to compose native
 * HTML attributes with another React props interface.
 */
export type IntrinsicElementProps<T extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[T] extends DetailedHTMLProps<infer Props, any>
    ? Props extends HTMLAttributes<any>
      ? PropsWithoutRef<Props>
      : never
    : never;

/**
 * Types a dictionary of event handlers based on the given intrinsic element
 * tag. This makes it easy to type an event handler for later use, rather than
 * being forced to inline the event handler in JSX.
 */
export type EventHandlers<T extends keyof JSX.IntrinsicElements | JSXElementConstructor<any>> =
  T extends keyof JSX.IntrinsicElements
    ? {
        [K in keyof IntrinsicElementProps<T> as K extends `on${Capitalize<string>}`
          ? K
          : never]-?: IntrinsicElementProps<T>[K];
      }
    : T extends JSXElementConstructor<any>
    ? {
        [K in keyof React.ComponentProps<T> as K extends `on${Capitalize<string>}`
          ? K
          : never]-?: React.ComponentProps<T>[K];
      }
    : never;

/**
 * A string union representing HTML atributes that are evented.
 */
export type EventAttributes<T extends keyof JSX.IntrinsicElements> = keyof EventHandlers<T>;
