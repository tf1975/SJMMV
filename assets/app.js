const SUPABASE_URL='https://ikvwfkmyyynyicxqqqlf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_RnPfgxV1K7HBLaFLfzoSLg_K-fOMyGO';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let authUser=null,catalog,tog,lore,frontMatter,characters,places,characterIndex,connections,currentBook,currentChapter=1,pendingNewUser=false,wizardBooks=[],wizardIndex=-1;
const KEY='archive-2-alpha';
let cloudLoaded=false,cloudSaving=false;
let state=JSON.parse(localStorage.getItem(KEY)||'{"profile":{"name":"Reader","mode":"first","onboarded":false},"progress":{},"discussions":{},"mentions":[]}');
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const allBooks=()=>catalog.collections.flatMap(c=>c.books.map(b=>({id:b[0],title:b[1],chapters:b[2],upcoming:!!b[3],release:b[4],theme:c.theme,collection:c.title,collectionId:c.id})));
const byId=id=>allBooks().find(b=>b.id===id);
const progress=b=>Math.min(b.chapters,Number(state.progress[b.id]||0));
function view(id){$$('.view').forEach(v=>v.classList.remove('active'));$('#'+id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
async function boot(){
 [catalog,tog,lore,frontMatter,characters,places,characterIndex,connections]=await Promise.all([
  'data/catalog.json','content/tog.json','data/lore.json','data/front-matter.json','data/characters.json','data/places.json','data/character-index.json','data/connections.json'
 ].map(u=>fetch(u).then(r=>r.json())));
 bind();await initAuth();renderAll();
}
function bind(){
 $('#homeBtn').onclick=()=>view('home');$$('[data-home]').forEach(b=>b.onclick=()=>view('home'));$('#readerBtn').onclick=()=>view('reader');
 $('#atlasCard').onclick=()=>view('atlas');$('#archiveCard').onclick=()=>view('archive');$('#frontBack').onclick=()=>view('home');$('#backToFront').onclick=()=>renderBookFront();
 $('#returningReader').onclick=()=>showGoogle(false);$('#newReaderStart').onclick=()=>showGoogle(true);$('#backToEntry').onclick=()=>{$('#googleStep').hidden=true;$('#entryChoices').hidden=false};
 $('#modeBtn').onclick=toggleMode;$('#visibleModeToggle').onclick=toggleMode;$('#editProgress').onclick=startWizard;
 $('#saveMode').onclick=async()=>{state.profile.mode=$('#settingsMode').value;save();await saveProfileToCloud();renderAll();view('home')};
 $('#wizardBeginBooks').onclick=beginBookWizard;$('#wizardNext').onclick=advanceWizard;$('#wizardBack').onclick=retreatWizard;
 $$('input[name="wizardStatus"]').forEach(r=>r.onchange=()=>$('#wizardChapterWrap').classList.toggle('hidden',r.value!=='reading'||!r.checked));
 $('#continueIntoBook').onclick=()=>{view('book');renderBook()};$('#saveFrontStatus').onclick=saveFrontStatus;
 $$('.front-panel-button').forEach(b=>b.onclick=()=>toggleFrontPanel(b.dataset.frontPanel));
 $$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button,.tabpane').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
 $$('.archive-tabs button').forEach(b=>b.onclick=()=>openArchivePane(b.dataset.archive));
 $$('.map-open').forEach(b=>b.onclick=()=>openMap(b.dataset.src,b.dataset.title));$('#closeMap').onclick=()=>$('#mapModal').classList.add('hidden');$('#mapModal').onclick=e=>{if(e.target.id==='mapModal')$('#mapModal').classList.add('hidden')};
}
function openArchivePane(id){$$('.archive-tabs button,.archive-pane').forEach(x=>x.classList.remove('active'));document.querySelector(`[data-archive="${id}"]`)?.classList.add('active');$('#'+id).classList.add('active')}
function openMap(src,title){$('#mapModalImage').src=src;$('#mapModalTitle').textContent=title;$('#mapModal').classList.remove('hidden')}
async function toggleMode(){state.profile.mode=state.profile.mode==='reread'?'first':'reread';save();await saveProfileToCloud();renderAll()}
function showGoogle(isNew){pendingNewUser=isNew;sessionStorage.setItem('archive_pending_new',isNew?'1':'0');$('#entryChoices').hidden=true;$('#googleStep').hidden=false;$('#googleStepText').textContent=isNew?'Create your secure account, then tell us where you are in every book.':'Sign in with the Google account you used before.'}
async function initAuth(){
 $('#googleSignIn').onclick=async()=>{const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/'}});if(error)$('#authMessage').textContent=error.message};
 $('#signOutBtn').onclick=async()=>{await supabaseClient.auth.signOut();authUser=null;$('#entryGate').classList.remove('hidden');$('#signOutBtn').hidden=true};
 const {data:{session}}=await supabaseClient.auth.getSession();applySession(session);supabaseClient.auth.onAuthStateChange((_e,s)=>applySession(s));
}
async function applySession(session){
 authUser=session?.user||null;
 if(!authUser){
  cloudLoaded=false;
  $('#entryGate').classList.remove('hidden');
  $('#signOutBtn').hidden=true;
  return;
 }
 $('#entryGate').classList.add('hidden');
 $('#signOutBtn').hidden=false;

 const googleName=authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email||'Reader';
 const defaultName=String(googleName).trim().split(/\s+/)[0]||'Reader';

 await loadCloudState(defaultName);

 const isNew=sessionStorage.getItem('archive_pending_new')==='1'||!state.profile.onboarded;
 sessionStorage.removeItem('archive_pending_new');

 if(isNew) startWizard();
 else $('#onboardingGate').classList.add('hidden');

 renderAll();
}

async function loadCloudState(defaultName){
 if(!authUser) return;

 const [{data:profile,error:profileError},{data:progressRows,error:progressError}] = await Promise.all([
  supabaseClient.from('profiles').select('nickname,reading_mode,onboarding_complete').eq('id',authUser.id).maybeSingle(),
  supabaseClient.from('reading_progress').select('book_id,current_chapter,reading_status').eq('user_id',authUser.id)
 ]);

 if(profileError) console.error('Profile load failed:',profileError);
 if(progressError) console.error('Progress load failed:',progressError);

 if(profile){
  state.profile.name=profile.nickname||defaultName;
  state.profile.mode=profile.reading_mode||'first';
  state.profile.onboarded=!!profile.onboarding_complete;
 }else{
  state.profile.name=state.profile.name&&state.profile.name!=='Reader'?state.profile.name:defaultName;
  await saveProfileToCloud();
 }

 if(Array.isArray(progressRows) && progressRows.length){
  state.progress={};
  for(const row of progressRows){
   state.progress[row.book_id]=Number(row.current_chapter||0);
  }
 }else{
  const hasLocalProgress=Object.values(state.progress||{}).some(v=>Number(v)>0);
  if(hasLocalProgress){
   const shouldImport=window.confirm('Import the reading progress already saved in this browser into your Archive account?');
   if(shouldImport) await saveAllProgressToCloud();
  }
 }

 cloudLoaded=true;
 save();
}

async function saveProfileToCloud(){
 if(!authUser||cloudSaving) return;
 const payload={
  id:authUser.id,
  nickname:state.profile.name||'Reader',
  reading_mode:state.profile.mode||'first',
  onboarding_complete:!!state.profile.onboarded,
  updated_at:new Date().toISOString()
 };
 const {error}=await supabaseClient.from('profiles').upsert(payload,{onConflict:'id'});
 if(error) console.error('Profile save failed:',error);
}

async function saveProgressToCloud(bookId){
 if(!authUser||cloudSaving) return;
 const book=byId(bookId);
 if(!book) return;
 const chapter=Math.max(0,Math.min(book.chapters,Number(state.progress[bookId]||0)));
 const status=chapter===0?'not-started':chapter>=book.chapters?'finished':'reading';
 const payload={
  user_id:authUser.id,
  book_id:bookId,
  current_chapter:chapter,
  reading_status:status,
  updated_at:new Date().toISOString()
 };
 const {error}=await supabaseClient.from('reading_progress').upsert(payload,{onConflict:'user_id,book_id'});
 if(error) console.error('Progress save failed:',error);
}

async function saveAllProgressToCloud(){
 if(!authUser) return;
 const rows=allBooks().filter(b=>!b.upcoming).map(book=>{
  const chapter=Math.max(0,Math.min(book.chapters,Number(state.progress[book.id]||0)));
  return {
   user_id:authUser.id,
   book_id:book.id,
   current_chapter:chapter,
   reading_status:chapter===0?'not-started':chapter>=book.chapters?'finished':'reading',
   updated_at:new Date().toISOString()
  };
 });
 const {error}=await supabaseClient.from('reading_progress').upsert(rows,{onConflict:'user_id,book_id'});
 if(error) console.error('Bulk progress save failed:',error);
}

async function saveCloudState(){
 save();
 if(!authUser) return;
 await Promise.all([saveProfileToCloud(),saveAllProgressToCloud()]);
}

function startWizard(){
 wizardBooks=allBooks().filter(b=>!b.upcoming);wizardIndex=-1;$('#onboardName').value=state.profile.name||'';$('#onboardMode').value=state.profile.mode||'first';
 $('#wizardIntro').classList.remove('hidden');$('#wizardBook').classList.add('hidden');$('#onboardingGate').classList.remove('hidden');updateWizardProgress();
}
async function beginBookWizard(){
 state.profile.name=$('#onboardName').value.trim().split(/\s+/)[0]||'Reader';state.profile.mode=$('#onboardMode').value;save();await saveProfileToCloud();wizardIndex=0;$('#wizardIntro').classList.add('hidden');$('#wizardBook').classList.remove('hidden');renderWizardBook();
}
function renderWizardBook(){
 const b=wizardBooks[wizardIndex], fm=frontMatter[b.id]||{};
 $('#wizardSeries').textContent=b.collection;$('#wizardBookTitle').textContent=b.title;$('#wizardBookSummary').textContent=fm.summary||'Spoiler-free summary in editorial production.';$('#wizardChapter').max=b.chapters;
 const p=progress(b),status=p===0?'not-started':p>=b.chapters?'finished':'reading';
 $$('input[name="wizardStatus"]').forEach(r=>r.checked=r.value===status);$('#wizardChapterWrap').classList.toggle('hidden',status!=='reading');$('#wizardChapter').value=Math.max(1,p||1);
 $('#wizardBack').disabled=wizardIndex===0;$('#wizardNext').textContent=wizardIndex===wizardBooks.length-1?'Open my bookshelves':'Next book →';updateWizardProgress();
}
function storeWizardBook(){
 const b=wizardBooks[wizardIndex],status=$('input[name="wizardStatus"]:checked').value;
 state.progress[b.id]=status==='not-started'?0:status==='finished'?b.chapters:Math.max(1,Math.min(b.chapters,Number($('#wizardChapter').value||1)));
}
async function advanceWizard(){storeWizardBook();if(wizardIndex===wizardBooks.length-1){state.profile.onboarded=true;await saveCloudState();$('#onboardingGate').classList.add('hidden');renderAll();view('home');return}wizardIndex++;renderWizardBook()}
function retreatWizard(){if(wizardIndex<=0)return;storeWizardBook();wizardIndex--;renderWizardBook()}
function updateWizardProgress(){const total=wizardBooks.length+1,current=wizardIndex<0?1:wizardIndex+2;$('#wizardStepLabel').textContent=`Step ${current} of ${total}`;$('#wizardBar').style.width=`${Math.round(current/total*100)}%`}
function renderAll(){
 $('#readerBtn').textContent=state.profile.name;$('#settingsMode').value=state.profile.mode;const reread=state.profile.mode==='reread';
 $('#modeBtn').textContent=reread?'Reread':'First Read';$('#visibleModeToggle').textContent=reread?'Switch to First Read':'Switch to Reread Mode';
 $('#modeStatus').textContent=reread?'Reread Mode is ON — later significance appears only when safe.':'First Read is ON — future context remains hidden.';
 $('#setupHeadline').textContent=`${state.profile.name}’s books and chapters`;$('#setupSummary').textContent=currentProgressText()+(authUser?' · Synced to your Google account':' · Saved only in this browser');
 document.body.classList.toggle('reread',reread);$('#notice').textContent=catalog.platform.notice;renderReleases();renderLibrary();renderReaders();renderMentions();renderLore();renderDirectories();
}
function currentProgressText(){const active=allBooks().filter(b=>progress(b)>0&&progress(b)<b.chapters);if(!active.length)return'No current book selected. Use Update books & chapters to set your place.';return active.map(b=>`${b.title}: Chapter ${progress(b)}`).join(' · ')}
function renderReleases(){const el=$('#releases');el.innerHTML=allBooks().filter(b=>b.upcoming).map(b=>`<div class="release"><span><strong>${esc(b.title)}</strong><br>${new Date(b.release).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</span><b id="c-${b.id}"></b></div>`).join('');tick()}
function tick(){allBooks().filter(b=>b.upcoming).forEach(b=>{let ms=Math.max(0,new Date(b.release)-new Date()),d=Math.floor(ms/86400000);ms%=86400000;let h=Math.floor(ms/3600000);ms%=3600000;let m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);const el=$('#c-'+b.id);if(el)el.textContent=`${d}d ${h}h ${m}m ${s}s`})}setInterval(tick,1000);
function renderLibrary(){
 const el=$('#library');el.innerHTML='';
 catalog.collections.forEach(c=>{const w=document.createElement('section');w.className='shelfwrap';w.innerHTML=`<div class="shelfhead"><div><small>${esc(c.short)}</small><h2>${esc(c.title)}</h2></div></div><div class="shelf"></div>`;const sh=w.querySelector('.shelf');
 c.books.forEach(raw=>{const b=byId(raw[0]),bt=document.createElement('button');bt.className=`spine ${c.theme}${b.upcoming?' upcoming':''}${progress(b)>0&&progress(b)<b.chapters?' current':''}`;bt.innerHTML=`<span>${esc(b.title)}</span>`;if(!b.upcoming)bt.onclick=()=>animateBookOpen(bt,b);sh.append(bt)});el.append(w)});
}
function animateBookOpen(spine,b){
 const overlay=$('#bookTransition'),rect=spine.getBoundingClientRect(),clone=overlay.querySelector('.transition-spine'),cover=overlay.querySelector('.transition-cover');
 clone.style.left=rect.left+'px';clone.style.top=rect.top+'px';clone.style.width=rect.width+'px';clone.style.height=rect.height+'px';clone.className='transition-spine '+b.theme;cover.className='transition-cover '+b.theme;cover.querySelector('b').textContent=b.title;
 overlay.classList.remove('hidden');requestAnimationFrame(()=>overlay.classList.add('playing'));
 setTimeout(()=>{currentBook=b;currentChapter=Math.max(1,progress(b)||1);renderBookFront();overlay.classList.remove('playing');overlay.classList.add('hidden')},820);
}
function toggleFrontPanel(id){
 $$('.front-inline-panel').forEach(p=>p.classList.toggle('active',p.id===id&&!p.classList.contains('active')));
 $$('.front-panel-button').forEach(b=>b.classList.toggle('active',b.dataset.frontPanel===id&&$('#'+id).classList.contains('active')));
}
function renderBookFront(){
 view('bookFront');const fm=frontMatter[currentBook.id]||{};
 $('#frontCoverSeries').textContent=currentBook.collection;$('#frontCoverTitle').textContent=currentBook.title;$('#frontSeries').textContent=currentBook.collection;$('#frontTitle').textContent=currentBook.title;$('#frontTagline').textContent=fm.tagline||'';$('#frontSummary').textContent=fm.summary||'Spoiler-free summary in editorial production.';$('#frontContentStatus').textContent=fm.contentStatus||'Content in editorial production.';
 const p=progress(currentBook),status=p===0?'not-started':p>=currentBook.chapters?'finished':'reading';$$('input[name="frontStatus"]').forEach(r=>r.checked=r.value===status);$('#frontChapter').max=currentBook.chapters;$('#frontChapter').value=Math.max(1,p||1);$('#frontChapterWrap').classList.toggle('hidden',status!=='reading');
 $$('input[name="frontStatus"]').forEach(r=>r.onchange=()=>$('#frontChapterWrap').classList.toggle('hidden',r.value!=='reading'||!r.checked));
 renderFrontPanels();
}
function renderFrontPanels(){
 const p=Math.max(1,progress(currentBook)||1);
 $('#frontCharactersPanel').innerHTML='<h3>Characters in this book</h3>'+groupEntries(safeEntries(characters,currentBook.id,p));
 $('#frontPlacesPanel').innerHTML='<h3>Places in this book</h3>'+groupEntries(safeEntries(places,currentBook.id,p));
 const fm=frontMatter[currentBook.id]||{};
 const full=currentBook.id==='tog'&&tog.summary?tog.summary.map(x=>`<p>${esc(x)}</p>`).join(''):`<p>${esc(fm.summary||'Full summary in editorial production.')}</p><p class="fine-print">A spoiler-filled complete recap is still being reviewed.</p>`;
 $('#frontWholeBookPanel').innerHTML='<h3>Whole-book summary</h3>'+full;
 $$('.front-inline-panel,.front-panel-button').forEach(x=>x.classList.remove('active'));
}
async function saveFrontStatus(){const status=$('input[name="frontStatus"]:checked').value;state.progress[currentBook.id]=status==='not-started'?0:status==='finished'?currentBook.chapters:Math.max(1,Math.min(currentBook.chapters,Number($('#frontChapter').value||1)));currentChapter=Math.max(1,progress(currentBook)||1);save();await saveProgressToCloud(currentBook.id);renderAll();renderBookFront()}
function renderBook(){
 $('#seriesLabel').textContent=currentBook.collection;$('#bookTitle').textContent=currentBook.title;$('#bookmark').innerHTML=`${esc(state.profile.name)}<br><b>Ch. ${progress(currentBook)||1}</b>`;$('#chapterNumber').max=currentBook.chapters;$('#chapterNumber').value=progress(currentBook);
 $('#saveChapterNumber').onclick=async()=>{state.progress[currentBook.id]=Math.max(0,Math.min(currentBook.chapters,Number($('#chapterNumber').value||0)));currentChapter=Math.max(1,progress(currentBook)||1);save();await saveProgressToCloud(currentBook.id);renderAll();renderBook()};
 $('#markFinished').onclick=async()=>{state.progress[currentBook.id]=currentBook.chapters;currentChapter=currentBook.chapters;save();await saveProgressToCloud(currentBook.id);renderAll();renderBook()};
 const nav=$('#chapterNav');nav.innerHTML='';
 for(let i=1;i<=currentBook.chapters;i++){const b=document.createElement('button');b.className='chapterbtn'+(i===currentChapter?' current':'')+(i>progress(currentBook)+1?' locked':'');b.innerHTML=`<span class="chapter-number">${i}</span><b class="chapter-state">${i<=progress(currentBook)?'Completed':i===progress(currentBook)+1?'Next chapter':'Locked'}</b>`;b.onclick=()=>{if(i>progress(currentBook)+1)return alert('This chapter is spoiler-locked.');currentChapter=i;renderBook()};nav.append(b)}
 renderChapter();
}
function renderChapter(){
 $('#chapterLabel').textContent=`Chapter ${currentChapter}`;const seed=currentBook.id==='tog'?tog.chapters[String(currentChapter)]:null;
 $('#summary').innerHTML=seed?`<ul>${seed.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>This chapter summary is in editorial production.</p>';
 $('#sumTab').innerHTML=seed?'<div class="evidence"><b>Chapter summary</b><p>Short, original recap based on cross-checked public sources.</p></div>':'<p>Content in production.</p>';
 const fm=frontMatter[currentBook.id]||{};$('#bookSummaryTab').innerHTML=currentBook.id==='tog'&&tog.summary?`<h3>The book in brief</h3>${tog.summary.map(p=>`<p>${esc(p)}</p>`).join('')}<h3>What changed</h3><ul>${tog.whatChanged.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:`<h3>Spoiler-free overview</h3><p>${esc(fm.summary||'In production.')}</p><p class="fine-print">The full spoiler-filled book recap is in editorial production.</p>`;
 renderBookDirectoryTabs();renderChapterLore();renderDiscussion();
 $('#complete').onclick=async()=>{state.progress[currentBook.id]=Math.max(progress(currentBook),currentChapter);save();await saveProgressToCloud(currentBook.id);renderAll();renderBook()};
 $('#next').onclick=()=>{if(currentChapter<currentBook.chapters&&currentChapter<=progress(currentBook)){currentChapter++;renderBook()}};
}
function safeEntries(source,bookId,chapter){return(source[bookId]||[]).filter(x=>x.safeAt<=chapter)}
function groupEntries(entries){const groups={};entries.forEach(x=>(groups[x.group]??=[]).push(x));return Object.entries(groups).map(([g,items])=>`<section class="directory-group"><h3>${esc(g)}</h3>${items.map(x=>`<article><b>${esc(x.name)}</b><p>${esc(x.bio)}</p></article>`).join('')}</section>`).join('')||'<p>No entries are safe yet.</p>'}
function renderBookDirectoryTabs(){$('#charactersTab').innerHTML=groupEntries(safeEntries(characters,currentBook.id,currentChapter));$('#placesTab').innerHTML=groupEntries(safeEntries(places,currentBook.id,currentChapter))}
function renderChapterLore(){const available=lore.filter(l=>l.requires.every(req=>progress(byId(req.bookId))>=req.chapter)&&l.requires.some(req=>req.bookId===currentBook.id&&req.chapter<=currentChapter));$('#loreTab').innerHTML=available.length?available.map(l=>`<div class="evidence"><span>${esc(l.type)}</span><h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p></div>`).join(''):'<p>No new lore is safe at this point.</p>';const unlockedConnections=connections.filter(c=>c.requires.every(req=>progress(byId(req.bookId))>=req.chapter));
 $('#connTab').innerHTML=unlockedConnections.length?unlockedConnections.map(c=>`<div class="evidence"><span>${esc(c.status)}</span><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><small>${c.evidence.map(esc).join(' · ')}</small></div>`).join(''):'<p>No verified Connections are unlocked at your current reading progress.</p>'}
function renderDiscussion(){const key=`${currentBook.id}-${currentChapter}`,posts=state.discussions[key]||[];$('#discussionFeed').innerHTML=posts.map(p=>`<article class="discussion-post"><b>${esc(p.author)}</b><p>${esc(p.text)}</p></article>`).join('')||'<p>No posts yet.</p>';$('#postDiscussion').onclick=()=>{const text=$('#discussionText').value.trim();if(!text)return;state.discussions[key]=state.discussions[key]||[];state.discussions[key].push({author:state.profile.name,text});save();$('#discussionText').value='';renderDiscussion()}}
function renderReaders(){$('#readers').innerHTML=`<div class="reader-row"><b class="reader-name">${esc(state.profile.name)}</b><span class="reader-progress">${esc(currentProgressText())}</span></div>`}
function renderMentions(){$('#mentions').innerHTML=state.mentions.length?state.mentions.map(m=>`<div>${esc(m.from)} mentioned you</div>`).join(''):'<p>No mentions yet.</p>'}
function renderLore(){$('#loreGrid').innerHTML=lore.map(l=>{const ok=l.requires.every(req=>progress(byId(req.bookId))>=req.chapter);return`<article class="lorecard ${ok?'':'locked'}"><small>${ok?esc(l.type):'LOCKED'}</small><h3>${esc(ok?l.title:'Undiscovered entry')}</h3><p>${ok?esc(l.summary):'Continue reading to unlock this entry safely.'}</p></article>`}).join('')}
function renderFullCharacterIndex(){
 return Object.entries(characterIndex).map(([series,items])=>`<section class="series-directory"><h2>${esc(series)}</h2><p class="fine-print">${items.length} catalogued characters. Full spoiler-safe biographies are being reviewed.</p><div class="name-grid">${items.map(x=>`<span>${esc(x.name)}</span>`).join('')}</div></section>`).join('');
}
function renderDirectories(){const allChar=Object.entries(characters).flatMap(([id,arr])=>arr.filter(x=>progress(byId(id))>=x.safeAt).map(x=>({...x,bookId:id})));const allPlace=Object.entries(places).flatMap(([id,arr])=>arr.filter(x=>progress(byId(id))>=x.safeAt).map(x=>({...x,bookId:id})));$('#archiveCharacters').innerHTML=groupEntries(allChar)+renderFullCharacterIndex();$('#archivePlaces').innerHTML=groupEntries(allPlace);$('#readerList').innerHTML=`<div class="panel"><b>${esc(state.profile.name)}</b><p>${esc(currentProgressText())}</p></div>`}
boot();