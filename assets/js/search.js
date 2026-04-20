function handleKeywordKeydown(e) {
  const box = document.getElementById('autocompleteBox');
  const items = Array.from(box.querySelectorAll('.autocomplete-item'));
  const isOpen = box.style.display === 'block' && items.length > 0;

  if (e.key === 'ArrowDown') {
    if (!isOpen) return;
    e.preventDefault();
    clearTimeout(state.autoTimer);

    if (state.autocompleteActiveIndex < 0) {
      state.autocompleteActiveIndex = 0;
    } else {
      state.autocompleteActiveIndex = Math.min(state.autocompleteActiveIndex + 1, items.length - 1);
    }

    updateAutocompleteActiveItem();
    return;
  }

  if (e.key === 'ArrowUp') {
    if (!isOpen) return;
    e.preventDefault();
    clearTimeout(state.autoTimer);

    if (state.autocompleteActiveIndex < 0) {
      state.autocompleteActiveIndex = items.length - 1;
    } else {
      state.autocompleteActiveIndex = Math.max(state.autocompleteActiveIndex - 1, 0);
    }

    updateAutocompleteActiveItem();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();

    if (isOpen && state.autocompleteActiveIndex >= 0 && items[state.autocompleteActiveIndex]) {
      items[state.autocompleteActiveIndex].click();
      return;
    }

    handleSearch();
    return;
  }

  if (e.key === 'Escape') {
    hideAutocomplete(true);
  }
}

function updateAutocompleteActiveItem() {
  const box = document.getElementById('autocompleteBox');
  const items = Array.from(box.querySelectorAll('.autocomplete-item'));

  items.forEach((item, index) => {
    item.classList.toggle('active', index === state.autocompleteActiveIndex);
  });

  if (state.autocompleteActiveIndex >= 0 && items[state.autocompleteActiveIndex]) {
    items[state.autocompleteActiveIndex].scrollIntoView({ block: 'nearest' });
  }
}

function scheduleAutocomplete() {
  if (state.isSearching || state.isInitializing) {
    hideAutocomplete(true);
    return;
  }

  clearTimeout(state.autoTimer);

  state.autoTimer = setTimeout(() => {
    const keyword = normalizeKeyword(getLastToken(document.getElementById('keyword').value || ''));

    if (!keyword || keyword.length < 2) {
      state.pendingAutocompleteKeyword = '';
      hideAutocomplete(true);
      state.autocompleteRequestSeq++;
      return;
    }

    state.pendingAutocompleteKeyword = keyword;
    runAutocompleteRequest(keyword);
  }, 300);
}

// ✅ 수정: 자동완성 캐시 TTL 5분 추가
//         Map 값을 { list, ts } 구조로 변경 → 5분 경과 시 재요청
const AUTOCOMPLETE_CACHE_TTL = 5 * 60 * 1000; // 5분

async function runAutocompleteRequest(keyword) {
  const currentKeyword = normalizeKeyword(getLastToken(document.getElementById('keyword').value || ''));

  if (!keyword || keyword.length < 2 || !currentKeyword || currentKeyword.length < 2) {
    hideAutocomplete(true);
    return;
  }

  if (keyword !== currentKeyword) {
    keyword = currentKeyword;
  }

  if (state.autocompleteLoadingKeyword === keyword) {
    return;
  }

  // ✅ 수정: TTL 체크 포함한 캐시 조회
  const cached = state.autocompleteCache.get(keyword);
  if (cached && Date.now() - cached.ts < AUTOCOMPLETE_CACHE_TTL) {
    renderAutocomplete(cached.list, keyword);
    return;
  }

  const requestId = ++state.autocompleteRequestSeq;
  state.autocompleteLoadingKeyword = keyword;
  showAutocompleteLoading();

  try {
    const data = await apiGet('suggest', { keyword });

    const latestKeyword = normalizeKeyword(getLastToken(document.getElementById('keyword').value || ''));

    if (requestId !== state.autocompleteRequestSeq) return;
    if (state.isSearching || state.isInitializing) return;

    if (!latestKeyword || latestKeyword.length < 2) {
      hideAutocomplete(true);
      return;
    }

    if (latestKeyword !== keyword) {
      hideAutocomplete(true);
      return;
    }

    const list = (data && data.suggestions) ? data.suggestions : [];

    // ✅ 수정: { list, ts } 구조로 저장
    state.autocompleteCache.set(keyword, { list, ts: Date.now() });
    state.autocompleteLoadingKeyword = '';
    renderAutocomplete(list, keyword);
  } catch (e) {
    const latestKeyword = normalizeKeyword(getLastToken(document.getElementById('keyword').value || ''));

    if (requestId !== state.autocompleteRequestSeq) return;
    if (state.isSearching || state.isInitializing) return;

    if (!latestKeyword || latestKeyword.length < 2 || latestKeyword !== keyword) {
      hideAutocomplete(true);
      return;
    }

    state.autocompleteLoadingKeyword = '';
    showAutocompleteEmpty('자동완성 조회 중 오류가 발생했습니다.');
  }
}

