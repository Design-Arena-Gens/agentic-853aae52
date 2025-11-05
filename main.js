(function(){
  const overlay = document.getElementById('overlay');
  const selection = document.getElementById('selection');
  const startBtn = document.getElementById('startBtn');

  let isSelecting = false;
  let startX = 0, startY = 0, curX = 0, curY = 0;

  function clamp(min, v, max) { return Math.max(min, Math.min(v, max)); }

  function startOverlay() {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function stopOverlay() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    selection.hidden = true;
    isSelecting = false;
  }

  function updateSelectionRect() {
    const x1 = Math.min(startX, curX);
    const y1 = Math.min(startY, curY);
    const x2 = Math.max(startX, curX);
    const y2 = Math.max(startY, curY);
    const w = x2 - x1;
    const h = y2 - y1;
    selection.hidden = false;
    selection.style.left = x1 + 'px';
    selection.style.top = y1 + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';
  }

  function snapToGrid(x, y, width, height) {
    const rect = overlay.getBoundingClientRect();
    const cellW = rect.width / 3;
    const cellH = rect.height / 3;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const col = clamp(0, Math.floor(centerX / cellW), 2);
    const row = clamp(0, Math.floor(centerY / cellH), 2);
    return { x: Math.round(col * cellW), y: Math.round(row * cellH), w: Math.round(cellW), h: Math.round(cellH) };
  }

  startBtn.addEventListener('click', startOverlay);

  overlay.addEventListener('mousedown', (e) => {
    isSelecting = true;
    const r = overlay.getBoundingClientRect();
    startX = e.clientX - r.left;
    startY = e.clientY - r.top;
    curX = startX;
    curY = startY;
    updateSelectionRect();
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    const r = overlay.getBoundingClientRect();
    curX = e.clientX - r.left;
    curY = e.clientY - r.top;
    updateSelectionRect();
  });

  function animateTo(finalRect) {
    selection.style.transition = 'all 120ms ease-out';
    selection.style.left = finalRect.x + 'px';
    selection.style.top = finalRect.y + 'px';
    selection.style.width = finalRect.w + 'px';
    selection.style.height = finalRect.h + 'px';
    setTimeout(() => {
      selection.style.transition = '';
      stopOverlay();
    }, 140);
  }

  overlay.addEventListener('mouseup', (e) => {
    if (!isSelecting) return;
    isSelecting = false;
    const x1 = Math.min(startX, curX);
    const y1 = Math.min(startY, curY);
    const w = Math.abs(curX - startX);
    const h = Math.abs(curY - startY);
    const snapped = snapToGrid(x1, y1, w, h);
    animateTo(snapped);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      stopOverlay();
    }
  });
})();
