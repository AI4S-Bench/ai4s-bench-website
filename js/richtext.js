/* ============================================================
   AI4S-Benchmark · Rich text
   Proposal fields arrive from the control plane as plain text
   that authors write like a GitHub Discussion: paragraphs,
   lists, links, a little Markdown and LaTeX. This module turns
   that text into safe HTML and renders the math with KaTeX.

   Safety: every character is HTML-escaped before any markup is
   applied, so untrusted proposal text can never inject HTML.
   Math is lifted out before Markdown runs so `_`, `*` and `\`
   inside formulas are never mangled.
   ============================================================ */

const KATEX_VERSION = "0.16.22";
const KATEX_BASE = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;

const MATH_DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "\\[", right: "\\]", display: true },
  { left: "\\(", right: "\\)", display: false },
  { left: "$", right: "$", display: false },
];

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ---- Math detection ----------------------------------------
   A lone "$" in prose ("costs $5") must not start a formula, so
   inline math needs a non-space right after the opening "$" and
   right before the closing one, on a single line. Display math
   ($$…$$, \[…\]) may span lines. */

const MATH_PATTERN =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<![\\$\w])\$(?=\S)((?:\\.|[^$\n])+?)(?<=\S)\$(?![\w$])/g;

export function hasMath(text) {
  MATH_PATTERN.lastIndex = 0;
  return MATH_PATTERN.test(String(text ?? ""));
}

function liftMath(text) {
  const slots = [];
  const lifted = text.replace(MATH_PATTERN, (match) => {
    slots.push(match);
    return `\uE000${slots.length - 1}\uE001`;
  });
  return { lifted, slots };
}

function restoreMath(html, slots) {
  return html.replace(/\uE000(\d+)\uE001/g, (_, i) => escapeHTML(slots[Number(i)]));
}

/* ---- Inline markup ----------------------------------------- */

const URL_PATTERN = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"\]]/g;

function inline(escaped) {
  let out = escaped;

  // `code`
  out = out.replace(/`([^`\n]+)`/g, (_, code) => `<code>${code}</code>`);

  // [text](url) — only http(s) targets
  out = out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => link(url, label));

  // bare URLs (skip ones already inside an href/anchor from the step above)
  out = out.replace(URL_PATTERN, (url, offset, whole) => {
    const before = whole.slice(Math.max(0, offset - 6), offset);
    if (before.endsWith('href="') || before.endsWith('">')) return url;
    return link(url, url);
  });

  // **bold** and *emphasis*. Underscore emphasis is deliberately not
  // supported: subscripts like n_i and file_names are common in science.
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1<em>$2</em>");

  return out;
}

function link(url, label) {
  const safe = url.replaceAll("&amp;", "&"); // the URL was escaped once already
  return `<a href="${escapeHTML(safe)}" target="_blank" rel="noopener">${label}</a>`;
}

/* ---- Block structure --------------------------------------- */

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*(#{1,4})\s+(.*)$/;
const FENCE = /^\s*```/;

function blocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    if (FENCE.test(line)) {
      const code = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      i++; // closing fence
      out.push(`<pre><code>${code.join("\n")}</code></pre>`);
      continue;
    }

    const h = line.match(HEADING);
    if (h) {
      const level = Math.min(4, h[1].length + 2); // # → h3 inside a page section
      out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line);
      const re = ordered ? NUMBERED : BULLET;
      const items = [];
      let start = ordered ? Number(line.match(NUMBERED)[1]) : 1;
      while (i < lines.length && re.test(lines[i])) {
        const m = lines[i].match(re);
        let body = ordered ? m[2] : m[1];
        i++;
        // continuation lines belong to the item until a blank line or a new marker
        while (i < lines.length && lines[i].trim() !== "" && !re.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i])) {
          body += `<br>${lines[i].trim()}`;
          i++;
        }
        items.push(`<li>${inline(body)}</li>`);
        // Authors often separate items with a blank line; keep them in one list.
        let j = i;
        while (j < lines.length && lines[j].trim() === "") j++;
        if (j < lines.length && re.test(lines[j])) i = j;
      }
      const startAttr = ordered && start !== 1 ? ` start="${start}"` : "";
      out.push(ordered ? `<ol${startAttr}>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // Paragraph: consecutive non-blank lines. A short label line such as
    // "Background" followed by prose becomes a subheading, matching how
    // authors structure Discussion posts without Markdown syntax.
    const para = [];
    while (i < lines.length && lines[i].trim() !== "" && !FENCE.test(lines[i]) && !HEADING.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    if (para.length > 1 && isLabel(para[0], para[1])) {
      out.push(`<h4>${inline(para[0])}</h4>`);
      para.shift();
    }
    out.push(`<p>${para.map(inline).join("<br>")}</p>`);
  }
  return out;
}

/* "Background" / "Scientific target" on a line of its own, followed by a
   sentence, is a heading the author typed without Markdown. Anything that
   reads like the start of a sentence stays inside the paragraph. */
function isLabel(line, next) {
  if (line.length > 40) return false;
  if (/[.:;,!?)\]=$]$/.test(line)) return false;
  if (/^https?:\/\//.test(line) || /[=<>{}$\\]/.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length > 4 || !/^[A-Z]/.test(line)) return false;
  return /^[A-Z0-9$\\(]/.test(next);
}

/**
 * Render proposal text to HTML. Output is safe to insert with innerHTML.
 * Math stays as escaped source text; call mountMath() on the container
 * to typeset it.
 */
export function renderRich(text) {
  const source = String(text ?? "").replace(/\r\n?/g, "\n").trim();
  if (!source) return "";
  const { lifted, slots } = liftMath(source);
  const html = blocks(escapeHTML(lifted).split("\n")).join("\n");
  return restoreMath(html, slots);
}

export function richBlock(text, extraClass = "") {
  const html = renderRich(text);
  return html ? `<div class="rich${extraClass ? ` ${extraClass}` : ""}">${html}</div>` : "";
}

/* ---- KaTeX (loaded only when a page actually contains math) -- */

let katexLoading = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function loadKaTeX() {
  if (katexLoading) return katexLoading;
  katexLoading = (async () => {
    if (!document.querySelector('link[data-katex]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${KATEX_BASE}/katex.min.css`;
      css.dataset.katex = "";
      document.head.appendChild(css);
    }
    await loadScript(`${KATEX_BASE}/katex.min.js`);
    await loadScript(`${KATEX_BASE}/contrib/auto-render.min.js`);
  })();
  return katexLoading;
}

/**
 * Typeset every formula inside `root`. Resolves once done, or immediately
 * when the element holds no math. Failures degrade to the source text.
 */
export async function mountMath(root) {
  if (!root || !hasMath(root.textContent)) return;
  try {
    await loadKaTeX();
    window.renderMathInElement(root, {
      delimiters: MATH_DELIMITERS,
      throwOnError: false,
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
    });
  } catch (error) {
    console.warn("Math rendering unavailable:", error);
  }
}