function fetchAutocompleteSuggestions(keyword) {
  runAutocompleteRequest(keyword);
}

function showAutocompleteLoading() {
  const box = document.getElementById('autocompleteBox');
  state.autocompleteActiveIndex = -1;
  box.innerHTML = `
    <div class="autocomplete-loading">
      <span class="mini-spinner"></span>
      <span>검색 중...</span>
    </div>
  `;
  box.style.display = 'block';
}

function showAutocompleteEmpty(message) {
  const box = document.getElementById('autocompleteBox');
  state.autocompleteActiveIndex = -1;
  box.innerHTML = `<div class="autocomplete-empty">${escapeHtml(message || '검색 결과가 없습니다.')}</div>`;
  box.style.display = 'block';
}

function renderAutocomplete(list, keyword = '') {
  const box = document.getElementById('autocompleteBox');
  const currentKeyword = normalizeKeyword(getLastToken(document.getElementById('keyword').value || ''));

  if (!currentKeyword || currentKeyword.length < 2) {
    hideAutocomplete(true);
    return;
  }

  if (keyword && currentKeyword !== keyword) {
    hideAutocomplete(true);
    return;
  }

  if (!list || !list.length) {
    state.autocompleteActiveIndex = -1;
    state.renderedAutocompleteKeyword = currentKeyword;
    showAutocompleteEmpty('일치하는 약물이 없습니다.');
    return;
  }

  if (
    box.style.display === 'block' &&
    state.renderedAutocompleteKeyword === currentKeyword &&
    box.querySelectorAll('.autocomplete-item').length === list.length
  ) {
    return;
  }

  state.autocompleteActiveIndex = -1;
  state.renderedAutocompleteKeyword = currentKeyword;

  box.innerHTML = list.map((item, index) => `
    <div class="autocomplete-item"
         data-index="${index}"
         data-action="selectSuggestion"
         data-brand-name="${escapeHtml(item.brand_name)}">
      <div class="auto-title">${escapeHtml(item.brand_name)}</div>
      <div class="auto-sub">${escapeHtml(item.ingredient_name)} · ${escapeHtml(item.drug_group)}</div>
    </div>
  `).join('');

  box.style.display = 'block';
}

function setAutocompleteActive(index) {
  state.autocompleteActiveIndex = index;
  updateAutocompleteActiveItem();
}

function selectSuggestion(name) {
  const textarea = document.getElementById('keyword');
  const tokens = splitMultiInputTokens(textarea.value);

  if (tokens.length === 0) {
    textarea.value = name + ', ';
  } else {
    tokens[tokens.length - 1] = name;
    textarea.value = rebuildKeywordText(tokens) + ', ';
  }

  hideAutocomplete(true);
  state.lastAutocompleteKeyword = '';
  state.autocompleteRequestSeq++;
  triggerSelectionFeedback();
  textarea.focus();
}

