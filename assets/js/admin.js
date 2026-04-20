// ✅ 공통: init 캐시 초기화
function clearInitCache_() {
  try {
    sessionStorage.removeItem('gc_init_v1');
  } catch (e) {
    // 무시
  }
}

// ✅ 공통: 관리자 토큰 포함 apiGet 래퍼
//         쓰기 액션 호출 시 이 함수를 사용 → 토큰 자동 포함
async function apiGetWithToken_(action, params = {}) {
  if (!state.adminToken) {
    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
  }
  return await apiGet(action, { ...params, token: state.adminToken });
}

// ✅ 공통: 토큰 만료 응답 처리
//         쓰기 요청 결과가 인증 오류면 로그아웃 처리
function handleTokenExpired_(res, statusId) {
  if (!res.success && res.message && res.message.includes('인증이 만료')) {
    state.isAdminLoggedIn = false;
    state.adminToken = '';
    hideAdminLoading();
    showErrorPopup('관리자 인증이 만료되었습니다. 다시 로그인해주세요.');
    document.getElementById('adminLoginArea')?.classList.remove('hidden');
    document.getElementById('adminContentArea')?.classList.add('hidden');
    document.getElementById('adminPassword').value = '';
    return true;
  }
  return false;
}

// ✅ 공통: 활성/비활성 토글
async function toggleItem_(type, id) {
  const cfg = {
    drug: {
      action: 'toggleDrug',
      idKey: 'drugId',
      statusId: 'adminDrugStatus',
      reloadList: () => searchAdminDrugList(false),
      clearCache: true
    },
    rule: {
      action: 'toggleRule',
      idKey: 'ruleId',
      statusId: 'adminRuleStatus',
      reloadList: () => searchAdminRuleList(false),
      clearCache: false
    }
  }[type];

  if (!cfg) return;

  showAdminLoading('상태 변경 중', '활성/비활성 상태를 변경하고 있습니다.');

  try {
    const res = await apiGetWithToken_(cfg.action, { [cfg.idKey]: id });

    if (handleTokenExpired_(res, cfg.statusId)) return;

    const statusEl = document.getElementById(cfg.statusId);
    if (statusEl) statusEl.textContent = res.message || '';

    if (!res.success) { hideAdminLoading(); return; }

    clearInitCache_();
    if (cfg.clearCache) {
      state.autocompleteCache.clear();
      state.lastAutocompleteKeyword = '';
    }

    await loadRecentAdminData(false);
    await cfg.reloadList();
    hideAdminLoading();

  } catch (err) {
    hideAdminLoading();
    const statusEl = document.getElementById(cfg.statusId);
    if (statusEl) statusEl.textContent = '변경 오류: ' + getErrorMessage(err);
  }
}

// ✅ 공통: 폼 필드 일괄 초기화
function clearForm_(fieldIds, selectDefaults) {
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  Object.entries(selectDefaults).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  });
}

function renderExamOptions() {
  const select = document.getElementById('examType');
  const adminExam = document.getElementById('adminExamType');

  if (select) {
    select.innerHTML = '<option value="">전체 검사 기준으로 검색</option>';
    state.examList.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.name;
      select.appendChild(option);
    });
  }

  if (adminExam) {
    adminExam.innerHTML = '<option value="">검사 선택</option>';
    state.examList.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.name;
      adminExam.appendChild(option);
    });
  }
}

function renderAdminOptions() {
  const drugGroupSelect = document.getElementById('adminDrugGroup');
  const targetGroupSelect = document.getElementById('adminTargetValueGroup');
  const adminExam = document.getElementById('adminExamType');

  if (adminExam) {
    adminExam.innerHTML = '<option value="">검사 선택</option>';
    state.adminExamList.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.is_active === 'Y' ? item.name : `${item.name} (비활성)`;
      adminExam.appendChild(option);
    });
  }

  if (drugGroupSelect) {
    drugGroupSelect.innerHTML = '<option value="">약물군 선택</option>';
    state.adminDrugGroupList.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.is_active === 'Y' ? item.name : `${item.name} (비활성)`;
      drugGroupSelect.appendChild(option);
    });
  }

  if (targetGroupSelect) {
    targetGroupSelect.innerHTML = '<option value="">약물군 선택</option>';
    state.adminDrugGroupList.forEach(item => {
      const option = document.createElement('option');
      option.value = item.name;
      option.textContent = item.is_active === 'Y' ? item.name : `${item.name} (비활성)`;
      targetGroupSelect.appendChild(option);
    });
  }
}

