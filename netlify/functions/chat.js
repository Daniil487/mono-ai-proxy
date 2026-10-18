const TONES = [
  "Тон: дружелюбный и тёплый.",
  "Тон: строгий, чёткий, без лишних слов.",
  "Тон: дерзкий, с юмором, но без грубости.",
];

exports.handler = async (event) => {
  if (event.httpMethod === "GET")
    return { statusCode: 200, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "MONO AI proxy работает" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "" };

  const { messages = [], memory = [], tone = 0, voice = false } = JSON.parse(event.body || "{}");

  let system = "Ты MONO AI, умный ассистент. Отвечай на языке пользователя. " + (TONES[tone] || TONES[0]);
  if (voice) system += " Это голосовой звонок: отвечай коротко, живой речью, без markdown, списков и эмодзи.";
  if (memory.length) system += "\nФакты о пользователе:\n- " + memory.slice(-50).join("\n- ");

  const hasImage = messages.some((m) => m.image);
  const model = hasImage
    ? process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"
    : process.env.GROQ_MODEL || "openai/gpt-oss-120b";

  const msgs = messages.slice(-20).map((m) =>
    m.image
      ? {
          role: m.role,
          content: [
            { type: "text", text: m.content },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${m.image}` } },
          ],
        }
      : { role: m.role, content: m.content }
  );

  const payload = { model, messages: [{ role: "system", content: system }, ...msgs] };
  if (model.startsWith("openai/gpt-oss")) payload.reasoning_effort = "low";

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const d = await r.json();
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reply: d.choices?.[0]?.message?.content ?? "Ошибка Groq: " + JSON.stringify(d),
    }),
  };
};
