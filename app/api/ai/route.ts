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
        ? "Ты — доброжелательный помощник в приложении знакомств Mingle. Дай один короткий (2-3 предложения), конкретный и позитивный совет, как улучшить анкету пользователя в приложении знакомств. Пиши на русском языке, простым текстом, без markdown и без нумерации. Отвечай сразу готовым текстом совета — без рассуждений, без вопросов самому себе, без мета-комментариев о том, как ты формируешь ответ."
        : "Ты — доброжелательный помощник в приложении знакомств Mingle. Придумай одно короткое, живое и ненавязчивое первое сообщение для знакомства в приложении для свиданий (1-2 предложения, можно с лёгким юмором и уместным эмодзи). Пиши на русском языке. Ответь только самим сообщением в кавычках — без рассуждений, без вопросов самому себе, без мета-комментариев о том, как ты формируешь ответ.";

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
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
            maxOutputTokens: 2048,
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

    const parts = data?.candidates?.[0]?.content?.parts || [];

    const text =
      parts
        .filter((p: any) => !p.thought)
        .map((p: any) => p.text || "")
        .join("")
        .trim() || "Не удалось получить ответ 😔 Попробуйте ещё раз.";

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("Системная ошибка в /api/ai:", err);
    return NextResponse.json({
      text: "Произошла ошибка при обращении к AI-помощнику. Попробуйте позже.",
    });
  }
}import { NextRequest, NextResponse } from "next/server";

interface ProfileInfo {
  name?: string;
  age?: number | null;
  city?: string | null;
  bio?: string | null;
  occupation?: string | null;
  dating_goal?: string | null;
  interests?: string[] | null;
  prompts?: { question: string; answer: string }[] | null;
}

interface ChatLine {
  mine: boolean;
  text: string;
}

const clip = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : "";

function describe(p: ProfileInfo | undefined) {
  if (!p) return "нет данных";

  const parts: string[] = [];
  if (p.name) parts.push("имя: " + clip(p.name, 60));
  if (p.age) parts.push("возраст: " + Number(p.age));
  if (p.city) parts.push("город: " + clip(p.city, 60));
  if (p.occupation) parts.push("сфера работы: " + clip(p.occupation, 100));
  if (p.dating_goal) parts.push("цель знакомства: " + clip(p.dating_goal, 100));
  if (p.bio) parts.push("о себе: " + clip(p.bio, 500));
  if (Array.isArray(p.interests) && p.interests.length)
    parts.push("интересы: " + p.interests.slice(0, 15).map((i) => clip(i, 40)).join(", "));
  if (Array.isArray(p.prompts))
    p.prompts
      .filter((x) => x?.question && x?.answer)
      .slice(0, 3)
      .forEach((x) => parts.push(clip(x.question, 120) + " — " + clip(x.answer, 300)));

  return parts.join("; ") || "нет данных";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const me: ProfileInfo | undefined = body.me;
    const other: ProfileInfo | undefined = body.other;
    const recent: ChatLine[] = Array.isArray(body.recent) ? body.recent.slice(-8) : [];
    const seed = clip(body.seed, 20);

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        suggestions: [],
        error: "AI-помощник не настроен: нет GEMINI_API_KEY на сервере.",
      });
    }

    const hasChat = recent.length > 0;

    const chatText = recent
      .map((m) => (m.mine ? "Я: " : "Собеседник: ") + clip(m.text, 300))
      .join("\n");

    const prompt =
      "Ты — доброжелательный помощник в приложении знакомств Mingle. " +
      (hasChat
        ? "Пользователь уже переписывается с мэтчем. Предложи 3 разных варианта следующего сообщения от лица пользователя, которые естественно продолжают диалог."
        : "Пользователь хочет написать мэтчу первое сообщение. Предложи 3 разных варианта первого сообщения от лица пользователя.") +
      " Варианты должны отличаться по тону: один тёплый и простой, один с лёгким юмором, один с вопросом по интересам или анкете собеседника. " +
      "Опирайся на конкретные детали анкеты собеседника, если они есть, и не придумывай факты, которых нет в данных. " +
      "Каждый вариант — 1-2 коротких предложения, по-русски, на «ты», без банальных «привет, как дела», без пошлости и давления. " +
      "Можно один уместный эмодзи.\n\n" +
      "Анкета пользователя: " + describe(me) + "\n" +
      "Анкета собеседника: " + describe(other) + "\n" +
      (hasChat ? "\nПоследние сообщения:\n" + chatText + "\n" : "") +
      (seed ? "\nВариант №" + seed + " (сделай варианты непохожими на предыдущие).\n" : "") +
      '\nОтветь строго JSON-массивом из 3 строк, например ["вариант 1","вариант 2","вариант 3"]. Без пояснений и без markdown.';

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Ошибка Gemini API (icebreaker):", data);
      return NextResponse.json({
        suggestions: [],
        error: "Не удалось получить ответ от AI: " + (data?.error?.message || "ошибка API"),
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const raw = parts
      .filter((p: any) => !p.thought)
      .map((p: any) => p.text || "")
      .join("")
      .trim();

    let suggestions: string[] = [];

    try {
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter((x) => typeof x === "string");
      }
    } catch {
      // запасной вариант: разбиваем по строкам
      suggestions = raw
        .split("\n")
        .map((l: string) => l.replace(/^[\s\-\d.)"«]+|["»,]+$/g, "").trim())
        .filter((l: string) => l.length > 5);
    }

    suggestions = suggestions.map((s) => s.trim()).filter(Boolean).slice(0, 3);

    if (suggestions.length === 0) {
      return NextResponse.json({
        suggestions: [],
        error: "Не удалось получить варианты. Попробуйте ещё раз.",
      });
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Системная ошибка в /api/ai/icebreaker:", err);
    return NextResponse.json({
      suggestions: [],
      error: "Ошибка при обращении к AI-помощнику. Попробуйте позже.",
    });
  }
}