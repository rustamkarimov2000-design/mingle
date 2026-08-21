import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Проверка подписи данных, присланных виджетом Telegram Login.
// Алгоритм из документации Telegram: https://core.telegram.org/widgets/login#checking-authorization
function verifyTelegramAuth(data: Record<string, any>, botToken: string): boolean {
  const { hash, ...rest } = data;
  if (!hash) return false;

  const checkString = Object.keys(rest)
    .filter((k) => rest[k] !== undefined && rest[k] !== null && rest[k] !== "")
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

  return hmac === hash;
}

export async function POST(request: NextRequest) {
  try {
    if (!BOT_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("Не настроены переменные окружения для Telegram-входа");
      return NextResponse.json(
        {
          success: false,
          message:
            "Вход через Telegram не настроен на сервере (отсутствуют переменные окружения).",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { telegram_id, first_name, last_name, username, photo_url, auth_date, hash } = body;

    if (!telegram_id || !auth_date || !hash) {
      return NextResponse.json(
        { success: false, message: "Некорректные данные от Telegram" },
        { status: 400 }
      );
    }

    const isValid = verifyTelegramAuth(
      { id: telegram_id, first_name, last_name, username, photo_url, auth_date, hash },
      BOT_TOKEN
    );

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Подпись Telegram не прошла проверку" },
        { status: 401 }
      );
    }

    // Данные виджета старше суток не принимаем (защита от повторного использования)
    const authAgeSeconds = Date.now() / 1000 - Number(auth_date);
    if (authAgeSeconds > 86400) {
      return NextResponse.json(
        { success: false, message: "Данные авторизации устарели, попробуйте войти снова" },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const displayName =
      [first_name, last_name].filter(Boolean).join(" ").trim() ||
      username ||
      "Пользователь Telegram";

    // Синтетический email — Supabase Auth требует email/пароль под капотом,
    // даже если реального почтового ящика нет.
    const email = "tg" + String(telegram_id) + "@mingleapp.local";

    // Ищем уже привязанный профиль по telegram_id
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("telegram_id", String(telegram_id))
      .maybeSingle();

    let authUserId: string;

    if (existingProfile) {
      authUserId = existingProfile.id;
    } else {
      const { data: createdUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            telegram_id: String(telegram_id),
            source: "telegram",
          },
        });

      if (createError || !createdUser?.user) {
        console.error("Ошибка создания пользователя Supabase:", createError);
        return NextResponse.json(
          { success: false, message: "Не удалось создать аккаунт" },
          { status: 500 }
        );
      }

      authUserId = createdUser.user.id;
    }

    // Создаём/обновляем профиль данными из Telegram
    const { error: upsertError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: authUserId,
        name: displayName,
        avatar_url: photo_url || null,
        telegram_id: String(telegram_id),
        telegram_username: username || null,
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      console.error("Ошибка сохранения профиля Telegram-пользователя:", upsertError);
    }

    // Генерируем токен magic-link (email при этом НЕ отправляется — просто
    // используем сам токен, чтобы залогинить пользователя на клиенте)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !linkData) {
      console.error("Ошибка генерации токена входа:", linkError);
      return NextResponse.json(
        { success: false, message: "Не удалось создать сессию входа" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      email,
      token: linkData.properties?.hashed_token,
      user: { id: authUserId, name: displayName, avatar_url: photo_url || null },
    });
  } catch (err: any) {
    console.error("Системная ошибка Telegram-авторизации:", err);
    return NextResponse.json(
      { success: false, message: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}