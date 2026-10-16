// Classic script: sandboxed opaque frames cannot load same-origin ES modules
// without an explicit CORS allowance. No such allowance is needed here.
(() => {
  let config;
  addEventListener('message', event => {
    if (config || event.source !== parent || event.origin !== location.origin ||
        event.data?.channel !== 'goatville.guest.v1' || event.data.type !== 'init') return;
    const m = event.data;
    if (m.attraction !== 'integration-test' || m.version !== 1 || !/^[a-f0-9]{32}$/.test(m.session)) return;
    config = Object.freeze({channel:m.channel, session:m.session, attraction:m.attraction, version:m.version});
    document.getElementById('complete').disabled = false;
  });
  document.getElementById('complete').addEventListener('click', () => {
    if (!config) return;
    parent.postMessage({...config, sequence:1, type:'achievement', achievement:'first-test'}, location.origin);
    document.getElementById('complete').disabled = true;
    document.getElementById('result').textContent = 'Test complete. Guest stamps have no competition value.';
  });
})();
