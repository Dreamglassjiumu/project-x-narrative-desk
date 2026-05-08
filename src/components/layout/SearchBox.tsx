export function SearchBox({ value, onChange, placeholder = '案件索引搜索：角色 / 帮派 / 区域 / 剧本' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block min-w-[280px]">
      <span className="sr-only">Search</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border border-brass/30 bg-black/25 px-4 py-2 font-mono text-sm text-ivory placeholder:text-paper/40 outline-none transition focus:border-brass focus:shadow-glow"
      />
    </label>
  );
}
