const SUPABASE_URL='https://ikvwfkmyyynyicxqqqlf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_RnPfgxV1K7HBLaFLfzoSLg_K-fOMyGO';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let authUser=null;

async function initializeAuth(){
  const gate=document.querySelector('#authGate');
  const message=document.querySelector('#authMessage');
  const signIn=document.querySelector('#googleSignIn');
  const signOut=document.querySelector('#signOutBtn');

  signIn.addEventListener('click',async()=>{
    signIn.disabled=true;
    message.textContent='Opening Google sign-in…';
    const {error}=await supabaseClient.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:window.location.origin+'/' }
    });
    if(error){
      message.textContent=error.message;
      signIn.disabled=false;
    }
  });

  signOut.addEventListener('click',async()=>{
    await supabaseClient.auth.signOut();
    authUser=null;
    gate.classList.remove('hidden');
    signOut.hidden=true;
    message.textContent='';
  });

  const {data:{session},error}=await supabaseClient.auth.getSession();
  if(error) message.textContent=error.message;
  applySession(session);

  supabaseClient.auth.onAuthStateChange((_event,session)=>applySession(session));
}

function applySession(session){
  const gate=document.querySelector('#authGate');
  const signOut=document.querySelector('#signOutBtn');
  authUser=session?.user||null;
  if(authUser){
    gate.classList.add('hidden');
    signOut.hidden=false;
    const googleName=authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.email||'Reader';
    const firstName=String(googleName).trim().split(/\s+/)[0];
    const current=reader();
    if(current && current.name==='Rosetta' && firstName) current.name=firstName;
    save();
    if(typeof renderAll==='function' && catalog) renderAll();
  }else{
    gate.classList.remove('hidden');
    signOut.hidden=true;
  }
}


