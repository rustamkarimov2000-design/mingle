import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { type, prompt } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        text:
          "AI-помощник временно недоступен: не настроен GEMINI_API_KEY на сервере. " +
          "Получите бесплатный ключ на aistudio.google.com/apikey и добавьте его в переменные окружения.",
      });
    }

    const systemPrompt =
      type === "profile"
        ? "Ты — доброжелательный помощник в приложении знакомств Mingle. Дай один короткий (2-3 предложения), конкретный и позитивный совет, как улучшить анкету пользователя в приложении знакомств. Пиши на русском языке, простым текстом, без markdown и без нумерации."
        : "Ты — доброжелательный помощник в приложении знакомств Mingle. Придумай одно короткое, живое и ненавязчивое первое сообщение для знакомства в приложении для свиданий (1-2 предложения, можно с лёгким юмором и уместным эмодзи). Пиши на русском языке. Ответь только самим сообщением в кавычках, без пояснений.";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: systemPrompt + "\n\nЗапрос пользователя: " + (prompt || "") }],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 200,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Ошибка Gemini API:", data);
      return NextResponse.json({
        text:
          "Не удалось получить ответ от AI: " +
          (data?.error?.message || "неизвестная ошибка API"),
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Не удалось получить ответ 😔 Попробуйте ещё раз.";

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("Системная ошибка в /api/ai:", err);
    return NextResponse.json({
      text: "Произошла ошибка при обращении к AI-помощнику. Попробуйте позже.",
    });
  }
}