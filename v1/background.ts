import * as Sentry from "@sentry/browser";
import { v4 as uuidv4 } from "uuid";

import { LegacyAnalyticsEvent } from "@/v2/actions/analytics/analytics.types";
import { segment } from "@/v2/actions/analytics/segment";
import { totp, totpRolloverEdge } from "@/v2/crypto/totp";

import Logger from "./logger";
import {
  getAccessTokenFromAuthCode,
  getAuthCodeViaLaunchWebAuthFlow,
  refreshAccessToken,
  revokeAccessToken,
} from "./oauth";
import { SessionService } from "./service/session_service";
import {
  newDefaultVaultService,
  VaultServiceError,
  VaultServiceErrorKind,
  VaultService,
  Vault as VaultServiceVault,
} from "./service/vault_service/service";
import {
  clientIdFromStorage,
  storeClientId,
  storeSessionId,
  storeSessionSeed,
  sessionIdFromStorage,
  sessionSeedFromStorage,
  clearSession,
  realSeedFromStorage,
  storeRealSeed,
} from "./state";
import {
  UnoError,
  Message,
  messageToJSON,
  messageFromJSON,
  LoginItem,
  ExtensionContext,
  PopupActionState,
  VerifiedStatus,
  VisibleVaultItem,
} from "./uno_types";
import { rootDomainMatch, isSafari } from "./utils";

// @ts-expect-error: constant is overwritten by build script.
// eslint-disable-next-line
const logger = new Logger(ENV_NAME);

const LOGGER = console;

// XXX: Max schema major.
// This terrible name is because the ts expect error directive
// can't handle multiple lines, which is insane.
export const maxSch = 7; // put this in the build script

let qrScannerState = PopupActionState.Start;
let qrScannerResult: string | null = null;

let showAutofillCoolOff = false;

let extensionContext: ExtensionContext = {
  analyticsID: undefined,
  debugMode: false,
  email: undefined,
  currentLocation: null,
  siteVaultItems: [],
  addresses: [],
  creditCards: [],
  // Save login
  saveLoginShowing: false,
  saveLoginUsername: null,
  saveLoginPassword: null,
  modalTickTime: null,
  saveLoginHostname: null,
  // Save credit cards
  saveCCShowing: false,
  saveCCCardName: null,
  saveCCCardNumber: null,
  saveCCHolderName: null,
  saveCCCVC: null,
  saveCCExpiration: null,
  // Save addresses
  saveAddShowing: false,
  saveAddCity: null,
  saveAddCountry: null,
  saveAddState: null,
  saveAddStreet: null,
  saveAddLine2: null,
  saveAddZip: null,
  // Magic login
  magicLoginShowing: false,
  magicLoginInitiated: false,
  magicLoginAccountSelected: null,
  magicLoginSSOChoice: null,
  userNameInputted: false,
  passwordInputted: false,
  submitButtonClicked: false,
  mfaCodeEntered: false,
  // AI Assist
  aiAssistShowing: false,
  aiAssistHeaderText: "",
  aiAssistTopic: "",
  aiAssistDomain: null,
  aiAssistInstructions: null,
  // Missing info
  missingInfoShowing: false,
  // Update login
  updateLoginShowing: false,
  // SSO Remembering
  saveSSOShowing: false,
  saveSSOChoice: null,
  // Gmail scanning
  gmailScannerSetup: false,
  gmailToken: null,
  googleAuthError: false,
  gmailIDsShown: [],
};

export async function withDefaultVaultService(seed: string, client_id: string, cb: (v: VaultService) => Promise<any>) {
  const service = newDefaultVaultService(
    // @ts-expect-error: constant is overwritten by build script.
    API_SERVER,
    seed,
    client_id,
    maxSch,
    logger,
  );

  await cb(service);
}

export function getSiteItems(
  vaultService: VaultService,
  host: string,
  force_sync?: boolean,
): Promise<VaultServiceVault> {
  return vaultService.getVault(force_sync).then(function (vault) {
    return {
      email: vault.email,
      addresses: vault.addresses,
      creditCards: vault.creditCards,
      privateKeys: vault.privateKeys,
      notes: vault.notes,
      uuid: vault.uuid,
      schema_major: vault.schema_major,
      schema_minor: vault.schema_minor,
      refreshTokens: vault.refreshTokens,
      items: vault.items
        .filter(function (v) {
          return (
            v.matching_hosts.find(function (h) {
              return rootDomainMatch(h, host);
            }) !== undefined
          );
        })
        .map(function (v) {
          return {
            ...v,
            hasPassword: v.password !== undefined,
            hasOtpSeed: v.otpSeed !== undefined,
          };
        }),
    };
  });
}

export async function analytics_identify(service: VaultService, verified?: VerifiedStatus) {
  try {
    const vault = await service.getVault();

    if (typeof verified === "undefined") {
      verified = await service.getVerifiedStatus();
    }

    if (vault.uuid !== undefined) {
      segment.identify(vault.uuid, {
        email: vault.email,
        verified: verified == VerifiedStatus.Verified,
      });
    }
  } catch (e) {
    console.error("Analytics identification failed", e);
  }
}

async function handle_create_vault(email: string | null): Promise<Message> {
  const client_id = uuidv4();

  const new_seed = new Uint8Array(32);
  // XXX: does this need some kind of sanitization
  window.crypto.getRandomValues(new_seed);

  // https://developer.mozilla.org/en-US/docs/Web/API/btoa
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += String.fromCharCode(new_seed[i]);
  }

  const bseed = window.btoa(result);

  try {
    await withDefaultVaultService(bseed, client_id, async (service: VaultService) => {
      let ok: boolean;

      try {
        ok = await service.createVault(email || undefined);
      } catch (e) {
        return Promise.reject(handle_vault_service_error(e as VaultServiceError));
      }

      if (ok) {
        await storeRealSeed(bseed);
        await storeClientId(client_id);

        await analytics_identify(service);

        return Promise.resolve();
      }

      return Promise.reject(UnoError.Unknown);
    });
  } catch (e) {
    return { kind: "ERROR", payload: e as UnoError };
  }

  return { kind: "CREATE_VAULT_SUCCESS" };
}