function openAdminPanel() {
  if (state.isSearching || state.isInitializing) return;

  hideAutocomplete(true);

  document.getElementById('adminPanel')?.classList.remove('hidden');
  document.getElementById('adminLoginArea')?.classList.remove('hidden');
  document.getElementById('adminContentArea')?.classList.add('hidden');

  document.getElementById('adminModeBtn')?.classList.add('active');
  document.getElementById('patientModeBtn')?.classList.remove('active');
  document.getElementById('staffModeBtn')?.classList.remove('active');

  const adminPanel = document.getElementById('adminPanel');
  if (adminPanel) {
    window.scrollTo({ top: adminPanel.offsetTop - 10, behavior: 'smooth' });
  }
}

function closeAdminPanel() {
  document.getElementById('adminPanel')?.classList.add('hidden');
  document.getElementById('adminModeBtn')?.classList.remove('active');

  // ✅ 추가: 패널 닫을 때 토큰도 초기화
  state.isAdminLoggedIn = false;
  state.adminToken = '';

  const adminPassword = document.getElementById('adminPassword');
  const adminLoginStatus = document.getElementById('adminLoginStatus');

  if (adminPassword) adminPassword.value = '';
  if (adminLoginStatus) adminLoginStatus.textContent = '';

  document.getElementById('adminLoginArea')?.classList.add('hidden');
  document.getElementById('adminContentArea')?.classList.add('hidden');

  setMode(state.currentMode);
}

function handleSecretAdminTrigger() {
  state.adminTapCount += 1;

  clearTimeout(state.adminTapTimer);
  state.adminTapTimer = setTimeout(() => { state.adminTapCount = 0; }, 600);

  if (state.adminTapCount >= 3) {
    state.adminTapCount = 0;
    openAdminPanel();
  }
}

function setAdminTab(tab) {
  state.currentAdminTab = tab;

  document.getElementById('adminTabDrug')?.classList.toggle('active', tab === 'drug');
  document.getElementById('adminTabRule')?.classList.toggle('active', tab === 'rule');
  document.getElementById('adminTabStats')?.classList.toggle('active', tab === 'stats');

  document.getElementById('adminDrugPane')?.classList.toggle('hidden', tab !== 'drug');
  document.getElementById('adminRulePane')?.classList.toggle('hidden', tab !== 'rule');
  document.getElementById('adminStatsPane')?.classList.toggle('hidden', tab !== 'stats');

  if (tab === 'stats' && state.isAdminLoggedIn) loadStats(true);
}

async function loginAdmin() {
  const pw = document.getElementById('adminPassword')?.value.trim() || '';

  if (!pw) {
    const statusEl = document.getElementById('adminLoginStatus');
    if (statusEl) statusEl.textContent = '비밀번호를 입력해주세요.';
    return;
  }

  showAdminLoading('관리자 로그인 중', '비밀번호를 확인하고 있습니다.');

  const statusEl = document.getElementById('adminLoginStatus');
  if (statusEl) statusEl.textContent = '로그인 확인 중입니다...';

  try {
    const res = await apiGet('verifyAdmin', { password: pw });

    if (!res.success) {
      hideAdminLoading();
      if (statusEl) statusEl.textContent = '비밀번호가 올바르지 않습니다.';
      return;
    }

    // ✅ 추가: GAS에서 발급한 토큰을 state에 저장
    state.isAdminLoggedIn = true;
    state.adminToken = res.token || '';

    if (statusEl) statusEl.textContent = '로그인되었습니다.';
    document.getElementById('adminLoginArea')?.classList.add('hidden');
    document.getElementById('adminContentArea')?.classList.remove('hidden');

    showAdminLoading('관리자 데이터 불러오는 중', '최근 등록 정보와 통계를 불러오고 있습니다.');

    await loadRecentAdminData(false);
    await loadStats(false);

    hideAdminLoading();
  } catch (err) {
    hideAdminLoading();
    if (statusEl) statusEl.textContent = '로그인 오류: ' + getErrorMessage(err);
  }
}

