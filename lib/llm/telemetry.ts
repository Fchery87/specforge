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

export function buildTelemetry(input: TelemetryInput): Record<string, unknown> {
  const { prompt: _prompt, apiKey: _apiKey, ...rest } = input;
  return redactSecrets(rest);
}
