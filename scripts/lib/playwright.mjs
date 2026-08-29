// Playwright refuses to install browsers on an unrecognized host by design.
// This maps that refusal to operator remediation; it never decides to
// override the host itself, so an unsupported machine fails loudly.
export function explainPlaywrightInstallFailure(stderr) {
  const text = String(stderr ?? "");
  const match = text.match(/does not support (\S+) on ([A-Za-z0-9._-]+)/);
  if (!match) return null;
  const [, browser, host] = match;
  return `Playwright refused to install ${browser} on unsupported host ${host}. This importer will not silently override host detection. If you understand the compatibility risk, re-run with an explicit override on the command line, e.g.:\n  PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 <original command>`;
}
