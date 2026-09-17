import * as bitty from './bitty.js';

window.bitty = bitty;

var QS = document.querySelector.bind(document);
var QSS = document.querySelectorAll.bind(document);

var DATA_PREFIX = "data:text/html;base64,";
var DATA_PREFIX_8 = "data:text/html;charset=utf-8;base64,";
var DATA_PREFIX_BXZE = "data:text/html;charset=utf-8;bxze64,";
var DATA_PREFIX_GZIP = "data:text/html;charset=utf-8;gzip64,";


var b = document.documentElement.setAttribute(
  "data-useragent",
  navigator.userAgent
);

// Apply saved theme or system preference immediately to prevent flash
try {
  let initialTheme = getActiveTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.style.colorScheme = initialTheme;
} catch (e) {}

var bindings = {}
var hasHljs = typeof hljs !== 'undefined' || typeof window.hljs !== 'undefined';
var quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    syntax: hasHljs ? { hljs: window.hljs || hljs } : false,
    keyboard: { bindings },
    toolbar: "#formatbar"
  }
});

quill.on('text-change', function(delta, oldDelta, source) {
  if (source == 'api') {
    console.debug("An API call triggered this change.");
  } else if (source == 'user') {
    console.debug("A user action triggered this change.", source);
  }
  handleContentChange();
});
quill.setSelection(0, Infinity);

var editor = quill.root;
editor.autocomplete="off";
var importedFileData = undefined;

