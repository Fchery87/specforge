import { redactSecrets } from "./logging";

type TelemetryInput = {
  provider: string;
  model: string;
  durationMs?: number;
  success?: boolean;
  tokens?: { prompt?: number; completion?: number; total?: number };
  error?: string;
  prompt?: string;
  apiKey?: string;
};

type TelemetryLevel = "info" | "warn";

export function buildTelemetry(input: TelemetryInput): Record<string, unknown> {
  const { prompt: _prompt, apiKey: _apiKey, ...rest } = input;
  return redactSecrets(rest);
}

export function shouldLogTelemetry(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

export function logTelemetry(level: TelemetryLevel, input: TelemetryInput): void {
  if (!shouldLogTelemetry()) return;
  const payload = buildTelemetry(input);
  const logger = level === "warn" ? console.warn : console.info;
  logger("[llm.telemetry]", payload);
}
