import { test as testBase } from "@playwright/test";

import { BaseFixture } from "./base";
import { EventsFixture } from "./events";
import { PagesFixture } from "./pages";
import { VaultsFixture } from "./vaults";

type AllFixtures = BaseFixture & EventsFixture & PagesFixture & VaultsFixture;

export const test = testBase.extend<AllFixtures>({
  ...BaseFixture,
  ...EventsFixture,
  ...PagesFixture,
  ...VaultsFixture,
});

export const { expect } = test;