async function loadRecentAdminData(showLoading = false) {
  try {
    if (showLoading) showAdminLoading('최근 데이터 불러오는 중', '최근 등록된 약물과 규칙을 조회하고 있습니다.');

    const res = await apiGet('recentAdmin');
    if (showLoading) hideAdminLoading();
    if (!res.success) return;

    const recentDrugList = document.getElementById('recentDrugList');
    const recentRuleList = document.getElementById('recentRuleList');

    if (recentDrugList) {
      recentDrugList.innerHTML =
        (res.drugs || []).map(item => `
          <div class="admin-item">
            <strong>${escapeHtml(item.drug_id)}</strong> · ${escapeHtml(item.brand_name)}
            <br><span class="small">${escapeHtml(item.ingredient_name)} / ${escapeHtml(item.drug_group)} / ${escapeHtml(item.caution_level)} / ${escapeHtml(item.is_active)}</span>
          </div>
        `).join('') || '<div class="small">데이터가 없습니다.</div>';
    }

    if (recentRuleList) {
      recentRuleList.innerHTML =
        (res.rules || []).map(item => `
          <div class="admin-item">
            <strong>${escapeHtml(item.rule_id)}</strong> · ${escapeHtml(item.exam_type)}
            <br><span class="small">${escapeHtml(item.target_display_type || item.target_type)} / ${escapeHtml(item.target_display_name || item.target_value)} / ${escapeHtml(item.caution_level || '일반')} / ${escapeHtml(item.need_hold)} / ${escapeHtml(item.is_active)}</span>
          </div>
        `).join('') || '<div class="small">데이터가 없습니다.</div>';
    }
  } catch (err) {
    if (showLoading) hideAdminLoading();
    console.error(err);
  }
}

