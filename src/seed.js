const now = Date.now();
const ago = (minutes) => now - minutes * 60_000;

export function createSeedState() {
  const acme = 'client-acme';
  const deckMission = 'mission-acme-deck';
  const report = 'report-acme-q3-deck';

  return {
    version: 1,
    route: 'missions',
    engine: { status: 'ready', model: 'local deterministic', patrol: true, message: 'Local workforce runtime ready' },
    settings: {
      providerBaseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o-mini',
      timezone: 'Asia/Calcutta'
    },
    clients: [
      { id: acme, name: 'Acme Corp', industry: 'Enterprise SaaS', status: 'active', owner: 'Priya Shah', createdAt: ago(7200) },
      { id: 'client-northstar', name: 'Northstar Health', industry: 'Healthcare', status: 'active', owner: 'Daniel Reed', createdAt: ago(6120) },
      { id: 'client-meridian', name: 'Meridian Retail', industry: 'Retail', status: 'prospect', owner: 'Priya Shah', createdAt: ago(5040) }
    ],
    projects: [
      { id: 'project-acme-expansion', clientId: acme, name: 'Q3 Platform Expansion', stage: 'Proposal', value: 240000, risk: false, createdAt: ago(840) },
      { id: 'project-acme-analytics', clientId: acme, name: 'Analytics Modernization', stage: 'Negotiation', value: 125000, risk: true, createdAt: ago(690) },
      { id: 'project-northstar-portal', clientId: 'client-northstar', name: 'Patient Portal Discovery', stage: 'Discovery', value: 80000, risk: false, createdAt: ago(480) }
    ],
    agents: [
      { id: 'agent-manager', name: 'Asha', label: 'Manager', kind: 'manager', capability: 'Plan subagents', status: 'idle', color: 'violet' },
      { id: 'agent-market', name: 'Maya', label: 'Market Analyst', kind: 'analyst', capability: 'Analyze market context', status: 'idle', color: 'blue' },
      { id: 'agent-market-2', name: 'Maya-2', label: 'Market Analyst', kind: 'analyst', capability: 'Analyze market context', status: 'idle', color: 'blue' },
      { id: 'agent-worker-1', name: 'W-1', label: 'Operations Analyst', kind: 'worker', capability: 'Prepare pipeline metrics', status: 'idle', color: 'teal' },
      { id: 'agent-worker-1b', name: 'W-1B', label: 'Operations Analyst', kind: 'worker', capability: 'Prepare pipeline metrics', status: 'idle', color: 'teal' },
      { id: 'agent-worker-2', name: 'W-2', label: 'Document Worker', kind: 'worker', capability: 'Create Office artifacts', status: 'idle', color: 'amber' },
      { id: 'agent-worker-2b', name: 'W-2B', label: 'Document Worker', kind: 'worker', capability: 'Create Office artifacts', status: 'idle', color: 'amber' },
      { id: 'agent-reviewer', name: 'Sentinel', label: 'File Reviewer', kind: 'reviewer', capability: 'Validate output', status: 'idle', color: 'rose' }
    ],
    missions: [
      {
        id: deckMission,
        text: 'Build a Q3 pipeline deck for Acme Corp',
        title: 'Acme Corp Q3 pipeline deck',
        type: 'pptx',
        status: 'done',
        createdAt: ago(135),
        updatedAt: ago(128),
        reportId: report,
        tasks: [
          { id: 'task-manager-seed', agentId: 'agent-manager', title: 'Plan a bounded delivery team', status: 'succeeded', dependsOn: [], summary: 'Deployed two analysts, a document worker, and reviewer.' },
          { id: 'task-market-seed', agentId: 'agent-market', title: 'Assess opportunity and risk signals', status: 'succeeded', dependsOn: [], summary: 'Found one delivery risk and two executive themes.' },
          { id: 'task-ops-seed', agentId: 'agent-worker-1', title: 'Prepare pipeline metrics', status: 'succeeded', dependsOn: [], summary: 'Reconciled $365,000 pipeline across two projects.' },
          { id: 'task-doc-seed', agentId: 'agent-worker-2', title: 'Create board deck', status: 'succeeded', dependsOn: ['task-market-seed', 'task-ops-seed'], summary: 'Created 5-slide board-ready presentation.' },
          { id: 'task-review-seed', agentId: 'agent-reviewer', title: 'Validate PPTX artifact', status: 'approved', dependsOn: ['task-doc-seed'], summary: 'Verified expected type and report registration.' }
        ],
        handoffs: [
          { id: 'handoff-market-seed', fromAgentId: 'agent-market', type: 'market_analysis', sourceCount: 2, status: 'accepted' },
          { id: 'handoff-ops-seed', fromAgentId: 'agent-worker-1', type: 'pipeline_metrics', sourceCount: 2, status: 'accepted' }
        ]
      }
    ],
    reports: [
      {
        id: report,
        missionId: deckMission,
        name: 'acme-corp_q3-pipeline-board-deck_2026-10-25.pptx',
        type: 'pptx',
        createdAt: ago(128),
        size: '2.4 MB',
        producer: 'W-2 — Document Worker',
        prototype: true,
        outline: ['Executive overview', 'Pipeline snapshot — $365,000', 'Active opportunities', 'At-risk initiative', 'Recommended actions']
      }
    ],
    approvals: [],
    deliveries: [],
    researchCitations: [],
    templates: [
      { id: 'template-client-q3', name: 'Client Q3 account report', fileName: 'client-q3-account-report.docx', type: 'docx', placeholders: 7, createdAt: ago(10080) }
    ],
    schedules: [
      { id: 'schedule-monthly-acme', prompt: 'Build the monthly Acme pipeline board deck from current records', type: 'pptx', cron: '0 9 1 * *', timezone: 'Asia/Calcutta', enabled: true, lastRun: ago(43800), nextRun: now + 5 * 24 * 60 * 60_000 }
    ],
    theme: 'dark',
    auth: {
      isAuthenticated: true,
      user: {
        id: 'usr-1',
        name: 'Alex Vance',
        email: 'alex.vance@kubera.corp',
        role: 'user',
        department: 'Operations & Strategy',
        title: 'Director of Business Operations'
      }
    },
    ui: {
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      missionDraftText: '',
      missionAttachments: [],
      voiceListening: false,
      voiceTranscript: '',
      recordForm: null,
      modalReportId: null,
      deliveryReportId: null,
      activeRecordsTab: 'clients',
      activeAdminTab: 'overview',
      projectFilterStage: 'all',
      projectSort: 'value-desc',
      searchTerm: ''
    },
    adminUsers: [
      { id: 'usr-admin', name: 'Devon Vance', email: 'admin@kubera.corp', role: 'admin', title: 'System Administrator', status: 'active', lastActive: ago(4) },
      { id: 'usr-1', name: 'Alex Vance', email: 'alex.vance@kubera.corp', role: 'user', title: 'Director of Business Operations', status: 'active', lastActive: ago(12) },
      { id: 'usr-2', name: 'Priya Shah', email: 'priya.shah@kubera.corp', role: 'user', title: 'Lead Account Partner', status: 'active', lastActive: ago(45) },
      { id: 'usr-3', name: 'Daniel Reed', email: 'daniel.reed@kubera.corp', role: 'user', title: 'Client Director', status: 'active', lastActive: ago(180) }
    ],
    adminWorkspaces: [
      { id: 'ws-main', name: 'Global Enterprise HQ', tier: 'Enterprise Sovereign', maxAgents: 16, missionsRun: 142, storageUsed: '1.8 GB', status: 'active' },
      { id: 'ws-emea', name: 'EMEA Regional Hub', tier: 'Team Dedicated', maxAgents: 8, missionsRun: 64, storageUsed: '820 MB', status: 'active' }
    ],
    adminAgentsConfig: [
      { agentId: 'agent-manager', name: 'Asha', model: 'local-deterministic', temperature: 0.2, tools: ['task_planning', 'scope_reconciliation'], enabled: true },
      { agentId: 'agent-market', name: 'Maya', model: 'local-deterministic', temperature: 0.4, tools: ['market_signals', 'crossref_citations'], enabled: true },
      { agentId: 'agent-worker-1', name: 'W-1', model: 'local-deterministic', temperature: 0.1, tools: ['sqlite_query', 'pipeline_math'], enabled: true },
      { agentId: 'agent-worker-2', name: 'W-2', model: 'officecli-bridge', temperature: 0.2, tools: ['pptxgen', 'docxgen', 'exceljs'], enabled: true },
      { agentId: 'agent-reviewer', name: 'Sentinel', model: 'local-deterministic', temperature: 0.0, tools: ['schema_verifier', 'checksum_audit'], enabled: true }
    ],
    adminModels: {
      activeProvider: 'local_deterministic',
      providers: [
        { id: 'local_deterministic', name: 'Deterministic Local Workforce', status: 'online', latency: '4ms', cost: '$0.00' },
        { id: 'opencode_sidecar', name: 'OpenCode Native IPC Sidecar', status: 'ready', latency: '18ms', cost: '$0.00' },
        { id: 'ollama_local', name: 'Ollama On-Premises (Qwen 2.5 32B)', status: 'standby', latency: '65ms', cost: '$0.00' }
      ]
    },
    adminSecurity: {
      zeroTelemetry: true,
      localOnlyStorage: true,
      egressLockdown: true,
      requirePeerReview: true,
      auditLogRetentionDays: 365
    },
    adminHealth: {
      status: 'healthy',
      cpuUsage: '14%',
      ramUsage: '482 MB / 8 GB',
      uptime: '99.98%',
      ipcSocket: 'connected',
      sidecarState: 'running'
    },
    activity: [
      { id: 'audit-1', at: ago(128), kind: 'validate_output', tone: 'success', text: 'Sentinel approved Acme’s PPTX report artifact.' },
      { id: 'audit-2', at: ago(129), kind: 'create_file', tone: 'info', text: 'W-2 created the Q3 pipeline deck in the Report Center.' },
      { id: 'audit-3', at: ago(131), kind: 'consume_handoff', tone: 'info', text: 'W-2 consumed market_analysis and pipeline_metrics handoffs.' },
      { id: 'audit-4', at: ago(133), kind: 'query_projects', tone: 'neutral', text: 'Maya and W-1 used 2 Acme project records for the mission.' }
    ]
  };
}
