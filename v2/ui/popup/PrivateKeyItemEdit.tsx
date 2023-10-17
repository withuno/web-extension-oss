import { VisibleVaultItemBySchemaType, UpdateQuery, PrivateKeyItem, SchemaType } from "@/v1/uno_types";

import PrivateKeyItemForm from "./PrivateKeyItemForm";

export interface PrivateKeyItemEditProps {
  vaultItem: VisibleVaultItemBySchemaType<"private_key">;
  networkBusy: boolean;
  handleUpdate(schemaType: SchemaType, q: UpdateQuery<PrivateKeyItem>): Promise<void>;
  handleClickDelete(e: React.MouseEvent): void;
  handleClickBack(): void;
}

export default function PrivateKeyItemEdit(props: PrivateKeyItemEditProps) {
  function handleSave(q: UpdateQuery<PrivateKeyItem>) {
    props
      .handleUpdate("private_key", q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX:
      });
  }

  return (
    <PrivateKeyItemForm
      title="Edit a private key"
      networkBusy={props.networkBusy}
      vaultItem={props.vaultItem}
      handleClickBack={props.handleClickBack}
      handleSave={handleSave}
      handleDelete={props.handleClickDelete}
    />
  );
}