var content = editor;
window.onload = async function() {
  window.onpopstate = function(e) {
    setContent(e.state);
  };
  window.onhashchange = function(e) {
    console.log("hash", e);
    location.reload();
  };
  document.body.onclick = function(e) {
    if (e.target == document.body) editor.focus();
  };
  content = document.getElementById("content");

  let lastTarget;
  window.addEventListener("dragenter", function(e){ // drag start
    console.log("enter", e.target)
    document.body.classList.toggle("dragging", true);
    lastTarget = e.target; // cache the last target here
  });

  window.addEventListener("dragleave", function (e) { // user canceled
    console.log("exit ", e.target)
    if(e.target === lastTarget || e.target === document) {
      document.body.classList.toggle("dragging", false);
    }
  });


  if (localStorage.getItem("preview")) {
    togglePreview(true)
  }
  // content.addEventListener("keydown", handleKey);
  // content.addEventListener("keyup", handleInput);
  QS("#doc-title").addEventListener("keyup", handleInput);
  Array.from(document.getElementsByTagName("input")).forEach(i => i.addEventListener("keydown", handleInput))
  document.getElementById("md-include").addEventListener("change", handleMetadataCheckbox);

  document.getElementById("drop-zone").addEventListener("drop", handleDrop);
  document.getElementById("drop-zone").addEventListener("dragover", e => e.preventDefault());
  editor.addEventListener("paste", handlePaste);
  // content.contentEditable = "true";
  editor.focus();
  // document.execCommand("selectAll", false, null);
  if (QS("#qrcode")) QS("#qrcode").onclick = makeQRCode;
  if (QS("#upload")) QS("#upload").onclick = upload;
  if (QS("#share")) {
    QS("#share").onclick = share;
    if (!navigator.share) QS("#share").style.display = "none";
  }
  if (QS("#twitter")) QS("#twitter").onclick = tweetLink;
  if (QS("#copy")) QS("#copy").onclick = copyLink;
  if (QS("#preview")) QS("#preview").onclick = togglePreview;
  if (QS("#format-toggle")) QS("#format-toggle").onclick = toggleFormat;
  
  // Tools menu dropdown toggle
  let toolsBtn = QS("#tools-menu-btn");
  let toolsWrap = QS("#tools-dropdown-wrap");
  let toolsDropdown = QS("#tools-menu-dropdown");

  function closeToolsDropdown() {
    if (toolsWrap) toolsWrap.classList.remove("open");
    if (toolsDropdown) toolsDropdown.classList.remove("show");
    if (toolsBtn) toolsBtn.setAttribute("aria-expanded", "false");
  }

  function toggleToolsDropdown() {
    let isOpen = toolsWrap?.classList.contains("open") || toolsDropdown?.classList.contains("show");
    if (isOpen) {
      closeToolsDropdown();
    } else {
      let recentPop = QS("#recent-popover");
      if (recentPop) recentPop.style.display = "none";
      if (toolsWrap) toolsWrap.classList.add("open");
      if (toolsDropdown) toolsDropdown.classList.add("show");
      if (toolsBtn) toolsBtn.setAttribute("aria-expanded", "true");
    }
  }

  if (toolsBtn) {
    toolsBtn.onclick = (e) => {
      e.stopPropagation();
      toggleToolsDropdown();
    };
  }

  if (QS("#format-code-btn")) {
    QS("#format-code-btn").onclick = () => {
      closeToolsDropdown();
      let formatted = formatEditorCode();
      showToast(formatted ? "Code auto-indented!" : "Code already cleanly indented");
    };
  }
  if (QS("#preview-toggle-btn")) QS("#preview-toggle-btn").onclick = () => togglePreview();
  if (QS("#qr-btn")) {
    QS("#qr-btn").onclick = () => {
      closeToolsDropdown();
      showQRCodeModal();
    };
  }
  if (QS("#qr-modal-close")) QS("#qr-modal-close").onclick = () => QS("#qr-modal")?.close();
  if (QS("#qr-modal")) {
    QS("#qr-modal").onclick = (e) => {
      if (e.target === QS("#qr-modal")) QS("#qr-modal").close();
    };
  }
  if (QS("#qr-copy-btn")) {
    QS("#qr-copy-btn").onclick = () => {
      copyLink();
      let btn = QS("#qr-copy-btn");
      let prevText = btn.innerText;
      btn.innerText = "Copied!";
      setTimeout(() => { btn.innerText = prevText; }, 1800);
    };
  }

  // Templates modal events
  if (QS("#templates-btn")) {
    QS("#templates-btn").onclick = () => {
      closeToolsDropdown();
      QS("#templates-modal")?.showModal();
    };
  }
  if (QS("#templates-modal-close")) {
    QS("#templates-modal-close").onclick = () => {
      QS("#templates-modal")?.close();
    };
  }
  if (QS("#templates-modal")) {
    QS("#templates-modal").onclick = (e) => {
      if (e.target === QS("#templates-modal")) QS("#templates-modal").close();
    };
  }
  QSS(".template-card").forEach(card => {
    card.onclick = () => insertTemplate(card.dataset.template);
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        insertTemplate(card.dataset.template);
      }
    };
  });

  // Font selector dropdown
  let fontSelect = QS("#preview-font-select");
  if (fontSelect) {
    let savedFont = localStorage.getItem('bitty_preview_font');
    if (savedFont && ['sans-serif', 'serif', 'monospace'].includes(savedFont)) {
      fontSelect.value = savedFont;
    }
    fontSelect.onchange = () => {
      let val = fontSelect.value;
      localStorage.setItem('bitty_preview_font', val);
      applyPreviewFont(val);
      showToast(`Preview font: ${val}`);
    };
  }

  // Preview frame load handler to apply font, theme & sync overlay
  let previewFrame = QS("#preview-frame");
  if (previewFrame) {
    previewFrame.addEventListener("load", () => {
      applyPreviewFont();
      applyPreviewTheme();
      updatePreviewOverlay();
    });
  }

  // Theme switcher button
  let themeBtn = QS("#theme-btn");
  if (themeBtn) {
    themeBtn.onclick = () => {
      toggleTheme();
    };
  }
  applyTheme(getActiveTheme(), false);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      let saved = localStorage.getItem('bitty_theme');
      if (!saved) {
        applyTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }

  if (QS("#recent-btn")) {
    QS("#recent-btn").onclick = (e) => {
      e.stopPropagation();
      closeToolsDropdown();
      toggleRecentPopover();
    };
  }
  if (QS("#clear-recent-btn")) {
    QS("#clear-recent-btn").onclick = (e) => {
      e.stopPropagation();
      localStorage.removeItem(RECENT_STORAGE_KEY);
      renderRecentList();
      showToast("Recent history cleared");
    };
  }

  document.addEventListener("click", (e) => {
    if (toolsWrap && !toolsWrap.contains(e.target)) {
      closeToolsDropdown();
    }
    let popover = QS("#recent-popover");
    let recentBtn = QS("#recent-btn");
    if (popover && popover.style.display !== "none") {
      if (!popover.contains(e.target) && e.target !== recentBtn && !recentBtn?.contains(e.target)) {
        popover.style.display = "none";
      }
    }
  });

  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      formatEditorCode();
      handleContentChange();
      showToast("Code formatted & project updated!");
    }
    if (e.key === "Escape") {
      closeToolsDropdown();
      let popover = QS("#recent-popover");
      if (popover && popover.style.display !== "none") {
        popover.style.display = "none";
      }
      let qrModal = QS("#qr-modal");
      if (qrModal && qrModal.open) {
        qrModal.close();
      }
      let templatesModal = QS("#templates-modal");
      if (templatesModal && templatesModal.open) {
        templatesModal.close();
      }
    }
  });

  renderRecentList();

  if (QS("#mainmenu")) QS("#mainmenu").onclick = () => { toggleMenu(QS("#mainmenu"))};

  QS("#doc-title").onclick = toggleMetadata;


  var hash = window.location.hash.substring(1);

  if (hash.length) {
    var slashIndex = hash.indexOf("/");
    var title = hash.substring(0, slashIndex);
    if (title.length) {
      let titleDecoded = decodeURIComponent(title.replace(/_/g, " "));
      document.title = titleDecoded;
      let titleEl = QS("#doc-title-text") || QS("#doc-title");
      titleEl.innerText = titleDecoded;
    }
    hash = hash.substring(slashIndex + 1);
    updateLink(hash, {title});
    if (hash.startsWith("?")) {
      hash = hash.substring(1);
      let durl = new bitty.DataURL(hash);
      durl = await durl.decompress();
      let htmlContent = durl.data;
      setContent(htmlContent);
    }
    saveProjectToRecent(title || 'untitled', window.location.hash, window.location.hash.length);
  } else {
    updateBodyClass();
    let initialContent = sessionStorage.getItem("editor-content");
    if (!initialContent) {
      let autosaved = localStorage.getItem("bitty_autosave_content");
      if (autosaved && autosaved.trim().length > 0) {
        initialContent = autosaved;
        let savedTitle = localStorage.getItem("bitty_autosave_title");
        if (savedTitle && QS("#doc-title-text")) {
          QS("#doc-title-text").innerText = document.title = savedTitle;
        }
        showToast("Restored your auto-saved draft");
      }
    }
    if (initialContent) {
      setContent(initialContent);
    }
  }

  startAutosaveTimer();
};

