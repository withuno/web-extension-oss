import { VisibleVaultItemBySchemaType, UpdateQuery, SchemaType, SecureNoteItem } from "@/v1/uno_types";

import SecureNoteItemForm from "./SecureNoteItemForm";

export interface SecureNoteItemEditProps {
  vaultItem: VisibleVaultItemBySchemaType<"secure_note">;
  networkBusy: boolean;
  handleUpdate(schemaType: SchemaType, q: UpdateQuery<SecureNoteItem>): Promise<void>;
  handleClickDelete(e: React.MouseEvent): void;
  handleClickBack(): void;
}

export default function SecureNoteItemEditProps(props: SecureNoteItemEditProps) {
  function handleSave(q: UpdateQuery<SecureNoteItem>) {
    props
      .handleUpdate("secure_note", q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX:
      });
  }

  return (
    <SecureNoteItemForm
      title="Edit secure note"
      networkBusy={props.networkBusy}
      vaultItem={props.vaultItem}
      handleClickBack={props.handleClickBack}
      handleSave={handleSave}
      handleDelete={props.handleClickDelete}
    />
  );
}