async function handle_native_bootstrap(): Promise<Message> {
  const rpc = {
    type: "rpc",
    func: "getUnoSeed",
  };

  const completion = async function (res: any): Promise<Message> {
    const native_seed_64 = res.values.seed;
    if (native_seed_64 == null) {
      return { kind: "ERROR", payload: UnoError.NeedsOnboard };
    }

    const client_id = uuidv4();
    await storeClientId(client_id);
    await storeRealSeed(native_seed_64);

    await withDefaultVaultService(native_seed_64, client_id, async (service: VaultService) => {
      await analytics_identify(service);
    });

    return { kind: "SESSION_RECOVERED" };
  };

  if (isSafari()) {
    try {
      // @ts-expect-error browser is only available in safari
      const result = await browser.runtime.sendNativeMessage("application.id", rpc);

      if (result.type === "error") {
        logger.error(result);
        return { kind: "ERROR", payload: UnoError.NeedsOnboard };
      }

      logger.info("Native seed found");
      return completion(result);
    } catch (error) {
      logger.error(error);
      return { kind: "ERROR", payload: UnoError.NeedsOnboard };
    }
  } else {
    return new Promise((resolve) => {
      // @ts-expect-error: constant is overwritten by build script.
      // eslint-disable-next-line
      chrome.runtime.sendNativeMessage(NATIVE_HOST_ID, rpc, (result: any) => {
        if (chrome.runtime.lastError || result == undefined) {
          logger.error(chrome.runtime.lastError);
          resolve({ kind: "ERROR", payload: UnoError.NeedsOnboard });

          return;
        }
        resolve(completion(result));
      });
    });
  }
}

async function handle_share_seed(service: SessionService): Promise<Message> {
  try {
    const seed = await realSeedFromStorage();
    if (seed === null) {
      return { kind: "ERROR", payload: UnoError.NeedsOnboard };
    }

    const bseed = await service.shareSeed(seed);

    return { kind: "SESSION_CREATED", payload: bseed };
  } catch (e) {
    LOGGER.error(e);

    return { kind: "ERROR", payload: UnoError.Unknown };
  }
}

async function handle_start_session(service: SessionService): Promise<Message> {
  try {
    const [session_id, bseed] = await service.createSession(window.crypto);

    await storeSessionSeed(bseed);
    await storeSessionId(session_id);

    return { kind: "SESSION_CREATED", payload: bseed };
  } catch (e) {
    LOGGER.error(e);

    return { kind: "ERROR", payload: UnoError.Unknown };
  }
}

export function handle_vault_service_error(e: VaultServiceError): UnoError {
  switch (e.kind) {
    case VaultServiceErrorKind.Unauthorized:
    case VaultServiceErrorKind.NotFound:
      return UnoError.NeedsOnboard;
    case VaultServiceErrorKind.NeedsSync:
      return UnoError.VaultNeedsSync;
    case VaultServiceErrorKind.NetworkError:
      return UnoError.NetworkError;
    case VaultServiceErrorKind.FatalError:
      return UnoError.Unknown;
    case VaultServiceErrorKind.SchemaValidation:
      Sentry.captureException(new Error(e.errors.map((v) => JSON.stringify(v)).join(",")));
      return UnoError.ClientOutOfDate;
    case VaultServiceErrorKind.ClientOutOfDate:
      return UnoError.ClientOutOfDate;
  }
}

