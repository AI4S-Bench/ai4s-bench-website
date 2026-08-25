/* ============================================================
   AI4S-Benchmark · App shell
   Global behavior: navigation, GitHub links, footer, a11y bits.
   ============================================================ */

import { getSite, ROOT } from "./data.js";
import "./motion.js";

const controlPlaneConfig = getSite().then((site) => String(site.control_plane_url || "").replace(/\/$/, ""));

export async function controlPlaneFetch(path, options = {}) {
  const baseUrl = await controlPlaneConfig;
  if (!baseUrl) throw new Error("Proposal submissions are not configured yet.");
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${response.status})`);
  }
  return response.status === 204 ? undefined : response.json();
}

export async function currentUser() {
  return controlPlaneFetch("/api/v1/auth/me");
}

export async function signOut() {
  await controlPlaneFetch("/api/v1/auth/logout", { method: "POST" });
  try {
    await currentUser();
  } catch (error) {
    if (/Request failed \(401\)/.test(error.message)) {
      document.dispatchEvent(new CustomEvent("ai4sbench:authchange", { detail: null }));
      return;
    }
    throw error;
  }
  throw new Error("The control-plane session is still active after sign-out.");
}

export async function signInWithGitHub() {
  // Open synchronously while the click gesture is still active. Browsers otherwise
  // treat a popup opened after the asynchronous authorization request as unsolicited.
  const popup = window.open("", "ai4sbench-github", "popup,width=700,height=780");
  if (!popup) throw new Error("Allow popups to continue with GitHub.");
  popup.document.title = "Opening GitHub sign-in…";
  try {
    const baseUrl = await controlPlaneConfig;
    if (!baseUrl) throw new Error("Proposal submissions are not configured yet.");
    popup.location.assign(`${baseUrl}/auth/github/start`);
  } catch (error) {
    popup.close();
    throw error;
  }
  return new Promise((resolve, reject) => {
    const poll = window.setInterval(async () => {
      try {
        const user = await currentUser();
        window.clearInterval(poll);
        popup.close();
        document.dispatchEvent(new CustomEvent("ai4sbench:authchange", { detail: user }));
        resolve(user);
      } catch {
        if (popup.closed) {
          window.clearInterval(poll);
          reject(new Error("GitHub sign-in was cancelled."));
        }
      }
    }, 800);
  });
}

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

/* ---- GitHub sign-in ------------------------------------------------------ */
const signInButton = document.createElement("button");
signInButton.type = "button";
signInButton.className = "btn btn--secondary btn--sm site-nav__auth";
signInButton.innerHTML = "Sign in";
signInButton.hidden = true;
signInButton.dataset.authenticated = "false";
nav?.insertBefore(signInButton, nav.querySelector("[data-nav='submit']") || null);

async function renderAuthControl() {
  try {
    const user = await currentUser();
    signInButton.disabled = false;
    signInButton.dataset.authenticated = "true";
    signInButton.textContent = `Sign out (@${user.github_login || user.email})`;
    signInButton.title = "Sign out";
    signInButton.hidden = false;
  } catch (error) {
    if (error.message === "Proposal submissions are not configured yet.") {
      signInButton.textContent = "Sign in";
      signInButton.dataset.authenticated = "false";
      signInButton.title = "GitHub sign-in is not configured yet";
      signInButton.disabled = true;
      signInButton.hidden = false;
      return;
    }
    signInButton.disabled = false;
    signInButton.dataset.authenticated = "false";
    signInButton.textContent = "Sign in";
    signInButton.title = "Sign in with GitHub";
    signInButton.hidden = false;
  }
}

signInButton.addEventListener("click", async () => {
  signInButton.disabled = true;
  const originalText = signInButton.textContent;
  const signingOut = signInButton.dataset.authenticated === "true";
  signInButton.textContent = signingOut ? "Signing out…" : "Opening GitHub…";
  try {
    if (signingOut) await signOut();
    else await signInWithGitHub();
  } catch (error) { console.error(signingOut ? "GitHub sign-out failed:" : "GitHub sign-in failed:", error); }
  finally { signInButton.disabled = false; signInButton.textContent = originalText; void renderAuthControl(); }
});
void renderAuthControl();

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
