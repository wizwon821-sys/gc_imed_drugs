async function apiGet(action, params = {}) {
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value == null ? '' : String(value));
  });

  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow'
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = await res.json();

  if (!data || typeof data !== 'object') {
    throw new Error('응답 형식이 올바르지 않습니다.');
  }

  return data;
}

async function apiPost(action, payload = {}) {
  return await apiGet(action, payload);
}

async function apiPostRaw(body = {}) {
  const { action, ...params } = body || {};
  return await apiGet(action, params);
}
