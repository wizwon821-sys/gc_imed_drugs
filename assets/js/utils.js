function getValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function getViewportWidth() {
  const values = [
    window.innerWidth,
    document.documentElement ? document.documentElement.clientWidth : null,
    window.visualViewport ? Math.round(window.visualViewport.width) : null
  ].filter(v => Number.isFinite(v) && v > 0);

  return values.length ? Math.min(...values) : 390;
}

function syncAppWidth() {
  const px = getViewportWidth();
  document.documentElement.style.setProperty('--app-width', px + 'px');
  document.documentElement.style.setProperty('--app-inner-gap', px <= 820 ? '0px' : '8px');
}

function splitMultiInputTokens(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\n+/g, ' ')
    .split(/[,\s]+/)
    .map(v => v.trim())
    .filter(Boolean);
}

function dedupeTokens(tokens) {
  const seen = new Set();
  return tokens.filter(token => {
    const key = normalizeKeyword(token);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getLastToken(text) {
  const tokens = splitMultiInputTokens(text);
  return tokens.length ? tokens[tokens.length - 1] : '';
}

function normalizeKeyword(text) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '');
}

function rebuildKeywordText(tokens) {
  return dedupeTokens(tokens).join(', ');
}

function getErrorMessage(err) {
  return err && err.message ? err.message : String(err || '알 수 없는 오류');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeJs(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}
