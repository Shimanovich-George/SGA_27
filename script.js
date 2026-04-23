
const __isTouchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches
  || ("ontouchstart" in window)
  || (navigator.maxTouchPoints > 0);

(() => {
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  const cursor = document.getElementById("cursor");
  const finePointer = window.matchMedia && window.matchMedia("(pointer:fine)").matches;
  if (cursor && finePointer) {
    let cx = window.innerWidth / 2;
    let cy = window.innerHeight / 2;
    let tx = cx;
    let ty = cy;
    const lerp = (a, b, t) => a + (b - a) * t;
    const render = () => {
      cx = lerp(cx, tx, 0.35);
      cy = lerp(cy, ty, 0.35);
      cursor.style.left = cx + "px";
      cursor.style.top = cy + "px";
      cursor.classList.add("is-active");
      requestAnimationFrame(render);
    };
    render();
    const clickableSel = "a, button, .tab, .thumb, [role='button'], input, textarea, select, label";
    const syncHover = (target) => {
      const el = target && target.closest ? target.closest(clickableSel) : null;
      cursor.classList.toggle("is-hover", !!el);
    };
    window.addEventListener("mousemove", (e) => {
      tx = e.clientX; ty = e.clientY;
      syncHover(e.target);
    }, { passive: true });
    document.addEventListener("mouseover", (e) => syncHover(e.target), { passive: true });
    document.addEventListener("mouseout", (e) => {
      const next = e.relatedTarget;
      if (!next || !document.documentElement.contains(next)) {
        cursor.classList.remove("is-hover");
        return;
      }
      syncHover(next);
    }, { passive: true });
    document.addEventListener("mousedown", (e) => syncHover(e.target), { passive: true });
    document.addEventListener("mouseup", (e) => syncHover(e.target), { passive: true });
    window.addEventListener("blur", () => cursor.classList.remove("is-hover"));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cursor.classList.remove("is-hover");
    });
  }

  const tabs = Array.from(document.querySelectorAll('.tab'));
  const panels = Array.from(document.querySelectorAll('.panel'));
  function activate(tabId) {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === tabId)));
    panels.forEach(p => p.classList.toggle('is-active', p.id === tabId));
  }
  tabs.forEach(t => t.addEventListener('click', () => activate(t.dataset.tab)));

  const galleries = Array.from(document.querySelectorAll('.gallery[data-project]'));
  function probeImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, url });
      img.onerror = () => resolve({ ok: false, url });
      img.src = url + (url.includes('?') ? '&' : '?') + 'probe=' + Date.now();
    });
  }

  async function buildGallery(galleryEl) {
    const project = galleryEl.dataset.project;
    const max = parseInt(galleryEl.dataset.max || '0', 10);
    const found = [];
    for (let i = 1; i <= max; i++) {
      const avif = `assets/images/project${project}_${i}.avif`;
      const webp = `assets/images/project${project}_${i}.webp`;
      const jpg = `assets/images/project${project}_${i}.jpg`;
      let res = await probeImage(avif);
      if (res.ok) { found.push(avif); continue; }
      res = await probeImage(webp);
      if (res.ok) { found.push(webp); continue; }
      res = await probeImage(jpg);
      if (res.ok) found.push(jpg);
    }
    galleryEl.dataset.images = JSON.stringify(found);
    if (!found.length) { galleryEl.innerHTML = ''; return; }
    galleryEl.innerHTML = found.map((url, idx) => `
      <button class="thumb" data-idx="${idx}" data-img="${url}" aria-label="Open image ${idx + 1}">
        <img loading="lazy" decoding="async" src="${url}" alt="Project ${project} image ${idx + 1}">
      </button>
    `).join('');
    galleryEl.querySelectorAll('.thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        const images = JSON.parse(galleryEl.dataset.images || '[]');
        const idx = parseInt(btn.dataset.idx || '0', 10);
        openLb(images, idx);
      });
    });
  }

  (async () => { for (const g of galleries) await buildGallery(g); })();

  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImg');
  const lbClose = document.getElementById('lightboxClose');
  const lbPrev = document.getElementById('lightboxPrev');
  const lbNext = document.getElementById('lightboxNext');
  let currentImages = [];
  let currentIndex = 0;

  function setNavVisibility() {
    if (!lbPrev || !lbNext) return;
    const many = currentImages.length > 1;
    lbPrev.style.display = many ? 'flex' : 'none';
    lbNext.style.display = many ? 'flex' : 'none';
  }
  function showIndex(idx) {
    if (!lb || !lbImg || !currentImages.length) return;
    const n = currentImages.length;
    currentIndex = ((idx % n) + n) % n;
    lbImg.src = currentImages[currentIndex];
    setNavVisibility();
  }
  function openLb(images, idx) {
    if (!lb || !lbImg) return;
    currentImages = images || [];
    currentIndex = idx || 0;
    lb.classList.add('is-open');
    lb.setAttribute('aria-hidden', 'false');
    showIndex(currentIndex);
  }
  function closeLb() {
    if (!lb) return;
    lb.classList.remove('is-open');
    lb.setAttribute('aria-hidden', 'true');
    if (lbImg) lbImg.src = '';
    currentImages = [];
    currentIndex = 0;
  }
  function prev() { showIndex(currentIndex - 1); }
  function next() { showIndex(currentIndex + 1); }

  if (lbClose) lbClose.addEventListener('click', closeLb);
  if (lbPrev) lbPrev.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  if (lbNext) lbNext.addEventListener('click', (e) => { e.stopPropagation(); next(); });
  if (lb) lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });

  document.addEventListener('keydown', (e) => {
    if (!lb || !lb.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;
  const SWIPE_THRESHOLD = 40;
  if (lb) {
    lb.addEventListener('touchstart', (e) => {
      if (!lb.classList.contains('is-open') || !e.touches || e.touches.length !== 1) return;
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      if (!touchActive || !e.changedTouches || e.changedTouches.length !== 1) return;
      touchActive = false;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
        if (dx > 0) prev(); else next();
      }
    }, { passive: true });
  }
})();


