const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikvwfkmyyynyicxqqqlf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_RnPfgxV1K7HBLaFLfzoSLg_K-fOMyGO';
const SITE_URL = (process.env.SITE_URL || 'https://thechapterarchive.com').replace(/\/$/, '');
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const bearer = headers => String(headers.authorization || '').replace(/^Bearer\s+/i, '');
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const fail = (statusCode, error, detail) => { console.error('[notify-mention]', error, detail || ''); return json(statusCode, { error }); };
const adminHeadersFor = key => {
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  // Legacy service_role keys are JWTs and can be used as the bearer token. New
  // sb_secret keys authenticate through the apikey header and must not be sent
  // as a bearer token.
  if (String(key).split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  return headers;
};

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const token = bearer(event.headers), serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, resendKey = process.env.RESEND_API_KEY;
  if (!token) return fail(401, 'Authentication required.');
  const missing = [['SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY', serviceKey], ['RESEND_API_KEY', resendKey], ['RESEND_FROM_EMAIL', process.env.RESEND_FROM_EMAIL]].filter(([,value]) => !value).map(([name]) => name);
  if (missing.length) return fail(503, `Development email configuration is missing: ${missing.join(', ')}.`);
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'Invalid request.'); }
  const mentionId = String(body.mentionId || ''); if (!/^[0-9a-f-]{36}$/i.test(mentionId)) return fail(400, 'Invalid mention.');

  const authHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
  if (!userResponse.ok) return fail(401, 'Session expired.', `Supabase auth returned ${userResponse.status}`);
  const requester = await userResponse.json();
  const adminHeaders = adminHeadersFor(serviceKey);
  const mentionResponse = await fetch(`${SUPABASE_URL}/rest/v1/mentions?id=eq.${encodeURIComponent(mentionId)}&select=id,post_id,mentioned_user_id,email_sent_at`, { headers: adminHeaders });
  const mention = (await mentionResponse.json())[0];
  if (!mention) return fail(404, 'Mention not found.');
  if (mention.email_sent_at) return json(200, { sent: true, duplicate: true });
  const postResponse = await fetch(`${SUPABASE_URL}/rest/v1/chapter_posts?id=eq.${encodeURIComponent(mention.post_id)}&select=id,author_id,author_nickname,book_id,chapter_number,body`, { headers: adminHeaders });
  const post = (await postResponse.json())[0];
  if (!post || post.author_id !== requester.id) return fail(403, 'Only the post author can send this notice.');
  const recipientResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${mention.mentioned_user_id}`, { headers: adminHeaders });
  if (!recipientResponse.ok) return fail(404, 'Mentioned reader not found.', `Supabase admin returned ${recipientResponse.status}`);
  const recipient = await recipientResponse.json();
  if (!recipient.email) return json(200, { sent: false, reason: 'No email address.' });
  let chapterIsSafe = false;
  if (post.book_id === 'tandem') {
    const settingsResponse = await fetch(`${SUPABASE_URL}/rest/v1/user_book_settings?user_id=eq.${encodeURIComponent(mention.mentioned_user_id)}&book_id=eq.tog-plan&select=ui_preferences`, { headers: adminHeaders });
    const settings = (await settingsResponse.json())[0];
    chapterIsSafe = Number(settings?.ui_preferences?.tandemStep || 0) >= Number(post.chapter_number);
  } else {
    const progressResponse = await fetch(`${SUPABASE_URL}/rest/v1/reading_progress?user_id=eq.${encodeURIComponent(mention.mentioned_user_id)}&book_id=eq.${encodeURIComponent(post.book_id)}&select=current_chapter,reading_status`, { headers: adminHeaders });
    const recipientProgress = (await progressResponse.json())[0];
    chapterIsSafe = !!recipientProgress && (recipientProgress.reading_status === 'finished' || (recipientProgress.reading_status === 'reading' && Number(recipientProgress.current_chapter) > Number(post.chapter_number)));
  }
  const link = `${SITE_URL}/?book=${encodeURIComponent(post.book_id)}&chapter=${Number(post.chapter_number)}&mention=${encodeURIComponent(mention.id)}`;
  const excerpt = post.body.length > 280 ? `${post.body.slice(0, 277)}…` : post.body;
  const notice = chapterIsSafe
    ? `<p><strong>${clean(post.author_nickname)}</strong> mentioned you in a chapter discussion:</p><blockquote style="border-left:3px solid #b78b3c;padding-left:16px">${clean(excerpt)}</blockquote><p><a href="${clean(link)}" style="display:inline-block;background:#b78b3c;color:#17120a;padding:12px 18px;border-radius:9px;text-decoration:none;font-weight:bold">Open the spoiler-safe discussion</a></p>`
    : `<p><strong>${clean(post.author_nickname)}</strong> mentioned you in a chapter you have not finished yet.</p><p>The message is hidden to protect you from spoilers. It will become available in The Archive after you complete that chapter.</p>`;
  const sendResponse = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [recipient.email], subject: `${post.author_nickname} mentioned you in The Archive`, html: `<div style="font-family:Georgia,serif;max-width:600px;margin:auto;color:#251e15"><h1>The Archive</h1>${notice}<p style="font-size:12px;color:#6f6659">The Archive checks your saved reading progress before revealing chapter discussions.</p></div>` }) });
  if (!sendResponse.ok) return fail(502, 'Email provider rejected the message.', `${sendResponse.status}: ${(await sendResponse.text()).slice(0,500)}`);
  await fetch(`${SUPABASE_URL}/rest/v1/mentions?id=eq.${encodeURIComponent(mention.id)}`, { method: 'PATCH', headers: { ...adminHeaders, Prefer: 'return=minimal' }, body: JSON.stringify({ email_sent_at: new Date().toISOString() }) });
  return json(200, { sent: true });
}
