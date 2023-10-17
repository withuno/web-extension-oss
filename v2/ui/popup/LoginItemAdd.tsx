import React, { Fragment, useState, useEffect } from "react";

import { CreateQuery, LoginItem, SchemaType } from "@/v1/uno_types";

import LoginItemForm from "./LoginItemForm";

export interface LoginItemAddProps {
  networkBusy: boolean;
  handleCreate(schemaType: SchemaType, q: CreateQuery<LoginItem>): void;
  handleClickBack(): void;
}

export default function LoginItemAdd(props: LoginItemAddProps) {
  const [prefilledUrl, setPrefilledUrl] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(function () {
    const tabQuery = { active: true, currentWindow: true };
    chrome.tabs.query(tabQuery, function (tabs) {
      if (tabs.length == 1) {
        if (tabs[0].url !== undefined) {
          const url = new URL(tabs[0].url);
          setPrefilledUrl(url.hostname);
        }
      }

      setReady(true);
    });

    return () => {};
  }, []);

  async function handleSave(q: CreateQuery<LoginItem>) {
    try {
      await props.handleCreate("login" as SchemaType, q);
      return props.handleClickBack();
    } catch (e) {
      // keep the item open and edits visible...
    }
  }

  if (ready) {
    // show error if needed ...
    // message.payload as VisibleVaultItemBySchemaType<"login">;
    return (
      <>
        <LoginItemForm
          title="Add a login"
          networkBusy={props.networkBusy}
          prefilledUrl={prefilledUrl}
          handleClickBack={props.handleClickBack}
          handleSave={handleSave}
          handleDelete={undefined}
        />
      </>
    );
  }

  return <></>;
}
