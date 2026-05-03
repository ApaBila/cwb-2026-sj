const SVG_NS = 'http://www.w3.org/2000/svg';

function createSVG(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) {
    if (k === 'append_to') continue;
    el.setAttribute(k, attrs[k]);
  }
  if (attrs.append_to) attrs.append_to.appendChild(el);
  return el;
}

function $(selector, ctx = document) {
  return ctx.querySelector(selector);
}

function attr(el, attrs = {}) {
  for (const k in attrs) el.setAttribute(k, attrs[k]);
}

export { createSVG, $, attr };
