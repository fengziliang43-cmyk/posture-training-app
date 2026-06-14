export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekRequest {
  apiKey: string;
  model: string;
  messages: DeepSeekMessage[];
  timeoutMs?: number;
  maxTokens?: number;
}

export interface DeepSeekResult {
  content: string;
}

const DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_TIMEOUT_MS = 12000;

export async function createDeepSeekChatCompletion(input: DeepSeekRequest): Promise<DeepSeekResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        max_tokens: input.maxTokens ?? 240,
        temperature: 0.4
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`DeepSeek HTTP ${response.status}`);
    }

    const body = (await response.json()) as {
      choices?: Array<{ finish_reason?: string; message?: { content?: string; reasoning_content?: string } }>;
    };
    const choice = body.choices?.[0];
    const content = choice?.message?.content?.trim();
    if (!content) {
      if (choice?.message?.reasoning_content && choice.finish_reason === "length") {
        throw new Error("DeepSeek output was truncated before the final answer. Increase max_tokens.");
      }

      throw new Error("DeepSeek returned empty content.");
    }

    return { content };
  } catch (error) {
    throw new Error(sanitizeDeepSeekError(error));
  } finally {
    clearTimeout(timeout);
  }
}

export function sanitizeDeepSeekError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "DeepSeek request timed out.";
    return error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***");
  }

  return "DeepSeek request failed.";
}