function setContent(html) {
  editor.innerHTML = html;
  updateBodyClass();
}

function setFileName(name) {
  QS("#doc-file").innerText = name;
  if (name.length) {
    setContent("");
    document.body.classList.add("edited");
  }
}

function updateBodyClass(hasContent) {
  if (hasContent || importedFileData) {
    document.body.classList.add("edited");
  } else {
    document.body.classList.remove("edited");
  }
  
  document.body.classList.toggle("filecontent",  importedFileData != undefined);
  document.body.classList.add("loaded");
}

async function handleDrop(e) {
  console.log("drop", e)
  e.preventDefault();
  if (e.dataTransfer.files) {
    let file = e.dataTransfer.files[0];
    let extension = file.name.split(".").pop();
    let reader = new FileReader();
    reader.addEventListener(
      "load",
      async function() {
        var url = reader.result;
        let durl = new bitty.DataURL(url);
        if (durl.mediatype == "application/octet-stream") {
          durl.mediatype = "application/" + extension;
        }
        console.log(durl.mediatype)
        durl = await durl.compress(bitty.GZIP_MARKER);
        let ratio = durl.href.length / url.length;
        console.log(`Compressed from ${url.length} to ${durl.href.length} bytes (${Math.round(ratio * 100)}%)`);

        if (ratio <= 0.95) url = durl.href;
        importedFileData = url;
        updateLink(url, {title:file.name}, true);
        setFileName(file.name);

      },
      false
    );
    reader.readAsDataURL(file);
  }
  document.body.classList.remove("dragging");
}

// TODO Command+Shift+T for title (H1), Command+Shift+H for headline (H2), Command+Shift+B for body text (remove any of the above)
function handleKey(e) {
  var code = e.which;
  var handled = false;
  if (e.metaKey && e.altKey) {
    handled = true;
    if (code == "1".charCodeAt(0)) {
      document.execCommand("formatBlock", true, "<h1>");
    } else if (code == "2".charCodeAt(0)) {
      document.execCommand("formatBlock", true, "<h2>");
    } else if (code == 220) {
      // \
      document.execCommand("removeFormat");
    } else if (code == "0".charCodeAt(0)) {
      document.execCommand("formatBlock", true, "");
    } else {
      handled = false;
    }
  } else if (e.metaKey) {
    if (code == "K".charCodeAt(0)) {
      handled = true;
      var url = prompt("Add a link", "");
      if (url) {
        document.execCommand("createLink", true, url);
      }
    }
  } else if (code == 9 ) {
      console.log("tab");
      e.preventDefault();
  }
  if (handled) e.preventDefault();
}

var codepenRE = /(https:\/\/codepen\.io\/[\w]+\/(\w+)\/(\w+))/;
function handlePaste(e) {
  var clipboard = window.clipboardData || e.clipboardData;
  var text = clipboard.getData("Text") || clipboard.getData("text/plain");
  if (!text) return;
  let match =  text.match(codepenRE);
  if (match) {
    fetchCodepen(match[0]);
  }
}

var TEMPLATE_MARKER = "/*use-bitty-box-template*/";
function fetchCodepen(url) {

  Promise.all([
    fetch(url + ".html"),
    fetch(url + ".css"),
    fetch(url + ".js"),
  ]).then(async function(responses) {
    console.log("responses", responses);
    let h = await responses[0].text();
    let c = await responses[1].text();
    let j = await responses[2].text();

    console.log({h,c,j})

    var useTemplate = c.indexOf(TEMPLATE_MARKER) >= 0;
    var string =
      '<style type="text/css">' + c + "</style>" +
      h +
      '<script type="text/javascript">' + j + "</script>";
      console.log("string", string);

    let url = `data:text/html;charset=utf-8,${encodeURIComponent(string)}`;

    let durl = new bitty.DataURL(url);
    durl = await durl.compress(bitty.GZIP_MARKER);

    let ratio = durl.href.length / url.length;
    console.log(`Compressed from ${url.length} to ${durl.href.length} bytes (${Math.round(ratio * 100)}%)`);

    // setFileName("✒️" + "codepen");
    var title = QS("#doc-title").innerText;
    setTimeout(function() {
      // var data = (useTemplate ? "" : DATA_PREFIX_BXZE) + zip;
      // importedFileData = url;
      updateLink(durl.href, {title:"CODEPEN"});
    }, 300);

  });
}

function handleInput(e) {
  handleContentChange(e);
}

