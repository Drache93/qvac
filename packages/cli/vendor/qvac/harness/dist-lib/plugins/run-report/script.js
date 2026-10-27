export const SCRIPT = String.raw `
(function () {
  var linked = Number(location.hash.slice(1))
  var root = document.documentElement
  var liveMode = document.body.dataset.live === '1'
  // the run on the page; load() sets them, again each time a live run grows
  var data = null
  var run = null
  var steps = []
  var byIndex = {}
  var nodes = {}
  var routes = {}
  var charts = {}
  var svg = null
  var flowSvg = null
  var flowNodes = {}
  var ownerOfStep = {}
  var board = document.querySelector('.board')
  var canvas = document.getElementById('canvas')
  var panel = document.getElementById('panel')
  var scrub = document.getElementById('scrub')
  var where = document.getElementById('where')
  var ticks = document.getElementById('ticks')
  var state = { pos: 0, facts: false, follow: true, view: 'step', picked: null, timer: null, scale: 1, chart: 'flow', whole: false }
  function visible() { return state.chart === 'flow' ? flowSvg : svg }
  var played = []
  // set while a live update redraws: playback keeps its place and the canvas stays where it is
  var quiet = false

  function load(next) {
    data = next
    run = data.run
    steps = data.steps
    byIndex = {}
    steps.forEach(function (step, i) { byIndex[step.index] = i })
    nodes = {}
    data.nodes.forEach(function (node) { nodes[node.id] = node })
    routes = {}
    data.routes.forEach(function (route) { routes[route.key] = route })
    charts = { run: document.getElementById('chart-run'), all: document.getElementById('chart-all') }
    svg = state.whole && charts.all ? charts.all : charts.run
    flowSvg = document.getElementById('chart-flow')
    flowNodes = {}
    ownerOfStep = {}
    data.flow.forEach(function (node) {
      flowNodes[node.id] = node
      node.steps.forEach(function (index) { ownerOfStep[index] = node.id })
    })
    // the charts keep the view the reader chose
    flowSvg.style.display = state.chart === 'flow' ? '' : 'none'
    if (charts.run) charts.run.style.display = 'none'
    if (charts.all) charts.all.style.display = 'none'
    if (svg && state.chart === 'machine') svg.style.display = ''
    zoom(state.scale)
  }

  // ---- theme, as the bench pages keep it
  var themeButton = document.getElementById('theme')
  function dark() { return root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches }
  function themeLabel() { themeButton.textContent = dark() ? 'Light mode' : 'Dark mode' }
  try { var saved = localStorage.getItem('qvac-theme'); if (saved) root.dataset.theme = saved } catch (e) {}
  themeLabel()
  themeButton.addEventListener('click', function () {
    root.dataset.theme = dark() ? 'light' : 'dark'
    try { localStorage.setItem('qvac-theme', root.dataset.theme) } catch (e) {}
    themeLabel()
  })

  // ---- helpers
  function esc(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
  function short(id) { return String(id).replace(/^completion\./, '').replace(/^active\./, '') }
  function leaves(value, prefix) {
    if (typeof value === 'string') return [prefix ? prefix + '.' + value : value]
    if (value && typeof value === 'object') {
      return Object.keys(value).reduce(function (out, key) {
        return out.concat(leaves(value[key], prefix ? prefix + '.' + key : key))
      }, [])
    }
    return []
  }
  function place(value) { return leaves(value, '').map(short).join(', ') || '?' }
  function activeIds(value, prefix) {
    if (typeof value === 'string') return [prefix + '.' + value]
    if (value && typeof value === 'object') {
      return Object.keys(value).reduce(function (out, key) {
        return out.concat([prefix + '.' + key], activeIds(value[key], prefix + '.' + key))
      }, [])
    }
    return []
  }
  function eventName(type) {
    if (!type || type === 'always') return 'always'
    if (type.indexOf('xstate.done.actor.') === 0) return 'done'
    if (type.indexOf('xstate.error.actor.') === 0) return 'error'
    if (type.indexOf('xstate.after.') === 0) return 'after ' + (type.split('.')[2] || '')
    return type
  }
  function since(at) {
    if (!run.startedAt || !at) return ''
    var s = (at - run.startedAt) / 1000
    return '+' + (s < 10 ? s.toFixed(2) : s < 100 ? s.toFixed(1) : Math.round(s)) + ' s'
  }
  function value(v) {
    if (v === undefined) return '<span class="val empty">none</span>'
    var text = JSON.stringify(v)
    if (text === undefined) text = String(v)
    if (text.length <= 72) return '<span class="val">' + esc(text) + '</span>'
    var pretty = JSON.stringify(v, null, 2)
    var preview = text.slice(0, 64) + '…'
    return '<details><summary><span class="val">' + esc(preview) + '</span> <span class="t">' + text.length + ' chars</span></summary><pre class="json">' + esc(pretty) + '</pre></details>'
  }
  function stepLink(index) {
    return '<a class="step" data-step="' + index + '">#' + index + '</a>'
  }
  function stepLinks(list) {
    if (!list || list.length === 0) return '<span class="empty">none</span>'
    return '<div class="steps-inline">' + list.map(stepLink).join('') + '</div>'
  }
  function routeText(source, targets) {
    return '<span class="route">' + esc(short(source)) + ' → <span class="to">' + esc(targets.map(short).join(', ') || 'stays') + '</span></span>'
  }

  // ---- which steps playback walks
  // a step that waits on a person: the machine sits in approving, or it is the answer itself
  function asking(step) {
    if (step.kind === 'receipt') return step.name === 'human:approve'
    return step.kind === 'transition' && activeIds(step.to, 'completion').indexOf('completion.active.tools.approving') >= 0
  }

  // which round and call a step happened in, in words
  function whereIn(node) {
    if (node.kind === 'call') return 'Round ' + (node.round + 1) + ' · ' + node.title + ' · ' + (node.status === 'pending' ? 'no result' : node.status)
    return node.title
  }

  function context(step) {
    var node = flowNodes[ownerOfStep[step.index]]
    if (!node) return ''
    return '<a class="ctx s-' + node.status + '" data-flow="' + esc(node.id) + '" title="Show this box of the run">' + esc(whereIn(node)) + '</a>'
  }

  function plays(step) { return state.facts || step.kind !== 'transition' || !step.facts }
  // keeps playback on the step it was on, by index: a live update brings new step objects
  function rebuild(atIndex) {
    var at = atIndex === undefined ? (played[state.pos] ? played[state.pos].index : null) : atIndex
    played = steps.filter(plays)
    var pos = at === null ? -1 : played.findIndex(function (step) { return step.index >= at })
    state.pos = Math.max(0, pos)
    scrub.max = String(Math.max(0, played.length - 1))
    // each tick takes the color of the box it happened in; the step that decided a call stands tall
    var last = null
    ticks.innerHTML = played.map(function (step, i) {
      var node = flowNodes[ownerOfStep[step.index]]
      var cls = node ? 's-' + node.status : ''
      if (node && node.kind === 'call' && node.from === step.index) cls += ' decide'
      if (asking(step)) cls += ' asked'
      if (node && last && node.round !== last.round) cls += ' gap'
      last = node
      var tip = '#' + step.index + (node ? ' · ' + whereIn(node) : '')
      return '<span class="' + cls + '" data-pos="' + i + '" title="' + esc(tip) + '"></span>'
    }).join('')
  }

  // the machine's state at a step: its own target, or the last transition before it
  function stateAt(i) {
    for (var j = byIndex[played[i].index]; j >= 0; j--) {
      if (steps[j].kind === 'transition') return steps[j].to
    }
    return null
  }

  function show(pos) {
    if (played.length === 0) return
    state.pos = Math.max(0, Math.min(played.length - 1, pos))
    var step = played[state.pos]
    scrub.value = String(state.pos)
    where.textContent = 'step ' + (state.pos + 1) + ' of ' + played.length + ' · #' + step.index
    if (!liveMode) { try { history.replaceState(null, '', '#' + step.index) } catch (e) {} }
    Array.prototype.forEach.call(ticks.children, function (tick, i) { tick.classList.toggle('at', i === state.pos) })
    var owner = ownerOfStep[step.index]
    flowSvg.querySelectorAll('.fn').forEach(function (el) { el.classList.toggle('now', el.dataset.node === owner) })
    if (state.follow && !quiet && state.chart === 'flow') keepInView(flowSvg.querySelector('.fn[data-node="' + owner + '"]'))
    var now = {}
    activeIds(stateAt(state.pos), 'completion').forEach(function (id) { now[id] = true })
    if (svg) {
      var via = {}
      if (step.kind === 'transition') step.entered.forEach(function (id) { if (!now[id]) via[id] = true })
      svg.querySelectorAll('.n').forEach(function (el) {
        el.classList.toggle('now', !!now[el.dataset.id])
        el.classList.toggle('via', !!via[el.dataset.id])
      })
      var hot = {}
      var taken = step.kind === 'transition' ? step.taken : []
      taken.forEach(function (key, i) { hot[key] = i + 1 })
      svg.querySelectorAll('.ord').forEach(function (el) { el.remove() })
      svg.querySelectorAll('.e').forEach(function (el) {
        var order = hot[el.dataset.key]
        el.classList.toggle('hot', !!order)
        arrowHead(el)
        if (order && taken.length > 1) number(el, order)
      })
      var said = callout(step, now)
      if (said && state.follow && !quiet && state.chart === 'machine') keepInView(said)
      if (state.follow && !quiet && state.chart === 'machine') follow(step, now)
    }
    if (state.view === 'step' || state.view === 'list') render()
  }

  // a step that took several routes numbers them in the order it took them
  function number(el, order) {
    var box = el.querySelector('.lab rect')
    if (!box) return
    var x = Number(box.getAttribute('x')) - 9
    var y = Number(box.getAttribute('y')) + 9
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('class', 'ord')
    g.innerHTML = '<circle cx="' + x + '" cy="' + y + '" r="9"/><text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle">' + order + '</text>'
    el.appendChild(g)
  }

  // when the step is where a call went wrong, say so beside the state, in words
  function callout(step, now) {
    var old = svg.querySelector('#callout')
    if (old) old.remove()
    var node = flowNodes[ownerOfStep[step.index]]
    if (!node || node.kind !== 'call' || node.status === 'ok' || node.from !== step.index) return null
    var ids = Object.keys(now).filter(function (id) { return nodes[id] })
    var at = ids.length ? svg.querySelector('.n[data-id="' + ids[ids.length - 1] + '"] rect') : null
    if (!at) return null
    var lines = [whereIn(node)].concat(node.lines)
    var w = Math.max.apply(null, lines.map(function (l) { return l.length })) * 6.9 + 24
    var ax = Number(at.getAttribute('x'))
    var aw = Number(at.getAttribute('width'))
    var vb = svg.viewBox.baseVal
    // beside the state where there is room, else on its other side, else below it
    var x = ax + aw + 14
    var y = Number(at.getAttribute('y'))
    if (x + w > vb.x + vb.width) x = ax - w - 14
    if (x < vb.x) {
      x = Math.max(vb.x, Math.min(ax, vb.x + vb.width - w))
      y += Number(at.getAttribute('height')) + 12
    }
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    g.setAttribute('id', 'callout')
    g.setAttribute('class', 'callout s-' + node.status)
    g.innerHTML = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (14 + lines.length * 17) + '" rx="8"/>' +
      lines.map(function (l, i) { return '<text class="' + (i ? '' : 'head') + '" x="' + (x + 12) + '" y="' + (y + 21 + i * 17) + '">' + esc(l) + '</text>' }).join('')
    svg.appendChild(g)
    return g
  }

  function arrowHead(el) {
    var line = el.querySelector('.line')
    var kind = el.classList.contains('picked') ? 'picked' : el.classList.contains('hot') ? 'hot' : line.dataset.head
    line.setAttribute('marker-end', 'url(#arrow-' + (svg === charts.all ? 'all' : 'run') + '-' + kind + ')')
  }

  // keeps the state the run is in on screen
  function follow(step, now) {
    var ids = Object.keys(now).filter(function (id) { return nodes[id] })
    keepInView(ids.length ? svg.querySelector('.n[data-id="' + ids[ids.length - 1] + '"]') : null)
  }

  function keepInView(el) {
    if (!el) return
    var chart = visible()
    var box = el.getBBox()
    var vb = chart.viewBox.baseVal
    var left = (box.x - vb.x) * state.scale
    var top = (box.y - vb.y) * state.scale
    var right = left + box.width * state.scale
    var bottom = top + box.height * state.scale
    var margin = 40
    // the whole element, not just its middle: a callout is wide
    if (left < canvas.scrollLeft + margin || right > canvas.scrollLeft + canvas.clientWidth - margin ||
        top < canvas.scrollTop + margin || bottom > canvas.scrollTop + canvas.clientHeight - margin) {
      canvas.scrollTo({ left: (left + right - canvas.clientWidth) / 2, top: (top + bottom - canvas.clientHeight) / 2, behavior: state.timer ? 'smooth' : 'auto' })
    }
  }

  // ---- the panel
  var shown = null
  function render() {
    var html
    if (state.view === 'flow') html = flowPanel(state.picked)
    else if (state.view === 'node') html = nodePanel(state.picked)
    else if (state.view === 'edge') html = edgePanel(state.picked)
    else if (state.view === 'list') html = listPanel()
    else if (state.chart === 'flow' && played[state.pos]) html = flowPanel(ownerOfStep[played[state.pos].index], played[state.pos].index)
    else html = stepPanel(played[state.pos])
    var showing = state.view + ':' + (state.picked || (state.chart === 'flow' && played[state.pos] ? ownerOfStep[played[state.pos].index] : state.pos))
    panel.innerHTML = tabs() + html
    // a new box or step starts at its top; the same one keeps its place as playback moves on
    if (showing !== shown) panel.scrollTop = 0
    shown = showing
    var at = panel.querySelector('li.at')
    if (at && state.view === 'list') at.scrollIntoView({ block: 'nearest' })
  }

  function tabs() {
    var stepOn = state.view === 'step'
    var listOn = state.view === 'list'
    return '<div class="tabs"><button class="pill" type="button" data-view="step" aria-pressed="' + stepOn + '">' + (state.chart === 'flow' ? 'Where the run is' : 'This step') + '</button>' +
      '<button class="pill" type="button" data-view="list" aria-pressed="' + listOn + '">All steps</button>' +
      (state.view === 'node' || state.view === 'edge' || state.view === 'flow' ? '<button class="pill" type="button" data-view="step" aria-pressed="true">← back to the step</button>' : '') + '</div>'
  }

  function title(step) {
    if (step.kind === 'request') return 'Model request, round ' + (step.round + 1) + (step.attempt ? ' (attempt ' + (step.attempt + 1) + ')' : '')
    if (step.kind === 'receipt') return receiptTitle(step.name)
    if (step.facts) return 'Facts refreshed in ' + place(step.to)
    return path(step).join(' → ')
  }

  function receiptTitle(name) {
    if (name.indexOf('hook:') === 0) return 'Hook ' + name.slice(5)
    if (name === 'human:approve') return 'A person is asked to approve'
    return 'Tool ' + name
  }

  // every state a step passed through, not just where it started and ended
  function path(step) {
    var out = [place(step.from)]
    var walk = step.drift ? [] : step.micro
    walk.forEach(function (m) { var at = place(m.to); if (out[out.length - 1] !== at) out.push(at) })
    if (out.length === 1) out.push(place(step.to))
    return out
  }

  function listPanel() {
    return '<div class="kicker">' + steps.length + ' steps</div><ul class="list">' + steps.map(function (step) {
      var cls = 'kind-' + step.kind + (step.facts ? ' facts' : '') + (played[state.pos] === step ? ' at' : '')
      return '<li class="' + cls + '" data-step="' + step.index + '"><span class="idx">#' + step.index + '</span><span class="what">' + esc(title(step)) + '</span><span class="t">' + esc(step.at ? since(step.at) : '') + '</span></li>'
    }).join('') + '</ul>'
  }

  function stepPanel(step) {
    return step ? context(step) + verdict(step) + stepBody(step) : stepBody(step)
  }

  // a step inside a call that went wrong starts with what went wrong, in full
  function verdict(step) {
    var node = flowNodes[ownerOfStep[step.index]]
    if (!node || node.kind !== 'call' || node.status === 'ok' || node.status === 'running') return ''
    var call = data.story.rounds[node.round].calls[node.call]
    return '<div class="reason o-' + call.outcome + '"><b>' + esc(call.name) + ' was ' + esc(call.outcome === 'pending' ? 'left without a result' : call.outcome) + ':</b> ' + esc(reasonOf(call)) + '</div>'
  }

  function stepBody(step) {
    if (!step) return '<p class="empty">No steps were recorded.</p>'
    if (step.kind === 'request') return requestPanel(step)
    if (step.kind === 'receipt') return receiptPanel(step)
    // xstate's own events (an actor finished, an always route) say nothing a reader needs
    var events = step.events.map(function (e) { return e.type }).filter(function (t) { return t.indexOf('xstate.') !== 0 })
    var landed = data.meanings[leafId(step.to)]
    var out = '<div class="kicker">Step #' + step.index + ' · ' + esc(since(step.at)) + '</div>' +
      '<h2>' + esc(title(step)) + '</h2>' +
      (events.length ? '<div class="chips">' + events.map(function (e) { return '<span class="chip info">' + esc(e) + '</span>' }).join('') + '</div>' : '') +
      (landed && !step.facts ? '<div class="reason' + (landed.tone ? ' t-' + landed.tone : '') + '"><b>' + esc(place(step.to)) + ':</b> ' + esc(landed.says) + '</div>' : '')
    if (step.drift) {
      out += '<div class="notice">Re-running this step disagreed with what was recorded, so the recorded routes are shown: ' +
        step.recorded.map(function (r) { return esc(eventName(r.eventType) + ': ' + r.sourceIds.map(short).join(',') + ' → ' + r.targetIds.map(short).join(',')) }).join('; ') + '</div>'
    }
    if (step.facts) {
      out += '<h3>What the engine learned</h3>' + step.events.map(function (e) {
        var keys = Object.keys(e.value || {})
        return '<div class="kv">' + keys.map(function (k) { return '<div>' + esc(k) + '</div><div>' + value(e.value[k]) + '</div>' }).join('') + '</div>'
      }).join('')
    } else if (step.micro.length) {
      out += '<h3>Why it went this way</h3>' + step.micro.map(microPanel).join('')
    } else if (step.recorded.length) {
      out += '<h3>The routes it took</h3><ul class="why">' + step.recorded.map(function (r) {
        return '<li class="taken"><span class="v">' + esc(eventName(r.eventType)) + '</span>' + routeText(r.sourceIds[0] || '?', r.targetIds) +
          '<div class="guard">' + (r.guardNames.length ? esc(r.guardNames.join(', ')) + ' held' : 'no guard') + '</div></li>'
      }).join('') + '</ul>' + (run.replay ? '<p class="meta">' + esc(run.replay) + '</p>' : '')
    }
    out += '<details class="raw"><summary>The raw event</summary>' + step.events.map(function (e) { return value(e) }).join('') + '</details>'
    out += changesPanel(step.changes)
    return out
  }

  function leafId(value) {
    var leaf = leaves(value, '')[0]
    return leaf ? 'completion.' + leaf : ''
  }

  // what each verdict means: a guard that says no is not a rejection of anything
  var VERDICT = { taken: 'took', rejected: 'not this route', unchecked: 'not checked', unevaluable: 'could not check' }

  function microPanel(micro) {
    var shown = micro.candidates.filter(function (c) { return c.verdict !== 'unchecked' })
    var skipped = micro.candidates.length - shown.length
    return '<p class="meta"><b>' + esc(eventName(micro.eventType)) + '</b> in ' + esc(place(micro.from)) + '</p><ul class="why">' +
      shown.map(function (c) {
        var parts = c.parts.length ? '<div class="parts">' + c.parts.map(function (p) {
          return '<span class="chip ' + (p.value === true ? 'good' : '') + '">' + esc(p.name) + ' = ' + esc(String(p.value)) + '</span>'
        }).join('') + '</div>' : ''
        var reason = c.guard ? '<span class="guard">' + esc(c.guard) + ' = ' + esc(String(c.value)) + '</span>' : '<span class="guard">no guard</span>'
        var landed = c.verdict === 'taken' && data.meanings[c.targets[0]]
        var tone = landed && landed.tone ? ' t-' + landed.tone : ''
        return '<li class="' + c.verdict + tone + '"><span class="v">' + esc(VERDICT[c.verdict] || c.verdict) + '</span>' + routeText(c.source, c.targets) +
          '<div>' + reason + '</div>' + (c.facts ? '<div class="facts">' + esc(c.facts) + '</div>' : '') + parts +
          (c.error ? '<div class="facts">' + esc(c.error) + '</div>' : '') + '</li>'
      }).join('') + '</ul>' + (skipped ? '<p class="meta">' + skipped + ' later route' + (skipped === 1 ? ' was' : 's were') + ' not checked: an earlier one already won.</p>' : '')
  }

  function changesPanel(changes) {
    if (!changes.length) return ''
    return '<h3>What changed</h3>' + changes.map(function (c) {
      if (c.appended) {
        return '<div class="change"><div class="path">' + esc(c.path) + '</div><p class="meta">kept ' + c.kept + ', added ' + c.appended.length + '</p>' +
          c.appended.map(function (item) { return value(item) }).join('') + '</div>'
      }
      return '<div class="change"><div class="path">' + esc(c.path) + '</div><div class="sides"><div><small>before</small>' + value(c.before) + '</div><div><small>after</small>' + value(c.after) + '</div></div></div>'
    }).join('')
  }

  function requestPanel(step) {
    return '<div class="kicker">Step #' + step.index + ' · model request</div><h2>' + esc(title(step)) + '</h2>' +
      '<div class="chips">' + step.tools.map(function (t) { return '<span class="chip">' + esc(t) + '</span>' }).join('') + '</div>' +
      (step.droppedTurns ? '<p class="meta">' + step.droppedTurns + ' turns dropped to fit the context</p>' : '') +
      '<h3>New messages sent (' + step.appended.length + ')</h3>' + step.appended.map(message).join('')
  }

  function message(m) {
    var content = m && typeof m.content === 'string' ? m.content : JSON.stringify(m && m.content)
    var calls = m && m.tool_calls ? '<div>' + value(m.tool_calls) + '</div>' : ''
    var long = content && content.length > 600
    var body = long ? '<details><summary>' + esc(content.slice(0, 300)) + '…</summary><div class="body">' + esc(content) + '</div></details>' : '<div class="body">' + esc(content || '') + '</div>'
    return '<div class="msg"><span class="role">' + esc((m && m.role) || '?') + '</span>' + body + calls + '</div>'
  }

  function receiptPanel(step) {
    return '<div class="kicker">Step #' + step.index + ' · tool call</div><h2>' + esc(step.name) + ' <span class="chip ' + (step.effect === 'read' ? '' : 'warn') + '">' + esc(step.effect) + '</span>' +
      (step.settled ? '' : ' <span class="chip bad">no result recorded</span>') + '</h2><p class="meta">call ' + esc(step.id) + '</p>' +
      '<h3>Arguments</h3>' + value(step.args) + '<h3>Result</h3>' + value(step.result)
  }

  function nodePanel(id) {
    var node = nodes[id] || { id: id, label: short(id), kind: 'state', stays: [] }
    var entered = data.visits[id]
    var out = Object.keys(routes).map(function (k) { return routes[k] }).filter(function (r) { return r.source === id && r.event })
    var into = Object.keys(routes).map(function (k) { return routes[k] }).filter(function (r) { return r.target === id && r.event })
    function list(rs, dir) {
      if (!rs.length) return '<p class="empty">none</p>'
      return '<ul class="why">' + rs.map(function (r) {
        var n = (data.edges[r.key] || []).length
        return '<li class="' + (n ? 'taken' : 'unchecked') + '" data-edge="' + esc(r.key) + '" style="cursor:pointer"><span class="v">' + (n ? '×' + n : 'never') + '</span>' +
          routeText(r.source, [r.target]) + '<div class="guard">' + esc(r.event) + (r.guard ? ' [' + esc(r.guard) + ']' : '') + '</div></li>'
      }).join('') + '</ul>'
    }
    var meaning = data.meanings[id]
    return '<div class="kicker">State</div><h2>' + esc(node.label || short(id)) + ' <span class="chip">' + esc(node.kind) + '</span></h2><p class="meta mono">' + esc(id) + '</p>' +
      (meaning ? '<div class="reason' + (meaning.tone ? ' t-' + meaning.tone : '') + '">' + esc(meaning.says) + '</div>' : '') +
      '<h3>' + (entered ? 'Entered ' + entered.length + ' time' + (entered.length === 1 ? '' : 's') : 'Never entered') + '</h3>' + (entered && entered.length ? stepLinks(entered) : '') +
      '<h3>Routes out</h3>' + list(out) + '<h3>Routes in</h3>' + list(into) +
      (node.stays && node.stays.length ? '<h3>Handled here without leaving</h3><div class="chips">' + node.stays.map(function (s) { return '<span class="chip">' + esc(s) + '</span>' }).join('') + '</div>' : '')
  }

  function edgePanel(key) {
    var r = routes[key]
    if (!r) return '<p class="empty">Unknown route.</p>'
    var taken = data.edges[key] || []
    var rejected = []
    steps.forEach(function (step) {
      if (step.kind !== 'transition') return
      step.micro.forEach(function (m) {
        m.candidates.forEach(function (c) { if (c.key === key && c.verdict === 'rejected' && rejected.indexOf(step.index) < 0) rejected.push(step.index) })
      })
    })
    return '<div class="kicker">Route</div><h2>' + routeText(r.source, [r.target]) + '</h2>' +
      '<div class="chips"><span class="chip info">' + esc(r.event) + '</span>' + (r.guard ? '<span class="chip">guard ' + esc(r.guard) + '</span>' : '<span class="chip">no guard</span>') + '</div>' +
      '<h3>Taken ' + taken.length + ' time' + (taken.length === 1 ? '' : 's') + '</h3>' + stepLinks(taken) +
      '<h3>Checked, and its guard said no</h3>' + stepLinks(rejected) +
      (taken.length + rejected.length === 0 ? '<p class="meta">The run never reached a point where this route was checked.</p>' : '')
  }

  // ---- a box of the run's flowchart: how it went, then the machine steps inside it
  var KIND = { start: 'The request', handoff: 'A handoff', steer: 'Sent mid-run', round: 'Model round', call: 'Tool call', end: 'How it ends' }
  // open: the step to show expanded, when playback is on it
  function flowPanel(id, open) {
    var node = flowNodes[id]
    if (!node) return '<p class="empty">Nothing here.</p>'
    var pill = node.kind === 'call' ? '<span class="chip o-' + node.status + '">' + esc(node.status === 'pending' ? 'no result' : node.status) + '</span>' : ''
    var out = '<div class="kicker">' + esc(KIND[node.kind] || node.kind) + '</div><h2>' + pill + '<span class="' + (node.kind === 'call' ? 'mono' : '') + '">' + esc(node.title) + '</span></h2>' +
      (node.meta ? '<p class="meta">' + esc(node.meta) + '</p>' : '')
    if (node.kind === 'call') out += callDetails(data.story.rounds[node.round].calls[node.call])
    if (node.kind === 'round') out += roundDetails(data.story.rounds[node.round], node)
    if (node.kind === 'start') out += '<div class="msg"><div class="body">' + esc(data.story.prompt) + '</div></div>'
    if (node.kind === 'handoff') out += handoffDetails(data.hops[Number(node.id.slice(4))])
    if (node.kind === 'steer') out += '<p class="meta">The person sent this while the run was going; the next round reads it in place of the nudge.</p><div class="msg"><span class="role">user</span><div class="body">' + esc(steps[byIndex[node.from]].events.filter(function (e) { return e.type === 'INPUT' }).map(function (e) { return e.text }).join('\n')) + '</div></div>'
    if (node.kind === 'end' && node.status === 'running') {
      out += '<div class="reason o-running"><i class="spin"></i>The run is still going: its answer lands here when it ends.</div>'
    } else if (node.kind === 'end') {
      out += (run.failure ? '<div class="reason o-failed">' + esc(run.failure) + '</div>' : '') +
        (run.response ? '<div class="msg"><span class="role">answer</span><div class="body">' + esc(run.response) + '</div></div>' : '')
    }
    return out + '<h3>State machine steps (' + node.steps.length + ')</h3>' + node.steps.map(function (index) {
      var step = steps[byIndex[index]]
      var on = index === open
      return '<details class="mstep' + (on ? ' at' : '') + '"' + (on ? ' open' : '') + '><summary><span class="idx">#' + index + '</span> ' + esc(title(step)) + '</summary>' + stepBody(step) + '</details>'
    }).join('')
  }

  function callDetails(call) {
    var asked = call.approved === null ? '' : '<span class="chip ' + (call.approved ? 'info' : 'o-denied') + '">' + (call.approved ? 'approved' : 'declined') + ' by a person</span>'
    var reason = call.outcome === 'ok' ? '' : '<div class="reason o-' + call.outcome + '">' + esc(reasonOf(call)) + '</div>'
    if (call.outcome === 'running') reason = '<div class="reason o-running"><i class="spin"></i>' + esc(reasonOf(call)) + '</div>'
    return reason + (asked ? '<div class="chips">' + asked + '</div>' : '') +
      '<h3>Arguments</h3>' + full(call.args) + '<h3>Result</h3>' + full(call.result)
  }

  function handoffDetails(hop) {
    return '<p class="meta">From here <b>' + esc(hop.agent) + '</b> runs on <code>' + esc(hop.model) + '</code>, as a run of its own.</p>' +
      (hop.reason ? '<div class="msg"><span class="role">why</span><div class="body">' + esc(hop.reason) + '</div></div>' : '')
  }

  function reasonOf(call) {
    var result = call.result || {}
    var error = typeof result === 'string' ? result : result.error
    if (call.outcome === 'denied') return 'A person declined this call.'
    if (call.outcome === 'pending') return 'The run stopped before this call returned.'
    if (call.outcome === 'running') return 'Running now: its result lands here when it returns.'
    return (call.detail && call.detail.indexOf('HTTP') === 0 ? call.detail + ': ' : '') + (typeof error === 'string' ? error : JSON.stringify(error || call.detail))
  }

  function roundDetails(round, node) {
    var request = node.steps.map(function (index) { return steps[byIndex[index]] }).filter(function (step) { return step.kind === 'request' })[0]
    var calls = round.calls.map(function (call, i) {
      return '<li class="' + (call.outcome === 'ok' ? 'taken' : 'bad') + '" data-flow="call-' + round.round + '-' + i + '" style="cursor:pointer"><span class="v">' + esc(call.outcome) + '</span><span class="route">' + esc(call.name) + '</span>' +
        (call.outcome === 'ok' ? '' : '<div class="facts">' + esc(call.detail) + '</div>') + '</li>'
    }).join('')
    return (round.text ? '<h3>The model said</h3><div class="msg"><div class="body">' + esc(round.text) + '</div></div>' : '') +
      (calls ? '<h3>It called</h3><ul class="why">' + calls + '</ul>' : '') +
      (request ? '<h3>Sent to the model (' + request.appended.length + ' new messages)</h3>' + request.appended.map(message).join('') : '')
  }

  function full(v) {
    if (v === undefined) return '<p class="empty">none</p>'
    return '<pre class="json">' + esc(typeof v === 'string' ? v : JSON.stringify(v, null, 2)) + '</pre>'
  }

  // ---- selection
  function pick(view, id) {
    if (!data) return
    state.view = view
    state.picked = id
    flowSvg.querySelectorAll('.fn.picked').forEach(function (el) { el.classList.remove('picked') })
    if (view === 'flow') {
      var box = flowSvg.querySelector('.fn[data-node="' + id + '"]')
      if (box) box.classList.add('picked')
    }
    if (svg) {
      svg.querySelectorAll('.picked').forEach(function (el) { el.classList.remove('picked'); if (el.classList.contains('e')) arrowHead(el) })
      var el = view === 'node' ? svg.querySelector('.n[data-id="' + id + '"]') : view === 'edge' ? svg.querySelector('.e[data-key="' + CSS.escape(id) + '"]') : null
      if (el) { el.classList.add('picked'); if (view === 'edge') arrowHead(el) }
    }
    render()
  }

  function goTo(index) {
    var step = steps[byIndex[index]]
    if (!step) return
    pause()
    if (!plays(step)) { state.facts = true; document.getElementById('facts').setAttribute('aria-pressed', 'true'); rebuild() }
    state.view = 'step'
    pick('step', null)
    show(played.indexOf(step))
  }

  panel.addEventListener('click', function (event) {
    var t = event.target.closest('[data-step],[data-view],[data-edge],[data-flow]')
    if (!t) return
    if (t.dataset.view) { pick(t.dataset.view, null); return }
    if (t.dataset.flow) { pick('flow', t.dataset.flow); return }
    if (t.dataset.edge) { pick('edge', t.dataset.edge); return }
    goTo(Number(t.dataset.step))
  })

  // the went-wrong chips are redrawn with each live update, so one listener serves them all
  document.addEventListener('click', function (event) {
    var b = event.target.closest('[data-goto]')
    if (b) { stop(); goTo(Number(b.dataset.goto)) }
  })

  canvas.addEventListener('click', function (event) {
    if (moved || !data) return
    if (event.target.closest('.fn,.n,.e,.tb')) pause()
    var tb = event.target.closest('.tb')
    if (tb) { pick('node', tb.dataset.id); return }
    var f = event.target.closest('.fn')
    if (f) { pick('flow', f.dataset.node); return }
    var e = event.target.closest('.e')
    if (e) { pick('edge', e.dataset.key); return }
    var n = event.target.closest('.n')
    if (n && !n.classList.contains('start')) pick('node', n.dataset.id)
  })

  // ---- controls
  function stop() { clearInterval(state.timer); state.timer = null; document.getElementById('play').textContent = '▶' }
  function play() {
    if (!data) return
    if (state.timer) return stop()
    pause()
    if (state.pos >= played.length - 1) show(0)
    document.getElementById('play').textContent = '❚❚'
    state.timer = setInterval(function () {
      if (state.pos >= played.length - 1) return stop()
      show(state.pos + 1)
    }, 900)
  }
  document.getElementById('play').addEventListener('click', play)
  // stepping by hand: a live page stops following the run while the reader looks back
  function stepTo(to) { if (!data) return; stop(); pause(); show(to) }
  document.getElementById('first').addEventListener('click', function () { stepTo(0) })
  document.getElementById('prev').addEventListener('click', function () { stepTo(state.pos - 1) })
  document.getElementById('next').addEventListener('click', function () { stepTo(state.pos + 1) })
  scrub.addEventListener('input', function () { if (state.view !== 'list') state.view = 'step'; stepTo(Number(scrub.value)) })
  ticks.addEventListener('click', function (event) {
    var t = event.target.closest('[data-pos]')
    if (t) { state.view = 'step'; stepTo(Number(t.dataset.pos)) }
  })
  document.addEventListener('keydown', function (event) {
    if (event.target.closest('input,textarea')) return
    if (event.key === 'ArrowRight') { stepTo(state.pos + 1); event.preventDefault() }
    if (event.key === 'ArrowLeft') { stepTo(state.pos - 1); event.preventDefault() }
    if (event.key === ' ') { play(); event.preventDefault() }
  })
  function toggle(id, on) {
    var button = document.getElementById(id)
    button.addEventListener('click', function () {
      var next = button.getAttribute('aria-pressed') !== 'true'
      button.setAttribute('aria-pressed', String(next))
      on(next)
    })
  }
  // ---- which chart: the run's flowchart, or the state machine
  function setChart(name) {
    if (!data) return
    state.chart = name
    board.classList.toggle('on-machine', name === 'machine')
    document.querySelectorAll('[data-chart]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.chart === name)) })
    flowSvg.style.display = name === 'flow' ? '' : 'none'
    if (svg) svg.style.display = name === 'machine' ? '' : 'none'
    zoom(state.scale)
    show(state.pos)
  }
  document.querySelectorAll('[data-chart]').forEach(function (b) {
    b.addEventListener('click', function () { setChart(b.dataset.chart) })
  })

  // the whole machine is its own layout; the run's is the default
  toggle('untaken', function (on) {
    state.whole = on
    if (!svg) return
    svg.style.display = 'none'
    svg = on ? charts.all : charts.run
    if (state.chart === 'machine') svg.style.display = ''
    zoom(state.scale)
    if (state.view === 'node' || state.view === 'edge') pick(state.view, state.picked)
    show(state.pos)
  })
  toggle('facts', function (on) { state.facts = on; if (data) { rebuild(); show(state.pos) } })
  toggle('follow', function (on) { state.follow = on })

  // ---- zoom and pan
  function zoom(scale) {
    var chart = visible()
    if (!chart) return
    state.scale = Math.max(0.2, Math.min(2.5, scale))
    chart.setAttribute('width', String(Number(chart.dataset.w) * state.scale))
    chart.setAttribute('height', String(Number(chart.dataset.h) * state.scale))
  }
  function fit() {
    var chart = visible()
    if (!chart) return
    zoom(Math.min(1, (canvas.clientWidth - 8) / Number(chart.dataset.w), (canvas.clientHeight - 8) / Number(chart.dataset.h)))
    canvas.scrollTo(0, 0)
  }
  document.getElementById('zoom-in').addEventListener('click', function () { zoom(state.scale * 1.25) })
  document.getElementById('zoom-out').addEventListener('click', function () { zoom(state.scale / 1.25) })
  document.getElementById('fit').addEventListener('click', fit)
  var drag = null
  var moved = false
  canvas.addEventListener('pointerdown', function (event) {
    drag = { x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop }
    moved = false
  })
  // a reader scrolling the canvas is looking somewhere; following would pull them away
  canvas.addEventListener('wheel', function () { pause() }, { passive: true })
  window.addEventListener('pointermove', function (event) {
    if (!drag) return
    var dx = event.clientX - drag.x
    var dy = event.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 4) { if (!moved) pause(); moved = true; canvas.classList.add('dragging') }
    canvas.scrollLeft = drag.left - dx
    canvas.scrollTop = drag.top - dy
  })
  window.addEventListener('pointerup', function () { drag = null; canvas.classList.remove('dragging'); setTimeout(function () { moved = false }, 0) })

  // ---- live: a page that follows a run as it happens
  var heroSlot = document.getElementById('hero-slot')
  var jumpsSlot = document.getElementById('jumps-slot')
  var toLive = document.getElementById('to-live')
  var live = {
    following: true,
    // how many steps there were when the reader stopped following, for the count on the button
    pausedAt: 0,
    connected: false,
    // the runs the server has, newest last, and the one on the page
    runs: [],
    viewing: null,
    followRuns: true,
    loaded: { n: null, size: -1 },
    fetching: false,
    again: false,
    // the page's clock against the writer's: when the newest step arrived here
    receivedAt: 0,
    lastAt: null,
    clock: null
  }

  function ended() { return !run || run.status !== 'active' }

  // the reader took over: playback stays where they put it until they jump back
  function pause() {
    if (!liveMode || !live.following || !data) return
    live.following = false
    live.pausedAt = played.length
    chrome()
  }

  function resume() {
    live.following = true
    if (data) { state.view = 'step'; state.picked = null; pick('step', null); quiet = true; show(played.length - 1); quiet = false }
    chrome()
    toTail(false)
  }
  toLive.addEventListener('click', resume)

  function apply(parts, n) {
    var fresh = !data
    var sameRun = live.loaded.n === n
    var before = {}
    if (flowSvg && sameRun) flowSvg.querySelectorAll('.fn').forEach(function (el) { before[el.dataset.node] = true })
    var atIndex = sameRun && played[state.pos] ? played[state.pos].index : null
    var scroll = { left: canvas.scrollLeft, top: canvas.scrollTop }
    heroSlot.innerHTML = parts.hero
    jumpsSlot.innerHTML = parts.jumps
    canvas.innerHTML = parts.canvas
    document.title = parts.title + ' · QVAC'
    var machineButton = document.querySelector('[data-chart="machine"]')
    if (machineButton) machineButton.hidden = !parts.machine
    if (!parts.machine && state.chart === 'machine') { state.chart = 'flow'; board.classList.remove('on-machine') }
    if (!sameRun) { state.view = 'step'; state.picked = null; live.following = live.followRuns || live.following }
    load(parts.data)
    // what landed since the last update draws itself in
    if (sameRun && !fresh) {
      flowSvg.querySelectorAll('.fn').forEach(function (el) { if (!before[el.dataset.node]) el.classList.add('arrived') })
    }
    rebuild(atIndex)
    if (!live.following && sameRun) { canvas.scrollLeft = scroll.left; canvas.scrollTop = scroll.top }
    if (fresh) document.body.classList.remove('waiting-for-run')
    // playback moves to the newest step, but the canvas is moved once, to the tail, below
    quiet = true
    show(live.following ? played.length - 1 : state.pos)
    quiet = false
    if (state.view === 'flow' || state.view === 'node' || state.view === 'edge') pick(state.view, state.picked)
    live.loaded = { n: n, size: live.loaded.size }
    chrome()
    if (live.following) toTail(fresh)
  }

  // the newest box sits low in the canvas, as the newest line of a chat does, with room above it
  function toTail(jump) {
    if (state.chart !== 'flow' || !steps.length) return
    // while the run goes its last box is the one it will answer from; after, the box it ended in
    var el = flowSvg.querySelector('.fn.k-end') || flowSvg.querySelector('.fn[data-node="' + ownerOfStep[steps[steps.length - 1].index] + '"]')
    if (!el) return
    var box = el.getBBox()
    var vb = flowSvg.viewBox.baseVal
    var bottom = (box.y + box.height - vb.y) * state.scale
    var left = (box.x - vb.x) * state.scale
    canvas.scrollTo({ top: Math.max(0, bottom - canvas.clientHeight + 56), left: Math.max(0, left - 48), behavior: jump ? 'auto' : 'smooth' })
  }

  // the box the run is in while it goes, breathing
  function head() {
    flowSvg.querySelectorAll('.fn.live-head').forEach(function (el) { el.classList.remove('live-head') })
    if (ended() || !steps.length) return
    var owner = ownerOfStep[steps[steps.length - 1].index]
    var el = flowSvg.querySelector('.fn[data-node="' + owner + '"]')
    if (el) el.classList.add('live-head')
  }

  function clockText(ms) {
    var s = Math.max(0, Math.round(ms / 1000))
    return s < 60 ? s + ' s' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')
  }

  // the pill in the top bar, the button back to the tail, and the player's live mark
  function chrome() {
    var pill = document.getElementById('live-pill')
    var text = document.getElementById('live-text')
    if (!pill) return
    clearInterval(live.clock)
    live.clock = null
    pill.className = 'live-pill'
    if (!live.connected) {
      pill.classList.add('is-off')
      text.textContent = data ? 'Reconnecting' : 'Connecting'
    } else if (!data) {
      pill.classList.add('is-waiting')
      text.textContent = 'Waiting for the run'
    } else if (ended()) {
      pill.classList.add('is-ended')
      var took = run.startedAt && run.endedAt ? ' · ' + clockText(run.endedAt - run.startedAt) : ''
      text.textContent = (run.outcome === 'success' || run.status === 'done' ? 'Finished' : 'Stopped') + took
    } else {
      pill.classList.add('is-live')
      var last = steps[steps.length - 1]
      var node = last && flowNodes[ownerOfStep[last.index]]
      // requests and receipts carry no time; the clock runs from the last step that does
      var timed = steps.filter(function (step) { return step.at }).pop()
      var lastAt = timed ? timed.at : run.startedAt
      // the clock restarts from a step only when a newer timed one lands, so it never runs back
      if (lastAt !== live.lastAt) { live.lastAt = lastAt; live.receivedAt = Date.now() }
      var tick = function () {
        var elapsed = run.startedAt ? lastAt - run.startedAt + (Date.now() - live.receivedAt) : 0
        text.textContent = 'Live · ' + clockText(elapsed) + (node ? ' · ' + whereIn(node) : '')
      }
      tick()
      live.clock = setInterval(tick, 1000)
    }
    var behind = played.length - live.pausedAt
    toLive.hidden = !data || live.following
    toLive.textContent = behind > 0 ? 'Jump to live · ' + behind + ' new' : 'Back to live'
    document.querySelector('.player').classList.toggle('at-live', !!data && live.following && !ended())
    if (data) head()
  }

  // ---- the runs the server holds: tabs, newest followed unless the reader picked an older one
  function runTabs() {
    var nav = document.getElementById('run-tabs')
    nav.hidden = live.runs.length < 2
    nav.innerHTML = live.runs.map(function (r) {
      var on = r.n === live.loaded.n || (live.loaded.n === null && r.n === target())
      var newest = r.n === live.runs[live.runs.length - 1].n
      return '<button type="button" class="run-tab' + (on ? ' on' : '') + '" data-run="' + r.n + '"><b>Run ' + r.n + '</b>' +
        (r.label ? '<span>' + esc(r.label) + '</span>' : '') + (newest && !ended() && on ? '<i class="dot"></i>' : '') + '</button>'
    }).join('')
  }
  if (liveMode) document.getElementById('run-tabs').addEventListener('click', function (event) {
    var b = event.target.closest('[data-run]')
    if (!b) return
    var n = Number(b.dataset.run)
    live.followRuns = n === live.runs[live.runs.length - 1].n
    live.viewing = n
    document.getElementById('new-run').hidden = true
    // the run already on screen has nothing to fetch: back to its tail
    if (n === live.loaded.n) { resume(); return }
    live.following = true
    fetchRun()
  })

  function target() {
    if (live.followRuns || live.viewing === null) return live.runs.length ? live.runs[live.runs.length - 1].n : null
    return live.viewing
  }

  function notice(r) {
    var box = document.getElementById('new-run')
    box.innerHTML = '<span>Run ' + r.n + ' started' + (r.label ? ' · ' + esc(r.label) : '') + '</span><button type="button" class="pill" data-run-show="' + r.n + '">Show it</button>'
    box.hidden = false
  }
  if (liveMode) document.getElementById('new-run').addEventListener('click', function (event) {
    var b = event.target.closest('[data-run-show]')
    if (!b) return
    live.followRuns = true
    live.following = true
    event.currentTarget.hidden = true
    fetchRun()
  })

  // one fetch at a time; a change meanwhile fetches once more after it
  function fetchRun() {
    var n = target()
    if (n === null) return
    if (live.fetching) { live.again = true; return }
    var r = live.runs.filter(function (x) { return x.n === n })[0]
    if (!r || (live.loaded.n === n && live.loaded.size === r.size)) return
    live.fetching = true
    fetch('run/' + n).then(function (res) { return res.json() }).then(function (parts) {
      // the reader moved to another run meanwhile: draw that one instead
      if (target() !== n) { live.again = true; return }
      apply(parts, n)
      live.loaded.size = r.size
      runTabs()
    }).catch(function (err) { console.error('live: ' + (err && err.stack || err)) }).then(function () {
      live.fetching = false
      if (live.again) { live.again = false; fetchRun() }
    })
  }

  function connect() {
    if (window.location.protocol === 'file:') return
    chrome()
    var events = new EventSource('events')
    events.onopen = function () { live.connected = true; chrome() }
    events.onerror = function () { live.connected = false; chrome() }
    events.onmessage = function (event) {
      var message = JSON.parse(event.data)
      var known = live.runs.length
      live.runs = message.runs
      live.connected = true
      if (live.runs.length > known && known > 0 && !live.followRuns) notice(live.runs[live.runs.length - 1])
      runTabs()
      fetchRun()
      chrome()
    }
  }

  var first = JSON.parse(document.getElementById('data').textContent)
  if (first) {
    load(first)
    rebuild()
    zoom(1)
    if (linked && steps[byIndex[linked]]) goTo(linked)
    else show(0)
  }
  if (liveMode) connect()
})()
`;
