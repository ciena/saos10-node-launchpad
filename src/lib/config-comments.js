const sections = [
  [/^no\b/, 'Removal: delete these service objects only after checking for shared usage.'],
  [/^(?:no )?maintenance-domain\b/, 'Service OAM: maintenance association, MEP and measurements.'],
  [/^cfm-global-config\b/, 'Enable global Service OAM.'],
  [/^(?:no )?classifiers\b/, 'Classifiers: select the Ethernet frames accepted by this service.'],
  [/^(?:no )?fds\b/, 'Forwarding domain: define the service switching instance.'],
  [/^(?:no )?oc-if:interfaces\b/, 'IP interface: configure routing properties and the local IP address.'],
  [/^(?:no )?fps\b.*\bingress-l2-transform\b/, 'Ingress tag transform: change VLAN tags as frames enter the service.'],
  [/^(?:no )?fps\b.*\begress-l2-transform\b/, 'Egress tag transform: change VLAN tags as frames leave the service.'],
  [/^(?:no )?fps\b/, 'Flow point: bind the port, classifier and service; apply optional QoS.'],
  [/^logical-ports\b/, 'Logical port: set the port MTU or traffic classification.'],
  [/^frame-to-cos-maps\b/, 'CoS mapping: assign forwarding class and color to incoming frames.'],
  [/^l2cp-profiles\b/, 'L2CP profile: select how Layer 2 control protocols are forwarded.'],
  [/^meter-profiles\b/, 'Meter profiles: define bandwidth and burst limits.'],
  [/^show\b|^config search\b/, 'Verification: inspect configuration and operational state.'],
  [/^virtual-switch\b/, 'Virtual switch: connect the service interfaces.'],
  [/^interface\b/, 'IP interface: configure or remove the routed interface.'],
  [/^cpu-interface\b/, 'CPU interface: connect the routed interface to the service.'],
  [/^sub-port\b/, 'Sub-port: classify and attach traffic from the physical port.'],
  [/^vlan\b/, 'VLAN: configure service membership and tagging.'],
];

/** Add section descriptions without changing generated commands. */
export function withInlineComments(lines, enabled = false) {
  const result = [];
  let previous = '';
  for (const line of lines) {
    const text = typeof line === 'string' ? line : line.text;
    if (/^\s*#/.test(text)) continue;
    const section = sections.find(([pattern]) => pattern.test(text))?.[1] || '';
    if (enabled && section && section !== previous) {
      result.push(typeof line === 'string' ? `# ${section}` : { ...line, text: `# ${section}` });
    }
    result.push(line);
    previous = section;
  }
  return result;
}