function handleMetadataCheckbox(e) {
  document.body.classList.toggle("no-metadata", !e.target.checked)
  handleContentChange(e);
}
function getMetadata() {
  let formData = new FormData(document.forms[0]);
  var object = {};
  formData.forEach((value, key) => object[key] = value);

  return object;
}

async function handleContentChange() {

  sessionStorage.setItem("editor-content", editor.innerHTML);
  var text = editor.innerText;
  let hasContent = text.trim().length > 0;

  updateBodyClass(hasContent);
  if (!hasContent) return;

  var metadata = getMetadata();
  var rawHTML = text.indexOf("</") > 0;
  if (rawHTML) {
    text = text.replace(/[ |\t]+/g, " ").replace(/> +</g, "> <");
  } else {
    text = editor.innerHTML;
  }

  if (text.trim().length) {
    let url = `data:text/html;charset=utf-8,${encodeURIComponent(text)}`;
    let durl = new bitty.DataURL(url)

    if (metadata.password) {
      durl.params.cipher = "aes-gcm"
      durl.params.style = "default"
      durl.params._password = metadata.password;
    }

    durl = await durl.compress(bitty.GZIP_MARKER);
    let ratio = durl.href.length / url.length;
    console.debug(`Compressed from ${url.length} to ${durl.href.length} bytes (${Math.round(ratio * 100)}%)`);

    


    if (ratio <= 0.95) url = durl.href;
    if (rawHTML) {
      updateLink(url, metadata);
    } else if (metadata.password) {
      updateLink(durl.href, metadata);
    } else {
      updateLink("?" + durl.data, metadata);
    }
    setFileName("");
  } else if (importedFileData) {
    updateLink(importedFileData, {title});
  } else {
    updateLink("");
  }
  
}

var maxLengths = {
  // "#twitter": 4088,
  // "#bitly": 2048,
  "#qrcode": 2953
};

let bittyLink = undefined;
function updateLink(url, metadata, push) {
  
  let title = metadata.title;
  
  let includeMetadata = !metadata.includeMetadata;
  let path = includeMetadata ? "/" : bitty.metadataToPath(metadata) ?? "/";
  let prefix = includeMetadata ? bitty.encodePrettyComponent(title) : "";

  if (url.length) {
    url = path + "#" + prefix + "/" + url;
  } else {
    url = "/edit";
  }

  document.getElementById("doc-title-text").innerText = title.length ? title : "";

  bittyLink = new URL(url, document.location).href;

  document.getElementById("canonical").href = bittyLink;

  if(previewContent) {
    console.log("previewing", bittyLink);
    QS("#preview-frame").src = bittyLink;
    setTimeout(applyPreviewFont, 60);
  }

  var hash = location.hash;
  if (true) {
    if (push || !hash || !hash.length) {
      window.history.pushState(null, null, bittyLink);
    } else {
      window.history.replaceState(null, null, bittyLink);
    }
  }

  var length = bittyLink.length;

  QS("#length").innerText = length + " bytes";
  QS("#length").onclick = () => {
    window.open(bittyLink, "_blank");
  }
  updatePreviewOverlay(length);
  for (var key in maxLengths) {
    var maxLength = maxLengths[key];
    var targetEl = QS(key);
    if (targetEl) {
      if (length > maxLength) {
        targetEl.classList.add("invalid");
      } else {
        targetEl.classList.remove("invalid");
      }
    }
  }

  if (bittyLink && location.hash && location.hash.length > 2) {
    let curTitle = (metadata && metadata.title) || QS("#doc-title-text")?.innerText || document.title;
    scheduleSaveRecent(curTitle, location.hash, length);
  }
}

function share() {
  navigator.share({
    title: 'Bitty Box',
    url: bittyLink
  }).then(() => {
    console.log('Shared!');
  })
  .catch(console.error);
}
function makeQRCode() {
  showQRCodeModal();
}
function upload() {
  document.getElementById('file-input').click();
}

function toggleMenu(el) {
  el.classList.toggle("menu-visible");
}

function toggleMetadata(e) {
  if (e.target.closest(".menu")) return;

  QS("#md-contents").classList.toggle("menu-visible");
  QS("#doc-title").classList.toggle("open");
  QS("#md-title").focus();
}


let previewContent = false;
function togglePreview(flag) {
  if (typeof flag === 'boolean') {
    previewContent = flag;
  } else {
    previewContent = !previewContent;
  }
  if (previewContent) {
    formatEditorCode();
  }
  document.body.classList.toggle("preview", previewContent);
  if (previewContent && bittyLink) {
    QS("#preview-frame").src = bittyLink;
    updatePreviewOverlay(bittyLink.length);
    setTimeout(applyPreviewFont, 60);
  }
  let previewBtn = QS("#preview-toggle-btn");
  if (previewBtn) {
    previewBtn.classList.toggle("active", previewContent);
    previewBtn.innerText = previewContent ? "Edit" : "Preview";
  }
}
let formatContent = false;
function toggleFormat(flag) {
  formatContent = !formatContent;
  document.body.classList.toggle("format", formatContent);
}

