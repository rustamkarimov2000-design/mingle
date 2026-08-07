"use client";

import { useState } from "react";
import Link from "next/link";

export default function AIAssistantPage() {
  const [selectedTopic, setSelectedTopic] = useState("Кофе");
  const [selectedStyle, setSelectedStyle] = useState("Оригинальный");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customBio, setCustomBio] = useState("");
  const [analyzedIdeas, setAnalyzedIdeas] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Категории и стили
  const topics = ["Кофе", "IT", "Настолки", "Путешествия", "Музыка", "Спорт"];
  const styles = ["Оригинальный", "Флирт", "Умный"];

  // Расширенная база фраз (по 3-4 варианта на каждый кейс)
  const templates: Record<string, Record<string, string[]>> = {
    Кофе: {
      Оригинальный: [
        "Если бы твоё идеальное утро было напитком, это был бы раф, флэт уайт или просто «не трогайте меня до обеда»? ☕️",
        "Слышал, что кофе раскрывает характер. Твой выбор — это чистая классика или эксперименты с альтернативой?",
        "Какая кофейня в городе, по твоему мнению, незаслуженно недооценена?",
      ],
      Флирт: [
        "Я знаю отличную кофейню в центре, но готов(а) пойти туда только при условии, что ты расскажешь свой главный секрет 😉",
        "Говорят, лучший кофе — тот, который пьёшь в хорошей компании. Проверим?",
        "Пить кофе в одиночку — скучно. Давай исправим это на этой неделе?",
      ],
      Умный: [
        "Интересный факт: обжарка кофе меняет молекулярный состав зерна. Какую степень предпочитаешь ты?",
        "Альтернативные способы заваривания (V60, аэропресс) или классический эспрессо из машины?",
        "Как думаешь, атмосфера в кофейне влияет на вкус напитка или это чисто маркетинг?",
      ],
    },
    IT: {
      Оригинальный: [
        "Ты выглядишь как человек, у которого нет багов в коде, только незадокументированные фичи 💻✨",
        "Наш мэтч — это чистый сукцесс. На каком стеке пишем наши отношения?",
        "Что проще: сверстать пиксель-перфект макет с первого раза или выбрать фильм на вечер?",
      ],
      Флирт: [
        "Мой алгоритм сработал на 100%, когда я увидел(а) твой профиль. Кажется, тут любовь с первого коммита 😉",
        "Кажется, между нами возник рефакторинг — всё сразу стало понятнее и лучше ✨",
        "Ты случайно не новейшая языковая модель? Потому что ты отвечаешь на все мои запросы 😊",
      ],
      Умный: [
        "Если бы мы писали архитектуру нашего идеального вечера, какие сервисы мы бы подключили в первую очередь?",
        "Как относишься к концепции Work-Life Balance в современной IT-сфере?",
        "Какой проект был самым сложным или интересным в твоем опыте?",
      ],
    },
    Настолки: {
      Оригинальный: [
        "Правило первого хода: кто последним пил кофе или у кого самый оригинальный профиль? Думаю, ходить тебе 🎲",
        "В какую настолку ты готов(а) играть хоть до 3 часов ночи и никому не уступать победу?",
        "Кооператив, где мы в одной команде, или хардкорная стратегия против всех?",
      ],
      Флирт: [
        "Готов(а) сыграть со мной партию? Проигравший покупает нам какао 😊",
        "У меня есть пара крутых настолок, но не хватает идеального второго игрока...",
        "Ты выглядишь как человек, который умеет блефовать в мафии. Я прав(а)? 😉",
      ],
      Умный: [
        "Какая механика в настолках тебе ближе: чистая стратегия, дефбилдинг или блеф?",
        "Как относишься к длинным партийным евро-играм вроде Catan или Scythe?",
        "Настолки с кубиками (рандом) или чистая математика и расчет?",
      ],
    },
    Путешествия: {
      Оригинальный: [
        "Если бы у тебя был телепорт на 24 часа без лимитов, где бы мы сейчас пили чай?",
        "Чемодан за 15 минут до вылета или списки за месяц до отпуска? Какой ты тип путешественника?",
        "Горы с палатками и трекингом или уютный отель у моря?",
      ],
      Флирт: [
        "В моем списке желаний на этот год появилось новое место — кофе с тобой в уютном месте ✈️",
        "Ищу напарника для спонтанного побега из города на выходные. Как у тебя с графиком?",
        "Кажется, я нашел(шла) самый красивый пункт назначения в этом приложении ✨",
      ],
      Умный: [
        "Что для тебя важнее в поездках: погружение в местную культуру или чистый отдых от городской суеты?",
        "Какая страна или город произвели на тебя самое сильное эмоциональное впечатление?",
        "Самостоятельное планирование сложных маршрутов или готовые туры?",
      ],
    },
    Музыка: {
      Оригинальный: [
        "Какой трек у тебя сейчас на бесконечном повторе в плеере?",
        "Если бы о твоей жизни снимали фильм, какая музыка звучала бы в опенинге?",
        "Концерты на стадионах или камерные сеты в небольших барах?",
      ],
      Флирт: [
        "Поделись любимым треком, а я скажу, насколько у нас совпадает вайб 😉",
        "Кажется, у нас может получиться отличный дуэт. Какую песню споем первой?",
        "Твой музыкальный вкус точно украсит мой плейлист ✨",
      ],
      Умный: [
        "Живые концерты и акустика или виниловые пластинки с ламповым звуком дома?",
        "Как относишься к смешению жанров в современной музыке?",
        "Музыка для фона во время работы или осознанное прослушивание альбомами?",
      ],
    },
    Спорт: {
      Оригинальный: [
        "Какая тренировка дает тебе максимальный заряд эндорфинов?",
        "Утренний пробег или вечерняя перезагрузка в зале?",
        "Экстремальный спорт или размеренный фитнес?",
      ],
      Флирт: [
        "Ищу компанию для совместных спортивных побед. Ты как к этому относишься?",
        "Говорят, совместный спорт сближает. Проверим на этой неделе? 😉",
        "Ты выглядишь очень спортивно! Поделишься секретом дисциплины?",
      ],
      Умный: [
        "Как относишься к трекингу показателей активности (пульс, фазы сна, калории)?",
        "Баланс между силовыми нагрузками и кардио: в какую сторону твой перевес?",
        "Спорт для здоровья и энергии или для достижения конкретных результатов?",
      ],
    },
  };

  // Храним ТРИ сгенерированные фразы
  const [generatedPhrases, setGeneratedPhrases] = useState<string[]>(
    templates["Кофе"]["Оригинальный"]
  );

  // Генерация 3 фраз
  const handleGenerate = (topic = selectedTopic, style = selectedStyle) => {
    const pool = templates[topic]?.[style] || [
      `Привет! Давай пообщаемся на тему ${topic.toLowerCase()}! ✨`,
      `Увидал(а) твой профиль, захотелось спросить про ${topic.toLowerCase()} 😊`,
      `Кажется, у нас есть общий интерес — ${topic.toLowerCase()}!`,
    ];

    // Перемешиваем и отдаем ВСЕ 3 фразы
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    setGeneratedPhrases(shuffled.slice(0, 3));
  };

  const handleSelectTopic = (topic: string) => {
    setSelectedTopic(topic);
    handleGenerate(topic, selectedStyle);
  };

  const handleSelectStyle = (style: string) => {
    setSelectedStyle(style);
    handleGenerate(selectedTopic, style);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Разбор текста Bio
  const handleAnalyzeBio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBio.trim()) return;

    setIsAnalyzing(true);
    setTimeout(() => {
      const words = customBio.trim().split(" ");
      const keyword = words[Math.floor(Math.random() * words.length)] || "интересы";

      const generated = [
        `«Подметил(а) в твоем описании про "${customBio.slice(0, 20)}...". Это супер! А как давно ты этим увлекаешься?»`,
        `«Твое био звучит очень драйвово! Особенно зацепило слово "${keyword}". Расскажешь подробнее?»`,
        `«Увидел(а) твой профиль и не мог(ла) не написать. Кажется, у нас схожий вайб ✨»`,
      ];
      setAnalyzedIdeas(generated);
      setIsAnalyzing(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* Шапка */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-extrabold tracking-wider text-gray-900">
              MINGLE
            </Link>
            <span className="text-xs text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full font-bold border border-pink-100">
              🤖 AI Wingman
            </span>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-gray-600 hover:text-pink-600 bg-gray-50 px-3.5 py-2 rounded-full border border-gray-100 transition"
          >
            ← На главную
          </Link>
        </div>
      </header>

      {/* Контент */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* Баннер */}
        <div className="bg-gradient-to-r from-pink-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg space-y-2">
          <span className="text-2xl">✨</span>
          <h1 className="text-xl sm:text-2xl font-black">AI-Генератор Первых Фраз</h1>
          <p className="text-xs text-pink-100 max-w-lg leading-relaxed">
            Выбирай тему и вайб, чтобы получить сразу 3 варианты первых сообщений для знакомства.
          </p>
        </div>

        {/* Блок 1: Генерация по теме и стилю */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              1. Подбор фраз по темам
            </h2>
            <button
              onClick={() => handleGenerate()}
              className="text-xs font-bold text-pink-600 hover:text-pink-700 bg-pink-50 px-3 py-1.5 rounded-xl transition cursor-pointer"
            >
              🎲 Сгенерировать еще
            </button>
          </div>

          {/* ТЕМЫ */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-2">Тема:</label>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleSelectTopic(topic)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    selectedTopic === topic
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100"
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* ВАЙБ */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 mb-2">Стиль общения:</label>
            <div className="flex flex-wrap gap-2">
              {styles.map((style) => (
                <button
                  key={style}
                  onClick={() => handleSelectStyle(style)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    selectedStyle === style
                      ? "bg-pink-600 text-white"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* РЕЗУЛЬТАТ (3 Варианта) */}
          <div className="space-y-3 pt-2">
            <label className="block text-[11px] font-bold text-gray-400">Сгенерированные варианты ({generatedPhrases.length}):</label>
            {generatedPhrases.map((phrase, idx) => {
              const id = `gen-phrase-${idx}`;
              const isCopied = copiedId === id;

              return (
                <div
                  key={id}
                  className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-between gap-4 group hover:border-pink-200 transition"
                >
                  <p className="text-xs text-gray-800 leading-relaxed font-medium">{phrase}</p>
                  <button
                    onClick={() => handleCopy(phrase, id)}
                    className={`shrink-0 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer ${
                      isCopied
                        ? "bg-emerald-500 text-white"
                        : "bg-white text-gray-700 hover:bg-pink-600 hover:text-white border border-gray-200 shadow-xs"
                    }`}
                  >
                    {isCopied ? "Скопировано! ✓" : "Копировать"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Блок 2: Разбор Bio */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div>
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              2. Генерация под чужие интересы (Bio)
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Вставь сюда текст из профиля человека, чтобы получить 3 зацепочки.
            </p>
          </div>

          <form onSubmit={handleAnalyzeBio} className="space-y-3">
            <textarea
              value={customBio}
              onChange={(e) => setCustomBio(e.target.value)}
              placeholder="Например: Люблю спешелти кофе, настолки, веб-разработку и прогулки..."
              rows={3}
              className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-3.5 text-xs text-gray-800 focus:outline-none focus:border-pink-300 resize-none"
            />
            <button
              type="submit"
              disabled={isAnalyzing || !customBio.trim()}
              className="bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-xs font-bold px-5 py-2.5 rounded-2xl transition cursor-pointer flex items-center gap-2"
            >
              {isAnalyzing ? "AI генерирует..." : "Сгенерировать 3 варианта ⚡️"}
            </button>
          </form>

          {/* Результат генерации Bio */}
          {analyzedIdeas.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-50">
              <span className="text-[11px] font-bold text-gray-400">Результаты генерации ({analyzedIdeas.length}):</span>
              {analyzedIdeas.map((idea, idx) => {
                const id = `bio-idea-${idx}`;
                const isCopied = copiedId === id;

                return (
                  <div
                    key={id}
                    className="p-3.5 bg-pink-50/40 border border-pink-100 rounded-2xl flex items-center justify-between gap-3"
                  >
                    <p className="text-xs text-gray-800 font-medium">{idea}</p>
                    <button
                      onClick={() => handleCopy(idea, id)}
                      className="text-[11px] font-bold text-pink-600 hover:underline shrink-0 cursor-pointer"
                    >
                      {isCopied ? "Скопировано!" : "Копировать"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}