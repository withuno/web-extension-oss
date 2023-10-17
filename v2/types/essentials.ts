export type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

export type TupleToIntersection<T extends any[]> = {
  [I in keyof T]: (x: T[I]) => void;
}[number] extends (x: infer I) => void
  ? I
  : never;

export type AllKeys<T> = T extends any ? keyof T : never;
export type PickType<T, K extends AllKeys<T>> = T extends Record<K, any> ? T[K] : never;
export type Merge<T> = {
  [k in AllKeys<T>]: PickType<T, k>;
};

export type RequiredFieldsOnly<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K];
};

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};
export function Tuple<T extends readonly [unknown, ...unknown[]]>(v: T) {
  return v as Mutable<T>;
}

interface SerializedPrimitives {
  string: string;
  number: number;
  boolean: boolean;
}
export type SerializedPrimitive = keyof SerializedPrimitives;
export type SerializedPrimitiveToType<T extends SerializedPrimitive> = SerializedPrimitives[T];

export type JSONPrimitive = string | number | boolean | null | undefined;
export interface JSONObject {
  [member: string | number | symbol]: JSONValue;
}
export interface JSONSerializable {
  toJSON(): string;
}
export type JSONArray = Array<JSONValue>;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray | JSONSerializable;

export type RemoveIndexSignature<T> = T extends Array<any>
  ? T
  : {
      [K in keyof T as string extends K ? never : number extends K ? never : symbol extends K ? never : K]: T[K];
    };
export type RemoveIndexSignatureDeep<T> = T extends Array<infer R>
  ? Array<RemoveIndexSignatureDeep<R>>
  : {
      [K in keyof T as string extends K
        ? never
        : number extends K
        ? never
        : symbol extends K
        ? never
        : K]: RemoveIndexSignatureDeep<T[K]>;
    };
