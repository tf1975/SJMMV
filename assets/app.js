const SUPABASE_URL='https://ikvwfkmyyynyicxqqqlf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_RnPfgxV1K7HBLaFLfzoSLg_K-fOMyGO';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let authUser=null,catalog,tog,lore,currentBook,currentChapter=1,pendingNewUser=false;
const KEY='archive-v2-onboarding';
let state=JSON.parse(localStorage.getItem(KEY)||'{"profile":{"name":"Reader","mode":"first","onboarded":false},"progress":{},"discussions":{},"mentions":[]}');
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
const allBooks=()=>catalog.collections.flatMap(c=>c.books.map(b=>({id:b[0],title:b[1],chapters:b[2],upcoming:!!b[3],release:b[4],theme:c.theme,collection:c.title,collectionId:c.id})));
const byId=id=>allBooks().find(b=>b.id===id);
const progress=b=>Math.min(b.chapters,Number(state.progress[b.id]||0));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function view(id){$$('.view').forEach(v=>v.classList.remove('active'));$('#'+id).classList.add('active');scrollTo(0,0)}
async function boot(){[catalog,tog,lore]=await Promise.all(['data/catalog.json','content/tog.json','data/lore.json'].map(u=>fetch(u).then(r=>r.json())));bind();await initializeAuth();renderAll()}
function bind(){
 $('#homeBtn').onclick=()=>view('home');$('#backHome').onclick=()=>view('home');$$('[data-home]').forEach(b=>b.onclick=()=>view('home'));$('#readerBtn').onclick=()=>view('reader');$('#atlasCard').onclick=()=>view('atlas');$('#archiveCard').onclick=()=>view('archive');
 $('#returningReader').onclick=()=>showGoogle(false);$('#newReaderStart').onclick=()=>showGoogle(true);$('#backToEntry').onclick=()=>{$('#googleStep').hidden=true;$('#entryChoices').hidden=false;$('#authMessage').textContent=''};
 $('#modeBtn').onclick=toggleReadingMode;
 $('#visibleModeToggle').onclick=toggleReadingMode;
 $('#editProgress').onclick=()=>{buildOnboarding();$('#onboardingGate').classList.remove('hidden')};
 $('#saveMode').onclick=()=>{state.profile.mode=$('#settingsMode').value;save();renderAll();view('home')};
 $('#saveOnboarding').onclick=saveOnboarding;
 $$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button,.tabpane').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});
 $$('.map-detail').forEach(b=>b.onclick=()=>showMapDetails(b.dataset.map));
 $$('.archive-filter button').forEach(b=>b.onclick=()=>{$$('.archive-filter button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderLore(b.dataset.kind)});
}
function toggleReadingMode(){
 state.profile.mode=state.profile.mode==='reread'?'first':'reread';
 save();renderAll();
}
function showGoogle(isNew){pendingNewUser=isNew;sessionStorage.setItem('archive_pending_new',isNew?'1':'0');$('#entryChoices').hidden=true;$('#googleStep').hidden=false;$('#googleStepText').textContent=isNew?'Create your secure Archive account with Google, then set your current books and chapters.':'Sign in with the Google account you used before.'}
async function initializeAuth(){
 $('#googleSignIn').onclick=async()=>{const btn=$('#googleSignIn');btn.disabled=true;$('#authMessage').textContent='Opening Google sign-in…';const {error}=await supabaseClient.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+'/'}});if(error){$('#authMessage').textContent=error.message;btn.disabled=false}};
 $('#signOutBtn').onclick=async()=>{await supabaseClient.auth.signOut();authUser=null;$('#entryGate').classList.remove('hidden');$('#signOutBtn').hidden=true;$('#entryChoices').hidden=false;$('#googleStep').hidden=true};
 const {data:{session}}=await supabaseClient.auth.getSession();applySession(session);
 supabaseClient.auth.onAuthStateChange((_e,s)=>applySession(s));
}
function applySession(session){authUser=session?.user||null;if(!authUser){$('#entryGate').classList.remove('hidden');$('#signOutBtn').hidden=true;return}
 $('#entryGate').classList.add('hidden');$('#signOutBtn').hidden=false;
 const googleName=authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email||'Reader';
 if(!state.profile.name||state.profile.name==='Reader')state.profile.name=String(googleName).trim().split(/\s+/)[0];
 const isNew=sessionStorage.getItem('archive_pending_new')==='1'||!state.profile.onboarded;
 sessionStorage.removeItem('archive_pending_new');save();
 if(isNew){buildOnboarding();$('#onboardingGate').classList.remove('hidden')}else{$('#onboardingGate').classList.add('hidden')}
 renderAll();
}
function buildOnboarding(){
 $('#onboardName').value=state.profile.name||'';$('#onboardMode').value=state.profile.mode||'first';const el=$('#onboardBooks');el.innerHTML='';
 catalog.collections.forEach(c=>{const group=document.createElement('section');group.className='onboard-series';group.innerHTML=`<h3>${esc(c.title)}</h3>`;c.books.filter(b=>!b[3]).forEach(raw=>{const b=byId(raw[0]),row=document.createElement('div');row.className='onboard-book';row.innerHTML=`<label><input type="checkbox" class="book-active" data-id="${b.id}" ${progress(b)>0?'checked':''}> ${esc(b.title)}</label><input class="book-chapter" data-id="${b.id}" type="number" min="0" max="${b.chapters}" value="${progress(b)}"><span>of ${b.chapters}</span><button type="button" class="finish-book" data-id="${b.id}">Finished</button>`;row.querySelector('.finish-book').onclick=()=>{row.querySelector('.book-active').checked=true;row.querySelector('.book-chapter').value=b.chapters};group.append(row)});el.append(group)});
}
function saveOnboarding(){state.profile.name=$('#onboardName').value.trim().split(/\s+/)[0]||'Reader';state.profile.mode=$('#onboardMode').value;$$('.onboard-book').forEach(row=>{const id=row.querySelector('.book-chapter').dataset.id,active=row.querySelector('.book-active').checked,val=Number(row.querySelector('.book-chapter').value||0);state.progress[id]=active?Math.max(0,Math.min(byId(id).chapters,val)):0});state.profile.onboarded=true;save();$('#onboardingGate').classList.add('hidden');renderAll();view('home')}
function renderAll(){
 $('#readerBtn').textContent=state.profile.name;
 $('#settingsMode').value=state.profile.mode;
 const reread=state.profile.mode==='reread';
 $('#modeStatus').textContent=reread?'Reread Mode is ON — safe foreshadowing appears when its payoff is already known.':'First Read is ON — future context remains hidden.';
 $('#visibleModeToggle').textContent=reread?'Switch to First Read':'Switch to Reread Mode';
 $('#modeBtn').textContent=reread?'Reread':'First Read';
 $('#setupHeadline').textContent=`${state.profile.name}’s books and chapters`;
 $('#setupSummary').textContent=currentProgressText()+'. You can change every book and chapter here at any time.';
 document.body.classList.toggle('reread',reread);$('#notice').textContent=catalog.platform.notice;renderReleases();renderLibrary();renderReaders();renderMentions();renderLore('all');renderReaderList()}
