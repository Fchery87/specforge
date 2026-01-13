export function getRequiredEncryptionKey(): string {
  const key = process.env.CONVEX_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "CONVEX_ENCRYPTION_KEY environment variable is required. " +
        "Set it in your Convex dashboard under Settings > Environment Variables."
    );
  }
  return key;
}