const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let catalog,tog,lore,currentBook,currentChapter=1;const KEY='archive-v1-foundation';let state=JSON.parse(localStorage.getItem(KEY)||'{"readers":[{"id":"r1","name":"Rosetta","progress":{"qos":38},"discussions":{},"mentions":[]}],"active":"r1","reread":false}');const save=()=>localStorage.setItem(KEY,JSON.stringify(state));const reader=()=>state.readers.find(r=>r.id===state.active)||state.readers[0];const allBooks=()=>catalog.collections.flatMap(c=>c.books.map(b=>({id:b[0],title:b[1],chapters:b[2],upcoming:!!b[3],release:b[4],theme:c.theme,collection:c.title})));const byId=id=>allBooks().find(b=>b.id===id);const progress=b=>Math.min(b.chapters,Number(reader().progress[b.id]||0));const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));function view(id){$$('.view').forEach(v=>v.classList.remove('active'));$('#'+id).classList.add('active');scrollTo(0,0)}async function boot(){await initializeAuth();[catalog,tog,lore]=await Promise.all(['data/catalog.json','content/tog.json','data/lore.json'].map(u=>fetch(u).then(r=>r.json())));bind();renderAll()}function bind(){$('#homeBtn').onclick=()=>view('home');$('#backHome').onclick=()=>view('home');$$('[data-home]').forEach(b=>b.onclick=()=>view('home'));$('#readerBtn').onclick=()=>view('reader');$('#addReader').onclick=()=>view('reader');$('#atlasCard').onclick=()=>view('atlas');$('#archiveCard').onclick=()=>view('archive');$('#modeBtn').onclick=()=>{state.reread=!state.reread;save();document.body.classList.toggle('reread',state.reread)};$('#readerForm').onsubmit=e=>{e.preventDefault();const name=$('#newReader').value.trim().split(/\s+/)[0];if(!name)return;const r={id:crypto.randomUUID(),name,progress:{},discussions:{},mentions:[]};state.readers.push(r);state.active=r.id;save();e.target.reset();renderAll();view('home')}}function renderAll(){$('#readerBtn').textContent=reader().name;$('#notice').textContent=catalog.platform.notice;renderReleases();renderLibrary();renderReaders();renderMentions();renderLore();renderReaderList()}function renderReleases(){const el=$('#releases');el.innerHTML=allBooks().filter(b=>b.upcoming).map(b=>`<div class="release"><span><strong>${esc(b.title)}</strong><br>${new Date(b.release).toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span><b id="c-${b.id}"></b></div>`).join('');tick()}function tick(){allBooks().filter(b=>b.upcoming).forEach(b=>{let ms=Math.max(0,new Date(b.release)-new Date()),d=Math.floor(ms/86400000);ms%=86400000;let h=Math.floor(ms/3600000);ms%=3600000;let m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000);const el=$('#c-'+b.id);if(el)el.textContent=`${d}d ${h}h ${m}m ${s}s`})}setInterval(tick,1000);function renderLibrary(){const el=$('#library');el.innerHTML='';catalog.collections.forEach(c=>{const w=document.createElement('section');w.className='shelfwrap';w.innerHTML=`<div class="shelfhead"><div><small>${esc(c.short)}</small><h2>${esc(c.title)}</h2></div></div><div class="shelf"></div>`;const sh=w.querySelector('.shelf');c.books.forEach(raw=>{const b=byId(raw[0]),bt=document.createElement('button');bt.className=`spine ${c.theme}${b.upcoming?' upcoming':''}${progress(b)>0&&progress(b)<b.chapters?' current':''}`;bt.innerHTML=`<span>${esc(b.title)}</span>`;if(!b.upcoming)bt.onclick=()=>openBook(b.id);sh.append(bt)});el.append(w)})}function openBook(id){currentBook=byId(id);currentChapter=Math.max(1,progress(currentBook)||1);view('book');renderBook()}function renderBook(){$('#seriesLabel').textContent=currentBook.collection;$('#bookTitle').textContent=currentBook.title;$('#bookmark').innerHTML=`${esc(reader().name)}<br>Ch. ${progress(currentBook)||1}`;const nav=$('#chapterNav');nav.innerHTML='';for(let i=1;i<=currentBook.chapters;i++){const b=document.createElement('button');b.className=`chapterbtn${i===currentChapter?' current':''}${i>progress(currentBook)+1?' locked':''}`;b.textContent=`Chapter ${i} — ${i<=progress(currentBook)?'Completed':i===progress(currentBook)+1?'Next':'Locked'}`;b.onclick=()=>{if(i>progress(currentBook)+1)return alert('This chapter is spoiler-locked.');currentChapter=i;renderBook()};nav.append(b)}renderChapter()}function renderChapter(){const seed=currentBook.id==='tog'?tog.chapters[String(currentChapter)]:null;$('#chapterLabel').textContent='Chapter '+currentChapter;$('#art').innerHTML=`<p>${esc(seed?.art||'Original chapter artwork is queued for this chapter.')}</p>`;$('#summary').innerHTML=seed?`<ul>${seed.bullets.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>This chapter’s researched summary is in the content pipeline.</p>';$('#sumTab').innerHTML=seed?'<div class="card"><b>Cross-checked summary seed</b><p>Written in original language from multiple public recap sources.</p></div>':'<div class="card locked">Content in progress.</div>';const safe=lore.filter(l=>l.requires.every(r=>(reader().progress[r.bookId]||0)>=r.chapter));$('#loreTab').innerHTML=safe.filter(l=>l.type==='canon').map(l=>`<div class="card"><b>${esc(l.title)}</b><p>${esc(l.summary)}</p></div>`).join('')||'<p>No new lore is safe yet.</p>';$('#connTab').innerHTML=lore.filter(l=>l.type==='connection').map(l=>{const ok=l.requires.every(r=>(reader().progress[r.bookId]||0)>=r.chapter);return `<div class="card ${ok?'':'locked'}"><b>${ok?esc(l.title):'Undiscovered thread'}</b><p>${ok?esc(l.summary):'Complete all required chapters to reveal this connection.'}</p></div>`}).join('');renderDiscussion();$('#complete').onclick=()=>{reader().progress[currentBook.id]=Math.max(progress(currentBook),currentChapter);save();renderAll();renderBook()};$('#next').onclick=()=>{if(currentChapter<currentBook.chapters&&currentChapter<=progress(currentBook)){currentChapter++;renderBook()}}}$$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button,.tabpane').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.tab).classList.add('active')});function renderDiscussion(){const key=`${currentBook.id}-${currentChapter}`,posts=state.readers.flatMap(r=>(r.discussions[key]||[]).map(p=>({...p,author:r.name})));$('#discussionFeed').innerHTML=posts.map(p=>`<div class="discussion"><b>${esc(p.author)}</b><p>${esc(p.text)}</p></div>`).join('')||'<p>No Book Club posts yet.</p>';$('#postDiscussion').onclick=()=>{const text=$('#discussionText').value.trim();if(!text)return;reader().discussions[key]=reader().discussions[key]||[];reader().discussions[key].push({text});state.readers.forEach(r=>{if(r.id!==reader().id&&new RegExp('@'+r.name+'\b','i').test(text))r.mentions.push({from:reader().name,bookId:currentBook.id,chapter:currentChapter})});save();$('#discussionText').value='';renderDiscussion();renderMentions()}}function renderReaders(){$('#readers').innerHTML=state.readers.map(r=>{const b=allBooks().find(x=>(r.progress[x.id]||0)>0&&(r.progress[x.id]||0)<x.chapters);return `<div class="readerrow"><b>${esc(r.name)}</b><span>${b?esc(b.title)+' · Ch. '+r.progress[b.id]:'Ready to begin'}</span></div>`}).join('')}function renderMentions(){$('#mentions').innerHTML=(reader().mentions||[]).slice(-4).reverse().map(m=>`<div class="mentionrow"><b>${esc(m.from)} mentioned you</b><span>${esc(byId(m.bookId)?.title||'Book')} · Ch. ${m.chapter}</span></div>`).join('')||'<p>No mentions yet.</p>'}function renderLore(){$('#loreGrid').innerHTML=lore.map(l=>{const ok=l.requires.every(r=>(reader().progress[r.bookId]||0)>=r.chapter);return `<article class="lorecard ${ok?'':'locked'}"><small>${ok?esc(l.type):'LOCKED'}</small><h3>${esc(ok?l.title:'Undiscovered entry')}</h3><p>${ok?esc(l.summary):'Continue reading to reveal this safely.'}</p></article>`}).join('')}function renderReaderList(){$('#readerList').innerHTML=state.readers.map(r=>`<button class="panel" data-id="${r.id}">${esc(r.name)}</button>`).join('');$('#readerList').querySelectorAll('button').forEach(b=>b.onclick=()=>{state.active=b.dataset.id;save();renderAll();view('home')})}boot();
