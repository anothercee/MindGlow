/* app.js - EmoCare+ (All features pack)
   - localStorage for persistence
   - simple sentiment analyzer
   - breathing animation, music, games, quiz, chatbot
   - Chart.js for weekly mood graph
*/

// ---------- Helpers & selectors ----------
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

const tabs = qsa('.nav button');
const sections = qsa('.tabcontent');

function showTab(id){
  tabs.forEach(b => b.classList.toggle('active', b.dataset.tab===id));
  sections.forEach(s => s.id===id ? s.classList.remove('hidden') : s.classList.add('hidden'));
}
tabs.forEach(b => b.addEventListener('click', ()=> showTab(b.dataset.tab)));

// quick navigation
qs('#btnGoCheck')?.addEventListener('click', ()=> showTab('checkin'));
qs('#btnGoBreath')?.addEventListener('click', ()=> showTab('relax'));
qs('#btnGoGame')?.addEventListener('click', ()=> showTab('game'));
qs('#btnGoBreath')?.addEventListener('click', ()=> showTab('relax'));

// Storage helper
const storage = {
  get(k, fallback){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v): fallback }catch(e){return fallback}},
  set(k,v){ localStorage.setItem(k, JSON.stringify(v)) }
};

// ---------- DAILY TIPS & EDU ----------
const TIPS = [
  "Coba teknik 4-4-4 bernafas: tarik 4s, tahan 4s, buang 4s.",
  "Tuliskan 3 hal yang kamu syukuri hari ini.",
  "Jalan 10 menit di luar untuk menenangkan pikiran.",
  "Matikan gadget 30 menit sebelum tidur."
];
const EDU = [
  {t:"Apa itu stress?", d:"Stress adalah respons tubuh terhadap tuntutan. Teknik relaksasi dapat membantu menurunkannya."},
  {t:"Burnout", d:"Burnout adalah kelelahan emosional akibat tekanan berkepanjangan. Istirahat dan batas kerja penting."},
  {t:"Mindfulness", d:"Mindfulness membantu menjadikan setiap aktivitas lebih sadar dan menurunkan kecemasan."}
];
function renderEdu(){ const el = qs('#eduList'); el.innerHTML=''; EDU.forEach(item=>{ const div=document.createElement('div'); div.className='prompt'; div.innerHTML=`<h4>${item.t}</h4><p>${item.d}</p>`; el.appendChild(div) }) }
qs('#dailyTip').textContent = TIPS[Math.floor(Math.random()*TIPS.length)];
renderEdu();

// ---------- MOOD CHECK-IN & SENTIMENT ANALYSIS ----------
let moodLogs = storage.get('moodLogs', []); // {date, mood, note, sentimentScore}
const MOOD_VALUES = {happy:5, calm:4, sad:2, anxious:1, stressed:0};

qsa('.mood-btn').forEach(btn => {
  btn.addEventListener('click', ()=> {
    qsa('.mood-btn').forEach(b=>b.style.boxShadow='none');
    btn.style.boxShadow = '0 6px 18px rgba(46,125,50,0.2)';
    btn.dataset.selected = '1';
    qsa('.mood-btn').forEach(b=>{ if(b!==btn) delete b.dataset.selected });
  });
});

qs('#saveMoodBtn').addEventListener('click', ()=>{
  const sel = qsa('.mood-btn').find(b=>b.dataset.selected==='1');
  if(!sel){ alert('Pilih mood dulu'); return; }
  const mood = sel.dataset.mood;
  const note = qs('#moodNote').value.trim();
  const sentiment = analyzeSentiment(note);
  const entry = {date:new Date().toISOString(), mood, note, sentiment};
  moodLogs.push(entry);
  storage.set('moodLogs', moodLogs);
  qs('#moodNote').value='';
  alert('Check-in tersimpan ✅');
  updateChart();
  awardBadgeIfConsistent();
});

