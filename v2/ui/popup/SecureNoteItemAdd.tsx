import { SchemaType, CreateQuery, SecureNoteItem } from "@/v1/uno_types";

import SecureNoteItemForm from "./SecureNoteItemForm";

export interface SecureNoteItemAddProps {
  networkBusy: boolean;
  handleCreate(schemaType: SchemaType, q: CreateQuery<SecureNoteItem>): Promise<void>;
  handleClickBack(): void;
}

export default function SecureNoteItemAdd(props: SecureNoteItemAddProps) {
  function handleSave(q: CreateQuery<SecureNoteItem>) {
    props
      .handleCreate("secure_note" as SchemaType, q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX
      });
  }

  return (
    <SecureNoteItemForm
      title="Add secure note"
      vaultItem={undefined}
      networkBusy={props.networkBusy}
      handleClickBack={props.handleClickBack}
      handleSave={handleSave}
      handleDelete={undefined}
    />
  );
}
