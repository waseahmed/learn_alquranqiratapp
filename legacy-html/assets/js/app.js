
const DATA=window.AQQA_DATA;
let state={surah:1,ayah:1,rangeStart:1,rangeEnd:5};
let selectedQaris=new Set(JSON.parse(localStorage.getItem("aqqaSelectedQaris")||'["husary","mishary","shuraim"]'));
let playSeqActive=false, stopSeq=false, currentAudioId=null, shadowActive=false;
let mediaRecorder=null, recordChunks=[];

const mistakes=[
["Copying the melody but losing Tajweed","The child becomes so focused on the tune that pronunciation or rules change.","Make the āyah correct first. Add the Qari's style only after the recitation is stable."],
["Starting too high","The child has nowhere to go when the Qari rises and begins to strain.","Start comfortably lower. Leave vocal space to rise later in the phrase."],
["Forcing the Qari's physical voice","The throat is squeezed to imitate a deep or powerful reciter.","Copy pitch, rhythm, pause and expression—not the physical timbre of another person's voice."],
["Flat pitch","The Qari rises and falls but the child recites on one level.","Replay a short phrase and trace only where the sound goes up, stays steady or comes down."],
["Running out of breath","The ending becomes rushed and loses control.","Copy the Qari's phrase boundaries and practise each breath unit separately."],
["Changing Madd for melody","A vowel is stretched too much or too little to fit the tune.","Tajweed controls the melody. Never let melody control the required Madd."],
["Too much vibration","The child adds a shaky vibrato everywhere.","Practise a clean steady tone first. Natural movement can come later."],
["Trying to copy the full āyah at once","The child remembers the beginning but loses the style later.","Work phrase-by-phrase, then join two phrases, then complete the āyah."],
["Weak endings","The beginning is expressive but the final words become flat or uncontrolled.","Practise the final 2–3 words separately and copy how the Qari resolves the ending."],
["Using volume instead of pitch","The child gets louder when trying to go higher.","Practise rising in pitch while keeping approximately the same comfortable volume."]
];

