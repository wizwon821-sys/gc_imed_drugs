const UI_LOADING_DELAY = 750;

const INIT_CACHE_KEY = 'gc_init_v1';
const INIT_CACHE_TTL = 30 * 60 * 1000; // 30분

async function initializeApp() {
  state.isInitializing = true;
  showLoadingOverlay('초기 데이터 불러오는 중', '약물 및 검사 정보를 준비하고 있습니다.');
  setStatus('초기 데이터를 불러오는 중입니다...', true);

  try {
    const cached = loadInitCache_();
    if (cached) {
      applyInitData_(cached);
      return;
    }

    const url = new URL(API_BASE);
    url.searchParams.set('action', 'init');

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json();

    if (!data.success) {
      state.isInitializing = false;
      hideLoadingOverlay();
      showErrorPopup(data.message || '초기화에 실패했습니다.');
      return;
    }

    saveInitCache_(data);
    applyInitData_(data);

  } catch (err) {
    state.isInitializing = false;
    hideLoadingOverlay();
    showErrorPopup('초기화 중 오류가 발생했습니다: ' + getErrorMessage(err));
  }
}

function applyInitData_(data) {
  state.appConfig = data.config || {};
  state.examList = data.exams || [];
  state.drugGroupList = data.drugGroups || [];
  state.adminExamList = data.adminExams || [];
  state.adminDrugGroupList = data.adminDrugGroups || [];

  renderExamOptions();
  renderAdminOptions();
  applyConfig();

  state.isInitializing = false;
  hideLoadingOverlay();
  setStatus('약 이름만 입력해도 검색할 수 있습니다.');
}

