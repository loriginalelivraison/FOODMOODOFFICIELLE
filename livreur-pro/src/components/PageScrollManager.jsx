import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { revealElement, scrollToPageTop, scrollToPageTopWhenReady } from "../utils/scroll.js";

const FIELD = "input:not([type=hidden]), textarea, select, [contenteditable=true]";
const WATCHED = '[role="alert"], [data-scroll-step], [data-scroll-page]';

export default function PageScrollManager({ contentRef }) {
  const location = useLocation();

  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previous; };
  }, []);

  useLayoutEffect(() => {
    if (location.hash) {
      let id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* Malformed anchors still open safely. */ }
      const target = document.getElementById(id);
      if (target) { revealElement(target, { behavior: "instant" }); return; }
    }
    return scrollToPageTopWhenReady();
  }, [location.key, location.pathname, location.search, location.hash]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    let interacted = false;
    let frame = 0;
    let focusFrame = 0;
    let invalidField = null;
    let reportingValidity = false;
    let pendingStep = null;
    let pendingError = null;
    let pendingPage = false;
    const steps = new WeakMap();
    const errors = new WeakMap();
    content.querySelectorAll("[data-scroll-step]").forEach(element => steps.set(element, element.dataset.scrollStep));

    function flush() {
      frame = 0;
      if (invalidField) {
        reportingValidity = true;
        invalidField.reportValidity();
        reportingValidity = false;
        invalidField.setAttribute("aria-invalid", "true");
        invalidField.dataset.nativeInvalid = "true";
        revealElement(invalidField, { focus: true, behavior: "instant" });
      }
      else if (pendingError) {
        const target = document.getElementById(pendingError.dataset.errorFor);
        revealElement(target || pendingError, { focus: true });
      } else if (pendingPage) scrollToPageTop();
      else if (pendingStep) revealElement(pendingStep);
      invalidField = pendingError = pendingStep = null;
      pendingPage = false;
    }
    function schedule() { if (!frame) frame = requestAnimationFrame(flush); }
    function markInteraction() { interacted = true; }
    function showFocusedField() {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        const field = document.activeElement;
        if (content.contains(field) && field.matches(FIELD)) revealElement(field, { behavior: "instant" });
      });
    }
    function onInvalid(event) {
      // A single submit can emit an invalid event for every missing field.
      if (reportingValidity) return;
      event.preventDefault();
      invalidField ||= event.target;
      schedule();
    }
    function onInput(event) {
      const field = event.target;
      if (!field.dataset.nativeInvalid) return;
      queueMicrotask(() => {
        if (field.validity.valid) {
          field.removeAttribute("aria-invalid");
          delete field.dataset.nativeInvalid;
        }
      });
    }
    function inspect(element) {
      if (!element.isConnected || !element.getClientRects().length) return;
      if (element.hasAttribute("data-scroll-page")) {
        interacted = false;
        pendingStep = null;
        pendingPage = true;
        element.querySelectorAll("[data-scroll-step]").forEach(step => steps.set(step, step.dataset.scrollStep));
        schedule();
      }
      if (element.matches('[role="alert"]')) {
        const text = element.textContent.trim();
        if (text && errors.get(element) !== text) { pendingError ||= element; schedule(); }
        errors.set(element, text);
      }
      if (element.hasAttribute("data-scroll-step")) {
        const step = element.dataset.scrollStep;
        if (steps.get(element) !== step && (steps.has(element) || interacted)) { pendingStep = element; schedule(); }
        steps.set(element, step);
      }
    }
    const observer = new MutationObserver(records => {
      const changed = new Set();
      for (const record of records) {
        const parent = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        const alert = parent?.closest('[role="alert"]');
        if (alert) changed.add(alert);
        if (record.type === "attributes") {
          if (record.attributeName === "open" && record.target.open && interacted) {
            pendingStep = record.target;
            schedule();
          } else changed.add(record.target);
        }
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches(WATCHED)) changed.add(node);
          node.querySelectorAll(WATCHED).forEach(element => changed.add(element));
        }
      }
      changed.forEach(inspect);
    });
    observer.observe(content, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ["data-scroll-step", "open"] });
    content.querySelectorAll('[role="alert"]').forEach(inspect);
    content.addEventListener("pointerdown", markInteraction, true);
    content.addEventListener("keydown", markInteraction, true);
    content.addEventListener("focusin", showFocusedField);
    content.addEventListener("invalid", onInvalid, true);
    content.addEventListener("input", onInput);
    window.visualViewport?.addEventListener("resize", showFocusedField);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
      content.removeEventListener("pointerdown", markInteraction, true);
      content.removeEventListener("keydown", markInteraction, true);
      content.removeEventListener("focusin", showFocusedField);
      content.removeEventListener("invalid", onInvalid, true);
      content.removeEventListener("input", onInput);
      window.visualViewport?.removeEventListener("resize", showFocusedField);
    };
  }, [contentRef, location.key]);
  return null;
}
