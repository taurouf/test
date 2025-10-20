function Input({ label, v, set, ...rest }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input mt-1" value={v} onChange={(e) => set(e.target.value)} {...rest} />
    </label>
  );
}

export default Input;
