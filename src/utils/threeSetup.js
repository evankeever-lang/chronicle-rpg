// Polyfill DOM globals required by three.js in React Native.
// This file must be imported before any three.js or expo-three code runs.

if (typeof global.document === 'undefined') {
  global.document = {};
}
const doc = global.document;

// Node / element stubs
const noop      = () => {};
const nullEl    = () => null;
const emptyArr  = () => [];
const stubEl    = () => ({ style: {}, addEventListener: noop, removeEventListener: noop });

if (!doc.body)             doc.body             = { contains: () => false, appendChild: noop, removeChild: noop };
if (!doc.contains)         doc.contains         = () => false;
if (!doc.createElement)    doc.createElement    = stubEl;
if (!doc.createElementNS)  doc.createElementNS  = (_ns, _tag) => stubEl();
if (!doc.getElementById)   doc.getElementById   = nullEl;
if (!doc.querySelector)    doc.querySelector    = nullEl;
if (!doc.querySelectorAll) doc.querySelectorAll = emptyArr;
if (!doc.addEventListener) doc.addEventListener = noop;
if (!doc.removeEventListener) doc.removeEventListener = noop;

// window stubs (three.js / WebXR checks)
if (typeof global.window === 'undefined') {
  global.window = {};
}
if (!global.window.addEventListener)    global.window.addEventListener    = noop;
if (!global.window.removeEventListener) global.window.removeEventListener = noop;
if (!global.window.navigator)           global.window.navigator           = {};
if (!global.window.screen)              global.window.screen              = { width: 0, height: 0 };