// simple sentiment: count positive/negative words
const POS = ['baik','senang','bahagia','tenang','terima kasih','legowo','puas','senyum','bergairah'];
const NEG = ['sedih','menangis','stress','stres','capek','lelah','kesal','marah','khawatir','cemas','bingung'];
function analyzeSentiment(text=''){
  if(!text) return 0;
  const t = text.toLowerCase();
  let score=0;
  POS.forEach(w=>{ if(t.includes(w)) score+=1 });
  NEG.forEach(w=>{ if(t.includes(w)) score-=1 });
  qs('#textAnalysis').textContent = `Analisis: score ${score} (${score>0?'positif':score<0?'negatif':'netral'})`;
  return score;
}
qs('#analyzeTextBtn').addEventListener('click', ()=> analyzeSentiment(qs('#moodNote').value));

// ---------- WEEKLY MOOD CHART (Chart.js) ----------
const ctx = qs('#moodChart').getContext('2d');
let moodChart = new Chart(ctx, {
  type:'line',
  data:{ labels:[], datasets:[{ label:'Mood value', data:[], fill:true, backgroundColor:'rgba(46,125,50,0.12)', borderColor:'#2E7D32', tension:0.4 }]},
  options:{ scales:{ y:{ min:0, max:5, ticks:{stepSize:1} } } }
});
function updateChart(){
  // last 7 days average mood
  const last7 = [];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const dayEntries = moodLogs.filter(m => m.date.slice(0,10)===key);
    const avg = dayEntries.length ? Math.round((dayEntries.reduce((s,e)=>s+MOOD_VALUES[e.mood],0)/dayEntries.length)*10)/10 : null;
    last7.push(avg);
  }
  moodChart.data.labels = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-6+i); return d.toLocaleDateString() });
  moodChart.data.datasets[0].data = last7.map(v=>v===null?0:v);
  moodChart.update();
}
updateChart();

// ---------- BREATHING EXERCISE ----------
let breathTimer = null;
let breathRunning = false;
const circle = qs('#breathCircle');
const breathLabel = qs('#breathLabel');

qs('#startBreath').addEventListener('click', ()=> startBreath());
qs('#stopBreath').addEventListener('click', ()=> stopBreath());

function startBreath(){
  if(breathRunning) return;
  breathRunning = true;
  const duration = Number(qs('#breathDuration').value) * 1000;
  const cycle = 4000; // 4s in, 4s hold, 4s out (simplify using in/out)
  const end = Date.now() + duration;
  breathLabel.textContent = 'Mulai...';
  function step(){
    const now = Date.now();
    if(now>=end){ stopBreath(); return; }
    // simple loop: expand (4s) -> contract (4s)
    const phase = Math.floor(((end-now)/1000)%8);
    // we'll use time-based animation rather than strict inhale/exhale labeling
    circle.style.transform = `scale(${1 + 0.25*Math.sin(now/600)})`;
    breathLabel.textContent = 'Ikuti napas...';
    breathTimer = requestAnimationFrame(step);
  }
  breathTimer = requestAnimationFrame(step);
}
function stopBreath(){
  breathRunning = false;
  cancelAnimationFrame(breathTimer);
  circle.style.transform = 'scale(1)';
  breathLabel.textContent = 'Selesai';
}

// ---------- MUSIC THERAPY ----------
const musicPlayer = qs('#musicPlayer');
qsa('.music-btn').forEach(btn => btn.addEventListener('click', ()=>{
  const src = btn.dataset.src;
  musicPlayer.src = src;
  musicPlayer.play();
}));

// ---------- GAMES (Bubble Pop + Memory) ----------
const gameArea = qs('#gameArea');
qs('#startBubble').addEventListener('click', startBubbleGame);
qs('#startMemory').addEventListener('click', startMemoryGame);