let toastTimeout;
function showToast(msg) {
  let toast = QS("#toast");
  if (!toast) return;
  toast.innerText = msg;
  toast.style.display = "block";
  toast.style.opacity = "1";
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.style.display = "none";
    }, 200);
  }, 2200);
}

function showQRCodeModal() {
  let modal = QS("#qr-modal");
  let canvas = QS("#qr-canvas");
  if (!modal || !canvas) return;

  let currentUrl = bittyLink || location.href;
  let hash = location.hash;
  if (!hash || hash.length < 3) {
    showToast("Add some content first to generate a QR code!");
    return;
  }

  let title = QS("#doc-title-text")?.innerText?.trim() || document.title || "Bitty Box Project";
  QS("#qr-modal-title").innerText = title;
  QS("#qr-byte-count").innerText = `${currentUrl.length} bytes`;

  function renderQR() {
    if (typeof QRious !== 'undefined') {
      new QRious({
        element: canvas,
        value: currentUrl,
        size: 220,
        level: 'L',
        background: '#ffffff',
        foreground: '#16161d'
      });
      modal.showModal();
    }
  }

  if (typeof QRious === 'undefined') {
    let script = document.createElement("script");
    script.src = "/js/qrious.min.js";
    script.onload = renderQR;
    document.head.appendChild(script);
  } else {
    renderQR();
  }
}

const RECENT_STORAGE_KEY = 'bitty_recent_projects';

function getRecentProjects() {
  try {
    let raw = localStorage.getItem(RECENT_STORAGE_KEY);
    let parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveProjectToRecent(title, hash, bytes) {
  if (!hash || hash === '#' || hash === '#/') return;
  let normHash = hash.startsWith('#') ? hash : ('#' + hash);
  if (normHash.length < 4) return;

  try {
    let list = getRecentProjects();
    list = list.filter(item => item.hash !== normHash);
    let cleanTitle = (title && title.trim()) ? title.trim() : 'untitled';
    list.unshift({
      title: cleanTitle,
      hash: normHash,
      updatedAt: Date.now(),
      bytes: bytes || normHash.length
    });
    if (list.length > 5) list = list.slice(0, 5);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list));
    renderRecentList();
  } catch (e) {
    console.warn("Unable to save to recent projects:", e);
  }
}

