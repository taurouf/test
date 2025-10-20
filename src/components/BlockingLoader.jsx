function BlockingLoader({ show, label = "Chargement…" }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-3 shadow-lg ring-1 ring-slate-200">
        <svg className="h-5 w-5 animate-spin text-[#082C49]" viewBox="0 0 24 24">
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="text-[#082C49] font-medium">{label}</span>
      </div>
    </div>
  );
}

export default BlockingLoader;
