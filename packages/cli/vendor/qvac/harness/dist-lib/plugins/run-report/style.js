export const STYLE = `
:root {
  color-scheme: light;
  --canvas: #eef0f3;
  --surface: #ffffff;
  --raised: #eef0f3;
  --fg: #1c1e21;
  --fg-muted: #646a73;
  --fg-faint: #a3a8b0;
  --border: #e9ecef;
  --primary: #08735f;
  --primary-soft: #e3f4ef;
  --on-primary: #ffffff;
  --good-bg: #e4f6ea;
  --good-fg: #1a7a43;
  --bad-bg: #fde8e8;
  --bad-fg: #c53030;
  --warn-bg: #fef3d7;
  --warn-fg: #8a5a0f;
  --info-bg: #ccdff8;
  --info-fg: #1e56a3;
  --violet-bg: #ddd3fa;
  --violet-fg: #5737b5;
  --shadow-soft: 0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06);
  --shadow-card: 0 2px 6px -2px rgb(16 24 40 / 0.06), 0 8px 24px -6px rgb(16 24 40 / 0.1);
  --mono: 'Inconsolata', ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;
    --canvas: #161718;
    --surface: #252728;
    --raised: #1e1f20;
    --fg: #ffffff;
    --fg-muted: #9a9b9c;
    --fg-faint: #5f6163;
    --border: #2e3031;
    --primary: #16e3c1;
    --primary-soft: #095b4d;
    --on-primary: #0f1010;
    --good-bg: #18482d;
    --good-fg: #5cc98a;
    --bad-bg: #602222;
    --bad-fg: #f58b8b;
    --warn-bg: #65511a;
    --warn-fg: #fdca40;
    --info-bg: #1b2b42;
    --info-fg: #8db9f5;
    --violet-bg: #2b2442;
    --violet-fg: #b6a3f6;
    --shadow-soft: inset 0 1px 0 rgb(255 255 255 / 0.03), 0 1px 2px rgb(0 0 0 / 0.3);
    --shadow-card: inset 0 1px 0 rgb(255 255 255 / 0.04), 0 2px 8px -2px rgb(0 0 0 / 0.35), 0 12px 32px -8px rgb(0 0 0 / 0.45);
  }
}
:root[data-theme='dark'] {
  color-scheme: dark;
  --canvas: #161718;
  --surface: #252728;
  --raised: #1e1f20;
  --fg: #ffffff;
  --fg-muted: #9a9b9c;
  --fg-faint: #5f6163;
  --border: #2e3031;
  --primary: #16e3c1;
  --primary-soft: #095b4d;
  --on-primary: #0f1010;
  --good-bg: #18482d;
  --good-fg: #5cc98a;
  --bad-bg: #602222;
  --bad-fg: #f58b8b;
  --warn-bg: #65511a;
  --warn-fg: #fdca40;
  --info-bg: #1b2b42;
  --info-fg: #8db9f5;
  --violet-bg: #2b2442;
  --violet-fg: #b6a3f6;
  --shadow-soft: inset 0 1px 0 rgb(255 255 255 / 0.03), 0 1px 2px rgb(0 0 0 / 0.3);
  --shadow-card: inset 0 1px 0 rgb(255 255 255 / 0.04), 0 2px 8px -2px rgb(0 0 0 / 0.35), 0 12px 32px -8px rgb(0 0 0 / 0.45);
}
* { box-sizing: border-box; }
html, body { background: var(--canvas); }
body {
  margin: 0;
  color: var(--fg);
  font: 14px/1.55 'Geist', 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
code, .mono { font-family: var(--mono); font-weight: 600; }
code { background: var(--raised); padding: 1px 5px; border-radius: 4px; font-size: 0.95em; }
button { font: inherit; color: inherit; }
main { max-width: 1480px; margin: 0 auto; padding: 0 16px 80px; }

.topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 0; }
.brand { display: flex; align-items: center; gap: 12px; color: var(--primary); }
.brand svg { display: block; }
.brand span {
  color: var(--fg-muted); font: 500 13px/1 var(--mono); letter-spacing: 0.06em;
  text-transform: uppercase; padding-left: 12px; border-left: 1px solid var(--border);
}
.pill {
  font-size: 13px; color: var(--fg-muted); background: var(--surface); border: 0;
  border-radius: 999px; padding: 6px 12px; box-shadow: var(--shadow-soft); cursor: pointer;
}
.pill:hover { color: var(--fg); }
.pill[aria-pressed='true'] { background: var(--primary-soft); color: var(--fg); }

.card { background: var(--surface); border-radius: 16px; box-shadow: var(--shadow-card); }
.hero { padding: 28px 32px 24px; position: relative; overflow: hidden; }
.hero::after {
  content: ''; position: absolute; inset: 0 0 auto auto; width: 320px; height: 320px;
  background: radial-gradient(circle at 70% 30%, var(--primary-soft), transparent 65%); pointer-events: none;
}
.hero > * { position: relative; z-index: 1; }
.eyebrow {
  font: 600 12px/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--primary); margin: 0 0 10px;
}
h1 { font-size: clamp(22px, 3vw, 30px); line-height: 1.2; letter-spacing: -0.02em; margin: 0 0 8px; }
h2 { font-size: 18px; letter-spacing: -0.01em; margin: 0 0 4px; }
h3 { font-size: 13px; margin: 18px 0 8px; color: var(--fg-muted); font-weight: 600; }
.lede { color: var(--fg-muted); margin: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; border-radius: 999px;
  padding: 3px 10px; background: var(--raised); color: var(--fg-muted); white-space: nowrap;
}
.chip.good { background: var(--good-bg); color: var(--good-fg); }
.chip.bad { background: var(--bad-bg); color: var(--bad-fg); }
.chip.warn { background: var(--warn-bg); color: var(--warn-fg); }
.chip.info { background: var(--info-bg); color: var(--info-fg); }
.chip.accent { background: var(--primary-soft); color: var(--fg); }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 10px; margin-top: 20px; }
.tile { background: var(--raised); border-radius: 12px; padding: 12px 14px; }
.tile b { display: block; font-size: 20px; letter-spacing: -0.02em; }
.tile span { color: var(--fg-muted); font: 500 11.5px/1 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; }
details.answer { margin-top: 16px; }
details summary { cursor: pointer; color: var(--fg-muted); }
details summary:hover { color: var(--fg); }

section { margin-top: 28px; }
.section-lede { color: var(--fg-muted); margin: 0 0 14px; max-width: 900px; }
.notice { background: var(--warn-bg); color: var(--warn-fg); border-radius: 10px; padding: 10px 14px; margin-top: 14px; }

.board { display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 16px; align-items: start; }
@media (max-width: 1080px) { .board { grid-template-columns: minmax(0, 1fr); } }
.flow { padding: 0; overflow: hidden; display: flex; flex-direction: column; }
.toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
.toolbar .grow { flex: 1; }
.legend { display: flex; flex-wrap: wrap; gap: 14px; color: var(--fg-muted); font-size: 12px; }
.legend i { display: inline-block; width: 18px; height: 0; border-top: 2px solid; vertical-align: middle; margin-right: 6px; }
.legend .l-taken i { border-color: var(--primary); border-top-width: 3px; }
.legend .l-now i { border-color: var(--fg); border-top-width: 3px; }
.legend .l-trouble i { border-color: var(--warn-fg); border-top-width: 3px; }
.legend .l-person i { border-color: var(--info-fg); border-top-width: 3px; }
.legend .l-error i { border-color: var(--bad-fg); border-top-width: 3px; }
.legend .l-not i { border-color: var(--fg-faint); border-top-style: dashed; }
.canvas { overflow: auto; height: min(78vh, 900px); cursor: grab; background:
  radial-gradient(circle, var(--border) 1px, transparent 1.2px) 0 0 / 18px 18px; }
.canvas.dragging { cursor: grabbing; }
.canvas svg { display: block; }

.player { display: grid; grid-template-columns: auto 1fr auto; gap: 12px; align-items: center; padding: 12px 14px; border-top: 1px solid var(--border); }
.player .buttons { display: flex; gap: 6px; }
.player button {
  border: 0; background: var(--raised); border-radius: 8px; width: 34px; height: 30px; cursor: pointer; color: var(--fg-muted);
}
.player button:hover { color: var(--fg); }
.player button.play { background: var(--primary); color: var(--on-primary); }
.player input[type='range'] { width: 100%; accent-color: var(--primary); }
.player .where { font: 600 13px/1.2 var(--mono); color: var(--fg-muted); white-space: nowrap; }
.ticks { grid-column: 1 / -1; display: flex; height: 10px; gap: 1px; }
.ticks { height: 16px; align-items: flex-end; }
.ticks span { flex: 1; height: 8px; border-radius: 2px; background: var(--fg-faint); opacity: 0.35; cursor: pointer; }
.ticks span.gap { margin-left: 4px; }
.ticks span.s-ok, .ticks span.s-done { background: var(--good-fg); opacity: 0.45; }
.ticks span.s-rejected { background: var(--warn-fg); opacity: 0.8; }
.ticks span.s-failed, .ticks span.s-error { background: var(--bad-fg); opacity: 0.8; }
.ticks span.s-denied { background: var(--violet-fg); opacity: 0.8; }
.ticks span.decide { height: 16px; opacity: 1; }
.ticks span.asked { background: var(--info-fg); opacity: 0.9; height: 12px; }
.ticks span.at { opacity: 1; height: 16px; outline: 2px solid var(--primary); outline-offset: 1px; }
.jumps { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 14px; border-bottom: 1px solid var(--border); }
.jumps .chip { border: 0; cursor: pointer; font: inherit; font-size: 12.5px; }
.ctx { display: inline-block; margin-bottom: 10px; padding: 3px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: var(--raised); color: var(--fg-muted); cursor: pointer; text-decoration: none; }
.ctx.s-rejected { background: var(--warn-bg); color: var(--warn-fg); }
.ctx.s-failed, .ctx.s-error { background: var(--bad-bg); color: var(--bad-fg); }
.ctx.s-denied { background: var(--violet-bg); color: var(--violet-fg); }
.ctx.s-ok { background: var(--good-bg); color: var(--good-fg); }
.reason.t-trouble, .reason.t-limit { background: var(--warn-bg); color: var(--warn-fg); }
.reason.t-person { background: var(--info-bg); color: var(--info-fg); }
.reason.t-error { background: var(--bad-bg); color: var(--bad-fg); }
.reason:not([class*=' o-']):not([class*=' t-']) { background: var(--raised); color: var(--fg); font-weight: 500; }

/* what happened */
.offered { color: var(--fg-muted); font-size: 13px; margin: 12px 0 0; }
.chip.o-failed, .call.o-failed .badge, .bar .o-failed { background: var(--bad-bg); color: var(--bad-fg); }
.chip.o-rejected, .call.o-rejected .badge, .bar .o-rejected { background: var(--warn-bg); color: var(--warn-fg); }
.chip.o-denied, .call.o-denied .badge, .bar .o-denied { background: var(--violet-bg); color: var(--violet-fg); }
.chip.o-pending, .call.o-pending .badge, .bar .o-pending { background: var(--raised); color: var(--fg-muted); }
.chip.o-ok, .call.o-ok .badge, .bar .o-ok { background: var(--good-bg); color: var(--good-fg); }
.bar .o-ok { background: var(--good-fg); }
.bar .o-failed { background: var(--bad-fg); }
.bar .o-rejected { background: var(--warn-fg); }
.bar .o-denied { background: var(--violet-fg); }
.tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 14px; }
.tool { padding: 14px 16px; box-shadow: var(--shadow-soft); }
.tool.trouble { box-shadow: var(--shadow-soft), inset 3px 0 0 var(--bad-fg); }
.tool-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.tool-head code { font-size: 14px; background: none; padding: 0; }
.muted { color: var(--fg-muted); font-size: 12.5px; }
.bar { display: flex; height: 6px; border-radius: 3px; overflow: hidden; margin: 10px 0 2px; gap: 2px; background: var(--raised); }
.tool .chips { margin-top: 8px; }
.problems { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px; color: var(--fg-muted); }
.problems .count { font: 700 12px var(--mono); color: var(--bad-fg); }
.timeline { padding: 6px 0; }
.round { padding: 12px 20px; border-top: 1px solid var(--border); }
.round:first-child { border-top: 0; }
.round-head { display: flex; align-items: baseline; gap: 10px; }
.round-head .step { margin-left: auto; }
.round blockquote { margin: 8px 0 4px; padding: 6px 12px; border-left: 3px solid var(--primary); color: var(--fg); white-space: pre-wrap; font-size: 13.5px; background: var(--raised); border-radius: 0 8px 8px 0; }
.call { margin-top: 6px; border-radius: 10px; background: var(--raised); }
.call summary { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 7px 10px; list-style: none; }
.call summary::-webkit-details-marker { display: none; }
.call summary code { background: none; padding: 0; }
.call .badge { font: 700 10.5px/1 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 7px; border-radius: 6px; }
.call .args { color: var(--fg-muted); font: 500 12px var(--mono); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 160px; }
.call .detail { color: var(--bad-fg); font-size: 12.5px; flex-basis: 100%; }
.call.o-rejected .detail { color: var(--warn-fg); }
.call.o-denied .detail { color: var(--violet-fg); }
.call .muted { margin-left: auto; }
.call .sides { padding: 0 10px 10px; }
.call[open] { box-shadow: inset 0 0 0 1px var(--border); }

/* the run's flowchart */
.views { display: flex; gap: 4px; padding: 3px; background: var(--raised); border-radius: 999px; }
.views .pill { box-shadow: none; background: none; }
.views .pill[aria-pressed='true'] { background: var(--surface); color: var(--fg); box-shadow: var(--shadow-soft); }
.machine-only { display: none !important; }
.on-machine .machine-only { display: flex !important; }
.on-machine button.machine-only { display: inline-block !important; }
.on-machine .flow-only { display: none !important; }
.legend span i { border-color: currentColor; }
.legend .o-ok { color: var(--good-fg); }
.legend .o-failed { color: var(--bad-fg); }
.legend .o-rejected { color: var(--warn-fg); }
.legend .o-denied { color: var(--violet-fg); }
.legend .o-ok i, .legend .o-failed i, .legend .o-rejected i, .legend .o-denied i { border-top-width: 3px; }
.fn { cursor: pointer; }
.fn .body { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; }
.fn .title { fill: var(--fg); font: 700 13.5px 'Geist', sans-serif; }
.fn .title.mono { font: 700 13.5px var(--mono); }
.fn .meta { fill: var(--fg-muted); font: 500 11.5px var(--mono); }
.fn .line { fill: var(--fg-muted); font: 500 12.5px 'Geist', sans-serif; }
.fn .badge { fill: var(--info-fg); font: 600 11.5px 'Geist', sans-serif; }
.fn .pill-t { font: 700 10px var(--mono); letter-spacing: 0.06em; }
.fn.k-start .body, .fn.k-round .body { fill: var(--raised); }
.fn.k-round .title::before { content: ''; }
.fn.k-handoff .body { fill: var(--info-bg); stroke: var(--info-fg); stroke-width: 2; }
.fn.k-handoff .title { fill: var(--info-fg); }
.fn.k-steer .body { fill: var(--raised); stroke: var(--primary); stroke-width: 2; stroke-dasharray: 6 3; }
.fn.k-steer .title { fill: var(--primary); }
.fn.s-ok .body { stroke: var(--good-fg); }
.fn.s-ok .pill { fill: var(--good-bg); } .fn.s-ok .pill-t { fill: var(--good-fg); }
.fn.s-failed .body { stroke: var(--bad-fg); stroke-width: 2.5; fill: var(--bad-bg); }
.fn.s-failed .pill { fill: var(--bad-fg); } .fn.s-failed .pill-t { fill: var(--surface); }
.fn.s-failed .line { fill: var(--bad-fg); font-weight: 600; }
.fn.s-rejected .body { stroke: var(--warn-fg); stroke-width: 2.5; fill: var(--warn-bg); }
.fn.s-rejected .pill { fill: var(--warn-fg); } .fn.s-rejected .pill-t { fill: var(--surface); }
.fn.s-rejected .line { fill: var(--warn-fg); font-weight: 600; }
.fn.s-denied .body { stroke: var(--violet-fg); stroke-width: 2.5; fill: var(--violet-bg); }
.fn.s-denied .pill { fill: var(--violet-fg); } .fn.s-denied .pill-t { fill: var(--surface); }
.fn.s-denied .line { fill: var(--violet-fg); font-weight: 600; }
.fn.s-pending .body { stroke: var(--fg-faint); stroke-dasharray: 5 3; }
.fn.s-pending .pill { fill: var(--raised); } .fn.s-pending .pill-t { fill: var(--fg-muted); }
.fn.s-done .body { stroke: var(--good-fg); stroke-width: 2.5; }
.fn.s-error .body { stroke: var(--bad-fg); stroke-width: 2.5; fill: var(--bad-bg); }
.fn.s-error .line { fill: var(--bad-fg); }
.fn.now .body { filter: drop-shadow(0 0 7px var(--primary)) drop-shadow(0 0 2px var(--primary)); }
.fn.picked .body { stroke: var(--info-fg); stroke-width: 3.5; }
.fn:hover .body { filter: brightness(1.06); }
.fe { fill: none; stroke: var(--fg-faint); stroke-width: 1.6; }
.fe.s-failed { stroke: var(--bad-fg); stroke-width: 2.2; }
.fe.s-rejected { stroke: var(--warn-fg); stroke-width: 2.2; }
.fe.s-denied { stroke: var(--violet-fg); stroke-width: 2.2; }
.reason { border-radius: 10px; padding: 10px 12px; margin: 12px 0; font-size: 13.5px; font-weight: 600; white-space: pre-wrap; overflow-wrap: anywhere; }
.reason.o-failed { background: var(--bad-bg); color: var(--bad-fg); }
.reason.o-rejected { background: var(--warn-bg); color: var(--warn-fg); }
.reason.o-denied { background: var(--violet-bg); color: var(--violet-fg); }
.reason.o-pending { background: var(--raised); color: var(--fg-muted); }
details.mstep { border-top: 1px solid var(--border); padding: 6px 0; }
details.mstep > summary { font-size: 13px; }
details.mstep > summary .idx { font: 600 12px var(--mono); color: var(--fg-muted); margin-right: 6px; }
details.mstep[open] { padding-bottom: 12px; }
details.mstep.at > summary { color: var(--primary); font-weight: 600; }
details.mstep .kicker { display: none; }
details.mstep h2 { font-size: 14px; }

/* the chart */
.n rect, .n circle { fill: var(--surface); stroke: var(--border); stroke-width: 1.5; }
.n text { fill: var(--fg); font: 600 13px var(--mono); }
.n .grp { fill: var(--fg-muted); font: 600 9.5px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; }
.n .count { fill: var(--fg-muted); font: 500 11px var(--mono); }
.n.unvisited rect { fill: var(--raised); stroke-dasharray: 4 3; }
.n.unvisited text { fill: var(--fg-faint); }
.n.visited rect { stroke: var(--primary); }
.n.final rect { stroke-width: 3; stroke: var(--fg-muted); }
.n.final.visited rect { stroke: var(--good-fg); }
.n.start circle { fill: var(--fg); stroke: none; }
.n.any rect { fill: var(--raised); stroke: var(--fg-faint); stroke-dasharray: 5 3; }
.n.any text { fill: var(--fg-muted); font-style: italic; }
.n.history circle { fill: var(--raised); }
.n.now rect, .n.now circle { stroke: var(--fg); stroke-width: 3; filter: drop-shadow(0 0 6px var(--primary)); }
.n.via rect { stroke: var(--fg); stroke-dasharray: 3 3; stroke-width: 2; }
.n.picked rect, .n.picked circle { stroke: var(--info-fg); stroke-dasharray: 7 3; stroke-width: 3; }
.n { cursor: pointer; }
.e .line { fill: none; stroke: var(--fg-faint); stroke-width: 1.2; stroke-dasharray: 4 4; }
.e .lab rect { fill: var(--surface); }
.e .lab text { fill: var(--fg-faint); font: 500 11px var(--mono); }
.e.taken .line { stroke: var(--primary); stroke-dasharray: none; }
.e.taken .lab text { fill: var(--fg); }
.e.taken .lab .n-taken { fill: var(--primary); font-weight: 700; }
.e.hot .line { stroke: var(--fg) !important; stroke-width: 3.5 !important; }
.e.hot .lab rect { fill: var(--surface); stroke: var(--fg); stroke-width: 1.5; }
.e.hot .lab text { fill: var(--fg); }
.ord circle { fill: var(--fg); }
.ord text { fill: var(--surface); font: 700 11px var(--mono); }
.callout rect { fill: var(--surface); stroke-width: 2; filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.25)); }
.callout text { fill: var(--fg); font: 500 12.5px 'Geist', sans-serif; }
.callout text.head { font-weight: 700; }
.callout.s-rejected rect { stroke: var(--warn-fg); } .callout.s-rejected text.head { fill: var(--warn-fg); }
.callout.s-failed rect { stroke: var(--bad-fg); } .callout.s-failed text.head { fill: var(--bad-fg); }
.callout.s-denied rect { stroke: var(--violet-fg); } .callout.s-denied text.head { fill: var(--violet-fg); }
.e.picked .line { stroke: var(--info-fg); stroke-width: 4 !important; }
.e { cursor: pointer; }
.e .hit { stroke: transparent; stroke-width: 14; stroke-dasharray: none; fill: none; }

/* what states mean, on the machine */
.n.t-trouble.visited rect { stroke: var(--warn-fg); stroke-width: 2.5; fill: var(--warn-bg); }
.n.t-person.visited rect { stroke: var(--info-fg); stroke-width: 2.5; fill: var(--info-bg); }
.n.t-limit.visited rect { stroke: var(--warn-fg); stroke-width: 2.5; }
.n.t-error.visited rect { stroke: var(--bad-fg); stroke-width: 2.5; fill: var(--bad-bg); }
.n.t-trouble.unvisited rect, .n.t-limit.unvisited rect { stroke: var(--warn-fg); stroke-opacity: 0.5; }
.n.t-error.unvisited rect { stroke: var(--bad-fg); stroke-opacity: 0.5; }
.e.taken.to-trouble .line, .e.taken.to-limit .line { stroke: var(--warn-fg); }
.e.taken.to-person .line { stroke: var(--info-fg); }
.e.taken.to-error .line { stroke: var(--bad-fg); }
.e.to-trouble .lab text, .e.to-limit .lab text { fill: var(--warn-fg); }
.e.to-error .lab text { fill: var(--bad-fg); }
.tb { cursor: pointer; }
.tb rect { stroke: var(--surface); stroke-width: 2; }
.tb text { font: 700 10.5px var(--mono); }
.tb.o-rejected rect { fill: var(--warn-fg); } .tb.o-rejected text { fill: var(--surface); }
.tb.o-failed rect { fill: var(--bad-fg); } .tb.o-failed text { fill: var(--surface); }
.tb.o-denied rect { fill: var(--violet-fg); } .tb.o-denied text { fill: var(--surface); }
.tb.o-ok rect { fill: var(--good-fg); } .tb.o-ok text { fill: var(--surface); }

/* the side panel */
.panel { padding: 18px 20px 20px; position: sticky; top: 12px; max-height: calc(100vh - 24px); overflow: auto; }
.panel .kicker { font: 600 11.5px/1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--primary); margin-bottom: 8px; }
.panel h2 { font-size: 17px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.panel .meta { color: var(--fg-muted); font-size: 13px; margin: 4px 0 0; }
.route { font: 600 13.5px var(--mono); }
.route .to { color: var(--primary); }
.why { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.why li { border-radius: 10px; padding: 8px 10px; background: var(--raised); }
.why li.taken { background: var(--good-bg); box-shadow: inset 3px 0 0 var(--good-fg); }
.why li.rejected { opacity: 0.8; }
.why li.bad { background: var(--warn-bg); box-shadow: inset 3px 0 0 var(--warn-fg); }
.why li.bad .v { color: var(--warn-fg); }
.why li .v { font: 700 11px/1 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; margin-right: 6px; }
.why li.taken .v { color: var(--good-fg); }
.why li.taken.t-trouble, .why li.taken.t-limit { background: var(--warn-bg); box-shadow: inset 3px 0 0 var(--warn-fg); }
.why li.taken.t-trouble .v, .why li.taken.t-limit .v { color: var(--warn-fg); }
.why li.taken.t-person { background: var(--info-bg); box-shadow: inset 3px 0 0 var(--info-fg); }
.why li.taken.t-person .v { color: var(--info-fg); }
.why li.taken.t-error { background: var(--bad-bg); box-shadow: inset 3px 0 0 var(--bad-fg); }
.why li.taken.t-error .v { color: var(--bad-fg); }
.why li.rejected .v { color: var(--fg-muted); }
.why li.unchecked .v, .why li.unevaluable .v { color: var(--fg-muted); }
.why .guard { font: 600 12.5px var(--mono); }
.why .facts { color: var(--fg-muted); font-size: 12.5px; margin-top: 3px; }
.why .parts { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.kv { display: grid; grid-template-columns: minmax(90px, max-content) minmax(0, 1fr); gap: 4px 12px; font-size: 12.5px; }
.kv > div:nth-child(odd) { color: var(--fg-muted); font-family: var(--mono); font-weight: 600; overflow-wrap: anywhere; }
.kv > div { min-width: 0; overflow-wrap: anywhere; }
.change { border-top: 1px solid var(--border); padding: 8px 0; }
.change .path { font: 600 12.5px var(--mono); overflow-wrap: anywhere; }
details.raw { margin-top: 14px; }
.sides { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px; }
.sides > div { min-width: 0; }
.sides small { color: var(--fg-muted); font: 600 10.5px var(--mono); text-transform: uppercase; letter-spacing: 0.06em; }
pre.json {
  margin: 2px 0 0; padding: 8px 10px; background: var(--raised); border-radius: 8px; font: 500 12px/1.45 var(--mono);
  white-space: pre-wrap; overflow-wrap: anywhere; max-height: 360px; overflow: auto;
}
.val { font: 500 12.5px var(--mono); overflow-wrap: anywhere; }
.msg { border-radius: 10px; background: var(--raised); padding: 8px 10px; margin-top: 6px; }
.msg .role { font: 700 11px var(--mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--info-fg); }
.msg .body { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; margin-top: 2px; }
.list { list-style: none; padding: 0; margin: 0; display: grid; gap: 2px; }
.list li { display: grid; grid-template-columns: 48px 1fr auto; gap: 8px; align-items: baseline; padding: 6px 8px; border-radius: 8px; cursor: pointer; }
.list li:hover { background: var(--raised); }
.list li.at { background: var(--warn-bg); }
.list .idx { font: 600 12px var(--mono); color: var(--fg-muted); }
.list .t { color: var(--fg-muted); font: 500 11.5px var(--mono); }
.list .kind-request .what { color: var(--info-fg); }
.list .kind-receipt .what { color: var(--violet-fg); }
.list .facts .what { color: var(--fg-faint); }
.tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.empty { color: var(--fg-muted); }
a.step { color: var(--primary); cursor: pointer; font: 600 12.5px var(--mono); text-decoration: none; }
a.step:hover { text-decoration: underline; }
.steps-inline { display: flex; flex-wrap: wrap; gap: 4px 8px; }

/* a live page, before its run's first step */
.waiting { min-height: 70vh; display: grid; place-items: center; padding: 32px; }
.waiting-card {
  width: min(520px, 100%); display: flex; flex-direction: column; align-items: center; gap: 20px;
  padding: 48px 40px 40px; border-radius: 20px; background: var(--surface); box-shadow: var(--shadow-card);
  text-align: center;
}
.waiting-mark { color: var(--primary); }
.waiting-mark svg { display: block; height: 34px; width: auto; }
.waiting-kicker {
  font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fg-muted);
}
.waiting-title { margin: 4px 0 0; font-size: 26px; font-weight: 600; letter-spacing: -0.01em; color: var(--fg); }
.waiting-lede { margin: 0; max-width: 38ch; color: var(--fg-muted); line-height: 1.55; }
.waiting-pulse { display: flex; gap: 8px; padding: 6px 0 2px; }
.waiting-pulse span {
  width: 9px; height: 9px; border-radius: 50%; background: var(--primary);
  animation: waiting-pulse 1.4s ease-in-out infinite;
}
.waiting-pulse span:nth-child(2) { animation-delay: 0.18s; }
.waiting-pulse span:nth-child(3) { animation-delay: 0.36s; }
@keyframes waiting-pulse { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .waiting-pulse span { animation: none; opacity: 0.6; } }
.waiting-source {
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  padding: 6px 12px; border-radius: 999px; background: var(--raised); color: var(--fg-muted);
  font: 600 13px var(--mono);
}

/* a live page: the pill that says where the run is, its tabs, and the way back to the tail */
.topbar-end { display: flex; align-items: center; gap: 10px; }
.live-pill {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 10px; border-radius: 999px;
  background: var(--surface); box-shadow: var(--shadow-soft); color: var(--fg-muted);
  font: 600 12.5px/1 var(--mono); letter-spacing: 0.02em; white-space: nowrap; max-width: 52vw; overflow: hidden; text-overflow: ellipsis;
}
.live-pill i { width: 8px; height: 8px; border-radius: 50%; background: var(--fg-faint); flex: none; }
.live-pill.is-live { color: var(--fg); }
.live-pill.is-live i { background: var(--bad-fg); box-shadow: 0 0 0 0 var(--bad-fg); animation: live-dot 1.6s ease-out infinite; }
.live-pill.is-ended i { background: var(--good-fg); }
.live-pill.is-waiting i { background: var(--primary); animation: live-dot 1.6s ease-out infinite; }
.live-pill.is-off i { background: var(--warn-fg); }
@keyframes live-dot { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 0%, transparent); opacity: 1; } 70% { box-shadow: 0 0 0 7px transparent; opacity: 0.55; } 100% { opacity: 1; } }
.run-tabs { display: flex; gap: 6px; overflow-x: auto; padding: 0 0 14px; }
.run-tabs[hidden] { display: none; }
.run-tab {
  display: inline-flex; align-items: baseline; gap: 8px; border: 0; cursor: pointer; white-space: nowrap;
  padding: 7px 14px; border-radius: 999px; background: var(--surface); box-shadow: var(--shadow-soft); color: var(--fg-muted);
}
.run-tab b { font-weight: 600; color: var(--fg); }
.run-tab span { font-size: 12.5px; }
.run-tab.on { background: var(--primary-soft); }
.run-tab .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--bad-fg); align-self: center; animation: live-dot 1.6s ease-out infinite; }
.new-run {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 14px;
  padding: 10px 12px 10px 16px; border-radius: 12px; background: var(--info-bg); color: var(--info-fg); font-weight: 500;
}
.new-run[hidden] { display: none; }
.canvas-wrap { position: relative; }
.to-live {
  position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); border: 0; cursor: pointer;
  padding: 9px 16px; border-radius: 999px; background: var(--primary); color: var(--on-primary);
  font: 600 13px/1 'Geist', sans-serif; box-shadow: var(--shadow-card); animation: to-live-in 0.2s ease-out;
}
.to-live[hidden] { display: none; }
@keyframes to-live-in { from { opacity: 0; transform: translate(-50%, 8px); } }
.player.at-live .where::after {
  content: 'LIVE'; margin-left: 8px; padding: 2px 6px; border-radius: 4px; background: var(--bad-fg); color: var(--surface);
  font: 700 10px/1 var(--mono); letter-spacing: 0.08em; vertical-align: 1px;
}
.fn.arrived { animation: arrive 0.6s ease-out; }
@keyframes arrive { from { opacity: 0; } }
.fn.live-head .body { stroke: var(--primary); stroke-width: 2.5; stroke-dasharray: 8 6; animation: live-head 1s linear infinite; }
@keyframes live-head { to { stroke-dashoffset: -28; } }
body.waiting-for-run #hero-slot, body.waiting-for-run #flow { display: none; }
body:not(.waiting-for-run) #waiting { display: none; }
@media (prefers-reduced-motion: reduce) {
  .live-pill i, .run-tab .dot, .fn.arrived, .fn.live-head .body, .to-live { animation: none; }
}

/* a live page is the run itself: a slim header, and the flowchart and panel filling the window */
@media (min-width: 1081px) {
  body[data-live]:not(.waiting-for-run) main { height: 100vh; display: flex; flex-direction: column; padding-bottom: 14px; }
  body[data-live] .topbar { padding: 12px 0; }
  body[data-live] #flow { flex: 1; min-height: 0; display: flex; flex-direction: column; margin-top: 12px; }
  body[data-live] .board { flex: 1; min-height: 0; align-items: stretch; grid-template-rows: minmax(0, 1fr); }
  body[data-live] .flow { min-height: 0; }
  body[data-live] .canvas-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  body[data-live] .canvas { flex: 1; height: auto; min-height: 0; }
  body[data-live] .panel { position: static; max-height: none; min-height: 0; overflow: auto; }
}
body[data-live] #flow > h2, body[data-live] #flow > .section-lede { display: none; }
body[data-live] .hero { padding: 14px 20px 14px; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 24px; align-items: center; }
body[data-live] .hero::after { width: 220px; height: 220px; }
body[data-live] .hero .eyebrow { margin-bottom: 6px; font-size: 11px; }
body[data-live] .hero h1 { font-size: 19px; margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
body[data-live] .hero .lede { font-size: 13px; }
body[data-live] .hero .chips { margin-top: 8px; }
body[data-live] .hero .offered, body[data-live] .hero details.answer, body[data-live] .hero .notice { display: none; }
body[data-live] .hero .tiles { grid-column: 2; grid-row: 1 / span 4; margin: 0; display: flex; gap: 8px; }
body[data-live] .hero .tile { padding: 8px 12px; min-width: 76px; }
body[data-live] .hero .tile b { font-size: 16px; }
body[data-live] .hero .tile span { font-size: 10px; }
@media (max-width: 1080px) {
  body[data-live] .hero { grid-template-columns: minmax(0, 1fr); }
  body[data-live] .hero .tiles { grid-column: 1; grid-row: auto; margin-top: 10px; flex-wrap: wrap; }
}

/* a run, or a call, still going */
.chip.running { background: var(--primary-soft); color: var(--fg); }
.chip.running::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--bad-fg); animation: live-dot 1.6s ease-out infinite; }
.fn.s-running .body { stroke: var(--primary); stroke-width: 2; stroke-dasharray: 8 6; fill: var(--surface); animation: live-head 1s linear infinite; }
.fn.s-running .pill { fill: var(--primary-soft); } .fn.s-running .pill-t { fill: var(--primary); }
.fn.k-end.s-running .title { fill: var(--primary); }
.fe.s-running { stroke-dasharray: 4 4; }
.ticks span.s-running { background: var(--primary); opacity: 0.8; }
.ctx.s-running { background: var(--primary-soft); color: var(--fg); }
.reason.o-running { display: flex; align-items: center; gap: 10px; background: var(--primary-soft); color: var(--fg); }
.spin { width: 14px; height: 14px; flex: none; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--primary) 30%, transparent); border-top-color: var(--primary); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .chip.running::before, .fn.s-running .body, .spin { animation: none; } }
`;
