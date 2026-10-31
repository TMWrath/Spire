(() => {
  if (window.__spireDownloadInstalled || !window.SpireDownloads) return;
  window.__spireDownloadInstalled = true;
  window.__spireExport = async (url, name) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      if (blob.size > 33554432) throw new Error('Download too large');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      SpireDownloads.postMessage(JSON.stringify({name: name || 'download', mime: blob.type, data}));
    } catch (_) {
      SpireDownloads.postMessage(JSON.stringify({error: true}));
    }
  };
  // Spire exports using a detached anchor; document event capture alone misses it.
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.href.startsWith('blob:')) { window.__spireExport(this.href, this.download); return; }
    return click.call(this);
  };
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('a');
    if (anchor && anchor.href.startsWith('blob:')) {
      event.preventDefault();
      window.__spireExport(anchor.href, anchor.download);
    }
  }, true);
})();
