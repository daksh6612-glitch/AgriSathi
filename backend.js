// AgriSathi Backend Integration - Handles Login, Save Scans, Live Data
const API_BASE = window.location.hostname.includes('e2b.app') 
  ? window.location.origin.replace(/8000-/, '3000-').replace(':8000','').replace(/https:/,'https:') // will be proxied, fallback to same host
  : ''; // local dev

let API = API_BASE || ''; // if same origin serves API (backend serves frontend)
if(window.location.port === '8000') API = window.location.origin.replace('8000','3000');
if(window.location.port === '3000') API = ''; // same port
if(!API) API = ''; // relative

// Correct API detection - backend is on 3000, frontend on 8000, so use absolute URL with 3000 port
(function fixAPI(){
  try{
    const host = window.location.hostname;
    const proto = window.location.protocol;
    if(host.includes('e2b.app')){
      const id = host.split('.')[0].split('-').slice(1).join('-'); // extract sandbox id
      // Preview URL is like https://8000-xxxx.e2b.app -> backend is https://3000-xxxx.e2b.app
      API = `${proto}//3000-${id}.e2b.app`;
    } else if(window.location.port==='8000'){
      API = `http://localhost:3000`;
    } else {
      API = '';
    }
  }catch(e){ API=''; }
})();

let currentUser = JSON.parse(localStorage.getItem('agrisathi_user')||'null');

async function apiCall(path, opts={}){
  const url = (API + path);
  try{
    const r = await fetch(url, {...opts, headers:{'Content-Type':'application/json', ...(opts.headers||{})}});
    return await r.json();
  }catch(e){
    console.log('API fail',path,e);
    return null;
  }
}

// --- Auth UI ---
function ensureLoginUI(){
  if(document.getElementById('loginModal')) return;
  const modal = document.createElement('div');
  modal.id='loginModal';
  modal.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:500;display:none;align-items:center;justify-content:center;padding:16px" id="loginOverlay">
    <div style="background:white;border-radius:20px;padding:20px;max-width:360px;width:100%;box-shadow:0 12px 40px rgba(0,0,0,0.2)">
      <h3 style="font-size:16px;font-weight:800">👋 Login to AgriSathi</h3>
      <p style="font-size:12px;color:#666;margin-top:4px">Your scans will be saved. OTP is 123456 (demo).</p>
      <div style="margin-top:14px">
        <label style="font-size:11px;font-weight:700;color:#1B5E20">📱 Phone Number</label>
        <input id="loginPhone" placeholder="98765 43210" style="width:100%;margin-top:6px;border:1.5px solid #E0E0E0;border-radius:10px;padding:10px;font-size:14px" value="9876543210">
        <label style="font-size:11px;font-weight:700;color:#1B5E20;margin-top:10px;display:block">👤 Your Name</label>
        <input id="loginName" placeholder="Ramesh Gowda" style="width:100%;margin-top:6px;border:1.5px solid #E0E0E0;border-radius:10px;padding:10px;font-size:14px" value="">
        <div id="otpArea" style="display:none;margin-top:10px">
          <label style="font-size:11px;font-weight:700;color:#1B5E20">🔑 Enter OTP (Demo: 123456)</label>
          <input id="loginOtp" placeholder="123456" style="width:100%;margin-top:6px;border:1.5px solid #1B5E20;border-radius:10px;padding:10px;font-size:16px;letter-spacing:4px;text-align:center;font-weight:700">
        </div>
        <button id="loginBtn" onclick="handleLogin()" style="width:100%;margin-top:14px;background:linear-gradient(135deg,#1B5E20,#43A047);color:white;padding:12px;border-radius:12px;font-weight:700;border:none;cursor:pointer">📤 Send OTP</button>
        <p style="font-size:10px;color:#999;text-align:center;margin-top:8px">🔒 Secure • No spam • Free forever</p>
      </div>
      <button onclick="closeLogin()" style="margin-top:10px;width:100%;background:#F5F5F5;border:none;padding:8px;border-radius:10px;font-size:11px;font-weight:600;cursor:pointer">Skip for now</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}
