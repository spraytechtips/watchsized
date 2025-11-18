// --- Helper: Get CSS variable value ---
function getColor(varName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

// --- Theme Management ---
const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

// Load saved theme or default to dark
const savedTheme = localStorage.getItem('theme') || 'dark';
html.setAttribute('data-theme', savedTheme);
themeIcon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

// Toggle theme
themeToggle.addEventListener('click', () => {
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  themeIcon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
  
  // Re-render to update dynamic colors
  render();
});

// --- View Mode Management ---
let currentViewMode = 'side-by-side';

const viewButtons = document.querySelectorAll('.view-btn');
const swapBtn = document.getElementById('swapBtn');

viewButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    viewButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentViewMode = btn.dataset.view;
    render();
  });
});

// Swap button swaps the dropdown selections
swapBtn.addEventListener('click', () => {
  const leftValue = leftSel.value;
  const rightValue = rightSel.value;
  leftSel.value = rightValue;
  rightSel.value = leftValue;
  render();
});

// Request box behavior
const requestBox = document.getElementById('requestBox');
const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSd3f9YDYPTN9tm9t6k95sJL1jIQgCmp-1iMhIazfrWkmHoKag/viewform?usp=sharing&ouid=112511788074975319696';

requestBox.addEventListener('click', ()=>{
  window.open(formUrl, '_blank', 'noopener,noreferrer');
});

// --- Data and constants ---
let DATA = [];

// Fallback watch data if no CSV is loaded
const FALLBACK = [
  { id:'explorer2-226570', brand:'Rolex', model:'Explorer II (226570)', reference:'226570', diameter_mm:42, l2l_mm:50, thickness_mm:12.5, lug_mm:21 },
  { id:'speedy-pro',       brand:'Omega', model:'Speedmaster Professional', reference:'310.30.42.50.01.002', diameter_mm:42, l2l_mm:48.5, thickness_mm:13.2, lug_mm:20 },
  { id:'bb54',             brand:'Tudor', model:'Black Bay 54', reference:'79000', diameter_mm:37, l2l_mm:46, thickness_mm:11.2, lug_mm:20 },
  { id:'santos-medium',    brand:'Cartier', model:'Santos Medium', reference:'WSSA0029', diameter_mm:35, l2l_mm:42, thickness_mm:8.8, lug_mm:20 },
];

// --- DOM element references ---
const leftSel   = document.getElementById('leftSelect');
const rightSel  = document.getElementById('rightSelect');
const stage     = document.getElementById('stage');
const scalePxEl = document.getElementById('scalePx');

// --- Normalize CSV/JSON row to watch object ---
function normalizeRow(r){
  const id = (r.id && String(r.id)) || `${(r.brand||'').toLowerCase()}-${(r.model||'').toLowerCase().replace(/\s+/g,'-')}`;
  const num = (v) => (v===undefined||v===null||v==='') ? null : Number(v);
  const imageUrl = (r.image || '').trim();
  return {
    id,
    brand: r.brand || '',
    model: r.model || '',
    reference: r.reference || '',
    image: imageUrl,
    diameter_mm: num(r.diameter_mm ?? r.diameter ?? r.case_diameter_mm),
    l2l_mm:      num(r.l2l_mm ?? r.lug_to_lug_mm ?? r.lug_to_lug),
    thickness_mm:num(r.thickness_mm ?? r.thickness),
    lug_mm:      num(r.lug_mm ?? r.lug_width_mm ?? r.lug_width),
  };
}

// --- Populate dropdowns with watch data ---
function populateSelects(data){
  const opts = data.map(w => ({ value:w.id, label:`${w.brand} — ${w.model}` }));
  for(const sel of [leftSel,rightSel]){
    sel.innerHTML = '';
    for(const o of opts){
      const opt = document.createElement('option');
      opt.value=o.value;
      opt.textContent=o.label;
      sel.appendChild(opt);
    }
  }
  if(data[0]) leftSel.value = data[0].id;
  if(data[1]) rightSel.value = data[1].id;
}

// --- Simple CSV parser ---
function parseCSV(text){
  const rows=[]; let i=0, field='', row=[], inQ=false;
  const pushF=()=>{ row.push(field); field=''; };
  const pushR=()=>{ rows.push(row); row=[]; };
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else { inQ=false; } }
      else field+=c;
    } else {
      if(c==='"') inQ=true;
      else if(c===',') pushF();
      else if(c=='\n' || c=='\r'){ if(c=='\r' && text[i+1]=='\n') i++; pushF(); pushR(); }
      else field+=c;
    }
    i++;
  }
  pushF(); if(row.length) pushR();
  if(!rows.length) return [];
  const headers = rows[0].map(h=>h.trim());
  return rows.slice(1).filter(r=>r.length>1).map(r=>{
    const obj={}; for(let j=0;j<headers.length;j++) obj[headers[j]]=(r[j]||'').trim(); return obj;
  });
}

