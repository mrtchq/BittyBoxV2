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

var bindings = {}
var quill = new Quill('#editor', {
  theme: 'snow',
  modules: {
    syntax: true,
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
  
  if (QS("#format-code-btn")) {
    QS("#format-code-btn").onclick = () => {
      let formatted = formatEditorCode();
      showToast(formatted ? "Code auto-indented!" : "Code already cleanly indented");
    };
  }
  if (QS("#preview-toggle-btn")) QS("#preview-toggle-btn").onclick = () => togglePreview();
  if (QS("#qr-btn")) QS("#qr-btn").onclick = showQRCodeModal;
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

  if (QS("#recent-btn")) {
    QS("#recent-btn").onclick = (e) => {
      e.stopPropagation();
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
    let popover = QS("#recent-popover");
    let recentBtn = QS("#recent-btn");
    if (popover && popover.style.display !== "none") {
      if (!popover.contains(e.target) && e.target !== recentBtn) {
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
      let popover = QS("#recent-popover");
      if (popover && popover.style.display !== "none") {
        popover.style.display = "none";
      }
      let qrModal = QS("#qr-modal");
      if (qrModal && qrModal.open) {
        qrModal.close();
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
    if (title.length)
      QS("#doc-title").innerText = document.title = decodeURIComponent(
        title.replace(/_/g, " ")
      );
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
    setContent(sessionStorage.getItem("editor-content"))

  }
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
