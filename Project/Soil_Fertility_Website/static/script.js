const form = document.getElementById('soilForm');
const errorBox = document.getElementById('error');
const submitButton = document.getElementById('btn');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.classList.add('hidden');
  const data = Object.fromEntries(new FormData(form));
  for (const key of Object.keys(data)) {
    data[key] = Number(data[key]);
    if (!Number.isFinite(data[key]) || data[key] < 0) {
      errorBox.textContent = 'Please enter a valid non-negative number for every soil parameter.';
      errorBox.classList.remove('hidden');
      return;
    }
  }
  submitButton.disabled = true;
  submitButton.innerHTML = 'Analyzing…';
  try {
    const response = await fetch('/predict', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Prediction failed.');
    document.getElementById('cls').textContent = `Class ${result.predicted_class}`;
    document.getElementById('conf').textContent = `${Number(result.confidence).toFixed(2)}%`;
    document.getElementById('status').textContent = result.suitability || 'Predicted class';
    document.getElementById('recommend').textContent = result.recommendation || 'Review the predicted class with a soil specialist.';
    document.getElementById('confidenceFill').style.width = `${Math.max(0, Math.min(100, Number(result.confidence)))}%`;
    document.getElementById('probs').innerHTML = Object.entries(result.probabilities || {}).map(([label, value]) => {
      const percentage = Math.max(0, Math.min(100, Number(value)));
      return `<div class="probability-row"><span class="prob-label">Class ${label}</span><div class="track"><div class="fill" style="width:${percentage}%"></div></div><span class="prob-value">${percentage.toFixed(2)}%</span></div>`;
    }).join('');
    document.getElementById('results').scrollIntoView({behavior: 'smooth', block: 'start'});
  } catch (error) {
    errorBox.textContent = 'Prediction failed. Check that the FastAPI server is running and soil_fertility_model.pkl is in the website folder.';
    errorBox.classList.remove('hidden');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Analyze Soil <span>→</span>';
  }
});

// Sidebar view switching: only the selected view is shown.
const navLinks = [...document.querySelectorAll('#sideNav .nav-link')];
const views = [...document.querySelectorAll('[data-view-panel]')];
function showView(name, updateHash = true) {
  if (!views.some(v => v.dataset.viewPanel === name)) name = 'overview';
  views.forEach(v => v.classList.toggle('active', v.dataset.viewPanel === name));
  navLinks.forEach(l => l.classList.toggle('active', l.dataset.view === name));
  if (updateHash && location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
  window.scrollTo({top: 0, behavior: 'instant'});
  if (name === 'performance' && typeof loadModelAnalysis === 'function') loadModelAnalysis(); // charts need a visible canvas to size correctly
}
document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); showView(el.dataset.view); }));
window.addEventListener('hashchange', () => showView(location.hash.slice(1), false));

// Dataset / validation figures. These numbers are not stored in the website or the model file,
// so fill them in from your notebook output. Leave as null to show a placeholder.
const DATASET_CLASS_COUNTS = null;   // e.g. {0: 000, 1: 000, 2: 000}
const DATASET_QUALITY = null;        // e.g. {samples: 000, missing: 0, duplicates: 0}
const CV_RESULTS = null;             // e.g. [{model: 'Decision Tree', mean: 00.00, std: 0.00}, {model: 'Random Forest', mean: 00.00, std: 0.00}]
(function renderDatasetFigures() {
  const dist = document.getElementById('classDistribution'), distNote = document.getElementById('classDistNote');
  if (DATASET_CLASS_COUNTS) {
    const total = Object.values(DATASET_CLASS_COUNTS).reduce((a, b) => a + b, 0);
    dist.innerHTML = Object.entries(DATASET_CLASS_COUNTS).map(([k, n]) => { const pct = total ? n / total * 100 : 0;
      return `<div class="probability-row" style="grid-template-columns:70px 1fr 110px"><span class="prob-label">Class ${k}</span><div class="track"><div class="fill" style="width:${pct}%"></div></div><span class="prob-value">${n} (${pct.toFixed(1)}%)</span></div>`; }).join('');
    distNote.textContent = 'Share of samples in each class.';
  } else {
    dist.innerHTML = '<p class="empty-state">Class counts have not been added yet.</p>';
    distNote.textContent = 'Add your class counts to DATASET_CLASS_COUNTS in static/script.js to display the distribution.';
  }
  if (DATASET_QUALITY) {
    document.getElementById('dqSamples').textContent = DATASET_QUALITY.samples;
    document.getElementById('dqMissing').textContent = `${DATASET_QUALITY.missing} found`;
    document.getElementById('dqDuplicates').textContent = `${DATASET_QUALITY.duplicates} found`;
  }
  const cv = document.getElementById('cvResults'), cvNote = document.getElementById('cvNote');
  if (CV_RESULTS) {
    cv.innerHTML = CV_RESULTS.map(r => `<div class="probability-row" style="grid-template-columns:150px 1fr 110px"><span class="prob-label">${r.model}</span><div class="track"><div class="fill" style="width:${r.mean}%"></div></div><span class="prob-value">${Number(r.mean).toFixed(2)}%${r.std != null ? ' ± ' + Number(r.std).toFixed(2) : ''}</span></div>`).join('');
    cvNote.textContent = 'Mean accuracy across the 5 folds (± standard deviation).';
  } else {
    cv.innerHTML = '<p class="empty-state">Cross-validation scores have not been added yet.</p>';
    cvNote.textContent = 'Add your scores to CV_RESULTS in static/script.js to display them.';
  }
})();