// cursor logic
const c = document.createElement('div');
c.className='custom-cursor';
document.body.appendChild(c);

document.addEventListener('mousemove',e=>{
  c.style.left=e.clientX+'px';
  c.style.top=e.clientY+'px';
});

document.querySelectorAll('a,button,img').forEach(el=>{
  el.addEventListener('mouseenter',()=>c.classList.add('active'));
  el.addEventListener('mouseleave',()=>c.classList.remove('active'));
});

  // v24 magnifier
  const magnifier = document.createElement('div');
  magnifier.className = 'magnifier-lens';
  document.body.appendChild(magnifier);

  function bindMagnifier(img) {
    if (!img) return;
    const activate = () => {
      const src = img.currentSrc || img.src;
      if (!src) return;
      magnifier.style.backgroundImage = `url("${src}")`;
      magnifier.classList.add('is-visible');
    };
    const deactivate = () => {
      magnifier.classList.remove('is-visible');
    };
    const move = (e) => {
      const rect = img.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        deactivate();
        return;
      }
      const lensW = 180;
      const lensH = 180;
      const zoom = 2.25;
      magnifier.style.left = (e.clientX + 24) + 'px';
      magnifier.style.top = (e.clientY + 24) + 'px';
      magnifier.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
      magnifier.style.backgroundPosition = `${-(x * zoom - lensW / 2)}px ${-(y * zoom - lensH / 2)}px`;
    };
    img.addEventListener('mouseenter', activate);
    img.addEventListener('mousemove', move);
    img.addEventListener('mouseleave', deactivate);
  }

  const bindMagnifierToExisting = () => {
    document.querySelectorAll('.thumb img, #lightboxImg').forEach(bindMagnifier);
  };
  bindMagnifierToExisting();

  const observer = new MutationObserver(() => bindMagnifierToExisting());
  observer.observe(document.body, { childList: true, subtree: true });


/* v25: disable custom cursor on touch devices */
if (__isTouchDevice) {
  document.documentElement.classList.add("touch-device");
  window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".custom-cursor, .magnifier-lens").forEach((el) => {
      el.remove();
    });
  });

  document.addEventListener("touchstart", () => {
    document.querySelectorAll(".custom-cursor, .magnifier-lens").forEach((el) => {
      el.remove();
    });
  }, { passive: true });
}
