/* Archive community features. User-generated content lives in Supabase; editorial content stays versioned with the site. */
(() => {
  const html = value => esc(value);
  const signedIn = () => !!authUser;
  const message = (element, copy, stateName = '') => {
    if (!element) return;
    element.textContent = copy;
    element.dataset.state = stateName;
  };
  const bookTitle = id => id === 'tandem' ? 'Tandem Read' : (byId(id)?.title || id);
  const readableDate = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  function bind() {
    $('#archivistForm')?.addEventListener('submit', askArchivist);
    $('#bulletinForm')?.addEventListener('submit', postBulletin);
    $('#eventForm')?.addEventListener('submit', postEvent);
    $('#dearSarahForm')?.addEventListener('submit', postLetter);
    $('#theoryForm')?.addEventListener('submit', postTheory);
    ensureTheoryBooks();
  }

  function ensureTheoryBooks() {
    const theoryBook = $('#theoryBook');
    if (!theoryBook || !catalog || theoryBook.options.length) return;
    theoryBook.innerHTML = allBooks().filter(book => !book.upcoming).map(book => `<option value="${html(book.id)}">${html(book.title)}</option>`).join('');
    theoryBook.onchange = () => { $('#theoryChapter').max = byId(theoryBook.value)?.chapters || 1; };
    theoryBook.dispatchEvent(new Event('change'));
  }

  async function renderHome() {
    ensureTheoryBooks();
    await Promise.allSettled([renderBulletin(), renderEvents(), renderLetters(), renderPersonalArchive(), renderHomePlaylist()]);
  }

  async function renderReaders(container) {
    if (!signedIn()) return;
    const { data, error } = await supabaseClient.rpc('list_book_club_readers');
    if (error) { console.error('Book Club reader load failed:', error); return; }
    container.innerHTML = (data || []).map(reader => {
      const current = Array.isArray(reader.current_books) ? reader.current_books : [];
      const progressText = current.length
        ? current.map(item => `${bookTitle(item.book_id)}: Chapter ${Number(item.current_chapter || 1)}`).join(' · ')
        : 'No current book selected.';
      return `<div class="reader-row"><b class="reader-name">${html(reader.nickname)}</b><span class="reader-progress">${html(progressText)}</span></div>`;
    }).join('') || '<p>No readers have joined yet.</p>';
  }

  async function renderBulletin() {
    const feed = $('#bulletinFeed'); if (!feed) return;
    if (!signedIn()) { feed.innerHTML = '<p>Sign in to see the Book Club bulletin.</p>'; return; }
    const { data, error } = await supabaseClient.from('club_posts').select('id,author_nickname,body,created_at').order('created_at', { ascending: false }).limit(30);
    feed.innerHTML = error ? '<p>The bulletin could not load.</p>' : (data || []).map(post => `<article class="social-post"><b>${html(post.author_nickname)}</b><p>${html(post.body)}</p><small>${html(readableDate(post.created_at))}</small></article>`).join('') || '<p>No bulletin posts yet.</p>';
  }

  async function postBulletin(event) {
    event.preventDefault(); if (!signedIn()) return;
    const text = $('#bulletinText').value.trim(); if (!text) return;
    const button = event.currentTarget.querySelector('button'); button.disabled = true;
    const { error } = await supabaseClient.from('club_posts').insert({ author_id: authUser.id, author_nickname: state.profile.name, body: text });
    button.disabled = false;
    if (error) return alert('The bulletin post could not be saved.');
    $('#bulletinText').value = ''; await renderBulletin();
  }

  async function renderEvents() {
    const feed = $('#eventsFeed'); if (!feed || !signedIn()) return;
    const { data, error } = await supabaseClient.from('reader_events').select('id,author_nickname,title,starts_at,location,details').gte('starts_at', new Date(Date.now() - 86400000).toISOString()).order('starts_at').limit(20);
    feed.innerHTML = error ? '<p>Events could not load.</p>' : (data || []).map(item => `<article class="social-post"><b>${html(item.title)}</b><p>${html(readableDate(item.starts_at))} · ${html(item.location)}</p>${item.details ? `<small>${html(item.details)}</small>` : ''}</article>`).join('') || '<p>No upcoming events yet.</p>';
  }

  async function postEvent(event) {
    event.preventDefault(); if (!signedIn()) return;
    const payload = { author_id: authUser.id, author_nickname: state.profile.name, title: $('#eventTitle').value.trim(), starts_at: new Date($('#eventWhen').value).toISOString(), location: $('#eventWhere').value.trim(), details: $('#eventDetails').value.trim() };
    const { error } = await supabaseClient.from('reader_events').insert(payload);
    if (error) return alert('The event could not be saved.');
    event.currentTarget.reset(); await renderEvents();
  }

  async function renderLetters() {
    const feed = $('#dearSarahFeed'); if (!feed || !signedIn()) return;
    const { data, error } = await supabaseClient.from('dear_sarah_letters').select('id,author_nickname,body,created_at').order('created_at', { ascending: false }).limit(12);
    feed.innerHTML = error ? '<p>Community letters could not load.</p>' : (data || []).map(item => `<article class="social-post letter-post"><b>${html(item.author_nickname)}</b><p>${html(item.body)}</p></article>`).join('') || '<p>No letters have been added yet.</p>';
  }

  async function postLetter(event) {
    event.preventDefault(); if (!signedIn()) return;
    const body = $('#dearSarahText').value.trim(); if (!body) return;
    const { error } = await supabaseClient.from('dear_sarah_letters').insert({ author_id: authUser.id, author_nickname: state.profile.name, body });
    if (error) return alert('Your letter could not be saved.');
    event.currentTarget.reset(); await renderLetters();
  }

  function renderBookFrontCommunity() {
    renderContributionArea($('#bookStartCommunity'), 'book-start', null, 'Opening songs & art', true);
    const finished = readingStatus(currentBook) === 'finished';
    if (finished) renderContributionArea($('#bookEndCommunity'), 'book-end', null, 'Ending songs & art', true);
    else $('#bookEndCommunity').innerHTML = '<div class="locked-summary"><b>Finish this book to unlock the ending gallery and playlist.</b></div>';
    renderPersonalNote($('#bookPersonalNote'), 0, 'Book notes');
  }

  function renderChapter() {
    renderPersonalNote($('#chapterPersonalNote'), currentChapter, `Chapter ${currentChapter} notes`);
    if (completedThrough(currentBook) < currentChapter) {
      $('#chapterSongs').innerHTML = '<div class="locked-summary"><b>Finish this chapter to unlock its song recommendations.</b></div>';
      $('#chapterArt').innerHTML = '<div class="locked-summary"><b>Finish this chapter to unlock its art gallery.</b></div>';
      return;
    }
    renderContributionArea($('#chapterSongs'), 'chapter', currentChapter, `Chapter ${currentChapter} songs`, false, 'song');
    renderContributionArea($('#chapterArt'), 'chapter', currentChapter, `Chapter ${currentChapter} art`, false, 'art');
  }

  async function renderContributionArea(container, placement, chapter, heading, includeBoth, onlyKind = null) {
    if (!container || !currentBook) return;
    const safetyCopy = placement === 'book-start' ? 'Opening submissions must be completely spoiler-free.' : 'Reader submissions appear here without changing the official recap.';
    container.innerHTML = `<section class="contribution-area"><h3>${html(heading)}</h3><p class="fine-print">${safetyCopy}</p><div class="submission-feed"><p>Loading…</p></div>${contributionForm(placement, chapter, includeBoth, onlyKind)}</section>`;
    bindContributionForm(container, placement, chapter, onlyKind);
    await loadContributions(container, placement, chapter, onlyKind);
  }

  function contributionForm(placement, chapter, includeBoth, onlyKind) {
    if (!signedIn()) return '<p>Sign in to recommend a song or submit art.</p>';
    const kindField = includeBoth ? '<select name="kind"><option value="song">Song recommendation</option><option value="art">Art submission</option></select>' : `<input type="hidden" name="kind" value="${onlyKind}">`;
    return `<form class="submission-form stacked-form" data-placement="${placement}" data-chapter="${chapter || ''}">${kindField}<div class="song-fields"><input name="songTitle" maxlength="160" placeholder="Song title"><input name="artist" maxlength="160" placeholder="Artist"><input name="url" type="url" maxlength="500" placeholder="Optional Spotify, Apple Music, or other link"></div><div class="art-fields"><input name="artFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><input name="artTitle" maxlength="160" placeholder="Artwork title"></div><textarea name="note" maxlength="1000" placeholder="Why does this fit?"></textarea><button class="gold" type="submit">Add recommendation</button></form>`;
  }

  function bindContributionForm(container, placement, chapter, onlyKind) {
    const form = container.querySelector('.submission-form'); if (!form) return;
    const syncKind = () => { const kind = onlyKind || form.elements.kind.value; form.classList.toggle('is-art', kind === 'art'); };
    form.elements.kind?.addEventListener('change', syncKind); syncKind();
    form.onsubmit = event => submitContribution(event, placement, chapter, onlyKind);
  }

  async function submitContribution(event, placement, chapter, onlyKind) {
    event.preventDefault();
    const form = event.currentTarget, kind = onlyKind || form.elements.kind.value, title = form.elements[kind === 'song' ? 'songTitle' : 'artTitle'].value.trim(), note = form.elements.note.value.trim();
    if (!title) return alert(`Please add a ${kind === 'song' ? 'song' : 'artwork'} title.`);
    let storagePath = null;
    if (kind === 'art') {
      const file = form.elements.artFile.files[0]; if (!file) return alert('Choose an image to upload.');
      if (file.size > 8 * 1024 * 1024) return alert('Artwork must be smaller than 8 MB.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-'); storagePath = `${authUser.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabaseClient.storage.from('reader-art').upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) return alert('The artwork could not be uploaded.');
    }
    const payload = { author_id: authUser.id, author_nickname: state.profile.name, kind, book_id: currentBook.id, chapter_number: chapter, placement, title, artist: kind === 'song' ? form.elements.artist.value.trim() : null, note, external_url: kind === 'song' ? form.elements.url.value.trim() || null : null, storage_path: storagePath };
    const { error } = await supabaseClient.from('reader_submissions').insert(payload);
    if (error) { if (storagePath) await supabaseClient.storage.from('reader-art').remove([storagePath]); return alert('The submission could not be saved.'); }
    form.reset(); await loadContributions(form.closest('.contribution-area'), placement, chapter, onlyKind);
  }

  async function loadContributions(container, placement, chapter, onlyKind) {
    const feed = container.querySelector('.submission-feed');
    let query = supabaseClient.from('reader_submissions').select('id,author_nickname,kind,title,artist,note,external_url,storage_path,created_at').eq('book_id', currentBook.id).eq('placement', placement).order('created_at', { ascending: false });
    query = chapter == null ? query.is('chapter_number', null) : query.eq('chapter_number', chapter);
    if (onlyKind) query = query.eq('kind', onlyKind);
    const { data, error } = await query.limit(50);
    if (error) { feed.innerHTML = '<p>Reader submissions could not load.</p>'; return; }
    const likeMap = await loadSongLikeMap((data || []).filter(item => item.kind === 'song').map(item => item.id));
    const cards = await Promise.all((data || []).map(async item => {
      let art = '';
      if (item.kind === 'art' && item.storage_path) {
        const { data: signed } = await supabaseClient.storage.from('reader-art').createSignedUrl(item.storage_path, 3600);
        if (signed?.signedUrl) art = `<button class="art-card" type="button" data-art-src="${html(signed.signedUrl)}"><img src="${html(signed.signedUrl)}" alt="${html(item.title)}"></button>`;
      }
      const title = item.external_url ? `<a href="${html(item.external_url)}" target="_blank" rel="noopener noreferrer">${html(item.title)}</a>` : html(item.title);
      const likes = item.kind === 'song' ? songLikeMarkup(item.id, likeMap.get(item.id) || []) : '';
      return `<article class="submission-card">${art}<b>${title}</b>${item.artist ? `<span>${html(item.artist)}</span>` : ''}${item.note ? `<p>${html(item.note)}</p>` : ''}<small>Suggested by ${html(item.author_nickname)}</small>${likes}</article>`;
    }));
    feed.innerHTML = cards.join('') || '<p>No submissions yet. Be the first.</p>';
    feed.querySelectorAll('.art-card').forEach(button => button.onclick = () => openArt(button.dataset.artSrc));
    bindSongLikeButtons(feed, () => loadContributions(container, placement, chapter, onlyKind));
  }

  async function loadSongLikeMap(submissionIds) {
    const map = new Map(); if (!signedIn() || !submissionIds.length) return map;
    const { data: likes, error } = await supabaseClient.from('song_likes').select('submission_id,user_id').in('submission_id', submissionIds);
    if (error) { console.error('Song likes could not load:', error); return map; }
    const userIds = [...new Set((likes || []).map(like => like.user_id))];
    let names = new Map();
    if (userIds.length) {
      const { data: profiles } = await supabaseClient.from('profiles').select('id,nickname').in('id', userIds);
      names = new Map((profiles || []).map(profile => [profile.id, profile.nickname]));
    }
    for (const like of likes || []) {
      const list = map.get(like.submission_id) || [];
      list.push({ userId: like.user_id, nickname: names.get(like.user_id) || 'Reader' }); map.set(like.submission_id, list);
    }
    return map;
  }

  function songLikeMarkup(submissionId, likes) {
    const mine = likes.some(like => like.userId === authUser?.id), names = likes.map(like => like.nickname);
    return `<div class="song-like-row"><button class="outline song-like-button" type="button" data-song-like="${html(submissionId)}" data-liked="${mine}">${mine ? '♥ Liked' : '♡ Like'} · ${likes.length}</button><span class="song-like-names">${names.length ? html(names.join(', ')) : 'No likes yet'}</span></div>`;
  }

  function bindSongLikeButtons(container, refresh) {
    container.querySelectorAll('[data-song-like]').forEach(button => button.onclick = async () => {
      if (!signedIn()) return;
      button.disabled = true; const submissionId = button.dataset.songLike;
      const request = button.dataset.liked === 'true'
        ? supabaseClient.from('song_likes').delete().eq('submission_id', submissionId).eq('user_id', authUser.id)
        : supabaseClient.from('song_likes').insert({ submission_id: submissionId, user_id: authUser.id });
      const { error } = await request; button.disabled = false;
      if (error) return alert('Your song like could not be saved.');
      await refresh();
    });
  }

  async function renderHomePlaylist() {
    const feed = $('#homePlaylistFeed'); if (!feed) return;
    if (!signedIn()) { feed.innerHTML = '<p>Sign in to see the Book Club playlist.</p>'; return; }
    const { data, error } = await supabaseClient.from('reader_submissions').select('id,author_nickname,book_id,chapter_number,placement,title,artist,note,external_url,created_at').eq('kind', 'song').order('created_at', { ascending: false }).limit(40);
    if (error) { console.error('Homepage playlist failed:', error); feed.innerHTML = '<p>The playlist could not load.</p>'; return; }
    const likeMap = await loadSongLikeMap((data || []).map(item => item.id));
    feed.innerHTML = (data || []).map(item => {
      const context = item.placement === 'book-start' ? 'Opening playlist' : item.placement === 'book-end' ? 'Ending playlist' : `Chapter ${Number(item.chapter_number)}`;
      const title = item.external_url ? `<a href="${html(item.external_url)}" target="_blank" rel="noopener noreferrer">${html(item.title)}</a>` : `<b>${html(item.title)}</b>`;
      return `<article class="playlist-item"><small>${html(bookTitle(item.book_id))} · ${html(context)}</small><div>${title}${item.artist ? ` — ${html(item.artist)}` : ''}</div>${item.note ? `<p>${html(item.note)}</p>` : ''}<small>Suggested by ${html(item.author_nickname)}</small>${songLikeMarkup(item.id, likeMap.get(item.id) || [])}</article>`;
    }).join('') || '<p>No safe song recommendations have been added yet.</p>';
    bindSongLikeButtons(feed, renderHomePlaylist);
  }

  async function renderPersonalArchive() {
    const feed = $('#personalNotesFeed'); if (!feed) return;
    if (!signedIn()) { feed.innerHTML = '<p>Sign in to open your Personal Archive.</p>'; return; }
    const { data, error } = await supabaseClient.from('personal_notes').select('book_id,chapter_number,body,updated_at').eq('user_id', authUser.id).order('updated_at', { ascending: false }).limit(20);
    if (error) { console.error('Personal Archive failed:', error); feed.innerHTML = '<p>Your Personal Archive could not load.</p>'; return; }
    feed.innerHTML = (data || []).map(note => `<button type="button" class="personal-note-card" data-note-book="${html(note.book_id)}" data-note-chapter="${Number(note.chapter_number)}"><small>${html(bookTitle(note.book_id))}${note.chapter_number ? ` · Chapter ${Number(note.chapter_number)}` : ' · Book notes'}</small><p>${html(note.body.length > 220 ? `${note.body.slice(0, 217)}…` : note.body)}</p><small>Updated ${html(readableDate(note.updated_at))}</small></button>`).join('') || '<p>No notes yet. Open a book or chapter to begin your Personal Archive.</p>';
    feed.querySelectorAll('[data-note-book]').forEach(button => button.onclick = () => {
      const book = byId(button.dataset.noteBook); if (!book) return;
      currentBook = book; const chapter = Number(button.dataset.noteChapter);
      if (chapter > 0) { currentChapter = chapter; view('book'); renderBook(); setTimeout(() => document.querySelector('[data-tab="notesTab"]')?.click(), 0); }
      else { view('bookFront'); renderBookFront(); setTimeout(() => document.querySelector('[data-front-panel="frontNotesPanel"]')?.click(), 0); }
    });
  }

  async function renderPersonalNote(container, chapter, heading) {
    if (!container || !currentBook) return;
    if (!signedIn()) { container.innerHTML = '<p>Sign in to keep private notes.</p>'; return; }
    const { data, error } = await supabaseClient.from('personal_notes').select('body,updated_at').eq('user_id', authUser.id).eq('book_id', currentBook.id).eq('chapter_number', chapter).maybeSingle();
    if (error) { console.error('Personal note failed:', error); container.innerHTML = '<p>Your private note could not load.</p>'; return; }
    container.innerHTML = `<section class="personal-note-editor"><h3>${html(heading)}</h3><p class="fine-print">Private—only you can see this note. It also appears in My Personal Archive on your homepage.</p><textarea maxlength="8000" placeholder="Keep track of clues, questions, favorite moments, or anything you want to remember…">${html(data?.body || '')}</textarea><div class="note-actions"><button type="button" class="gold" data-save-note>Save private note</button>${data?.body ? '<button type="button" class="outline" data-delete-note>Delete note</button>' : ''}</div><p class="field-message" data-note-status></p></section>`;
    const textarea = container.querySelector('textarea'), status = container.querySelector('[data-note-status]');
    container.querySelector('[data-save-note]').onclick = async () => {
      const body = textarea.value.trim(); if (!body) { status.textContent = 'Write a note first, or use Delete note to remove it.'; return; }
      const { error: saveError } = await supabaseClient.from('personal_notes').upsert({ user_id: authUser.id, book_id: currentBook.id, chapter_number: chapter, body }, { onConflict: 'user_id,book_id,chapter_number' });
      status.textContent = saveError ? 'Your note could not be saved.' : 'Saved to your Personal Archive.';
      if (!saveError) await renderPersonalArchive();
    };
    container.querySelector('[data-delete-note]')?.addEventListener('click', async () => {
      const { error: deleteError } = await supabaseClient.from('personal_notes').delete().eq('user_id', authUser.id).eq('book_id', currentBook.id).eq('chapter_number', chapter);
      if (deleteError) { status.textContent = 'Your note could not be deleted.'; return; }
      await renderPersonalNote(container, chapter, heading); await renderPersonalArchive();
    });
  }

  function openArt(src) {
    $('#mapModalTitle').textContent = 'Reader artwork'; $('#mapModalImage').src = src; $('#mapModal').classList.remove('hidden');
  }

  async function renderTheories() {
    ensureTheoryBooks();
    const feed = $('#theoriesFeed'); if (!feed || !signedIn()) return;
    const { data, error } = await supabaseClient.from('reader_theories').select('id,author_nickname,title,body,book_id,chapter_number,created_at').order('created_at', { ascending: false }).limit(50);
    feed.innerHTML = error ? '<p>Theories could not load.</p>' : (data || []).map(item => `<article class="social-post"><small>READER THEORY · ${html(bookTitle(item.book_id))}, Chapter ${Number(item.chapter_number)}</small><h3>${html(item.title)}</h3><p>${html(item.body)}</p><small>By ${html(item.author_nickname)}</small></article>`).join('') || '<p>No unlocked reader theories yet.</p>';
  }

  async function postTheory(event) {
    event.preventDefault(); if (!signedIn()) return;
    const bookId = $('#theoryBook').value, chapter = Number($('#theoryChapter').value), book = byId(bookId);
    if (!book || chapter < 1 || chapter > book.chapters || completedThrough(book) < chapter) return alert('Choose a chapter you have already completed.');
    const payload = { author_id: authUser.id, author_nickname: state.profile.name, title: $('#theoryTitle').value.trim(), body: $('#theoryText').value.trim(), book_id: bookId, chapter_number: chapter };
    const { error } = await supabaseClient.from('reader_theories').insert(payload);
    if (error) return alert('The theory could not be saved.');
    event.currentTarget.reset(); await renderTheories();
  }

  async function askArchivist(event) {
    event.preventDefault(); const output = $('#archivistAnswer'), question = $('#archivistQuestion').value.trim(); if (!question) return;
    message(output, 'The Archivist is checking your unlocked shelves…', 'loading');
    if (!signedIn()) return message(output, 'Sign in so the Archivist can use your saved reading progress.', 'error');
    const { data: { session } } = await supabaseClient.auth.getSession();
    try {
      const response = await fetch('/.netlify/functions/archivist', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ question }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Archivist unavailable');
      output.innerHTML = `<p>${html(payload.answer)}</p>${payload.sources?.length ? `<small>Unlocked evidence: ${payload.sources.map(html).join(' · ')}</small>` : ''}`;
    } catch (error) {
      console.error('Archivist request failed:', error);
      const fallback = localArchivist(question);
      output.innerHTML = `<p>${html(fallback.answer)}</p>${fallback.sources.length ? `<small>Unlocked evidence: ${fallback.sources.map(html).join(' · ')}</small>` : ''}`;
    }
  }

  function localArchivist(question) {
    const words = question.toLowerCase().replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(word => word.length > 2 && !['what','who','where','when','does','did','the','and','again','about'].includes(word));
    const facts = [];
    for (const book of allBooks().filter(item => !item.upcoming)) {
      const through = completedThrough(book);
      for (const item of safeEntries(characters, book.id, through)) facts.push({ text: `${item.name}: ${item.bio}`, source: `${book.title}, through Chapter ${through}` });
      for (const item of safeEntries(places, book.id, through)) facts.push({ text: `${item.name}: ${item.bio}`, source: `${book.title}, through Chapter ${through}` });
    }
    for (const item of lore.filter(entry => entry.requires.every(requirementCompleted))) facts.push({ text: `${item.title}: ${item.summary}`, source: item.evidence?.join(', ') || 'Unlocked lore' });
    for (const item of connections.filter(entry => entry.requires.every(requirementCompleted))) facts.push({ text: `${item.title}: ${item.summary}`, source: item.evidence?.join(', ') || 'Unlocked connection' });
    const matches = facts.map(fact => ({ ...fact, score: words.reduce((sum, word) => sum + (fact.text.toLowerCase().includes(word) ? 1 : 0), 0) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    return matches.length ? { answer: matches.map(item => item.text).join(' '), sources: [...new Set(matches.map(item => item.source))] } : { answer: 'I cannot answer that safely from the information you have unlocked. Keep reading, or try asking about a character, place, or object you have already encountered.', sources: [] };
  }

  async function notifyMention(mentionId) {
    if (!signedIn()) return { ok: false, error: 'Sign in again and retry.' };
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return { ok: false, error: 'Your session expired. Sign in again.' };
    try {
      const response = await fetch('/.netlify/functions/notify-mention', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ mentionId }) });
      let payload = {}; try { payload = await response.json(); } catch {}
      if (!response.ok) {
        const error = payload.error || `Email service returned ${response.status}.`;
        console.error('Mention email rejected:', response.status, error);
        return { ok: false, error };
      }
      return { ok: payload.sent !== false, error: payload.reason || null };
    } catch (error) {
      console.error('Mention email could not be reached:', error);
      return { ok: false, error: 'The development email function could not be reached.' };
    }
  }

  function handleDeepLink() {
    if (!signedIn()) return;
    const params = new URLSearchParams(location.search), book = byId(params.get('book')), chapter = Number(params.get('chapter'));
    if (!book || !chapter || chapter > completedThrough(book)) return;
    currentBook = book; currentChapter = chapter; view('book'); renderBook(); history.replaceState({}, '', location.pathname);
  }

  const originalOpenArchivePane = window.openArchivePane || openArchivePane;
  window.openArchivePane = id => { originalOpenArchivePane(id); if (id === 'theoriesPanel') void renderTheories(); };
  // Existing tab handlers call the lexical function, so attach a direct listener for the new pane.
  document.querySelector('[data-archive="theoriesPanel"]')?.addEventListener('click', () => void renderTheories());

  window.ArchiveCommunity = {
    bind,
    renderHome,
    renderReaders,
    renderBookFront: renderBookFrontCommunity,
    renderChapter,
    renderTheories,
    notifyMention,
    handleDeepLink
  };
  bind();
})();