function startBubbleGame(){
  gameArea.innerHTML = '<p>Bubble Pop: klik gelembung untuk memecah. Selesai saat 10 pop.</p><div id="bubbles"></div>';
  const container = qs('#bubbles');
  let score=0;
  function spawn(){
    const b = document.createElement('div');
    b.className='bubble';
    const size = 30 + Math.random()*60;
    b.style.width = b.style.height = size+'px';
    b.style.left = (Math.random()*80)+'%';
    b.style.top = (Math.random()*60)+'%';
    b.style.position='relative';
    b.style.display='inline-block';
    b.style.margin='6px';
    b.style.borderRadius='50%';
    b.style.background='radial-gradient(circle at 30% 30%, #fff, #8bc34a)';
    b.style.cursor='pointer';
    b.onclick = ()=>{ b.remove(); score++; if(score>=10){ alert('Great! You popped 10 bubbles'); awardBadge('Bubble Popper') } };
    container.appendChild(b);
    if(container.childElementCount<12) setTimeout(spawn, 600);
  }
  spawn();
}

function startMemoryGame(){
  // simple matching with emojis
  const emojis = ['🌸','🌱','🌞','🌧️','🌿','🍃'];
  const deck = shuffle([...emojis,...emojis]);
  gameArea.innerHTML = '<div id="memGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"></div>';
  const grid = qs('#memGrid');
  let first=null, lock=false, matches=0;
  deck.forEach((e,i)=>{
    const card = document.createElement('button');
    card.className='memcard';
    card.style.padding='20px';
    card.style.fontSize='24px';
    card.textContent='❓';
    card.onclick = ()=> {
      if(lock || card.dataset.open==='1') return;
      card.textContent = e; card.dataset.open='1';
      if(!first){ first = {el:card, val:e}; return; }
      if(first.val===e){ matches++; first=null; if(matches===emojis.length){ alert('Memory win!'); awardBadge('Memory Master') } }
      else { lock=true; setTimeout(()=>{ card.textContent='❓'; first.el.textContent='❓'; card.dataset.open='0'; first.el.dataset.open='0'; first=null; lock=false }, 800) }
    };
    grid.appendChild(card);
  });
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a }

// ---------- JOURNAL & PROMPTS ----------
const PROMPTS = [
  "Tuliskan 3 hal yang kamu syukuri hari ini.",
  "Apa yang membuatmu lega minggu ini?",
  "Sebutkan satu hal kecil yang ingin kamu lakukan besok."
];
qs('#genPrompt').addEventListener('click', ()=> qs('#promptText').textContent = PROMPTS[Math.floor(Math.random()*PROMPTS.length)]);
qs('#saveJournal').addEventListener('click', ()=> {
  const t = qs('#journalText').value.trim();
  if(!t) return alert('Tulis jurnal dulu');
  const arr = storage.get('journals', []);
  arr.push({date:new Date().toISOString(), text:t});
  storage.set('journals', arr);
  qs('#journalText').value='';
  alert('Jurnal tersimpan');
});
qs('#viewJournals').addEventListener('click', ()=> {
  const arr = storage.get('journals', []);
  const out = arr.map(a=>`<div class="card"><small>${new Date(a.date).toLocaleString()}</small><p>${escapeHtml(a.text)}</p></div>`).join('');
  qs('#journalsList').innerHTML = out || '<p class="muted">Belum ada jurnal</p>';
});

