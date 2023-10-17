import { VisibleVaultItemBySchemaType, UpdateQuery, AddressItem, SchemaType } from "@/v1/uno_types";

import AddressItemForm from "./AddressItemForm";

export interface AddressItemEditProps {
  vaultItem: VisibleVaultItemBySchemaType<"address">;
  networkBusy: boolean;
  handleUpdate(schemaType: SchemaType, q: UpdateQuery<AddressItem>): Promise<void>;
  handleClickDelete(e: React.MouseEvent): void;
  handleClickBack(): void;
}

export default function AddressItemEditProps(props: AddressItemEditProps) {
  function handleSave(q: UpdateQuery<AddressItem>) {
    props
      .handleUpdate("address", q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX:
      });
  }

  return (
    <AddressItemForm
      title="Edit an address"
      networkBusy={props.networkBusy}
      vaultItem={props.vaultItem}
      handleClickBack={props.handleClickBack}
      handleSave={handleSave}
      handleDelete={props.handleClickDelete}
    />
  );
}
