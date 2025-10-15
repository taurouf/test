import { kv } from '@vercel/kv';

const KEY = (env) => `whitelist:${env}`; // whitelist:staging | whitelist:production

export async function getWhitelist(env) {
  const list = await kv.get(KEY(env));
  return Array.isArray(list) ? list : [];
}

export async function addToWhitelist(env, id) {
  id = String(id).trim();
  const list = new Set(await getWhitelist(env));
  list.add(id);
  await kv.set(KEY(env), [...list]);
  return [...list];
}

export async function removeFromWhitelist(env, id) {
  id = String(id).trim();
  const list = new Set(await getWhitelist(env));
  list.delete(id);
  await kv.set(KEY(env), [...list]);
  return [...list];
}