async function handle_get_session(service: SessionService): Promise<Message> {
  try {
    const stored_session_id = await sessionIdFromStorage();
    const stored_session_seed = await sessionSeedFromStorage();

    const result = await service.recoverRealSeed(stored_session_id, stored_session_seed);

    if (result === undefined) {
      return { kind: "SESSION_RECOVERY_PENDING" };
    }

    const client_id = uuidv4();
    await storeClientId(client_id);
    await storeRealSeed(result);

    await withDefaultVaultService(result, client_id, async (service: VaultService) => {
      await analytics_identify(service);
    });

    return { kind: "SESSION_RECOVERED" };
  } catch (e: any) {
    logger.error(e);
    // error casting ?
    return { kind: "ERROR", payload: e };
  }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // This needs to work with both tsc type checking *as well as*
  // the define plugins that rewrite API_SERVER to the correct api server.
  // @ts-expect-error: constant is overwritten by build script.
  // eslint-disable-next-line
  const sessionService = new SessionService(API_SERVER);

  const msg = messageFromJSON(request);

  // Ignore V2 messages
  if (msg.kind.startsWith("v2")) {
    return;
  }

  switch (msg.kind) {
    case "GET_QR_SCANNER_STATE":
      return sendResponse(
        messageToJSON({
          kind: "QR_SCANNER_STATE_RESPONSE",
          payload: { state: qrScannerState, result: qrScannerResult },
        }),
      );
    case "INJECT_QR_SCANNER":
      qrScannerResult = null;
      qrScannerState = PopupActionState.Requested;

      // TODO: (MANIFEST_V3) change to `chrome.scripting.executeScript`
      // @see https://developer.chrome.com/docs/extensions/migrating/api-calls/#replace-executescript
      chrome.tabs.executeScript(
        {
          file: "content/qr_scanner.js",
        },
        function () {
          if (chrome.runtime.lastError !== undefined) {
            qrScannerResult = null;
            qrScannerState = PopupActionState.Failed;
          }
        },
      );

      return sendResponse(messageToJSON({ kind: "NOOP" }));
    case "NO_QR_FOUND":
      qrScannerResult = null;
      qrScannerState = PopupActionState.Failed;

      return sendResponse(messageToJSON({ kind: "NOOP" }));
    case "FOUND_QR":
      qrScannerState = PopupActionState.Succeeded;
      qrScannerResult = msg.payload;
      return sendResponse(messageToJSON({ kind: "NOOP" }));
    case "NOOP":
      return sendResponse(messageToJSON({ kind: "NOOP" }));
    case "SHOW_ONBOARD":
      return tryOnboard(true);
    case "GET_AUTH_TOKEN":
      logger.info("safari?", isSafari());
      // If it's interactive and we have a token, clear it first
      {
        const onSafari = isSafari();
        if (msg.interactive && extensionContext.gmailToken && !onSafari) {
          chrome.identity.removeCachedAuthToken({ token: extensionContext.gmailToken }, function () {
            getAuthTokenAndSendResponse(onSafari, extensionContext, msg.interactive).then((exctx) => {
              extensionContext = exctx;
              return sendResponse(
                messageToJSON({
                  kind: "GOOGLE_TOKEN_RESP",
                  payload: extensionContext,
                }),
              );
            });
          });
        } else if (msg.interactive && extensionContext.gmailToken && onSafari) {
          logger.info("removing token first!");
          const rpc = {
            type: "rpc",
            func: "removeCachedAuthToken",
            args: {
              details: {
                token: extensionContext.gmailToken,
              },
            },
          };
          logger.info("Sending rpc:");
          logger.info(rpc);
          // @ts-expect-error: browser is only available in safari
          browser.runtime.sendNativeMessage("application.id", rpc, function (response: any) {
            logger.info("Received native rpc response:");
            logger.info(response);

            logger.info("moving forward with get auth token");
            getAuthTokenAndSendResponse(onSafari, extensionContext, msg.interactive).then((exctx) => {
              extensionContext = exctx;
              logger.info("sending resp", extensionContext);
              return sendResponse(
                messageToJSON({
                  kind: "GOOGLE_TOKEN_RESP",
                  payload: extensionContext,
                }),
              );
            });
          });
          // Interactive and no gmail token, just get token
        } else if (msg.interactive === true && extensionContext.gmailToken === null) {
          getAuthTokenAndSendResponse(onSafari, extensionContext, msg.interactive).then((exctx) => {
            extensionContext = exctx;
            return sendResponse(
              messageToJSON({
                kind: "GOOGLE_TOKEN_RESP",
                payload: extensionContext,
              }),
            );
          });

          // If it's not interactive and the scanner is setup, try and just get the token (this is for the popup when it first loads)
        } else if (msg.interactive === false && extensionContext.gmailScannerSetup) {
          getAuthTokenAndSendResponse(onSafari, extensionContext, msg.interactive).then((exctx) => {
            extensionContext = exctx;
            return sendResponse(
              messageToJSON({
                kind: "GOOGLE_TOKEN_RESP",
                payload: extensionContext,
              }),
            );
          });
        } else if (msg.interactive === true && extensionContext.gmailScannerSetup === false) {
          getAuthTokenAndSendResponse(onSafari, extensionContext, msg.interactive).then((exctx) => {
            extensionContext = exctx;
            return sendResponse(
              messageToJSON({
                kind: "GOOGLE_TOKEN_RESP",
                payload: extensionContext,
              }),
            );
          });
        }

        return sendResponse(
          messageToJSON({
            kind: "GOOGLE_TOKEN_RESP",
            payload: extensionContext,
          }),
        );
      }

      break;
    case "TURN_OFF_GMAIL_SCANNER":
      chrome.storage.sync.set({ gmailScannerSetup: false }, async function () {
        if (extensionContext.gmailToken) {
          const onSafari = isSafari();
          if (onSafari) {
            const rpc = {
              type: "rpc",
              func: "removeCachedAuthToken",
              args: {
                details: {
                  token: extensionContext.gmailToken,
                },
              },
            };
            logger.info("Sending rpc:");
            logger.info(rpc);
            // @ts-expect-error: browser is only available in safari
            browser.runtime.sendNativeMessage("application.id", rpc, (response: unknown) => {
              logger.info("Received native rpc response:");
              logger.info(response);
              extensionContext.gmailScannerSetup = false;
              extensionContext.googleAuthError = false;
              extensionContext.gmailToken = null;
              return sendResponse(
                messageToJSON({
                  kind: "TURN_OFF_GMAIL_SCANNER_SUCCESS",
                  payload: extensionContext,
                }),
              );
            });
          } else if (chrome.identity.removeCachedAuthToken) {
            chrome.identity.removeCachedAuthToken({ token: extensionContext.gmailToken }, function () {
              extensionContext.gmailScannerSetup = false;
              extensionContext.googleAuthError = false;
              extensionContext.gmailToken = null;
              return sendResponse(
                messageToJSON({
                  kind: "TURN_OFF_GMAIL_SCANNER_SUCCESS",
                  payload: extensionContext,
                }),
              );
            });
          } else {
            extensionContext.gmailScannerSetup = false;
            extensionContext.googleAuthError = false;
            extensionContext.gmailToken = null;

            // @ts-expect-error: constant is overwritten by build script.
            // eslint-disable-next-line
            const clientId = CLIENT_ID_WEB_AUTH_FLOW;

            // Try and revoke the access token
            try {
              const authCodeAfterRevoke = await getAuthCodeViaLaunchWebAuthFlow(clientId, false);
              const accessTokenResp = await getAccessTokenFromAuthCode(authCodeAfterRevoke, clientId);
              await revokeAccessToken(accessTokenResp.access_token);
            } catch (error) {
              logger.error("Couldn't revoke access token in TURN_OFF_GMAIL_SCANNER", error);
            }

            return sendResponse(
              messageToJSON({
                kind: "TURN_OFF_GMAIL_SCANNER_SUCCESS",
                payload: extensionContext,
              }),
            );
          }
        }
      });

      break;
    case "CREATE_VAULT":
      handle_create_vault(msg.payload).then(function (m) {
        return sendResponse(messageToJSON(m));
      });

      return true;
    case "TRANSFER_SHARE":
      sessionService
        .seedFromPhrase(msg.payload)
        .then(function (seed) {
          const client_id = uuidv4();

          return withDefaultVaultService(seed, client_id, async (service: VaultService) => {
            await storeClientId(client_id);
            await storeRealSeed(seed);

            await analytics_identify(service);
          });
        })
        .then(function () {
          return sendResponse(messageToJSON({ kind: "SESSION_RECOVERED" }));
        })
        .catch(function (e) {
          return sendResponse(
            messageToJSON({
              kind: "ERROR",
              payload: e,
            }),
          );
        });

      return true;

    case "SHARE_SEED":
      handle_share_seed(sessionService).then(function (m) {
        return sendResponse(messageToJSON(m));
      });

      return true;
    case "START_SESSION":
      handle_start_session(sessionService).then(function (m) {
        return sendResponse(messageToJSON(m));
      });

      return true;
    case "NATIVE_BOOTSTRAP":
      handle_native_bootstrap().then(function (m) {
        return sendResponse(messageToJSON(m));
      });

      return true;
    case "GET_SESSION":
      handle_get_session(sessionService).then(function (m) {
        return sendResponse(messageToJSON(m));
      });

      return true;

    case "GET_EMAIL_STATUS": {
      sessionService
        .getEmailStatus(msg.payload)
        .then(function (s) {
          return sendResponse(
            messageToJSON({
              kind: "EMAIL_STATUS_SUCCESS",
              payload: s,
            }),
          );
        })
        .catch(function (e) {
          return sendResponse(
            messageToJSON({
              kind: "ERROR",
              payload: handle_vault_service_error(e as VaultServiceError),
            }),
          );
        });

      return true;
    }
  }

  // XXX: it probably doesn't make sense to have more message switching
  // inside of the callback here...
  realSeedFromStorage().then(async function (seed) {
    if (seed === null) return sendResponse(messageToJSON({ kind: "ERROR", payload: UnoError.NeedsOnboard }));

    const clientId = await clientIdFromStorage();
    if (clientId === undefined) return sendResponse(messageToJSON({ kind: "ERROR", payload: UnoError.NeedsOnboard }));

    try {
      await withDefaultVaultService(seed, clientId, async (vaultService: VaultService) => {
        switch (msg.kind) {
          case "START_EMAIL_VERIFY":
            await vaultService.startVerifyEmail();

            return sendResponse(messageToJSON({ kind: "START_EMAIL_VERIFY_SUCCESS" }));
          case "GET_VERIFIED_STATUS": {
            const item = await vaultService.getVerifiedStatus();

            analytics_identify(vaultService, item);

            return sendResponse(
              messageToJSON({
                kind: "VERIFIED_STATUS_SUCCESS",
                payload: item,
              }),
            );
          }
          case "UPDATE_VAULT_EMAIL":
            if (msg.payload.length > 0) {
              await vaultService.updateVaultEmail(msg.payload);
            }

            return sendResponse(messageToJSON({ kind: "UPDATE_VAULT_EMAIL_SUCCESS" }));

          case "UPDATE_VAULT_ITEM": {
            const item = await vaultService.updateVaultItem(msg.payload.schema_type, msg.payload.item);

            return sendResponse(messageToJSON({ kind: "VAULT_ACTION_SUCCESS", payload: item }));
          }
          case "CREATE_VAULT_ITEM": {
            const item = await vaultService.createVaultItem(msg.payload.schema_type, msg.payload.item);

            return sendResponse(messageToJSON({ kind: "VAULT_ACTION_SUCCESS", payload: item }));
          }
          case "DELETE_VAULT_ITEM": {
            const item = await vaultService.deleteVaultItem(msg.payload);

            return sendResponse(messageToJSON({ kind: "VAULT_ACTION_SUCCESS", payload: item }));
          }
          case "REMOVE_ACCOUNT": {
            // XXX rename to clearCache..
            vaultService.clearLocalVault();
            clearSession();

            return sendResponse(messageToJSON({ kind: "ERROR", payload: UnoError.NeedsOnboard }));
          }
          case "GET_VAULT_EMAIL": {
            const email = await vaultService.getVaultEmail();

            return sendResponse(
              messageToJSON({
                kind: "GET_VAULT_EMAIL_SUCCESS",
                payload: email,
              }),
            );
          }
          case "GET_VAULT_RAW":
            const vault = await vaultService.getRawVault();

            return sendResponse(
              messageToJSON({
                kind: "GET_VAULT_RAW_SUCCESS",
                payload: vault,
              }),
            );

          case "GET_VAULT": {
            let vault: VaultServiceVault;
            try {
              vault = await vaultService.getVault();
            } catch (e) {
              return sendResponse(
                messageToJSON({
                  kind: "ERROR",
                  payload: handle_vault_service_error(e as VaultServiceError),
                }),
              );
            }

            const allVaultItems = [
              ...vault.items.map((v) => ({
                ...v,
                schema_type: "login",
                hasPassword: v.password !== undefined,
                hasOtpSeed: v.otpSeed !== undefined,
              })),

              ...(vault.creditCards || []).map((v) => ({
                ...v,
                schema_type: "credit_card",
              })),

              ...(vault.addresses || []).map((v) => ({
                ...v,
                schema_type: "address",
              })),

              ...(vault.privateKeys || []).map((v) => ({
                ...v,
                schema_type: "private_key",
              })),

              ...(vault.notes || []).map((v) => ({
                ...v,
                schema_type: "secure_note",
              })),
            ].map((v) => {
              return {
                ...v,
                logo_name: undefined,
                brand_color: undefined,
                fallback_img: undefined,
                inset_x: undefined,
                inset_y: undefined,
              } as VisibleVaultItem;
            });

            // TODO: this shoule be controlled by vaultService.maybeValidate
            if (vault.schema_major !== undefined && vault.schema_major > maxSch) {
              return sendResponse(
                messageToJSON({
                  kind: "GET_VAULT_SUCCESS_OUT_OF_DATE",
                  payload: allVaultItems,
                }),
              );
            }

            return sendResponse(
              messageToJSON({
                kind: "GET_VAULT_SUCCESS",
                payload: allVaultItems,
              }),
            );
          }

          case "GET_VAULT_ITEM": {
            const item = await vaultService.getVaultItem(msg.payload);

            return sendResponse(
              messageToJSON({
                kind: "GET_VAULT_ITEM_SUCCESS",
                payload: item,
              }),
            );
          }

          case "GET_VAULT_ITEM_MFA": {
            const item = await vaultService.getVaultItem(msg.payload);

            if (item.schema_type !== "login" || item.otpSeed === undefined) {
              return sendResponse(
                messageToJSON({
                  kind: "ERROR",
                  payload: UnoError.MissingTOTP,
                }),
              );
            }

            const bytes = atob(item.otpSeed);
            const buf = new ArrayBuffer(bytes.length);
            const bufView = new Uint8Array(buf);

            for (let i = 0; i < bytes.length; i++) {
              bufView[i] = bytes.charCodeAt(i);
            }

            await totpRolloverEdge();
            const code = await totp(buf, Math.floor(Date.now() / 1000));

            return sendResponse(
              messageToJSON({
                kind: "GET_VAULT_ITEM_MFA_SUCCESS",
                payload: code,
              }),
            );
          }
          case "GET_SITE_ITEMS":
            {
              if (sender.url === undefined) {
                return sendResponse(messageToJSON({ kind: "ERROR", payload: UnoError.Unknown }));
              }

              const senderUrl = new URL(sender.url);
              if (senderUrl.protocol != "https:") {
                return sendResponse(messageToJSON({ kind: "ERROR", payload: UnoError.Unknown }));
              }

              getSiteItems(vaultService, senderUrl.host).then(function (filtered_vault) {
                if (filtered_vault.schema_major !== undefined && filtered_vault.schema_major > maxSch) {
                  sendResponse(
                    messageToJSON({
                      kind: "SITE_ITEMS_SUCCESS_OUT_OF_DATE",
                      payload: filtered_vault.items,
                    }),
                  );
                }

                sendResponse(
                  messageToJSON({
                    kind: "SITE_ITEMS_SUCCESS",
                    payload: filtered_vault.items,
                  }),
                );
              });
            }

            return true;
          case "CREATE_ANALYTICS_EVENT":
            new Promise(function () {
              return segment.track(msg.eventType);
            });

            return true;
          case "GET_EXTENSION_CONTEXT":
            chrome.storage.sync.get(["gmailScannerSetup"], function (result) {
              if (result !== undefined) {
                extensionContext.gmailScannerSetup = result.gmailScannerSetup;
              } else {
                extensionContext.gmailScannerSetup = false;
              }

              // Get vault items for this location
              // The iframe script is getting the extension context every second
              // so we want to be careful not to slam our api
              if (msg.updateVault) {
                extensionContext.currentLocation = msg.currentLocation;

                getSiteItems(vaultService, extensionContext.currentLocation.hostname)
                  .then(function (vaultItems) {
                    extensionContext.addresses = vaultItems.addresses || [];
                    extensionContext.creditCards = vaultItems.creditCards || [];
                    extensionContext.siteVaultItems = vaultItems.items;
                    extensionContext.email = vaultItems.email;
                    extensionContext.analyticsID = vaultItems.uuid;
                    // Call identify on page load
                    return analytics_identify(vaultService);
                  })
                  .then(function () {
                    return sendResponse(
                      messageToJSON({
                        kind: "GET_EXTENSION_CONTEXT_SUCCESS",
                        extensionContext,
                      }),
                    );
                  });
              } else {
                return sendResponse(
                  messageToJSON({
                    kind: "GET_EXTENSION_CONTEXT_SUCCESS",
                    extensionContext,
                  }),
                );
              }
            });

            return true;
          case "SHOW_FEEDBACK_FROM_POPUP":
            return chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
              if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, messageToJSON({ kind: "SHOW_FEEDBACK_FROM_POPUP" }));
              }
            });
          case "UPDATE_EXTENSION_CONTEXT":
            extensionContext = msg.extensionContext;
            if (extensionContext.debugMode) {
              if (isSafari()) {
                const msg = {
                  type: "echo",
                  what: "Dost await mine eloqui?",
                };
                logger.info("Sending echo message:");
                logger.info(msg);
                // @ts-expect-error: browser is only available in safari
                browser.runtime.sendNativeMessage("application.id", msg, (response: any) => {
                  logger.info("Received native echo response:");
                  logger.info(response);
                });
              }
            }

            // If tell content script is set, send a message to the content script to update it's extension context
            if (msg.tellContentScript) {
              chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0] && tabs[0].id) {
                  chrome.tabs.sendMessage(
                    tabs[0].id,
                    messageToJSON({
                      kind: "UPDATE_CONTENT_EXTENSION_CONTEXT",
                      extensionContext,
                    }),
                    function (response) {
                      logger.info(response);
                    },
                  );
                }
              });
            }

            return sendResponse(
              messageToJSON({
                kind: "UPDATE_EXTENSION_CONTEXT_SUCCESS",
                extensionContext,
              }),
            );
          case "SAVE_LOGIN":
            {
              extensionContext = msg.extensionContext;

              // If we don't have values, don't do anything
              if (
                !extensionContext.saveLoginUsername ||
                !extensionContext.saveLoginPassword ||
                !extensionContext.saveLoginHostname
              ) {
                break;
              }

              const updatedVaultItems = await getSiteItems(vaultService, extensionContext.saveLoginHostname);
              extensionContext.siteVaultItems = updatedVaultItems.items;

              // Check if the username entered is in the vault for this site
              let vaultItemForEnteredUsername: LoginItem | null = null;
              extensionContext.siteVaultItems.forEach(async (vaultItem) => {
                if (vaultItem.username === extensionContext.saveLoginUsername && extensionContext.saveLoginPassword) {
                  vaultItemForEnteredUsername = vaultItem;

                  // Password changed, update vault item
                  if (
                    vaultItemForEnteredUsername.password !== extensionContext.saveLoginPassword &&
                    extensionContext.saveLoginHostname &&
                    vaultItem.matching_hosts.includes(extensionContext.saveLoginHostname)
                  ) {
                    await vaultService.updateLoginItem({
                      id: vaultItemForEnteredUsername.id,
                      password: extensionContext.saveLoginPassword,
                    });

                    // Update the vault state
                    const updatedVaultItems = await getSiteItems(vaultService, extensionContext.saveLoginHostname);
                    extensionContext.siteVaultItems = updatedVaultItems.items;

                    // Clear the save login state
                    extensionContext.saveLoginHostname = null;
                    extensionContext.saveLoginUsername = null;
                    extensionContext.saveLoginPassword = null;
                    extensionContext.saveLoginShowing = false;
                    extensionContext.updateLoginShowing = false;

                    return sendResponse(
                      messageToJSON({
                        kind: "SAVE_LOGIN_SUCCESS",
                        extensionContext,
                      }),
                    );
                  }
                }
              });

              // If we don't have a vault item for this site, create a new entry
              if (vaultItemForEnteredUsername === null) {
                if (extensionContext.saveLoginHostname) {
                  await vaultService.createLoginItem({
                    url: extensionContext.saveLoginHostname,
                    username: extensionContext.saveLoginUsername,
                    password: extensionContext.saveLoginPassword,
                  } as any);

                  // Update the vault state
                  let updatedVaultItems = await getSiteItems(vaultService, extensionContext.saveLoginHostname);
                  extensionContext.siteVaultItems = updatedVaultItems.items;

                  // Clear the save login state
                  extensionContext.saveLoginHostname = null;
                  extensionContext.saveLoginUsername = null;
                  extensionContext.saveLoginPassword = null;
                  extensionContext.saveLoginShowing = false;
                  extensionContext.updateLoginShowing = false;

                  if (extensionContext.saveLoginHostname) {
                    updatedVaultItems = await getSiteItems(vaultService, extensionContext.saveLoginHostname);
                    extensionContext.siteVaultItems = updatedVaultItems.items;
                  }

                  return sendResponse(
                    messageToJSON({
                      kind: "SAVE_LOGIN_SUCCESS",
                      extensionContext,
                    }),
                  );
                }
              }
            }
            break;
          case "SAVE_SSO": {
            extensionContext = msg.extensionContext;

            // If we don't have values, don't do anything
            if (!extensionContext.saveSSOChoice || !extensionContext.saveLoginHostname) {
              break;
            }

            // Get updated vault items
            const vaultItemsForSaveSSO = await getSiteItems(vaultService, extensionContext.saveLoginHostname);

            let existingSSOHolder: LoginItem | null = null;
            for (let i = 0; i < vaultItemsForSaveSSO.items.length; i++) {
              const vaultItem = vaultItemsForSaveSSO.items[i];
              if (vaultItem.ssoProvider && vaultItem.ssoProvider.length) {
                existingSSOHolder = vaultItem;
              }
            }

            // Update the existing SSO vault item
            if (existingSSOHolder !== null) {
              const existingSSOChoices = existingSSOHolder.ssoProvider.map((currentEntries) => {
                return currentEntries.provider;
              });
              // Add to SSO choices only if it's not there already
              if (existingSSOChoices.indexOf(extensionContext.saveSSOChoice) === -1) {
                existingSSOChoices.push(extensionContext.saveSSOChoice);
                await vaultService.updateLoginItem({
                  id: existingSSOHolder.id,
                  ssoProvider: [
                    ...existingSSOHolder.ssoProvider,
                    {
                      provider: extensionContext.saveSSOChoice,
                      default: false,
                      username: "",
                    },
                  ],
                });
              }
            } else {
              // Create a new SSO vault item
              await vaultService.createLoginItem({
                url: extensionContext.saveLoginHostname,
                ssoProvider: [
                  {
                    provider: extensionContext.saveSSOChoice,
                    default: false,
                    username: "",
                  },
                ],
              } as any);
            }

            extensionContext.saveLoginHostname = null;
            extensionContext.saveSSOChoice = null;
            extensionContext.saveSSOShowing = false;
            return sendResponse(
              messageToJSON({
                kind: "SAVE_SSO_SUCCESS",
                extensionContext,
              }),
            );
          }
          case "HIDE_OTHER_SAVE_SSO":
            chrome.tabs.query({ active: true }, function (tabs) {
              tabs.forEach((tab) => {
                if (tab.id) {
                  chrome.tabs.sendMessage(
                    tab.id,
                    messageToJSON({
                      kind: "HIDE_SAVE_SSO",
                      payload: msg.currentLocation,
                    }),
                    function () {},
                  );
                }
              });
            });
            break;
          // Add 2FA from scanned QR code to vault item
          case "SAVE_2FA_EXISTING_ACCOUNT":
            // If we don't have values, don't do anything
            if (
              msg.seed === undefined ||
              msg.vaultItemID === undefined ||
              msg.seed.length === 0 ||
              msg.vaultItemID.length === 0
            ) {
              return sendResponse(
                messageToJSON({
                  kind: "SAVE_2FA_EXISTING_ACCOUNT_FAIL",
                }),
              );
            }

            try {
              await vaultService.updateLoginItem({
                id: msg.vaultItemID,
                otpSeed: msg.seed,
              });
              if (extensionContext && extensionContext.currentLocation) {
                const updatedVaultItems = await getSiteItems(vaultService, msg.currentLocation.hostname);

                extensionContext.siteVaultItems = updatedVaultItems.items;
              }

              return sendResponse(
                messageToJSON({
                  kind: "SAVE_2FA_EXISTING_ACCOUNT_SUCCESS",
                  extensionContext,
                }),
              );
            } catch (error) {
              logger.error("Update vault failed while saving otp secret!  Storing in the user's browser", error);
              localStorage.setItem(msg.vaultItemID, msg.seed);
            }
            return sendResponse(
              messageToJSON({
                kind: "SAVE_2FA_EXISTING_ACCOUNT_FAIL",
              }),
            );
          case "SAVE_CREDIT_CARD":
            vaultService.addCreditCardToVault(msg.creditCard);
            return sendResponse(
              messageToJSON({
                kind: "SAVE_CREDIT_CARD_SUCCESS",
              }),
            );

          case "SAVE_ADDRESS":
            vaultService.addAddressToVault(msg.address);
            return sendResponse(
              messageToJSON({
                kind: "SAVE_CREDIT_CARD_SUCCESS",
              }),
            );
          // Send a message to iframes to do credit card autofill
          case "DO_CC_AUTOFILL_IN_IFRAME":
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
              if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(
                  tabs[0].id,
                  messageToJSON({
                    kind: "DO_CC_AUTOFILL_IN_IFRAME",
                    payload: msg.payload,
                  }),
                  function () {},
                );
              }
            });
            break;

          case "SHOW_AUTOFILL_MODAL":
            // update extension context
            extensionContext = msg.payload;
            // Since there could be multiple iframes on the page to call this, we want to be careful
            // not to call it a bunch of times in a short period
            if (showAutofillCoolOff === false) {
              chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (tabs[0] && tabs[0].id) {
                  chrome.tabs.sendMessage(
                    tabs[0].id,
                    messageToJSON({
                      kind: "SHOW_AUTOFILL_MODAL",
                      payload: msg.payload,
                    }),
                    function () {},
                  );
                }
              });

              showAutofillCoolOff = true;
              setTimeout(() => {
                showAutofillCoolOff = false;
              }, 2000);
            }
            break;

          case "GET_AI_ASSIST_RESPONSE": {
            const success = (steps: string[], action_url: string) => {
              return sendResponse(
                messageToJSON({
                  kind: "GET_AI_ASSIST_RESPONSE_SUCCESS",
                  steps,
                  action_url,
                }),
              );
            };

            const fail = () => {
              return sendResponse(
                messageToJSON({
                  kind: "GET_AI_ASSIST_RESPONSE_FAILURE",
                }),
              );
            };

            try {
              const { steps, action_url } = await vaultService.getAiAssistHelpText(msg.topic, msg.domain);
              if (steps?.length && !!action_url) {
                return success(steps, action_url);
              }
              return fail();
            } catch {
              return fail();
            }
          }
        }
      });
    } catch (e) {
      // TODO: this should be for all other uncaught errors, not vault service
      // errors.
      return sendResponse(
        messageToJSON({
          kind: "ERROR",
          payload: handle_vault_service_error(e as VaultServiceError),
        }),
      );
    }
  });

  return true;
});

