import React, { ReactNode } from "react";

export interface WithChildren<ChildrenType = ReactNode> {
  children?: ChildrenType;
}

export interface Styleable {
  className?: string;
  style?: React.CSSProperties;
}