function triggerSelectionFeedback() {
  const textarea = document.getElementById('keyword');
  textarea.classList.remove('highlighted');
  clearTimeout(state.highlightTimer);

  requestAnimationFrame(() => {
    textarea.classList.add('highlighted');
  });

  state.highlightTimer = setTimeout(() => {
    textarea.classList.remove('highlighted');
  }, 520);

  if (navigator.vibrate) {
    navigator.vibrate(18);
  }
}

function hideAutocomplete(forceReset = false) {
  const box = document.getElementById('autocompleteBox');
  box.style.display = 'none';
  box.innerHTML = '';
  state.autocompleteActiveIndex = -1;
  state.renderedAutocompleteKeyword = '';
  state.autocompleteLoadingKeyword = '';

  if (forceReset) {
    clearTimeout(state.autoTimer);
    state.pendingAutocompleteKeyword = '';
  }
}

function handleSearch() {
  if (state.isSearching) return;

  const keywordRaw = document.getElementById('keyword').value.trim();
  const examType = document.getElementById('examType').value;

  if (!keywordRaw) {
    showErrorPopup('검색어를 입력해주세요.');
    return;
  }

  const tokens = splitMultiInputTokens(keywordRaw);
  const dedupedKeyword = rebuildKeywordText(tokens);
  document.getElementById('keyword').value = dedupedKeyword;

  if (!dedupedKeyword) {
    showErrorPopup('검색어를 입력해주세요.');
    return;
  }

  const tooShortToken = tokens.find(token => normalizeKeyword(token).length < 2);
  if (tooShortToken) {
    showErrorPopup('검색어는 2글자 이상 입력해주세요.');
    return;
  }

  hideAutocomplete(true);
  state.autocompleteRequestSeq++;
  if (document.activeElement) document.activeElement.blur();

  state.isSearching = true;
  setSearchButtonLoading(true);
  showLoadingOverlay(
    '검색 중',
    examType
      ? '선택한 검사 기준을 조회하고 있습니다.'
      : '전체 검사 기준을 조회하고 있습니다.'
  );
  setStatus(
    examType
      ? '선택한 검사 기준으로 검색 중입니다...'
      : '약물과 연결된 전체 검사 기준을 검색 중입니다...',
    true
  );
  clearResults();
  renderSkeletonResults();

  (async () => {
    try {
      const data = await apiGet('search', {
        keyword: dedupedKeyword,
        examType: examType || '',
        mode: state.currentMode
      });

      state.isSearching = false;
      setSearchButtonLoading(false);
      hideLoadingOverlay();

      if (!data.success) {
        clearResults();
        showErrorPopup(data.message || '검색에 실패했습니다.');
        return;
      }

      clearResults();
      renderResults(data);

      const groupArea = document.getElementById('groupArea');
      if (groupArea.innerHTML.trim()) {
        setTimeout(() => {
          groupArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
      }
    } catch (err) {
      state.isSearching = false;
      setSearchButtonLoading(false);
      hideLoadingOverlay();
      clearResults();
      showErrorPopup('검색 중 오류가 발생했습니다: ' + getErrorMessage(err));
    }
  })();
}

function renderSkeletonResults(count = 2) {
  const area = document.getElementById('groupArea');
  if (!area) return;

  area.innerHTML = `
    <div class="skeleton-wrap">
      ${Array.from({ length: count }).map(() => `
        <div class="skeleton-card">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line w-55"></div>
          <div class="skeleton-line w-40"></div>
          <div class="skeleton-chip"></div>
          <div class="skeleton-line w-30"></div>
          <div class="skeleton-line w-70"></div>
          <div class="skeleton-box"></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderResults(res) {
  renderGroupedResults(res.groupedResults || []);

  const totalKeywords = (res.keywords || []).length;
  const totalDrugRows = (res.results || []).length;
  const unresolved = (res.unresolvedKeywords || []).length;

  if (totalDrugRows === 0) {
    setStatus(res.message || '검색 결과가 없습니다.');
    return;
  }

  // ✅ 수정: 미확인 키워드 유무에 따라 메시지 분기
  if (unresolved > 0) {
    setStatus(
      `${totalKeywords}개 검색어 중 ${totalDrugRows}건 확인 · 미확인 ${unresolved}건`
    );
  } else {
    setStatus(`${totalKeywords}개 검색어 · ${totalDrugRows}건 모두 확인 완료`);
  }
}

// ✅ 제거: renderSummary 함수 삭제 (빈 함수였으며 clearResults가 동일한 역할을 함)

function renderGroupedResults(groupedResults) {
  const area = document.getElementById('groupArea');
  area.innerHTML = '';

  if (!groupedResults.length) {
    area.innerHTML = `
      <div class="group-section">
        <div class="empty">검색 결과가 없습니다.</div>
      </div>
    `;
    return;
  }

  const outerSliderId = 'keywordGroupSlider';

  area.innerHTML = `
    <div class="group-master-slider-wrap">
      <div class="group-master-header">
        <div class="group-master-title-wrap">
          <div class="group-master-title">검색어별 결과</div>
          <div class="group-master-sub" id="${outerSliderId}-group-label"></div>
        </div>
      </div>

      <div class="group-tab-nav" id="${outerSliderId}-tabs" role="tablist" aria-label="검색어 그룹 선택">
        ${groupedResults.map((group, groupIndex) => `
          <button
            type="button"
            class="group-tab-btn ${groupIndex === 0 ? 'active' : ''}"
            data-master-tab-target="${outerSliderId}"
            data-master-tab-index="${groupIndex}"
            role="tab"
            aria-selected="${groupIndex === 0 ? 'true' : 'false'}"
          >
            ${escapeHtml(group.keyword)}
          </button>
        `).join('')}
      </div>

      <div class="group-master-slider" id="${outerSliderId}" data-current-index="0">
        <div class="group-master-track">
          ${groupedResults.map((group, groupIndex) => {
            return `
              <div
                class="group-master-slide"
                data-master-slide-index="${groupIndex}"
                data-group-keyword="${escapeHtml(group.keyword)}"
                aria-hidden="${groupIndex === 0 ? 'false' : 'true'}"
              >
                ${createGroupSlideHtml(group, groupIndex)}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  bindMasterTabs();
  bindInnerResultSliders();
  updateMasterSlider(document.getElementById(outerSliderId), 0, true);
}

function createGroupSlideHtml(group, groupIndex) {
  if (!group.found) {
    return `
      <div class="group-section result-slider-section">
        <div class="group-header slider-group-header">
          <div class="slider-group-meta">
            <div class="group-title">검색어: ${escapeHtml(group.keyword)}</div>
            <div class="group-sub">결과 없음</div>
          </div>
        </div>

        <div class="result-card slider-empty-card">
          <div class="empty-title">일치하는 약 정보를 찾지 못했습니다.</div>
          <div class="empty-desc">
            복용 중단 대상이 아니거나, 아직 등록되지 않은 약입니다.
          </div>
          ${renderSuggestionChips(group.suggestions || [], group.keyword)}
        </div>
      </div>
    `;
  }

  const sortedRows = [...group.results].sort((a, b) => {
    return Number(b.sort_weight || 0) - Number(a.sort_weight || 0);
  });

  const innerSliderId = `resultSlider-${groupIndex}`;

  return `
    <div class="group-section result-slider-section">
      <div class="group-header slider-group-header">
        <div class="slider-group-meta">
          <div class="group-title">검색어: ${escapeHtml(group.keyword)}</div>
          <div class="group-sub">결과 카드 ${sortedRows.length}건</div>
        </div>

        <div class="slider-nav" aria-label="결과 카드 이동">
          <button
            type="button"
            class="slider-nav-btn"
            data-slider-target="${innerSliderId}"
            data-direction="prev"
            aria-label="이전 결과"
          >
            ‹
          </button>

          <div class="slider-counter" id="${innerSliderId}-counter">1 / ${sortedRows.length}</div>

          <button
            type="button"
            class="slider-nav-btn"
            data-slider-target="${innerSliderId}"
            data-direction="next"
            aria-label="다음 결과"
          >
            ›
          </button>
        </div>
      </div>

      <div class="result-slider" id="${innerSliderId}" data-current-index="0">
        <div class="result-slider-track">
          ${sortedRows.map((item, index) => `
            <div
              class="result-slide"
              data-slide-index="${index}"
              aria-hidden="${index === 0 ? 'false' : 'true'}"
            >
              ${createResultCardHtml(item)}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function updateMasterSlider(slider, nextIndex, skipAnimation = false) {
  const track = slider.querySelector('.group-master-track');
  const slides = Array.from(slider.querySelectorAll('.group-master-slide'));
  if (!track || !slides.length) return;

  const maxIndex = slides.length - 1;
  const safeIndex = Math.min(Math.max(nextIndex, 0), maxIndex);

  slider.dataset.currentIndex = String(safeIndex);

  if (skipAnimation) {
    track.classList.add('no-anim');
  } else {
    track.classList.remove('no-anim');
  }

  track.style.transform = `translateX(-${safeIndex * 100}%)`;

  slides.forEach((slide, index) => {
    slide.setAttribute('aria-hidden', index === safeIndex ? 'false' : 'true');
  });

  const label = document.getElementById(`${slider.id}-group-label`);
  if (label) {
    const keyword = slides[safeIndex]?.dataset.groupKeyword || '';
    label.textContent = `현재 검색어 · ${keyword}`;
  }

  const tabButtons = document.querySelectorAll(`.group-tab-btn[data-master-tab-target="${slider.id}"]`);
  tabButtons.forEach((btn, index) => {
    const isActive = index === safeIndex;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  if (skipAnimation) {
    requestAnimationFrame(() => {
      track.classList.remove('no-anim');
    });
  }
}

function bindInnerResultSliders() {
  const buttons = document.querySelectorAll('.slider-nav-btn');

  buttons.forEach(btn => {
    btn.onclick = () => {
      const sliderId = btn.dataset.sliderTarget;
      const direction = btn.dataset.direction;
      const slider = document.getElementById(sliderId);
      if (!slider) return;

      const total = slider.querySelectorAll('.result-slide').length;
      const current = Number(slider.dataset.currentIndex || 0);

      let nextIndex = current;
      if (direction === 'prev') nextIndex = Math.max(0, current - 1);
      if (direction === 'next') nextIndex = Math.min(total - 1, current + 1);

      updateInnerResultSlider(slider, nextIndex);
    };
  });

  const sliders = document.querySelectorAll('.result-slider');
  sliders.forEach(slider => {
    attachInnerSliderSwipe(slider);
    updateInnerResultSlider(slider, Number(slider.dataset.currentIndex || 0), true);
  });
}

function updateInnerResultSlider(slider, nextIndex, skipAnimation = false) {
  const track = slider.querySelector('.result-slider-track');
  const slides = Array.from(slider.querySelectorAll('.result-slide'));
  if (!track || !slides.length) return;

  const maxIndex = slides.length - 1;
  const safeIndex = Math.min(Math.max(nextIndex, 0), maxIndex);

  slider.dataset.currentIndex = String(safeIndex);

  if (skipAnimation) {
    track.classList.add('no-anim');
  } else {
    track.classList.remove('no-anim');
  }

  track.style.transform = `translateX(-${safeIndex * 100}%)`;

  slides.forEach((slide, index) => {
    slide.setAttribute('aria-hidden', index === safeIndex ? 'false' : 'true');
  });

  const counter = document.getElementById(`${slider.id}-counter`);
  if (counter) {
    counter.textContent = `${safeIndex + 1} / ${slides.length}`;
  }

  const prevBtn = document.querySelector(`.slider-nav-btn[data-slider-target="${slider.id}"][data-direction="prev"]`);
  const nextBtn = document.querySelector(`.slider-nav-btn[data-slider-target="${slider.id}"][data-direction="next"]`);

  if (prevBtn) prevBtn.disabled = safeIndex === 0;
  if (nextBtn) nextBtn.disabled = safeIndex === maxIndex;

  if (skipAnimation) {
    requestAnimationFrame(() => {
      track.classList.remove('no-anim');
    });
  }
}

function attachInnerSliderSwipe(slider) {
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let deltaY = 0;
  let isDragging = false;
  let isHorizontalSwipe = false;

  slider.addEventListener('touchstart', (e) => {
    if (!e.touches || !e.touches.length) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    deltaX = 0;
    deltaY = 0;
    isDragging = true;
    isHorizontalSwipe = false;
  }, { passive: true });

  slider.addEventListener('touchmove', (e) => {
    if (!isDragging || !e.touches || !e.touches.length) return;
    deltaX = e.touches[0].clientX - startX;
    deltaY = e.touches[0].clientY - startY;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
      isHorizontalSwipe = true;
      e.preventDefault();
    }
  }, { passive: false });

  slider.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    if (!isHorizontalSwipe) return;

    const threshold = 50;
    const current = Number(slider.dataset.currentIndex || 0);
    const total = slider.querySelectorAll('.result-slide').length;

    if (deltaX <= -threshold) {
      updateInnerResultSlider(slider, Math.min(total - 1, current + 1));
    } else if (deltaX >= threshold) {
      updateInnerResultSlider(slider, Math.max(0, current - 1));
    }
  });

  slider.addEventListener('touchcancel', () => {
    isDragging = false;
    isHorizontalSwipe = false;
  });
}

function renderSuggestionChips(list, originalKeyword) {
  if (!list || !list.length) return '';
  return `
    <div class="suggest-list">
      ${list.map(item => `
        <button class="suggest-chip"
                data-action="replaceKeywordAndSearch"
                data-old-name="${escapeHtml(originalKeyword)}"
                data-new-name="${escapeHtml(item.brand_name)}">
          ${escapeHtml(item.brand_name)}
        </button>
      `).join('')}
    </div>
  `;
}

function replaceKeywordAndSearch(oldName, newName) {
  const tokens = splitMultiInputTokens(document.getElementById('keyword').value);
  const replaced = tokens.map(token => normalizeKeyword(token) === normalizeKeyword(oldName) ? newName : token);
  document.getElementById('keyword').value = rebuildKeywordText(replaced);
  triggerSelectionFeedback();
  handleSearch();
}

function createResultCardHtml(item) {
  const examResults = Array.isArray(item.exam_results) ? item.exam_results : [];

  const commonInfo = `
    <div class="result-head">
      <div>
        <div class="drug-name">${escapeHtml(item.brand_name || '-')}</div>
        <div class="subline">
          성분명: ${escapeHtml(item.ingredient_name || '-')}<br>
          약물군: ${escapeHtml(item.drug_group || '-')}
        </div>
      </div>
    </div>

    <div class="kv">
      <div class="k">용도</div><div class="v">${escapeHtml(item.common_use || '-')}</div>
      <div class="k">연관검색어</div><div class="v">${escapeHtml((item.aliases || []).join(', ') || '-')}</div>
      ${state.currentMode === 'staff' ? `<div class="k">주의도</div><div class="v">${escapeHtml(item.caution_level || '일반')}</div>` : ''}
      ${state.currentMode === 'staff' ? `<div class="k">직원메모</div><div class="v">${escapeHtml(item.staff_note || '-')}</div>` : ''}
    </div>

    ${state.currentMode === 'patient' ? `
      <div class="patient-help-note">
        아래 검사별 안내를 꼭 확인하세요.
      </div>
    ` : ''}
  `;

  let examHtml = '';

  if (!examResults.length) {
    examHtml = `
      <div class="exam-result-empty">
        해당 약에 연결된 검사 규칙이 없습니다.
      </div>
    `;
  } else {
    examHtml = `
      <div class="exam-result-list">
        ${examResults.map(result => {
          const rule = result.applied_rule || {};
          const caution = getExamDisplayCaution(item, rule);
          const showHoldPeriod = shouldShowHoldPeriod(rule);
          const patientGuidance = getPatientGuidanceNote(rule);

          return `
            <div class="exam-result-item">
              <div class="exam-result-head">
                <div class="exam-result-title">${escapeHtml(result.exam_type || '검사 미지정')}</div>
                <div class="exam-result-meta">
                  <div class="badge ${caution.className}">${escapeHtml(caution.label)}</div>
                  ${state.currentMode === 'staff'
                    ? `<div class="exam-meta-badge">매칭 ${escapeHtml(String(result.matched_rule_count || 0))}건</div>`
                    : ''
                  }
                </div>
              </div>

              <div class="exam-result-grid">
                <div class="k">복용안내</div>
                <div class="v">${escapeHtml(formatNeedHold(rule.need_hold))}</div>

                ${showHoldPeriod ? `
                  <div class="k">중단시점</div>
                  <div class="v">${escapeHtml(rule.hold_period || '-')}</div>
                ` : ''}

                <div class="k">${state.currentMode === 'staff' ? '환자 참고사항' : '참고사항'}</div>
                <div class="v">${escapeHtml(rule.patient_message || '-')}</div>

                ${state.currentMode === 'staff' ? `
                  <div class="k">직원 참고사항</div>
                  <div class="v">${escapeHtml(rule.staff_message || '-')}</div>

                  <div class="k">예외사항</div>
                  <div class="v">${escapeHtml(rule.exception_note || '-')}</div>
                ` : ''}
              </div>

              ${state.currentMode === 'patient' && patientGuidance ? `
                <div class="patient-guidance-box">
                  <strong>안내:</strong> ${escapeHtml(patientGuidance)}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  return `<div class="result-card">${commonInfo}${examHtml}</div>`;
}

function getRuleCautionLevel(item, rule) {
  return (rule && rule.caution_level) || item.caution_level || '일반';
}

function formatNeedHold(value) {
  if (value === 'Y') return '중단 필요';
  if (value === 'N') return state.currentMode === 'patient' ? '복용 유지' : '대부분 유지';
  if (value === 'CONSULT') return '상담 필요';
  return value || '-';
}

function shouldShowHoldPeriod(rule) {
  const needHold = String(rule?.need_hold || '').trim();
  const holdPeriod = String(rule?.hold_period || '').trim();
  if (!holdPeriod) return false;
  if (needHold === 'N' && holdPeriod === '임의중단 금지') return false;
  return true;
}

function getPatientGuidanceNote(rule) {
  const needHold = String(rule?.need_hold || '').trim();
  if (needHold === 'Y') return '검사 전까지 중단 시점을 꼭 확인하세요.';
  if (needHold === 'CONSULT') return '임의로 결정하지 말고 검진센터 또는 처방의와 먼저 상의하세요.';
  if (needHold === 'N') return '별도 안내가 없는 경우 복용 후 방문하세요.';
  return '';
}

function getCautionClass(level) {
  if (level === '매우높음' || level === '높음') return 'badge-danger';
  if (level === '중간') return 'badge-warn';
  return 'badge-normal';
}

function mapPatientCautionLabel(level) {
  const value = String(level || '').trim();
  if (state.currentMode === 'staff') return value || '일반';
  switch (value) {
    case '일반':    return '복용 가능';
    case '중간':    return '주의';
    case '높음':    return '중요';
    case '매우높음': return '반드시 확인';
    default:       return value || '복용 가능';
  }
}

function getExamDisplayCaution(item, rule) {
  const rawLevel = (rule && rule.caution_level) || item.caution_level || '일반';
  return {
    raw: rawLevel,
    label: mapPatientCautionLabel(rawLevel),
    className: getCautionClass(rawLevel)
  };
}

function getTargetTypeLabel(value) {
  if (value === 'drug') return '약 개별';
  if (value === 'group') return '약물군';
  return value || '-';
}

function bindMasterTabs() {
  const buttons = document.querySelectorAll('.group-tab-btn');
  buttons.forEach(btn => {
    btn.onclick = () => {
      const sliderId = btn.dataset.masterTabTarget;
      const index = Number(btn.dataset.masterTabIndex || 0);
      const slider = document.getElementById(sliderId);
      if (!slider) return;
      updateMasterSlider(slider, index);
    };
  });
}
