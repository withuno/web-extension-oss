import React, { Fragment } from "react";

import { VisibleVaultItemBySchemaType, UpdateQuery, LoginItem, SchemaType } from "@/v1/uno_types";

import LoginItemForm from "./LoginItemForm";

export interface LoginItemEditProps {
  vaultItem: VisibleVaultItemBySchemaType<"login">;
  networkBusy: boolean;
  handleUpdate(schemaType: SchemaType, q: UpdateQuery<LoginItem>): Promise<void>;
  handleClickDelete(e: React.MouseEvent): void;
  handleClickBack(): void;
}

export default function LoginItemEdit(props: LoginItemEditProps) {
  function handleSave(q: UpdateQuery<LoginItem>) {
    props
      .handleUpdate("login", q)
      .then(function () {
        props.handleClickBack();
      })
      .catch(function () {
        // XXX:
      });
  }

  return (
    <>
      <LoginItemForm
        title="Edit a login"
        networkBusy={props.networkBusy}
        vaultItem={props.vaultItem}
        isAutoSecureItem={
          props.vaultItem !== undefined && props.vaultItem.url === undefined && props.vaultItem.name !== undefined
        }
        handleClickBack={props.handleClickBack}
        handleSave={handleSave}
        handleDelete={props.handleClickDelete}
      />
    </>
  );
}