// --- Try to auto-load watches.csv or watches.json ---
async function tryAutoLoad(){
  if(location.protocol==='file:') return null;
  try{
    const res = await fetch('watches.csv');
    if(res.ok){
      const text = await res.text();
      const rows = parseCSV(text).map(normalizeRow).filter(v=>v.diameter_mm && v.l2l_mm);
      if(rows.length) return rows;
    }
  }catch(e){}
  try{
    const res = await fetch('watches.json');
    if(res.ok){
      const json = await res.json();
      const rows = json.map(normalizeRow).filter(v=>v.diameter_mm && v.l2l_mm);
      if(rows.length) return rows;
    }
  }catch(e){}
  return null;
}

// --- Draw a single watch at (x, y) ---
function drawWatch(container, w, pxPerMm, x, y, textPos = 'top', zIndex = 1, containerWidth = 0, opacity = 1.0, textX = null){
  const caseW = w.l2l_mm * pxPerMm;
  const caseH = w.l2l_mm * pxPerMm;
  const squareSize = Math.max(caseH, caseW);
  
  const watchDiv = document.createElement('div');
  watchDiv.style.position = 'absolute';
  watchDiv.style.left = `${x-squareSize/2}px`;
  watchDiv.style.top = `${y-squareSize/2}px`;
  watchDiv.style.width = `${squareSize}px`;
  watchDiv.style.height = `${squareSize}px`;
  watchDiv.style.borderRadius = '1px';
  watchDiv.style.overflow = 'hidden';
  watchDiv.style.backgroundColor = 'transparent';
  watchDiv.style.border = 'none';
  watchDiv.style.zIndex = zIndex;
  watchDiv.style.opacity = opacity;
  
  // Add image if available
  if(w.image){
    const img = document.createElement('img');
    img.src = w.image;
    img.style.position = 'absolute';
    img.style.top = '0';
    img.style.left = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center';
    img.style.pointerEvents = 'none';
    img.onerror = () => {
      img.remove();
      watchDiv.style.backgroundColor = getColor('--watch-error');
      console.error('Failed to load image:', w.image);
    };
    watchDiv.appendChild(img);
  }
  
  container.appendChild(watchDiv);
  
  // Add watch info text
  const infoDiv = document.createElement('div');
  infoDiv.style.position = 'absolute';
  infoDiv.style.width = '200px';
  infoDiv.style.zIndex = zIndex + 10;
  
  // Use textX if provided (for overlapped mode), otherwise use x
  const finalTextX = textX !== null ? textX : x;
  
  let textAlignment = 'center'; // default
  
  // Position text based on mode
  if (textPos === 'top') {
    infoDiv.style.left = `${finalTextX-100}px`;
    infoDiv.style.top = `${y-caseW/2-50}px`;
    textAlignment = 'center';
  } else if (textPos === 'overlapped-left') {
    // For overlapped mode - use default X positioning, side Y positioning, right-justified
    infoDiv.style.width = '120px';
    infoDiv.style.left = `${finalTextX-120}px`;
    infoDiv.style.top = `${y-30}px`;
    textAlignment = 'right';
  } else if (textPos === 'overlapped-right') {
    // For overlapped mode - use default X positioning, side Y positioning, left-justified
    infoDiv.style.width = '120px';
    infoDiv.style.left = `${finalTextX}px`;
    infoDiv.style.top = `${y-30}px`;
    textAlignment = 'left';
  } else if (textPos === 'left') {
    // For touching mode - right-justified text for LEFT watch
    infoDiv.style.width = '120px';
    infoDiv.style.right = `${containerWidth - x - 36}px`;
    infoDiv.style.top = `${y-caseW/2-50}px`;
    textAlignment = 'right';
  } else if (textPos === 'right') {
    // For touching mode - left-justified text for RIGHT watch
    infoDiv.style.width = '120px';
    infoDiv.style.left = `${x - 36}px`;
    infoDiv.style.top = `${y-caseW/2-50}px`;
    textAlignment = 'left';
  }
  
  const brandText = document.createElement('div');
  brandText.style.color = getColor('--info-name');
  brandText.style.fontSize = window.innerWidth < 600 ? '9px' : '12px';
  brandText.style.fontWeight = '600';
  brandText.style.textAlign = textAlignment;
  brandText.textContent = w.brand;
  
  const modelText = document.createElement('div');
  modelText.style.color = getColor('--info-name');
  modelText.style.fontSize = window.innerWidth < 600 ? '9px' : '12px';
  modelText.style.marginTop = '2px';
  modelText.style.textAlign = textAlignment;
  modelText.textContent = w.model;
  
  const specText = document.createElement('div');
  specText.style.color = getColor('--info-spec');
  specText.style.fontSize = window.innerWidth < 600 ? '8px' : '11px';
  specText.style.marginTop = '4px';
  specText.style.textAlign = textAlignment;
  specText.textContent = `Lug-to-Lug: ${w.l2l_mm}mm`;
  
  infoDiv.appendChild(brandText);
  infoDiv.appendChild(modelText);
  infoDiv.appendChild(specText);
  container.appendChild(infoDiv);
}