async function searchAdminDrugList(showLoading = true) {
  try {
    if (showLoading) showAdminLoading('약물 검색 중', '관리자 약물 목록을 조회하고 있습니다.');

    const keyword = document.getElementById('adminDrugSearch')?.value.trim() || '';
    const listEl = document.getElementById('adminDrugSearchList');
    const res = await apiGet('searchAdminDrugs', { keyword });

    if (showLoading) hideAdminLoading();

    const items = res.items || [];
    if (!listEl) return;

    if (!keyword || items.length === 0) {
      listEl.innerHTML = '';
      listEl.classList.add('compact-empty');
      return;
    }

    listEl.classList.remove('compact-empty');
    listEl.innerHTML = items.map(item => `
      <div class="admin-item">
        <strong>${escapeHtml(item.drug_id)}</strong> · ${escapeHtml(item.brand_name)}
        <br><span class="small">${escapeHtml(item.ingredient_name)} / ${escapeHtml(item.drug_group)} / ${escapeHtml(item.is_active === 'Y' ? '활성' : '비활성')}</span>
        <div class="toolbar">
          <button class="btn secondary" data-action="editDrug" data-drug-id="${escapeHtml(item.drug_id)}">수정</button>
          <button class="btn secondary" data-action="toggleDrug" data-drug-id="${escapeHtml(item.drug_id)}">활성/비활성</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    if (showLoading) hideAdminLoading();
    console.error(err);
  }
}

async function searchAdminRuleList(showLoading = true) {
  try {
    if (showLoading) showAdminLoading('규칙 검색 중', '관리자 규칙 목록을 조회하고 있습니다.');

    const keyword = document.getElementById('adminRuleSearch')?.value.trim() || '';
    const listEl = document.getElementById('adminRuleSearchList');
    const res = await apiGet('searchAdminRules', { keyword });

    if (showLoading) hideAdminLoading();

    const items = res.items || [];
    if (!listEl) return;

    if (!keyword || items.length === 0) {
      listEl.innerHTML = '';
      listEl.classList.add('compact-empty');
      return;
    }

    listEl.classList.remove('compact-empty');
    listEl.innerHTML = items.map(item => `
      <div class="admin-item">
        <strong>${escapeHtml(item.rule_id)}</strong> · ${escapeHtml(item.exam_type)}
        <br><span class="small">${escapeHtml(item.target_display_type || item.target_type)} / ${escapeHtml(item.target_display_name || item.target_value)} / ${escapeHtml(item.caution_level || '일반')} / ${escapeHtml(item.need_hold)} / ${escapeHtml(item.is_active)}</span>
        <div class="toolbar">
          <button class="btn secondary" data-action="editRule" data-rule-id="${escapeHtml(item.rule_id)}">수정</button>
          <button class="btn secondary" data-action="toggleRule" data-rule-id="${escapeHtml(item.rule_id)}">활성/비활성</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    if (showLoading) hideAdminLoading();
    console.error(err);
  }
}

function prepareNewDrug() {
  clearDrugForm();
  const listEl = document.getElementById('adminDrugSearchList');
  if (listEl) { listEl.innerHTML = ''; listEl.classList.add('compact-empty'); }
  const statusEl = document.getElementById('adminDrugStatus');
  if (statusEl) statusEl.textContent = '신규 약물 입력 모드입니다.';
}

function prepareNewRule() {
  clearRuleForm();
  const listEl = document.getElementById('adminRuleSearchList');
  if (listEl) { listEl.innerHTML = ''; listEl.classList.add('compact-empty'); }
  const statusEl = document.getElementById('adminRuleStatus');
  if (statusEl) statusEl.textContent = '신규 규칙 입력 모드입니다.';
}

async function editDrug(drugId) {
  try {
    const res = await apiGet('drugDetail', { drugId });
    if (!res.success) return;

    const item = res.item || {};
    const fieldMap = {
      adminDrugId: item.drug_id || '',
      adminBrandName: item.brand_name || '',
      adminIngredientName: item.ingredient_name || '',
      adminDrugGroup: item.drug_group || '',
      adminAliases: item.aliases || '',
      adminPatientKeywords: item.patient_keywords || '',
      adminCommonUse: item.common_use || '',
      adminCautionLevel: item.caution_level || '일반',
      adminStaffNote: item.staff_note || '',
      adminDrugActive: item.is_active || 'Y'
    };

    Object.entries(fieldMap).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    const statusEl = document.getElementById('adminDrugStatus');
    if (statusEl) statusEl.textContent = `${item.drug_id} 수정 모드입니다.`;
  } catch (err) {
    console.error(err);
  }
}

async function editRule(ruleId) {
  try {
    const res = await apiGet('ruleDetail', { ruleId });
    if (!res.success) return;

    const item = res.item || {};
    const fieldMap = {
      adminRuleId: item.rule_id || '',
      adminExamType: item.exam_type || '',
      adminTargetType: item.target_type || 'group',
      adminTargetValue: item.target_value || '',
      adminRuleCautionLevel: item.caution_level || '일반',
      adminNeedHold: item.need_hold || 'Y',
      adminHoldPeriod: item.hold_period || '',
      adminPatientMessage: item.patient_message || '',
      adminStaffMessage: item.staff_message || '',
      adminExceptionNote: item.exception_note || '',
      adminPriority: item.priority || '9',
      adminRuleActive: item.is_active || 'Y'
    };

    Object.entries(fieldMap).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    syncAdminTargetValueUI();

    if ((item.target_type || '') === 'group') {
      const groupSelect = document.getElementById('adminTargetValueGroup');
      const hiddenValue = document.getElementById('adminTargetValue');
      if (groupSelect) groupSelect.value = item.target_value || '';
      if (hiddenValue) hiddenValue.value = item.target_value || '';
      clearAdminTargetDrugSelection();
    } else {
      const targetSearch = document.getElementById('adminTargetDrugSearch');
      const selectedBox = document.getElementById('adminTargetDrugSelected');
      if (targetSearch) targetSearch.value = item.target_display_name || item.target_value || '';
      if (selectedBox) {
        selectedBox.innerHTML =
          `<div class="target-picked-box">선택됨: ${escapeHtml(item.target_display_name || item.target_value || '')}</div>`;
      }
    }

    const statusEl = document.getElementById('adminRuleStatus');
    if (statusEl) statusEl.textContent = `${item.rule_id} 수정 모드입니다.`;
  } catch (err) {
    console.error(err);
  }
}

async function saveDrugItem() {
  if (!state.isAdminLoggedIn) return;

  const payload = {
    drug_id: getValue('adminDrugId'),
    brand_name: getValue('adminBrandName'),
    ingredient_name: getValue('adminIngredientName'),
    drug_group: getValue('adminDrugGroup'),
    aliases: getValue('adminAliases'),
    patient_keywords: getValue('adminPatientKeywords'),
    common_use: getValue('adminCommonUse'),
    caution_level: getValue('adminCautionLevel'),
    staff_note: getValue('adminStaffNote'),
    is_active: getValue('adminDrugActive')
  };

  if (!payload.brand_name || !payload.ingredient_name || !payload.drug_group) {
    showErrorPopup('필수 입력값을 확인해주세요. (약품명, 성분명, 약물군)');
    return;
  }

  const action = payload.drug_id ? 'updateDrug' : 'addDrug';
  showAdminLoading(
    payload.drug_id ? '약물 정보 수정 중' : '약물 정보 저장 중',
    '관리자 약물 데이터를 저장하고 있습니다.'
  );

  try {
    // ✅ 수정: apiGetWithToken_ 사용 → 토큰 자동 포함
    const res = await apiGetWithToken_(action, payload);

    if (handleTokenExpired_(res, 'adminDrugStatus')) return;

    const statusEl = document.getElementById('adminDrugStatus');
    if (statusEl) statusEl.textContent = (res.message || '') + (res.drug_id ? ` (${res.drug_id})` : '');

    if (!res.success) { hideAdminLoading(); return; }

    clearInitCache_();
    if (!payload.drug_id) clearDrugForm();

    await loadRecentAdminData(false);
    await searchAdminDrugList(false);
    state.autocompleteCache.clear();
    state.lastAutocompleteKeyword = '';

    hideAdminLoading();
  } catch (err) {
    hideAdminLoading();
    const statusEl = document.getElementById('adminDrugStatus');
    if (statusEl) statusEl.textContent = '저장 오류: ' + getErrorMessage(err);
  }
}

async function saveRuleItem() {
  if (!state.isAdminLoggedIn) return;

  const targetType = getValue('adminTargetType');
  let targetValue = '';

  if (targetType === 'group') {
    targetValue = getValue('adminTargetValueGroup');
    const hiddenValue = document.getElementById('adminTargetValue');
    if (hiddenValue) hiddenValue.value = targetValue;
  } else {
    targetValue = getValue('adminTargetValue');
  }

  const payload = {
    rule_id: getValue('adminRuleId'),
    exam_type: getValue('adminExamType'),
    target_type: targetType,
    target_value: targetValue,
    caution_level: getValue('adminRuleCautionLevel') || '일반',
    need_hold: getValue('adminNeedHold'),
    hold_period: getValue('adminHoldPeriod'),
    patient_message: getValue('adminPatientMessage'),
    staff_message: getValue('adminStaffMessage'),
    exception_note: getValue('adminExceptionNote'),
    priority: getValue('adminPriority') || '9',
    is_active: getValue('adminRuleActive')
  };

  if (!payload.exam_type || !payload.target_type || !payload.target_value) {
    showErrorPopup('필수 입력값을 확인해주세요. (검사 종류, 적용 기준, 적용 대상 값)');
    return;
  }

  if (!['Y', 'N', 'CONSULT'].includes(payload.need_hold)) {
    showErrorPopup('중단 필요 여부는 Y, N, CONSULT 중 하나여야 합니다.');
    return;
  }

  if (payload.target_type === 'drug' && !/^D\d+$/i.test(payload.target_value)) {
    showErrorPopup('개별 약 규칙은 drug_id가 선택되어야 합니다.');
    return;
  }

  const action = payload.rule_id ? 'updateRule' : 'addRule';
  showAdminLoading(
    payload.rule_id ? '규칙 정보 수정 중' : '규칙 정보 저장 중',
    '관리자 규칙 데이터를 저장하고 있습니다.'
  );

  try {
    // ✅ 수정: apiGetWithToken_ 사용 → 토큰 자동 포함
    const res = await apiGetWithToken_(action, payload);

    if (handleTokenExpired_(res, 'adminRuleStatus')) return;

    const statusEl = document.getElementById('adminRuleStatus');
    if (statusEl) statusEl.textContent = (res.message || '') + (res.rule_id ? ` (${res.rule_id})` : '');

    if (!res.success) { hideAdminLoading(); return; }

    clearInitCache_();
    if (!payload.rule_id) clearRuleForm();

    await loadRecentAdminData(false);
    await searchAdminRuleList(false);

    hideAdminLoading();
  } catch (err) {
    hideAdminLoading();
    const statusEl = document.getElementById('adminRuleStatus');
    if (statusEl) statusEl.textContent = '저장 오류: ' + getErrorMessage(err);
  }
}

function toggleDrug(drugId) { return toggleItem_('drug', drugId); }
function toggleRule(ruleId) { return toggleItem_('rule', ruleId); }

function toggleCurrentDrugActive() {
  const id = getValue('adminDrugId');
  if (!id) {
    const statusEl = document.getElementById('adminDrugStatus');
    if (statusEl) statusEl.textContent = '먼저 수정할 약물을 불러오세요.';
    return;
  }
  toggleDrug(id);
}

function toggleCurrentRuleActive() {
  const id = getValue('adminRuleId');
  if (!id) {
    const statusEl = document.getElementById('adminRuleStatus');
    if (statusEl) statusEl.textContent = '먼저 수정할 규칙을 불러오세요.';
    return;
  }
  toggleRule(id);
}

async function loadStats(showLoading = false) {
  try {
    if (showLoading) showAdminLoading('통계 불러오는 중', '검색 통계를 집계하고 있습니다.');

    const res = await apiGet('stats');
    if (!res.success) { if (showLoading) hideAdminLoading(); return; }

    const summaryWrap = document.getElementById('statsSummaryWrap');
    if (summaryWrap) {
      summaryWrap.innerHTML = `
        <div class="summary-card full">
          <div class="summary-label">총 검색수</div>
          <div class="summary-value summary-blue">${res.totalSearches || 0}</div>
        </div>
      `;
    }

    renderStatsList('statsKeywordList', res.topKeywords || []);
    renderStatsList('statsExamList', res.topExams || []);
    renderStatsList('statsResultList', res.topResults || []);

    if (showLoading) hideAdminLoading();
  } catch (err) {
    if (showLoading) hideAdminLoading();
    console.error(err);
  }
}

function renderStatsList(id, list) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML =
    list.map(item => `
      <div class="admin-item">
        <strong>${escapeHtml(item.name)}</strong>
        <br><span class="small">검색 ${item.count}회</span>
      </div>
    `).join('') || '<div class="small">데이터가 없습니다.</div>';
}