function tryOnboard(force: boolean) {
  if (force) {
    chrome.tabs.create({ url: chrome.runtime.getURL("onboard.html") });
    return;
  }

  realSeedFromStorage()
    .then(function (seed) {
      if (seed === null) {
        chrome.tabs.create({ url: chrome.runtime.getURL("onboard.html") });
      }
    })
    .catch(function (e) {
      LOGGER.log(`tryOnboard: `, e);
    });
}

chrome.webNavigation.onDOMContentLoaded.addListener(function (details) {
  qrScannerResult = null;
  qrScannerState = PopupActionState.Start;

  if (details.frameId != 0) return;

  LOGGER.log("uno: DOM loaded");

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // activeTab only
    if (tabs.length != 1) return;

    // active tab is navigation event tab
    if (tabs[0].id !== details.tabId) return;

    // https only
    if (new URL(details.url).protocol != "https:") return;
  });
});

chrome.runtime.onInstalled.addListener(async function (details) {
  switch (details.reason) {
    case "install":
    default: {
      segment.track(LegacyAnalyticsEvent.ExtensionInstalled);
      return tryOnboard(false);
    }
  }
});

chrome.runtime.setUninstallURL("https://forms.gle/TL2Li3VBx4FsrbCe9", () => {
  logger.info("Uninstall link set");
});

