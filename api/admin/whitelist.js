import { getWhitelist, addToWhitelist, removeFromWhitelist } from '../_lib/whitelist';

function ok(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).end(JSON.stringify(data));
}

function bad(res, code = 400, message = 'Bad request') {
  res.setHeader('Content-Type', 'application/json');
  res.status(code).end(JSON.stringify({ error: message }));
}

function requireAdmin(req) {
  const expected = process.env.ADMIN_PASSWORD;
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return expected && got && got === expected;
}

export default async function handler(req, res) {
  try {
    if (!requireAdmin(req)) return bad(res, 401, 'Unauthorized');

    const env = (req.query.env || process.env.APP_ENV || 'staging').toString();
    if (!['staging', 'production'].includes(env)) return bad(res, 400, 'env must be staging|production');

    if (req.method === 'GET') {
      const list = await getWhitelist(env);
      return ok(res, { env, whitelist: list });
    }

    if (req.method === 'POST') {
      const { id } = req.body || {};
      if (!id) return bad(res, 422, 'id is required');
      const list = await addToWhitelist(env, id);
      return ok(res, { env, whitelist: list });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return bad(res, 422, 'id is required');
      const list = await removeFromWhitelist(env, id);
      return ok(res, { env, whitelist: list });
    }

    return bad(res, 405, 'Method not allowed');
  } catch (e) {
    console.error(e);
    return bad(res, 500, 'Server error');
  }
}
