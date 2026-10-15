let token = ''; const $ = s => document.querySelector(s);
async function send(path, body) {
  const res = await fetch('/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const result = await res.json(); $('#result').textContent = JSON.stringify(result, null, 2);
  if (!res.ok) throw new Error(result.error); return result;
}
$('#account').addEventListener('submit', async event => {
  event.preventDefault();
  try { const result = await send('auth/' + event.submitter.value, { email: $('#email').value, password: $('#password').value, display_name: $('#name').value || undefined });
    if (result.access_token) token = result.access_token;
    $('#password').value = '';
  } catch (err) { $('#result').textContent = err.message; }
});
$('#execute').addEventListener('click', async () => { try { await send($('#endpoint').value, JSON.parse($('#payload').value)); } catch(err) { $('#result').textContent = err.message; } });
$('#logout').addEventListener('click', async () => { try { await send('auth/logout', {}); } finally { token=''; $('#result').textContent='Signed out'; } });
