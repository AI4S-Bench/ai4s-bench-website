/* ============================================================
   AI4S-Benchmark · App shell
   Global behavior: navigation, GitHub links, footer, a11y bits.
   ============================================================ */

import { getSite, ROOT } from "./data.js";
import "./motion.js";

/* ---- Mobile navigation ---- */
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  // Close the drawer when a link is chosen or focus escapes.
  nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
}

/* ---- Mark the current page in the nav ---- */
const page = document.body.dataset.page;
if (page) {
  document.querySelectorAll(`[data-nav="${page}"]`).forEach((link) => {
    link.setAttribute("aria-current", "page");
  });
}

/* ---- Wire configured GitHub links (data-gh="key") ---- */
getSite()
  .then((site) => {
    document.querySelectorAll("[data-gh]").forEach((el) => {
      const key = el.dataset.gh;
      const url = site.github?.[key];
      if (url) {
        el.href = url;
      } else {
        el.href = site.github?.org_url ?? "#";
      }
    });
  })
  .catch((err) => console.error("Site config failed to load:", err));

/* ---- Footer year ---- */
const yearEl = document.querySelector("[data-year]");
if (yearEl) yearEl.textContent = new Date().getFullYear();

export { ROOT };
