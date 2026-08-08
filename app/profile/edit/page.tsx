"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  id: string;
  name: string;
  age: number | string;
  bio: string;
  city?: string;
  occupation?: string;
  avatar_url: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface Photo {
  id: string;
  url: string;
  position: number;
}

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [profile, setProfile] = useState<UserProfile>({
    id: "",
    name: "",
    age: "",
    bio: "",
    city: "",
    occupation: "",
    avatar_url: "",
    latitude: null,
    longitude: null,
  });

  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

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
          age: data.age || "",
          bio: data.bio || "",
          city: data.city || "",
          occupation: data.occupation || "",
          avatar_url: data.avatar_url || data.avatar || "",
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        });
        if (data.latitude && data.longitude) {
          setLocationStatus("done");
        }
      } else if (error) {
        console.error("Ошибка при получении профиля:", error);
      } else {
        setProfile((prev) => ({ ...prev, id: user.id }));
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
  }, []);

  const handleBack = () => {
    window.location.href = "/profile";
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ text: "Ваш браузер не поддерживает геолокацию", type: "error" });
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
        setMessage({ text: "Местоположение определено! Не забудьте сохранить.", type: "success" });
      },
      () => {
        setLocationStatus("error");
        setMessage({ text: "Не удалось определить местоположение. Разрешите доступ в браузере.", type: "error" });
      }
    );
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile.id) return;

    try {
      setUploading(true);
      setMessage(null);

      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setProfile((prev) => ({ ...prev, avatar_url: publicUrl }));
      setMessage({ text: "Фото загружено! Не забудьте сохранить.", type: "success" });
    } catch (err: any) {
      console.error("Ошибка загрузки фото:", err);
      setMessage({
        text: `Ошибка загрузки: ${err.message || "Проверьте права бакета avatars"}`,
        type: "error"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryPhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile.id) return;

    if (photos.length >= 5) {
      setMessage({ text: "Максимум 5 дополнительных фото", type: "error" });
      return;
    }

    try {
      setUploadingPhoto(true);
      setMessage(null);

      const fileExt = file.name.split(".").pop();
      const filePath = `${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("photos")
        .getPublicUrl(filePath);

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
      setMessage({ text: "Фото добавлено в галерею!", type: "success" });
    } catch (err: any) {
      console.error("Ошибка загрузки фото в галерею:", err);
      setMessage({ text: `Ошибка: ${err.message}`, type: "error" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    const { error } = await supabase.from("photos").delete().eq("id", photoId);

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

    const updates = {
      id: profile.id,
      name: profile.name,
      age: profile.age ? Number(profile.age) : null,
      bio: profile.bio,
      city: profile.city,
      avatar_url: profile.avatar_url,
      avatar: profile.avatar_url,
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(updates, { onConflict: "id" });

    if (error) {
      console.error("Ошибка сохранения профиля:", error);
      setMessage({ text: `Ошибка при сохранении: ${error.message}`, type: "error" });
      setSaving(false);
    } else {
      setMessage({ text: "Профиль сохранен! Возвращаемся...", type: "success" });
      setTimeout(() => {
        window.location.href = "/profile";
      }, 800);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center text-xs text-gray-400 font-medium animate-pulse">
        Загрузка редактирования...
      </div>
    );
  }

  const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500";

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-800 pb-12">
      <header className="w-full max-w-md mx-auto px-6 h-16 flex items-center justify-between relative z-50">
        <button
          type="button"
          onClick={handleBack}
          className="text-xs font-bold text-gray-500 hover:text-pink-600 transition py-2 pr-4 cursor-pointer flex items-center gap-1 active:scale-95"
        >
          ← Назад в профиль
        </button>
        <span className="text-sm font-black tracking-wider text-gray-900">РЕДАКТИРОВАНИЕ</span>
        <div className="w-8"></div>
      </header>

      <main className="max-w-md mx-auto px-4 space-y-6">
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
            className={`p-3 rounded-2xl text-xs font-semibold text-center ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-rose-50 text-rose-600 border border-rose-100"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-900">
              Дополнительные фото ({photos.length}/5)
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 group">
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white w-5 h-5 rounded-full text-[10px] flex items-center justify-center transition cursor-pointer"
                >
                  ✕
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

        <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Имя</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Ваше имя"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Возраст</label>
            <input
              type="number"
              value={profile.age}
              onChange={(e) => setProfile({ ...profile, age: e.target.value })}
              placeholder="Сколько вам лет?"
              min={18}
              max={100}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Город</label>
            <input
              type="text"
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              placeholder="Ваш город"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">Местоположение</label>
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={locationStatus === "loading"}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-100 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              📍{" "}
              {locationStatus === "loading"
                ? "Определяем..."
                : locationStatus === "done"
                ? "Местоположение обновлено ✓"
                : "Определить моё местоположение"}
            </button>
            <p className="text-[10px] text-gray-400 mt-1">
              Нужно, чтобы показывать расстояние до других людей
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">О себе</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Расскажите о себе..."
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-pink-500 transition resize-none"
            />
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
    </div>
  );
}