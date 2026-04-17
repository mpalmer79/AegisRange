// ============================================================
// AegisRange Scenario Content — Phase 2 Gamified Briefing
//
// Per-scenario narrative, MITRE mapping, kill-chain stages, and
// objective definitions for both red and blue perspectives.
//
// Objective completion is derived from the ScenarioResult returned
// by POST /scenarios/:id: each objective has a `check` function that
// inspects the result and returns whether the objective was met.
// ============================================================

import { ScenarioResult } from './types';

export type Perspective = 'red' | 'blue';

export type DifficultyId = 'recruit' | 'analyst' | 'operator';

export interface DifficultyDef {
  id: DifficultyId;
  label: string;
  blurb: string;
  xpMultiplier: number;
  /** Suggested time budget in seconds (cosmetic — not enforced). */
  timeBudgetSeconds: number;
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'recruit',
    label: 'Recruit',
    blurb: 'Training wheels on. Full intel disclosed.',
    xpMultiplier: 1,
    timeBudgetSeconds: 240,
  },
  {
    id: 'analyst',
    label: 'Analyst',
    blurb: 'Partial intel. Realistic noise.',
    xpMultiplier: 1.5,
    timeBudgetSeconds: 150,
  },
  {
    id: 'operator',
    label: 'Operator',
    blurb: 'Cold start. Adversary moves fast.',
    xpMultiplier: 2,
    timeBudgetSeconds: 90,
  },
];

export interface ObjectiveDef {
  id: string;
  title: string;
  description: string;
  xp: number;
  check: (result: ScenarioResult) => boolean;
}

export interface MissionStageDef {
  id: string;
  label: string;
  killChainPhase: string;
  description: string;
}

export interface ScenarioContent {
  tagline: string;
  backstory: string;
  attacker: string;
  target: string;
  mitreTechniques: { id: string; name: string }[];
  stages: MissionStageDef[];
  red: {
    role: string;
    summary: string;
    objectives: ObjectiveDef[];
  };
  blue: {
    role: string;
    summary: string;
    objectives: ObjectiveDef[];
  };
}

// ---------- objective check helpers ----------
const redFoothold = (r: ScenarioResult) => (r.events_generated ?? 0) >= 1;
const redVolume = (threshold: number) => (r: ScenarioResult) =>
  (r.events_generated ?? 0) >= threshold;
const redTrippedDefense = (r: ScenarioResult) =>
  r.step_up_required ||
  (r.revoked_sessions?.length ?? 0) > 0 ||
  (r.download_restricted_actors?.length ?? 0) > 0 ||
  (r.disabled_services?.length ?? 0) > 0 ||
  (r.quarantined_artifacts?.length ?? 0) > 0 ||
  (r.policy_change_restricted_actors?.length ?? 0) > 0;

const blueDetect = (r: ScenarioResult) => (r.alerts_generated ?? 0) >= 1;
const blueCorrelate = (r: ScenarioResult) => Boolean(r.incident_id);
const blueRespond = (r: ScenarioResult) =>
  (r.responses_generated ?? 0) >= 1 || redTrippedDefense(r);

// Phase 3a: scn-auth-001 blue-3 is player-driven. The analyst must type
// `contain session --user <id> --action <revoke|stepup>` to satisfy it.
const blueContainByCommand = (r: ScenarioResult) => {
  const issued = r.commands_issued ?? [];
  return issued.some((v) => v.startsWith('contain session'));
};

// Phase 4: scenarios 002–006 accept ANY containment verb (session,
// document, or service). Keeping this broader than scn-auth-001 lets
// players pick whichever containment shape matches the scenario.
const blueAnyContainByCommand = (r: ScenarioResult) => {
  const issued = r.commands_issued ?? [];
  return issued.some((v) => v.startsWith('contain '));
};

// ---------- content ----------

// Tutorial-specific objective checks. Each looks at the commands the
// player has typed so far — the tutorial is about learning the verbs,
// not about simulated world state.
const tutorialIssued = (r: ScenarioResult, prefix: string) =>
  (r.commands_issued ?? []).some((v) => v === prefix || v.startsWith(prefix));