let saveRecentTimeout;
function scheduleSaveRecent(title, hash, bytes) {
  clearTimeout(saveRecentTimeout);
  saveRecentTimeout = setTimeout(() => {
    saveProjectToRecent(title, hash, bytes);
  }, 600);
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'recently';
  let diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return 'just now';
  let mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  let hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  let days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderRecentList() {
  let listEl = QS("#recent-list");
  if (!listEl) return;
  let list = getRecentProjects();

  listEl.innerHTML = '';
  if (list.length === 0) {
    let empty = document.createElement('li');
    empty.className = 'recent-empty';
    empty.innerText = 'No recent projects yet';
    listEl.appendChild(empty);
    return;
  }

  list.forEach(item => {
    let li = document.createElement('li');
    li.className = 'recent-item';
    li.title = `Open ${item.title}`;

    let titleDiv = document.createElement('div');
    titleDiv.className = 'recent-title';
    titleDiv.innerText = item.title || 'untitled';

    let metaDiv = document.createElement('div');
    metaDiv.className = 'recent-meta';
    metaDiv.innerText = `${formatTimeAgo(item.updatedAt)} • ${item.bytes || item.hash.length} bytes`;

    li.appendChild(titleDiv);
    li.appendChild(metaDiv);

    li.onclick = (e) => {
      e.stopPropagation();
      window.location.hash = item.hash;
      location.reload();
    };

    listEl.appendChild(li);
  });
}

function toggleRecentPopover() {
  let popover = QS("#recent-popover");
  if (!popover) return;
  let isVisible = popover.style.display !== "none";
  if (!isVisible) {
    renderRecentList();
    popover.style.display = "flex";
  } else {
    popover.style.display = "none";
  }
}

const BOILERPLATE_TEMPLATES = {
  blank: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blank Page</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 3rem 1.5rem;
      color: #1a1a1a;
      background: #fafafa;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 { margin-top: 0; font-size: 1.8rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Blank Page</h1>
    <p>Start creating your self-contained Bitty Box project here.</p>
  </div>
</body>
</html>`,

  card: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Styled Card</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f0f2f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      max-width: 360px;
      width: 100%;
      padding: 2rem;
      text-align: center;
      box-sizing: border-box;
    }
    .avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: #e0e7ff;
      color: #4338ca;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      margin: 0 auto 1.25rem;
    }
    h2 { margin: 0 0 0.5rem; font-size: 1.35rem; color: #111827; }
    p { color: #6b7280; font-size: 0.95rem; margin: 0 0 1.5rem; line-height: 1.5; }
    .btn {
      display: inline-block;
      background: #2563eb;
      color: white;
      text-decoration: none;
      padding: 0.65rem 1.5rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="avatar">&#128100;</div>
    <h2>Jane Doe</h2>
    <p>Digital craftsperson building portable web applications with Bitty Box.</p>
    <a href="#" class="btn">Connect</a>
  </div>
</body>
</html>`,

  flex: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Flex Layout</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #1f2937;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand { font-weight: 700; font-size: 1.1rem; }
    main {
      flex: 1;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      width: 100%;
      box-sizing: border-box;
    }
    .grid {
      display: flex;
      gap: 1.5rem;
      flex-wrap: wrap;
      margin-top: 1.5rem;
    }
    .box {
      flex: 1 1 calc(50% - 1.5rem);
      min-width: 240px;
      padding: 1.25rem;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #f9fafb;
      box-sizing: border-box;
    }
    footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 0.85rem;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">Project Layout</div>
    <nav>Explore</nav>
  </header>
  <main>
    <h1>Welcome to Flex Layout</h1>
    <p>A responsive multi-column layout built with flexbox.</p>
    <div class="grid">
      <div class="box">
        <h3>Feature One</h3>
        <p>Lightweight and responsive structure that adapts to all screen sizes.</p>
      </div>
      <div class="box">
        <h3>Feature Two</h3>
        <p>Completely self-contained in a single URL fragment.</p>
      </div>
    </div>
  </main>
  <footer>Built with Bitty Box</footer>
</body>
</html>`,

  counter: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Interactive App</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
      text-align: center;
      padding: 1rem;
      box-sizing: border-box;
    }
    .counter-display {
      font-size: 4rem;
      font-weight: 800;
      margin: 1rem 0;
      color: #38bdf8;
    }
    .btn-row { display: flex; gap: 0.75rem; }
    button {
      background: #1e293b;
      color: #f8fafc;
      border: 1px solid #334155;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <h2>Interactive Counter</h2>
  <div id="count" class="counter-display">0</div>
  <div class="btn-row">
    <button onclick="update(-1)">- Decrement</button>
    <button onclick="update(0)">Reset</button>
    <button onclick="update(1)">+ Increment</button>
  </div>
  <script>
    let val = 0;
    function update(delta) {
      if (delta === 0) val = 0;
      else val += delta;
      document.getElementById('count').innerText = val;
    }
  </script>
</body>
</html>`
};

function insertTemplate(key) {
  let template = BOILERPLATE_TEMPLATES[key];
  if (!template) return;

  let currentText = quill.getText().trim();
  if (currentText.length > 10) {
    if (!confirm("Insert this template? Current editor content will be replaced.")) {
      return;
    }
  }

  quill.setText(template + '\n');
  formatEditorCode();
  handleContentChange();
  QS("#templates-modal")?.close();
  let name = key.charAt(0).toUpperCase() + key.slice(1);
  showToast(`Loaded ${name} template!`);
}
window.insertTemplate = insertTemplate;

function updatePreviewOverlay(bytes) {
  let bytesEl = QS("#preview-overlay-bytes");
  let barEl = QS("#preview-overlay-bar");
  let warningEl = QS("#preview-overlay-warning");
  if (!bytesEl || !barEl || !warningEl) return;

  bytes = typeof bytes === 'number' ? bytes : (bittyLink ? bittyLink.length : 0);
  bytesEl.innerText = `${bytes.toLocaleString()} bytes`;

  let percent = Math.min(100, Math.max(4, Math.round((bytes / 4000) * 100)));
  barEl.style.width = `${percent}%`;

  if (bytes < 2000) {
    barEl.style.backgroundColor = '#10b981';
    warningEl.className = 'preview-overlay-warning safe';
    warningEl.innerHTML = '&#10003; Safe URL length (under 2KB)';
  } else if (bytes < 4000) {
    barEl.style.backgroundColor = '#f59e0b';
    warningEl.className = 'preview-overlay-warning warning';
    warningEl.innerHTML = '&#9888; Approaching limit (~2.9KB QR code cap & mobile URL limit)';
  } else {
    barEl.style.backgroundColor = '#ef4444';
    warningEl.className = 'preview-overlay-warning danger';
    warningEl.innerHTML = '&#9888; High byte count! URLs &gt;4KB may truncate on mobile browsers or QR codes';
  }
}

function applyPreviewFont(fontType) {
  if (!fontType) {
    fontType = QS("#preview-font-select")?.value || localStorage.getItem('bitty_preview_font') || 'sans-serif';
  }
  const fontMap = {
    'sans-serif': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    'serif': 'Georgia, Cambria, "Times New Roman", Times, serif',
    'monospace': '"SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  };
  const fontFamily = fontMap[fontType] || fontMap['sans-serif'];

  let iframe = QS("#preview-frame");
  if (iframe) {
    try {
      let doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc && doc.body) {
        doc.body.style.fontFamily = fontFamily;
        let styleTag = doc.getElementById('bitty-injected-font');
        if (!styleTag) {
          styleTag = doc.createElement('style');
          styleTag.id = 'bitty-injected-font';
          doc.head?.appendChild(styleTag);
        }
        styleTag.textContent = `body, p, div, span, h1, h2, h3, h4, h5, h6, li, a { font-family: ${fontFamily} !important; }`;
      }
    } catch (e) {
      console.debug("Could not access iframe contentDocument directly:", e);
    }
  }
}

function getActiveTheme() {
  try {
    let saved = localStorage.getItem('bitty_theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch (e) {}
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

function applyTheme(theme, isUserAction = false) {
  theme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;

  if (isUserAction) {
    try {
      localStorage.setItem('bitty_theme', theme);
    } catch (e) {}
  }

  updateThemeButtonUI(theme);
  applyPreviewTheme(theme);

  let metaLight = QS("#themeColor");
  if (metaLight) {
    metaLight.content = theme === 'dark' ? '#111111' : '#f1f1f1';
  }
}

function updateThemeButtonUI(theme) {
  let btn = QS("#theme-btn");
  let icon = QS("#theme-icon");
  let text = QS("#theme-text");
  if (!btn) return;

  let isDark = theme === 'dark';
  if (icon) {
    icon.innerHTML = isDark ? '&#9790;' : '&#9728;';
  }
  if (text) {
    text.innerText = isDark ? 'Dark' : 'Light';
  }
  btn.title = `Theme: ${isDark ? 'Dark' : 'Light'} (Click to switch to ${isDark ? 'Light' : 'Dark'} mode)`;
  btn.setAttribute('aria-label', `Theme: ${isDark ? 'Dark' : 'Light'}. Toggle theme`);
}

function toggleTheme() {
  let current = getActiveTheme();
  let next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next, true);
  showToast(`Theme set to ${next === 'dark' ? 'Dark' : 'Light'} mode`);
}

function applyPreviewTheme(theme) {
  if (!theme) {
    theme = getActiveTheme();
  }
  let iframe = QS("#preview-frame");
  if (iframe) {
    try {
      let doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc && doc.documentElement) {
        doc.documentElement.setAttribute('data-theme', theme);
        doc.documentElement.style.colorScheme = theme;
      }
    } catch (e) {
      // Cross-origin or sandboxed
    }
  }
}

function triggerAutosave() {
  let text = editor.innerText ? editor.innerText.trim() : "";
  if (text.length > 0) {
    let statusEl = QS("#autosave-status");
    if (statusEl) {
      statusEl.classList.add("saving");
      statusEl.innerText = "Saving...";
    }
    try {
      localStorage.setItem('bitty_autosave_content', editor.innerHTML);
      let titleText = QS("#doc-title-text")?.innerText || document.title || "";
      localStorage.setItem('bitty_autosave_title', titleText);
      localStorage.setItem('bitty_autosave_timestamp', String(Date.now()));
      setTimeout(() => {
        if (statusEl) {
          statusEl.classList.remove("saving");
          let now = new Date();
          let timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          statusEl.innerText = `Saved ${timeStr}`;
        }
      }, 350);
    } catch (err) {
      console.warn("Autosave error:", err);
    }
  }
}

function startAutosaveTimer() {
  setInterval(triggerAutosave, 30000);
}

function formatCode(source) {
  if (!source || typeof source !== 'string') return source;
  const trimmed = source.trim();
  if (!trimmed) return source;

  if (/<[a-z!/][\s\S]*>/i.test(trimmed)) {
    return formatHTML(trimmed);
  } else {
    return formatBraceCode(trimmed, 0);
  }
}

function formatHTML(html) {
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
    'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
  ]);

  let tokens = [];
  let index = 0;
  const len = html.length;

  while (index < len) {
    if (html.startsWith('<!--', index)) {
      let end = html.indexOf('-->', index);
      if (end === -1) end = len;
      else end += 3;
      tokens.push({ type: 'comment', value: html.slice(index, end).trim() });
      index = end;
    } else if (html.slice(index, index + 7).toLowerCase() === '<script' && (html[index + 7] === '>' || /\s/.test(html[index + 7]))) {
      let openTagEnd = html.indexOf('>', index);
      if (openTagEnd === -1) {
        tokens.push({ type: 'text', value: html.slice(index) });
        break;
      }
      openTagEnd += 1;
      let openTag = html.slice(index, openTagEnd);
      let closeIndex = html.toLowerCase().indexOf('</script>', openTagEnd);
      if (closeIndex === -1) {
        tokens.push({ type: 'tag-open', name: 'script', value: openTag });
        index = openTagEnd;
      } else {
        let scriptBody = html.slice(openTagEnd, closeIndex);
        tokens.push({ type: 'script-block', openTag, body: scriptBody, closeTag: '</script>' });
        index = closeIndex + 9;
      }
    } else if (html.slice(index, index + 6).toLowerCase() === '<style' && (html[index + 6] === '>' || /\s/.test(html[index + 6]))) {
      let openTagEnd = html.indexOf('>', index);
      if (openTagEnd === -1) {
        tokens.push({ type: 'text', value: html.slice(index) });
        break;
      }
      openTagEnd += 1;
      let openTag = html.slice(index, openTagEnd);
      let closeIndex = html.toLowerCase().indexOf('</style>', openTagEnd);
      if (closeIndex === -1) {
        tokens.push({ type: 'tag-open', name: 'style', value: openTag });
        index = openTagEnd;
      } else {
        let styleBody = html.slice(openTagEnd, closeIndex);
        tokens.push({ type: 'style-block', openTag, body: styleBody, closeTag: '</style>' });
        index = closeIndex + 8;
      }
    } else if (html[index] === '<') {
      let end = html.indexOf('>', index);
      if (end === -1) {
        tokens.push({ type: 'text', value: html.slice(index) });
        break;
      }
      end += 1;
      let tagStr = html.slice(index, end);
      let match = tagStr.match(/^<\s*(\/?)\s*([a-zA-Z0-9\-!]+)/);
      if (match) {
        let isClose = match[1] === '/';
        let tagName = match[2].toLowerCase();
        let isSelfClosing = tagStr.endsWith('/>') || voidTags.has(tagName);
        if (isClose) {
          tokens.push({ type: 'tag-close', name: tagName, value: tagStr });
        } else if (isSelfClosing) {
          tokens.push({ type: 'tag-void', name: tagName, value: tagStr });
        } else {
          tokens.push({ type: 'tag-open', name: tagName, value: tagStr });
        }
      } else {
        tokens.push({ type: 'text', value: tagStr });
      }
      index = end;
    } else {
      let nextTag = html.indexOf('<', index);
      if (nextTag === -1) nextTag = len;
      let text = html.slice(index, nextTag).trim();
      if (text.length > 0) {
        tokens.push({ type: 'text', value: text });
      }
      index = nextTag;
    }
  }

  let lines = [];
  let depth = 0;
  const indentStr = '  ';

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];

    if (token.type === 'tag-open') {
      if (nextToken && nextToken.type === 'text' && tokens[i + 2] && tokens[i + 2].type === 'tag-close' && tokens[i + 2].name === token.name && (token.value.length + nextToken.value.length + tokens[i + 2].value.length < 80)) {
        lines.push(indentStr.repeat(depth) + token.value + nextToken.value + tokens[i + 2].value);
        i += 2;
      } else {
        lines.push(indentStr.repeat(depth) + token.value);
        depth++;
      }
    } else if (token.type === 'tag-close') {
      depth = Math.max(0, depth - 1);
      lines.push(indentStr.repeat(depth) + token.value);
    } else if (token.type === 'tag-void' || token.type === 'comment' || token.type === 'text') {
      lines.push(indentStr.repeat(depth) + token.value);
    } else if (token.type === 'script-block' || token.type === 'style-block') {
      lines.push(indentStr.repeat(depth) + token.openTag);
      let innerFormatted = formatBraceCode(token.body, depth + 1);
      if (innerFormatted.trim().length > 0) {
        lines.push(innerFormatted);
      }
      lines.push(indentStr.repeat(depth) + token.closeTag);
    }
  }

  return lines.join('\n');
}