function loadInitCache_() {
  try {
    const raw = sessionStorage.getItem(INIT_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > INIT_CACHE_TTL) {
      sessionStorage.removeItem(INIT_CACHE_KEY);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function saveInitCache_(data) {
  try {
    sessionStorage.setItem(INIT_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch (e) {
    // 용량 초과 등 무시
  }
}

function applyConfig() {
  const hospitalName = state.appConfig.hospital_name || '녹십자아이메드';
  const patientNotice = state.appConfig.patient_notice || '복용약은 임의로 중단하지 말고, 반드시 검진센터 또는 처방의와 상담 후 결정하세요.';
  const staffNotice = state.appConfig.staff_notice || '최종 안내 전 검사 종류와 환자 상태를 다시 확인하세요.';
  const contactPhone = state.appConfig.contact_phone || '';
  const contactText = contactPhone ? `<div class="contact">문의: ${escapeHtml(contactPhone)}</div>` : '';

  state.patientNotice = patientNotice;
  state.staffNotice = staffNotice;
  state.contactText = contactText;

  document.getElementById('footerNotice').innerHTML = `<div>${escapeHtml(patientNotice)}</div>${contactText}`;

  const brandTitle = document.querySelector('.brand-title');
  if (brandTitle) brandTitle.textContent = hospitalName;

  const heroModeLabel = document.getElementById('heroModeLabel');
  if (heroModeLabel) {
    heroModeLabel.classList.add('hidden');
    heroModeLabel.textContent = '환자용';
    heroModeLabel.classList.remove('staff');
  }

  const homeBtn = document.getElementById('homeBtn');
  if (homeBtn) homeBtn.classList.add('hidden');
}

function startPatientMode() {
  state.lockedMode = 'patient';
  startModeWithLoading('patient');
}

async function startStaffMode() {
  if (state.isSearching || state.isInitializing) return;

  const pw = window.prompt('직원용 조회 비밀번호를 입력하세요.');
  if (pw === null) return;

  if (!String(pw).trim()) {
    showErrorPopup('비밀번호를 입력해주세요.');
    return;
  }

  showLoadingOverlay('확인 중', '비밀번호를 확인하고 있습니다.');

  try {
    const res = await apiGet('verifyStaff', { password: String(pw).trim() });

    if (!res.success) {
      hideLoadingOverlay();
      showErrorPopup('비밀번호가 올바르지 않습니다.');
      return;
    }

    hideLoadingOverlay();
    state.lockedMode = 'staff';
    startModeWithLoading('staff');

  } catch (err) {
    hideLoadingOverlay();
    showErrorPopup('비밀번호 확인 중 오류가 발생했습니다: ' + getErrorMessage(err));
  }
}

function startModeWithLoading(mode) {
  if (state.isSearching || state.isInitializing) return;

  const title = mode === 'patient' ? '환자용 화면 준비 중' : '직원용 화면 준비 중';
  const message = mode === 'patient'
    ? '안내 화면으로 이동하고 있습니다.'
    : '조회 화면으로 이동하고 있습니다.';

  showLoadingOverlay(title, message);
  setStatus('화면을 준비하고 있습니다...', true);

  setTimeout(() => {
    document.getElementById('landingPanel').classList.add('hidden');
    document.getElementById('mainPanel').classList.remove('hidden');
    document.getElementById('homeBtn').classList.remove('hidden');

    if (mode === 'patient') {
      setMode('patient');
      simplifyPatientUI();
    } else {
      setMode('staff');
      restoreFullUI();
    }

    applyLockedModeUI();
    updateHeroModeLabel(mode);

    hideLoadingOverlay();
    setStatus(mode === 'patient' ? '환자용 안내 모드입니다.' : '직원용 조회 모드입니다.');

    setTimeout(() => {
      const keyword = document.getElementById('keyword');
      if (keyword) keyword.focus();
    }, 50);
  }, UI_LOADING_DELAY);
}

function goHome() {
  if (state.isSearching || state.isInitializing) return;

  showLoadingOverlay('처음 화면으로 이동 중', '입력 내용과 검색 결과를 정리하고 있습니다.');
  setStatus('처음 화면으로 이동 중입니다...', true);

  setTimeout(() => {
    resetSearchUI();

    document.getElementById('landingPanel').classList.remove('hidden');
    document.getElementById('mainPanel').classList.add('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('homeBtn').classList.add('hidden');

    state.currentMode = 'patient';
    state.lockedMode = null;
    state.isAdminLoggedIn = false;

    document.getElementById('adminModeBtn').classList.remove('active');
    document.getElementById('patientModeBtn').classList.add('active');
    document.getElementById('staffModeBtn').classList.remove('active');

    applyLockedModeUI();

    document.getElementById('footerNotice').innerHTML =
      `<div>${escapeHtml(state.patientNotice || '')}</div>${state.contactText || ''}`;

    const heroModeLabel = document.getElementById('heroModeLabel');
    if (heroModeLabel) {
      heroModeLabel.classList.add('hidden');
      heroModeLabel.textContent = '환자용';
      heroModeLabel.classList.remove('staff');
    }

    document.getElementById('adminPassword').value = '';
    document.getElementById('adminLoginStatus').textContent = '';
    document.getElementById('adminLoginArea').classList.add('hidden');
    document.getElementById('adminContentArea').classList.add('hidden');

    clearDrugForm();
    clearRuleForm();

    hideLoadingOverlay();
    window.scrollTo(0, 0);
  }, UI_LOADING_DELAY);
}

function simplifyPatientUI() {}
function restoreFullUI() {}

function applyLockedModeUI() {
  const patientBtn = document.getElementById('patientModeBtn');
  const staffBtn = document.getElementById('staffModeBtn');
  if (!patientBtn || !staffBtn) return;

  if (!state.lockedMode) {
    patientBtn.classList.remove('hidden');
    staffBtn.classList.remove('hidden');
    return;
  }

  if (state.lockedMode === 'patient') {
    patientBtn.classList.remove('hidden');
    staffBtn.classList.add('hidden');
  } else if (state.lockedMode === 'staff') {
    patientBtn.classList.add('hidden');
    staffBtn.classList.remove('hidden');
  }
}

function updateHeroModeLabel(mode) {
  const heroModeLabel = document.getElementById('heroModeLabel');
  if (!heroModeLabel) return;

  heroModeLabel.classList.remove('hidden');

  if (mode === 'staff') {
    heroModeLabel.textContent = '직원용';
    heroModeLabel.classList.add('staff');
  } else {
    heroModeLabel.textContent = '환자용';
    heroModeLabel.classList.remove('staff');
  }
}

function setMode(mode) {
  if (state.lockedMode && mode !== state.lockedMode) return;

  state.currentMode = mode;
  hideAutocomplete(true);

  document.getElementById('patientModeBtn').classList.toggle('active', mode === 'patient');
  document.getElementById('staffModeBtn').classList.toggle('active', mode === 'staff');
  document.getElementById('adminModeBtn').classList.remove('active');

  if (mode === 'patient') {
    document.getElementById('footerNotice').innerHTML =
      `<div>${escapeHtml(state.patientNotice || '')}</div>${state.contactText || ''}`;
    simplifyPatientUI();
  } else {
    document.getElementById('footerNotice').innerHTML =
      `<div>${escapeHtml(state.staffNotice || '')}</div>${state.contactText || ''}`;
    restoreFullUI();
  }

  document.getElementById('adminPanel').classList.add('hidden');
  clearResults();
}

function bindStaticEvents() {
  document.getElementById('startPatientBtn')?.addEventListener('click', startPatientMode);
  document.getElementById('startStaffBtn')?.addEventListener('click', startStaffMode);
  document.getElementById('homeBtn')?.addEventListener('click', goHome);

  document.getElementById('patientModeBtn')?.addEventListener('click', () => setMode('patient'));
  document.getElementById('staffModeBtn')?.addEventListener('click', () => setMode('staff'));
  document.getElementById('adminModeBtn')?.addEventListener('click', openAdminPanel);

  // ✅ 수정: 두 버튼 모두 이벤트 유지 — CSS 미디어쿼리로 화면 크기에 따라 표시/숨김
  document.getElementById('searchBtn')?.addEventListener('click', handleSearch);
  document.getElementById('searchBtnMobile')?.addEventListener('click', handleSearch);

  document.getElementById('adminLoginBtn')?.addEventListener('click', loginAdmin);

  document.getElementById('adminTabDrug')?.addEventListener('click', () => setAdminTab('drug'));
  document.getElementById('adminTabRule')?.addEventListener('click', () => setAdminTab('rule'));
  document.getElementById('adminTabStats')?.addEventListener('click', () => setAdminTab('stats'));
  document.getElementById('closeAdminPanelBtn')?.addEventListener('click', closeAdminPanel);

  document.getElementById('adminDrugSearchBtn')?.addEventListener('click', () => searchAdminDrugList(true));
  document.getElementById('adminDrugRecentBtn')?.addEventListener('click', () => loadRecentAdminData(true));
  document.getElementById('adminDrugNewBtn')?.addEventListener('click', prepareNewDrug);
  document.getElementById('saveDrugBtn')?.addEventListener('click', saveDrugItem);
  document.getElementById('toggleCurrentDrugBtn')?.addEventListener('click', toggleCurrentDrugActive);

  document.getElementById('adminRuleSearchBtn')?.addEventListener('click', () => searchAdminRuleList(true));
  document.getElementById('adminRuleRecentBtn')?.addEventListener('click', () => loadRecentAdminData(true));
  document.getElementById('adminRuleNewBtn')?.addEventListener('click', prepareNewRule);
  document.getElementById('saveRuleBtn')?.addEventListener('click', saveRuleItem);
  document.getElementById('toggleCurrentRuleBtn')?.addEventListener('click', toggleCurrentRuleActive);
}

function bindDynamicSearchEvents() {
  document.getElementById('autocompleteBox')?.addEventListener('click', (e) => {
    const item = e.target.closest('[data-action="selectSuggestion"]');
    if (!item) return;
    const name = item.dataset.brandName || '';
    if (name) selectSuggestion(name);
  });

  document.getElementById('autocompleteBox')?.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const index = Number(item.dataset.index);
    if (!Number.isNaN(index)) setAutocompleteActive(index);
  });

  document.getElementById('groupArea')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-action="replaceKeywordAndSearch"]');
    if (!chip) return;
    const oldName = chip.dataset.oldName || '';
    const newName = chip.dataset.newName || '';
    replaceKeywordAndSearch(oldName, newName);
  });
}

function bindDynamicAdminEvents() {
  document.getElementById('adminDrugSearchList')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-action="editDrug"]');
    if (editBtn) {
      const drugId = editBtn.dataset.drugId || '';
      if (drugId) editDrug(drugId);
      return;
    }
    const toggleBtn = e.target.closest('[data-action="toggleDrug"]');
    if (toggleBtn) {
      const drugId = toggleBtn.dataset.drugId || '';
      if (drugId) toggleDrug(drugId);
    }
  });

  document.getElementById('adminRuleSearchList')?.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-action="editRule"]');
    if (editBtn) {
      const ruleId = editBtn.dataset.ruleId || '';
      if (ruleId) editRule(ruleId);
      return;
    }
    const toggleBtn = e.target.closest('[data-action="toggleRule"]');
    if (toggleBtn) {
      const ruleId = toggleBtn.dataset.ruleId || '';
      if (ruleId) toggleRule(ruleId);
    }
  });

  document.getElementById('adminTargetDrugSearchList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="selectAdminTargetDrug"]');
    if (!btn) return;
    const drugId = btn.dataset.drugId || '';
    const brandName = btn.dataset.brandName || '';
    const ingredientName = btn.dataset.ingredientName || '';
    selectAdminTargetDrug(drugId, brandName, ingredientName);
  });
}

