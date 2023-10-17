import type { CreateCompletionResponseUsage } from "openai";

import { UnoOrchestrator, Zone } from "@/v2/orchestrator";
import { Automation } from "@/v2/store/slices/ai-assist.slice";

export interface AskAIOptions {
  html: string;
  objective: Automation.Objective.Type;
  history: Automation.Effect[];
}

export interface AskAIResponse {
  usage: CreateCompletionResponseUsage;
  response: ParsedResponse;
}

export const AskAiAction = UnoOrchestrator.registerAction({
  id: "ai-assist/ask-ai",
  zone: Zone.Background,
  async execute(input: AskAIOptions): Promise<AskAIResponse> {
    const abilities = input.objective.abilities.map((ability) => {
      const mappedParameters = ability.parameters.map((arg) => `${arg.name}: ${arg.type}`).join(", ");
      return `${ability.name}(${mappedParameters}): ${ability.description}`;
    });

    const history = input.history.map(({ thought, effect }) => {
      return `<Action><Thought>${thought}</Thought><Effect>${effect}</Effect></Action>`;
    });

    const url = new URL("/assistant/automation", process.env.API_SERVER);
    const req = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        objective: input.objective.prompt,
        user_time: new Date().toISOString(),
        abilities,
        history,
        dom: input.html,
      }),
    });

    if (!req.ok) {
      throw new Error("Failed to query AI Assistant");
    }

    const { message, usage } = await req.json();
    const parsedResponse = parseResponse(message, input.objective);

    return {
      usage: usage as CreateCompletionResponseUsage,
      response: parsedResponse,
    };
  },
});

// --- Parse AI responses --------------------------------------------------- //

export interface ParsedResponse {
  entries: Automation.Effect[];
  errors: string[];
}

/**
 * Parses the AI agent's response and validates the parameter types given to any
 * automation effects.
 */
function parseResponse(text: string, objective: Automation.Objective.Type): ParsedResponse {
  const dom = new DOMParser().parseFromString(text, "text/html");

  const actions = dom.querySelectorAll("Action");

  if (!actions.length) {
    return {
      entries: [],
      errors: ["Invalid response: <Action> not found in the model response."],
    };
  }

  const seenEffects = new Set<string>();
  const payloads = [] as Automation.Effect[];
  const validationErrors: string[] = [];

  Array.from(actions).forEach(async (node, i) => {
    const thought = node.querySelector("Thought");
    const effect = node.querySelector("Effect");

    if (!thought) {
      validationErrors.push(`Invalid response: <Action>[${i}] -> <Thought> not found in the model response.`);
    }

    if (!effect) {
      validationErrors.push(`Invalid response: <Action>[${i}] -> <Effect> not found in the model response.`);
    }

    if (!thought || !effect) {
      return; // Move on to the next node...
    }

    const thoughtString = thought.textContent ?? "";
    const effectString = effect.textContent ?? "";
    const effectPattern = /(\w+)\((.*?)\)/;
    const effectParts = effectString.match(effectPattern);

    if (seenEffects.has(effectString)) {
      return; // Move on to the next node... The agent responded with a duplicate effect in the same query.
    }

    if (!effectParts) {
      validationErrors.push(
        `Invalid response: <Action>[${i}] -> <Effect> should be in the format "functionName(arg1, arg2, ...)".`,
      );
      return; // Move on to the next node...
    }

    const abilityName = effectParts[1];
    const abilityParametersString = effectParts[2];
    const matchedAbility = objective.abilities.find((ability) => ability.name === abilityName);

    if (!matchedAbility) {
      validationErrors.push(`Invalid response: <Action>[${i}] -> <Effect> -> "${abilityName}" is not a valid effect.`);
      return; // Move on to the next node...
    }

    const paramsArray = abilityParametersString
      .split(",")
      .map((arg) => arg.trim())
      .filter((arg) => arg !== "");
    const parsedParams: Record<string, number | string> = {};

    if (paramsArray.length !== matchedAbility.parameters.length) {
      validationErrors.push(
        `Invalid response: <Action>[${i}] -> <Effect> -> Expected ${matchedAbility.parameters.length} for action "${abilityName}", but got ${paramsArray.length}.`,
      );
      return; // Move on to the next node...
    }

    for (let i = 0; i < paramsArray.length; i++) {
      const param = paramsArray[i];
      const expectedParam = matchedAbility.parameters[i] as Automation.Ability.Parameter<any>;

      switch (expectedParam.type) {
        case "number": {
          const numberValue = Number(param);
          if (isNaN(numberValue)) {
            validationErrors.push(
              `Invalid response: <Action>[${i}] -> <Effect> -> Expected a number for argument "${expectedParam.name}", but got "${param}".`,
            );
            return; // Move on to the next node...
          }
          parsedParams[expectedParam.name] = numberValue;
          break;
        }

        case "string": {
          const stringValue = param.startsWith('"') && param.endsWith('"') ? param.slice(1, -1) : null;
          if (stringValue === null) {
            validationErrors.push(
              `Invalid response: <Action>[${i}] -> <Effect> -> Expected a string for argument "${expectedParam.name}", but got "${param}".`,
            );
            return; // Move on to the next node...
          }
          parsedParams[expectedParam.name] = stringValue;
          break;
        }

        default: {
          validationErrors.push(
            `Invalid response: <Action>[${i}] -> <Effect> -> Invalid argument type: Unknown type "${expectedParam.type}" for argument "${expectedParam.name}".`,
          );
          return; // Move on to the next node...
        }
      }
    }

    const payload = {
      name: matchedAbility.name,
      debugLabel: matchedAbility.debugLabel,
      parameters: parsedParams,
    } as Automation.Ability.Payload;

    seenEffects.add(effectString);

    payloads.push({
      thought: thoughtString,
      effect: effectString,
      payload,
    });
  });

  return {
    entries: payloads,
    errors: validationErrors,
  };
}
