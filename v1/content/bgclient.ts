import { messageToJSON, messageFromJSON, Vault, VisibleVaultItem } from "../uno_types";

export function vault(): Promise<Vault> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(messageToJSON({ kind: "GET_SITE_ITEMS" }), (res) => {
      try {
        const message = messageFromJSON(res);

        switch (message.kind) {
          case "SITE_ITEMS_SUCCESS_OUT_OF_DATE":
          case "SITE_ITEMS_SUCCESS":
            return resolve(message.payload);
          case "ERROR":
            console.error(new Error(JSON.stringify(message.payload)));
            throw new Error(`${message.payload}`);
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (err) {
        console.log(err);
        reject(err);
      }
    });
  });
}

export function getVaultItemById(id: string): Promise<VisibleVaultItem> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(messageToJSON({ kind: "GET_VAULT_ITEM", payload: id }), (res) => {
      try {
        console.log(`getVaultItemById: res: `, res);
        const message = messageFromJSON(res);

        switch (message.kind) {
          case "GET_VAULT_ITEM_SUCCESS":
            return resolve(message.payload);
          case "ERROR":
            console.error(new Error(JSON.stringify(message.payload)));
            throw new Error(`${message.payload}`);
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (err) {
        console.log(err);
        reject(err);
      }
    });
  });
}

export function getVaultItemMFAById(id: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(messageToJSON({ kind: "GET_VAULT_ITEM_MFA", payload: id }), (res) => {
      try {
        console.log(`getVaultItemMFAById: res: `, res);
        const message = messageFromJSON(res);

        switch (message.kind) {
          case "GET_VAULT_ITEM_MFA_SUCCESS":
            return resolve(message.payload);
          case "ERROR":
            console.error(new Error(JSON.stringify(message.payload)));
            throw new Error(`${message.payload}`);
          default:
            throw new Error(`Unexpected message kind ${message.kind}`);
        }
      } catch (err) {
        console.log(err);
        reject(err);
      }
    });
  });
}

export default {
  vault,
  getVaultItemById,
  getVaultItemMFAById,
};
