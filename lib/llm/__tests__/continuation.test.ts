import { continueIfTruncated } from "../continuation";

test("continues when finishReason is length", async () => {
  const calls: string[] = [];
  const complete = async (prompt: string) => {
    calls.push(prompt);
    if (calls.length === 1) {
      return {
        content: "Part 1",
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        finishReason: "length",
      };
    }
    return {
      content: "Part 2",
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      finishReason: "stop",
    };
  };

  const result = await continueIfTruncated({
    prompt: "Generate",
    complete,
    maxTurns: 3,
    continuationPrompt: (soFar) => `Continue from: ${soFar}`,
  });

  expect(result.content).toBe("Part 1\n\nPart 2");
  expect(calls.length).toBe(2);
});
