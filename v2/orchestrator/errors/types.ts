export enum UnoErrorCode {
  /**
   * A generic error representing failed `Action` dispatches.
   */
  ActionError = "uno/v2/error/ActionError",

  /**
   * An error representing an unknown message kind was received by the
   * `UnoOrchestrator`.
   */
  UnknownMessageKind = "uno/v2/error/UnknownMessageKind",

  /**
   * An error raised by `useUnoOrchestrator` when used in a
   * React tree that has not been wrapped by `UnoOrchestratorProvider`.
   */
  OrchestratorUndefined = "uno/v2/error/OrchestratorUndefined",

  /**
   * An error thrown by `UnoOrchestrator` if an attempt is made to instantiate
   * more than one orchestrator instance inside the same execution context.
   */
  OrchestratorAlreadyInstantiated = "uno/v2/error/OrchestratorAlreadyInstantiated",

  /**
   * An error thrown by `UnoOrchestrator` if an attempt is made to access a
   * field which is not designed to be available before initialization is done.
   */
  OrchestratorNotInitialized = "uno/v2/error/OrchestratorNotInitialized",

  /**
   * An error raised by `useTabID` when is used in a
   * React tree that is rendered outside content/iframe scripts.
   */
  TabIDOnlyAvailableInForegroundScripts = "uno/v2/error/TabIDOnlyAvailableInForegroundScripts",

  /**
   * An error raised by `useTabID` when is used in a
   * React tree that is rendered outside content/iframe scripts.
   */
  NeedsOnboard = "uno/v2/error/NeedsOnboard",

  /**
   * An error raised by the `GetTOTP` action if the provided vault item ID has
   * no MFA seed.
   */
  MissingTOTP = "uno/v2/error/MissingTOTP",
}

export class UnoError<Code extends UnoErrorCode = UnoErrorCode> extends Error {
  static Code = UnoErrorCode;

  constructor(public readonly code: Code) {
    super(`[UnoError] ${code}`);
  }
}
