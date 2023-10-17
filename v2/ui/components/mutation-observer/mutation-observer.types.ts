export enum MutationType {
  Attributes = "attributes",
  ChildList = "childList",
  CharacterData = "characterData",
}

export interface OnChildListChange {
  (payload: { target: Node; previousSibling: Node | null; nextSibling: Node | null; child: Node }): void;
}

export interface OnContentChange {
  (payload: { from: string | null; to: string | null; target: Node }): void;
}

export interface OnAttributeChange {
  (payload: {
    from: string | null;
    to: string | null;
    name: string | null;
    namespace: string | null;
    target: Node;
  }): void;
}

export interface MutationObserverOptions {
  subtree?: boolean;
  categories?: MutationType[];
  attributeList?: string[];
  suppressAttributeOldValue?: boolean;
  suppressCharacterDataOldValue?: boolean;
  onMutation?: (payload: MutationRecord) => void;
  onChildAdded?: OnChildListChange;
  onChildRemoved?: OnChildListChange;
  onContentChange?: OnContentChange;
  onAttributeChange?: OnAttributeChange;
}
