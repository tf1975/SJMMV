const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ikvwfkmyyynyicxqqqlf.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_RnPfgxV1K7HBLaFLfzoSLg_K-fOMyGO';
const SITE_URL = (process.env.SITE_URL || 'https://thechapterarchive.com').replace(/\/$/, '');
const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
const bearer = headers => String(headers.authorization || '').replace(/^Bearer\s+/i, '');
const clean = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const token = bearer(event.headers), serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY, resendKey = process.env.RESEND_API_KEY;
  if (!token) return json(401, { error: 'Authentication required.' });
  if (!serviceKey || !resendKey || !process.env.RESEND_FROM_EMAIL) return json(503, { error: 'Mention email delivery is not configured.' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid request.' }); }
  const mentionId = String(body.mentionId || ''); if (!/^[0-9a-f-]{36}$/i.test(mentionId)) return json(400, { error: 'Invalid mention.' });

  const authHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
  if (!userResponse.ok) return json(401, { error: 'Session expired.' });
  const requester = await userResponse.json();
  const adminHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const mentionResponse = await fetch(`${SUPABASE_URL}/rest/v1/mentions?id=eq.${encodeURIComponent(mentionId)}&select=id,post_id,mentioned_user_id,email_sent_at`, { headers: adminHeaders });
  const mention = (await mentionResponse.json())[0];
  if (!mention) return json(404, { error: 'Mention not found.' });
  if (mention.email_sent_at) return json(200, { sent: true, duplicate: true });
  const postResponse = await fetch(`${SUPABASE_URL}/rest/v1/chapter_posts?id=eq.${encodeURIComponent(mention.post_id)}&select=id,author_id,author_nickname,book_id,chapter_number,body`, { headers: adminHeaders });
  const post = (await postResponse.json())[0];
  if (!post || post.author_id !== requester.id) return json(403, { error: 'Only the post author can send this notice.' });
  const recipientResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${mention.mentioned_user_id}`, { headers: adminHeaders });
  if (!recipientResponse.ok) return json(404, { error: 'Mentioned reader not found.' });
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
  if (!sendResponse.ok) return json(502, { error: 'Email provider rejected the message.' });
  await fetch(`${SUPABASE_URL}/rest/v1/mentions?id=eq.${encodeURIComponent(mention.id)}`, { method: 'PATCH', headers: { ...adminHeaders, Prefer: 'return=minimal' }, body: JSON.stringify({ email_sent_at: new Date().toISOString() }) });
  return json(200, { sent: true });
}
