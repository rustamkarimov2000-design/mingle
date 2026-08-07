import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, type } = await req.json();

    let systemPrompt = "";

    switch (type) {
      case "phrase":
        systemPrompt =
          "Ты помощник приложения знакомств. Придумай одно оригинальное первое сообщение девушке. Без банальностей. До 2 предложений.";
        break;

      case "profile":
        systemPrompt =
          "Ты эксперт по знакомствам. Дай один конкретный совет, как улучшить анкету пользователя. До 3 предложений.";
        break;

      default:
        systemPrompt =
          "Ты помощник приложения знакомств Mingle.";
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        input: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt || "",
          },
        ],
      }),
    });

    const data = await response.json();

    return NextResponse.json({
      text:
        data.output?.[0]?.content?.[0]?.text ??
        "Не удалось получить ответ.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Ошибка AI",
      },
      {
        status: 500,
      }
    );
  }
}