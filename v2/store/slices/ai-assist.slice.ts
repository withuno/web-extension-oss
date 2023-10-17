import { UnoOrchestrator, Zone } from "../../orchestrator";
import type { Merge, SerializedPrimitiveToType } from "../../types/essentials";
import { truthyFilter } from "../../types/type-guards";

export namespace Automation {
  /**
   * Represents the high-level status of an in-progress AI automation flow.
   */
  export type Status = "idle" | "running" | "error" | "interrupted" | "done/finish" | "done/fail";

  /**
   * Represents a granular step currently in-progress during an AI automation
   * flow.
   */
  export type Phase =
    | "idle"
    | `event/${Objective.EventName}`
    | "pulling-dom"
    | "performing-query"
    | "performing-action"
    | "waiting";

  /**
   * An object representing a previously executed action/effect in the
   * current/underway AI Assist automation.
   */
  export interface Effect<
    KnownAbilities extends AnyAbilityDefinition[] = AnyAbilityDefinition[],
    Name extends Ability.ExtractName<KnownAbilities> = Ability.ExtractName<KnownAbilities>,
  > {
    thought?: string;
    effect?: string;
    payload: Ability.Payload<KnownAbilities, Name>;
    _isSynthetic?: boolean;
  }

  /**
   * Global data representation of an ongoing/underway AI Assist automation.
   */
  export interface Task<KnownAbilities extends AnyAbilityDefinition[] = AnyAbilityDefinition[]> {
    tabID: number | null;
    objective: Objective.Type<string, KnownAbilities> | null;
    history: Effect<KnownAbilities>[];
    status: Status;
    phase: Phase;
    uiLabel: UILabel;
  }

  /**
   * Contains textual information to render inside the AI Assist modal presented
   * in the page during a workflow.
   */
  export interface UILabel {
    title: string;
    subtitle?: string;
    theme: "neutral" | "success" | "fail";
  }

  /**
   * An "objective" defines an automation workflow for the AI agent to assist
   * with.
   */
  export namespace Objective {
    export interface Type<
      Name extends string = string,
      KnownAbilities extends AnyAbilityDefinition[] = AnyAbilityDefinition[],
    > {
      name: Name;
      model: string; // Which OpenAI model to use for this flow...
      prompt?: string;
      abilities: { [P in keyof KnownAbilities]: KnownAbilities[P]["type"] };
      context: Ability.ExtractContext<KnownAbilities>;
    }

    export interface Config<
      Name extends string = string,
      KnownAbilities extends AnyAbilityDefinition[] = AnyAbilityDefinition[],
    > {
      name: Name;
      model: string | ((ctx: Ability.ExtractContext<KnownAbilities>) => string);
      abilities: KnownAbilities;
    }

    /**
     * A mapping of events to orchestrator executors onto which AI assist
     * objectives can hook into the current workflow to statically change its
     * behavior.
     *
     * For example: an objective might define a condition in which the workflow
     * fails or finishes early. Or perhaps a subset of steps in the workflow are
     * determined statically, bypassing the AI agent altogether.
     */
    export interface Events<
      Obj extends AnyObjectiveDefinition = AnyObjectiveDefinition,
      KnownAbilities extends AnyAbilityDefinition[] = AnyAbilityDefinition[],
    > {
      onStart: EventHandler<Obj, KnownAbilities, string>;
      onFinish: EventHandler<Obj, KnownAbilities>;
      onFail: EventHandler<Obj, KnownAbilities>;
      onCheckEnabledAbilities: EventHandler<Obj, KnownAbilities, Ability.ExtractTypes<KnownAbilities>>;
      onDetermineNextSteps: EventHandler<Obj, KnownAbilities, Effect | Effect[] | undefined>;
    }

    /**
     * A generic event handler function signature for use with
     * `ObjectiveDefinition` event types.
     */
    export type EventHandler<
      Obj extends AnyObjectiveDefinition,
      KnownAbilities extends AnyAbilityDefinition[],
      ReturnType = void,
    > = (
      this: Obj & { context: UnoOrchestrator.Action.Context<Zone.Content> },
      input: Ability.ExtractContext<KnownAbilities>,
    ) => Promise<ReturnType>;

    /**
     * A union of valid event types.
     */
    export type EventName = keyof Events<any, any>;

    /**
     * Extracts the output of the executor type represented by the given
     * `EventName`.
     */
    export type ExtractEventOutput<Evt extends EventName> = ReturnType<Events[Evt]>;
  }

  /**
   * Defines an "objective" with some configuration details and event hooks
   * which can change the workflow while it's underway.
   */
  export class ObjectiveDefinition<Name extends string, KnownAbilities extends AnyAbilityDefinition[]> {
    constructor(public config: Objective.Config<Name, KnownAbilities>) {}