function formatBraceCode(code, baseDepth = 0) {
  if (!code) return '';
  const lines = code.split('\n');
  let resultLines = [];
  let depth = baseDepth;
  const indentStr = '  ';

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    let leadingCloses = 0;
    for (let char of line) {
      if (char === '}' || char === ')' || char === ']') leadingCloses++;
      else if (char !== ' ' && char !== '\t') break;
    }

    let currentIndent = Math.max(0, depth - leadingCloses);
    resultLines.push(indentStr.repeat(currentIndent) + line);

    let net = 0;
    for (let char of line) {
      if (char === '{' || char === '(' || char === '[') net++;
      else if (char === '}' || char === ')' || char === ']') net--;
    }
    depth = Math.max(0, depth + net);
  }

  return resultLines.join('\n');
}

function formatEditorCode() {
  let changed = false;
  let codeBlocks = editor.querySelectorAll('pre.ql-syntax');
  if (codeBlocks.length > 0) {
    codeBlocks.forEach(block => {
      let original = block.innerText;
      let formatted = formatCode(original);
      if (formatted && formatted !== original) {
        block.innerText = formatted;
        changed = true;
      }
    });
    if (changed) {
      handleContentChange();
      return true;
    }
  }

  let text = quill.getText().trim();
  if (text.length > 0 && (text.includes('<') && (text.includes('>') || text.includes('</')))) {
    let formatted = formatCode(text);
    if (formatted && formatted !== text) {
      quill.setText(formatted + '\n');
      handleContentChange();
      return true;
    }
  } else if (text.length > 0 && (text.includes('{') || text.includes('}'))) {
    let formatted = formatBraceCode(text, 0);
    if (formatted && formatted !== text) {
      quill.setText(formatted + '\n');
      handleContentChange();
      return true;
    }
  }
  return false;
}


function copyThenLink() {
  copyLink();
  return confirm("Copied your link to the clipboard. Paste it to share.");
}
function copyLink() {
  var text = bittyLink;
  var dummy = document.createElement("input");
  document.body.appendChild(dummy);
  dummy.value = text;
  dummy.select();
  document.execCommand("copy");
  document.body.removeChild(dummy);

  document.body.classList.add("copied");
  setTimeout(function() {
    document.body.classList.remove("copied");
  }, 2000);
}

function saveLink() {
  var url = "/" + location.hash;
  window.history.pushState(null, null, url);
  location.reload();
}

function tweetLink() {
  var url =
    "https://twitter.com/intent/tweet?url=" + encodeURIComponent(location.href);
  window.open(url, "_blank");
  return false;
}