function renderReleases(){const el=$('#releases');el.innerHTML=allBooks().filter(b=>b.upcoming).map(b=>`<div class="release"><span><strong>${esc(b.title)}</strong><br>${new Date(b.release).toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span><b id="c-${b.id}"></b></div>`).join('');tick()}
function tick(){allBooks().filter(b=>b.upcoming).forEach(b=>{let ms=Math.max(0,new Date(b.release)-new Date()),d=Math.floor(ms/86400000);ms%=86400000;let h=Math.floor(ms/3600000);ms%=3600000;let m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);const el=$('#c-'+b.id);if(el)el.textContent=`${d}d ${h}h ${m}m ${s}s`})}setInterval(tick,1000);
function renderLibrary(){const el=$('#library');el.innerHTML='';catalog.collections.forEach(c=>{const w=document.createElement('section');w.className='shelfwrap';w.innerHTML=`<div class="shelfhead"><div><small>${esc(c.short)}</small><h2>${esc(c.title)}</h2></div></div><div class="shelf"></div>`;const sh=w.querySelector('.shelf');c.books.forEach(raw=>{const b=byId(raw[0]),bt=document.createElement('button');bt.className=`spine ${c.theme}${b.upcoming?' upcoming':''}${progress(b)>0&&progress(b)<b.chapters?' current':''}`;bt.innerHTML=`<span>${esc(b.title)}</span>`;if(!b.upcoming)bt.onclick=()=>openBook(b.id);sh.append(bt)});el.append(w)})}
function openBook(id){currentBook=byId(id);currentChapter=Math.max(1,progress(currentBook)||1);view('book');renderBook()}
function renderBook(){
 $('#seriesLabel').textContent=currentBook.collection;$('#bookTitle').textContent=currentBook.title;$('#bookmark').innerHTML=`${esc(state.profile.name)}<br><b>Ch. ${progress(currentBook)||1}</b>`;$('#chapterNumber').max=currentBook.chapters;$('#chapterNumber').value=progress(currentBook);
 $('#saveChapterNumber').onclick=()=>{state.progress[currentBook.id]=Math.max(0,Math.min(currentBook.chapters,Number($('#chapterNumber').value||0)));currentChapter=Math.max(1,state.progress[currentBook.id]||1);save();renderAll();renderBook()};
 $('#markFinished').onclick=()=>{state.progress[currentBook.id]=currentBook.chapters;currentChapter=currentBook.chapters;save();renderAll();renderBook()};
 const nav=$('#chapterNav');nav.innerHTML='';for(let i=1;i<=currentBook.chapters;i++){const b=document.createElement('button');b.className='chapterbtn'+(i===currentChapter?' current':'')+(i>progress(currentBook)+1?' locked':'');b.innerHTML=`<span>${i}</span><b>${i<=progress(currentBook)?'Completed':i===progress(currentBook)+1?'Next chapter':'Locked'}</b>`;b.onclick=()=>{if(i>progress(currentBook)+1)return alert('This chapter is spoiler-locked.');currentChapter=i;renderBook()};nav.append(b)}renderChapter()}