    /**
     * @returns the requisite action object defined for the given AI assist
     * `event`.
     */
    static getEventAction<Evt extends Objective.EventName, Obj extends Objective.Type>(event: Evt, objective: Obj) {
      return UnoOrchestrator.getRegisteredAction(`ai-assist/objective/${objective.name}/${event}`);
    }

    private registerEvent<Ev extends Objective.EventName, Exe extends UnoOrchestrator.Action.Executor>(
      eventName: Ev,
      executor: Exe,
    ) {
      UnoOrchestrator.registerAction({
        id: `ai-assist/objective/${this.config.name}/${eventName}`,
        zone: Zone.Content,
        execute: executor,
        binding: this,
      });
    }

    /**
     *
     */
    onStart(executor: Objective.Events<this, KnownAbilities>["onStart"]): this {
      this.registerEvent("onStart", executor);
      return this;
    }

    /**
     *
     */
    onFinish(executor: Objective.Events<this, KnownAbilities>["onFinish"]): this {
      this.registerEvent("onFinish", executor);
      return this;
    }

    /**
     *
     */
    onFail(executor: Objective.Events<this, KnownAbilities>["onFail"]): this {
      this.registerEvent("onFail", executor);
      return this;
    }

    /**
     * Called during the `DetermineNextSteps` phase of an automation workflow.
     * This event runs as an action dispatched by the current `UnoOrchestrator`
     * instance and should return a list of JSON-serializable ability types to
     * pass onto the AI agent upon the next query. If this event is not
     * registered for this objective, all abilities configured in the
     * constructor are used instead.
     */
    onCheckEnabledAbilities(executor: Objective.Events<this, KnownAbilities>["onCheckEnabledAbilities"]): this {
      this.registerEvent("onCheckEnabledAbilities", executor);
      return this;
    }

    /**
     * Called during the `DetermineNextSteps` phase of an automation workflow.
     * This event runs as an action dispatched by the current `UnoOrchestrator`
     * instance and should return a boolean indicating whether the automation
     * should continue, or a list of synthetic automation effects in lieu of
     * querying the AI agent.
     */
    onDetermineNextSteps(executor: Objective.Events<this, KnownAbilities>["onDetermineNextSteps"]): this {
      this.registerEvent("onDetermineNextSteps", executor);
      return this;
    }

    /**
     * @returns a generated `HistoryEntry` to inject statically into the
     * automation workflow.
     */
    createSyntheticEffect<
      Name extends Ability.ExtractName<KnownAbilities>,
      Parameters extends Ability.ExtractParameters<KnownAbilities, Name>,
    >(
      name: Name,
      options: keyof Parameters extends never ? { thought: string } : { parameters: Parameters; thought: string },
    ): Effect<KnownAbilities, Name> {
      const parameters = (options as any).parameters ?? {};
      const matchedAbility = this.config.abilities.find(({ type }) => type.name === name);
      const orderedParameters = matchedAbility?.type.parameters
        .map(({ name: paramName }) => {
          return parameters[paramName] ? JSON.stringify(parameters[paramName]) : null;
        })
        .filter(truthyFilter);
      return {
        thought: options.thought,
        effect: orderedParameters ? `${name}(${orderedParameters.join(", ")})` : `${name}()`,
        payload: {
          name,
          parameters,
          debugLabel: this.config.abilities.find(({ type }) => type.name === name)?.type.debugLabel,
        },
        _isSynthetic: true,
      };
    }

    /**
     * @returns a function that creates a static, JSON-serializable object
     * representing an automation objective and it's available
     * abilities/actions.
     */
    toFactory(): (ctx: Ability.ExtractContext<KnownAbilities>) => Objective.Type<Name, KnownAbilities> {
      return (ctx) => {
        return {
          ...this.config,
          model: this.config.model instanceof Function ? this.config.model(ctx) : this.config.model,
          abilities: this.config.abilities.map(({ type }) => type) as any,
          context: ctx,
        };
      };
    }
  }

  /**
   * An `ObjectiveDefinition` with loosely-typed generics.
   */
  export type AnyObjectiveDefinition = ObjectiveDefinition<any, any[]>;

  /**
   * An "ability" defines a type of effect the AI agent can express in the DOM.
   */
  export namespace Ability {
    export interface Type<
      Name extends string = string,
      Parameters extends Parameter<any, any>[] = Parameter<any, any>[],
    > {
      name: Name;
      description: string;
      debugLabel?: string;
      parameters: Parameters;
    }

