// Сжатие картинок в браузере перед загрузкой в Supabase Storage.
// Если что-то пошло не так — возвращаем исходный файл, загрузка не ломается.

interface CompressOptions {
  maxSize?: number; // максимальная длинная сторона, px
  quality?: number; // 0..1
}

export async function compressImage(
  file: File,
  { maxSize = 1600, quality = 0.82 }: CompressOptions = {}
): Promise<File> {
  try {
    // Не трогаем видео, gif (анимация) и svg
    if (!file.type.startsWith("image/")) return file;
    if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
    // Совсем маленькие файлы не сжимаем
    if (file.size < 200 * 1024) return file;

    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // Белый фон на случай прозрачного PNG
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );

    // Если сжатый вариант не меньше исходного — оставляем исходный
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch (err) {
    console.error("Не удалось сжать изображение, грузим оригинал:", err);
    return file;
  }
}