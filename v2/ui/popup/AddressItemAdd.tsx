import { SchemaType, CreateQuery, AddressItem } from "@/v1/uno_types";

import AddressItemForm from "./AddressItemForm";

export interface AddressItemAddProps {
  networkBusy: boolean;
  handleCreate(schemaType: SchemaType, q: CreateQuery<AddressItem>): Promise<void>;
  handleClickBack(): void;
}

export default function AddressItemAdd(props: AddressItemAddProps) {
  function handleSave(q: CreateQuery<AddressItem>) {
    props
      .handleCreate("address" as SchemaType, q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX
      });
  }

  return (
    <AddressItemForm
      title="Add an address"
      vaultItem={undefined}
      networkBusy={props.networkBusy}
      handleClickBack={props.handleClickBack}
      handleSave={handleSave}
      handleDelete={undefined}
    />
  );
}
