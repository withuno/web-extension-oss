import { VisibleVaultItemBySchemaType, UpdateQuery, CreditCardItem, SchemaType } from "@/v1/uno_types";

import CreditCardItemForm from "./CreditCardItemForm";

export interface CreditCardItemEditProps {
  vaultItem: VisibleVaultItemBySchemaType<"credit_card">;
  networkBusy: boolean;
  handleUpdate(schemaType: SchemaType, q: UpdateQuery<CreditCardItem>): Promise<void>;
  handleClickDelete(e: React.MouseEvent): void;
  handleClickBack(): void;
}

export default function CreditCardItemEdit(props: CreditCardItemEditProps) {
  function handleSave(q: UpdateQuery<CreditCardItem>) {
    props
      .handleUpdate("credit_card", q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX:
      });
  }

  return (
    <CreditCardItemForm
      title="Edit a credit card"
      networkBusy={props.networkBusy}
      vaultItem={props.vaultItem}
      handleClickBack={props.handleClickBack}
      handleSave={handleSave}
      handleDelete={props.handleClickDelete}
    />
  );
}
