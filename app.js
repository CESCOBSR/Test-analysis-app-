(function () {
  const DATA = window.MANUAL_DATA;
  const items = DATA.items;
  const minors = DATA.minors;
  const MICRO_UNIT_G = DATA.MICRO_UNIT_G || 25;

  const searchInput = document.getElementById('searchInput');
  const suggestList = document.getElementById('suggestList');
  const clearBtn = document.getElementById('clearBtn');
  const emptyState = document.getElementById('emptyState');
  const resultArea = document.getElementById('resultArea');
  const itemCountBadge = document.getElementById('itemCountBadge');
  const popularRow = document.getElementById('popularRow');

  itemCountBadge.textContent = minors.length + '개 식품유형';

  const CATEGORY_LABEL = {
    '자가품질검사': '자가품질검사',
    '냉동식품등': '냉동식품 등',
    '접객업소': '접객업소',
  };

  function fmtWon(n) {
    if (n === null || n === undefined) return '문의';
    return Math.round(n).toLocaleString('ko-KR') + '원';
  }

  function fmtGram(it) {
    if (it.sample_g !== null && it.sample_g !== undefined) {
      return it.sample_g + 'g';
    }
    return null;
  }

  function sampleBadgeHtml(it) {
    if (it.sample_kind === 'microbiological') {
      if (it.sample_n) {
        return `<span class="card-sample micro">미생물 n=${it.sample_n} · 개당 ${MICRO_UNIT_G}g↑</span>`;
      }
      return `<span class="card-sample micro">미생물 · 개수 확인 필요</span>`;
    }
    if (it.sample_kind === 'qualitative') {
      return `<span class="card-sample muted">완제품 확인 (계량 불요)</span>`;
    }
    if (it.sample_kind === 'not_acceptable') {
      return `<span class="card-sample unavail">접수 불가 항목</span>`;
    }
    const gram = fmtGram(it);
    if (gram) {
      return `<span class="card-sample">시료 ${gram}</span>`;
    }
    return `<span class="card-sample muted">시료량 확인 필요</span>`;
  }

  // ---- popular / recent chips (a few illustrative food types) ----
  const suggestedChips = ['벌꿀', '고춧가루', '김치', '어묵', '즉석섭취식품', '생면'];
  popularRow.innerHTML = '';
  suggestedChips.forEach(name => {
    if (minors.find(m => m.minor === name)) {
      const chip = document.createElement('div');
      chip.className = 'recent-chip';
      chip.textContent = name;
      chip.onclick = () => selectMinor(name);
      popularRow.appendChild(chip);
    }
  });

  // ---- search suggestion ----
  function renderSuggestions(query) {
    const q = query.trim();
    if (!q) {
      suggestList.classList.remove('show');
      suggestList.innerHTML = '';
      return;
    }
    const matches = minors
      .filter(m => m.minor.includes(q))
      .sort((a, b) => {
        const aStarts = a.minor.startsWith(q) ? 0 : 1;
        const bStarts = b.minor.startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.minor.length - b.minor.length;
      })
      .slice(0, 30);

    if (matches.length === 0) {
      suggestList.innerHTML = '<div class="suggest-item"><div class="suggest-name" style="color:var(--text-faint)">검색 결과가 없습니다</div></div>';
      suggestList.classList.add('show');
      return;
    }

    suggestList.innerHTML = '';
    matches.forEach(m => {
      const row = document.createElement('div');
      row.className = 'suggest-item';
      row.innerHTML = `
        <div>
          <div class="suggest-name">${escapeHtml(m.minor)}</div>
          <div class="suggest-path">${escapeHtml(m.major)} · ${escapeHtml(m.mid)}</div>
        </div>
        <div class="suggest-count">${m.count}개 항목</div>
      `;
      row.onclick = () => selectMinor(m.minor);
      suggestList.appendChild(row);
    });
    suggestList.classList.add('show');
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  searchInput.addEventListener('input', () => {
    clearBtn.classList.toggle('show', searchInput.value.length > 0);
    renderSuggestions(searchInput.value);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value) renderSuggestions(searchInput.value);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) {
      suggestList.classList.remove('show');
    }
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearBtn.classList.remove('show');
    suggestList.classList.remove('show');
    showEmpty();
    searchInput.focus();
  });

  function showEmpty() {
    emptyState.style.display = '';
    resultArea.style.display = 'none';
  }

  function selectMinor(minorName) {
    searchInput.value = minorName;
    clearBtn.classList.add('show');
    suggestList.classList.remove('show');
    renderResults(minorName);
  }

  function renderResults(minorName) {
    const list = items.filter(it => it.minor === minorName);
    if (list.length === 0) { showEmpty(); return; }

    emptyState.style.display = 'none';
    resultArea.style.display = '';

    const first = list[0];
    const catLabel = CATEGORY_LABEL[first.category] || first.category;

    let feeSum = 0;
    let feeSumHasUnknown = false;

    const cardsHtml = list.map((it, idx) => {
      const feeVat = it.fee_vat;
      const isUnacceptable = it.sample_kind === 'not_acceptable';

      const specsHtml = it.specs && it.specs.length
        ? it.specs.map(s => escapeHtml(s)).join(' / ')
        : '-';

      const flags = [];
      if (it.designated) flags.push('<span class="flag designated">지정검사</span>');
      if (it.period_mfg) flags.push(`<span class="flag period">제조·가공 ${escapeHtml(it.period_mfg)}</span>`);

      const checkboxHtml = isUnacceptable
        ? '<span class="card-check-disabled"></span>'
        : `<input type="checkbox" class="quote-check" data-idx="${idx}" data-fee="${feeVat === null || feeVat === undefined ? '' : feeVat}" data-kind="${it.sample_kind}" data-g="${it.sample_g === null || it.sample_g === undefined ? '' : it.sample_g}" data-n="${it.sample_n === null || it.sample_n === undefined ? '' : it.sample_n}" data-name="${escapeHtml(it.item)}" checked>`;

      return `
        <div class="card${isUnacceptable ? ' card-disabled' : ''}">
          <div class="card-top">
            <label class="card-check">
              ${checkboxHtml}
              <span class="card-item-name">${escapeHtml(it.item)}</span>
            </label>
            <span class="card-fee">${isUnacceptable ? '접수불가' : fmtWon(feeVat)}</span>
          </div>
          <div class="card-sub">
            <span class="card-spec">기준 ${specsHtml}</span>
            ${sampleBadgeHtml(it)}
          </div>
          ${flags.length ? `<div class="card-flags">${flags.join('')}</div>` : ''}
          ${it.note ? `<div class="card-note">${escapeHtml(it.note)}</div>` : ''}
        </div>
      `;
    }).join('');

    list.forEach(it => {
      if (it.sample_kind === 'not_acceptable') return;
      if (it.fee_vat === null || it.fee_vat === undefined) feeSumHasUnknown = true;
      else feeSum += it.fee_vat;
    });

    const summaryHtml = `
      <div class="summary-bar">
        <span id="summaryLabel">항목 0개 선택 (VAT포함)</span>
        <span class="total" id="summaryTotal">${fmtWon(feeSum)}${feeSumHasUnknown ? '+' : ''}</span>
      </div>
      <div class="sample-summary" id="sampleSummary"></div>
      <label class="buffer-toggle">
        <input type="checkbox" id="bufferToggle"> 여유분 30g 추가로 채취 (권장)
      </label>
    `;

    resultArea.innerHTML = `
      <div class="result-header">
        <div>
          <div class="result-path">${escapeHtml(first.major)} · ${escapeHtml(first.mid)}</div>
          <div class="result-title">${escapeHtml(minorName)}</div>
        </div>
        <div class="result-meta">${escapeHtml(catLabel)}</div>
      </div>
      <div class="quote-hint">체크 해제하면 견적/시료량에서 제외됩니다</div>
      <div class="select-all-row">
        <button class="select-all-btn" id="selectAllBtn">전체 선택</button>
        <button class="select-all-btn" id="deselectAllBtn">전체 해제</button>
      </div>
      ${cardsHtml}
      ${summaryHtml}
      <div class="guide-note">
        수수료는 부가세 포함 기준이며 변동될 수 있습니다.<br>
        이화학·미생물 시료는 서로 다른 용기에 나눠서 수거하는 것을 권장합니다.
      </div>
    `;

    const checkboxes = Array.prototype.slice.call(resultArea.querySelectorAll('.quote-check'));
    const summaryLabel = document.getElementById('summaryLabel');
    const summaryTotal = document.getElementById('summaryTotal');
    const sampleSummary = document.getElementById('sampleSummary');
    const bufferToggle = document.getElementById('bufferToggle');

    function recalc() {
      let sum = 0, hasUnknown = false, checkedCount = 0;
      let physioG = 0, physioHasUnknown = false, physioNames = [];
      const microByN = {}; // n값 -> [항목명들]
      let microUnknownNames = [];

      checkboxes.forEach(cb => {
        if (!cb.checked) return;
        checkedCount++;
        const feeStr = cb.dataset.fee;
        if (feeStr === '') hasUnknown = true;
        else sum += parseFloat(feeStr);

        if (cb.dataset.kind === 'physicochemical') {
          if (cb.dataset.g !== '') {
            physioG += parseFloat(cb.dataset.g);
            physioNames.push(cb.dataset.name + ' ' + cb.dataset.g + 'g');
          } else {
            physioHasUnknown = true;
          }
        } else if (cb.dataset.kind === 'microbiological') {
          if (cb.dataset.n) {
            const n = cb.dataset.n;
            if (!microByN[n]) microByN[n] = [];
            microByN[n].push(cb.dataset.name);
          } else {
            microUnknownNames.push(cb.dataset.name);
          }
        }
      });

      summaryLabel.textContent = `항목 ${checkedCount}개 선택 (VAT포함)`;
      summaryTotal.textContent = fmtWon(sum) + (hasUnknown ? '+' : '');

      const buffer = bufferToggle.checked ? 30 : 0;
      const physioTotal = physioG + (physioG > 0 ? buffer : 0);

      let html = '<div class="sample-title">수거해야 할 시료량</div>';

      if (physioG > 0) {
        html += `<div class="sample-row"><span class="sample-label">이화학</span><span class="sample-value">최소 ${Math.round(physioTotal)}g${physioHasUnknown ? '+' : ''}</span></div>`;
        html += `<div class="sample-detail">${physioNames.map(escapeHtml).join(' + ')}${buffer ? ' + 여유분 30g' : ''}</div>`;
      } else if (physioHasUnknown) {
        html += `<div class="sample-row"><span class="sample-label">이화학</span><span class="sample-value">확인 필요</span></div>`;
      }

      const nKeys = Object.keys(microByN);
      if (nKeys.length > 0) {
        nKeys.forEach(n => {
          const names = microByN[n];
          html += `<div class="sample-row"><span class="sample-label">미생물 세트</span><span class="sample-value">n=${n} → ${n}개 세트</span></div>`;
          html += `<div class="sample-detail">이 세트 하나로 함께 검사: ${names.map(escapeHtml).join(', ')}</div>`;
        });
        html += `<div class="micro-explain">
          같은 세트에서 여러 미생물 항목을 동시에 검사하므로 <b>항목 수만큼 세트를 늘릴 필요는 없습니다.</b>
          완제품 단위가 넉넉하면(예: 도시락 500g) 제품을 <b>그대로 n개</b> 준비하면 되고,
          소분해서 담을 경우 세트당 최소 ${MICRO_UNIT_G}g 이상(항목이 많으면 여유있게 더) 담아주세요.
        </div>`;
      }
      if (microUnknownNames.length > 0) {
        html += `<div class="sample-row"><span class="sample-label">미생물 (n값 미확인)</span><span class="sample-value">${microUnknownNames.map(escapeHtml).join(', ')}</span></div>`;
      }

      if (physioG === 0 && !physioHasUnknown && nKeys.length === 0 && microUnknownNames.length === 0) {
        html += '<div class="sample-row"><span class="sample-label">계량 시료 없음 (완제품 확인용 항목만 선택됨)</span></div>';
      }

      sampleSummary.innerHTML = html;
    }

    checkboxes.forEach(cb => cb.addEventListener('change', recalc));
    bufferToggle.addEventListener('change', recalc);

    document.getElementById('selectAllBtn').addEventListener('click', () => {
      checkboxes.forEach(cb => { cb.checked = true; });
      recalc();
    });
    document.getElementById('deselectAllBtn').addEventListener('click', () => {
      checkboxes.forEach(cb => { cb.checked = false; });
      recalc();
    });

    recalc();
  }

  // Enter key selects top suggestion
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = searchInput.value.trim();
      if (!q) return;
      const exact = minors.find(m => m.minor === q);
      if (exact) { selectMinor(exact.minor); return; }
      const first = minors.find(m => m.minor.includes(q));
      if (first) selectMinor(first.minor);
    }
  });

  // ---- 잠재고객 발굴 탭 ----
  const pageTitle = document.getElementById('pageTitle');
  const manualSearchWrap = document.getElementById('manualSearchWrap');
  const leadsSearchWrap = document.getElementById('leadsSearchWrap');
  const leadsArea = document.getElementById('leadsArea');
  const leadsSearchInput = document.getElementById('leadsSearchInput');
  const leadsClearBtn = document.getElementById('leadsClearBtn');
  const regionChips = Array.prototype.slice.call(document.querySelectorAll('.region-chip'));
  const tabBtns = Array.prototype.slice.call(document.querySelectorAll('.tab-btn'));

  let leadsData = null;
  let leadsLoadError = false;
  let currentRegion = 'all';
  let leadsRenderLimit = 30;

  function switchTab(tab) {
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'manual') {
      pageTitle.textContent = '시험분석 매뉴얼 검색';
      manualSearchWrap.style.display = '';
      leadsSearchWrap.style.display = 'none';
      leadsArea.style.display = 'none';
      if (resultArea.innerHTML.trim()) {
        resultArea.style.display = '';
        emptyState.style.display = 'none';
      } else {
        emptyState.style.display = '';
      }
    } else {
      pageTitle.textContent = '잠재고객 발굴';
      manualSearchWrap.style.display = 'none';
      leadsSearchWrap.style.display = '';
      resultArea.style.display = 'none';
      emptyState.style.display = 'none';
      leadsArea.style.display = '';
      loadLeadsIfNeeded();
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  function loadLeadsIfNeeded() {
    if (leadsData || leadsLoadError) { renderLeads(); return; }
    leadsArea.innerHTML = '<div class="guide-note" style="margin-top:40px;">불러오는 중...</div>';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'company-data.json', true);
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var json = JSON.parse(xhr.responseText);
          leadsData = json.companies || [];
          itemCountBadge.textContent = leadsData.length + '개 업체';
          renderLeads();
        } catch (e) {
          leadsLoadError = true;
          leadsArea.innerHTML = '<div class="guide-note" style="margin-top:40px;">업체 데이터 형식이 올바르지 않습니다.</div>';
        }
      } else {
        leadsLoadError = true;
        leadsArea.innerHTML = '<div class="guide-note" style="margin-top:40px;">업체 데이터를 불러오지 못했습니다.<br>company-data.json 파일이 저장소에 있는지 확인해주세요.</div>';
      }
    };
    xhr.onerror = function() {
      leadsLoadError = true;
      leadsArea.innerHTML = '<div class="guide-note" style="margin-top:40px;">업체 데이터를 불러오지 못했습니다.<br>company-data.json 파일이 저장소에 있는지 확인해주세요.</div>';
    };
    xhr.send();
  }

  function fmtDate(ymd) {
    if (!ymd || ymd.length !== 8) return ymd || '-';
    return `${ymd.slice(0,4)}.${ymd.slice(4,6)}.${ymd.slice(6,8)}`;
  }

  function isRecent(ymd) {
    if (!ymd || ymd.length !== 8) return false;
    const d = new Date(`${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`);
    const days = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 90;
  }

  function matchesRegion(company, region) {
    if (region === 'all') return true;
    const map = { '부산': '부산광역시', '울산': '울산광역시', '경남': '경상남도' };
    return (company.address || '').includes(map[region] || region);
  }

  regionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      regionChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentRegion = chip.dataset.region;
      leadsRenderLimit = 30;
      renderLeads();
    });
  });

  leadsSearchInput.addEventListener('input', () => {
    leadsClearBtn.classList.toggle('show', leadsSearchInput.value.length > 0);
    leadsRenderLimit = 30;
    renderLeads();
  });

  leadsClearBtn.addEventListener('click', () => {
    leadsSearchInput.value = '';
    leadsClearBtn.classList.remove('show');
    leadsRenderLimit = 30;
    renderLeads();
  });

  function renderLeads() {
    if (!leadsData) return;
    const q = leadsSearchInput.value.trim();

    let filtered = leadsData.filter(c => matchesRegion(c, currentRegion));
    if (q) {
      filtered = filtered.filter(c =>
        (c.name || '').includes(q) || (c.address || '').includes(q)
      );
    }
    // 최근 인허가일자 순 정렬 (신규 업체가 위로)
    filtered = filtered.slice().sort((a, b) => (b.permit_date || '').localeCompare(a.permit_date || ''));

    const total = filtered.length;
    const shown = filtered.slice(0, leadsRenderLimit);

    const cardsHtml = shown.map(c => {
      const recent = isRecent(c.permit_date);
      const closed = (c.status || '').includes('폐업');
      const fsUrl = 'https://www.foodsafetykorea.go.kr/portal/specialinfo/searchInfoCompany.do?menu_no=2813&menu_grp=MENU_NEW04';
      return `
        <div class="lead-card">
          <div class="lead-top">
            <span class="lead-name">${escapeHtml(c.name || '이름없음')}</span>
            ${recent ? '<span class="lead-badge new">최근 인허가</span>' : ''}
            ${closed ? '<span class="lead-badge closed">폐업</span>' : ''}
          </div>
          <div class="lead-addr">${escapeHtml(c.address || '주소 미상')}</div>
          <div class="lead-meta">
            <span>인허가 ${fmtDate(c.permit_date)}</span>
            ${c.tel ? `<a href="tel:${escapeHtml(c.tel)}">${escapeHtml(c.tel)}</a>` : ''}
          </div>
          <div class="lead-fs-row">
            <button class="copy-name-btn" data-name="${escapeHtml(c.name || '')}">업체명 복사</button>
            <a href="${fsUrl}" target="_blank" rel="noopener">식품안전나라 업체검색 열기 ↗</a>
          </div>
        </div>
      `;
    }).join('');

    const loadMoreHtml = total > shown.length
      ? `<button class="load-more-btn" id="loadMoreBtn">더 보기 (${shown.length}/${total})</button>`
      : '';

    leadsArea.innerHTML = `
      <div class="leads-count-row">
        <span>검색 결과 ${total}개</span>
        <span>인허가일 최신순</span>
      </div>
      ${cardsHtml || '<div class="guide-note" style="margin-top:20px;">조건에 맞는 업체가 없습니다.</div>'}
      ${loadMoreHtml}
      <div class="guide-note">
        본 리스트는 공공데이터(행정안전부 식품제조가공업 조회서비스) 기준이며,<br>
        거래 여부는 사내 전산에서 별도로 확인해주세요.
      </div>
    `;

    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        leadsRenderLimit += 30;
        renderLeads();
      });
    }

    const copyBtns = Array.prototype.slice.call(leadsArea.querySelectorAll('.copy-name-btn'));
    copyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        copyToClipboard(name);
        const original = btn.textContent;
        btn.textContent = '복사됨 ✓';
        setTimeout(() => { btn.textContent = original; }, 1500);
      });
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
})();
