(function () {
  const DATA = window.MANUAL_DATA;
  const items = DATA.items;
  const minors = DATA.minors;

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

    const cardsHtml = list.map(it => {
      const gram = fmtGram(it);
      const feeVat = it.fee_vat;
      if (feeVat === null || feeVat === undefined) feeSumHasUnknown = true;
      else feeSum += feeVat;

      const specsHtml = it.specs && it.specs.length
        ? it.specs.map(s => escapeHtml(s)).join(' / ')
        : '-';

      const flags = [];
      if (it.designated) flags.push('<span class="flag designated">지정검사</span>');
      if (it.period_mfg) flags.push(`<span class="flag period">제조·가공 ${escapeHtml(it.period_mfg)}</span>`);

      const sampleHtml = gram
        ? `<span class="card-sample">시료 ${gram}</span>`
        : `<span class="card-sample muted">${it.category === '자가품질검사' ? '완제품 단위 수거' : '별도 기준'}</span>`;

      return `
        <div class="card">
          <div class="card-top">
            <span class="card-item-name">${escapeHtml(it.item)}</span>
            <span class="card-fee">${fmtWon(feeVat)}</span>
          </div>
          <div class="card-sub">
            <span class="card-spec">기준 ${specsHtml}</span>
            ${sampleHtml}
          </div>
          ${flags.length ? `<div class="card-flags">${flags.join('')}</div>` : ''}
          ${it.note ? `<div class="card-note">${escapeHtml(it.note)}</div>` : ''}
        </div>
      `;
    }).join('');

    const summaryHtml = `
      <div class="summary-bar">
        <span>항목 ${list.length}개 합계 (VAT포함)</span>
        <span class="total">${fmtWon(feeSum)}${feeSumHasUnknown ? '+' : ''}</span>
      </div>
    `;

    resultArea.innerHTML = `
      <div class="result-header">
        <div>
          <div class="result-path">${escapeHtml(first.major)} · ${escapeHtml(first.mid)}</div>
          <div class="result-title">${escapeHtml(minorName)}</div>
        </div>
        <div class="result-meta">${escapeHtml(catLabel)}</div>
      </div>
      ${cardsHtml}
      ${summaryHtml}
      <div class="guide-note">
        수수료는 부가세 포함 기준이며 변동될 수 있습니다.<br>
        시료량 미표시 항목(미생물·중금속 등)은 완제품 단위로 별도 수거 기준이 적용됩니다.
      </div>
    `;
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
})();