// ---------- QUIZ (Personality) ----------
const QUIZ = [
  {q:"Saat mendapat masalah, kamu cenderung:", opts:["Cari teman bicara","Mencari solusi sendiri","Mengabaikan dulu"], a:0},
  {q:"Saat banyak tugas, kamu:", opts:["Buat jadwal","Tunda sampai akhir","Minta bantuan"], a:0},
  {q:"Cara terbaik meredakan stresmu adalah:", opts:["Olahraga","Meditasi","Makan"], a:1}
];
let qi=0, qscore=0;
qs('#startQuiz').addEventListener('click', ()=> {
  qi=0; qscore=0; qs('#quizResult').textContent=''; qs('#startQuiz').classList.add('hidden'); qs('#nextQuiz').classList.remove('hidden'); loadQ();
});
qs('#nextQuiz').addEventListener('click', ()=> {
  qi++; if(qi>=QUIZ.length){ endQ(); } else loadQ();
});
function loadQ(){
  const cur = QUIZ[qi];
  qs('#quizQuestion').textContent = cur.q;
  qs('#quizOptions').innerHTML = '';
  cur.opts.forEach((o,i)=> {
    const b = document.createElement('button'); b.textContent=o; b.onclick=()=> { if(i===cur.a){ qscore++; b.style.background='#c8e6c9' } else b.style.background='#ffdcd1'; Array.from(qs('#quizOptions').children).forEach(bb=>bb.disabled=true) }; qs('#quizOptions').appendChild(b);
  });
}
function endQ(){ qs('#quizResult').textContent = `Hasil: ${qscore} / ${QUIZ.length}`; qs('#startQuiz').classList.remove('hidden'); qs('#nextQuiz').classList.add('hidden'); if(qscore===QUIZ.length) awardBadge('Quiz Ace') }

// ---------- CHATBOT (rule-based) ----------
const chatWindow = qs('#chatWindow');
qs('#sendChat').addEventListener('click', ()=> {
  const text = qs('#chatInput').value.trim();
  if(!text) return;
  appendChat('me', text); qs('#chatInput').value='';
  setTimeout(()=> { const reply = botReply(text); appendChat('bot', reply) }, 600);
});
function appendChat(who, text){ const div=document.createElement('div'); div.className = who==='me' ? 'me' : 'bot'; div.innerHTML = `<p><small>${who==='me'?'You':'EmoCare'}</small><div>${escapeHtml(text)}</div></p>`; chatWindow.appendChild(div); chatWindow.scrollTop = chatWindow.scrollHeight; }
function botReply(text){
  const t=text.toLowerCase();
  if(t.includes('sedih')||t.includes('menangis')) return 'Aku turut prihatin. Mau coba latihan pernapasan singkat? Ketik: breath';
  if(t.includes('capek')||t.includes('lelah')) return 'Istirahat itu penting. Coba jalan 10 menit atau minum air.';
  if(t.includes('breath')||t.includes('napas')) { showTab('relax'); startBreath(); return 'Mulai latihan pernapasan di tab Relax ya.' }
  if(t.includes('saran')) return 'Coba tulis 3 hal yang membuatmu bersyukur hari ini.';
  return 'Aku di sini mendengar. Ceritakan lebih lanjut atau ketik "saran" untuk tips.';
}

// ---------- BADGES ----------
let badges = new Set(storage.get('badges', []));
function awardBadge(name){
  if(!badges.has(name)){ badges.add(name); storage.set('badges', Array.from(badges)); alert('Badge unlocked: '+name) }
}
function awardBadgeIfConsistent(){
  // if last 3 days have entries -> award consistent
  const now = new Date();
  let count=0;
  for(let i=0;i<3;i++){
    const d = new Date(); d.setDate(now.getDate()-i);
    const day = d.toISOString().slice(0,10);
    if(moodLogs.some(m=>m.date.slice(0,10)===day)) count++;
  }
  if(count===3) awardBadge('Consistent Care');
}

// ---------- UTIL ----------
function escapeHtml(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }
function init(){ showTab('home'); updateChart(); renderBadges(); }
function renderBadges(){ const b = Array.from(badges); const el = qs('#journalsList'); /* reuse area for demo badges */ const area = qs('#journalsList'); if(!area) return; area.innerHTML = '<h4>Badges</h4>' + (b.length? b.map(x=>`<span>🏅 ${x}</span>`).join(' '):'<p class="muted">No badges yet</p>') }

// Initialize
init();
