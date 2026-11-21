import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';

const origin = process.env.TEST_ORIGIN ?? 'http://localhost:5173';

async function request(path, { body, cookie, form } = {}) {
  const headers = new Headers({ origin });
  if (cookie) headers.set('cookie', cookie);
  if (body) headers.set('content-type', 'application/json');
  if (form) headers.set('accept', 'text/html');

  return fetch(new URL(path, origin), {
    redirect: 'manual',
    method: body || form ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : form
  });
}

function sessionCookie(response) {
  const cookie = response.headers.getSetCookie().find((value) => /^(__Secure-)?better-auth\.session_token=/.test(value));
  assert.ok(cookie, 'Expected Better Auth to set a session token');
  assert.match(cookie, /;\s*HttpOnly(?:;|$)/i);
  assert.match(cookie, /;\s*SameSite=Lax(?:;|$)/i);
  return cookie.split(';', 1)[0];
}

test('registration, protected account, sign-out and sign-in', async () => {
  const credentials = {
    email: `integration-${randomUUID()}@example.com`,
    password: 'Ab2cd3'
  };

  const anonymous = await request('/account');
  assert.equal(anonymous.status, 303);
  assert.equal(anonymous.headers.get('location'), '/auth/sign-in');

  const registration = await request('/api/auth/sign-up/email', {
    body: { ...credentials, name: 'Integration User' }
  });
  assert.equal(registration.status, 200);
  const registrationCookie = sessionCookie(registration);

  const account = await request('/account', { cookie: registrationCookie });
  assert.equal(account.status, 200);
  assert.equal(account.headers.get('cache-control'), 'private, no-store');
  assert.match(await account.text(), /Integration User/);

  const signOut = await request('/account?/signOut', {
    cookie: registrationCookie,
    form: new URLSearchParams()
  });
  assert.equal(signOut.status, 303);
  assert.equal((await request('/account', { cookie: registrationCookie })).status, 303);

  const rejected = await request('/api/auth/sign-in/email', {
    body: { ...credentials, password: 'Wrong password for this account' }
  });
  assert.equal(rejected.status, 401);

  const signIn = await request('/api/auth/sign-in/email', { body: credentials });
  assert.equal(signIn.status, 200);
  const loginCookie = sessionCookie(signIn);
  assert.notEqual(loginCookie, registrationCookie);
  assert.equal((await request('/account', { cookie: loginCookie })).status, 200);
});