function clearDrugForm() {
  clearForm_(
    ['adminDrugId', 'adminBrandName', 'adminIngredientName', 'adminAliases', 'adminPatientKeywords', 'adminCommonUse', 'adminStaffNote'],
    { adminDrugGroup: '', adminCautionLevel: '일반', adminDrugActive: 'Y' }
  );
}

function clearRuleForm() {
  clearForm_(
    ['adminRuleId', 'adminTargetValue', 'adminHoldPeriod', 'adminPatientMessage', 'adminStaffMessage', 'adminExceptionNote'],
    {
      adminExamType: '',
      adminTargetType: 'group',
      adminRuleCautionLevel: '일반',
      adminNeedHold: 'Y',
      adminPriority: '9',
      adminRuleActive: 'Y',
      adminTargetValueGroup: ''
    }
  );
  clearAdminTargetDrugSelection();
  syncAdminTargetValueUI();
}

function syncAdminTargetValueUI() {
  const type = getValue('adminTargetType');
  const groupWrap = document.getElementById('adminTargetValueGroupWrap');
  const drugWrap = document.getElementById('adminTargetValueDrugWrap');
  const hiddenValue = document.getElementById('adminTargetValue');
  const groupSelect = document.getElementById('adminTargetValueGroup');

  if (!groupWrap || !drugWrap || !hiddenValue) return;

  if (type === 'group') {
    groupWrap.classList.remove('hidden');
    drugWrap.classList.add('hidden');
    clearAdminTargetDrugSelection();
    hiddenValue.value = groupSelect ? (groupSelect.value || '') : '';
  } else {
    groupWrap.classList.add('hidden');
    drugWrap.classList.remove('hidden');
    if (groupSelect) groupSelect.value = '';
    hiddenValue.value = hiddenValue.value || '';
  }
}

