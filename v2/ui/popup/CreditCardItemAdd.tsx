import { SchemaType, CreateQuery, CreditCardItem } from "@/v1/uno_types";

import CreditCardItemForm from "./CreditCardItemForm";

export interface CreditCardItemAddProps {
  networkBusy: boolean;
  handleCreate(schemaType: SchemaType, q: CreateQuery<CreditCardItem>): Promise<void>;
  handleClickBack(): void;
}

export default function CreditCardItemAdd(props: CreditCardItemAddProps) {
  function handleSave(q: CreateQuery<CreditCardItem>) {
    props
      .handleCreate("credit_card" as SchemaType, q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX
      });
  }

  return (
    <CreditCardItemForm
      title="Add a credit card"
      networkBusy={props.networkBusy}
      handleClickBack={props.handleClickBack}
      handleSave={handleSave}
      handleDelete={undefined}
    />
  );
}