interface NativeMessageResponse {
  type: string;
  values?: {
    token?: string;
  };
}

async function handleSafariAuth(extensionContext: ExtensionContext, interactive: boolean): Promise<ExtensionContext> {
  const rpc = {
    type: "rpc",
    func: "getAuthToken",
    args: {
      details: {
        interactive,
      },
    },
  };
  logger.info("Sending rpc:");
  logger.info(rpc);

  const response = await new Promise<NativeMessageResponse>((resolve) =>
    // @ts-expect-error: browser is only available in safari
    browser.runtime.sendNativeMessage("application.id", rpc, resolve),
  );

  if (response.type === "error") {
    extensionContext.gmailToken = null;
    extensionContext.googleAuthError = true;

    logger.error("got error during rpc!", response);
    return extensionContext;
  }

  if (response.values && response.values.token) {
    await setChromeStorageSync("gmailScannerSetup", true);
    extensionContext.gmailScannerSetup = true;
    extensionContext.googleAuthError = false;
    extensionContext.gmailToken = response.values.token;
    return extensionContext;
  }
  return extensionContext;
}

async function handleChromeIdentityAuth(
  extensionContext: ExtensionContext,
  interactive: boolean,
): Promise<ExtensionContext> {
  const token = await new Promise<string | null>((resolve) =>
    chrome.identity.getAuthToken({ interactive }, resolve as any),
  );

  if (chrome.runtime.lastError) {
    // Something went wrong
    console.warn(`Whoops.. ${chrome.runtime.lastError.message}`);
    extensionContext.gmailToken = null;
    extensionContext.googleAuthError = true;

    return extensionContext;
  }

  await setChromeStorageSync("gmailScannerSetup", true);

  extensionContext.gmailScannerSetup = true;
  extensionContext.googleAuthError = false;
  extensionContext.gmailToken = token;
  return extensionContext;
}