function ensureKeywordVisibleOnMobile() {
  const keyword = document.getElementById('keyword');
  if (!keyword) return;

  const isMobile = window.innerWidth <= 720;
  if (!isMobile) return;

  setTimeout(() => {
    const rect = keyword.getBoundingClientRect();
    const topOffset = 84;
    const bottomSafe = window.innerHeight - 260;

    if (rect.top < topOffset || rect.bottom > bottomSafe) {
      const absoluteTop = window.scrollY + rect.top;
      const targetY = Math.max(0, absoluteTop - topOffset);
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  }, 250);
}

function bindKeywordEvents() {
  const keywordInput = document.getElementById('keyword');
  const autoBox = document.getElementById('autocompleteBox');
  const examSelect = document.getElementById('examType');

  if (!keywordInput || !autoBox || !examSelect) return;

  autoBox.addEventListener('mouseleave', () => {
    state.autocompleteActiveIndex = -1;
    updateAutocompleteActiveItem();
  });

  keywordInput.addEventListener('compositionstart', () => { state.isComposing = true; });

  keywordInput.addEventListener('compositionend', () => {
    state.isComposing = false;
    setTimeout(() => {
      scheduleAutocomplete();
      ensureKeywordVisibleOnMobile();
    }, 30);
  });

  keywordInput.addEventListener('input', () => { setTimeout(scheduleAutocomplete, 0); });
  keywordInput.addEventListener('focus', () => { scheduleAutocomplete(); ensureKeywordVisibleOnMobile(); });
  keywordInput.addEventListener('click', () => { ensureKeywordVisibleOnMobile(); });

  keywordInput.addEventListener('blur', () => {
    setTimeout(() => {
      if (!state.suppressBlurHide) hideAutocomplete(true);
      state.suppressBlurHide = false;
    }, 60);
  });

  keywordInput.addEventListener('keydown', handleKeywordKeydown);
  examSelect.addEventListener('change', () => {});

  autoBox.addEventListener('mousedown', () => { state.suppressBlurHide = true; });
  autoBox.addEventListener('touchstart', () => { state.suppressBlurHide = true; }, { passive: true });
}

function bindAdminFormEvents() {
  const adminTargetType = document.getElementById('adminTargetType');
  const adminTargetValueGroup = document.getElementById('adminTargetValueGroup');
  const adminTargetDrugSearch = document.getElementById('adminTargetDrugSearch');
  const adminPasswordInput = document.getElementById('adminPassword');
  const adminDrugSearchInput = document.getElementById('adminDrugSearch');

  if (adminTargetType) adminTargetType.addEventListener('change', syncAdminTargetValueUI);

  if (adminTargetValueGroup) {
    adminTargetValueGroup.addEventListener('change', () => {
      const hidden = document.getElementById('adminTargetValue');
      if (hidden) hidden.value = adminTargetValueGroup.value || '';
    });
  }

  if (adminTargetDrugSearch) {
    adminTargetDrugSearch.addEventListener('input', () => { scheduleAdminDrugTargetSearch(); });
    adminTargetDrugSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); searchAdminDrugTargetList(); }
    });
  }

  if (adminDrugSearchInput) {
    adminDrugSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); searchAdminDrugList(true); }
    });
  }

  if (adminPasswordInput) {
    adminPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); loginAdmin(); }
    });
  }
}

function bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    const field = document.getElementById('keywordField');
    if (field && !field.contains(e.target)) hideAutocomplete(true);
  });

  document.addEventListener('touchstart', (e) => {
    const field = document.getElementById('keywordField');
    if (field && !field.contains(e.target)) hideAutocomplete(true);
  }, { passive: true });

  let resizeTimer;
  const debouncedSyncWidth = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(syncAppWidth, 100);
  };

  window.addEventListener('resize', debouncedSyncWidth);
  window.addEventListener('orientationchange', () => { setTimeout(syncAppWidth, 180); });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedSyncWidth);
  }

  const secretAdminTrigger = document.getElementById('secretAdminTrigger');
  if (secretAdminTrigger) {
    secretAdminTrigger.addEventListener('click', handleSecretAdminTrigger);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  syncAppWidth();

  bindStaticEvents();
  bindDynamicSearchEvents();
  bindDynamicAdminEvents();
  bindKeywordEvents();
  bindAdminFormEvents();
  bindGlobalEvents();

  setTimeout(syncAppWidth, 50);
  initializeApp();
  setTimeout(syncAdminTargetValueUI, 0);
});
