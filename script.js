// ZEE THUMB — Optimized JS (no auto-focus on page load)
const QUALITIES=[{key:'maxresdefault',label:'Max Resolution',tag:'MAX'},{key:'sddefault',label:'HD Quality',tag:'HD'},{key:'hqdefault',label:'High Quality',tag:'HQ'},{key:'mqdefault',label:'Medium Quality',tag:'MQ'},{key:'default',label:'Default',tag:'STD'}];
const CDN='https://img.youtube.com/vi';
const $=id=>document.getElementById(id);
const urlInput=$('urlInput'),analyzeBtn=$('analyzeBtn'),clearBtn=$('clearBtn'),pasteBtnCircle=$('pasteBtnCircle'),toastContainer=$('toastContainer'),skeletonWrap=$('skeletonWrap'),resultsWrap=$('resultsWrap'),previewImg=$('previewImg'),previewBadge=$('previewBadge'),metaVideoId=$('metaVideoId'),metaResolution=$('metaResolution'),metaSizes=$('metaSizes'),qualityGrid=$('qualityGrid'),downloadAllBtn=$('downloadAllBtn'),resetBtn=$('resetBtn');
let currentVideoId=null,currentResults=[];

function extractVideoId(url){if(!url)return null;const str=url.trim(),patterns=[/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,/^([a-zA-Z0-9_-]{11})$/];for(let p of patterns){let m=str.match(p);if(m&&m[1])return m[1];}return null;}
function getThumbnailUrl(id,key){return `${CDN}/${id}/${key}.jpg`;}

// OPTIMIZED: added 4s timeout so hung requests don't freeze the UI
function checkImage(url){
  return new Promise(r=>{
    let done=false;
    let finish=result=>{if(!done){done=true;clearTimeout(timer);r(result);}};
    let timer=setTimeout(()=>finish({available:false,width:0,height:0}),4000);
    let img=new Image();
    img.onload=()=>finish({available:!(img.naturalWidth===120&&img.naturalHeight===90),width:img.naturalWidth,height:img.naturalHeight});
    img.onerror=()=>finish({available:false,width:0,height:0});
    img.src=url;
  });
}

async function fetchAvailableQualities(videoId){let checks=QUALITIES.map(async quality=>{let url=getThumbnailUrl(videoId,quality.key);let result=await checkImage(url);return{quality,url,...result};});return Promise.all(checks);}
async function downloadImage(url,filename){try{let res=await fetch(url,{mode:'cors'});if(!res.ok)throw new Error();let blob=await res.blob();let blobUrl=URL.createObjectURL(blob);let a=document.createElement('a');a.href=blobUrl;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(blobUrl);showToast('Download started!','success');}catch{window.open(url,'_blank','noopener,noreferrer');showToast('Opened in new tab','info');}}
async function copyToClipboard(text){try{await navigator.clipboard.writeText(text);showToast('URL copied!','success');}catch{showToast('Could not copy','error');}}

