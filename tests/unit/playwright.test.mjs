import test from "node:test";
import assert from "node:assert/strict";
import { explainPlaywrightInstallFailure } from "../../scripts/lib/playwright.mjs";

test("IMP-018 explains the Playwright host-platform refusal without silently overriding it",()=>{
  const stderr="Host system is missing dependencies to run browsers.\nERROR: Playwright does not support chromium on ubuntu26.04-x64\n";
  const message=explainPlaywrightInstallFailure(stderr);
  assert.match(message,/PLAYWRIGHT_HOST_PLATFORM_OVERRIDE/);
  assert.match(message,/ubuntu26\.04-x64/);
});

test("IMP-018 returns null for an unrelated Playwright install failure",()=>{
  assert.equal(explainPlaywrightInstallFailure("network timeout downloading chromium\n"),null);
});