// --- Main render function ---
function render(){
  // Remove all children except the swap button
  const swapBtn = document.getElementById('swapBtn');
  while (stage.firstChild) {
    if (stage.firstChild !== swapBtn) {
      stage.removeChild(stage.firstChild);
    } else {
      // If we hit the swap button, remove everything after it
      while (stage.children.length > 1) {
        stage.removeChild(stage.lastChild);
      }
      break;
    }
  }
  
  if(!DATA.length){ 
    const metaDiv = document.createElement('div');
    metaDiv.className = 'meta';
    metaDiv.textContent = 'No watches loaded yet.';
    stage.appendChild(metaDiv);
    return; 
  }
  
  const rect = stage.getBoundingClientRect();
  const canvasW = Math.max(320, Math.floor(rect.width-16));
  const canvasH = window.innerWidth < 600 ? 220 : 400;
  const viewportMm = 200;
  const pxPerMm = canvasW / viewportMm;
  scalePxEl.textContent = pxPerMm.toFixed(2);
  
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.width = `${canvasW}px`;
  container.style.height = `${canvasH}px`;
  container.style.background = getColor('--container-bg');
  container.style.borderRadius = '18px';
  
  const cx = canvasW/2, cy = canvasH/2;
  
  // Get watches
  let leftWatch = DATA.find(d=>d.id===leftSel.value) || DATA[0];
  let rightWatch = DATA.find(d=>d.id===rightSel.value) || DATA[1] || DATA[0];
  
  // Draw watches based on view mode
  if (currentViewMode === 'side-by-side') {
    const gap = window.innerWidth < 600 ? Math.min(200, canvasW*0.18) : 220;
    drawWatch(container, leftWatch, pxPerMm, cx-gap, cy, 'top', 1, canvasW);
    drawWatch(container, rightWatch, pxPerMm, cx+gap, cy, 'top', 1, canvasW);
  } else if (currentViewMode === 'touching') {
    const leftSize = Math.max(leftWatch.l2l_mm, leftWatch.diameter_mm) * pxPerMm;
    const rightSize = Math.max(rightWatch.l2l_mm, rightWatch.diameter_mm) * pxPerMm;
    const totalWidth = (leftSize + rightSize) / 2;
    drawWatch(container, leftWatch, pxPerMm, cx - totalWidth / 2, cy, 'left', 1, canvasW);
    drawWatch(container, rightWatch, pxPerMm, cx + totalWidth / 2, cy, 'right', 1, canvasW);
  } else if (currentViewMode === 'overlapped') {
    const gap = window.innerWidth < 600 ? Math.min(200, canvasW*0.18) : 220;
    // Draw with opacity: back watch at 0.8, front watch at 1.0
    // Text positioned at side-by-side X coords but with left/right positioning
    drawWatch(container, leftWatch, pxPerMm, cx, cy, 'overlapped-left', 1, canvasW, 0.8, cx-gap);
    drawWatch(container, rightWatch, pxPerMm, cx, cy, 'overlapped-right', 2, canvasW, 1.0, cx+gap);
  }
  
  stage.appendChild(container);
}

// --- Event listeners ---
leftSel.addEventListener('change', render);
rightSel.addEventListener('change', render);

window.addEventListener('resize', render);

// --- Initial load ---
(async function init(){
  const served = await tryAutoLoad();
  DATA = (served && served.length) ? served : FALLBACK;
  populateSelects(DATA);
  render();
})();
