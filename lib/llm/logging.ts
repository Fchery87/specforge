function isSecretKey(key: string): boolean {
  return /(key|token|secret)/i.test(key);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (value && typeof value === "object") {
    return redactSecrets(value as Record<string, unknown>);
  }
  return value;
}

export function redactSecrets<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isSecretKey(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = redactValue(value);
  }
  return output as T;
}