async function handleWebAuthFlow(extensionContext: ExtensionContext, interactive: boolean): Promise<ExtensionContext> {
  // We need to store the refresh token, etc. in the vault because you only get the refresh token on first login
  // If a user switches devices (desktop --> laptop), they'll have to re-login because they won't have an access token.
  // Then when they switch back, same thing.

  // Get vault and check if we have a refresh token
  const vaultService = await getVaultService();
  const vault = await vaultService.getVault();
  if (!vault.refreshTokens) {
    vault.refreshTokens = [];
  }

  // Check if we have a refresh token in the vault for the web auth flow client id
  // @ts-expect-error: constant is overwritten by build script.
  // eslint-disable-next-line
  const clientId = CLIENT_ID_WEB_AUTH_FLOW;
  let vaultRefreshToken: string | null = null;
  vault.refreshTokens.forEach((rt) => {
    if (rt.clientId === clientId) {
      vaultRefreshToken = rt.refreshToken;
    }
  });

  // Cases:
  // A: We have an access token
  //    All cases:
  //        Set the access token on extension context
  //    A1. We have a refresh token in vault
  //        Happy path. Set the access token on extension context.
  //    A2. We have a refresh token on the response
  //        Set the refresh token in the vault, set the access token on extension context
  //    A3. We don't have a refresh token (interactive)
  //        Revoke token, store refresh token, set access token.
  //    A4. We don't have a refresh token (non-interactive)
  //        Set access token on response.  The content script will set an error when the token expires, which will put us into B1.
  // B: We don't have an access token
  //    B1. We have a refresh token
  //        Refresh token works:
  //            Use it to get an access token, set it (and forget it).
  //        Can't refresh token:
  //            Set reconnect modal to show up
  //    B2. We don't have a refresh token (interactive)
  //        Call launchWebAuthFlow, store refresh token, set access token.
  //            If can't get refresh token, set reconnect modal to show up.
  //    B3. We don't have a refresh token (non-interactive)
  //        Set reconnect modal to show up.

  // A: We have an access token
  try {
    // Get oauth2 auth code
    const authCode = await getAuthCodeViaLaunchWebAuthFlow(clientId, interactive);

    // Get access token using auth code
    const oauthResp = await getAccessTokenFromAuthCode(authCode, clientId, vaultRefreshToken);

    // All cases: Set access token on extension context
    if (oauthResp.access_token) {
      await setChromeStorageSync("gmailScannerSetup", true);
      extensionContext.gmailScannerSetup = true;
      extensionContext.googleAuthError = false;
      extensionContext.gmailToken = oauthResp.access_token;
    }

    // A1. We have a refresh token in vault
    if (vaultRefreshToken && oauthResp.access_token && !oauthResp.refresh_token) {
      return extensionContext;
    }

    // A2. We have a refresh token on the response
    if (oauthResp.refresh_token && oauthResp.access_token) {
      vaultService.addOrUpdateRefreshToken({
        clientId,
        refreshToken: oauthResp.refresh_token,
      });

      return extensionContext;
    }

    // A3. We don't have a refresh token (interactive)
    // If interactive is set to true, the user has taken an action.
    // Since the user took action, we should get them a new refresh token.
    // Revoke the token and get one.
    if (vaultRefreshToken === null && !oauthResp.refresh_token && interactive === true) {
      try {
        // 1. revoke access token
        await revokeAccessToken(oauthResp.access_token);

        // 2. get auth code (should get refresh token now)
        const authCodeAfterRevoke = await getAuthCodeViaLaunchWebAuthFlow(clientId, interactive);

        // 3. get access token
        const accessTokenResp = await getAccessTokenFromAuthCode(authCodeAfterRevoke, clientId, vaultRefreshToken);

        // 4. store access token in vault
        if (accessTokenResp.refresh_token) {
          vaultService.addOrUpdateRefreshToken({
            clientId,
            refreshToken: accessTokenResp.refresh_token,
          });

          // 5. Setup gmail scanner
          await setChromeStorageSync("gmailScannerSetup", true);
          extensionContext.gmailScannerSetup = true;
          extensionContext.googleAuthError = false;
          extensionContext.gmailToken = oauthResp.access_token;
        }
      } catch (error) {
        logger.error("Error in A3: ", error);
        extensionContext.googleAuthError = true;
      }

      return extensionContext;
    }

    // A4. We don't have a refresh token (non-interactive)
    // No refresh tokens, and no user interaction.  Set reconnect modal error
    if (vaultRefreshToken === null && !oauthResp.refresh_token && interactive === false) {
      // Set access token on response.  The content script will set an error when the token expires, which will put us into B1.
      logger.info("A4: No refresh tokens and interactive is set to false.");
    }
    // B: We don't have an access token
  } catch (error) {
    logger.error("Got error while getting auth code & access token", error);

    // If a user closes the dialog, cancel out of the flow
    if (error === "User cancelled or denied access.") {
      logger.info("user cancelled process, don't try again");
      return extensionContext;
    }

    // B1. We have a refresh token
    if (vaultRefreshToken) {
      try {
        const refreshResp = await refreshAccessToken(clientId, vaultRefreshToken);
        if (refreshResp?.access_token) {
          await setChromeStorageSync("gmailScannerSetup", true);
          extensionContext.gmailScannerSetup = true;
          extensionContext.googleAuthError = false;
          extensionContext.gmailToken = refreshResp.access_token;
          return extensionContext;
        }
        extensionContext.googleAuthError = true;
        return extensionContext;
      } catch (error) {
        logger.error("Got error while trying to refresh access token", error);
        extensionContext.googleAuthError = true;
      }
    }

    // B2. We don't have a refresh token (interactive)
    // If interactive is set to true, the user has taken an action.
    // Since the user took action, we should get them a new refresh token.
    if (vaultRefreshToken === null && interactive === true) {
      // Get auth code (should get refresh token now)
      try {
        const authCodeAfterRevoke = await getAuthCodeViaLaunchWebAuthFlow(clientId, interactive);

        // Get access token
        const accessTokenResp = await getAccessTokenFromAuthCode(authCodeAfterRevoke, clientId, vaultRefreshToken);

        if (accessTokenResp.refresh_token) {
          vaultService.addOrUpdateRefreshToken({
            clientId,
            refreshToken: accessTokenResp.refresh_token,
          });

          // 5. Setup gmail scanner
          await setChromeStorageSync("gmailScannerSetup", true);
          extensionContext.gmailScannerSetup = true;
          extensionContext.googleAuthError = false;
          extensionContext.gmailToken = accessTokenResp.access_token;
        }
      } catch (error) {
        logger.error("Error in B2: ", error);
        extensionContext.googleAuthError = true;
      }
      return extensionContext;
    }

    // B3. We don't have a refresh token (non-interactive)
    if (vaultRefreshToken === null && interactive === false) {
      extensionContext.googleAuthError = true;
    }
  }
  return extensionContext;
}