function renderChapter(){
 $('#chapterLabel').textContent=`Chapter ${currentChapter}`;const seed=currentBook.id==='tog'?tog.chapters[String(currentChapter)]:null;
 if(seed?.image){
 $('#art').src=seed.image;
 $('#art').alt=`Original spoiler-safe artwork for ${currentBook.title}, Chapter ${currentChapter}`;
 $('#artStatus').textContent='Original chapter banner';
}else{
 $('#art').src='assets/chapter-art/placeholder.svg';
 $('#art').alt='Chapter artwork still in production';
 $('#artStatus').textContent='Artwork for this chapter is still in production';
}
 $('#summary').innerHTML=seed?`<ul>${seed.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>This chapter’s researched summary is in the content pipeline.</p>';
 const reread=state.profile.mode==='reread'&&seed?.reread?.length?`<div class="reread-insight"><strong>Reread insight</strong><ul>${seed.reread.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
 $('#sumTab').innerHTML=(seed?'<div class="evidence"><b>Chapter evidence</b><p>Book and chapter citation: '+esc(currentBook.title)+', Chapter '+currentChapter+'.</p></div>':'<p>Content in progress.</p>')+reread;
 $('#bookSummaryTab').innerHTML=currentBook.id==='tog'&&tog.summary?`<h3>The book in brief</h3>${tog.summary.map(p=>`<p>${esc(p)}</p>`).join('')}<h3>What changed</h3><ul>${tog.whatChanged.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>The whole-book summary is in the content pipeline.</p>';
 const unlocked=lore.filter(l=>l.type!=='connection'&&l.requires.every(r=>(state.progress[r.bookId]||0)>=r.chapter));
 $('#loreTab').innerHTML=unlocked.length?unlocked.map(l=>loreCard(l,true)).join(''):'<p>No lore entries are safely unlocked yet.</p>';
 const connections=lore.filter(l=>l.type==='connection');$('#connTab').innerHTML=connections.length?connections.map(l=>{const ok=l.requires.every(r=>(state.progress[r.bookId]||0)>=r.chapter);return loreCard(l,ok)}).join(''):'<p>No verified cross-series connection has been added to this content pack yet. Placeholder claims have been removed.</p>';
 renderDiscussion();$('#complete').onclick=()=>{state.progress[currentBook.id]=Math.max(progress(currentBook),currentChapter);save();renderAll();renderBook()};$('#next').onclick=()=>{if(currentChapter<currentBook.chapters&&currentChapter<=progress(currentBook)){currentChapter++;renderBook()}}
}
function loreCard(l,ok){const evidence=(l.evidence||[]).map(e=>`<small>${esc(byId(e.bookId)?.title||e.bookId)}, Chapter ${e.chapter}: ${esc(e.note||'Evidence')}</small>`).join('<br>');return `<div class="evidence ${ok?'':'locked-entry'}"><span class="lore-type">${ok?esc(l.type):'locked'}</span><h3>${esc(ok?l.title:'Undiscovered entry')}</h3><p>${ok?esc(l.summary):'Complete every required chapter to reveal this safely.'}</p>${ok?evidence:''}</div>`}
function renderDiscussion(){const key=`${currentBook.id}-${currentChapter}`,posts=state.discussions[key]||[];$('#discussionFeed').innerHTML=posts.length?posts.map(p=>`<div class="discussion"><strong>${esc(p.author)}</strong><p>${esc(p.text)}</p></div>`).join(''):'<p>No Book Club posts yet.</p>';$('#postDiscussion').onclick=()=>{const text=$('#discussionText').value.trim();if(!text)return;state.discussions[key]=state.discussions[key]||[];state.discussions[key].push({id:crypto.randomUUID(),author:state.profile.name,text,created:new Date().toISOString()});save();$('#discussionText').value='';renderDiscussion()}}
function renderReaders(){$('#readers').innerHTML=`<div class="readerrow"><strong>${esc(state.profile.name)}</strong><small>${currentProgressText()}</small></div>`}
function currentProgressText(){const b=allBooks().find(x=>progress(x)>0&&progress(x)<x.chapters)||allBooks().find(x=>progress(x)>0);return b?`${esc(b.title)} · Ch. ${progress(b)}`:'Ready to begin'}
function renderMentions(){$('#mentions').innerHTML=state.mentions.length?state.mentions.map(m=>`<div class="readerrow"><strong>${esc(m.from)} mentioned you</strong><small>${esc(byId(m.bookId)?.title||'Book')} · Ch. ${m.chapter}</small></div>`).join(''):'<p>No mentions yet.</p>'}
function renderLore(kind='all'){const el=$('#loreGrid');const selected=lore.filter(l=>kind==='all'||l.type===kind);el.innerHTML=selected.map(l=>{const ok=l.requires.every(r=>(state.progress[r.bookId]||0)>=r.chapter);return `<article class="lorecard ${ok?'':'locked-entry'}"><span class="lore-type">${ok?esc(l.type):'locked'}</span><h3>${esc(ok?l.title:'Undiscovered entry')}</h3><p>${ok?esc(l.summary):'Continue reading to reveal this safely.'}</p></article>`}).join('')||'<p>No entries in this category yet.</p>'}
function renderReaderList(){$('#readerList').innerHTML=`<article class="panel"><h3>${esc(state.profile.name)}</h3><p>${currentProgressText()}</p><p>${state.profile.mode==='reread'?'Reread Mode':'First Read'}</p></article>`}
function showMapDetails(map){const requirements={erilea:[['Rifthold','tog',5],['Endovier','tog',1],['Terrasen','hof',1]],prythian:[['The mortal lands','acotar1',1],['Spring Court','acotar1',5],['Night Court','acomaf',1]],midgard:[['Lunathion','hoeab',1],['Valbara','hoeab',1],['Pangera','hosab',1]]};$('#mapDetails').innerHTML=`<h3>${map[0].toUpperCase()+map.slice(1)}</h3>`+requirements[map].map(([name,b,c])=>`<div class="map-location"><strong>${esc(name)}</strong><span>${(state.progress[b]||0)>=c?'Unlocked':'Story details locked'}</span></div>`).join('')}
boot();