    /**
     * From the given ability definition types, extract the underlying
     * JSON-serializable ability types.
     */
    export type ExtractTypes<KnownAbilities extends AnyAbilityDefinition[]> = {
      [P in keyof KnownAbilities]: KnownAbilities[P] extends AbilityDefinition<infer N, infer P, any>
        ? Type<N, P>
        : never;
    };

    /**
     * The definition of a "parameter" that can be leveraged by the AI agent to
     * perform effects on the DOM.
     */
    export interface Parameter<Name extends string, Type extends ParameterType = ParameterType> {
      name: Name;
      type: Type;
    }

    /**
     * Primitive data types (represented as strings) that can be provided by the
     * AI agent as parameters to effectful abilities.
     */
    export type ParameterType = "string" | "number";

    /**
     * An object containing normalized/validated parameters extracted from an
     * ability with `Name` in a set of `KnownAbilities`.
     */
    export interface Payload<
      KnownAbilities extends AnyAbilityDefinition[] = AnyAbilityDefinition[],
      Name extends ExtractName<KnownAbilities> = ExtractName<KnownAbilities>,
    > {
      name: Name;
      debugLabel?: string;
      parameters: ExtractParameters<KnownAbilities, Name>;
    }

    /**
     * Converts a list of `Parameter` types into an object where keys represent
     * parameter names values represent the normalized output from an AI agent.
     */
    export type ParametersToObject<P extends Parameter<any, any>[]> = {
      [K in P[number]["name"]]: SerializedPrimitiveToType<Extract<P[number], { name: K }>["type"]>;
    };

    /**
     * Extracts a union of valid ability names from a set of `KnownAbilities`.
     */
    export type ExtractName<KnownAbilities extends AnyAbilityDefinition[]> =
      KnownAbilities[number] extends AbilityDefinition<infer N, any, any> ? N : never;

    /**
     * An object of merged parameters extracted from an ability with `Name` in a
     * set of `KnownAbilities`.
     */
    export type ExtractParameters<
      KnownAbilities extends AnyAbilityDefinition[],
      Name extends ExtractName<KnownAbilities> = ExtractName<KnownAbilities>,
    > = Extract<KnownAbilities[number], AbilityDefinition<Name, any, any>> extends AbilityDefinition<any, infer P, any>
      ? Merge<ParametersToObject<P>>
      : never;

    /**
     * An object of merged context data extracted from an ability with `Name` in
     * a set of `KnownAbilities`.
     */
    export type ExtractContext<
      KnownAbilities extends AnyAbilityDefinition[],
      Name extends ExtractName<KnownAbilities> = ExtractName<KnownAbilities>,
    > = Extract<KnownAbilities[number], AbilityDefinition<Name, any, any>> extends AbilityDefinition<any, any, infer C>
      ? Merge<Exclude<C, void>>
      : never;
  }

  /**
   * Defines an "ability" with some configuraiton details and effectful business
   * logic for the AI agent to leverage throughout an automation workflow.
   */
  export class AbilityDefinition<
    Name extends string,
    Parameters extends Ability.Parameter<any, any>[],
    Context = void, // This is used for type information only...
  > {
    constructor(public type: Ability.Type<Name, Parameters>) {}

    /**
     * @returns the requisite action object defined for this Ability's DOM
     * effect.
     */
    static getEffectAction(effect: Effect) {
      return UnoOrchestrator.getRegisteredAction(`ai-assist/ability/${effect.payload.name}`);
    }

    /**
     * Defines the executor of an `UnoOrchestrator` action representing the DOM
     * effect of this Ability when invoked by the AI agent during an automation
     * workflow.
     */
    defineEffect<Ctx = void>(
      executor: (
        this: { context: UnoOrchestrator.Action.Context<Zone.Content> },
        input: Merge<Exclude<Context | Ctx | Ability.ParametersToObject<Parameters>, void>>,
      ) => Promise<void>,
    ): AbilityDefinition<Name, Parameters, Ctx> {
      UnoOrchestrator.registerAction({
        id: `ai-assist/ability/${this.type.name}`,
        zone: Zone.Content,
        execute: executor,
      });
      return this as any;
    }

    toJSON() {
      return this.type;
    }
  }

  /**
   * An `AbilityDefinition` with loosely-typed generics.
   */
  export type AnyAbilityDefinition = AbilityDefinition<any, Ability.Parameter<any, any>[], any>;
}

export interface AiAssistSlice {
  aiAssist: Automation.Task<Automation.AnyAbilityDefinition[]>;
}

export const initialAiAssistSlice: AiAssistSlice = {
  aiAssist: {
    tabID: null,
    objective: null,
    history: [],
    status: "idle",
    phase: "idle",
    uiLabel: {
      title: "AI Assist...",
      theme: "neutral",
    },
  },
};