const getAuthTokenAndSendResponse = async (
  isSafari: boolean,
  extensionContext: ExtensionContext,
  interactive: boolean,
): Promise<ExtensionContext> => {
  if (isSafari) {
    return await handleSafariAuth(extensionContext, interactive);
  }
  // @ts-expect-error: ts assumes chrome.identity.getAuthToken is always available.
  if (chrome.identity.getAuthToken && !isBrave()) {
    // We fall into this block if we have access to the chrome identity api
    // Brave has access, but needs a setting switched for it to work.  Because of this, we use
    // the launchWebAuthFlow solution for Brave.
    return await handleChromeIdentityAuth(extensionContext, interactive);
  }
  return await handleWebAuthFlow(extensionContext, interactive);
};

const setChromeStorageSync = (key: string, value: unknown): Promise<void> =>
  new Promise((resolve) => chrome.storage.sync.set({ [key]: value }, () => resolve()));

async function getVaultService(): Promise<VaultService> {
  const seed = await realSeedFromStorage();

  if (seed !== null) {
    const clientId = await clientIdFromStorage();

    if (clientId !== undefined) {
      const vaultService = await new Promise<VaultService>((resolve, reject) => {
        withDefaultVaultService(seed, clientId, async (vaultService: VaultService) => {
          try {
            resolve(vaultService);
          } catch (e) {
            reject(e);
          }
        });
      });
      return vaultService;
    }
  }

  throw new Error("Could not get VaultServiceVault");
}

async function isBrave() {
  // @ts-expect-error: navigator.brave isn't recognized by the compiler
  const brave = await navigator.brave;
  return !!brave;
}