function scheduleAdminDrugTargetSearch() {
  clearTimeout(state.adminDrugTargetTimer);
  state.adminDrugTargetTimer = setTimeout(() => { searchAdminDrugTargetList(); }, 180);
}

async function searchAdminDrugTargetList() {
  const keyword = getValue('adminTargetDrugSearch');
  const listEl = document.getElementById('adminTargetDrugSearchList');

  if (!listEl) return;

  if (!keyword || normalizeKeyword(keyword).length < 1) {
    listEl.innerHTML = '';
    listEl.classList.add('compact-empty');
    return;
  }

  try {
    const res = await apiGet('searchAdminDrugs', { keyword, active_only: 'Y' });
    const items = (res.items || []).filter(item => String(item.is_active || '').toUpperCase() === 'Y');

    if (!items.length) {
      listEl.innerHTML = '<div class="admin-item"><span class="small">활성 상태의 약물이 없습니다.</span></div>';
      listEl.classList.remove('compact-empty');
      return;
    }

    listEl.classList.remove('compact-empty');
    listEl.innerHTML = items.slice(0, 10).map(item => `
      <div class="admin-item">
        <strong>${escapeHtml(item.drug_id)}</strong> · ${escapeHtml(item.brand_name)}
        <br><span class="small">${escapeHtml(item.ingredient_name)} / ${escapeHtml(item.drug_group)} / ${escapeHtml(item.is_active)}</span>
        <div class="toolbar">
          <button class="btn secondary"
                  data-action="selectAdminTargetDrug"
                  data-drug-id="${escapeHtml(item.drug_id)}"
                  data-brand-name="${escapeHtml(item.brand_name)}"
                  data-ingredient-name="${escapeHtml(item.ingredient_name)}">선택</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

function selectAdminTargetDrug(drugId, brandName, ingredientName) {
  const hiddenValue = document.getElementById('adminTargetValue');
  const targetSearch = document.getElementById('adminTargetDrugSearch');
  const selectedBox = document.getElementById('adminTargetDrugSelected');
  const listEl = document.getElementById('adminTargetDrugSearchList');

  if (hiddenValue) hiddenValue.value = drugId;
  if (targetSearch) targetSearch.value = brandName;
  if (selectedBox) {
    selectedBox.innerHTML = `<div class="target-picked-box">선택됨: ${escapeHtml(drugId)} · ${escapeHtml(brandName)}</div>`;
  }
  if (listEl) { listEl.innerHTML = ''; listEl.classList.add('compact-empty'); }
}

function clearAdminTargetDrugSelection() {
  const targetSearch = document.getElementById('adminTargetDrugSearch');
  const selectedBox = document.getElementById('adminTargetDrugSelected');
  const listEl = document.getElementById('adminTargetDrugSearchList');

  if (targetSearch) targetSearch.value = '';
  if (selectedBox) selectedBox.innerHTML = '';
  if (listEl) { listEl.innerHTML = ''; listEl.classList.add('compact-empty'); }
}
