import { createStore } from './store.js';
import { createSeedState } from './seed.js';
import { createPrototypeApi } from './api.js';
import { createApplicationApi } from './desktop-api.js';
import { startMission, saveSchedule, toggleSchedule } from './orchestration.js';
import {
  escapeHtml,
  fileIcon,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  id,
  relativeTime,
  statusTone,
  typeFromPrompt
} from './formatters.js';

const root = document.querySelector('#app');
const store = createStore(createSeedState);
const api = createApplicationApi(store, createPrototypeApi);

// Web Speech API instance
let speechRecognitionInstance = null;
let speechIsListening = false;

// Navigation items definition
const userNavItems = [
  ['dashboard', 'Overview', '◇'],
  ['missions', 'Missions', '◈'],
  ['workforce', 'Workforce', '◎'],
  ['reports', 'Reports', '▱'],
  ['records', 'Records', '▦'],
  ['clients', 'Clients', '⬡'],
  ['projects', 'Projects', '◫'],
  ['settings', 'Settings', '⚙']
];

const adminNavItems = [
  ['admin-dashboard', 'Admin Overview', '⎈'],
  ['admin-users', 'Users & Workspaces', '👥'],
  ['admin-agents', 'Agent Config', '🤖'],
  ['admin-templates', 'Template Library', '📋'],
  ['admin-models', 'Model Settings', '⚡'],
  ['admin-audit', 'Audit Logs', '📜'],
  ['admin-health', 'System Health', '🩺'],
  ['admin-security', 'Security Settings', '🛡']
];

function getAgent(state, agentId) {
  return state.agents.find((agent) => agent.id === agentId);
}

function statusPill(status) {
  const label = String(status || 'unknown').replaceAll('_', ' ');
  return `<span class="pill ${statusTone(status)}">${escapeHtml(label)}</span>`;
}

function initials(name = '') {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'KU';
}

function metric(label, value, accent = '') {
  return `<article class="metric ${accent}"><span>${escapeHtml(label)}</span><strong>${value}</strong></article>`;
}

function currentWeekReports(state) {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return state.reports.filter((report) => report.createdAt >= monday.getTime()).length;
}

function activeMission(state) {
  return state.missions.find((mission) => ['planning', 'running'].includes(mission.status)) || state.missions[0];
}

function totalPipelineValue(state) {
  return (state.projects || []).reduce((sum, p) => sum + (Number(p.value) || 0), 0);
}

// --------------------------------------------------------------------------
// TOPBAR & SHELL
// --------------------------------------------------------------------------

function renderHeader(state) {
  const engine = state.engine;
  const isDark = (state.theme || 'dark') === 'dark';
  const user = state.auth?.user || { name: 'Alex Vance', role: 'user' };
  const routeName = (state.route || '').replace(/^admin-/, 'Admin / ').replace('-', ' ');

  return `<header class="topbar">
    <div class="brand" data-action="nav" data-route="dashboard">
      <img src="/assets/aistudio/KUBERA_UPDATING_LOGO_d3167c7e.png" alt="KUBERA" class="brand-logo-img" />
      <span>KUBERA<span class="brand-dot">.</span></span>
      <em>FlowSync Ops</em>
    </div>

    <div class="topbar-center">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <span>Workspace</span>
        <span class="sep">/</span>
        <span class="current">${escapeHtml(routeName)}</span>
      </nav>
      <button class="search-trigger" data-action="open-cmd-palette" aria-label="Open command search">
        <span>Search or command…</span>
        <kbd>⌘K</kbd>
      </button>
    </div>

    <div class="topbar-right">
      <span class="engine-state ${statusTone(engine.status)}">
        <i class="pulse"></i>${escapeHtml(engine.status)}
      </span>
      <button class="theme-toggle-btn" data-action="toggle-theme" title="Toggle theme (Light / Dark)">
        ${isDark ? '☀️' : '🌙'}
      </button>
      <div class="user-badge" title="${escapeHtml(user.email || user.name)}">
        <div class="user-avatar">${escapeHtml(initials(user.name))}</div>
        <div class="user-meta">
          <span class="user-name">${escapeHtml(user.name)}</span>
          <span class="user-role-tag">${escapeHtml(user.role || 'user')}</span>
        </div>
      </div>
      <button class="icon-button" data-action="logout" title="Sign out / Switch account">⎋</button>
    </div>
  </header>`;
}

function renderSidebar(state) {
  const active = state.missions.filter((mission) => ['planning', 'running'].includes(mission.status)).length;
  const upcoming = state.schedules.filter((schedule) => schedule.enabled && schedule.nextRun > Date.now()).length;
  const reviews = state.missions.flatMap((mission) => mission.tasks).filter((task) => task.status === 'review').length;
  const isAdmin = state.auth?.user?.role === 'admin';

  return `<aside class="sidebar">
    <div>
      <div class="sidebar-header">
        <div class="sidebar-workspace-label">
          <span>🏛️</span>
          <span>Acme Enterprise HQ</span>
        </div>
      </div>

      <nav aria-label="User navigation" class="nav-section">
        <span class="nav-section-title">Operations</span>
        ${userNavItems.map(([route, label, icon]) => {
          const isActive = state.route === route;
          const badge = route === 'missions' && active ? `<span class="badge">${active}</span>` : '';
          return `<button class="nav-item ${isActive ? 'active' : ''}" data-action="nav" data-route="${route}">
            <span class="icon">${icon}</span>
            <span>${label}</span>
            ${badge}
          </button>`;
        }).join('')}
      </nav>

      <nav aria-label="Admin navigation" class="nav-section">
        <span class="nav-section-title">Administration ${isAdmin ? '' : '🔒'}</span>
        ${adminNavItems.map(([route, label, icon]) => {
          const isActive = state.route === route;
          return `<button class="nav-item ${isActive ? 'active' : ''}" data-action="nav" data-route="${route}">
            <span class="icon">${icon}</span>
            <span>${label}</span>
          </button>`;
        }).join('')}
      </nav>
    </div>

    <div>
      <section class="metrics-panel">
        <p class="eyebrow">Workforce Pulse</p>
        ${metric('Active missions', active, 'blue')}
        ${metric('Reports this week', currentWeekReports(state), 'green')}
        ${metric('Upcoming schedules', upcoming, 'amber')}
        ${metric('Peer reviews pending', reviews, 'rose')}
      </section>

      <div class="sidebar-footer">
        <div class="sidebar-note">
          <span class="note-dot"></span>
          <div>
            <strong>Self-Managing Digital Workforce</strong>
            <small>Local-first, depth-one controlled execution.</small>
          </div>
        </div>
      </div>
    </div>
  </aside>`;
}

// --------------------------------------------------------------------------
// MISSION COMPOSER WITH VOICE & ATTACHMENTS
// --------------------------------------------------------------------------