function surah(){return DATA.surahs[String(state.surah)]}
function audioPath(qkey){
 const s=String(state.surah).padStart(3,"0"), code=s+String(state.ayah).padStart(3,"0");
 return `audio/recitations/${qkey}/${s}/${code}.mp3`;
}
function toggleMenu(id,chev){
 const el=document.getElementById(id), c=document.getElementById(chev);
 el.classList.toggle("collapsed"); c.textContent=el.classList.contains("collapsed")?"›":"⌄";
}
function buildMenus(){
 const pop=document.getElementById("popularBody");
 DATA.popularSurahs.forEach(n=>{const b=document.createElement("button");b.className="item";b.textContent=`${n}. ${DATA.popularLabels[String(n)]}`;b.onclick=()=>selectSurah(n);pop.appendChild(b)});
 const jg=document.getElementById("juzGrid");
 DATA.juz.forEach(j=>{const b=document.createElement("button");b.className="item";b.textContent=j.juz;b.title=`Juz ${j.juz}`;b.onclick=()=>selectJuz(j.juz);jg.appendChild(b)});
 renderSurahList();
}
function renderSurahList(){
 const q=(document.getElementById("surahSearch")?.value||"").toLowerCase();
 const list=document.getElementById("surahList"); if(!list)return; list.innerHTML="";
 Object.values(DATA.surahs).forEach(s=>{
   if(q && !(s.name_en.toLowerCase().includes(q)||s.name_ar.includes(q)||String(s.number)===q))return;
   const b=document.createElement("button"); b.className="item"; b.textContent=`${s.number}. ${s.name_en}`; b.onclick=()=>selectSurah(s.number); list.appendChild(b);
 });
}
function selectSurah(n,ayah=1){stopEverything();state.surah=Number(n);state.ayah=Number(ayah);setRange();showPractice();render()}
function selectJuz(n){
 const j=DATA.juz.find(x=>x.juz===Number(n));if(!j)return;
 selectSurah(j.start_surah,j.start_ayah);document.getElementById("rangeLabel").textContent=`Juz ${n} starts here`;
}
function setRange(){state.rangeStart=Math.floor((state.ayah-1)/5)*5+1;state.rangeEnd=Math.min(state.rangeStart+4,surah().verses_count)}
function prevAyah(){if(state.ayah>1){state.ayah--;setRange();stopEverything();render()}else if(state.surah>1){state.surah--;state.ayah=DATA.surahs[String(state.surah)].verses_count;setRange();stopEverything();render()}}
function nextAyah(){if(state.ayah<surah().verses_count){state.ayah++;setRange();stopEverything();render()}else if(state.surah<114){state.surah++;state.ayah=1;setRange();stopEverything();render()}}
function prevRange(){state.rangeStart=Math.max(1,state.rangeStart-5);state.rangeEnd=Math.min(state.rangeStart+4,surah().verses_count);state.ayah=state.rangeStart;stopEverything();render()}
function nextRange(){if(state.rangeEnd>=surah().verses_count)return;state.rangeStart+=5;state.rangeEnd=Math.min(state.rangeStart+4,surah().verses_count);state.ayah=state.rangeStart;stopEverything();render()}
function saveSelected(){localStorage.setItem("aqqaSelectedQaris",JSON.stringify([...selectedQaris]))}
function toggleQari(key){selectedQaris.has(key)?selectedQaris.delete(key):selectedQaris.add(key);saveSelected();renderQaris()}
function selectAllQaris(){selectedQaris=new Set(DATA.qaris.map(q=>q.key));saveSelected();renderQaris()}
function selectPreset(p){
 if(p==="clear")selectedQaris=new Set(["husary","maher","ghamdi"]);
 if(p==="melodic")selectedQaris=new Set(["minshawi","mishary","abdulbasit"]);
 saveSelected();renderQaris()
}
function renderQaris(){
 const checks=document.getElementById("qariChecks"),cards=document.getElementById("qariCards");checks.innerHTML="";cards.innerHTML="";
 DATA.qaris.forEach(q=>{
   const ch=document.createElement("button");ch.className="check"+(selectedQaris.has(q.key)?" on":"");ch.textContent=q.name;ch.onclick=()=>toggleQari(q.key);checks.appendChild(ch);
   if(!selectedQaris.has(q.key))return;
   const card=document.createElement("article");card.className="card";card.id="card-"+q.key;
   const src=audioPath(q.key);
   card.innerHTML=`<div class="card-head"><div class="qname">${q.name}</div><div class="qstyle">${q.style}</div></div>
   <div class="card-body"><audio id="audio-${q.key}" controls preload="none"><source src="${src}" type="audio/mpeg"></audio>
   <div class="card-actions"><button class="btn" onclick="playQari('${q.key}',1)">↻ Replay</button><button class="btn" onclick="playQari('${q.key}',.8)">0.8× Slow</button><button class="btn" onclick="shadowQari('${q.key}')">🎯 Shadow</button></div></div>`;
   cards.appendChild(card);
   const a=card.querySelector("audio");
   a.addEventListener("play",()=>highlight(q.key));
   a.addEventListener("ended",()=>{if(!playSeqActive&&!shadowActive)clearHighlight()});
   a.addEventListener("error",()=>showAudioError(card,q.key));
 });
}
function showAudioError(card,key){if(card.querySelector(".audio-error"))return;const d=document.createElement("div");d.className="audio-error";d.style="padding:0 12px 12px;color:#9c4238;font-size:11px";d.textContent=`MP3 not found on your server: ${audioPath(key)}`;card.appendChild(d)}
function highlight(key){clearHighlight();document.getElementById("card-"+key)?.classList.add("playing");currentAudioId="audio-"+key}
function clearHighlight(){document.querySelectorAll(".card.playing").forEach(x=>x.classList.remove("playing"))}
function pauseAll(){document.querySelectorAll("audio[id^=audio-]").forEach(a=>a.pause())}
function playQari(key,rate=1){stopSequence();pauseAll();const a=document.getElementById("audio-"+key);if(!a)return;a.currentTime=0;a.playbackRate=rate;highlight(key);a.play()}
function currentQariKey(){return [...selectedQaris][0]||DATA.qaris[0].key}
function replayCurrent(){playQari(currentQariKey(),1)}
function slowCurrent(){playQari(currentQariKey(),.8)}
function stopSequence(){if(playSeqActive){stopSeq=true;playSeqActive=false;setPlayButton(false)}}
function setPlayButton(on){const b=document.getElementById("playAllBtn");if(!b)return;b.textContent=on?"■ Stop":"▶ Play Selected Qaris";b.classList.toggle("stop",on);b.classList.toggle("primary",!on)}
async function togglePlaySelected(){
 if(playSeqActive){stopEverything();return}
 playSeqActive=true;stopSeq=false;setPlayButton(true);
 for(const q of DATA.qaris.filter(x=>selectedQaris.has(x.key))){
   if(stopSeq)break;const a=document.getElementById("audio-"+q.key);if(!a)continue;pauseAll();highlight(q.key);
   try{a.currentTime=0;a.playbackRate=1;await a.play();await new Promise(resolve=>{let done=false;const f=()=>{if(!done){done=true;clearInterval(t);resolve()}};a.addEventListener("ended",f,{once:true});const t=setInterval(()=>{if(stopSeq){a.pause();f()}},120)})}catch(e){}
 }
 playSeqActive=false;stopSeq=false;setPlayButton(false);clearHighlight()
}
function startShadow(){shadowQari(currentQariKey())}
async function shadowQari(key){
 stopEverything();shadowActive=true;const box=document.getElementById("shadowBox");box.classList.add("show");
 const a=document.getElementById("audio-"+key);if(!a)return;
 while(shadowActive){
   highlight(key);a.currentTime=0;a.playbackRate=1;
   try{await a.play();await new Promise(r=>a.addEventListener("ended",r,{once:true}))}catch(e){break}
   clearHighlight();
   for(let i=3;i>=1&&shadowActive;i--){document.getElementById("shadowCount").textContent=`Your turn: ${i}`;await new Promise(r=>setTimeout(r,1000))}
   document.getElementById("shadowCount").textContent="Listen again";
 }
}
function stopShadow(){shadowActive=false;document.getElementById("shadowBox").classList.remove("show");pauseAll();clearHighlight()}
function stopEverything(){stopSeq=true;playSeqActive=false;shadowActive=false;pauseAll();clearHighlight();setPlayButton(false);document.getElementById("shadowBox")?.classList.remove("show")}
async function toggleRecording(){
 const btn=document.getElementById("recordBtn");
 if(mediaRecorder&&mediaRecorder.state==="recording"){mediaRecorder.stop();btn.textContent="🎙 Record Yourself";btn.classList.remove("stop");return}
 try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   recordChunks=[];mediaRecorder=new MediaRecorder(stream);
   mediaRecorder.ondataavailable=e=>recordChunks.push(e.data);
   mediaRecorder.onstop=()=>{const blob=new Blob(recordChunks,{type:"audio/webm"});document.getElementById("userRecording").src=URL.createObjectURL(blob);document.getElementById("recordBox").classList.add("show");stream.getTracks().forEach(t=>t.stop())};
   mediaRecorder.start();btn.textContent="■ Stop Recording";btn.classList.add("stop");
 }catch(e){alert("Microphone recording requires HTTPS (or localhost) and microphone permission.")}
}
function render(){
 const s=surah(),text=s.ayahs[String(state.ayah)];
 document.getElementById("surahTitle").textContent=`Surah ${s.name_en}`;
 document.getElementById("ayahTitle").textContent=`Ayah ${state.ayah}`;
 document.getElementById("readerLabel").textContent=`${s.name_en} · ${state.surah}:${state.ayah}`;
 document.getElementById("rangeLabel").textContent=`${s.name_ar} · ${s.verses_count} āyāt`;
 document.getElementById("ayahText").textContent=text;
 document.getElementById("rangeHeading").textContent=`Ayahs ${state.rangeStart}–${state.rangeEnd}`;
 const tabs=document.getElementById("ayahTabs");tabs.innerHTML="";
 for(let i=state.rangeStart;i<=state.rangeEnd;i++){const b=document.createElement("button");b.className="ayah-tab"+(i===state.ayah?" active":"");b.textContent=i;b.onclick=()=>{state.ayah=i;stopEverything();render()};tabs.appendChild(b)}
 renderQaris();
}
function showGuide(which){
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("show"));
 document.getElementById(which==="imitate"?"imitatePage":"mistakesPage").classList.add("show");stopEverything();
}
function showPractice(){document.querySelectorAll(".page").forEach(x=>x.classList.remove("show"));document.getElementById("practicePage").classList.add("show")}
function renderMistakes(){
 const c=document.getElementById("mistakeCards");c.innerHTML="";
 mistakes.forEach(([m,w,fix])=>{const d=document.createElement("div");d.className="guide-card";d.innerHTML=`<div class="rule">${m}</div><p class="wrong"><b>What happens:</b> ${w}</p><p class="correct"><b>Correction:</b> ${fix}</p>`;c.appendChild(d)})
}
buildMenus();renderMistakes();render();
