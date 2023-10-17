import { SchemaType, CreateQuery, PrivateKeyItem } from "@/v1/uno_types";

import PrivateKeyItemForm from "./PrivateKeyItemForm";

export interface PrivateKeyItemAddProps {
  networkBusy: boolean;
  handleCreate(schemaType: SchemaType, q: CreateQuery<PrivateKeyItem>): Promise<void>;
  handleClickBack(): void;
}

export default function PrivateKeyItemAdd(props: PrivateKeyItemAddProps) {
  function handleSave(q: CreateQuery<PrivateKeyItem>) {
    props
      .handleCreate("private_key" as SchemaType, q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX
      });
  }

  return (
    <PrivateKeyItemForm
      title="Add a private key"
      vaultItem={undefined}
      networkBusy={props.networkBusy}
      handleClickBack={props.handleClickBack}
      handleSave={handleSave}
      handleDelete={undefined}
    />
  );
}
