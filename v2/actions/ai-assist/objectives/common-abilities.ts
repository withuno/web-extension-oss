import { Automation } from "@/v2/store/slices/ai-assist.slice";
import { Tuple } from "@/v2/types/essentials";
import { sleep } from "@/v2/utils/async";
import { WebDriver } from "@/v2/utils/dom";

import { AiAssistSetStatus } from "../automation/set-status.action";
import { getElementByAnnotatedID } from "../dom/annotate-element";

export const CommonAbilities = [
  /**
   * Defines an ability for the AI agent to click on an interactive element in
   * the page.
   */
  new Automation.AbilityDefinition({
    name: "click",
    description: "Clicks on an element",
    debugLabel: "Clicking...",
    parameters: Tuple([{ name: "elementId", type: "number" }] as const),
  }).defineEffect(async function (input) {
    await sleep(100); // Provide some space between simulated interactions.
    const target = getElementByAnnotatedID<HTMLElement>(input.elementId);
    if (target) {
      WebDriver.Mouse.simulateClick(target);
      await sleep(2000); // give the page a moment to "settle"
    }
  }),

  /**
   * Defines an ability for the AI agent to click on an interactive element in
   * the page.
   */
  new Automation.AbilityDefinition({
    name: "wait",
    description: "There is no clear next step possible on the page, so wait for 2 seconds to let the page settle",
    parameters: [],
  }).defineEffect(async function () {
    await sleep(2000); // give the page a moment to "settle"
  }),

  /**
   * Defines an ability for the AI agent to label a workflow as "finished".
   */
  new Automation.AbilityDefinition({
    name: "finish",
    description: "Indicates the task is finished",
    parameters: [],
  }).defineEffect(async function () {
    const { orchestrator } = this.context;
    await orchestrator.useAction(AiAssistSetStatus)("done/finish");
  }),

  /**
   * Defines an ability for the AI agent to label a workflow as "failed".
   */
  new Automation.AbilityDefinition({
    name: "fail",
    description: "Indicates that you are unable to complete the task",
    parameters: [],
  }).defineEffect(async function () {
    const { orchestrator } = this.context;
    await orchestrator.useAction(AiAssistSetStatus)("done/fail");
  }),
];

export type CommonAbilities = typeof CommonAbilities;
