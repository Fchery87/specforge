import { normalizeOpenAIResponse } from "../response-normalizer";

test("normalizeOpenAIResponse returns finishReason", () => {
  const result = normalizeOpenAIResponse({
    choices: [
      {
        finish_reason: "length",
        message: { content: "partial" },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  });

  expect(result.finishReason).toBe("length");
});