export const SCENARIO_CONTENT: Record<string, ScenarioContent> = {
  'scn-tutorial-000': {
    tagline: 'Learn the console in 60 seconds.',
    backstory:
      'A sandboxed warm-up run. The simulated adversary fires a single failed login so you have something to look at while getting comfortable with the four verbs you\'ll use in every mission.',
    attacker: 'Training sparring partner',
    target: 'Sandboxed tenant',
    mitreTechniques: [],
    stages: [
      { id: 'observe', label: 'Observe', killChainPhase: 'detection', description: 'Query the SIEM for alerts.' },
      { id: 'inspect', label: 'Inspect', killChainPhase: 'detection', description: 'Tail the raw events.' },
      { id: 'contain', label: 'Contain', killChainPhase: 'response', description: 'Practice the containment verb.' },
    ],
    red: {
      role: 'Trainee',
      summary: 'Red practice is disabled for the tutorial. Switch to Blue to get started.',
      objectives: [
        { id: 'red-1', title: 'Switch to Blue', description: 'The tutorial runs on the defender side. Pick Blue and launch.', xp: 0, check: () => false },
      ],
    },
    blue: {
      role: 'Trainee Analyst',
      summary: 'Type each of the four commands. No time pressure, no XP penalties — just get the feel of the console.',
      objectives: [
        { id: 'blue-1', title: 'Run `alerts list`', description: 'Type `alerts list` in the console and press Enter.', xp: 0, check: (r) => tutorialIssued(r, 'alerts list') },
        { id: 'blue-2', title: 'Run `events tail`', description: 'Type `events tail` to see the raw events.', xp: 0, check: (r) => tutorialIssued(r, 'events tail') },
        { id: 'blue-3', title: 'Run `status`', description: 'Type `status` to see mission state at a glance.', xp: 0, check: (r) => tutorialIssued(r, 'status') },
        { id: 'blue-4', title: 'Practice containment', description: 'Type `contain session --user user-alice --action revoke`.', xp: 0, check: (r) => tutorialIssued(r, 'contain session') },
      ],
    },
  },

  'scn-auth-001': {
    tagline: 'Crack the gate before the SOC wakes up.',
    backstory:
      'At 02:14 local time, authentication traffic spikes against the corporate SSO endpoint. A persistent actor is cycling credentials from a non-corporate IP range, hunting for a foothold while the night shift is understaffed.',
    attacker: 'Unknown external threat actor',
    target: 'Corporate SSO endpoint',
    mitreTechniques: [
      { id: 'T1110', name: 'Brute Force' },
      { id: 'T1078', name: 'Valid Accounts' },
    ],
    stages: [
      { id: 'recon', label: 'Reconnaissance', killChainPhase: 'recon', description: 'Scan login endpoints and enumerate usernames.' },
      { id: 'cred', label: 'Credential Access', killChainPhase: 'credential-access', description: 'Cycle credential candidates.' },
      { id: 'access', label: 'Initial Access', killChainPhase: 'initial-access', description: 'Land a successful authentication.' },
    ],
    red: {
      role: 'Intruder',
      summary: 'You control the outside keyboard. Find a valid credential before detection rules trip.',
      objectives: [
        { id: 'red-1', title: 'Launch credential spray', description: 'Run `attempt login --user alice --from 203.0.113.10` to fire your first authentication event.', xp: 20, check: redFoothold },
        { id: 'red-2', title: 'Sustain attack volume', description: 'Repeat `attempt login` five or more times to trip the brute-force detector.', xp: 30, check: redVolume(5) },
        { id: 'red-3', title: 'Force a defensive response', description: 'Finish with a valid --password so the defender auto-responds (step-up or session revoke).', xp: 50, check: redTrippedDefense },
      ],
    },
    blue: {
      role: 'SOC Analyst',
      summary: 'You own detection and response. Identify the spray, contain the actor, and preserve evidence.',
      objectives: [
        { id: 'blue-1', title: 'Detect brute-force pattern', description: 'Trigger at least one detection rule.', xp: 25, check: blueDetect },
        { id: 'blue-2', title: 'Correlate into incident', description: 'Open a tracked incident for this correlation ID.', xp: 35, check: blueCorrelate },
        {
          id: 'blue-3',
          title: 'Execute containment',
          description:
            'Run `contain session --user user-alice --action revoke` (or `--action stepup`) in the mission console.',
          xp: 50,
          check: blueContainByCommand,
        },
      ],
    },
  },

  'scn-session-002': {
    tagline: 'Borrow a heartbeat, bypass the login.',
    backstory:
      'A valid session token surfaces in an IP geolocation 2,000 miles from the legitimate owner. The actor is pivoting inside the app with stolen context — no failed logins, no noise at the edge.',
    attacker: 'Session-stealing broker or insider',
    target: 'Active authenticated session',
    mitreTechniques: [
      { id: 'T1539', name: 'Steal Web Session Cookie' },
      { id: 'T1550.004', name: 'Web Session Cookie' },
    ],
    stages: [
      { id: 'theft', label: 'Credential Access', killChainPhase: 'credential-access', description: 'Acquire a live session token.' },
      { id: 'replay', label: 'Initial Access', killChainPhase: 'initial-access', description: 'Replay token from the attacker origin.' },
      { id: 'evade', label: 'Defense Evasion', killChainPhase: 'defense-evasion', description: 'Blend in with the victim identity.' },
    ],
    red: {
      role: 'Session Ghost',
      summary: 'You have a stolen token. Use it without tripping session-anomaly rules.',
      objectives: [
        { id: 'red-1', title: 'Replay the hijacked token', description: 'Issue at least one request with the stolen session.', xp: 20, check: redFoothold },
        { id: 'red-2', title: 'Pivot under one identity', description: 'Sustain activity across the target scope.', xp: 30, check: redVolume(3) },
        { id: 'red-3', title: 'Provoke a revocation', description: 'Push the blue team to kill the session.', xp: 50, check: redTrippedDefense },
      ],
    },
    blue: {
      role: 'Identity Defender',
      summary: 'You protect the session layer. Spot the impossible-travel pattern and kill the token.',
      objectives: [
        { id: 'blue-1', title: 'Detect session anomaly', description: 'Trigger a session-hijack alert.', xp: 25, check: blueDetect },
        { id: 'blue-2', title: 'Open incident', description: 'Escalate into a tracked incident.', xp: 35, check: blueCorrelate },
        { id: 'blue-3', title: 'Revoke the session', description: 'Run `contain session --user user-bob --action revoke` to kill the hijacked session.', xp: 50, check: blueAnyContainByCommand },
      ],
    },
  },

  'scn-doc-003': {
    tagline: 'No badge? No problem — until the SOC notices.',
    backstory:
      'A help-desk account is poking at board-level M&A folders it has no business opening. Access is denied repeatedly, but the pattern is methodical, folder by folder, as if the user is mapping a house in the dark.',
    attacker: 'Curious low-privilege insider',
    target: 'Restricted M&A document repository',
    mitreTechniques: [
      { id: 'T1083', name: 'File and Directory Discovery' },
      { id: 'T1213', name: 'Data from Information Repositories' },
    ],
    stages: [
      { id: 'discover', label: 'Discovery', killChainPhase: 'discovery', description: 'Probe restricted folders and files.' },
      { id: 'collect', label: 'Collection', killChainPhase: 'collection', description: 'Harvest any file that slips through.' },
    ],
    red: {
      role: 'Nosy Insider',
      summary: 'You have legitimate auth but not the data. See how far you can walk before the rails bite.',
      objectives: [
        { id: 'red-1', title: 'Probe restricted docs', description: 'Issue at least one unauthorized read.', xp: 20, check: redFoothold },
        { id: 'red-2', title: 'Map the restricted tree', description: 'Fan out across five or more documents.', xp: 30, check: redVolume(5) },
        { id: 'red-3', title: 'Trip access control', description: 'Force the blue team to restrict your actor.', xp: 50, check: redTrippedDefense },
      ],
    },
    blue: {
      role: 'Data Custodian',
      summary: 'You guard the document vault. Catch the reconnaissance and clip the actor’s wings.',
      objectives: [
        { id: 'blue-1', title: 'Detect access control violation', description: 'Trigger an unauthorized-access alert.', xp: 25, check: blueDetect },
        { id: 'blue-2', title: 'Open incident', description: 'Escalate into a tracked incident.', xp: 35, check: blueCorrelate },
        { id: 'blue-3', title: 'Restrict the actor', description: 'Run `contain document --id doc-002 --action restrict --actor user-bob` or revoke the session.', xp: 50, check: blueAnyContainByCommand },
      ],
    },
  },

  'scn-doc-004': {
    tagline: 'The clock is ticking — and so are the downloads.',
    backstory:
      'A soon-to-be-terminated employee races to download every confidential file they can reach before their access is revoked. The download rate is 40× their baseline and accelerating.',
    attacker: 'Departing employee',
    target: 'Sensitive client archives',
    mitreTechniques: [
      { id: 'T1020', name: 'Automated Exfiltration' },
      { id: 'T1530', name: 'Data from Cloud Storage' },
    ],
    stages: [
      { id: 'collect', label: 'Collection', killChainPhase: 'collection', description: 'Queue bulk downloads against the archive.' },
      { id: 'exfil', label: 'Exfiltration', killChainPhase: 'exfiltration', description: 'Move the payload off corporate storage.' },
    ],
    red: {
      role: 'Data Thief',
      summary: 'You have a narrow window. Pull as much as you can before the vault locks.',
      objectives: [
        { id: 'red-1', title: 'Begin bulk pull', description: 'Start the automated download loop.', xp: 20, check: redFoothold },
        { id: 'red-2', title: 'Exceed rate threshold', description: 'Pass ten download events before detection.', xp: 30, check: redVolume(10) },
        { id: 'red-3', title: 'Survive until containment', description: 'Provoke quarantine or download restriction.', xp: 50, check: redTrippedDefense },
      ],
    },
    blue: {
      role: 'DLP Operator',
      summary: 'You own data-loss prevention. Detect the burst, open an incident, and seal the vault.',
      objectives: [
        { id: 'blue-1', title: 'Detect exfil burst', description: 'Fire a data-exfil alert.', xp: 25, check: blueDetect },
        { id: 'blue-2', title: 'Open incident', description: 'Open a tracked incident for the spree.', xp: 35, check: blueCorrelate },
        { id: 'blue-3', title: 'Quarantine and restrict', description: 'Run `contain document --id doc-002 --action quarantine` or revoke/restrict the actor.', xp: 50, check: blueAnyContainByCommand },
      ],
    },
  },

  'scn-svc-005': {
    tagline: 'Robots don’t take lunch breaks. This one did.',
    backstory:
      'A service account used by the nightly build job is suddenly calling admin APIs at noon. Its credentials have leaked — or been weaponized from inside — and it’s acting way outside its normal scope.',
    attacker: 'Compromised CI/CD service account',
    target: 'Admin APIs outside normal service scope',
    mitreTechniques: [
      { id: 'T1078.004', name: 'Valid Accounts: Cloud Accounts' },
      { id: 'T1098', name: 'Account Manipulation' },
    ],
    stages: [
      { id: 'access', label: 'Initial Access', killChainPhase: 'initial-access', description: 'Leverage the stolen service credential.' },
      { id: 'escalate', label: 'Privilege Escalation', killChainPhase: 'privilege-escalation', description: 'Call APIs outside the service scope.' },
      { id: 'impact', label: 'Impact', killChainPhase: 'impact', description: 'Change policy or persistence settings.' },
    ],
    red: {
      role: 'Operator in the Build Pipeline',
      summary: 'You own a service account. See how far you can bend it before detection rules notice.',
      objectives: [
        { id: 'red-1', title: 'Call out-of-scope API', description: 'Make at least one privileged call.', xp: 20, check: redFoothold },
        { id: 'red-2', title: 'Sustain abnormal traffic', description: 'Drive three or more anomalous events.', xp: 30, check: redVolume(3) },
        { id: 'red-3', title: 'Attempt a policy change', description: 'Force the blue team to disable you.', xp: 50, check: redTrippedDefense },
      ],
    },
    blue: {
      role: 'Platform SRE',
      summary: 'You own the non-human identity layer. Notice the drift and pull the plug.',
      objectives: [
        { id: 'blue-1', title: 'Detect out-of-scope calls', description: 'Trigger a service-account anomaly alert.', xp: 25, check: blueDetect },
        { id: 'blue-2', title: 'Open incident', description: 'Escalate into a tracked incident.', xp: 35, check: blueCorrelate },
        { id: 'blue-3', title: 'Disable the service', description: 'Run `contain service --id svc-data-processor --action disable` to stop the service account.', xp: 50, check: blueAnyContainByCommand },
      ],
    },
  },

  'scn-corr-006': {
    tagline: 'When every alert is the same hand on the keyboard.',
    backstory:
      'Multiple weak signals across auth, sessions and document stores start correlating. One actor. One session ID reappearing across systems. A multi-stage campaign is underway and nobody has named it yet.',
    attacker: 'Advanced persistent threat (APT) simulator',
    target: 'The entire tenant',
    mitreTechniques: [
      { id: 'T1110', name: 'Brute Force' },
      { id: 'T1539', name: 'Steal Web Session Cookie' },
      { id: 'T1020', name: 'Automated Exfiltration' },
    ],
    stages: [
      { id: 'access', label: 'Initial Access', killChainPhase: 'initial-access', description: 'Land a foothold via credential abuse.' },
      { id: 'cred', label: 'Credential Access', killChainPhase: 'credential-access', description: 'Pivot with stolen session cookies.' },
      { id: 'lateral', label: 'Lateral Movement', killChainPhase: 'lateral-movement', description: 'Hop between surfaces under one identity.' },
      { id: 'collect', label: 'Collection', killChainPhase: 'collection', description: 'Stage sensitive documents.' },
      { id: 'exfil', label: 'Exfiltration', killChainPhase: 'exfiltration', description: 'Move data off the platform.' },
    ],
    red: {
      role: 'Campaign Operator',
      summary: 'You run the full chain — auth, session, documents. Make the noise look coordinated.',
      objectives: [
        { id: 'red-1', title: 'Chain multiple vectors', description: 'Drive events across more than one surface.', xp: 25, check: redFoothold },
        { id: 'red-2', title: 'Sustain the campaign', description: 'Drive ten or more correlated events.', xp: 35, check: redVolume(10) },
        { id: 'red-3', title: 'Force full-spectrum response', description: 'Trip containment, revocation, or quarantine.', xp: 60, check: redTrippedDefense },
      ],
    },
    blue: {
      role: 'Incident Commander',
      summary: 'You are the IC for a multi-vector campaign. Stitch the signals, name the incident, and shut it down.',
      objectives: [
        { id: 'blue-1', title: 'Detect across surfaces', description: 'Fire alerts from multiple detection rules.', xp: 30, check: blueDetect },
        { id: 'blue-2', title: 'Open correlated incident', description: 'Promote the alerts into one incident.', xp: 40, check: blueCorrelate },
        { id: 'blue-3', title: 'Execute full containment', description: 'Issue any `contain ...` verb — session, document, or service.', xp: 60, check: blueAnyContainByCommand },
      ],
    },
  },

  'scn-pol-007': {
    tagline: 'Rewrite the rules before anyone reads them.',
    backstory:
      'A platform admin starts relaxing egress firewall rules and detection thresholds at 3 a.m. The policy diff reads like a cleanup, but the timing lines up with an open incident next door — someone is quietly widening the blast radius before the next move.',
    attacker: 'Insider with platform-admin rights',
    target: 'Firewall egress, retention, and detection policy',
    mitreTechniques: [
      { id: 'T1562', name: 'Impair Defenses' },
      { id: 'T1554', name: 'Compromise Host Software Binary' },
    ],
    stages: [
      { id: 'access', label: 'Privileged Access', killChainPhase: 'initial-access', description: 'Authenticate with platform-admin scope.' },
      { id: 'modify', label: 'Policy Modification', killChainPhase: 'defense-evasion', description: 'Loosen egress, retention, or detection rules.' },
      { id: 'impact', label: 'Impact', killChainPhase: 'impact', description: 'Leave the environment weaker for the next stage.' },
    ],
    red: {
      role: 'Policy Saboteur',
      summary: 'You are already inside with admin rights. Quietly weaken the guardrails without tripping the change-control alarm.',
      objectives: [
        { id: 'red-1', title: 'Change a protected policy', description: 'Drive at least one policy-change event.', xp: 20, check: redFoothold },
        { id: 'red-2', title: 'Sustain the edit spree', description: 'Drive three or more policy-change events.', xp: 30, check: redVolume(3) },
        { id: 'red-3', title: 'Force a containment action', description: 'Trip step-up, session revocation, or policy-change restriction.', xp: 50, check: redTrippedDefense },
      ],
    },
    blue: {
      role: 'Platform Security Engineer',
      summary: 'You own change control for the platform. Catch the unauthorized edit and reverse it before it enables the next intrusion.',
      objectives: [
        { id: 'blue-1', title: 'Detect the policy edit', description: 'Fire a policy-change or impair-defenses alert.', xp: 25, check: blueDetect },
        { id: 'blue-2', title: 'Open change-control incident', description: 'Promote the alert into a tracked incident.', xp: 35, check: blueCorrelate },
        { id: 'blue-3', title: 'Restrict the admin', description: 'Restrict further policy changes or revoke the session.', xp: 50, check: blueRespond },
      ],
    },
  },
};

export function getScenarioContent(id: string): ScenarioContent | undefined {
  return SCENARIO_CONTENT[id];
}
