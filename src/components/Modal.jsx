function Modal({ open, onClose, title, children, kind = "info" }) {
  if (!open) return null;
  const styles = {
    success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    error: "bg-rose-50 text-rose-800 ring-rose-200",
    info: "bg-sky-50 text-sky-800 ring-sky-200",
  }[kind] || "bg-white text-slate-800 ring-slate-200";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className={`w-full max-w-lg rounded-2xl ring-1 ${styles} shadow-xl`}>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="grow">
              <h3 className="font-semibold text-lg">{title}</h3>
              <div className="mt-2 text-[15px] leading-relaxed">{children}</div>
              <div className="mt-5 flex justify-end">
                <button
                  onClick={onClose}
                  className="rounded-lg bg-white/70 hover:bg-white px-4 py-2 text-sm font-medium ring-1 ring-black/10"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Modal;