function openLogin(){ ensureLoginUI(); document.getElementById('loginOverlay').style.display='flex'; }
function closeLogin(){ document.getElementById('loginOverlay').style.display='none'; }
async function handleLogin(){
  const phone = document.getElementById('loginPhone').value.trim().replace(/\s/g,'');
  const name = document.getElementById('loginName').value.trim();
  const otpInput = document.getElementById('loginOtp');
  const otpArea = document.getElementById('otpArea');
  const btn = document.getElementById('loginBtn');
  if(!phone || phone.length<10) return showToast('📱 Enter valid phone number');
  if(otpArea.style.display==='none'){
    btn.textContent='⏳ Sending...';
    const res = await apiCall('/api/auth/send-otp',{method:'POST', body: JSON.stringify({phone})});
    btn.textContent='✅ Verify OTP →';
    otpArea.style.display='block';
    otpInput.focus();
    showToast('📤 OTP sent! Demo OTP is 123456');
    return;
  } else {
    const otp = otpInput.value.trim();
    if(!otp) return showToast('🔑 Enter OTP (123456)');
    btn.textContent='⏳ Verifying...';
    const res = await apiCall('/api/auth/verify-otp',{method:'POST', body: JSON.stringify({phone, otp, name})});
    if(res && res.success){
      currentUser = res.user;
      localStorage.setItem('agrisathi_user', JSON.stringify(currentUser));
      closeLogin();
      showToast('✅ Welcome, '+currentUser.name+'! You are logged in');
      updateLoginUI();
      btn.textContent='📤 Send OTP';
      otpArea.style.display='none';
    } else {
      showToast('❌ '+(res?res.error:'Network error'));
      btn.textContent='✅ Verify OTP →';
    }
  }
}
function updateLoginUI(){
  if(currentUser){
    const el = document.getElementById('greetTitle');
    if(el) el.innerHTML = `ನಮಸ್ಕಾರ, <span>${currentUser.name} 🙏</span>`;
    // update profile
    const pHeader = document.querySelector('.profile-header h3');
    if(pHeader) pHeader.textContent = currentUser.name;
    const pSub = document.querySelector('.profile-header p');
    if(pSub) pSub.textContent = `${currentUser.location} • ${currentUser.totalScans||0} Scans • ${currentUser.phone}`;
  }
}
function ensureLoggedInForScan(){
  if(!currentUser){
    showToast('👋 Please login first - takes 5 seconds');
    openLogin();
    return false;
  }
  return true;
}
// Auto-ensure login UI exists and show after 3 sec if not logged in
setTimeout(()=>{ ensureLoginUI(); updateLoginUI(); if(!currentUser) setTimeout(openLogin, 2000); }, 800);

// --- Save Scan to Backend ---
async function saveScanToBackend(diseaseData){
  if(!currentUser) return;
  await apiCall('/api/scans',{method:'POST', body: JSON.stringify({
    phone: currentUser.phone,
    crop: selectedCrop,
    disease: diseaseData.name,
    confidence: diseaseData.conf,
    image: currentImageSrc ? currentImageSrc.substring(0,200) : null,
    cure: (diseaseData.organic||[]).join(' | ')
  })});
}

// --- Live Mandi & Weather ---
async function loadLiveMandi(){
  const res = await apiCall('/api/mandi-prices');
  if(!res || !res.prices) return;
  const container = document.querySelector('#screen-mandi');
  if(!container) return;
  // Find mandi cards area and replace
  const cardsHTML = res.prices.map(p=>`
    <div class="mandi-card">
      <div><h4>${p.commodity==='Tomato'?'🍅':p.commodity==='Ragi'?'🌾':p.commodity==='Paddy'?'🌱':'🌶️'} ${p.commodity} - ${p.market}</h4><span>${p.date} • ${p.source}</span></div>
      <div style="text-align:right"><div class="price">₹${p.price} <small>/${p.unit}</small></div><div class="trend ${p.trend==='down'?'down':'up'}">${p.trend==='down'?'▼':'▲'} ${p.change? 'Rs.'+p.change : ''}</div></div>
    </div>
  `).join('');
  // Replace existing cards (keep first pred card)
  const existingCards = container.querySelectorAll('.mandi-card');
  if(existingCards.length && res.prices.length){
    // Rebuild inner but keep structure
    const mandiScreen = document.getElementById('screen-mandi');
    const oldCards = mandiScreen.querySelectorAll('.mandi-card');
    oldCards.forEach(c=>c.remove());
    const predCard = mandiScreen.querySelector('.pred-card');
    predCard.insertAdjacentHTML('afterend', cardsHTML);
    showToast('✅ Live Mandi prices updated from '+res.prices[0].source);
  }
}
async function loadLiveWeather(){
  const res = await apiCall('/api/weather?city=Mandya');
  if(!res || !res.weather) return;
  const w = res.weather;
  const title = document.getElementById('weatherTitle');
  const sub = document.getElementById('weatherSub');
  if(title) title.textContent = `${w.city} • ${w.temp}°C`;
  if(sub) sub.textContent = `${w.advice} (${w.source})`;
  const icon = document.querySelector('.weather-icon');
  if(icon) icon.textContent = w.temp > 30 ? '☀️' : w.humidity>80 ? '⛈️' : '⛅';
}
setTimeout(()=>{ loadLiveMandi(); loadLiveWeather(); }, 1200);

// Expose for debugging
window.AgriBackend = {API, apiCall, currentUser, saveScanToBackend, loadLiveMandi, loadLiveWeather, openLogin};