const ICONS={success:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,error:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,info:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`};
function showToast(msg,type='info',duration=3200){let toast=document.createElement('div');toast.className=`toast ${type}`;toast.innerHTML=`<span class="toast-icon">${ICONS[type]||ICONS.info}</span><span class="toast-msg">${msg}</span>`;toastContainer.appendChild(toast);let remove=()=>{toast.classList.add('removing');toast.addEventListener('animationend',()=>toast.remove(),{once:true});};let timer=setTimeout(remove,duration);toast.addEventListener('click',()=>{clearTimeout(timer);remove();});}
function showSkeleton(){skeletonWrap.hidden=false;resultsWrap.hidden=true;requestAnimationFrame(()=>skeletonWrap.scrollIntoView({behavior:'smooth',block:'start'}));}
function hideSkeleton(){skeletonWrap.hidden=true;}
// OPTIMIZED: requestAnimationFrame for smoother scroll after DOM update
function showResults(){resultsWrap.hidden=false;requestAnimationFrame(()=>resultsWrap.scrollIntoView({behavior:'smooth',block:'start'}));}
function setLoading(loading){analyzeBtn.disabled=loading;analyzeBtn.classList.toggle('loading',loading);}
function updateClearBtn(){let hasValue=urlInput.value.length>0;clearBtn.classList.toggle('visible',hasValue);}

function createQualityCard(item,index){
  let{quality,url,available,width,height}=item;
  let card=document.createElement('div');
  card.className=`quality-card glass-card${available?'':' unavailable'}`;
  card.style.setProperty('--card-delay',`${index*60}ms`);
  let resLabel=available&&width?`${width} × ${height} px`:'Not available';
  let filename=`thumbnail-${quality.key}.jpg`;
  // FIXED: don't set src="" on unavailable images (empty src triggers a page request)
  let imgTag=available
    ?`<img src="${url}" alt="${quality.label}" loading="lazy"/>`
    :`<img alt="${quality.label}" style="opacity:0"/>`;
  card.innerHTML=`<div class="qc-thumb">${imgTag}<span class="qc-tag">${quality.tag}</span></div><div class="qc-body"><div><div class="qc-name">${quality.label}</div><div class="qc-res">${resLabel}</div></div><div class="qc-actions"><button class="qc-btn qc-btn-dl" ${available?'':'disabled'}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Save</button><button class="qc-btn qc-btn-copy" ${available?'':'disabled'}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy</button></div><button class="qc-btn qc-btn-open" ${available?'':'disabled'}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Open in tab</button></div>`;
  if(available){card.querySelector('.qc-btn-dl').addEventListener('click',()=>downloadImage(url,filename));card.querySelector('.qc-btn-copy').addEventListener('click',()=>copyToClipboard(url));card.querySelector('.qc-btn-open').addEventListener('click',()=>window.open(url,'_blank'));}
  return card;
}

async function handleAnalyze(){
  let raw=urlInput.value.trim();
  if(!raw){showToast('Please paste a YouTube URL first','error');return;}
  let videoId=extractVideoId(raw);
  if(!videoId){showToast('Invalid YouTube URL','error');return;}
  currentVideoId=videoId;
  setLoading(true);
  showSkeleton();
  try{
    let results=await fetchAvailableQualities(videoId);
    currentResults=results;
    let available=results.filter(r=>r.available);
    if(available.length===0){hideSkeleton();showToast('No thumbnails found','error');setLoading(false);return;}
    let best=available[0];
    previewImg.src=best.url;
    previewBadge.textContent=best.quality.tag;
    metaVideoId.textContent=videoId;
    metaResolution.textContent=best.width?`${best.width} × ${best.height} px`:'—';
    metaSizes.textContent=`${available.length} of ${QUALITIES.length}`;
    qualityGrid.innerHTML='';
    results.forEach((item,idx)=>{qualityGrid.appendChild(createQualityCard(item,idx));});
    downloadAllBtn.onclick=async()=>{let avail=currentResults.filter(r=>r.available);for(let item of avail){await downloadImage(item.url,`thumbnail-${item.quality.key}.jpg`);await new Promise(r=>setTimeout(r,300));}};
    hideSkeleton();
    showResults();
    showToast(`Found ${available.length} thumbnail(s)!`,'success');
  }catch(err){
    hideSkeleton();
    showToast('Something went wrong','error');
    console.error(err);
  }finally{
    setLoading(false);
  }
}

urlInput.addEventListener('input',updateClearBtn);
clearBtn.addEventListener('click',()=>{urlInput.value='';updateClearBtn();});
pasteBtnCircle.addEventListener('click',async()=>{try{let text=await navigator.clipboard.readText();if(text){urlInput.value=text.trim();updateClearBtn();if(extractVideoId(urlInput.value))handleAnalyze();else{showToast('Pasted! Click fetch','info');}}}catch{showToast('Allow clipboard access','info');}});
urlInput.addEventListener('keydown',e=>{if(e.key==='Enter')handleAnalyze();});
analyzeBtn.addEventListener('click',handleAnalyze);
resetBtn.addEventListener('click',()=>{resultsWrap.hidden=true;skeletonWrap.hidden=true;urlInput.value='';updateClearBtn();currentVideoId=null;currentResults=[];window.scrollTo({top:0,behavior:'smooth'});});
urlInput.addEventListener('paste',()=>setTimeout(()=>{let val=urlInput.value.trim();if(val&&extractVideoId(val))handleAnalyze();},80));
document.addEventListener('dragover',e=>e.preventDefault());
document.addEventListener('drop',e=>{e.preventDefault();let text=e.dataTransfer.getData('text/plain');if(text&&extractVideoId(text)){urlInput.value=text;updateClearBtn();handleAnalyze();}});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();urlInput.focus();urlInput.select();}});

(function initScrollReveal(){
  let observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}});},{threshold:0.12});
  document.querySelectorAll('.reveal, .reveal-stagger').forEach(el=>observer.observe(el));
})();

updateClearBtn();
// NO auto-focus on page load - input remains completely neutral
