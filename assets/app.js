const SUPABASE_URL='https://ikvwfkmyyynyicxqqqlf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_RnPfgxV1K7HBLaFLfzoSLg_K-fOMyGO';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let authUser=null,catalog,tog,lore,frontMatter,characters,places,characterIndex,connections,tandem,currentBook,currentChapter=1,pendingNewUser=false,wizardBooks=[],wizardIndex=-1,activeCharacterSeries='throne-of-glass';
const KEY='archive-2-alpha';
const DEFAULT_STATE=()=>({profile:{name:'Reader',mode:'first',onboarded:false},progress:{},bookSettings:{},discussions:{},mentions:[]});
const parseState=value=>{try{const raw=JSON.parse(value||'{}'),base=DEFAULT_STATE();return {...base,...raw,profile:{...base.profile,...(raw.profile||{})},progress:raw.progress&&typeof raw.progress==='object'?raw.progress:{},bookSettings:raw.bookSettings&&typeof raw.bookSettings==='object'?raw.bookSettings:{},discussions:raw.discussions&&typeof raw.discussions==='object'?raw.discussions:{},mentions:Array.isArray(raw.mentions)?raw.mentions:[]}}catch{return DEFAULT_STATE()}};
const legacyState=parseState(localStorage.getItem(KEY));
let state=DEFAULT_STATE(),cloudLoaded=false,activeCacheKey=null,sessionLoadId=0;
const userCacheKey=id=>`${KEY}:user:${id}`;
const save=()=>{if(activeCacheKey)localStorage.setItem(activeCacheKey,JSON.stringify(state))};
const setSyncStatus=(label,status='idle')=>{const el=$('#syncStatus');if(!el)return;el.textContent=label;el.dataset.state=status};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const allBooks=()=>catalog.collections.flatMap(c=>c.books.map(b=>({id:b[0],title:b[1],chapters:b[2],upcoming:!!b[3],release:b[4],theme:c.theme,collection:c.title,collectionId:c.id})));
const byId=id=>allBooks().find(b=>b.id===id);
const isTandem=b=>b?.id==='tandem';
const tandemBook=()=>({id:'tandem',title:'Tandem Read',chapters:tandem?.steps?.length||50,upcoming:false,theme:'tog',collection:'Throne of Glass',collectionId:'throne-of-glass'});
const progressEntry=b=>isTandem(b)?{status:tandemStep()>=b.chapters?'finished':'reading',currentChapter:Math.min(b.chapters,tandemStep()+1)}:ArchiveProgress.normalize(state.progress[b.id],b.chapters);
const progress=b=>progressEntry(b).currentChapter;
const completedThrough=b=>isTandem(b)?tandemStep():ArchiveProgress.lastCompleted(state.progress[b.id],b.chapters);
const readingStatus=b=>progressEntry(b).status;
const setBookProgress=(b,status,current=0)=>{state.progress[b.id]=ArchiveProgress.normalize({status,currentChapter:current},b.chapters)};
const readingPlan=()=>state.bookSettings['tog-plan']?.uiPreferences||{};
const tandemPreference=()=>readingPlan().tandemPreference||'unsure';
const assassinsBladeOrder=()=>readingPlan().assassinsBladeOrder||'archivist';
const orderedTogIds=()=>assassinsBladeOrder()==='purist'?['tab','tog','com','hof','qos','eos','tod','koa']:assassinsBladeOrder()==='romantic'?['tog','com','hof','tab','qos','eos','tod','koa']:['tog','com','tab','hof','qos','eos','tod','koa'];
const orderedBooksForCollection=c=>c.id!=='throne-of-glass'?c.books:[...c.books].sort((a,b)=>orderedTogIds().indexOf(a[0])-orderedTogIds().indexOf(b[0]));
function view(id){$$('.view').forEach(v=>v.classList.remove('active'));$('#'+id).classList.add('active');window.scrollTo({top:0,behavior:'smooth'})}
async function boot(){
 [catalog,tog,lore,frontMatter,characters,places,characterIndex,connections,tandem]=await Promise.all([
  'data/catalog.json','content/tog.json','data/lore.json','data/front-matter.json','data/characters.json','data/places.json','data/character-index.json','data/connections.json','data/tandem.json'
 ].map(u=>fetch(u).then(r=>r.json())));
 bind();await initAuth();renderAll();
}
function bind(){
 $('#homeBtn').onclick=()=>view('home');$$('[data-home]').forEach(b=>b.onclick=()=>view('home'));$('#readerBtn').onclick=()=>view('reader');
 $('#atlasCard').onclick=()=>view('atlas');$('#archiveCard').onclick=()=>view('archive');$('#frontBack').onclick=()=>view('home');$('#backToFront').onclick=()=>renderBookFront();
 $('#returningReader').onclick=()=>showGoogle(false);$('#newReaderStart').onclick=()=>showGoogle(true);$('#backToEntry').onclick=()=>{$('#googleStep').hidden=true;$('#entryChoices').hidden=false};
 $('#modeBtn').onclick=toggleMode;$('#visibleModeToggle').onclick=toggleMode;$('#editProgress').onclick=startWizard;
 $('#saveMode').onclick=async()=>{state.profile.mode=$('#settingsMode').value;state.bookSettings['tog-plan']={...(state.bookSettings['tog-plan']||{}),uiPreferences:{...readingPlan(),tandemPreference:$('#settingsTandem').value,assassinsBladeOrder:$('#settingsAssassinsBlade').value}};save();await Promise.all([saveProfileToCloud(),saveBookSettingsToCloud('tog-plan')]);renderAll();view('home')};
 $('#wizardBeginBooks').onclick=beginBookWizard;$('#wizardNext').onclick=advanceWizard;$('#wizardBack').onclick=retreatWizard;
 $$('input[name="wizardStatus"]').forEach(r=>r.onchange=()=>$('#wizardChapterWrap').classList.toggle('hidden',r.value!=='reading'||!r.checked));
 $('#continueIntoBook').onclick=()=>{currentChapter=1;view('book');renderBook()};$('#saveFrontStatus').onclick=saveFrontStatus;
 $$('.front-panel-button').forEach(b=>b.onclick=()=>toggleFrontPanel(b.dataset.frontPanel));
 $$('.tabs button').forEach(b=>b.onclick=async()=>{$$('.tabs button,.tabpane').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active');if(currentBook){state.bookSettings[currentBook.id]={...(state.bookSettings[currentBook.id]||{}),uiPreferences:{...(state.bookSettings[currentBook.id]?.uiPreferences||{}),lastTab:b.dataset.tab}};save();await saveBookSettingsToCloud(currentBook.id)}});
 $$('.archive-tabs button').forEach(b=>b.onclick=()=>openArchivePane(b.dataset.archive));
 $$('.map-open').forEach(b=>b.onclick=()=>openMap(b.dataset.src,b.dataset.title));$('#closeMap').onclick=()=>$('#mapModal').classList.add('hidden');$('#mapModal').onclick=e=>{if(e.target.id==='mapModal')$('#mapModal').classList.add('hidden')};
 $('#saveTandemFront').onclick=saveTandemFront;$('#toggleTandemFront').onclick=toggleTandemEnabled;
}
function openArchivePane(id){$$('.archive-tabs button,.archive-pane').forEach(x=>x.classList.remove('active'));document.querySelector(`[data-archive="${id}"]`)?.classList.add('active');$('#'+id).classList.add('active')}
function openMap(src,title){$('#mapModalImage').src=src;$('#mapModalTitle').textContent=title;$('#mapModal').classList.remove('hidden')}
async function toggleMode(){state.profile.mode=state.profile.mode==='reread'?'first':'reread';if(currentBook){state.bookSettings[currentBook.id]={...(state.bookSettings[currentBook.id]||{}),rereading:state.profile.mode==='reread'};await saveBookSettingsToCloud(currentBook.id)}save();await saveProfileToCloud();renderAll()}
function showGoogle(isNew){pendingNewUser=isNew;sessionStorage.setItem('archive_pending_new',isNew?'1':'0');$('#entryChoices').hidden=true;$('#googleStep').hidden=false;$('#googleStepText').textContent=isNew?'Create your secure account, then tell us where you are in every book.':'Sign in with the Google account you used before.'}
async function initAuth(){
 $('#googleSignIn').onclick=async()=>{const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/'}});if(error)$('#authMessage').textContent=error.message};
 $('#signOutBtn').onclick=async()=>{await supabaseClient.auth.signOut();authUser=null;activeCacheKey=null;state=DEFAULT_STATE();cloudLoaded=false;setSyncStatus('Not signed in');$('#entryGate').classList.remove('hidden');$('#signOutBtn').hidden=true;renderAll()};
 window.addEventListener('offline',()=>setSyncStatus('Offline — changes cached','offline'));
 window.addEventListener('online',()=>{setSyncStatus('Back online','saving');if(authUser)saveCloudState()});
 const {data:{session}}=await supabaseClient.auth.getSession();await applySession(session);supabaseClient.auth.onAuthStateChange((_e,s)=>{void applySession(s)});
}
async function applySession(session){
 const loadId=++sessionLoadId;
 authUser=session?.user||null;
 if(!authUser){
  cloudLoaded=false;
  activeCacheKey=null;
  state=DEFAULT_STATE();
  setSyncStatus('Not signed in');
  $('#entryGate').classList.remove('hidden');
  $('#signOutBtn').hidden=true;
  return;
 }
 $('#entryGate').classList.add('hidden');
 $('#signOutBtn').hidden=false;
 activeCacheKey=userCacheKey(authUser.id);
 state=parseState(localStorage.getItem(activeCacheKey));
 setSyncStatus('Loading…','saving');

 const googleName=authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email||'Reader';
 const defaultName=String(googleName).trim().split(/\s+/)[0]||'Reader';

 const loaded=await loadCloudState(defaultName,authUser.id,loadId);
 if(!loaded||loadId!==sessionLoadId)return;

 const isNew=sessionStorage.getItem('archive_pending_new')==='1'||!state.profile.onboarded;
 sessionStorage.removeItem('archive_pending_new');

 if(isNew) startWizard();
 else $('#onboardingGate').classList.add('hidden');

 renderAll();
}

async function loadCloudState(defaultName,expectedUserId,loadId){
 if(!authUser||authUser.id!==expectedUserId) return false;

 const [{data:profile,error:profileError},{data:progressRows,error:progressError},{data:settingsRows,error:settingsError}] = await Promise.all([
  supabaseClient.from('profiles').select('nickname,reading_mode,onboarding_complete').eq('id',expectedUserId).maybeSingle(),
  supabaseClient.from('reading_progress').select('book_id,current_chapter,reading_status').eq('user_id',expectedUserId),
  supabaseClient.from('user_book_settings').select('book_id,spoiler_mode,rereading,bookmarked_chapters,favorite_quotes,ui_preferences').eq('user_id',expectedUserId)
 ]);

 if(loadId!==sessionLoadId||authUser?.id!==expectedUserId)return false;

 if(profileError) console.error('Profile load failed:',profileError);
 if(progressError) console.error('Progress load failed:',progressError);
 if(settingsError) console.error('Book settings load failed:',settingsError);
 if(profileError||progressError||settingsError){setSyncStatus('Could not load cloud data','error');return false}

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
   state.progress[row.book_id]={status:row.reading_status||'not-started',currentChapter:Number(row.current_chapter||0)};
  }
 }else{
  const legacyClaimedBy=localStorage.getItem(`${KEY}:legacy-claimed-by`);
  const hasLocalProgress=!legacyClaimedBy&&Object.values(legacyState.progress||{}).some(v=>Number(v)>0||(v&&Number(v.currentChapter)>0));
  if(hasLocalProgress){
   const shouldImport=window.confirm('Import the reading progress already saved in this browser into your Archive account?');
   if(shouldImport){state.progress={...(legacyState.progress||{})};localStorage.setItem(`${KEY}:legacy-claimed-by`,authUser.id);await saveAllProgressToCloud()}
  }
 }

 state.bookSettings={};
 for(const row of settingsRows||[]){
  state.bookSettings[row.book_id]={spoilerMode:row.spoiler_mode||'safe',rereading:!!row.rereading,bookmarkedChapters:row.bookmarked_chapters||[],favoriteQuotes:row.favorite_quotes||[],uiPreferences:row.ui_preferences||{}};
 }

 cloudLoaded=true;
 save();
 setSyncStatus('Saved','saved');
 return true;
}

async function saveProfileToCloud(){
 if(!authUser) return false;
 if(!navigator.onLine){setSyncStatus('Offline — changes cached','offline');return false}
 setSyncStatus('Saving…','saving');
 const payload={
  id:authUser.id,
  nickname:state.profile.name||'Reader',
  reading_mode:state.profile.mode||'first',
  onboarding_complete:!!state.profile.onboarded,
  updated_at:new Date().toISOString()
 };
 const {error}=await supabaseClient.from('profiles').upsert(payload,{onConflict:'id'});
 if(error){console.error('Profile save failed:',error);setSyncStatus('Sync failed','error');return false}
 setSyncStatus('Saved','saved');return true;
}

async function saveProgressToCloud(bookId){
 if(!authUser) return false;
 if(!navigator.onLine){setSyncStatus('Offline — changes cached','offline');return false}
 const book=byId(bookId);
 if(!book) return false;
 setSyncStatus('Saving…','saving');
 const entry=progressEntry(book),chapter=entry.currentChapter,status=entry.status;
 const payload={
  user_id:authUser.id,
  book_id:bookId,
  current_chapter:chapter,
  reading_status:status,
  updated_at:new Date().toISOString()
 };
 const {error}=await supabaseClient.from('reading_progress').upsert(payload,{onConflict:'user_id,book_id'});
 if(error){console.error('Progress save failed:',error);setSyncStatus('Sync failed','error');return false}
 setSyncStatus('Saved','saved');return true;
}

async function saveAllProgressToCloud(){
 if(!authUser) return;
 if(!navigator.onLine){setSyncStatus('Offline — changes cached','offline');return false}
 const rows=allBooks().filter(b=>!b.upcoming).map(book=>{
  const entry=progressEntry(book),chapter=entry.currentChapter;
  return {
   user_id:authUser.id,
   book_id:book.id,
   current_chapter:chapter,
   reading_status:entry.status,
   updated_at:new Date().toISOString()
  };
 });
 const {error}=await supabaseClient.from('reading_progress').upsert(rows,{onConflict:'user_id,book_id'});
 if(error){console.error('Bulk progress save failed:',error);setSyncStatus('Sync failed','error');return false}
 setSyncStatus('Saved','saved');return true;
}

async function saveBookSettingsToCloud(bookId){
 if(!authUser)return false;
 if(!navigator.onLine){setSyncStatus('Offline — changes cached','offline');return false}
 const settings=state.bookSettings[bookId]||{};
 setSyncStatus('Saving…','saving');
 const payload={user_id:authUser.id,book_id:bookId,spoiler_mode:settings.spoilerMode||'safe',rereading:!!settings.rereading,bookmarked_chapters:settings.bookmarkedChapters||[],favorite_quotes:settings.favoriteQuotes||[],ui_preferences:settings.uiPreferences||{},updated_at:new Date().toISOString()};
 const {error}=await supabaseClient.from('user_book_settings').upsert(payload,{onConflict:'user_id,book_id'});
 if(error){console.error('Book settings save failed:',error);setSyncStatus('Sync failed','error');return false}
 setSyncStatus('Saved','saved');return true;
}

async function saveCloudState(){
 save();
 if(!authUser) return;
 await Promise.all([saveProfileToCloud(),saveAllProgressToCloud(),...Object.keys(state.bookSettings||{}).map(saveBookSettingsToCloud)]);
}

function startWizard(){
 wizardBooks=allBooks().filter(b=>!b.upcoming);wizardIndex=-1;$('#onboardName').value=state.profile.name||'';$('#onboardMode').value=state.profile.mode||'first';$('#onboardTandem').value=tandemPreference();$('#onboardAssassinsBlade').value=assassinsBladeOrder();
 $('#wizardIntro').classList.remove('hidden');$('#wizardBook').classList.add('hidden');$('#onboardingGate').classList.remove('hidden');updateWizardProgress();
}
async function beginBookWizard(){
 state.profile.name=$('#onboardName').value.trim().split(/\s+/)[0]||'Reader';state.profile.mode=$('#onboardMode').value;
 state.bookSettings['tog-plan']={...(state.bookSettings['tog-plan']||{}),uiPreferences:{...(state.bookSettings['tog-plan']?.uiPreferences||{}),tandemPreference:$('#onboardTandem').value,assassinsBladeOrder:$('#onboardAssassinsBlade').value,tandemStep:Number(state.bookSettings['tog-plan']?.uiPreferences?.tandemStep||0)}};
 const togOrder=orderedTogIds();wizardBooks=allBooks().filter(b=>!b.upcoming).sort((a,b)=>{if(a.collectionId!=='throne-of-glass'||b.collectionId!=='throne-of-glass')return 0;return togOrder.indexOf(a.id)-togOrder.indexOf(b.id)});
 save();await Promise.all([saveProfileToCloud(),saveBookSettingsToCloud('tog-plan')]);wizardIndex=0;$('#wizardIntro').classList.add('hidden');$('#wizardBook').classList.remove('hidden');renderWizardBook();
}
function renderWizardBook(){
 const b=wizardBooks[wizardIndex], fm=frontMatter[b.id]||{};
 $('#wizardSeries').textContent=b.collection;$('#wizardBookTitle').textContent=b.title;$('#wizardBookSummary').textContent=fm.summary||'Spoiler-free summary in editorial production.';$('#wizardChapter').max=b.chapters;
 const p=progress(b),status=readingStatus(b);
 $$('input[name="wizardStatus"]').forEach(r=>r.checked=r.value===status);$('#wizardChapterWrap').classList.toggle('hidden',status!=='reading');$('#wizardChapter').value=Math.max(1,p||1);
 $('#wizardBack').disabled=wizardIndex===0;$('#wizardNext').textContent=wizardIndex===wizardBooks.length-1?'Open my bookshelves':'Next book →';updateWizardProgress();
}
function storeWizardBook(){
 const b=wizardBooks[wizardIndex],status=$('input[name="wizardStatus"]:checked').value;
 setBookProgress(b,status,status==='not-started'?0:status==='finished'?b.chapters:Math.max(1,Math.min(b.chapters,Number($('#wizardChapter').value||1))));
}
async function advanceWizard(){storeWizardBook();if(wizardIndex===wizardBooks.length-1){state.profile.onboarded=true;await saveCloudState();$('#onboardingGate').classList.add('hidden');renderAll();view('home');return}wizardIndex++;renderWizardBook()}
function retreatWizard(){if(wizardIndex<=0)return;storeWizardBook();wizardIndex--;renderWizardBook()}
function updateWizardProgress(){const total=wizardBooks.length+1,current=wizardIndex<0?1:wizardIndex+2;$('#wizardStepLabel').textContent=`Step ${current} of ${total}`;$('#wizardBar').style.width=`${Math.round(current/total*100)}%`}
function renderAll(){
 $('#readerBtn').textContent=state.profile.name;$('#settingsMode').value=state.profile.mode;$('#settingsTandem').value=tandemPreference();$('#settingsAssassinsBlade').value=assassinsBladeOrder();const reread=state.profile.mode==='reread';
 $('#modeBtn').textContent=reread?'Reread':'First Read';$('#visibleModeToggle').textContent=reread?'Switch to First Read':'Switch to Reread Mode';
 $('#modeStatus').textContent=reread?'Reread Mode is ON — later significance appears only when safe.':'First Read is ON — future context remains hidden.';
 $('#setupHeadline').textContent=`${state.profile.name}’s books and chapters`;$('#setupSummary').textContent=currentProgressText()+(authUser?' · Synced to your Google account':' · Saved only in this browser');
 document.body.classList.toggle('reread',reread);$('#notice').textContent=catalog.platform.notice;renderReleases();renderLibrary();renderReaders();renderMentions();renderLore();renderDirectories();
}
function currentProgressText(){const active=allBooks().filter(b=>readingStatus(b)==='reading');if(!active.length)return'No current book selected. Use Update books & chapters to set your place.';return active.map(b=>`${b.title}: Chapter ${progress(b)}`).join(' · ')}
function renderReleases(){const el=$('#releases');el.innerHTML=allBooks().filter(b=>b.upcoming).map(b=>`<div class="release"><span><strong>${esc(b.title)}</strong><br>${new Date(b.release).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}</span><b id="c-${b.id}"></b></div>`).join('');tick()}
function tick(){allBooks().filter(b=>b.upcoming).forEach(b=>{let ms=Math.max(0,new Date(b.release)-new Date()),d=Math.floor(ms/86400000);ms%=86400000;let h=Math.floor(ms/3600000);ms%=3600000;let m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);const el=$('#c-'+b.id);if(el)el.textContent=`${d}d ${h}h ${m}m ${s}s`})}setInterval(tick,1000);
function renderLibrary(){
 const el=$('#library');el.innerHTML='';
 catalog.collections.forEach(c=>{const w=document.createElement('section');w.className='shelfwrap';w.innerHTML=`<div class="shelfhead"><div><small>${esc(c.short)}</small><h2>${esc(c.title)}</h2></div></div><div class="shelf"></div>`;const sh=w.querySelector('.shelf');
 orderedBooksForCollection(c).forEach(raw=>{
  const b=byId(raw[0]);
  if(c.id==='throne-of-glass'&&b.id==='eos')sh.append(createTandemSpine());
  const bt=document.createElement('button');bt.className=`spine ${c.theme}${b.upcoming?' upcoming':''}${readingStatus(b)==='reading'?' current':''}`;bt.innerHTML=`<span>${esc(b.title)}</span>`;if(!b.upcoming)bt.onclick=()=>animateBookOpen(bt,b);sh.append(bt)
 });el.append(w)});
}
function createTandemSpine(){const bt=document.createElement('button');bt.className='spine tandem-spine'+(tandemPreference()==='yes'?' current':'')+(tandemPreference()==='no'?' tandem-off':'');bt.innerHTML=`<span>Tandem Read${tandemPreference()==='no'?' · Off':''}</span>`;bt.onclick=()=>animateBookOpen(bt,tandemBook());return bt}
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
 const tandemMode=isTandem(currentBook),tandemOverview='Read Empire of Storms and Tower of Dawn as one continuous experience. The books unfold during the same period in different parts of the world, and this guide tells you exactly when to switch without revealing what happens next.';
 $('#frontCoverSeries').textContent=currentBook.collection;$('#frontCoverTitle').textContent=tandemMode?'Empire of Storms + Tower of Dawn':currentBook.title;$('#frontSeries').textContent=currentBook.collection;$('#frontTitle').textContent=currentBook.title;$('#frontTagline').textContent=tandemMode?'Two books. One shared timeline.':fm.tagline||'';$('#frontSummary').textContent=tandemMode?tandemOverview:fm.summary||'Spoiler-free summary in editorial production.';$('#frontContentStatus').textContent=tandemMode?'Fifty spoiler-free reading sections based on the selected tandem guide.':fm.contentStatus||'Content in editorial production.';
 $('#frontReadingStatus').classList.toggle('hidden',tandemMode);$('#tandemFrontStatus').classList.toggle('hidden',!tandemMode);$('#continueIntoBook').textContent=tandemMode?'Open tandem guide →':'Open chapter guide →';
 if(tandemMode){$('#tandemFrontSection').value=Math.min(currentBook.chapters,tandemStep()+1);$('#tandemFrontPreferenceText').textContent=tandemPreference()==='yes'?'Tandem Read is currently on.':'Tandem Read is currently off, but your saved place is still here.';$('#toggleTandemFront').textContent=tandemPreference()==='yes'?'Turn Tandem Read off':'Turn Tandem Read on'}
 const p=progress(currentBook),status=readingStatus(currentBook);$$('input[name="frontStatus"]').forEach(r=>r.checked=r.value===status);$('#frontChapter').max=currentBook.chapters;$('#frontChapter').value=Math.max(1,p||1);$('#frontChapterWrap').classList.toggle('hidden',status!=='reading');
 $('#frontRereading').checked=!!state.bookSettings[currentBook.id]?.rereading;
 $$('input[name="frontStatus"]').forEach(r=>r.onchange=()=>$('#frontChapterWrap').classList.toggle('hidden',r.value!=='reading'||!r.checked));
 renderFrontPanels();
}
function renderFrontPanels(){
 if(isTandem(currentBook)){renderTandemFrontPanels();return}
 const p=Math.max(0,completedThrough(currentBook));
 $('#frontCharactersPanel').innerHTML='<h3>Characters in this book</h3>'+groupEntries(safeEntries(characters,currentBook.id,p));
 $('#frontPlacesPanel').innerHTML='<h3>Places in this book</h3>'+groupEntries(safeEntries(places,currentBook.id,p));
 const fm=frontMatter[currentBook.id]||{};
 const mayReadFull=readingStatus(currentBook)==='finished';
 const full=mayReadFull?(currentBook.id==='tog'&&tog.summary?tog.summary.map(x=>`<p>${esc(x)}</p>`).join(''):`<p>${esc(fm.summary||'Full summary in editorial production.')}</p><p class="fine-print">A spoiler-filled complete recap is still being reviewed.</p>`):'<div class="locked-summary"><b>Finish this book to unlock its complete summary.</b><p>The spoiler-free overview above remains available while you read.</p></div>';
 $('#frontWholeBookPanel').innerHTML='<h3>Whole-book summary</h3>'+full;
 $$('.front-inline-panel,.front-panel-button').forEach(x=>x.classList.remove('active'));
}
function tandemUnderlyingProgress(done=tandemStep()){
 const result={eos:0,tod:0};tandem.steps.slice(0,done).forEach(step=>{result[step.bookId]=Math.max(result[step.bookId],step.end)});return result;
}
function tandemSafeEntries(source,done=tandemStep()){const read=tandemUnderlyingProgress(done);return ['eos','tod'].flatMap(id=>(source[id]||[]).filter(entry=>entry.safeAt<=read[id]))}
function renderTandemFrontPanels(){
 $('#frontCharactersPanel').innerHTML='<h3>Characters in this tandem read</h3>'+groupEntries(tandemSafeEntries(characters));
 $('#frontPlacesPanel').innerHTML='<h3>Places in this tandem read</h3>'+groupEntries(tandemSafeEntries(places));
 $('#frontWholeBookPanel').innerHTML=tandemStep()>=tandem.steps.length?'<h3>The tandem read in brief</h3><p>You completed both Empire of Storms and Tower of Dawn in one interwoven reading path. The complete combined recap remains in editorial review.</p>':'<div class="locked-summary"><b>Finish the tandem read to unlock its complete combined recap.</b><p>The spoiler-free overview remains available while you read.</p></div>';
 $$('.front-inline-panel,.front-panel-button').forEach(x=>x.classList.remove('active'));
}
async function saveTandemFront(){const section=Math.max(1,Math.min(tandem.steps.length,Number($('#tandemFrontSection').value||1)));await setTandemStep(section-1);currentChapter=section;renderBookFront()}
async function toggleTandemEnabled(){const enabling=tandemPreference()!=='yes';state.bookSettings['tog-plan']={...(state.bookSettings['tog-plan']||{}),uiPreferences:{...readingPlan(),tandemPreference:enabling?'yes':'no'}};save();await saveBookSettingsToCloud('tog-plan');renderAll();renderBookFront()}
async function saveFrontStatus(){const status=$('input[name="frontStatus"]:checked').value;setBookProgress(currentBook,status,status==='not-started'?0:status==='finished'?currentBook.chapters:Math.max(1,Math.min(currentBook.chapters,Number($('#frontChapter').value||1))));state.bookSettings[currentBook.id]={...(state.bookSettings[currentBook.id]||{}),rereading:$('#frontRereading').checked};currentChapter=Math.max(1,progress(currentBook)||1);save();await Promise.all([saveProgressToCloud(currentBook.id),saveBookSettingsToCloud(currentBook.id)]);renderAll();renderBookFront()}
function renderBook(){
 const tandemMode=isTandem(currentBook),unit=tandemMode?'Section':'Ch.';$('#seriesLabel').textContent=currentBook.collection;$('#bookTitle').textContent=currentBook.title;$('#bookmark').innerHTML=`${esc(state.profile.name)}<br><b>${readingStatus(currentBook)==='finished'?'Finished':`${unit} ${progress(currentBook)||1}`}</b>`;$('#chapterNumber').min=tandemMode?1:0;$('#chapterNumber').max=currentBook.chapters;$('#chapterNumber').value=progress(currentBook);$('#quickProgressLabel').textContent=tandemMode?'Jump to current section':'Jump to current chapter';$('#saveChapterNumber').textContent=tandemMode?'Save section':'Save chapter';$('#markFinished').textContent=tandemMode?'Mark tandem read finished':'Mark book finished';
 $('#saveChapterNumber').onclick=async()=>{const chapter=Math.max(tandemMode?1:0,Math.min(currentBook.chapters,Number($('#chapterNumber').value||0)));if(tandemMode){await setTandemStep(chapter-1)}else{setBookProgress(currentBook,chapter===0?'not-started':'reading',chapter);save();await saveProgressToCloud(currentBook.id)}currentChapter=Math.max(1,progress(currentBook)||1);renderAll();renderBook()};
 $('#markFinished').onclick=async()=>{if(tandemMode)await setTandemStep(currentBook.chapters);else{setBookProgress(currentBook,'finished',currentBook.chapters);save();await saveProgressToCloud(currentBook.id)}currentChapter=currentBook.chapters;renderAll();renderBook()};
 const nav=$('#chapterNav');nav.innerHTML='';
 const completed=completedThrough(currentBook),openThrough=readingStatus(currentBook)==='finished'?currentBook.chapters:Math.max(1,progress(currentBook));
 for(let i=1;i<=currentBook.chapters;i++){const b=document.createElement('button');b.className='chapterbtn'+(i===currentChapter?' current':'')+(i>openThrough?' locked':'');const currentLabel=tandemMode?'Current section':'Current chapter',stateLabel=i<=completed?'Completed':i===progress(currentBook)&&readingStatus(currentBook)==='reading'?currentLabel:i===1&&readingStatus(currentBook)==='not-started'?'Start here':'Locked',assignment=tandemMode?tandemStepText(tandem.steps[i-1]):null;b.innerHTML=`<span class="chapter-number">${i}</span><b class="chapter-state">${tandemMode?`<span>${esc(assignment.title)}</span><small>${esc(assignment.detail)} · ${esc(stateLabel)}</small>`:esc(stateLabel)}</b>`;b.onclick=()=>{if(i>openThrough)return alert(`This ${tandemMode?'section':'chapter'} is spoiler-locked.`);currentChapter=i;renderBook()};nav.append(b)}
 renderChapter();
 const preferredTab=state.bookSettings[currentBook.id]?.uiPreferences?.lastTab;
 const initialTab=preferredTab&&$('#'+preferredTab)?preferredTab:'charactersTab';
 $$('.tabs button,.tabpane').forEach(x=>x.classList.remove('active'));document.querySelector(`[data-tab="${initialTab}"]`)?.classList.add('active');$('#'+initialTab)?.classList.add('active');
}
function renderChapter(){
 if(isTandem(currentBook)){renderTandemChapter();return}
 $('#complete').textContent='Mark chapter complete';$('#next').textContent='Next chapter →';
 $('#chapterLabel').textContent=`Chapter ${currentChapter}`;const seed=currentBook.id==='tog'?tog.chapters[String(currentChapter)]:null;
 const chapterSafe=currentChapter<=completedThrough(currentBook)||readingStatus(currentBook)==='finished';
 $('#summary').innerHTML=!chapterSafe?'<div class="locked-summary"><b>Finish this chapter to unlock its recap.</b><p>This protects you from seeing the chapter’s events too early.</p></div>':seed?`<ul>${seed.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>This chapter summary is in editorial production.</p>';
 renderBookDirectoryTabs();renderChapterLore();renderDiscussion();
 $('#complete').onclick=async()=>{if(currentChapter>=currentBook.chapters)setBookProgress(currentBook,'finished',currentBook.chapters);else setBookProgress(currentBook,'reading',Math.max(progress(currentBook),currentChapter+1));save();await saveProgressToCloud(currentBook.id);currentChapter=Math.min(currentBook.chapters,currentChapter+1);renderAll();renderBook()};
 $('#next').onclick=()=>{if(currentChapter<currentBook.chapters&&currentChapter<Math.max(1,progress(currentBook))){currentChapter++;renderBook()}};
}
function renderTandemChapter(){
 const step=tandem.steps[currentChapter-1],copy=tandemStepText(step),chapterSafe=currentChapter<=tandemStep(),read=tandemUnderlyingProgress(chapterSafe?currentChapter:Math.max(0,currentChapter-1));
 $('#chapterLabel').textContent=`Section ${currentChapter} of ${tandem.steps.length} · ${copy.title} · ${copy.detail}`;
 $('#summary').innerHTML=!chapterSafe?'<div class="locked-summary"><b>Finish this section to unlock what you’ll remember.</b><p>The Archive will not reveal events from the assigned chapters early.</p></div>':Array.isArray(step.remember)&&step.remember.length?`<ul>${step.remember.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:`<ul><li>You completed ${esc(copy.title)}, ${esc(copy.detail)}.</li><li>The detailed recap for this tandem section is in editorial review.</li></ul>`;
 $('#charactersTab').innerHTML=groupEntries(['eos','tod'].flatMap(id=>(characters[id]||[]).filter(entry=>entry.safeAt<=read[id])));
 $('#placesTab').innerHTML=groupEntries(['eos','tod'].flatMap(id=>(places[id]||[]).filter(entry=>entry.safeAt<=read[id])));
 const relatedLore=lore.filter(entry=>entry.requires.every(requirementCompleted)&&entry.requires.some(req=>req.bookId==='eos'||req.bookId==='tod'));
 $('#loreTab').innerHTML=relatedLore.length?relatedLore.map(entry=>`<div class="evidence"><span>${esc(entry.type)}</span><h3>${esc(entry.title)}</h3><p>${esc(entry.summary)}</p></div>`).join(''):'<p>No new lore is safe at this section.</p>';
 const relatedConnections=connections.filter(entry=>entry.requires.every(requirementCompleted)&&entry.requires.some(req=>req.bookId==='eos'||req.bookId==='tod'));
 $('#connTab').innerHTML=relatedConnections.length?relatedConnections.map(entry=>`<div class="evidence"><span>${esc(entry.status)}</span><h3>${esc(entry.title)}</h3><p>${esc(entry.summary)}</p><small>${entry.evidence.map(esc).join(' · ')}</small></div>`).join(''):'<p>No verified Connections are unlocked at this section.</p>';
 renderDiscussion();
 $('#complete').textContent='Mark section complete';$('#next').textContent='Next section →';
 $('#complete').onclick=async()=>{await setTandemStep(Math.max(tandemStep(),currentChapter));currentChapter=Math.min(currentBook.chapters,currentChapter+1);renderAll();renderBook()};
 $('#next').onclick=()=>{if(currentChapter<currentBook.chapters&&currentChapter<Math.max(1,progress(currentBook))){currentChapter++;renderBook()}};
}
function safeEntries(source,bookId,chapter){return(source[bookId]||[]).filter(x=>x.safeAt<=chapter)}
function groupEntries(entries){const groups={};entries.forEach(x=>(groups[x.group]??=[]).push(x));return Object.entries(groups).map(([g,items])=>`<section class="directory-group"><h3>${esc(g)}</h3>${items.map(x=>`<article><b>${esc(x.name)}</b><p>${esc(x.bio)}</p></article>`).join('')}</section>`).join('')||'<p>No entries are safe yet.</p>'}
function renderBookDirectoryTabs(){const safeThrough=Math.min(currentChapter,completedThrough(currentBook));$('#charactersTab').innerHTML=groupEntries(safeEntries(characters,currentBook.id,safeThrough));$('#placesTab').innerHTML=groupEntries(safeEntries(places,currentBook.id,safeThrough))}
const requirementCompleted=req=>{const book=byId(req.bookId);return !!book&&completedThrough(book)>=req.chapter};
function safeAtChapter(entry){return entry.requires.every(req=>requirementCompleted(req)&&(req.bookId!==currentBook.id||req.chapter<=currentChapter))}
function renderChapterLore(){const available=lore.filter(l=>safeAtChapter(l)&&l.requires.some(req=>req.bookId===currentBook.id));$('#loreTab').innerHTML=available.length?available.map(l=>`<div class="evidence"><span>${esc(l.type)}</span><h3>${esc(l.title)}</h3><p>${esc(l.summary)}</p></div>`).join(''):'<p>No new lore is safe at this point.</p>';const unlockedConnections=connections.filter(c=>safeAtChapter(c)&&c.requires.some(req=>req.bookId===currentBook.id));
 $('#connTab').innerHTML=unlockedConnections.length?unlockedConnections.map(c=>`<div class="evidence"><span>${esc(c.status)}</span><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><small>${c.evidence.map(esc).join(' · ')}</small></div>`).join(''):'<p>No verified Connections are unlocked at your current reading progress.</p>'}
function renderDiscussion(){const key=`${currentBook.id}-${currentChapter}`,posts=state.discussions[key]||[];$('#discussionFeed').innerHTML=posts.map(p=>`<article class="discussion-post"><b>${esc(p.author)}</b><p>${esc(p.text)}</p></article>`).join('')||'<p>No posts yet.</p>';$('#postDiscussion').onclick=()=>{const text=$('#discussionText').value.trim();if(!text)return;state.discussions[key]=state.discussions[key]||[];state.discussions[key].push({author:state.profile.name,text});save();$('#discussionText').value='';renderDiscussion()}}
function renderReaders(){$('#readers').innerHTML=`<div class="reader-row"><b class="reader-name">${esc(state.profile.name)}</b><span class="reader-progress">${esc(currentProgressText())}</span></div>`}
function renderMentions(){$('#mentions').innerHTML=state.mentions.length?state.mentions.map(m=>`<div>${esc(m.from)} mentioned you</div>`).join(''):'<p>No mentions yet.</p>'}
function tandemStep(){return Math.max(0,Math.min(tandem.steps.length,Number(readingPlan().tandemStep||0)))}
function tandemStepText(step){const book=byId(step.bookId),range=step.label||(step.start===step.end?`Chapter ${step.start}`:`Chapters ${step.start}–${step.end}`);return {title:book.title,detail:range}}
async function syncTandemBooks(done){
 for(const id of ['eos','tod']){
  const book=byId(id),steps=tandem.steps.slice(0,done).filter(x=>x.bookId===id),last=steps.reduce((max,x)=>Math.max(max,x.end),0);
  setBookProgress(book,last===0?'not-started':last>=book.chapters?'finished':'reading',last>=book.chapters?book.chapters:last+1);
 }
 save();await Promise.all([saveProgressToCloud('eos'),saveProgressToCloud('tod')]);
}
async function setTandemStep(done){state.bookSettings['tog-plan']={...(state.bookSettings['tog-plan']||{}),uiPreferences:{...readingPlan(),tandemStep:Math.max(0,Math.min(tandem.steps.length,done))}};save();await Promise.all([saveBookSettingsToCloud('tog-plan'),syncTandemBooks(done)]);renderAll()}
function renderLore(){$('#loreGrid').innerHTML=lore.map(l=>{const ok=l.requires.every(requirementCompleted);return`<article class="lorecard ${ok?'':'locked'}"><small>${ok?esc(l.type):'LOCKED'}</small><h3>${esc(ok?l.title:'Undiscovered entry')}</h3><p>${ok?esc(l.summary):'Continue reading to unlock this entry safely.'}</p></article>`}).join('')}
function renderFullCharacterIndex(){
 return Object.entries(characterIndex).map(([series,items])=>`<section class="series-directory locked-summary"><h2>${esc(series)}</h2><p>${items.length} characters are catalogued. Names and biographies appear individually only when your completed chapters make them safe.</p></section>`).join('');
}
function safeCharactersForCollection(collection){
 const seen=new Set(),entries=[];orderedBooksForCollection(collection).forEach(raw=>{const book=byId(raw[0]);(characters[book.id]||[]).filter(entry=>completedThrough(book)>=entry.safeAt).forEach(entry=>{const key=entry.name.toLowerCase();if(!seen.has(key)){seen.add(key);entries.push(entry)}})});return entries;
}
function renderCharacterSeries(){
 const collections=catalog.collections.filter(collection=>['throne-of-glass','acotar','crescent-city'].includes(collection.id));
 if(!collections.some(collection=>collection.id===activeCharacterSeries))activeCharacterSeries=collections[0]?.id;
 const controls=`<div class="character-series-tabs">${collections.map(collection=>`<button data-character-series="${esc(collection.id)}" class="${collection.id===activeCharacterSeries?'active':''}">${esc(collection.title)}</button>`).join('')}</div>`;
 const collection=collections.find(item=>item.id===activeCharacterSeries),safe=safeCharactersForCollection(collection),indexName=collection.id==='throne-of-glass'?'Throne of Glass':collection.id==='acotar'?'A Court of Thorns and Roses':'Crescent City',catalogued=(characterIndex[indexName]||[]).length;
 $('#archiveCharacters').innerHTML=controls+`<section class="series-character-heading"><small>SERIES DIRECTORY</small><h2>${esc(collection.title)}</h2><p>${safe.length} spoiler-safe character profiles unlocked · ${catalogued} characters catalogued for continued review</p></section>`+groupEntries(safe);
 $$('[data-character-series]').forEach(button=>button.onclick=()=>{activeCharacterSeries=button.dataset.characterSeries;renderCharacterSeries()});
}
function renderDirectories(){renderCharacterSeries();const allPlace=Object.entries(places).flatMap(([id,arr])=>arr.filter(x=>completedThrough(byId(id))>=x.safeAt).map(x=>({...x,bookId:id})));$('#archivePlaces').innerHTML=groupEntries(allPlace);$('#readerList').innerHTML=`<div class="panel"><b>${esc(state.profile.name)}</b><p>${esc(currentProgressText())}</p></div>`}
boot().catch(error=>{console.error(error);setSyncStatus('App failed to load','error');$('#authMessage').textContent='The Archive could not load its required files. Please refresh or try again shortly.'});
