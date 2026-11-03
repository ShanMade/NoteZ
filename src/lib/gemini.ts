import "server-only";

export function geminiConfig() {
  return { key: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim(), model: (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite").trim() };
}

export async function geminiJson(prompt: string, audio?: { data: string; mimeType: string }): Promise<unknown> {
  const { key, model } = geminiConfig();
  if (!key) throw new Error("Gemini is not configured.");
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) throw new Error("Invalid Gemini model configuration.");
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.data } });
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 4096 } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    console.error("Gemini API status:", response.status, (await response.text()).slice(0, 500));
    throw new Error(response.status === 429 ? "Gemini is rate limited. Please retry shortly." : "Gemini could not process this request. Check the server configuration and try again.");
  }
  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("")?.trim();
  if (!text) throw new Error("Gemini returned an empty response. Please try again.");
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(cleaned); } catch { throw new Error("Gemini returned an unreadable response. Please retry."); }
}
