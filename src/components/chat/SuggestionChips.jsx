const chips = [
  "Best React Native Expo tutorial",
  "Python beginner course",
  "JavaScript under 30 minutes",
  "Learn Blender",
];

export default function SuggestionChips({ onPick }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-wrap justify-center gap-2.5">
      {chips.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className="border-2 border-black bg-white px-3.5 py-2 text-sm font-semibold text-black shadow-[3px_3px_0_0_#000] transition-all nb-press hover:bg-brand"
        >
          {c}
        </button>
      ))}
    </div>
  );
}