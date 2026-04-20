// ✅ 수정: isLoading 여부와 관계없이 항상 hidden을 붙이던 버그 수정
//         - isLoading=true  → hidden 유지 (로딩 오버레이가 대신 표시하므로)
//         - isLoading=false → hidden 제거하여 텍스트 노출
//         - text가 없으면 → hidden
function setStatus(text, isLoading = false) {
  const el = document.getElementById('statusText');
  if (!el) return;

  if (!text) {
    el.textContent = '';
    el.classList.add('hidden');
    return;
  }

  el.textContent = text;
  el.classList.toggle('loading', !!isLoading);

  if (isLoading) {
    // 로딩 중엔 오버레이가 화면을 덮고 있으므로 statusText는 숨김 유지
    el.classList.add('hidden');
  } else {
    // 로딩 완료 후엔 결과 텍스트를 화면에 표시
    el.classList.remove('hidden');
  }
}

function showErrorPopup(message) {
  const msg = String(message || '오류가 발생했습니다.');
  window.alert(msg);
}

function setSearchButtonLoading(loading) {
  const btn = document.getElementById('searchBtn');
  if (!btn) return;

  btn.disabled = !!loading;
  btn.classList.toggle('loading', !!loading);
  btn.textContent = loading ? '조회중' : '조회';
}

function showLoadingOverlay(title, message) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;

  const titleEl = document.getElementById('loadingTitle');
  const msgEl = document.getElementById('loadingMessage');

  if (titleEl) titleEl.textContent = title || '불러오는 중';
  if (msgEl) msgEl.textContent = message || '처리 중입니다.';

  overlay.classList.remove('hidden');
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;

  overlay.classList.add('hidden');
}

function showAdminLoading(title, message) {
  showLoadingOverlay(title || '처리 중', message || '관리자 작업을 진행하고 있습니다.');
}

function hideAdminLoading() {
  hideLoadingOverlay();
}

function clearResults() {
  const summaryArea = document.getElementById('summaryArea');
  const groupArea = document.getElementById('groupArea');

  if (summaryArea) summaryArea.innerHTML = '';
  if (groupArea) groupArea.innerHTML = '';
}

function resetSearchUI() {
  const keywordEl = document.getElementById('keyword');
  const examTypeEl = document.getElementById('examType');

  if (document.activeElement) {
    document.activeElement.blur();
  }

  if (keywordEl) {
    keywordEl.value = '';
    keywordEl.style.height = '';
    keywordEl.classList.remove('highlighted');
  }

  if (examTypeEl) {
    examTypeEl.selectedIndex = 0;
    examTypeEl.value = '';
  }

  clearResults();
  hideAutocomplete(true);

  clearTimeout(state.autoTimer);
  clearTimeout(state.highlightTimer);

  state.autocompleteCache.clear();
  state.autocompleteRequestSeq += 1;
  state.lastAutocompleteKeyword = '';
  state.isSearching = false;
  state.suppressBlurHide = false;
  state.pendingAutocompleteKeyword = '';
  state.renderedAutocompleteKeyword = '';
  state.autocompleteActiveIndex = -1;

  setSearchButtonLoading(false);
  setStatus('');
}
