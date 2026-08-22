import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Эта функция вызывается на КАЖДОМ запросе (через middleware.ts в корне
// проекта). Она читает cookies сессии, при необходимости обновляет
// истёкший access token и записывает свежие cookies обратно в ответ.
// Без этого шага сессия входа (в том числе через Telegram) не будет
// "переживать" переход на новую страницу — именно это вызывало повторный
// запрос логина на каждой вкладке.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Важно: не убирать этот вызов. Он обращается к Supabase, чтобы проверить
  // и при необходимости обновить сессию — именно это "продлевает" вход.
  await supabase.auth.getUser();

  return supabaseResponse;
}