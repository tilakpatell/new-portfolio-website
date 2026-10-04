// The program-management side of the work, step by step. Every line here is
// taken from a role in roles.js; `where` names the roles it came from.
export const programSteps = [
  {
    id: 'discover',
    step: 'Discover',
    title: 'Map the work as it really happens',
    body: 'Mapped manual blocker-tracking workflows with AWS delivery stakeholders to scope what to automate, and assessed RTX’s enterprise applications through discovery and execution.',
    where: ['aws', 'rtx'],
  },
  {
    id: 'plan',
    step: 'Plan',
    title: 'Set the direction',
    body: 'Helped design the application-modernization value stream and the roadmap behind RTX’s 2028 enterprise goals.',
    where: ['rtx'],
  },
  {
    id: 'build',
    step: 'Build',
    title: 'Build what the program needs',
    body: 'Planning tools that model server-placement constraints for generative-AI capacity, and a multi-agent pipeline that flags stale capacity data and notifies its owners.',
    where: ['aws'],
  },
  {
    id: 'deliver',
    step: 'Deliver',
    title: 'Land it with the teams',
    body: 'Planned and executed application teams’ moves onto RTX’s Xeta Cloud platform, and shipped Bose engineers a desktop app wired into Jira, Confluence and Artifactory.',
    where: ['rtx', 'bose'],
  },
  {
    id: 'measure',
    step: 'Measure',
    title: 'Show it worked',
    body: '4+ hours a week back for each analyst at Empowerreg, 70% less review time at SRC, and firmware debugging at Bose cut from hours to minutes.',
    where: ['empowerreg', 'src', 'bose'],
  },
];

export const programToolkit = [
  'Roadmapping',
  'Value-stream design',
  'Requirements scoping',
  'Stakeholder alignment',
  'Workflow mapping',
  'Capacity planning',
  'Cloud migration planning',
  'Data-quality automation',
  'Jira & Confluence',
  'SQL & Redshift',
  'Grafana dashboards',
];