test('standard accounts cannot administer the platform or open another private workspace', async () => {
  async function register() {
    const email = `integration-${randomUUID()}@example.com`;
    const response = await request('/api/auth/sign-up/email', {
      body: {
        email,
        password: `Test-only-${randomUUID()}`,
        name: 'Workspace Integration User'
      }
    });
    assert.equal(response.status, 200);
    return { email, cookie: sessionCookie(response) };
  }

  const { cookie: owner } = await register();
  const { cookie: outsider, email: outsiderEmail } = await register();
  const slug = `integration-${randomUUID()}`;
  const form = new URLSearchParams({ name: 'Private Testing Workspace', slug });
  assert.equal((await request('/admin', { cookie: owner })).status, 403);
  assert.equal((await request('/admin?/save', { cookie: owner, form })).status, 403);
  assert.equal((await request('/admin/email', { cookie: owner })).status, 403);
  assert.equal((await request('/admin/email?/save', { cookie: owner, form })).status, 403);

  const created = await request('/workspaces?/create', { cookie: owner, form });
  assert.equal(created.status, 303);
  assert.equal(created.headers.get('location'), `/workspaces/${slug}`);
  const workspace = await request(`/workspaces/${slug}`, { cookie: owner });
  assert.equal(workspace.status, 200);
  assert.match(await workspace.text(), /Private Testing Workspace/);
  assert.equal((await request(`/workspaces/${slug}`, { cookie: outsider })).status, 404);
  const feedback = new URLSearchParams({ title: 'Add export support', description: 'Export our feedback as CSV.' });
  assert.equal((await request(`/workspaces/${slug}?/submit`, { cookie: outsider, form: feedback })).status, 404);
  assert.equal((await request(`/workspaces/${slug}?/submit`, {
    cookie: owner, form: new URLSearchParams({ title: 'ab', description: '' })
  })).status, 400);
  assert.equal((await request(`/workspaces/${slug}?/submit`, { cookie: owner, form: feedback })).status, 303);
  const board = await request(`/workspaces/${slug}`, { cookie: owner });
  const markup = await board.text();
  assert.match(markup, /Add export support/);
  const detail = markup.match(/href="([^"]+\/feedback\/[a-f0-9-]+)"/)?.[1];
  assert.ok(detail);
  const vote = (intent, cookie = owner) => request(`${detail}?/vote`, {
    cookie, form: new URLSearchParams({ intent })
  });
  assert.equal((await vote('add', outsider)).status, 404);
  const duplicateVotes = await Promise.all([vote('add'), vote('add')]);
  assert.deepEqual(duplicateVotes.map((response) => response.status), [303, 303]);
  assert.match(await (await request(detail, { cookie: owner })).text(), /1 vote<\/p>/);
  assert.equal((await vote('remove')).status, 303);
  assert.match(await (await request(detail, { cookie: owner })).text(), /0 votes<\/p>/);
  const comment = await request(`${detail}?/comment`, {
    cookie: owner, form: new URLSearchParams({ body: 'This will help our reporting workflow.' })
  });
  assert.equal(comment.status, 303);
  assert.match(await (await request(detail, { cookie: owner })).text(), /This will help our reporting workflow/);

  const otherSlug = `integration-${randomUUID()}`;
  const other = await request('/workspaces?/create', {
    cookie: owner, form: new URLSearchParams({ name: 'Second Workspace', slug: otherSlug })
  });
  assert.equal(other.status, 303);
  const otherBoard = await request(`/workspaces/${otherSlug}`, { cookie: owner });
  assert.equal(otherBoard.status, 200);
  assert.doesNotMatch(await otherBoard.text(), /Add export support/);
  assert.equal((await request(detail.replace(slug, otherSlug), { cookie: owner })).status, 404);

  const membersUrl = `/workspaces/${slug}/members`;
  const adding = new URLSearchParams({ email: outsiderEmail, role: 'viewer' });
  assert.equal((await request(`${membersUrl}?/add`, { cookie: outsider, form: adding })).status, 404);
  assert.equal((await request(`${membersUrl}?/add`, { cookie: owner, form: adding })).status, 200);
  assert.equal((await request(detail, { cookie: outsider })).status, 200);
  assert.equal((await vote('add', outsider)).status, 403);
  assert.equal((await request(`/workspaces/${slug}?/submit`, { cookie: outsider, form: feedback })).status, 403);
  assert.equal((await request(membersUrl, { cookie: outsider })).status, 403);

  const statuses = `/workspaces/${slug}/statuses`;
  const newStatus = new URLSearchParams({ name: 'In review' });
  assert.equal((await request(`${statuses}?/create`, { cookie: outsider, form: newStatus })).status, 403);
  assert.equal((await request(`${statuses}?/create`, { cookie: owner, form: newStatus })).status, 200);
  const statusMarkup = await (await request(detail, { cookie: owner })).text();
  const status = statusMarkup.match(/<option value="([a-f0-9-]+)"[^>]*>In review<\/option>/)?.[1];
  assert.ok(status);
  const transition = new URLSearchParams({ status });
  assert.equal((await request(`${detail}?/status`, { cookie: outsider, form: transition })).status, 403);
  assert.equal((await request(`${detail}?/status`, { cookie: owner, form: transition })).status, 303);
  assert.match(await (await request(detail, { cookie: outsider })).text(), /Status: In review/);

  const products = `/workspaces/${slug}/products`;
  const newProduct = new URLSearchParams({ name: 'Reporting Suite', slug: 'reporting', description: '' });
  assert.equal((await request(`${products}?/save`, { cookie: outsider, form: newProduct })).status, 403);
  assert.equal((await request(`${products}?/save`, { cookie: owner, form: newProduct })).status, 200);
  const productMarkup = await (await request(`/workspaces/${slug}`, { cookie: owner })).text();
  const product = productMarkup.match(/<option value="([a-f0-9-]+)"[^>]*>Reporting Suite<\/option>/)?.[1];
  assert.ok(product);
  const productFeedback = new URLSearchParams({ title: 'Improve chart labels', description: 'Use clearer labels.', product });
  assert.equal((await request(`/workspaces/${otherSlug}?/submit`, { cookie: owner, form: productFeedback })).status, 400);
  assert.equal((await request(`/workspaces/${slug}?/submit`, { cookie: owner, form: productFeedback })).status, 303);
  const searched = await (await request(`/workspaces/${slug}?q=chart`, { cookie: owner })).text();
  assert.match(searched, /Improve chart labels/);
  assert.doesNotMatch(searched, /Add export support/);

  const analytics = `/workspaces/${slug}/analytics?days=7`;
  assert.equal((await request(analytics, { cookie: outsider })).status, 403);
  const report = await request(analytics, { cookie: owner });
  assert.equal(report.status, 200);
  const metrics = await report.text();
  assert.match(metrics, /2 submissions in the selected range/);
  assert.match(metrics, /0 votes from 0 people and 1 comments/);
  const publicBoard = `/boards/${slug}`;
  const visibility = (value, cookie = owner) => request(`/workspaces/${slug}?/visibility`, {
    cookie, form: new URLSearchParams({ visibility: value })
  });
  assert.equal((await request(publicBoard)).status, 404);
  assert.equal((await visibility('public', outsider)).status, 403);
  assert.equal((await visibility('public')).status, 303);
  const published = await request(publicBoard);
  assert.equal(published.status, 200);
  assert.doesNotMatch(await published.text(), /Add export support/);
  const publish = (cookie) => request(`${detail}?/publish`, {
    cookie, form: new URLSearchParams({ intent: 'publish' })
  });
  assert.equal((await publish(outsider)).status, 403);
  assert.equal((await publish(owner)).status, 303);
  const publicMarkup = await (await request(publicBoard)).text();
  assert.match(publicMarkup, /Add export support/);
  assert.doesNotMatch(publicMarkup, /Improve chart labels/);
  const publishedItem = publicMarkup.match(/href="([^"]+\/feedback\/[a-f0-9-]+)"/)?.[1];
  assert.ok(publishedItem);
  assert.equal((await request(publishedItem)).status, 200);
  assert.match(await (await request(publishedItem)).text(), /In review/);
  assert.match(await (await request(`${publicBoard}?q=export&sort=popular`)).text(), /Add export support/);
  assert.doesNotMatch(await (await request(`${publicBoard}?q=missing`)).text(), /Add export support/);
  const privateItem = (await request(`/workspaces/${slug}?q=chart`, { cookie: owner }));
  const privateLink = (await privateItem.text()).match(/href="([^"]+\/feedback\/[a-f0-9-]+)"/)?.[1];
  assert.ok(privateLink);
  assert.equal((await request(privateLink.replace('/workspaces/', '/boards/'))).status, 404);

  const changelog = `/workspaces/${slug}/publish/changelog`;
  const publicChangelog = `${publicBoard}/updates/changelog`;
  const publishUpdate = (title, status, scheduled = '', cookie = owner) => request(`${changelog}?/save`, {
    cookie, form: new URLSearchParams({ title, status, scheduled, body: 'Details about this release.' })
  });
  assert.equal((await publishUpdate('Unauthorized update', 'published', '', outsider)).status, 403);
  assert.equal((await publishUpdate('Internal release draft', 'draft')).status, 303);
  assert.equal((await publishUpdate('Future release', 'published', '2099-01-01T00:00')).status, 303);
  assert.equal((await publishUpdate('Public release', 'published')).status, 303);
  const releases = await request(publicChangelog);
  assert.equal(releases.status, 200);
  const releaseMarkup = await releases.text();
  assert.match(releaseMarkup, /Public release/);
  assert.doesNotMatch(releaseMarkup, /Internal release draft|Future release/);
  assert.equal((await visibility('private')).status, 303);
  assert.equal((await request(publicBoard)).status, 404);
  assert.equal((await request(publicChangelog)).status, 404);
  assert.equal((await request(publishedItem)).status, 404);
  const roster = await (await request(membersUrl, { cookie: owner })).text();
  const memberId = roster.match(/name="userId" value="([^"]+)"/)?.[1];
  assert.ok(memberId);
  const promote = await request(`${membersUrl}?/update`, {
    cookie: owner, form: new URLSearchParams({ userId: memberId, role: 'member' })
  });
  assert.equal(promote.status, 200);
  const reply = await request(`${detail}?/comment`, {
    cookie: outsider, form: new URLSearchParams({ body: 'I would use this every week.' })
  });
  assert.equal(reply.status, 303);
  const inbox = await request('/notifications', { cookie: owner });
  const inboxMarkup = await inbox.text();
  assert.match(inboxMarkup, /New comment on/);
  assert.match(inboxMarkup, /Unread/);
  assert.doesNotMatch(await (await request('/notifications', { cookie: outsider })).text(), /New comment on/);
  const read = await request('/notifications?/readAll', { cookie: owner, form: new URLSearchParams() });
  assert.equal(read.status, 303);
  assert.doesNotMatch(await (await request('/notifications', { cookie: owner })).text(), /Unread/);

  const keys = `/workspaces/${slug}/api-keys`;
  const keyForm = new URLSearchParams({ name: 'Reporting read key', scope: 'read' });
  assert.equal((await request(`${keys}?/create`, { cookie: outsider, form: keyForm })).status, 403);
  const keyCreated = await request(`${keys}?/create`, { cookie: owner, form: keyForm });
  assert.equal(keyCreated.status, 200);
  const keyValue = (await keyCreated.text()).match(/<code>(fh_[A-Za-z0-9_-]{43})<\/code>/)?.[1];
  assert.ok(keyValue);
  const keysMarkup = await (await request(keys, { cookie: owner })).text();
  assert.ok(!keysMarkup.includes(keyValue));
  const keyId = keysMarkup.match(/name="id" value="([^"]+)"/)?.[1];
  assert.ok(keyId);
  const apiUrl = new URL('/api/v1/feedback', origin);
  assert.equal((await fetch(apiUrl)).status, 401);
  const headers = { authorization: `Bearer ${keyValue}`, 'content-type': 'application/json' };
  const listed = await fetch(apiUrl, { headers });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).data.length, 2);
  const denied = await fetch(apiUrl, {
    method: 'POST', headers, body: JSON.stringify({ title: 'API feedback', description: 'Read-only key.' })
  });
  assert.equal(denied.status, 403);
  assert.equal((await request(`${keys}?/revoke`, {
    cookie: owner, form: new URLSearchParams({ id: keyId })
  })).status, 200);
  assert.equal((await fetch(apiUrl, { headers })).status, 401);

  const discussion = await (await request(detail, { cookie: outsider })).text();
  const ownComment = discussion.match(/name="commentId" value="([^"]+)"/)?.[1];
  assert.ok(ownComment);
  const edit = new URLSearchParams({ commentId: ownComment, body: 'Updated reporting feedback.' });
  assert.equal((await request(`${detail}?/editComment`, { cookie: owner, form: edit })).status, 403);
  assert.equal((await request(`${detail}?/editComment`, { cookie: outsider, form: edit })).status, 303);
  assert.match(await (await request(detail, { cookie: owner })).text(), /Updated reporting feedback/);
  assert.equal((await request(`${detail}?/removeComment`, {
    cookie: owner, form: new URLSearchParams({ commentId: ownComment })
  })).status, 303);
  assert.doesNotMatch(await (await request(detail, { cookie: outsider })).text(), /Updated reporting feedback/);

  const editProduct = new URLSearchParams({ id: product, name: 'Reporting Tools', slug: 'reporting', description: '' });
  assert.equal((await request(`${products}?/save`, { cookie: owner, form: editProduct })).status, 200);
  assert.match(await (await request(products, { cookie: owner })).text(), /Reporting Tools/);
  const changeProduct = (intent) => request(`${products}?/archive`, {
    cookie: owner, form: new URLSearchParams({ id: product, intent })
  });
  assert.equal((await changeProduct('archive')).status, 200);
  assert.equal((await request(`/workspaces/${slug}?/submit`, { cookie: owner, form: productFeedback })).status, 400);
  const archivedBoard = await (await request(`/workspaces/${slug}?product=${product}`, { cookie: owner })).text();
  assert.match(archivedBoard, /Improve chart labels/);
  assert.equal((await changeProduct('restore')).status, 200);
  assert.equal((await request(`/workspaces/${slug}?/submit`, { cookie: owner, form: productFeedback })).status, 303);

  const invitation = await request(`/workspaces/${otherSlug}/members?/invite`, {
    cookie: owner, form: new URLSearchParams({ email: outsiderEmail, role: 'viewer' })
  });
  assert.equal(invitation.status, 200);
  const inviteLink = (await invitation.text()).match(/href="(\/invite\/[A-Za-z0-9_-]{43})"/)?.[1];
  assert.ok(inviteLink);
  assert.equal((await request(inviteLink)).status, 200);
  assert.equal((await request(`${inviteLink}?/accept`, { cookie: owner, form: new URLSearchParams() })).status, 403);
  assert.equal((await request(`${inviteLink}?/accept`, { cookie: outsider, form: new URLSearchParams() })).status, 303);
  assert.equal((await request(`${inviteLink}?/accept`, { cookie: outsider, form: new URLSearchParams() })).status, 404);
  assert.equal((await request(`/workspaces/${otherSlug}`, { cookie: outsider })).status, 200);

  const exportPath = `/workspaces/${slug}/analytics/export`;
  assert.equal((await request(exportPath, { cookie: outsider })).status, 403);
  const cell = new URLSearchParams({ title: '=1+2', description: 'Quotes, "commas", and newline\nare escaped.' });
  assert.equal((await request(`/workspaces/${slug}?/submit`, { cookie: owner, form: cell })).status, 303);
  const exported = await request(exportPath, { cookie: owner });
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get('content-disposition'), /attachment/);
  const csv = await exported.text();
  assert.ok(csv.includes(`"'=1+2"`));
  assert.ok(csv.includes(`"Quotes, ""commas"", and newline\nare escaped."`));

  const widgetSettings = `/workspaces/${slug}/widget`;
  const enabled = new URLSearchParams({ origins: 'https://example.com', enabled: 'on' });
  assert.equal((await request(`${widgetSettings}?/save`, { cookie: outsider, form: enabled })).status, 403);
  assert.equal((await request(`${widgetSettings}?/save`, { cookie: owner, form: enabled })).status, 303);
  const widgetSettingsMarkup = await (await request(widgetSettings, { cookie: owner })).text();
  const widget = widgetSettingsMarkup.match(/href="[^"]*(\/widgets\/[a-f0-9-]+)"/)?.[1];
  assert.ok(widget);
  const widgetPage = await request(widget);
  assert.equal(widgetPage.status, 200);
  assert.equal(widgetPage.headers.get('content-security-policy'), "frame-ancestors 'self' https://example.com");
  assert.equal((await request(widget, {
    form: new URLSearchParams({ title: 'Widget submission', description: 'Sent on an embedded form.' })
  })).status, 303);
  assert.match(await (await request(`/workspaces/${slug}`, { cookie: owner })).text(), /Widget submission/);
  assert.equal((await request(`${widgetSettings}?/save`, {
    cookie: owner, form: new URLSearchParams({ origins: 'https://example.com' })
  })).status, 303);
  assert.equal((await request(widget)).status, 404);

});

test('registration links to public legal pages and only admins may edit them', async () => {
  const signup = await request('/auth/register');
  assert.equal(signup.status, 200);
  const markup = await signup.text();
  assert.match(markup, /href="\/terms"[^>]*>Terms of Service/);
  assert.match(markup, /href="\/privacy"[^>]*>Privacy Policy/);

  for (const [path, title] of [['/terms', 'Terms of Service'], ['/privacy', 'Privacy Policy']]) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.match(await response.text(), new RegExp(`<h1[^>]*>${title}</h1>`));
  }
  assert.equal((await request('/admin/legal')).status, 303);
});