function renderRequirementComposer(state) {
  const disabled = state.engine.status !== 'ready' ? 'disabled' : '';
  const attachments = state.ui?.missionAttachments || [];
  const isListening = state.ui?.voiceListening;

  return `<section class="composer-card" id="mission-composer-card">
    <div class="composer-heading">
      <div>
        <p class="eyebrow">Autonomous Business Mission</p>
        <h1>What should KUBERA deliver?</h1>
      </div>
      <span class="prototype-tag">Controlled Workforce</span>
    </div>

    <form data-form="mission" class="composer-form">
      <div class="composer-textarea-wrapper">
        <textarea
          name="missionText"
          id="mission-text-input"
          rows="3"
          ${disabled}
          placeholder="Describe your business mission, or use voice commands and attach reference documents…">${escapeHtml(state.ui?.missionDraftText || '')}</textarea>

        ${isListening ? `
          <div class="voice-banner">
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="pulse" style="background:var(--danger)"></span>
              <span>Listening… speak your mission description</span>
            </div>
            <div class="voice-waveform">
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
              <div class="waveform-bar"></div>
            </div>
            <button type="button" class="secondary-button" data-action="toggle-voice" style="padding:2px 8px; font-size:11px;">Stop</button>
          </div>
        ` : ''}

        ${attachments.length ? `
          <div class="attachments-grid">
            ${attachments.map((att, index) => `
              <div class="attachment-chip">
                <span class="file-icon">${fileIcon(att.name.split('.').pop())}</span>
                <span style="font-weight:500;">${escapeHtml(att.name)}</span>
                <span class="file-size">${formatFileSize(att.size)}</span>
                <button type="button" class="remove-btn" data-action="remove-attachment" data-index="${index}" title="Remove attachment">✕</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <input type="file" id="mission-file-picker" multiple style="display:none;" />

      <div class="composer-toolbar">
        <div class="composer-tools-left">
          <button type="button" class="tool-button" data-action="pick-files" title="Attach documents, spreadsheets or slides from device">
            <span>📎</span>
            <span>Attach Files</span>
          </button>
          <button type="button" class="tool-button ${isListening ? 'active-voice' : ''}" data-action="toggle-voice" title="Speak mission via microphone">
            <span>🎤</span>
            <span>${isListening ? 'Listening…' : 'Voice Command'}</span>
          </button>
        </div>

        <button class="primary-button" type="submit" ${disabled}>
          <span>Deploy Mission</span>
          <b>→</b>
        </button>
      </div>

      <div class="examples-row">
        <span>Quick presets:</span>
        <button type="button" class="example-chip" data-action="example" data-prompt="Build a Q3 pipeline deck for Acme Corp">Acme Q3 Deck (PPTX)</button>
        <button type="button" class="example-chip" data-action="example" data-prompt="Write a Q3 client report for Acme Corp using the client report template">Client Memo (DOCX)</button>
        <button type="button" class="example-chip" data-action="example" data-prompt="Create a campaign budget and risk tracker spreadsheet for active projects">Budget Tracker (XLSX)</button>
      </div>
    </form>

    <p class="composer-note">
      Multi-agent workflow: Asha plans bounded tasks, Maya and W-1 analyze local business records, W-2 generates real Office files, and Sentinel conducts peer review before delivery.
    </p>
  </section>`;
}

// --------------------------------------------------------------------------
// MISSIONS VIEW & TASK BOARD
// --------------------------------------------------------------------------

function renderTask(task, state) {
  const agent = getAgent(state, task.agentId) || { name: 'Unknown', label: 'Unassigned', color: 'slate' };
  const reviewer = task.reviewerId ? getAgent(state, task.reviewerId) : null;
  const dependencies = task.dependsOn?.length ? `${task.dependsOn.length} prerequisite${task.dependsOn.length > 1 ? 's' : ''}` : 'Ready root task';

  return `<article class="task-card ${task.status}">
    <div class="agent-avatar ${agent.color}">${escapeHtml(initials(agent.name))}</div>
    <div class="task-copy">
      <div class="task-title-row">
        <strong>${escapeHtml(agent.name)} <span>— ${escapeHtml(agent.label)}</span></strong>
        ${statusPill(task.status)}
      </div>
      <p>${escapeHtml(task.title)}</p>
      <small>${escapeHtml(task.summary || dependencies)}</small>
      ${reviewer ? `<span class="task-reviewer">Peer reviewer: ${escapeHtml(reviewer.name)} — ${escapeHtml(reviewer.label)}</span>` : ''}
      ${task.workspace ? `<span class="task-workspace">⌁ ${escapeHtml(task.workspace)}</span>` : ''}
    </div>
  </article>`;
}

function renderTeamBoard(mission, state) {
  const columns = [
    { key: 'queued', label: 'Queued', statuses: ['queued', 'blocked'] },
    { key: 'working', label: 'Working', statuses: ['running'] },
    { key: 'review', label: 'Peer review', statuses: ['review'] },
    { key: 'delivered', label: 'Delivered', statuses: ['succeeded'] },
    { key: 'approved', label: 'Approved', statuses: ['approved'] }
  ];

  return `<section class="team-board" aria-label="Mission task board">
    <div class="board-topline">
      <div>
        <p class="eyebrow">Governed Agent Execution</p>
        <h3>${mission.tasks.length} tasks · ${mission.handoffs.filter((h) => h.status === 'accepted').length} accepted handoffs</h3>
      </div>
      <span>Independent tasks run in parallel; document generation begins only after peer review.</span>
    </div>
    <div class="board-columns">
      ${columns.map((column) => {
        const tasks = mission.tasks.filter((task) => column.statuses.includes(task.status));
        return `<div class="board-column ${column.key}">
          <div class="board-column-title">
            <span>${escapeHtml(column.label)}</span>
            <b>${tasks.length}</b>
          </div>
          <div class="board-task-list">
            ${tasks.length ? tasks.map((task) => renderTask(task, state)).join('') : '<span class="empty-board-slot">—</span>'}
          </div>
        </div>`;
      }).join('')}
    </div>
  </section>`;
}

function renderMissionCard(mission, state, compact = false) {
  const completed = mission.tasks.filter((task) => ['succeeded', 'approved'].includes(task.status)).length;
  const deliverable = state.reports.find((report) => report.id === mission.reportId);
  const attachments = mission.attachments || [];

  return `<article class="mission-card">
    <div class="mission-header">
      <div>
        <span class="pill info">${mission.type.toUpperCase()} Mission</span>
        <h2 style="margin-top:6px;">${escapeHtml(mission.title)}</h2>
        <div class="mission-meta">
          <span>Started ${relativeTime(mission.createdAt)}</span>
          <span>·</span>
          <span>${completed} of ${mission.tasks.length} tasks completed</span>
          ${attachments.length ? `<span>·</span><span>📎 ${attachments.length} attachment(s)</span>` : ''}
        </div>
      </div>
      ${statusPill(mission.status)}
    </div>

    ${deliverable ? `
      <div style="margin-bottom:14px; padding:10px 14px; border-radius:var(--radius-sm); background:var(--surface-2); border:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:16px;">${fileIcon(deliverable.type)}</span>
          <div>
            <strong style="font-size:12px;">${escapeHtml(deliverable.name)}</strong>
            <small style="color:var(--muted); display:block;">${escapeHtml(deliverable.producer)} · ${escapeHtml(deliverable.size)}</small>
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="secondary-button" style="padding:4px 8px; font-size:11px;" data-action="open-report" data-report-id="${deliverable.id}">Inspect Outline</button>
          <button class="primary-button" style="padding:4px 8px; font-size:11px;" data-action="visual-report" data-report-id="${deliverable.id}">Visual Preview</button>
        </div>
      </div>
    ` : ''}

    ${renderTeamBoard(mission, state)}
  </article>`;
}

function renderMissions(state) {
  const missions = state.missions || [];
  const current = activeMission(state);

  return `<div class="view">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Digital Workforce Command</p>
        <h1>Mission Operations Center</h1>
        <p class="subhead">Dispatch autonomous multi-agent missions with voice dictation and device attachments.</p>
      </div>
    </div>

    ${renderRequirementComposer(state)}

    ${current ? renderMissionCard(current, state) : ''}

    ${missions.length > 1 ? `
      <div class="section-heading" style="margin-top:36px;">
        <div>
          <h2>Mission History (${missions.length})</h2>
          <p class="subhead">Audited and reproducible records of past workforce executions.</p>
        </div>
      </div>
      <div style="display:grid; gap:12px;">
        ${missions.slice(1).map((m) => `
          <div class="table-card" style="padding:14px 18px; margin:0; display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="pill info">${m.type.toUpperCase()}</span>
                <strong style="font-size:13px;">${escapeHtml(m.title)}</strong>
              </div>
              <small style="color:var(--muted);">${relativeTime(m.createdAt)} · ${m.tasks.length} tasks executed</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              ${statusPill(m.status)}
              ${m.reportId ? `<button class="secondary-button" style="padding:4px 8px; font-size:11px;" data-action="open-report" data-report-id="${m.reportId}">View Artifact</button>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}
  </div>`;
}

// --------------------------------------------------------------------------
// DASHBOARD VIEW
// --------------------------------------------------------------------------

function renderDashboard(state) {
  const user = state.auth?.user || { name: 'Alex Vance' };
  const activeCount = state.missions.filter((m) => ['planning', 'running'].includes(m.status)).length;
  const reportsCount = state.reports.length;
  const clientCount = state.clients.length;
  const pipelineVal = totalPipelineValue(state);

  return `<div class="view">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Enterprise Overview</p>
        <h1>Welcome back, ${escapeHtml(user.name)}</h1>
        <p class="subhead">KUBERA AI workforce is active in local-first deterministic execution mode.</p>
      </div>
      <div class="heading-actions">
        <button class="primary-button" data-action="nav" data-route="missions">+ New Mission</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:14px; margin-bottom:24px;">
      <div class="table-card" style="margin:0; padding:18px;">
        <span class="eyebrow" style="margin-bottom:4px;">Active Missions</span>
        <h2 style="font-size:28px; margin:4px 0;">${activeCount}</h2>
        <small style="color:var(--muted);">Governed local executions</small>
      </div>
      <div class="table-card" style="margin:0; padding:18px;">
        <span class="eyebrow" style="margin-bottom:4px;">Reports Generated</span>
        <h2 style="font-size:28px; margin:4px 0; color:var(--success);">${reportsCount}</h2>
        <small style="color:var(--muted);">PPTX, DOCX & XLSX files</small>
      </div>
      <div class="table-card" style="margin:0; padding:18px;">
        <span class="eyebrow" style="margin-bottom:4px;">Managed Pipeline</span>
        <h2 style="font-size:28px; margin:4px 0; color:var(--primary);">${formatCurrency(pipelineVal)}</h2>
        <small style="color:var(--muted);">${clientCount} enterprise accounts</small>
      </div>
      <div class="table-card" style="margin:0; padding:18px;">
        <span class="eyebrow" style="margin-bottom:4px;">Workforce Nodes</span>
        <h2 style="font-size:28px; margin:4px 0;">5 Agents</h2>
        <small style="color:var(--success);">All nodes online & idle</small>
      </div>
    </div>

    ${renderRequirementComposer(state)}

    <div class="section-heading" style="margin-top:32px;">
      <div>
        <h2>Recent Deliverables</h2>
        <p class="subhead">Source-linked Office files generated by document worker W-2.</p>
      </div>
      <button class="secondary-button" data-action="nav" data-route="reports">View All Reports →</button>
    </div>

    <div class="reports-grid">
      ${state.reports.slice(0, 3).map((report) => renderReportCard(report, state)).join('')}
    </div>
  </div>`;
}

// --------------------------------------------------------------------------
// WORKFORCE VIEW
// --------------------------------------------------------------------------

function renderWorkforce(state) {
  return `<div class="view">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Autonomous Agent Roster</p>
        <h1>Controlled AI Workforce</h1>
        <p class="subhead">Asha coordinates specialists with deterministic role boundaries and mandatory peer review.</p>
      </div>
    </div>

    <div class="workforce-grid">
      ${state.agents.map((agent) => `
        <div class="agent-card">
          <div class="agent-card-top">
            <div class="agent-identity">
              <div class="agent-avatar ${agent.color}">${escapeHtml(initials(agent.name))}</div>
              <div>
                <div class="agent-role-title">${escapeHtml(agent.name)}</div>
                <div class="agent-role-sub">${escapeHtml(agent.label)}</div>
              </div>
            </div>
            ${statusPill(agent.status)}
          </div>
          <div class="agent-capability-box">
            <strong>Role Capability:</strong> ${escapeHtml(agent.capability)}
          </div>
          <div class="agent-stats-row">
            <span>Specialization: <b>${escapeHtml(agent.kind)}</b></span>
            <span>Policy: <b>Enforced</b></span>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="section-heading" style="margin-top:36px;">
      <div>
        <h2>Specialist Handoff Stream</h2>
        <p class="subhead">Verifiable structured artifacts exchanged between agents during mission lifecycle.</p>
      </div>
    </div>

    <div class="table-card" style="padding:14px;">
      ${state.missions.flatMap((m) => m.handoffs).length ? `
        <div style="display:grid; gap:8px;">
          ${state.missions.flatMap((m) => m.handoffs).map((h) => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--surface-2); border-radius:var(--radius-sm); font-size:12px;">
              <div>
                <strong>${escapeHtml(h.type.replaceAll('_', ' '))}</strong>
                <span style="color:var(--muted); margin-left:8px;">from ${escapeHtml(h.fromAgentId)} (${h.sourceCount} source records)</span>
              </div>
              ${statusPill(h.status)}
            </div>
          `).join('')}
        </div>
      ` : '<p style="color:var(--muted); margin:0;">No handoffs recorded yet.</p>'}
    </div>
  </div>`;
}

// --------------------------------------------------------------------------
// REPORTS VIEW
// --------------------------------------------------------------------------

function renderReportCard(report, state) {
  return `<div class="report-card">
    <div>
      <div class="report-header">
        <div class="report-icon-box ${report.type}">${fileIcon(report.type)}</div>
        <div style="flex:1; min-width:0;">
          <div class="report-card-title">${escapeHtml(report.name)}</div>
          <div class="report-card-meta">${escapeHtml(report.producer)} · ${escapeHtml(report.size || '2.4 MB')}</div>
        </div>
      </div>
      <div style="margin-top:12px; font-size:11px; color:var(--text-secondary); line-height:1.4;">
        ${report.outline?.length ? `${report.outline.length} structured sections validated.` : 'Generated business deliverable.'}
      </div>
    </div>

    <div class="report-actions">
      <button class="secondary-button" style="padding:4px 8px; font-size:11px;" data-action="open-report" data-report-id="${report.id}">Outline</button>
      <button class="secondary-button" style="padding:4px 8px; font-size:11px;" data-action="visual-report" data-report-id="${report.id}">Visual</button>
      <button class="primary-button" style="padding:4px 8px; font-size:11px;" data-action="open-deliverable" data-report-id="${report.id}">Download</button>
      <button class="ghost-button" style="padding:4px 8px; font-size:11px;" data-action="show-delivery-form" data-report-id="${report.id}">Send</button>
    </div>
  </div>`;
}

function renderReports(state) {
  const currentFilter = state.ui?.reportFilterType || 'all';
  const allReports = state.reports || [];
  const reports = allReports.filter((r) => currentFilter === 'all' || r.type === currentFilter);

  return `<div class="view">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Document Repository</p>
        <h1>Generated Office Deliverables</h1>
        <p class="subhead">High-fidelity PowerPoint, Word, and Excel files created by the workforce with human approval gates.</p>
      </div>
      <div class="heading-actions">
        <button class="secondary-button ${currentFilter === 'all' ? 'active' : ''}" style="padding:4px 10px; font-size:12px;" data-action="filter-reports" data-type="all">All (${allReports.length})</button>
        <button class="secondary-button ${currentFilter === 'pptx' ? 'active' : ''}" style="padding:4px 10px; font-size:12px;" data-action="filter-reports" data-type="pptx">Slides (PPTX)</button>
        <button class="secondary-button ${currentFilter === 'docx' ? 'active' : ''}" style="padding:4px 10px; font-size:12px;" data-action="filter-reports" data-type="docx">Reports (DOCX)</button>
        <button class="secondary-button ${currentFilter === 'xlsx' ? 'active' : ''}" style="padding:4px 10px; font-size:12px;" data-action="filter-reports" data-type="xlsx">Sheets (XLSX)</button>
      </div>
    </div>

    <div class="reports-grid">
      ${reports.length ? reports.map((r) => renderReportCard(r, state)).join('') : '<p style="color:var(--muted); padding:20px 0;">No matching deliverables found in this category.</p>'}
    </div>
  </div>`;
}

// --------------------------------------------------------------------------
// RECORDS, CLIENTS & PROJECTS
// --------------------------------------------------------------------------

function renderRecords(state) {
  return `<div class="view">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Business Intelligence</p>
        <h1>Operational Records</h1>
        <p class="subhead">Clients, pipeline opportunities, and financial data referenced by the AI workforce.</p>
      </div>
      <div class="heading-actions">
        <button class="secondary-button" data-action="nav" data-route="clients">Client Directory</button>
        <button class="secondary-button" data-action="nav" data-route="projects">Project Pipeline</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
      <div class="table-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Active Clients (${state.clients.length})</h3>
          <button class="secondary-button" style="padding:2px 8px; font-size:11px;" data-action="show-client-form">+ Add</button>
        </div>
        <div style="display:grid; gap:8px;">
          ${state.clients.map((c) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:var(--surface-2); border-radius:var(--radius-sm); font-size:12px;">
              <div>
                <strong>${escapeHtml(c.name)}</strong>
                <small style="color:var(--muted); display:block;">${escapeHtml(c.industry)} · Owner: ${escapeHtml(c.owner)}</small>
              </div>
              ${statusPill(c.status)}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="table-card" style="padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3>Projects & Pipeline (${state.projects.length})</h3>
          <button class="secondary-button" style="padding:2px 8px; font-size:11px;" data-action="show-project-form">+ Add</button>
        </div>
        <div style="display:grid; gap:8px;">
          ${state.projects.map((p) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:var(--surface-2); border-radius:var(--radius-sm); font-size:12px;">
              <div>
                <strong>${escapeHtml(p.name)}</strong>
                <small style="color:var(--muted); display:block;">${escapeHtml(p.stage)} · ${formatCurrency(p.value)}</small>
              </div>
              ${p.risk ? '<span class="pill danger">At Risk</span>' : '<span class="pill success">Healthy</span>'}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function renderClients(state) {
  const query = (state.ui?.clientSearch || '').toLowerCase().trim();
  const allClients = state.clients || [];
  const clients = allClients.filter((c) => !query || c.name.toLowerCase().includes(query) || c.industry.toLowerCase().includes(query) || c.owner.toLowerCase().includes(query));

  return `<div class="view">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Accounts & Portfolios</p>
        <h1>Client Directory</h1>
        <p class="subhead">Manage client records, assigned relationship managers, and active portfolio scopes.</p>
      </div>
      <div class="heading-actions">
        <button class="primary-button" data-action="show-client-form">+ New Client</button>
      </div>
    </div>

    <div class="table-card">
      <div class="table-toolbar">
        <input class="table-search-input" id="client-search-input" value="${escapeHtml(state.ui?.clientSearch || '')}" placeholder="Search accounts or owners…" />
        <span style="font-size:12px; color:var(--muted);">${clients.length} of ${allClients.length} Clients</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Industry</th>
              <th>Status</th>
              <th>Relationship Owner</th>
              <th>Active Projects</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${clients.length ? clients.map((c) => {
              const projectCount = state.projects.filter((p) => p.clientId === c.id).length;
              return `<tr>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.industry)}</td>
                <td>${statusPill(c.status)}</td>
                <td>${escapeHtml(c.owner)}</td>
                <td>${projectCount} project(s)</td>
                <td class="actions-cell">
                  <button class="secondary-button" style="padding:2px 8px; font-size:11px;" data-action="edit-client" data-client-id="${c.id}">Edit</button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:24px;">No client accounts match your search.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function renderProjects(state) {
  const totalVal = totalPipelineValue(state);
  const currentStage = state.ui?.projectFilterStage || 'all';
  const allProjects = state.projects || [];
  const projects = allProjects.filter((p) => currentStage === 'all' || p.stage.toLowerCase() === currentStage.toLowerCase());

  return `<div class="view">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Pipeline & Execution</p>
        <h1>Project Opportunities</h1>
        <p class="subhead">Track deal stages, revenue targets, and delivery risks. Total Pipeline: <b>${formatCurrency(totalVal)}</b></p>
      </div>
      <div class="heading-actions">
        <button class="secondary-button" data-action="show-project-import">Import CSV</button>
        <button class="primary-button" data-action="show-project-form">+ New Project</button>
      </div>
    </div>

    <div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">
      <button class="secondary-button ${currentStage === 'all' ? 'active' : ''}" style="padding:3px 8px; font-size:11px;" data-action="filter-projects" data-stage="all">All (${allProjects.length})</button>
      <button class="secondary-button ${currentStage === 'discovery' ? 'active' : ''}" style="padding:3px 8px; font-size:11px;" data-action="filter-projects" data-stage="discovery">Discovery</button>
      <button class="secondary-button ${currentStage === 'proposal' ? 'active' : ''}" style="padding:3px 8px; font-size:11px;" data-action="filter-projects" data-stage="proposal">Proposal</button>
      <button class="secondary-button ${currentStage === 'negotiation' ? 'active' : ''}" style="padding:3px 8px; font-size:11px;" data-action="filter-projects" data-stage="negotiation">Negotiation</button>
      <button class="secondary-button ${currentStage === 'closed' ? 'active' : ''}" style="padding:3px 8px; font-size:11px;" data-action="filter-projects" data-stage="closed">Closed</button>
    </div>

    <div class="table-card">
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Account</th>
              <th>Stage</th>
              <th>Contract Value</th>
              <th>Health Risk</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${projects.length ? projects.map((p) => {
              const client = state.clients.find((c) => c.id === p.clientId);
              return `<tr>
                <td><strong>${escapeHtml(p.name)}</strong></td>
                <td>${escapeHtml(client?.name || 'Unassigned')}</td>
                <td><span class="pill info">${escapeHtml(p.stage)}</span></td>
                <td><strong>${formatCurrency(p.value)}</strong></td>
                <td>${p.risk ? '<span class="pill danger">At Risk</span>' : '<span class="pill success">Normal</span>'}</td>
                <td class="actions-cell">
                  <button class="secondary-button" style="padding:2px 8px; font-size:11px;" data-action="edit-project" data-project-id="${p.id}">Edit</button>
                </td>
              </tr>`;
            }).join('') : '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:24px;">No projects in this stage.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// --------------------------------------------------------------------------
// SETTINGS VIEW
// --------------------------------------------------------------------------

function renderSettings(state) {
  return `<div class="view">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Preferences & Infrastructure</p>
        <h1>Platform Settings</h1>
        <p class="subhead">Configure local model execution provider, timezone preferences, and theme tokens.</p>
      </div>
    </div>

    <form class="table-card" data-form="settings" style="padding:24px;">
      <div class="form-group">
        <label>Model Endpoint URL</label>
        <input name="providerBaseUrl" value="${escapeHtml(state.settings?.providerBaseUrl || '')}" placeholder="http://127.0.0.1:11434/v1" />
      </div>

      <div class="form-group">
        <label>Primary Language Model</label>
        <input name="model" value="${escapeHtml(state.settings?.model || 'local deterministic')}" placeholder="gpt-4o-mini or local-qwen" />
      </div>

      <div class="form-group">
        <label>Timezone</label>
        <input name="timezone" value="${escapeHtml(state.settings?.timezone || 'Asia/Calcutta')}" />
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px;">
        <button type="button" class="ghost-button" data-action="reset-state" style="color:var(--danger);">Reset Demo State</button>
        <button class="primary-button" type="submit">Save Changes</button>
      </div>
    </form>
  </div>`;
}

// --------------------------------------------------------------------------
// ADMIN PORTAL VIEWS
// --------------------------------------------------------------------------

function renderAdminGuard(state, contentFn) {
  const isAdmin = state.auth?.user?.role === 'admin';
  if (!isAdmin) {
    return `<div class="view" style="text-align:center; padding:60px 20px;">
      <div class="admin-shield-icon" style="margin:0 auto 16px;">🔒</div>
      <h2>Enterprise Administrator Access Required</h2>
      <p class="subhead" style="margin:8px auto 24px; max-width:440px;">
        This administration view is restricted to users with elevated system credentials.
      </p>
      <button class="primary-button" data-action="nav" data-route="admin-login">Sign In as Administrator</button>
    </div>`;
  }
  return contentFn(state);
}

function renderAdminDashboard(state) {
  return renderAdminGuard(state, (st) => `
    <div class="view">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Enterprise Administration</p>
          <h1>Sovereign Admin Console</h1>
          <p class="subhead">Monitor local node health, manage workspaces, inspect agent policies, and audit logs.</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:24px;">
        <div class="table-card" style="margin:0; padding:18px;">
          <span class="eyebrow">System License</span>
          <h3 style="margin:6px 0;">Enterprise Sovereign</h3>
          <small style="color:var(--success);">Air-gapped / Local-first</small>
        </div>
        <div class="table-card" style="margin:0; padding:18px;">
          <span class="eyebrow">Active Users</span>
          <h3 style="margin:6px 0;">${st.adminUsers?.length || 4} Authorized</h3>
          <small style="color:var(--muted);">1 System Administrator</small>
        </div>
        <div class="table-card" style="margin:0; padding:18px;">
          <span class="eyebrow">Workspaces</span>
          <h3 style="margin:6px 0;">${st.adminWorkspaces?.length || 2} Active</h3>
          <small style="color:var(--muted);">Global HQ + EMEA Hub</small>
        </div>
        <div class="table-card" style="margin:0; padding:18px;">
          <span class="eyebrow">Telemetry Policy</span>
          <h3 style="margin:6px 0; color:var(--success);">Zero Egress</h3>
          <small style="color:var(--muted);">Strict outbound lock</small>
        </div>
      </div>

      <div class="section-heading">
        <div>
          <h2>Administration Modules</h2>
          <p class="subhead">Direct access to system configuration and auditing tools.</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px;">
        <div class="table-card" style="margin:0; padding:18px; cursor:pointer;" data-action="nav" data-route="admin-users">
          <h3>👥 Users & Workspaces</h3>
          <p class="subhead" style="margin-top:4px;">Manage accounts, assign roles, and allocate tenant resources.</p>
        </div>
        <div class="table-card" style="margin:0; padding:18px; cursor:pointer;" data-action="nav" data-route="admin-agents">
          <h3>🤖 Agent Configuration</h3>
          <p class="subhead" style="margin-top:4px;">Configure model routing, temperature, and capability boundaries.</p>
        </div>
        <div class="table-card" style="margin:0; padding:18px; cursor:pointer;" data-action="nav" data-route="admin-audit">
          <h3>📜 Tamper-Evident Audit Logs</h3>
          <p class="subhead" style="margin-top:4px;">Full chronological trace of agent executions and file creations.</p>
        </div>
        <div class="table-card" style="margin:0; padding:18px; cursor:pointer;" data-action="nav" data-route="admin-health">
          <h3>🩺 System Health</h3>
          <p class="subhead" style="margin-top:4px;">Live process monitor, memory usage, and OpenCode IPC status.</p>
        </div>
      </div>
    </div>
  `);
}

function renderAdminUsers(state) {
  return renderAdminGuard(state, (st) => `
    <div class="view">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Access Control</p>
          <h1>Users & Workspaces</h1>
          <p class="subhead">Manage authorized enterprise accounts and workspace resource quotas.</p>
        </div>
      </div>

      <div class="table-card">
        <div class="table-toolbar">
          <strong>Authorized User Directory</strong>
          <span class="pill info">${st.adminUsers?.length || 0} Accounts</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Title / Department</th>
                <th>Status</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              ${(st.adminUsers || []).map((u) => `
                <tr>
                  <td>
                    <strong>${escapeHtml(u.name)}</strong>
                    <small style="display:block; color:var(--muted);">${escapeHtml(u.email)}</small>
                  </td>
                  <td><span class="pill ${u.role === 'admin' ? 'warning' : 'info'}">${escapeHtml(u.role)}</span></td>
                  <td>${escapeHtml(u.title)}</td>
                  <td>${statusPill(u.status)}</td>
                  <td>${relativeTime(u.lastActive)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `);
}

function renderAdminAgents(state) {
  return renderAdminGuard(state, (st) => `
    <div class="view">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Workforce Governance</p>
          <h1>Agent Configuration</h1>
          <p class="subhead">Calibrate model temperature, reasoning parameters, and sandboxed tool capabilities.</p>
        </div>
      </div>

      <div style="display:grid; gap:12px;">
        ${(st.adminAgentsConfig || []).map((cfg) => `
          <div class="table-card" style="margin:0; padding:16px; display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div style="display:flex; align-items:center; gap:10px;">
                <strong>${escapeHtml(cfg.name)}</strong>
                <span class="pill info">${escapeHtml(cfg.agentId)}</span>
              </div>
              <small style="color:var(--muted); display:block; margin-top:4px;">
                Engine: <b>${escapeHtml(cfg.model)}</b> · Temperature: <b>${cfg.temperature}</b> · Tools: ${cfg.tools.join(', ')}
              </small>
            </div>
            <span class="pill success">Enforced</span>
          </div>
        `).join('')}
      </div>
    </div>
  `);
}

function renderAdminTemplates(state) {
  return renderAdminGuard(state, (st) => `
    <div class="view">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Durable Office Assets</p>
          <h1>Template Library</h1>
          <p class="subhead">Manage presentation slides, executive memo templates, and spreadsheet models.</p>
        </div>
        <div class="heading-actions">
          <button class="secondary-button" data-action="export-template-bundle" data-template-id="${st.templates?.[0]?.id || ''}">Export Bundle</button>
        </div>
      </div>

      <div class="table-card" style="padding:18px;">
        <div style="display:grid; gap:10px;">
          ${(st.templates || []).map((t) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--surface-2); border-radius:var(--radius-sm);">
              <div>
                <strong>${escapeHtml(t.name)}</strong>
                <small style="color:var(--muted); display:block;">${escapeHtml(t.fileName)} · ${t.placeholders} parameter slots</small>
              </div>
              <span class="pill info">${escapeHtml(t.type.toUpperCase())}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `);
}

function renderAdminModels(state) {
  return renderAdminGuard(state, (st) => `
    <div class="view">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Local & Hybrid Inference</p>
          <h1>Model Settings & Routing</h1>
          <p class="subhead">Inspect local deterministic models, on-premises Ollama endpoints, and sidecar status.</p>
        </div>
      </div>

      <div class="table-card" style="padding:18px;">
        <div style="display:grid; gap:10px;">
          ${(st.adminModels?.providers || []).map((p) => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--surface-2); border-radius:var(--radius-sm);">
              <div>
                <strong>${escapeHtml(p.name)}</strong>
                <small style="display:block; color:var(--muted);">Latency: ${escapeHtml(p.latency)} · Compute: ${escapeHtml(p.cost)}</small>
              </div>
              <span class="pill ${p.status === 'online' ? 'success' : 'info'}">${escapeHtml(p.status)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `);
}

function renderAdminAudit(state) {
  return renderAdminGuard(state, (st) => `
    <div class="view">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Governance & Compliance</p>
          <h1>Tamper-Evident Audit Trail</h1>
          <p class="subhead">Immutable log of agent decisions, peer reviews, file creations, and human approvals.</p>
        </div>
        <div class="heading-actions">
          <button class="secondary-button" data-action="export-audit-json">Export Audit JSON</button>
        </div>
      </div>

      <div class="table-card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Kind</th>
                <th>Severity</th>
                <th>Audit Details</th>
              </tr>
            </thead>
            <tbody>
              ${(st.activity || []).map((act) => `
                <tr>
                  <td style="white-space:nowrap; color:var(--muted);">${formatDateTime(act.at)}</td>
                  <td><code>${escapeHtml(act.kind)}</code></td>
                  <td><span class="activity-indicator ${escapeHtml(act.tone)}"></span> ${escapeHtml(act.tone)}</td>
                  <td>${escapeHtml(act.text)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `);
}

function renderAdminHealth(state) {
  const h = state.adminHealth || { cpuUsage: '14%', ramUsage: '480 MB', uptime: '99.98%' };
  return renderAdminGuard(state, (st) => `
    <div class="view">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Node Observability</p>
          <h1>System Health & Infrastructure</h1>
          <p class="subhead">Live resource consumption, background daemon health, and local IPC connectivity.</p>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px;">
        <div class="table-card" style="margin:0; padding:18px;">
          <span class="eyebrow">CPU Load</span>
          <h2 style="font-size:26px; margin:4px 0;">${h.cpuUsage}</h2>
          <small style="color:var(--success);">Optimal operating band</small>
        </div>
        <div class="table-card" style="margin:0; padding:18px;">
          <span class="eyebrow">Memory Allocation</span>
          <h2 style="font-size:26px; margin:4px 0;">${h.ramUsage}</h2>
          <small style="color:var(--muted);">Process RSS footprint</small>
        </div>
        <div class="table-card" style="margin:0; padding:18px;">
          <span class="eyebrow">Uptime</span>
          <h2 style="font-size:26px; margin:4px 0; color:var(--success);">${h.uptime}</h2>
          <small style="color:var(--muted);">High availability</small>
        </div>
      </div>
    </div>
  `);
}

function renderAdminSecurity(state) {
  return renderAdminGuard(state, (st) => `
    <div class="view">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Security Policy</p>
          <h1>Security & Egress Lockdown</h1>
          <p class="subhead">Hardware-level sandbox constraints, local storage enforcement, and peer-review mandates.</p>
        </div>
      </div>

      <div class="table-card" style="padding:20px;">
        <div style="display:grid; gap:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>Zero Telemetry Enforcement</strong>
              <p class="subhead" style="margin-top:2px;">Prevents all outbound analytical or diagnostic network requests.</p>
            </div>
            <span class="pill success">Enforced</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>Local-Only Storage Mode</strong>
              <p class="subhead" style="margin-top:2px;">All documents, embeddings, and records remain on the host filesystem.</p>
            </div>
            <span class="pill success">Active</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>Mandatory Sentinel Peer Review</strong>
              <p class="subhead" style="margin-top:2px;">No artifact is delivered or finalized without independent review agent signoff.</p>
            </div>
            <span class="pill success">Required</span>
          </div>
        </div>
      </div>
    </div>
  `);
}

// --------------------------------------------------------------------------
// PUBLIC ROUTES: LANDING PAGE & LOGIN
// --------------------------------------------------------------------------

function renderLanding(state) {
  const isDark = (state.theme || 'dark') === 'dark';

  return `<div class="crave-landing-container" id="top">
    <!-- Ambient gentle peach/orange gradient circles -->
    <div class="crave-orb-1" aria-hidden="true"></div>
    <div class="crave-orb-2" aria-hidden="true"></div>
    <div class="crave-orb-3" aria-hidden="true"></div>

    <!-- Floating Clean Pill Navigation Bar -->
    <header class="crave-nav">
      <div class="crave-brand" data-action="nav" data-route="landing">
        <img src="/assets/aistudio/KUBERA_UPDATING_LOGO_d3167c7e.png" alt="KUBERA AI" class="crave-logo-img" />
        <span class="crave-brand-name">KUBERA<span class="crave-dot">.</span></span>
      </div>

      <nav class="crave-nav-links" aria-label="Main Navigation">
        <a href="#categories">What You Can Build</a>
        <a href="#how-it-works">How It Works</a>
        <a href="#flowsync-story">Operations Flow</a>
        <a href="#modules">Three Modules</a>
        <a href="#benefits">Key Benefits</a>
      </nav>

      <div class="crave-nav-actions">
        <button class="theme-toggle-btn" data-action="toggle-theme" title="Toggle Light / Dark Theme" aria-label="Toggle Theme">
          ${isDark ? '☀️' : '🌙'}
        </button>
        <button class="crave-ghost-btn" data-action="nav" data-route="login">Sign In</button>
        <button class="crave-ghost-btn" data-action="nav" data-route="dashboard">Try Demo</button>
        <button class="crave-orange-btn" data-action="nav" data-route="missions">Launch Workspace ➔</button>
      </div>
    </header>

    <!-- HERO SECTION (CRAVE 2-COLUMN LAYOUT) -->
    <section class="crave-hero">
      <!-- Left Column: Copy, Mission Input, Trust Indicators -->
      <div class="crave-hero-left">
        <span class="crave-pill-badge">✦ Local-first AI Workforce</span>
        <h1 class="crave-headline">
          Real files.<br>
          <span class="crave-gradient-text">Controlled agents.</span>
        </h1>
        <p class="crave-subhead">
          State a business goal. KUBERA deploys a bounded team of specialists and delivers an openable PPTX, DOCX or XLSX — not endless chat.
        </p>

        <!-- Search-style Mission Input Field -->
        <form data-form="landing-mission" class="crave-search-box">
          <span class="crave-search-icon">🔍</span>
          <input
            name="landingPrompt"
            id="landing-mission-input"
            placeholder="What should KUBERA deliver? (e.g. Acme Q3 pipeline deck, furniture order #108)..."
            autocomplete="off"
            required
          />
          <button type="submit" class="crave-orange-btn">Start Mission ➔</button>
        </form>

        <!-- Quick Preset Prompt Chips -->
        <div class="crave-chip-group">
          <button type="button" class="crave-chip" data-action="landing-preset" data-prompt="Build a Q3 pipeline deck for Acme Corp">Acme Q3 Deck (PPTX)</button>
          <button type="button" class="crave-chip" data-action="landing-preset" data-prompt="Process order for 50 chairs: check inventory, create invoice and dispatch">Order #50 Chairs (FlowSync)</button>
          <button type="button" class="crave-chip" data-action="landing-preset" data-prompt="Write a Q3 client report for Acme Corp using the client report template">Client Memo (DOCX)</button>
          <button type="button" class="crave-chip" data-action="landing-preset" data-prompt="Create a campaign budget and risk tracker spreadsheet for active projects">Budget Model (XLSX)</button>
        </div>

        <!-- Trust Indicators -->
        <div class="crave-trust-row">
          <span>🔒 Local-first</span>
          <span>•</span>
          <span>🛡️ Fully Auditable</span>
          <span>•</span>
          <span>🖥️ Desktop App</span>
          <span>•</span>
          <span>⚡ Zero Telemetry</span>
        </div>
      </div>

      <!-- Right Column: 3D Floating Document Generation Showcase -->
      <div class="crave-hero-right">
        <div class="crave-mockup-wrapper">
          <!-- Circular Glowing Backdrop -->
          <div class="crave-mockup-orb" aria-hidden="true"></div>

          <!-- Central Live Document Card -->
          <div class="crave-doc-card">
            <div class="crave-doc-header">
              <span class="crave-doc-badge">📊 PPTX Deck</span>
              <span style="font-size:11px; font-weight:700; color:#10B981;">● 100% Verified</span>
            </div>
            <strong style="font-size:15px; letter-spacing:-0.01em; display:block; margin-bottom:4px;">Q3_Acme_Pipeline_Deck.pptx</strong>
            <span style="font-size:11px; color:var(--muted); display:block;">Produced by W-2 Office Worker · 2.4 MB</span>

            <!-- Slide Preview Box -->
            <div class="crave-slide-preview">
              <div class="crave-slide-title">Executive Pipeline & Revenue Forecast</div>
              <div class="crave-slide-bullet"><span>▸</span> <b>$1.24M</b> Contracted Enterprise Pipeline</div>
              <div class="crave-slide-bullet"><span>▸</span> <b>84%</b> Win probability on Acme expansion</div>
              <div class="crave-slide-bullet"><span>▸</span> <b>3</b> Mitigated delivery risk items flagged</div>
            </div>

            <!-- Verification Progress Bar -->
            <div class="crave-progress-bar">
              <div class="crave-progress-fill"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700; color:#665E55; margin-bottom:14px;">
              <span>Sentinel Quality Audit</span>
              <span style="color:#10B981;">Passed 4/4 Checks ✓</span>
            </div>

            <!-- Card Actions -->
            <div style="display:flex; gap:8px;">
              <button class="crave-orange-btn" style="flex:1; justify-content:center; padding:8px 12px; font-size:12px;" data-action="nav" data-route="reports">Inspect File ➔</button>
              <button class="crave-ghost-btn" style="padding:8px 12px; font-size:12px;" data-action="nav" data-route="missions">View Run</button>
            </div>
          </div>

          <!-- Floating Agent 1: Asha (Manager) -->
          <div class="crave-floating-card crave-agent-asha">
            <div class="crave-avatar-circle" style="background:linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%);">A</div>
            <div>
              <strong style="display:block; font-size:12px;">Asha (Manager)</strong>
              <span style="font-size:10px; color:#8B5CF6; font-weight:600;">Bounded depth-one plan</span>
            </div>
          </div>

          <!-- Floating Agent 2: Maya (Analyst) -->
          <div class="crave-floating-card crave-agent-maya">
            <div class="crave-avatar-circle" style="background:linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%);">M</div>
            <div>
              <strong style="display:block; font-size:12px;">Maya (Analyst)</strong>
              <span style="font-size:10px; color:#3B82F6; font-weight:600;">4 records cross-referenced</span>
            </div>
          </div>

          <!-- Floating Agent 3: W-2 (Worker) -->
          <div class="crave-floating-card crave-agent-worker">
            <div class="crave-avatar-circle" style="background:linear-gradient(135deg, #F59E0B 0%, #EA580C 100%);">W</div>
            <div>
              <strong style="display:block; font-size:12px;">W-2 (Doc Worker)</strong>
              <span style="font-size:10px; color:#EA580C; font-weight:600;">Native binary PPTX generated</span>
            </div>
          </div>

          <!-- Floating Agent 4: Sentinel (Reviewer) -->
          <div class="crave-floating-card crave-agent-sentinel">
            <div class="crave-avatar-circle" style="background:linear-gradient(135deg, #10B981 0%, #059669 100%);">S</div>
            <div>
              <strong style="display:block; font-size:12px;">Sentinel (Reviewer)</strong>
              <span style="font-size:10px; color:#10B981; font-weight:700;">Zero hallucination verified ✓</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 1: WHAT ARE YOU BUILDING? (CRAVE CATEGORIES) -->
    <section class="crave-categories-section" id="categories">
      <div class="crave-section-header">
        <p class="crave-section-eyebrow">EXPLORE DELIVERABLES</p>
        <h2 class="crave-section-title">What are you building?</h2>
        <p class="crave-section-subhead">Choose the exact Office format your business requires. Real openable files — no copy-pasting from chat.</p>
      </div>

      <div class="crave-category-grid">
        <!-- 1. PPTX Deck -->
        <div class="crave-cat-card" data-action="nav" data-route="missions">
          <div>
            <div class="crave-cat-top">
              <div class="crave-cat-icon">📊</div>
              <span class="crave-cat-badge">.PPTX</span>
            </div>
            <h3>Board & Pipeline Deck</h3>
            <p>Polished PowerPoint decks with slide layouts, executive talking points, metric callouts, and verified source citations.</p>
          </div>
          <div style="margin-top:20px; font-size:12px; font-weight:700; color:#FF6B35; display:flex; align-items:center; gap:4px;">
            <span>Generate Presentation</span> <span>➔</span>
          </div>
        </div>

        <!-- 2. DOCX Report -->
        <div class="crave-cat-card" data-action="nav" data-route="missions">
          <div>
            <div class="crave-cat-top">
              <div class="crave-cat-icon" style="background:#EFF6FF; color:#2563EB;">📄</div>
              <span class="crave-cat-badge">.DOCX</span>
            </div>
            <h3>Client Memo & Contract</h3>
            <p>Formatted Word documents with executive summaries, scope of work outlines, legal bounds, and structured client profiles.</p>
          </div>
          <div style="margin-top:20px; font-size:12px; font-weight:700; color:#2563EB; display:flex; align-items:center; gap:4px;">
            <span>Draft Executive Memo</span> <span>➔</span>
          </div>
        </div>

        <!-- 3. XLSX Spreadsheet -->
        <div class="crave-cat-card" data-action="nav" data-route="missions">
          <div>
            <div class="crave-cat-top">
              <div class="crave-cat-icon" style="background:#F0FDF4; color:#16A34A;">▦</div>
              <span class="crave-cat-badge">.XLSX</span>
            </div>
            <h3>Pipeline & Inventory Sheet</h3>
            <p>Multi-tab Microsoft Excel workbooks with verified sum formulas, margin models, risk flags, and replenishment forecasts.</p>
          </div>
          <div style="margin-top:20px; font-size:12px; font-weight:700; color:#16A34A; display:flex; align-items:center; gap:4px;">
            <span>Build Spreadsheet Model</span> <span>➔</span>
          </div>
        </div>

        <!-- 4. FlowSync Operations Hub -->
        <div class="crave-cat-card" data-action="nav" data-route="dashboard">
          <div>
            <div class="crave-cat-top">
              <div class="crave-cat-icon" style="background:#FFF7ED; color:#EA580C;">⚙️</div>
              <span class="crave-cat-badge">FLOWSYNC</span>
            </div>
            <h3>Central Operations Hub</h3>
            <p>Unify customer orders, inventory checks, employee dispatch, and invoicing into one calm, automated command surface.</p>
          </div>
          <div style="margin-top:20px; font-size:12px; font-weight:700; color:#EA580C; display:flex; align-items:center; gap:4px;">
            <span>Open Operations Hub</span> <span>➔</span>
          </div>
        </div>

        <!-- 5. Scheduled Mission -->
        <div class="crave-cat-card" data-action="nav" data-route="missions">
          <div>
            <div class="crave-cat-top">
              <div class="crave-cat-icon" style="background:#FAF5FF; color:#9333EA;">⏱️</div>
              <span class="crave-cat-badge">RECURRING</span>
            </div>
            <h3>Scheduled Workforce Mission</h3>
            <p>Autonomous hourly, daily, or weekly operations executed on your schedule — producing reports while you sleep.</p>
          </div>
          <div style="margin-top:20px; font-size:12px; font-weight:700; color:#9333EA; display:flex; align-items:center; gap:4px;">
            <span>Configure Schedules</span> <span>➔</span>
          </div>
        </div>

        <!-- 6. Sovereign Audit Trail -->
        <div class="crave-cat-card" data-action="nav" data-route="admin-audit">
          <div>
            <div class="crave-cat-top">
              <div class="crave-cat-icon" style="background:#FEF2F2; color:#DC2626;">📜</div>
              <span class="crave-cat-badge">SOVEREIGN</span>
            </div>
            <h3>Tamper-Proof Audit Trail</h3>
            <p>Full chronological record of every prompt, thought, delegation, decision, and deliverable checksum stored locally.</p>
          </div>
          <div style="margin-top:20px; font-size:12px; font-weight:700; color:#DC2626; display:flex; align-items:center; gap:4px;">
            <span>Inspect Audit Stream</span> <span>➔</span>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 2: HOW IT WORKS (5-STEP VISUAL FLOW) -->
    <section class="crave-steps-section" id="how-it-works">
      <div class="crave-section-header">
        <p class="crave-section-eyebrow">CONTROLLED LIFECYCLE</p>
        <h2 class="crave-section-title">How KUBERA AI Works</h2>
        <p class="crave-section-subhead">A governed, bounded 5-step lifecycle from simple business request to verified Office deliverable.</p>
      </div>

      <div class="crave-steps-grid">
        <!-- Step 1 -->
        <div class="crave-step-card">
          <div class="crave-step-badge">01</div>
          <h4>State Your Goal</h4>
          <p>Type a mission prompt, speak via microphone, or trigger via schedule with device file attachments.</p>
        </div>

        <!-- Step 2 -->
        <div class="crave-step-card">
          <div class="crave-step-badge">02</div>
          <h4>Asha Scopes Plan</h4>
          <p>Manager agent creates a bounded depth-one task breakdown. No recursive chaos or runaway tokens.</p>
        </div>

        <!-- Step 3 -->
        <div class="crave-step-card">
          <div class="crave-step-badge">03</div>
          <h4>Specialists Execute</h4>
          <p>Maya analyzes data, W-1 reviews operations, and W-2 formats native PowerPoint, Word, or Excel files.</p>
        </div>

        <!-- Step 4 -->
        <div class="crave-step-card">
          <div class="crave-step-badge">04</div>
          <h4>Sentinel Reviews</h4>
          <p>Quality and compliance verification validates that every claim links back to verified source records.</p>
        </div>

        <!-- Step 5 -->
        <div class="crave-step-card">
          <div class="crave-step-badge">05</div>
          <h4>Real File Lands</h4>
          <p>Your openable Office file is deposited in Report Center, ready to inspect, download, or email via SMTP.</p>
        </div>
      </div>
    </section>

    <!-- SECTION 3: FLOWSYNC OPERATIONS WORKFLOW (REAL-WORLD EXAMPLE) -->
    <section class="crave-flowsync-section" id="flowsync-story">
      <div class="crave-section-header">
        <p class="crave-section-eyebrow">THE OPERATIONAL TRANSFORMATION</p>
        <h2 class="crave-section-title">From WhatsApp & Excel Chaos to FlowSync</h2>
        <p class="crave-section-subhead">
          Instead of juggling work through spreadsheets, WhatsApp chats, phone calls, and paper records, FlowSync unifies your entire business into one calm, automated system.
        </p>
      </div>

      <div class="crave-comparison-grid">
        <!-- The Old Manual Way -->
        <div class="crave-compare-card crave-compare-old">
          <h3><span>⚠️</span> The Old Disjointed Way</h3>
          <p style="font-size:13.5px; margin:0 0 16px; opacity:0.85;">
            Example: A furniture company receives an order for <b>50 office chairs</b>.
          </p>
          <div class="crave-compare-list">
            <div class="crave-compare-item">
              <span class="crave-compare-icon-bad">✕</span>
              <span>Order scribbled into a loose Excel sheet on one computer</span>
            </div>
            <div class="crave-compare-item">
              <span class="crave-compare-icon-bad">✕</span>
              <span>Manager messaged through noisy WhatsApp groups and lost in chat</span>
            </div>
            <div class="crave-compare-item">
              <span class="crave-compare-icon-bad">✕</span>
              <span>Warehouse staff physically checks paper clipboards for stock</span>
            </div>
            <div class="crave-compare-item">
              <span class="crave-compare-icon-bad">✕</span>
              <span>Accounts drafts invoice days later in a separate siloed tool</span>
            </div>
            <div class="crave-compare-item">
              <span class="crave-compare-icon-bad">✕</span>
              <span>Customer repeatedly calls asking for order status and delivery dates</span>
            </div>
          </div>
        </div>

        <!-- The KUBERA + FlowSync Way -->
        <div class="crave-compare-card crave-compare-new">
          <h3><span>⚡</span> The KUBERA + FlowSync Way</h3>
          <p style="font-size:13.5px; margin:0 0 16px; color:#E8590C; font-weight:700;">
            Unified, automated, and intelligent execution in one platform:
          </p>
          <div class="crave-compare-list">
            <div class="crave-compare-item">
              <span class="crave-compare-icon-good">✓</span>
              <span>Customer places order online or manager enters goal in 1 line</span>
            </div>
            <div class="crave-compare-item">
              <span class="crave-compare-icon-good">✓</span>
              <span>System automatically checks inventory & predicts replenishment timing</span>
            </div>
            <div class="crave-compare-item">
              <span class="crave-compare-icon-good">✓</span>
              <span>Admin approves order with a single click</span>
            </div>
            <div class="crave-compare-item">
              <span class="crave-compare-icon-good">✓</span>
              <span>Employee automatically assigned with live status and fulfillment tasks</span>
            </div>
            <div class="crave-compare-item">
              <span class="crave-compare-icon-good">✓</span>
              <span>Customer tracks order live; verified DOCX invoice generated on-device instantly!</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 4: THREE MODULES (CUSTOMER, EMPLOYEE, ADMIN) -->
    <section class="crave-modules-section" id="modules">
      <div class="crave-section-header">
        <p class="crave-section-eyebrow">ENTERPRISE ARCHITECTURE</p>
        <h2 class="crave-section-title">Three Unified Business Modules</h2>
        <p class="crave-section-subhead">Role-based controls tailored for your clients, your operational workforce, and sovereign administrative oversight.</p>
      </div>

      <div class="crave-modules-grid">
        <!-- Module 1: Customer Module -->
        <div class="crave-module-card">
          <div>
            <span class="crave-module-pill crave-pill-customer">Customer Module</span>
            <h3>Customer Experience</h3>
            <p>Empower clients to place orders, track live milestone progress, access verified invoices, and communicate directly with your team.</p>
            <div class="crave-module-features">
              <span><b>✓</b> Live Order & Delivery Tracking</span>
              <span><b>✓</b> Instant Native Invoices & Receipts</span>
              <span><b>✓</b> Direct Milestone Notifications</span>
              <span><b>✓</b> Frictionless Account Self-Service</span>
            </div>
          </div>
          <button class="crave-ghost-btn" style="margin-top:24px; width:100%;" data-action="nav" data-route="clients">Explore Client Directory ➔</button>
        </div>

        <!-- Module 2: Employee Module -->
        <div class="crave-module-card">
          <div>
            <span class="crave-module-pill crave-pill-employee">Employee Module</span>
            <h3>Workforce Execution</h3>
            <p>Give your staff clear task assignments, automated inventory deductions, delivery dispatch tools, and real-time order updates.</p>
            <div class="crave-module-features">
              <span><b>✓</b> Automated Task Queues & Milestones</span>
              <span><b>✓</b> Real-time Inventory Deductions</span>
              <span><b>✓</b> Delivery & Fulfillment Hand-offs</span>
              <span><b>✓</b> Synchronized Team Activity Stream</span>
            </div>
          </div>
          <button class="crave-ghost-btn" style="margin-top:24px; width:100%;" data-action="nav" data-route="workforce">Inspect Digital Workforce ➔</button>
        </div>

        <!-- Module 3: Admin Sovereign Module -->
        <div class="crave-module-card">
          <div>
            <span class="crave-module-pill crave-pill-admin">Admin Sovereign Module</span>
            <h3>Command & Analytics</h3>
            <p>Full executive control over customer relationships, inventory levels, payments, agent guardrails, and AI-powered replenishment insights.</p>
            <div class="crave-module-features">
              <span><b>✓</b> Complete Client & Project Records</span>
              <span><b>✓</b> AI Stock Replenishment Forecasts</span>
              <span><b>✓</b> Controlled Agent Configuration</span>
              <span><b>✓</b> Tamper-proof Audit Ledger</span>
            </div>
          </div>
          <button class="crave-orange-btn" style="margin-top:24px; width:100%; justify-content:center;" data-action="nav" data-route="admin-dashboard">Admin Command Center ➔</button>
        </div>
      </div>
    </section>

    <!-- SECTION 5: KEY BENEFITS -->
    <section class="crave-benefits-section" id="benefits">
      <div class="crave-section-header">
        <p class="crave-section-eyebrow">THE SOVEREIGN DIFFERENCE</p>
        <h2 class="crave-section-title">Built for Real Business Operations</h2>
        <p class="crave-section-subhead">Designed from first principles to avoid the pitfalls of generic chatbots and cloud surveillance.</p>
      </div>

      <div class="crave-benefits-grid">
        <!-- Benefit 1 -->
        <div class="crave-benefit-card">
          <div class="crave-benefit-icon">🛡️</div>
          <h3>Controlled Workforce</h3>
          <p>No recursive loops, no hallucinations, and no runaway token burn. Strict depth-one delegation with bounded subtasks keeps every execution accountable.</p>
        </div>

        <!-- Benefit 2 -->
        <div class="crave-benefit-card">
          <div class="crave-benefit-icon" style="background:#EFF6FF; color:#2563EB;">📄</div>
          <h3>Real Openable Office Files</h3>
          <p>Native binary PPTX, DOCX, and XLSX files generated on your computer that open cleanly in Microsoft Office, Apple iWork, or Google Workspace.</p>
        </div>

        <!-- Benefit 3 -->
        <div class="crave-benefit-card">
          <div class="crave-benefit-icon" style="background:#F0FDF4; color:#16A34A;">🔒</div>
          <h3>100% Local Sovereignty</h3>
          <p>Runs locally on your computer with SQLite persistence and strict egress rules. Your business records and customer data never leak to third-party scrapers.</p>
        </div>
      </div>
    </section>

    <!-- SECTION 6: FINAL CTA (CRAVE WARM PEACH GRADIENT) -->
    <section class="crave-cta-section">
      <div class="crave-cta-box">
        <h2 class="crave-cta-headline">Stop chatting. Start shipping files.</h2>
        <p class="crave-cta-subhead">
          Replace disjointed WhatsApp chats, loose spreadsheets, and hallucinating chatbots with a centralized, automated digital workforce.
        </p>
        <div class="crave-cta-actions">
          <button class="crave-orange-btn" style="padding:14px 32px; font-size:15px;" data-action="nav" data-route="missions">Launch KUBERA Workspace ➔</button>
          <button class="crave-ghost-btn" style="padding:14px 28px; font-size:15px; background:rgba(255,255,255,0.8);" data-action="nav" data-route="dashboard">Try Interactive Demo</button>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="crave-footer">
      <div class="crave-footer-inner">
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="/assets/aistudio/KUBERA_UPDATING_LOGO_d3167c7e.png" alt="KUBERA AI" class="crave-logo-img" />
          <div>
            <strong style="color:var(--text); font-size:14px;">KUBERA<span class="crave-dot">.</span></strong>
            <div style="font-size:11.5px; color:var(--muted);">FlowSync Operations & Autonomous Digital Workforce</div>
          </div>
        </div>

        <div class="crave-footer-links">
          <a href="#categories">Deliverables</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#flowsync-story">FlowSync Story</a>
          <a href="#" data-action="nav" data-route="login">Sign In</a>
          <a href="#" data-action="nav" data-route="admin-login">Admin Portal</a>
          <a href="#" data-action="nav" data-route="dashboard">Workspace</a>
        </div>
      </div>
      <div style="max-width:1140px; margin:24px auto 0; padding-top:16px; border-top:1px solid rgba(220,210,200,0.5); display:flex; justify-content:space-between; font-size:11.5px; color:var(--dim); flex-wrap:wrap; gap:8px;">
        <span>© 2026 KUBERA AI · Local-First Business Operations · Apache-2.0</span>
        <span>Local SQLite & File Persistence · Desktop Native Ready</span>
      </div>
    </footer>
  </div>`;
}

// --------------------------------------------------------------------------
// SPLIT-SCREEN USER LOGIN (FITSPHERE STRUCTURAL REFERENCE)
// --------------------------------------------------------------------------

function renderLogin(state) {
  const isDark = (state.theme || 'dark') === 'dark';

  return `<div class="split-login-wrapper">
    <div class="split-login-container">
      <!-- Left Panel: Branding & Workforce Features -->
      <div class="login-brand-panel">
        <div>
          <div class="brand">
            <img src="/assets/aistudio/KUBERA_UPDATING_LOGO_d3167c7e.png" alt="KUBERA" class="brand-logo-img" />
            <span style="color:#FFF;">KUBERA<span class="brand-dot">.</span></span>
          </div>
          <span class="prototype-tag" style="margin-top:14px; background:rgba(168,85,247,0.18); color:#DDD6FE; border-color:rgba(192,132,252,0.35);">
            YOUR DIGITAL WORKFORCE
          </span>
          <h2>
            Business operations.<br>
            <span class="highlight">Intelligently simplified.</span>
          </h2>
          <p style="font-size:13px; line-height:1.55; color:#CBD5E1; margin-top:12px;">
            Deploy AI agents, execute business missions, analyze information, and generate professional Office files from one intelligent workspace.
          </p>

          <div class="brand-feature-stack">
            <div class="brand-feature-pill">
              <strong>24/7</strong> — AI Workforce
            </div>
            <div class="brand-feature-pill">
              <strong>Multi-Agent</strong> — Collaboration
            </div>
            <div class="brand-feature-pill">
              <strong>Real Files</strong> — PPTX · DOCX · XLSX
            </div>
          </div>
        </div>

        <div style="font-size:11px; color:#94A3B8; display:flex; align-items:center; gap:8px;">
          <span>🔒 Local-first execution sandbox</span>
          <span>·</span>
          <span>v0.1.0 Sovereign</span>
        </div>
      </div>

      <!-- Right Panel: User Sign In -->
      <div class="login-form-panel">
        <div class="login-header-group">
          <p class="eyebrow">USER WORKSPACE</p>
          <h2>Sign in</h2>
          <p class="subhead">Access your KUBERA AI local workspace.</p>
        </div>

        <form data-form="user-login">
          <div class="form-group">
            <label>Email or Username</label>
            <input type="text" name="email" value="alex.vance@kubera.corp" required placeholder="alex@company.com" />
          </div>

          <div class="form-group">
            <label>Password</label>
            <div class="input-with-action">
              <input type="password" id="user-password-input" name="password" value="••••••••••••" required />
              <button type="button" class="input-action-btn" data-action="toggle-password-visibility" data-target="user-password-input">👁</button>
            </div>
          </div>

          <div class="login-options-row">
            <label class="checkbox-label">
              <input type="checkbox" checked />
              <span>Remember me</span>
            </label>
            <a href="#" data-action="toast-forgot-password">Forgot password?</a>
          </div>

          <div style="display:grid; gap:10px;">
            <button class="primary-button" type="submit" style="padding:10px; font-size:14px;">
              Sign in to KUBERA
            </button>
            <button class="secondary-button" type="button" data-action="login-local-workspace" style="padding:10px; font-size:13px;">
              Continue with local workspace
            </button>
          </div>

          <div style="margin-top:24px; padding-top:16px; border-top:1px solid var(--line); display:flex; justify-content:space-between; font-size:11px; color:var(--muted);">
            <a href="#" data-action="nav" data-route="admin-login">Admin Console Access →</a>
            <a href="#" data-action="nav" data-route="landing">Back to Landing Page</a>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

// --------------------------------------------------------------------------
// ADMIN LOGIN
// --------------------------------------------------------------------------

function renderAdminLogin(state) {
  return `<div class="split-login-wrapper">
    <div class="admin-login-box">
      <div class="admin-shield-icon">🛡️</div>
      <p class="eyebrow" style="color:var(--warning);">RESTRICTED ACCESS · SYSTEM ADMINISTRATION</p>
      <h2>KUBERA Sovereign Console</h2>
      <p class="subhead" style="margin-bottom:24px;">Secure administrative access for system configuration, model routing, and security audits.</p>

      <form data-form="admin-login">
        <div class="form-group">
          <label>Administrator Email / ID</label>
          <input type="text" name="adminEmail" value="admin@kubera.corp" required />
        </div>

        <div class="form-group">
          <label>Master Security Passkey</label>
          <div class="input-with-action">
            <input type="password" id="admin-passkey-input" name="adminPasskey" value="••••••••••••••••" required />
            <button type="button" class="input-action-btn" data-action="toggle-password-visibility" data-target="admin-passkey-input">👁</button>
          </div>
        </div>

        <div style="display:grid; gap:10px; margin-top:20px;">
          <button class="primary-button" type="submit" style="padding:10px; font-size:14px; background:var(--primary);">
            Authenticate as Administrator
          </button>
          <button class="secondary-button" type="button" data-action="login-quick-admin" style="padding:10px; font-size:13px;">
            Quick Admin Access (Development)
          </button>
        </div>

        <div style="margin-top:20px; text-align:center; font-size:11px;">
          <a href="#" data-action="nav" data-route="login">← Return to User Login</a>
        </div>
      </form>
    </div>
  </div>`;
}

// --------------------------------------------------------------------------
// COMMAND PALETTE (CTRL+K)
// --------------------------------------------------------------------------

function renderCommandPalette(state) {
  if (!state.ui?.commandPaletteOpen) return '';

  const search = (state.ui?.cmdSearch || '').toLowerCase().trim();

  const commands = [
    { cat: 'Navigation', title: 'Go to Overview Dashboard', action: 'nav', route: 'dashboard', icon: '◇' },
    { cat: 'Navigation', title: 'Go to Missions Center', action: 'nav', route: 'missions', icon: '◈' },
    { cat: 'Navigation', title: 'Go to Workforce Roster', action: 'nav', route: 'workforce', icon: '◎' },
    { cat: 'Navigation', title: 'Go to Reports & Office Artifacts', action: 'nav', route: 'reports', icon: '▱' },
    { cat: 'Navigation', title: 'Go to Records Management', action: 'nav', route: 'records', icon: '▦' },
    { cat: 'Navigation', title: 'Go to Client Directory', action: 'nav', route: 'clients', icon: '⬡' },
    { cat: 'Navigation', title: 'Go to Project Pipeline', action: 'nav', route: 'projects', icon: '◫' },
    { cat: 'Navigation', title: 'Go to Platform Settings', action: 'nav', route: 'settings', icon: '⚙' },
    { cat: 'Admin', title: 'Admin Overview', action: 'nav', route: 'admin-dashboard', icon: '⎈' },
    { cat: 'Admin', title: 'Audit Trail Logs', action: 'nav', route: 'admin-audit', icon: '📜' },
    { cat: 'Admin', title: 'Agent Configuration', action: 'nav', route: 'admin-agents', icon: '🤖' },
    { cat: 'Actions', title: 'Deploy New Mission (Board Deck)', action: 'quick-deploy-deck', icon: '🚀' },
    { cat: 'Actions', title: 'Toggle Light / Dark Theme', action: 'toggle-theme', icon: '☀️' },
    { cat: 'Actions', title: 'Create Client Record', action: 'show-client-form', icon: '➕' },
    { cat: 'Actions', title: 'Import Projects from CSV', action: 'show-project-import', icon: '📥' }
  ];

  const filtered = commands.filter((cmd) => cmd.title.toLowerCase().includes(search) || cmd.cat.toLowerCase().includes(search));

  return `<div class="cmd-palette-backdrop" data-action="close-cmd-palette">
    <div class="cmd-palette-dialog">
      <div class="cmd-search-header">
        <span>🔍</span>
        <input
          class="cmd-search-input"
          id="cmd-palette-input"
          placeholder="Search commands, navigate routes, or trigger actions…"
          value="${escapeHtml(state.ui?.cmdSearch || '')}"
          autofocus />
        <button class="ghost-button" data-action="close-cmd-palette">ESC</button>
      </div>
      <div class="cmd-results-list">
        ${filtered.length ? filtered.map((cmd) => `
          <div class="cmd-item" data-action="${cmd.action}" data-route="${cmd.route || ''}">
            <div style="display:flex; align-items:center; gap:10px;">
              <span>${cmd.icon}</span>
              <span>${escapeHtml(cmd.title)}</span>
            </div>
            <span class="pill" style="font-size:9px;">${cmd.cat}</span>
          </div>
        `).join('') : '<div style="padding:16px; color:var(--muted); text-align:center;">No matching commands found.</div>'}
      </div>
      <div class="cmd-footer">
        <span>Navigation: Click or Enter</span>
        <span>·</span>
        <span>Close: ESC</span>
      </div>
    </div>
  </div>`;
}

// --------------------------------------------------------------------------
// MODAL DIALOGS (REPORTS, CLIENTS, PROJECTS, CSV)
// --------------------------------------------------------------------------

function renderModal(state) {
  // 1. Report preview modal
  if (state.ui?.modalReportId) {
    const report = state.reports.find((item) => item.id === state.ui.modalReportId);
    if (!report) return '';

    const approval = (state.approvals || []).find((item) => item.deliverableId === report.id);
    const approvalActions = approval?.status === 'pending'
      ? `<button class="primary-button" data-action="approve-approval" data-approval-id="${approval.id}">Approve Artifact</button>
         <button class="ghost-button" data-action="reject-approval" data-approval-id="${approval.id}">Reject with Feedback</button>`
      : `<button class="secondary-button" data-action="request-approval" data-report-id="${report.id}">Request Human Review</button>`;

    const visualPreview = report.visualPreviewLoading
      ? '<div style="padding:20px; text-align:center; color:var(--muted);">Rendering visual snapshot…</div>'
      : report.visualPreviewHtml
        ? `<iframe style="width:100%; height:360px; border:1px solid var(--line); border-radius:var(--radius-sm); margin:12px 0;" sandbox="allow-same-origin" srcdoc="${escapeHtml(report.visualPreviewHtml)}"></iframe>`
        : '';

    return `<div class="modal-backdrop" data-action="close-report">
      <div class="modal">
        <button class="icon-button modal-close" data-action="close-report">×</button>
        <span class="pill info">${report.type.toUpperCase()} · Verified Artifact</span>
        <h2 style="margin:10px 0 4px;">${escapeHtml(report.name)}</h2>
        <p class="subhead">Produced by ${escapeHtml(report.producer)} · Size: ${escapeHtml(report.size || '2.4 MB')}</p>

        ${visualPreview}

        <div style="margin:16px 0; padding:12px; border-radius:var(--radius-sm); background:var(--surface-2); border:1px solid var(--line);">
          <strong style="font-size:12px;">Structured Outline:</strong>
          <div style="margin-top:8px; display:grid; gap:4px; font-size:11px;">
            ${(report.outline || []).map((sec, i) => `<div>${String(i + 1).padStart(2, '0')}. <b>${escapeHtml(sec)}</b></div>`).join('')}
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
          <div style="display:flex; gap:8px;">
            ${approvalActions}
          </div>
          <button class="secondary-button" data-action="close-report">Done</button>
        </div>
      </div>
    </div>`;
  }

  // 2. Client form modal
  if (state.ui?.recordForm === 'client' || state.ui?.recordForm?.type === 'client') {
    const clientId = state.ui.recordForm?.id;
    const client = clientId ? state.clients.find((c) => c.id === clientId) : null;

    return `<div class="modal-backdrop" data-action="close-record-form">
      <div class="modal" style="max-width:480px;">
        <button class="icon-button modal-close" data-action="close-record-form">×</button>
        <h2>${client ? 'Edit Client Record' : 'New Client Record'}</h2>
        <p class="subhead">Manage client profile details in local persistence.</p>

        <form data-form="record" data-record-type="client" style="margin-top:16px;">
          <input type="hidden" name="recordId" value="${client?.id || ''}" />
          <div class="form-group">
            <label>Client / Company Name</label>
            <input name="clientName" value="${escapeHtml(client?.name || '')}" required />
          </div>
          <div class="form-group">
            <label>Industry</label>
            <input name="industry" value="${escapeHtml(client?.industry || 'Enterprise SaaS')}" required />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="status">
              <option value="active" ${client?.status === 'active' ? 'selected' : ''}>Active</option>
              <option value="prospect" ${client?.status === 'prospect' ? 'selected' : ''}>Prospect</option>
            </select>
          </div>
          <div class="form-group">
            <label>Relationship Owner</label>
            <input name="owner" value="${escapeHtml(client?.owner || 'Priya Shah')}" required />
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
            <button type="button" class="secondary-button" data-action="close-record-form">Cancel</button>
            <button class="primary-button" type="submit">Save Client</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  // 3. Project form modal
  if (state.ui?.recordForm === 'project' || state.ui?.recordForm?.type === 'project') {
    const projectId = state.ui.recordForm?.id;
    const project = projectId ? state.projects.find((p) => p.id === projectId) : null;

    return `<div class="modal-backdrop" data-action="close-record-form">
      <div class="modal" style="max-width:480px;">
        <button class="icon-button modal-close" data-action="close-record-form">×</button>
        <h2>${project ? 'Edit Project' : 'New Project Opportunity'}</h2>
        <p class="subhead">Update project pipeline attributes and risk flags.</p>

        <form data-form="record" data-record-type="project" style="margin-top:16px;">
          <input type="hidden" name="recordId" value="${project?.id || ''}" />
          <div class="form-group">
            <label>Project Name</label>
            <input name="projectName" value="${escapeHtml(project?.name || '')}" required />
          </div>
          <div class="form-group">
            <label>Client Account</label>
            <select name="clientId" required>
              ${state.clients.map((c) => `<option value="${c.id}" ${project?.clientId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Stage</label>
            <select name="stage">
              <option value="Discovery" ${project?.stage === 'Discovery' ? 'selected' : ''}>Discovery</option>
              <option value="Proposal" ${project?.stage === 'Proposal' ? 'selected' : ''}>Proposal</option>
              <option value="Negotiation" ${project?.stage === 'Negotiation' ? 'selected' : ''}>Negotiation</option>
              <option value="Closed" ${project?.stage === 'Closed' ? 'selected' : ''}>Closed</option>
            </select>
          </div>
          <div class="form-group">
            <label>Contract Value ($ USD)</label>
            <input type="number" name="value" value="${project?.value || 100000}" required min="0" />
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" name="risk" ${project?.risk ? 'checked' : ''} />
              <span>Flag as delivery risk</span>
            </label>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
            <button type="button" class="secondary-button" data-action="close-record-form">Cancel</button>
            <button class="primary-button" type="submit">Save Project</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  // 4. CSV Import Modal
  if (state.ui?.recordForm === 'project-import') {
    return `<div class="modal-backdrop" data-action="close-record-form">
      <div class="modal" style="max-width:520px;">
        <button class="icon-button modal-close" data-action="close-record-form">×</button>
        <h2>Import Projects from CSV</h2>
        <p class="subhead">Bulk import opportunities with schema validation (name, stage, value, risk_flag).</p>

        <form data-form="project-csv" style="margin-top:16px;">
          <div class="form-group">
            <label>Target Client</label>
            <select name="clientId" id="project-csv-client-id" required>
              ${state.clients.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label>Choose CSV File</label>
            <input type="file" id="project-csv-input" accept=".csv,text/csv" required />
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px;">
            <button type="button" class="ghost-button" data-action="load-sample-csv">Load Sample Data</button>
            <div style="display:flex; gap:8px;">
              <button type="button" class="secondary-button" data-action="close-record-form">Cancel</button>
              <button class="primary-button" type="submit">Import Records</button>
            </div>
          </div>
        </form>
      </div>
    </div>`;
  }

  // 5. Approved delivery dialog
  if (state.ui?.deliveryReportId) {
    const report = state.reports.find((r) => r.id === state.ui.deliveryReportId);
    if (!report) return '';

    return `<div class="modal-backdrop" data-action="hide-delivery-form">
      <div class="modal" style="max-width:480px;">
        <button class="icon-button modal-close" data-action="hide-delivery-form">×</button>
        <p class="eyebrow">External Delivery</p>
        <h2>Send ${escapeHtml(report.name)}</h2>
        <p class="subhead">Deliver approved Office deliverable through verified SMTP email or Slack file channel.</p>

        <form data-form="delivery" style="margin-top:16px;">
          <input type="hidden" name="deliverableId" value="${report.id}" />
          <div class="form-group">
            <label>Delivery Channel</label>
            <select name="channel">
              <option value="email_smtp">SMTP Email Attachment</option>
              <option value="slack_upload">Slack File Upload</option>
            </select>
          </div>
          <div class="form-group">
            <label>Recipient Address / Channel ID</label>
            <input name="recipient" required placeholder="client@acme.com or #board-reports" />
          </div>
          <div class="form-group">
            <label>Message Note</label>
            <textarea name="message" rows="2" placeholder="Attached is the approved deliverable for review."></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
            <button type="button" class="secondary-button" data-action="hide-delivery-form">Cancel</button>
            <button class="primary-button" type="submit">Send Approved File</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  return '';
}

// --------------------------------------------------------------------------
// ACTIVITY FEED
// --------------------------------------------------------------------------

function renderActivity(state) {
  const events = state.activity?.slice(0, 20) || [];

  return `<aside class="activity-panel">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <p class="eyebrow" style="margin:0;">Live Audit Stream</p>
      <span class="pulse"></span>
    </div>
    <div class="activity-feed-list">
      ${events.map((e) => `
        <div class="activity-item">
          <span class="activity-indicator ${e.tone}"></span>
          <div class="activity-content">
            <div>${escapeHtml(e.text)}</div>
            <span class="activity-time">${relativeTime(e.at)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  </aside>`;
}

// --------------------------------------------------------------------------
// MAIN RENDER SWITCH
// --------------------------------------------------------------------------

function render(state) {
  // Sync HTML theme data attribute
  document.documentElement.dataset.theme = state.theme || 'dark';

  const route = state.route || 'dashboard';

  // 1. Public route: Landing Page
  if (route === 'landing') {
    root.innerHTML = `${renderLanding(state)}${renderModal(state)}${renderCommandPalette(state)}`;
    return;
  }

  // 2. Public route: User Login
  if (route === 'login') {
    root.innerHTML = `${renderLogin(state)}${renderModal(state)}${renderCommandPalette(state)}`;
    return;
  }

  // 3. Public route: Admin Login
  if (route === 'admin-login') {
    root.innerHTML = `${renderAdminLogin(state)}${renderModal(state)}${renderCommandPalette(state)}`;
    return;
  }

  // 4. Authenticated Application Shell
  let content = '';
  switch (route) {
    case 'dashboard':
      content = renderDashboard(state);
      break;
    case 'missions':
      content = renderMissions(state);
      break;
    case 'workforce':
      content = renderWorkforce(state);
      break;
    case 'reports':
      content = renderReports(state);
      break;
    case 'records':
      content = renderRecords(state);
      break;
    case 'clients':
      content = renderClients(state);
      break;
    case 'projects':
      content = renderProjects(state);
      break;
    case 'settings':
      content = renderSettings(state);
      break;
    case 'admin-dashboard':
      content = renderAdminDashboard(state);
      break;
    case 'admin-users':
      content = renderAdminUsers(state);
      break;
    case 'admin-agents':
      content = renderAdminAgents(state);
      break;
    case 'admin-templates':
      content = renderAdminTemplates(state);
      break;
    case 'admin-models':
      content = renderAdminModels(state);
      break;
    case 'admin-audit':
      content = renderAdminAudit(state);
      break;
    case 'admin-health':
      content = renderAdminHealth(state);
      break;
    case 'admin-security':
      content = renderAdminSecurity(state);
      break;
    default:
      content = renderDashboard(state);
  }

  root.innerHTML = `<div class="app-shell">
    ${renderHeader(state)}
    <div class="workspace">
      ${renderSidebar(state)}
      <main class="main-panel">${content}</main>
      ${renderActivity(state)}
    </div>
  </div>
  ${renderModal(state)}
  ${renderCommandPalette(state)}`;
}

// --------------------------------------------------------------------------
// TOAST NOTIFICATIONS
// --------------------------------------------------------------------------

function toast(message, tone = 'info') {
  const region = document.querySelector('#toast-region');
  if (!region) return;
  const item = document.createElement('div');
  item.className = `toast ${tone}`;
  item.textContent = message;
  region.append(item);
  window.setTimeout(() => item.remove(), 3600);
}

// --------------------------------------------------------------------------
// WEB SPEECH API INITIALIZATION & HANDLERS
// --------------------------------------------------------------------------

function toggleVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    toast('Web Speech API is not supported in this browser. You can type your mission directly.', 'warning');
    return;
  }

  if (speechIsListening) {
    if (speechRecognitionInstance) {
      speechRecognitionInstance.stop();
    }
    speechIsListening = false;
    api.update((next) => {
      next.ui = { ...(next.ui || {}), voiceListening: false };
    });
    toast('Voice recognition stopped.', 'info');
    return;
  }

  try {
    speechRecognitionInstance = new SpeechRecognition();
    speechRecognitionInstance.continuous = true;
    speechRecognitionInstance.interimResults = true;
    speechRecognitionInstance.lang = 'en-US';

    speechRecognitionInstance.onstart = () => {
      speechIsListening = true;
      api.update((next) => {
        next.ui = { ...(next.ui || {}), voiceListening: true };
      });
      toast('Listening… Speak your mission prompt clearly.', 'info');
    };

    speechRecognitionInstance.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      const textarea = root.querySelector('#mission-text-input');
      if (textarea) {
        textarea.value = transcript;
      }
      api.update((next) => {
        next.ui = { ...(next.ui || {}), missionDraftText: transcript };
      });
    };

    speechRecognitionInstance.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      speechIsListening = false;
      api.update((next) => {
        next.ui = { ...(next.ui || {}), voiceListening: false };
      });
      toast(`Voice error: ${event.error}`, 'danger');
    };

    speechRecognitionInstance.onend = () => {
      speechIsListening = false;
      api.update((next) => {
        next.ui = { ...(next.ui || {}), voiceListening: false };
      });
    };

    speechRecognitionInstance.start();
  } catch (err) {
    console.warn('Speech recognition start failed:', err);
    toast('Could not start microphone voice input.', 'danger');
  }
}

// --------------------------------------------------------------------------
// EVENT LISTENERS & ACTION DISPATCH
// --------------------------------------------------------------------------

// Keyboard shortcuts (Cmd+K / Ctrl+K and ESC)
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    api.update((next) => {
      next.ui = { ...(next.ui || {}), commandPaletteOpen: !next.ui?.commandPaletteOpen, cmdSearch: '' };
    });
  }
  if (e.key === 'Escape') {
    const st = api.getState();
    if (st.ui?.commandPaletteOpen || st.ui?.modalReportId || st.ui?.recordForm || st.ui?.deliveryReportId) {
      api.update((next) => {
        next.ui = {
          ...(next.ui || {}),
          commandPaletteOpen: false,
          modalReportId: null,
          recordForm: null,
          deliveryReportId: null
        };
      });
    }
  }
});

// File input change for mission attachments
window.addEventListener('change', (event) => {
  const input = event.target;
  if (input.id === 'mission-file-picker' && input.files?.length) {
    const files = Array.from(input.files);
    const newAttachments = files.map((file) => ({
      id: id('att'),
      name: file.name,
      size: file.size,
      type: file.type || file.name.split('.').pop()
    }));

    api.update((next) => {
      next.ui = next.ui || {};
      next.ui.missionAttachments = [...(next.ui.missionAttachments || []), ...newAttachments];
    });
    toast(`Attached ${files.length} device file(s).`, 'success');
  }
});

// Clipboard paste listener for images / files
window.addEventListener('paste', (event) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  const files = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].kind === 'file') {
      const file = items[i].getAsFile();
      if (file) files.push(file);
    }
  }

  if (files.length) {
    const newAttachments = files.map((file) => ({
      id: id('att'),
      name: file.name || `Pasted Image ${Date.now()}.png`,
      size: file.size,
      type: file.type || 'image/png'
    }));

    api.update((next) => {
      next.ui = next.ui || {};
      next.ui.missionAttachments = [...(next.ui.missionAttachments || []), ...newAttachments];
    });
    toast(`Pasted ${files.length} image / attachment(s) from clipboard.`, 'success');
  }
});

// Drag and drop support over composer
window.addEventListener('dragover', (e) => {
  const composer = e.target.closest('#mission-composer-card');
  if (composer) {
    e.preventDefault();
    composer.classList.add('drag-over');
  }
});

window.addEventListener('dragleave', (e) => {
  const composer = e.target.closest('#mission-composer-card');
  if (composer) {
    composer.classList.remove('drag-over');
  }
});

window.addEventListener('drop', (e) => {
  const composer = e.target.closest('#mission-composer-card');
  if (composer) {
    e.preventDefault();
    composer.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) {
      const newAttachments = files.map((file) => ({
        id: id('att'),
        name: file.name,
        size: file.size,
        type: file.type || file.name.split('.').pop()
      }));

      api.update((next) => {
        next.ui = next.ui || {};
        next.ui.missionAttachments = [...(next.ui.missionAttachments || []), ...newAttachments];
      });
      toast(`Dropped ${files.length} file(s) into mission.`, 'success');
    }
  }
});

// Main click event delegation
root.addEventListener('click', (event) => {
  const hashAnchor = event.target.closest('a[href^="#"]');
  if (hashAnchor) {
    const href = hashAnchor.getAttribute('href');
    if (href && href.length > 1 && href.startsWith('#')) {
      const targetEl = root.querySelector(href);
      if (targetEl) {
        event.preventDefault();
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }

  const actionTarget = event.target.closest('[data-action]');
  if (!actionTarget) return;
  if (actionTarget.tagName === 'A' || actionTarget.closest('a')) {
    event.preventDefault();
  }
  const { action } = actionTarget.dataset;

  // 1. Navigation
  if (action === 'nav') {
    const targetRoute = actionTarget.dataset.route;
    api.update((next) => {
      next.route = targetRoute;
      next.ui = { ...(next.ui || {}), commandPaletteOpen: false };
    });
  }

  // Filter Reports category
  if (action === 'filter-reports') {
    const filterType = actionTarget.dataset.type;
    api.update((next) => {
      next.ui = { ...(next.ui || {}), reportFilterType: filterType };
    });
  }

  // Filter Projects stage
  if (action === 'filter-projects') {
    const stage = actionTarget.dataset.stage;
    api.update((next) => {
      next.ui = { ...(next.ui || {}), projectFilterStage: stage };
    });
  }

  // 2. Theme Toggle
  if (action === 'toggle-theme') {
    api.update((next) => {
      next.theme = (next.theme || 'dark') === 'dark' ? 'light' : 'dark';
    });
    toast(`Switched to ${(api.getState().theme || 'dark').toUpperCase()} mode.`, 'info');
  }

  // 3. Command Palette
  if (action === 'open-cmd-palette') {
    api.update((next) => {
      next.ui = { ...(next.ui || {}), commandPaletteOpen: true, cmdSearch: '' };
    });
    window.setTimeout(() => {
      const input = root.querySelector('#cmd-palette-input');
      if (input) input.focus();
    }, 50);
  }

  if (action === 'close-cmd-palette') {
    if (actionTarget.classList.contains('cmd-palette-backdrop') && event.target !== actionTarget) {
      return;
    }
    api.update((next) => {
      next.ui = { ...(next.ui || {}), commandPaletteOpen: false };
    });
  }

  // 4. Voice dictation toggle
  if (action === 'toggle-voice') {
    toggleVoiceRecognition();
  }

  // 5. Pick files from device
  if (action === 'pick-files') {
    const picker = root.querySelector('#mission-file-picker');
    if (picker) picker.click();
  }

  // 6. Remove attachment
  if (action === 'remove-attachment') {
    const index = Number(actionTarget.dataset.index);
    api.update((next) => {
      if (next.ui?.missionAttachments) {
        next.ui.missionAttachments.splice(index, 1);
      }
    });
  }

  // 7. Mission Preset Example
  if (action === 'example') {
    const input = root.querySelector('#mission-text-input');
    if (input) {
      input.value = actionTarget.dataset.prompt;
      input.focus();
    }
    api.update((next) => {
      next.ui = { ...(next.ui || {}), missionDraftText: actionTarget.dataset.prompt };
    });
  }

  if (action === 'landing-preset') {
    const prompt = actionTarget.dataset.prompt || '';
    api.update((next) => {
      next.route = 'missions';
      next.ui = { ...(next.ui || {}), missionDraftText: prompt };
    });
    toast(`Mission draft loaded: "${prompt.slice(0, 32)}..."`, 'info');
  }

  // 8. Quick deploy deck action from command palette
  if (action === 'quick-deploy-deck') {
    api.update((next) => {
      next.route = 'missions';
      next.ui = { ...(next.ui || {}), commandPaletteOpen: false };
    });
    const prompt = 'Build a Q3 pipeline deck for Acme Corp';
    startMission(api, prompt, 'manual', { deliverableType: 'pptx' });
    toast('Deployed Q3 pipeline deck mission to workforce.', 'success');
  }

  // 9. Login actions
  if (action === 'login-local-workspace') {
    api.update((next) => {
      next.auth = {
        isAuthenticated: true,
        user: { id: 'usr-1', name: 'Alex Vance', email: 'alex.vance@kubera.corp', role: 'user', title: 'Director of Business Operations' }
      };
      next.route = 'dashboard';
    });
    toast('Signed in to local workspace session.', 'success');
  }

  if (action === 'login-quick-admin') {
    api.update((next) => {
      next.auth = {
        isAuthenticated: true,
        user: { id: 'usr-admin', name: 'Devon Vance', email: 'admin@kubera.corp', role: 'admin', title: 'System Administrator' }
      };
      next.route = 'admin-dashboard';
    });
    toast('Elevated to Administrator Sovereign session.', 'success');
  }

  if (action === 'logout') {
    api.update((next) => {
      next.auth = { isAuthenticated: false, user: null };
      next.route = 'landing';
    });
    toast('Signed out from workspace.', 'info');
  }

  if (action === 'toggle-password-visibility') {
    const targetId = actionTarget.dataset.target;
    const input = root.querySelector(`#${targetId}`);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  }

  if (action === 'toast-forgot-password') {
    toast('In local-first mode, all credentials are stored locally. Use "Continue with local workspace".', 'info');
  }

  // 10. Report inspections & deliveries
  if (action === 'open-report') {
    const reportId = actionTarget.dataset.reportId;
    api.update((next) => {
      next.ui = { ...(next.ui || {}), modalReportId: reportId };
    });
  }

  if (action === 'close-report') {
    if (actionTarget.classList.contains('modal-backdrop') && event.target !== actionTarget) {
      return;
    }
    api.update((next) => {
      next.ui = { ...(next.ui || {}), modalReportId: null };
    });
  }

  if (action === 'visual-report') {
    const reportId = actionTarget.dataset.reportId;
    api.update((next) => {
      next.ui = { ...(next.ui || {}), modalReportId: reportId };
      const selected = next.reports.find((item) => item.id === reportId);
      if (selected) selected.visualPreviewLoading = true;
    });
    if (typeof api.previewDeliverableVisual === 'function') {
      api.previewDeliverableVisual(reportId)
        .then((preview) => api.update((next) => {
          const selected = next.reports.find((item) => item.id === reportId);
          if (selected) {
            selected.visualPreviewHtml = preview.html;
            selected.visualPreviewLoading = false;
          }
        }))
        .catch((error) => api.update((next) => {
          const selected = next.reports.find((item) => item.id === reportId);
          if (selected) {
            selected.visualPreviewError = error?.message;
            selected.visualPreviewLoading = false;
          }
        }));
    }
  }

  if (action === 'open-deliverable' || action === 'reveal-deliverable') {
    const method = action === 'open-deliverable' ? 'openDeliverable' : 'revealDeliverable';
    if (typeof api[method] === 'function') {
      api[method](actionTarget.dataset.reportId)
        .then(() => toast('Deliverable opened / downloaded locally.', 'success'))
        .catch((err) => toast(err?.message || 'File action failed.', 'danger'));
    } else {
      toast('Opening native Office deliverable.', 'info');
    }
  }

  if (action === 'request-approval') {
    const reportId = actionTarget.dataset.reportId;
    if (typeof api.requestDeliverableApproval === 'function') {
      api.requestDeliverableApproval(reportId)
        .then((approval) => api.update((next) => {
          next.approvals = (next.approvals || []).filter((item) => item.id !== approval.id);
          next.approvals.unshift(approval);
          next.activity.unshift({ id: id('audit'), at: Date.now(), kind: 'approval_requested', tone: 'info', text: `Queued ${approval.fileName} for review.` });
        }))
        .then(() => toast('Artifact queued for human review decision.', 'success'))
        .catch((err) => toast(err?.message || 'Approval request failed.', 'danger'));
    }
  }

  if (action === 'approve-approval' || action === 'reject-approval') {
    const approvalId = actionTarget.dataset.approvalId;
    const decision = action === 'approve-approval' ? 'approved' : 'rejected';
    const note = decision === 'approved' ? 'Approved by human reviewer' : 'Revisions requested by reviewer';

    if (typeof api.decideDeliverableApproval === 'function') {
      api.decideDeliverableApproval(approvalId, { decision, note })
        .then((approval) => api.update((next) => {
          next.approvals = (next.approvals || []).map((item) => item.id === approval.id ? approval : item);
          next.activity.unshift({ id: id('audit'), at: Date.now(), kind: 'approval_decision', tone: decision === 'approved' ? 'success' : 'warning', text: `${decision.toUpperCase()}: ${approval.fileName}.` });
        }))
        .then(() => toast(`Artifact ${decision}.`, decision === 'approved' ? 'success' : 'warning'))
        .catch((err) => toast(err?.message || 'Decision recording failed.', 'danger'));
    }
  }

  if (action === 'show-delivery-form') {
    api.update((next) => {
      next.ui = { ...(next.ui || {}), deliveryReportId: actionTarget.dataset.reportId };
    });
  }

  if (action === 'hide-delivery-form') {
    if (actionTarget.classList.contains('modal-backdrop') && event.target !== actionTarget) {
      return;
    }
    api.update((next) => {
      next.ui = { ...(next.ui || {}), deliveryReportId: null };
    });
  }

  // 11. Records Form Modals
  if (action === 'show-client-form') {
    api.update((next) => {
      next.ui = { ...(next.ui || {}), recordForm: 'client', commandPaletteOpen: false };
    });
  }

  if (action === 'edit-client') {
    api.update((next) => {
      next.ui = { ...(next.ui || {}), recordForm: { type: 'client', id: actionTarget.dataset.clientId } };
    });
  }

  if (action === 'show-project-form') {
    api.update((next) => {
      next.ui = { ...(next.ui || {}), recordForm: 'project' };
    });
  }

  if (action === 'edit-project') {
    api.update((next) => {
      next.ui = { ...(next.ui || {}), recordForm: { type: 'project', id: actionTarget.dataset.projectId } };
    });
  }

  if (action === 'show-project-import') {
    api.update((next) => {
      next.ui = { ...(next.ui || {}), recordForm: 'project-import', commandPaletteOpen: false };
    });
  }

  if (action === 'close-record-form') {
    if (actionTarget.classList.contains('modal-backdrop') && event.target !== actionTarget) {
      return;
    }
    api.update((next) => {
      next.ui = { ...(next.ui || {}), recordForm: null };
    });
  }

  if (action === 'load-sample-csv') {
    const input = root.querySelector('#project-csv-input');
    if (input) {
      const sample = 'name,stage,value,risk_flag\nWarehouse Automation Pilot,Discovery,160000,false\nCustomer Intelligence Engine,Proposal,240000,true\n';
      const file = new File([sample], 'sample-projects.csv', { type: 'text/csv' });
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        toast('Sample CSV data loaded into input.', 'info');
      } catch {
        toast('Ready to import sample projects.', 'info');
      }
    }
  }

  if (action === 'export-template-bundle') {
    const templateId = actionTarget.dataset.templateId;
    if (typeof api.exportTemplateBundle === 'function') {
      api.exportTemplateBundle(templateId)
        .then((result) => {
          if (result?.bytes && result?.fileName && typeof window !== 'undefined') {
            const blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const dl = document.createElement('a');
            dl.href = url;
            dl.download = result.fileName;
            document.body.appendChild(dl);
            dl.click();
            document.body.removeChild(dl);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
          toast('Template bundle exported as .kubera-template.zip', 'success');
        })
        .catch((err) => toast(err?.message || 'Export failed.', 'danger'));
    }
  }

  if (action === 'export-audit-json') {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(api.getState().activity, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute('href', dataStr);
    dl.setAttribute('download', `kubera-audit-${new Date().toISOString().slice(0, 10)}.json`);
    dl.click();
    toast('Audit log exported to local JSON.', 'success');
  }

  if (action === 'reset-state') {
    api.reset();
    toast('Demo state reset to initial seed values.', 'success');
  }
});

// Main form submission delegation
root.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;

  // 0. Landing Page Mission Input
  if (form.dataset.form === 'landing-mission') {
    const data = new FormData(form);
    const landingPrompt = String(data.get('landingPrompt') || '').trim();
    if (landingPrompt) {
      api.update((next) => {
        next.route = 'missions';
        next.ui = { ...(next.ui || {}), missionDraftText: landingPrompt };
      });
      toast('Mission draft loaded into workforce composer.', 'success');
    } else {
      api.update((next) => {
        next.route = 'missions';
      });
    }
    return;
  }

  // 1. Mission deployment
  if (form.dataset.form === 'mission') {
    const data = new FormData(form);
    const missionText = String(data.get('missionText') || '').trim();
    if (!missionText) {
      toast('Describe what you want KUBERA to deliver.', 'warning');
      return;
    }

    const state = api.getState();
    const attachments = state.ui?.missionAttachments || [];

    const result = startMission(api, missionText, 'user', { attachments });
    if (!result.ok) {
      toast(result.reason || 'Mission could not be deployed.', 'danger');
      return;
    }

    // Stop voice if listening
    if (speechIsListening && speechRecognitionInstance) {
      speechRecognitionInstance.stop();
      speechIsListening = false;
    }

    // Clear draft and attachments
    api.update((next) => {
      next.ui = {
        ...(next.ui || {}),
        missionDraftText: '',
        missionAttachments: [],
        voiceListening: false
      };
    });

    const txt = root.querySelector('#mission-text-input');
    if (txt) txt.value = '';

    toast('Mission dispatched to governed workforce.', 'success');
  }

  // 2. User login
  if (form.dataset.form === 'user-login') {
    const data = new FormData(form);
    const email = String(data.get('email') || 'alex.vance@kubera.corp');
    api.update((next) => {
      next.auth = {
        isAuthenticated: true,
        user: { id: 'usr-1', name: 'Alex Vance', email, role: 'user', title: 'Director of Business Operations' }
      };
      next.route = 'dashboard';
    });
    toast('Signed in successfully.', 'success');
  }

  // 3. Admin login
  if (form.dataset.form === 'admin-login') {
    const data = new FormData(form);
    const email = String(data.get('adminEmail') || 'admin@kubera.corp');
    api.update((next) => {
      next.auth = {
        isAuthenticated: true,
        user: { id: 'usr-admin', name: 'Devon Vance', email, role: 'admin', title: 'System Administrator' }
      };
      next.route = 'admin-dashboard';
    });
    toast('Authenticated as System Administrator.', 'success');
  }

  // 4. Records creation / update
  if (form.dataset.form === 'record') {
    const data = new FormData(form);
    const recordType = form.dataset.recordType;

    if (recordType === 'client') {
      const name = String(data.get('clientName') || '').trim();
      const industry = String(data.get('industry') || '').trim();
      const status = String(data.get('status') || 'active');
      const owner = String(data.get('owner') || '').trim();
      const recordId = String(data.get('recordId') || '');
      const isUpdate = Boolean(recordId);

      const promise = isUpdate
        ? api.updateClient(recordId, { name, industry, status, owner })
        : api.createClient({ name, industry, status, owner });

      promise
        .then(() => {
          api.update((next) => {
            next.ui = { ...(next.ui || {}), recordForm: null };
          });
          toast(`Client ${isUpdate ? 'updated' : 'created'} successfully.`, 'success');
        })
        .catch((err) => toast(err?.message || 'Could not save client.', 'danger'));
    }

    if (recordType === 'project') {
      const name = String(data.get('projectName') || '').trim();
      const clientId = String(data.get('clientId') || '');
      const stage = String(data.get('stage') || 'Discovery');
      const value = Number(data.get('value') || 0);
      const risk = data.get('risk') === 'on';
      const recordId = String(data.get('recordId') || '');
      const isUpdate = Boolean(recordId);

      const promise = isUpdate
        ? api.updateProject(recordId, { name, clientId, stage, value, riskFlag: risk })
        : api.createProject({ name, clientId, stage, value, riskFlag: risk });

      promise
        .then(() => {
          api.update((next) => {
            next.ui = { ...(next.ui || {}), recordForm: null };
          });
          toast(`Project ${isUpdate ? 'updated' : 'created'} successfully.`, 'success');
        })
        .catch((err) => toast(err?.message || 'Could not save project.', 'danger'));
    }
  }

  // 5. CSV Project Import
  if (form.dataset.form === 'project-csv') {
    const input = root.querySelector('#project-csv-input');
    const clientId = String(form.querySelector('#project-csv-client-id')?.value || '');
    if (!input?.files?.[0] || !clientId) {
      toast('Please choose a client and select a CSV file.', 'warning');
      return;
    }

    const file = input.files[0];
    file.text()
      .then((csvText) => api.importProjectsCsv(clientId, csvText))
      .then((res) => {
        api.update((next) => {
          next.ui = { ...(next.ui || {}), recordForm: null };
        });
        toast(`Imported ${res.imported} project(s) from CSV.`, 'success');
      })
      .catch((err) => toast(err?.message || 'CSV Import failed.', 'danger'));
  }

  // 6. External Delivery
  if (form.dataset.form === 'delivery') {
    const data = new FormData(form);
    const deliverableId = String(data.get('deliverableId') || '');
    const channel = String(data.get('channel') || 'email_smtp');
    const recipient = String(data.get('recipient') || '').trim();
    const message = String(data.get('message') || '').trim();

    if (typeof api.sendApprovedDelivery === 'function') {
      api.sendApprovedDelivery({ deliverableId, channel, recipient, message })
        .then((delivery) => {
          api.update((next) => {
            next.deliveries = [delivery, ...(next.deliveries || [])];
            next.ui = { ...(next.ui || {}), deliveryReportId: null };
            next.activity.unshift({
              id: id('audit'),
              at: Date.now(),
              kind: 'external_delivery',
              tone: 'success',
              text: `Delivered ${delivery.fileName} to ${delivery.recipient} via ${delivery.channel}.`
            });
          });
          toast('Approved deliverable sent.', 'success');
        })
        .catch((err) => toast(err?.message || 'Delivery failed.', 'danger'));
    }
  }

  // 7. Settings Form
  if (form.dataset.form === 'settings') {
    const data = new FormData(form);
    api.update((next) => {
      next.settings.providerBaseUrl = String(data.get('providerBaseUrl') || '');
      next.settings.model = String(data.get('model') || '');
      next.settings.timezone = String(data.get('timezone') || '');
      next.engine.model = next.settings.model || next.engine.model;
    });
    toast('Settings saved.', 'success');
  }
});

// Search input handling inside Command Palette & Client search
root.addEventListener('input', (event) => {
  if (event.target.id === 'cmd-palette-input') {
    const query = event.target.value;
    api.update((next) => {
      next.ui = { ...(next.ui || {}), cmdSearch: query };
    });
  }
  if (event.target.id === 'client-search-input') {
    const query = event.target.value;
    api.update((next) => {
      next.ui = { ...(next.ui || {}), clientSearch: query };
    });
  }
});

// --------------------------------------------------------------------------
// LIFECYCLE & STARTUP
// --------------------------------------------------------------------------

store.subscribe(render);
api.bootstrap().then(() => {
  render(api.getState());
  if (typeof api.startScheduler === 'function') {
    api.startScheduler().catch((error) => console.warn('Scheduler could not start', error));
  }
});
