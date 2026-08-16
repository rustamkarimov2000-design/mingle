"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Photo {
  id: string;
  url: string;
  position: number;
}

const ZODIAC_SIGNS = [
  "Овен",
  "Телец",
  "Близнецы",
  "Рак",
  "Лев",
  "Дева",
  "Весы",
  "Скорпион",
  "Стрелец",
  "Козерог",
  "Водолей",
  "Рыбы",
];

const DATING_GOALS = ["Свидания", "Дружба", "Общение", "Серьёзные отношения"];

const WORLDVIEWS = [
  "Не указано",
  "Православие",
  "Ислам",
  "Католицизм",
  "Иудаизм",
  "Буддизм",
  "Атеизм",
  "Агностицизм",
  "Другое",
];

const EDUCATION_LEVELS = [
  "Не указано",
  "Среднее",
  "Среднее специальное",
  "Незаконченное высшее",
  "Высшее",
  "Учёная степень",
];

const CHILDREN_OPTIONS = ["Не указано", "Нет", "Есть", "Хочу детей", "Не хочу детей"];

const HABIT_OPTIONS = ["Не указано", "Не употребляю", "Редко", "Нейтрально", "Часто"];

const GENDER_OPTIONS = ["Не указано", "Мужской", "Женский"];

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [locationStatus, setLocationStatus] = useState<
    "idle" | "loading" | "done" | "error"
  >("idle");

  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  const [profile, setProfile] = useState({
    id: "",
    name: "",
    age: "",
    bio: "",
    city: "",
    occupation: "",
    avatar_url: "",
    latitude: null as number | null,
    longitude: null as number | null,
    gender: "",
    dating_goal: "",
    worldview: "",
    zodiac_sign: "",
    height: "",
    education: "",
    children: "",
    languages: "",
    alcohol: "",
    smoking: "",
    interestsText: "",
  });

  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          id: user.id,
          name: data.name || "",
          age: data.age ? String(data.age) : "",
          bio: data.bio || "",
          city: data.city || "",
          occupation: data.occupation || "",
          avatar_url: data.avatar_url || data.avatar || "",
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          gender: data.gender || "",
          dating_goal: data.dating_goal || "",
          worldview: data.worldview || "",
          zodiac_sign: data.zodiac_sign || "",
          height: data.height ? String(data.height) : "",
          education: data.education || "",
          children: data.children || "",
          languages: Array.isArray(data.languages) ? data.languages.join(", ") : "",
          alcohol: data.alcohol || "",
          smoking: data.smoking || "",
          interestsText: Array.isArray(data.interests) ? data.interests.join(", ") : "",
        });

        if (data.latitude != null && data.longitude != null) {
          setLocationStatus("done");
        }
      } else if (error) {
        console.error("Ошибка при получении профиля:", error);
      } else {
        setProfile((prev) => ({
          ...prev,
          id: user.id,
        }));
      }

      const { data: photosData } = await supabase
        .from("photos")
        .select("*")
        .eq("profile_id", user.id)
        .order("position", { ascending: true });

      setPhotos(photosData || []);
      setLoading(false);
    };

    fetchProfile();
  }, [router, supabase]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setMessage({
        text: "Ваш браузер не поддерживает геолокацию",
        type: "error",
      });
      return;
    }

    setLocationStatus("loading");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setProfile((prev) => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));

        setLocationStatus("done");

        setMessage({
          text: "Местоположение определено! Не забудьте сохранить.",
          type: "success",
        });
      },
      () => {
        setLocationStatus("error");

        setMessage({
          text: "Не удалось определить местоположение. Разрешите доступ в браузере.",
          type: "error",
        });
      }
    );
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;

    if (!file || !profile.id) return;

    try {
      setUploading(true);
      setMessage(null);

      const fileExt = file.name.split(".").pop();
      const filePath = profile.id + "/" + Math.random() + "." + fileExt;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setProfile((prev) => ({
        ...prev,
        avatar_url: publicUrl,
      }));

      setMessage({
        text: "Фото загружено! Не забудьте сохранить.",
        type: "success",
      });
    } catch (err: any) {
      console.error("Ошибка загрузки фото:", err);

      const reason = err && err.message ? err.message : "Проверьте права бакета avatars";

      setMessage({
        text: "Ошибка загрузки: " + reason,
        type: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryPhotoUpload = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files ? e.target.files[0] : null;

    if (!file || !profile.id) return;

    if (photos.length >= 5) {
      setMessage({
        text: "Максимум 5 дополнительных фото",
        type: "error",
      });
      return;
    }

    try {
      setUploadingPhoto(true);
      setMessage(null);

      const fileExt = file.name.split(".").pop();
      const filePath = profile.id + "/" + Date.now() + "." + fileExt;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("photos").getPublicUrl(filePath);

      const { data: newPhoto, error: insertError } = await supabase
        .from("photos")
        .insert({
          profile_id: profile.id,
          url: publicUrl,
          position: photos.length,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setPhotos((prev) => [...prev, newPhoto]);

      setMessage({
        text: "Фото добавлено в галерею!",
        type: "success",
      });
    } catch (err: any) {
      console.error("Ошибка загрузки фото в галерею:", err);

      const reason = err && err.message ? err.message : "Неизвестная ошибка";

      setMessage({
        text: "Ошибка: " + reason,
        type: "error",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    const { error } = await supabase
      .from("photos")
      .delete()
      .eq("id", photoId);

    if (error) {
      console.error("Ошибка удаления фото:", error);
      return;
    }

    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setMessage(null);

    const languagesArray = profile.languages
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const interestsArray = profile.interestsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updates = {
      id: profile.id,
      name: profile.name,
      age: profile.age ? Number(profile.age) : null,
      bio: profile.bio,
      city: profile.city,
      occupation: profile.occupation,
      avatar_url: profile.avatar_url,
      avatar: profile.avatar_url,
      latitude: profile.latitude,
      longitude: profile.longitude,
      gender: profile.gender || null,
      dating_goal: profile.dating_goal || null,
      worldview: profile.worldview || null,
      zodiac_sign: profile.zodiac_sign || null,
      height: profile.height ? Number(profile.height) : null,
      education: profile.education || null,
      children: profile.children || null,
      languages: languagesArray,
      alcohol: profile.alcohol || null,
      smoking: profile.smoking || null,
      interests: interestsArray,
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(updates, {
        onConflict: "id",
      });

    if (error) {
      console.error("Ошибка сохранения профиля:", error);

      setMessage({
        text: "Ошибка при сохранении: " + error.message,
        type: "error",
      });

      setSaving(false);
      return;
    }

    setMessage({
      text: "Профиль сохранен! Возвращаемся...",
      type: "success",
    });

    setTimeout(() => {
      router.push("/profile");
    }, 1000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        Загрузка редактирования...
      </div>
    );
  }

  const defaultAvatar =
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";

  const selectClass =
    "w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition";

  return (
    <main className="max-w-md mx-auto px-4 py-6 space-y-6">
      <button
        type="button"
        onClick={() => router.push("/profile")}
        className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-pink-500 transition cursor-pointer"
      >
        {"\u2190 Назад в профиль"}
      </button>

      <h1 className="text-xl font-bold text-gray-900">
        РЕДАКТИРОВАНИЕ
      </h1>

      <div className="flex flex-col items-center space-y-3">
        <div className="relative w-28 h-28 rounded-3xl overflow-hidden shadow-md border-2 border-white bg-gray-200">
          <img
            src={profile.avatar_url || defaultAvatar}
            alt={profile.name || "Аватар"}
            className="w-full h-full object-cover"
          />

          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold">
              ...
            </div>
          )}
        </div>

        <label className="cursor-pointer bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold py-2 px-4 rounded-xl border border-gray-200 shadow-sm transition">
          {uploading ? "Загружаем..." : "Изменить главное фото"}

          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {message && (
        <div
          className={
            "p-3 rounded-2xl text-xs font-semibold text-center " +
            (message.type === "success"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
              : "bg-rose-50 text-rose-600 border border-rose-100")
          }
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-900">
            {"Дополнительные фото (" + photos.length + "/5)"}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 group"
            >
              <img
                src={photo.url}
                alt=""
                className="w-full h-full object-cover"
              />

              <button
                type="button"
                onClick={() => handleDeletePhoto(photo.id)}
                className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center transition cursor-pointer"
              >
                x
              </button>
            </div>
          ))}

          {photos.length < 5 && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-400 flex items-center justify-center cursor-pointer transition bg-gray-50/50">
              <span className="text-2xl text-gray-300">
                {uploadingPhoto ? "..." : "+"}
              </span>

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleGalleryPhotoUpload}
                disabled={uploadingPhoto}
              />
            </label>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4"
      >
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Имя
          </label>

          <input
            type="text"
            value={profile.name}
            onChange={(e) =>
              setProfile({
                ...profile,
                name: e.target.value,
              })
            }
            placeholder="Ваше имя"
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Возраст
            </label>

            <input
              type="number"
              value={profile.age}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  age: e.target.value,
                })
              }
              placeholder="Лет"
              min={18}
              max={100}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Рост, см
            </label>

            <input
              type="number"
              value={profile.height}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  height: e.target.value,
                })
              }
              placeholder="Например, 170"
              min={100}
              max={250}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Пол
          </label>
          <select
            value={profile.gender}
            onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
            className={selectClass}
          >
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt} value={opt === "Не указано" ? "" : opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Я здесь для
          </label>
          <select
            value={profile.dating_goal}
            onChange={(e) => setProfile({ ...profile, dating_goal: e.target.value })}
            className={selectClass}
          >
            <option value="">Не указано</option>
            {DATING_GOALS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Город
          </label>

          <input
            type="text"
            value={profile.city}
            onChange={(e) =>
              setProfile({
                ...profile,
                city: e.target.value,
              })
            }
            placeholder="Например, Челябинск"
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Сфера работы
          </label>

          <input
            type="text"
            value={profile.occupation}
            onChange={(e) =>
              setProfile({
                ...profile,
                occupation: e.target.value,
              })
            }
            placeholder="Например, IT, дизайн, медицина..."
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Местоположение
          </label>

          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={locationStatus === "loading"}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-100 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {locationStatus === "loading"
              ? "Определяем..."
              : locationStatus === "done"
              ? "Местоположение обновлено (готово)"
              : "Определить моё местоположение"}
          </button>

          <p className="text-[10px] text-gray-400 mt-1">
            Нужно, чтобы показывать расстояние до других людей
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            О себе
          </label>

          <textarea
            value={profile.bio}
            onChange={(e) =>
              setProfile({
                ...profile,
                bio: e.target.value,
              })
            }
            placeholder="Расскажите о себе..."
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">
            Интересы (через запятую)
          </label>

          <input
            type="text"
            value={profile.interestsText}
            onChange={(e) =>
              setProfile({
                ...profile,
                interestsText: e.target.value,
              })
            }
            placeholder="Например: Кофе, ИТ, Настолки"
            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
          />
        </div>

        <div className="pt-2 border-t border-gray-100 space-y-4">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
            Подробнее о вас
          </h3>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Мировоззрение
            </label>
            <select
              value={profile.worldview}
              onChange={(e) => setProfile({ ...profile, worldview: e.target.value })}
              className={selectClass}
            >
              {WORLDVIEWS.map((opt) => (
                <option key={opt} value={opt === "Не указано" ? "" : opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Знак зодиака
            </label>
            <select
              value={profile.zodiac_sign}
              onChange={(e) => setProfile({ ...profile, zodiac_sign: e.target.value })}
              className={selectClass}
            >
              <option value="">Не указано</option>
              {ZODIAC_SIGNS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Образование
            </label>
            <select
              value={profile.education}
              onChange={(e) => setProfile({ ...profile, education: e.target.value })}
              className={selectClass}
            >
              {EDUCATION_LEVELS.map((opt) => (
                <option key={opt} value={opt === "Не указано" ? "" : opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Дети
            </label>
            <select
              value={profile.children}
              onChange={(e) => setProfile({ ...profile, children: e.target.value })}
              className={selectClass}
            >
              {CHILDREN_OPTIONS.map((opt) => (
                <option key={opt} value={opt === "Не указано" ? "" : opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Языки (через запятую)
            </label>
            <input
              type="text"
              value={profile.languages}
              onChange={(e) => setProfile({ ...profile, languages: e.target.value })}
              placeholder="Например: Русский, Английский"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Алкоголь
            </label>
            <select
              value={profile.alcohol}
              onChange={(e) => setProfile({ ...profile, alcohol: e.target.value })}
              className={selectClass}
            >
              {HABIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt === "Не указано" ? "" : opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Курение
            </label>
            <select
              value={profile.smoking}
              onChange={(e) => setProfile({ ...profile, smoking: e.target.value })}
              className={selectClass}
            >
              {HABIT_OPTIONS.map((opt) => (
                <option key={opt} value={opt === "Не указано" ? "" : opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 text-white font-bold py-3 rounded-2xl text-xs shadow-lg transition cursor-pointer disabled:opacity-50"
        >
          {saving ? "Сохранение..." : "Сохранить профиль"}
        </button>
      </form>
    </main>
  );
}
