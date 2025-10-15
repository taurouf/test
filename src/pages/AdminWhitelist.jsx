import { useEffect, useState } from 'react';

const API = '/api/admin/whitelist';
const AUTH = () => ({ Authorization: 'Bearer ' + (localStorage.getItem('admin_pwd') || '') });

export default function AdminWhitelist() {
  const [env, setEnv] = useState(localStorage.getItem('env') || 'staging');
  const [pwd, setPwd] = useState(localStorage.getItem('admin_pwd') || '');
  const [list, setList] = useState([]);
  const [id, setId] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setError('');
    const r = await fetch(`${API}?env=${env}`, { headers: AUTH() });
    if (!r.ok) { setError('Accès refusé'); setList([]); return; }
    const j = await r.json();
    setList(j.whitelist || []);
  }

  useEffect(() => { load(); }, [env]);

  function savePwd(v) {
    setPwd(v);
    localStorage.setItem('admin_pwd', v);
  }
  function saveEnv(v) {
    setEnv(v);
    localStorage.setItem('env', v);
  }

  async function add() {
    if (!id) return;
    const r = await fetch(`${API}?env=${env}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH() },
      body: JSON.stringify({ id })
    });
    if (!r.ok) { setError('Erreur ajout'); return; }
    setId(''); load();
  }

  async function remove(id) {
    const r = await fetch(`${API}?env=${env}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...AUTH() },
      body: JSON.stringify({ id })
    });
    if (!r.ok) { setError('Erreur suppression'); return; }
    load();
  }

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Whitelist restaurants</h1>

      <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">Environnement</label>
          <select value={env} onChange={(e)=>saveEnv(e.target.value)} className="border p-2 rounded w-full">
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm mb-1">Mot de passe admin</label>
          <input
            type="password"
            value={pwd}
            onChange={(e)=>savePwd(e.target.value)}
            className="border p-2 rounded w-full"
            placeholder="ADMIN_PASSWORD"
          />
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        <input
          value={id}
          onChange={e=>setId(e.target.value)}
          className="border p-2 rounded flex-1"
          placeholder="Ajouter un id_restaurant (ex: 5146)"
        />
        <button onClick={add} className="px-4 py-2 rounded bg-black text-white">Ajouter</button>
        <button onClick={load} className="px-4 py-2 rounded border">Rafraîchir</button>
      </div>

      {error && <p className="text-red-600 mb-3">{error}</p>}

      <ul className="space-y-2">
        {list.map((rid) => (
          <li key={rid} className="border p-3 rounded flex items-center justify-between">
            <span className="font-mono">{rid}</span>
            <button onClick={()=>remove(rid)} className="text-sm text-red-600">Supprimer</button>
          </li>
        ))}
        {!list.length && <li className="text-gray-500">Aucun id autorisé pour {env}.</li>}
      </ul>
    </div>
  );
}