// Lightweight canvas charts; no charting library or external service is required.
const chartPalette = ['#26865e', '#70b99a', '#e4ad55', '#5b8fd1'];
function setupCanvas(canvas, height) {
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(300, rect.width) * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  return {ctx, width: Math.max(300, rect.width), height};
}
function drawBarChart(canvasId, labels, values, maxValue=100) {
  const canvas = document.getElementById(canvasId); const ready = setupCanvas(canvas, 290); if (!ready) return;
  const {ctx, width, height} = ready; ctx.clearRect(0,0,width,height);
  const left=42, right=14, top=18, bottom=48, plotW=width-left-right, plotH=height-top-bottom;
  ctx.font='11px Arial'; ctx.textAlign='right'; ctx.textBaseline='middle'; ctx.fillStyle='#7b8780';
  [0,25,50,75,100].forEach(t=>{const y=top+plotH-(t/100)*plotH;ctx.strokeStyle='#e9efeb';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.fillText(t+'%',left-8,y);});
  const slot=plotW/labels.length, bw=Math.min(52,slot*.52);
  labels.forEach((label,i)=>{const h=(values[i]/maxValue)*plotH,x=left+slot*i+(slot-bw)/2,y=top+plotH-h;ctx.fillStyle=chartPalette[i%chartPalette.length];roundRect(ctx,x,y,bw,h,6);ctx.fill();ctx.fillStyle='#32443a';ctx.textAlign='center';ctx.font='bold 11px Arial';ctx.fillText(values[i].toFixed(2)+'%',x+bw/2,Math.max(top+7,y-11));ctx.fillStyle='#68766e';ctx.font='10px Arial';wrapLabel(ctx,label,x+bw/2,top+plotH+16,slot-3);});
}
function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath();}
function wrapLabel(ctx,text,x,y,maxWidth){const words=text.split(' ');let line='';words.forEach((word,i)=>{const test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,y);line=word;y+=12;}else line=test;});ctx.fillText(line,x,y);}
function drawGroupedChart(){
 const canvas=document.getElementById('metricsChart');const ready=setupCanvas(canvas,290);if(!ready)return;const {ctx,width,height}=ready;ctx.clearRect(0,0,width,height);
 const labels=['Decision Tree','Random Forest','Tuned Decision Tree','Tuned Random Forest'];const series=[{name:'Precision',values:[83.0642,85.2106,87.7108,85.2106],color:'#26865e'},{name:'Recall',values:[81.8182,89.2045,86.9318,89.2045],color:'#70b99a'},{name:'F1-score',values:[82.3397,87.1395,87.2568,87.1395],color:'#e4ad55'}];
 const left=42,right=8,top=18,bottom=55,plotW=width-left-right,plotH=height-top-bottom;ctx.font='11px Arial';ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle='#7b8780';[0,25,50,75,100].forEach(t=>{const y=top+plotH-(t/100)*plotH;ctx.strokeStyle='#e9efeb';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.fillText(t+'%',left-8,y);});
 const slot=plotW/labels.length, groupW=Math.min(slot*.72,70),bw=groupW/3;labels.forEach((label,i)=>{series.forEach((s,j)=>{const h=s.values[i]/100*plotH,x=left+slot*i+(slot-groupW)/2+j*bw,y=top+plotH-h;ctx.fillStyle=s.color;roundRect(ctx,x,y,bw-3,h,3);ctx.fill();});ctx.fillStyle='#68766e';ctx.textAlign='center';ctx.font='10px Arial';wrapLabel(ctx,label,left+slot*i+slot/2,top+plotH+15,slot-4);});
}
function drawImportance(items){
 const canvas=document.getElementById('importanceChart');const msg=document.getElementById('importanceMessage');if(!items||!items.length){if(msg)msg.textContent='Feature importance is not available from the loaded model. Confirm that soil_fertility_model.pkl contains the Random Forest model.';return;}
 const topItems=items.slice(0,12);const height=Math.max(320,topItems.length*27+30);const ready=setupCanvas(canvas,height);if(!ready)return;const {ctx,width}=ready;canvas.parentElement.style.height=height+'px';ctx.clearRect(0,0,width,height);const left=Math.min(130,width*.36),right=45,rowH=26,barW=width-left-right;ctx.font='11px Arial';topItems.forEach((item,i)=>{const y=14+i*rowH;ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillStyle='#58675e';ctx.fillText(item.feature,left-9,y+7);ctx.fillStyle='#edf3ef';roundRect(ctx,left,y,barW,13,5);ctx.fill();const w=Math.max(1,Math.min(barW,item.importance/Math.max(...topItems.map(v=>v.importance),1)*barW));ctx.fillStyle='#26865e';roundRect(ctx,left,y,w,13,5);ctx.fill();ctx.textAlign='left';ctx.fillStyle='#58675e';ctx.fillText(Number(item.importance).toFixed(2)+'%',left+barW+7,y+7);});if(msg)msg.textContent='Live feature importance from the saved model (top features first).';
}
async function loadModelAnalysis(){
 drawBarChart('accuracyChart',['Decision Tree','Random Forest','Tuned Decision Tree','Tuned Random Forest'],[81.8182,89.2045,86.9318,89.2045]);drawGroupedChart();
 try{const response=await fetch('/analysis');if(!response.ok)throw new Error('Analysis endpoint unavailable');const data=await response.json();if(data.available)drawImportance(data.features);else drawImportance([]);}catch(e){drawImportance([]);}
}
loadModelAnalysis();let chartResizeTimer;window.addEventListener('resize',()=>{clearTimeout(chartResizeTimer);chartResizeTimer=setTimeout(loadModelAnalysis,180);});
showView(location.hash.slice(1) || 'overview', false);
