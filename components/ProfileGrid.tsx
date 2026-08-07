import ProfileCard from "./ProfileCard";

const profiles = [
  {
    id: 1,
    name: "Анна",
    age: 24,
    city: "Москва",
    compatibility: 94,
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900",
  },
  {
    id: 2,
    name: "Мария",
    age: 27,
    city: "Санкт-Петербург",
    compatibility: 89,
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=900",
  },
  {
    id: 3,
    name: "Ева",
    age: 23,
    city: "Казань",
    compatibility: 97,
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=900",
  },
];

export default function ProfileGrid() {
  return (
    <section className="flex justify-center">
      <ProfileCard
        name={profiles[0].name}
        age={profiles[0].age}
        city={profiles[0].city}
        compatibility={profiles[0].compatibility}
        image={profiles[0].image}
      />
    </section>
  );
}