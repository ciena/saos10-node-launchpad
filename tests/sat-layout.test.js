import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runBrowserChecks } from './helpers/browser.js';

const browser = process.env.CHROME_BIN || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

for (const width of [390, 768, 1101, 1440]) {
  test(`SAT endpoint controls remain usable at ${width}px`, { skip: !browser }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'snl-sat-layout-'));
    try {
      const html = readFileSync(new URL(`../release/saos10-node-launchpad-v${version}.html`, import.meta.url), 'utf8');
      const checks = `<script>
        window.addEventListener('load', async () => {
          const result = document.createElement('pre');
          result.id = 'layout-result';
          try {
            const labels = [
              'Generator type', 'Generator Flow Point',
              'Generator Client UNI Logical Port', "Reflector's Benchmark MAC",
              'Reflector type', 'Reflector Flow Point',
              'Reflector Client UNI Logical Port',
            ];
            const expect = (condition, message) => { if (!condition) throw new Error(message); };
            const tick = () => new Promise(resolve => setTimeout(resolve, 50));
            const advancedOrder = ['kpiProfileName', 'customDuration', 'interval', 'framelossStartBandwidth',
              'maxSearches', 'satMaxSearches', 'maxSamples', 'samplingInterval', 'excessBandwidth', 'emixSequence', 'customFrameMix', 'customEmixSize', 'generatorHFrameSize',
              'customPayload', 'resultMode', 'pduType', 'tpid', 'encapType', 'sVlan', 'pcp', 'color',
              'priorityCodePoints', 'bwAllocProfile', 'dscp', 'generatorIp', 'reflectorIp', 'reflectionLevel', 'macValidation'];
            const checkAdvancedOrder = () => {
              const fields = [...document.querySelectorAll('#sat-advanced-settings > .field-grid > [data-field]')]
                .map(field => field.dataset.field);
              expect(fields.length > 0 && fields.join('|') === advancedOrder.filter(key => fields.includes(key)).join('|'),
                'Advanced SAT controls do not follow the requested order: ' + fields.join('|'));
            };
            for (let attempt = 0; !document.querySelector('.sat-generator') && attempt < 40; attempt++) await tick();
            const generator = document.querySelector('.sat-generator');
            expect(![...document.querySelectorAll('.panel h2')].some(heading => heading.textContent === 'Test path'),
              'Removed Test path section remains');
            expect(document.getElementById('generatorFlowPoint').value === 'XXXX'
              && document.getElementById('reflectorFlowPoint').value === 'YYYY', 'Endpoint placeholders are not obvious examples');
            expect(!document.querySelector('.sat-traffic').textContent.includes('If selected here'),
              'Removed impact helper sentence remains');
            expect(document.querySelector('.builder-form > .panel')?.classList.contains('sat-traffic'),
              'Traffic profile is not above Generator');
            expect(document.getElementById('reflectorMac').closest('.sat-generator') === generator,
              'Reflector MAC is not in the Generator section');
            expect(document.querySelector('#reflectorMac-hint strong u')?.textContent === 'on the reflector',
              'Reflector command instruction is not bold and underlined');
            expect(!/Workbook rows?\\s*\\d/i.test(document.querySelector('.builder-form').textContent),
              'Workbook row references remain in form helpers');
            expect(!document.querySelector('.page-heading .lead'), 'Removed Benchmark introduction remains');
            expect(!document.querySelector('.output-panel').textContent.includes('Workbook notes'),
              'Removed Benchmark notes tab remains');
            expect(!generator.textContent.includes('CRITICAL') && !document.querySelector('.builder-form').textContent.includes('operational SSH shortcut'),
              'Removed Benchmark labels or helper wording remain');
            {
              expect(!document.querySelector('[aria-label="Application layout"]'), 'Removed layout picker remains');
              for (const theme of ['light', 'dark']) {
                if (document.documentElement.dataset.theme !== theme) document.querySelector('[aria-label^="Switch to"]').click();
                await tick();
                for (const mode of ['basic', 'advanced']) {
                  document.querySelector('[aria-label="Detail level"] [data-mode="' + mode + '"]').click();
                  await tick();
                  expect(Boolean(document.getElementById('generatorIp')) === (mode === 'advanced')
                    && Boolean(document.getElementById('reflectorIp')) === (mode === 'advanced'),
                    'Node IP fields are not limited to Advanced mode');
                  for (const id of ['customPayload', 'dscp', 'sat-pcp-select', 'pcpValidation', 'macValidation',
                    'pduType', 'kpiProfileName', 'resultMode']) {
                    const control = document.getElementById(id);
                    expect(Boolean(control) === (mode === 'advanced')
                      && (!control || control.closest('#sat-advanced-settings')),
                      id + ' must appear only inside Advanced settings');
                  }
                  if (mode === 'advanced') checkAdvancedOrder();
                  for (const text of labels) {
                    const label = [...document.querySelectorAll('.field-label')].find(el => el.textContent.includes(text));
                    expect(label, 'Missing field: ' + text);
                    const field = label.closest('.input-field');
                    const control = field.querySelector('input, select');
                    const context = [theme, mode, text].join(' / ');
                    expect(control, context + ': missing control');
                    for (let el = field; el; el = el.parentElement) {
                      expect(getComputedStyle(el).transform === 'none', context + ': inherited transform');
                    }
                    control.scrollIntoView({ block: 'end', inline: 'nearest' });
                    const rect = control.getBoundingClientRect();
                    expect(rect.width > 0 && rect.height > 0, context + ': hidden control');
                    expect(rect.left >= 0 && rect.right <= innerWidth, context + ': horizontal overflow');
                    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                    expect(target === control, context + ': control is obscured by ' + target?.outerHTML.slice(0, 150)
                      + ' at ' + JSON.stringify(rect) + ', viewport ' + innerWidth + 'x' + innerHeight);
                  }
                }
              }
            }
            const platform = document.getElementById('generatorPlatform');
            const pcpTrigger = document.getElementById('sat-pcp-select');
            const pcpOptions = document.getElementById('sat-pcp-options');
            const pcpValidation = document.getElementById('pcpValidation');
            const macValidation = document.getElementById('macValidation');
            expect(Math.abs(pcpTrigger.getBoundingClientRect().width
              - document.getElementById('pduType').getBoundingClientRect().width) < 1,
              'PCP dropdown width does not match the other Advanced fields');
            const validationTrigger = document.getElementById('sat-frame-validation-select');
            const validationOptions = document.getElementById('sat-frame-validation-options');
            const validationControls = [...validationOptions.querySelectorAll('input')];
            expect(document.getElementById('sat-frame-validation-label').textContent === 'Frame Validation'
              && validationControls.map(control => control.id).join('|') === 'colorValidation|macValidation|pcpValidation|vidValidation'
              && [...validationOptions.querySelectorAll('.check-label span')].map(label => label.textContent).join('|') === 'Color|MAC|PCP|VLAN'
              && document.querySelector('#sat-advanced-settings > .field-grid').lastElementChild.querySelector('#sat-frame-validation-select') === validationTrigger
              && validationOptions.hidden && validationControls.every(control => control.checked),
              'Frame Validation must be a collapsed multi-select dropdown at the end of Advanced settings');
            validationTrigger.click(); await tick();
            expect(!validationOptions.hidden && validationTrigger.getAttribute('aria-expanded') === 'true',
              'Frame Validation dropdown did not expand');
            document.getElementById('colorValidation').click(); await tick();
            macValidation.click(); await tick();
            expect(!document.getElementById('colorValidation').checked && !macValidation.checked
              && pcpValidation.checked && document.getElementById('vidValidation').checked
              && validationTrigger.textContent === 'PCP, VLAN' && !validationOptions.hidden
              && document.querySelector('.builder-results').textContent.includes('color-validation false')
              && document.querySelector('.builder-results').textContent.includes('source-mac-validation false')
              && document.querySelector('.builder-results').textContent.includes('pcp-validation true')
              && document.querySelector('.builder-results').textContent.includes('vid-validation true'),
              'Frame Validation selections did not independently update the generated configuration');
            document.getElementById('colorValidation').click(); await tick();
            macValidation.click(); await tick();
            macValidation.focus();
            macValidation.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
            expect(validationOptions.hidden && document.activeElement === validationTrigger,
              'Escape must close Frame Validation and restore focus');
            const colorControl = document.getElementById('color');
            expect(colorControl.closest('.field-grid') === pcpTrigger.closest('.field-grid')
              && (colorControl.compareDocumentPosition(pcpTrigger) & Node.DOCUMENT_POSITION_FOLLOWING),
              'Color must precede Priority code points in the Advanced field grid');
            expect(!document.getElementById('testConnectivity')
              && !document.querySelector('#sat-advanced-settings').textContent.includes('Test connectivity before starting'),
              'Removed connectivity option remains');
            expect(pcpTrigger.textContent.includes('PCP 4') && pcpOptions.hidden,
              'PCP dropdown is not collapsed with the default selection');
            pcpTrigger.click(); await tick();
            expect(!pcpOptions.hidden && pcpTrigger.getAttribute('aria-expanded') === 'true',
              'PCP dropdown did not expand');
            pcpTrigger.scrollIntoView({ block: 'start' });
            const pcpRect = pcpOptions.getBoundingClientRect();
            expect(pcpRect.left >= 0 && pcpRect.right <= innerWidth, 'PCP dropdown overflows the viewport');
            document.getElementById('sat-pcp2').click(); await tick();
            expect(document.getElementById('sat-pcp2').checked && document.getElementById('sat-pcp4').checked
              && pcpTrigger.textContent.includes('PCP 2, 4') && !pcpOptions.hidden
              && document.querySelector('.builder-results').textContent.includes('c-pcp "pcp4 pcp2"'),
              'PCP dropdown failed to preserve multiple selections or update the generated config');
            document.getElementById('sat-pcp2').focus();
            document.getElementById('sat-pcp2').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            await tick();
            expect(pcpOptions.hidden && document.activeElement === pcpTrigger,
              'Escape did not close the PCP dropdown and restore focus');
            pcpTrigger.click(); await tick();
            document.getElementById('sat-pcp2').click(); await tick();
            document.querySelector('.sat-generator h2').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
            await tick();
            expect(pcpOptions.hidden && pcpTrigger.textContent.includes('PCP 4')
              && !document.getElementById('sat-pcp2').checked,
              'PCP deselection or outside-click dismissal failed');
            const advancedSettings = localStorage.getItem('snl-sat-state');
            document.querySelector('[aria-label="Detail level"] [data-mode="basic"]').click(); await tick();
            expect(!document.getElementById('sat-pcp-select') && !document.getElementById('pcpValidation')
              && !document.getElementById('macValidation') && !document.getElementById('customPayload')
              && localStorage.getItem('snl-sat-state') === advancedSettings,
              'Basic mode must hide Advanced profile fields without changing their saved settings');
            const standardTypeIds = ['sat-test-throughput', 'sat-test-latency', 'sat-test-pdv', 'sat-test-frameloss'];
            const standardTypeRow = document.querySelector('[aria-label="Throughput, latency, PDV and frame loss"]');
            expect(standardTypeRow && [...standardTypeRow.querySelectorAll('input')].map(input => input.id).join('|') === standardTypeIds.join('|'),
              'Standard test types are not ordered Throughput, Latency, PDV, Frameloss');
            expect(standardTypeIds.every(id => document.getElementById(id).checked), 'Standard tests are not checked by default');
            expect(!document.getElementById('sat-test-outage'), 'Outage is visible in Basic mode');
            const typeHelpButton = document.querySelector('[aria-label="Test type help"]');
            expect(typeHelpButton, 'Test type help icon is missing');
            typeHelpButton.click(); await tick();
            const typeHelp = [...document.querySelectorAll('dialog')].find(dialog => dialog.getAttribute('aria-labelledby') === 'sat-test-help-title');
            expect(typeHelp?.open && typeHelp.textContent.includes('RFC2544')
              && typeHelp.textContent.includes('Y.1564') && typeHelp.textContent.includes('manually'),
              'Test type descriptions are incomplete or did not open');
            typeHelp.querySelector('form button').click(); await tick();
            document.getElementById('sat-test-rfc2544').click(); await tick();
            expect(!standardTypeIds.some(id => document.getElementById(id))
              && document.getElementById('sat-test-rfc2544') && !document.getElementById('sat-test-y1564'),
              'Selecting RFC2544 did not hide the other test types');
            expect(document.querySelector('.builder-results').textContent.includes('rfc2544-suite true'),
              'RFC2544 selection did not generate the suite configuration');
            platform.value = 'SAOS6';
            platform.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(document.querySelector('.issues').textContent.includes('require an SAOS10 generator'),
              'SAOS6/8 generator incompatibility is not reported');
            platform.value = 'SAOS10';
            platform.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            document.getElementById('sat-test-rfc2544').click(); await tick();
            document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]').click(); await tick();
            document.getElementById('sat-test-y1564').click(); await tick();
            const mixProfile = document.getElementById('emixSequence');
            const mix = document.getElementById('customFrameMix');
            expect(mix.readOnly && mix.value === 'abceg', 'Default predefined EMIX must be read-only');
            mixProfile.value = 'ipv6-qinq'; mixProfile.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(mix.readOnly && mix.value === 'xxxxxxduuuugg', 'Predefined EMIX pattern did not update');
            mixProfile.value = 'Custom'; mixProfile.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(!mix.readOnly && mix.value === 'abceg', 'Custom EMIX is not editable');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(mix, 'abuug');
            mix.dispatchEvent(new Event('input', { bubbles: true })); await tick();
            expect(document.getElementById('customEmixSize')?.value === '9000'
              && document.querySelector('.builder-results').textContent.includes('sequence abuug u-frame-size 9000'),
              'Custom mix or u frame size was not generated');
            expect(!document.getElementById('generatorHFrameSize'), 'h size must be hidden when the mix has no h');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(mix, 'abuhg');
            mix.dispatchEvent(new Event('input', { bubbles: true })); await tick();
            const hSize = document.getElementById('generatorHFrameSize');
            expect(hSize && hSize.value === '' && !document.querySelector('.builder-results').textContent.includes('generator-h-frame-size'),
              'h size should be optional and default to the port value');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(hSize, '9200');
            hSize.dispatchEvent(new Event('input', { bubbles: true })); await tick();
            expect(document.querySelector('.builder-results').textContent.includes('generator-h-frame-size 9200'),
              'h size did not update generator config');
            document.querySelector('[aria-label="Frame Size Mix help"]').click(); await tick();
            const mixHelp = document.querySelector('[aria-labelledby="sat-emix-help-title"]');
            expect(mixHelp?.open && mixHelp.textContent.includes('u = custom frame size'), 'EMIX help did not open');
            expect(mixHelp.querySelector('p')?.textContent === 'To edit this field, set "Ethernet mix profile" to "custom".',
              'EMIX help must start with the custom profile instruction');
            expect(mixHelp.textContent.includes('bbduug with u = 9000') && mixHelp.textContent.includes('path MTU'),
              'EMIX help must explain jumbo sizes and MTU limits');
            mixHelp.querySelector('form button').click(); await tick();
            mixProfile.value = 'y1564'; mixProfile.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(mix.readOnly && mix.value === 'abceg' && !document.getElementById('generatorHFrameSize')
              && !document.querySelector('.builder-results').textContent.includes('generator-h-frame-size'),
              'Predefined mix did not restore read-only mode or hide h');
            mixProfile.value = 'Custom'; mixProfile.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(mix.value === 'abuhg' && document.getElementById('generatorHFrameSize')?.value === '9200',
              'Custom mix and h size were not preserved when switching profiles');
            document.getElementById('sat-test-y1564').click(); await tick();
            expect(document.getElementById('sat-test-outage'), 'Outage is missing in Advanced mode');
            document.getElementById('sat-test-outage').click(); await tick();
            const outageSize = document.getElementById('outageFrameSize');
            expect(outageSize?.value === '64' && !document.getElementById('frameSizes'),
              'Outage must expose one independently defaulted frame size');
            expect(!document.querySelector('.sat-traffic').textContent.includes('Example: 1 Mbps with 64-byte frames.')
              && !document.querySelector('.sat-traffic').textContent.includes('64 bytes is recommended for detecting brief interruptions'),
              'Outage fields still display the removed hints');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(outageSize, '512');
            outageSize.dispatchEvent(new Event('input', { bubbles: true })); await tick();
            expect(document.querySelector('.builder-results').textContent.includes('frame-size 512')
              && JSON.parse(localStorage.getItem('snl-sat-state')).outageFrameSize === '512',
              'Outage frame size did not update the config and saved state');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(outageSize, '64,128');
            outageSize.dispatchEvent(new Event('input', { bubbles: true })); await tick();
            expect(document.querySelector('.issues').textContent.includes('one outage frame size')
              && document.querySelector('.output-panel button').disabled,
              'Outage accepts multiple frame sizes');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(outageSize, '512');
            outageSize.dispatchEvent(new Event('input', { bubbles: true })); await tick();
            expect(!standardTypeIds.some(id => document.getElementById(id))
              && !document.getElementById('sat-test-rfc2544') && !document.getElementById('sat-test-y1564'),
              'Selecting Outage did not hide other test types');
            expect(document.querySelector('.sat-traffic').textContent.includes('Outage does not stop automatically')
              && document.querySelector('.sat-traffic').textContent.includes('Supported only on 3922')
              && !document.querySelector('.sat-traffic').textContent.includes('two-node 3926 test')
              && !document.querySelector('.sat-traffic').textContent.includes('CN3984')
              && document.querySelector('.builder-results').textContent.includes('duration tIndefinite'),
              'Outage warning or indefinite profile duration is missing');
            [...document.querySelectorAll('[role="tab"]')].find(button => button.textContent === 'Run & verify').click(); await tick();
            expect([...document.querySelectorAll('.code-heading span')].some(heading => heading.textContent.includes('Stop Outage manually'))
              && document.querySelector('.tab-body').textContent.includes('sat stop test-instances test-instance'),
              'Outage manual stop command is not clearly exposed');
            const outageBlocks = [...document.querySelectorAll('.tab-body .code-block')];
            const outageStatistics = outageBlocks[2].querySelectorAll('.code-line code');
            expect(!outageBlocks[0].textContent.includes(' statistics')
              && outageBlocks[1].textContent.includes('sat stop')
              && outageStatistics[0].textContent === '# Statistics are only shown after the test has stopped.'
              && outageStatistics[1].textContent.includes('show sat test-instances')
              && outageStatistics[1].textContent.endsWith(' statistics'),
              'Outage statistics guidance must immediately precede the command after manual stop');
            {
              const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
              const originalExec = document.execCommand;
              let copied;
              Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text; } } });
              document.execCommand = action => {
                if (action !== 'copy') return false;
                copied = document.querySelector('textarea[style*="position"]').value;
                return true;
              };
              try {
                for (const block of outageBlocks) {
                  const commands = [...block.querySelectorAll('.code-line')].filter(line => {
                    const text = line.querySelector('code').textContent.trim();
                    return text && !text.startsWith('#');
                  });
                  const buttons = block.querySelectorAll('.command-line-copy');
                  const headingCopy = block.querySelector('.code-heading button');
                  expect(buttons.length === (commands.length > 1 ? commands.length : 0),
                    'Run & verify must offer a per-command copy only for multi-command sections');
                  expect(headingCopy.textContent.trim() === (commands.length > 1 ? 'Copy All' : 'Copy'),
                    'Incorrect section copy label');
                  for (const line of commands.filter(() => commands.length > 1)) {
                    line.querySelector('.command-line-copy').click(); await tick();
                    expect(copied === line.querySelector('code').textContent, 'Individual copy included another command or annotation');
                  }
                  headingCopy.click(); await tick();
                  expect(copied === [...block.querySelectorAll('.code-line code')].map(code => code.textContent).join('\\n'),
                    'Copy All did not preserve the subsection and comments');
                }
              } finally {
                if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
                else delete navigator.clipboard;
                document.execCommand = originalExec;
              }
            }
            let outageDownload;
            const createOutageUrl = URL.createObjectURL;
            const clickOutageAnchor = HTMLAnchorElement.prototype.click;
            try {
              URL.createObjectURL = blob => { outageDownload = blob; return createOutageUrl.call(URL, blob); };
              HTMLAnchorElement.prototype.click = function () {};
              [...document.querySelectorAll('.output-panel button')].find(button => button.textContent === 'Download .txt').click();
            } finally {
              URL.createObjectURL = createOutageUrl;
              HTMLAnchorElement.prototype.click = clickOutageAnchor;
            }
            const outageText = await outageDownload.text();
            expect(outageText.indexOf('sat stop test-instances') < outageText.indexOf('# Statistics are only shown after the test has stopped.')
              && outageText.includes('# Statistics are only shown after the test has stopped.\\nshow sat test-instances'),
              'Outage download is missing the statistics comment or stop-before-statistics order');
            document.querySelector('[aria-label="Detail level"] [data-mode="basic"]').click(); await tick();
            expect(!document.getElementById('sat-test-outage')
              && standardTypeIds.every(id => document.getElementById(id)?.checked),
              'Returning to Basic did not restore standard tests or hide Outage');
            document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]').click(); await tick();
            const details = () => [...document.querySelectorAll('button')].find(button => button.textContent === '3924/3926 Details');
            expect(details(), 'SAOS10 offload details link missing');
            details().click(); await tick();
            const dialog = document.querySelector('.offload-dialog');
            expect(dialog.open && dialog.matches(':modal'), 'Offload details did not open a modal');
            expect(dialog.textContent.includes('logical-port X binding')
              && dialog.textContent.includes('interface X config offload-activate true')
              && dialog.textContent.includes('two minutes'), 'Offload instructions or impact warning missing');
            expect(dialog.getBoundingClientRect().width <= innerWidth, 'Offload dialog exceeds viewport');
            const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
            const originalExecCommand = document.execCommand;
            let copied;
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied = text; } } });
            document.execCommand = action => {
              if (action === 'copy') { copied = document.querySelector('textarea[style*="position"]').value; return true; }
              return originalExecCommand.call(document, action);
            };
            try {
              for (const helper of document.querySelectorAll('.helper-command')) {
                const button = helper.querySelector('button.code-copy');
                expect(button?.querySelector('svg'), 'Helper command lacks an icon + Copy button');
                button.click(); await tick();
                expect(copied === helper.querySelector('code').textContent, 'Helper copied the wrong command');
                expect(button.type === 'button', 'Helper Copy can submit the offload dialog');
              }
              expect(dialog.open, 'Copy closed the offload dialog');
              const reflectorType = document.getElementById('reflectorPlatform');
              for (const [value, command] of [
                ['SAOS6', 'chassis show mac'],
                ['SAOS8', 'chassis show mac | grep Bench'],
                ['SAOS10', 'show system mac | grep shared'],
              ]) {
                reflectorType.value = value;
                reflectorType.dispatchEvent(new Event('change', { bubbles: true })); await tick();
                const helper = document.querySelector('#reflectorMac-hint .helper-command');
                expect(helper.querySelector('code').textContent === command, 'Reflector MAC helper did not follow reflector type');
                helper.querySelector('button').click(); await tick();
                expect(copied === command, 'Reflector MAC Copy used an outdated platform command');
              }
              Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Clipboard denied'); } } });
              document.execCommand = action => {
                const textarea = document.querySelector('textarea[style*="position"]');
                if (action !== 'copy' || textarea?.closest('dialog') !== dialog || document.activeElement !== textarea) return false;
                copied = textarea.value;
                return true;
              };
              copied = undefined;
              dialog.querySelector('.helper-command button').click(); await tick();
              expect(copied === 'show flow-points', 'Clipboard fallback cannot select a command inside the modal');
              expect(!document.querySelector('textarea[style*="position"]'), 'Clipboard fallback left a temporary input');
            } finally {
              if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
              else delete navigator.clipboard;
              document.execCommand = originalExecCommand;
            }
            dialog.querySelector('form button').click(); await tick();
            expect(!dialog.open, 'Offload dialog did not close');
            const nodeIp = document.getElementById('generatorIp');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(nodeIp, '192.0.2.10');
            nodeIp.dispatchEvent(new Event('input', { bubbles: true })); await tick();
            document.querySelector('[aria-label="Detail level"] [data-mode="basic"]').click(); await tick();
            expect(!document.getElementById('generatorIp'), 'Node IP remains visible in Basic');
            document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]').click(); await tick();
            expect(document.getElementById('generatorIp').value === '192.0.2.10', 'Changing detail mode discarded the node IP');
            for (const value of ['SAOS6', 'SAOS8']) {
              platform.value = value;
              platform.dispatchEvent(new Event('change', { bubbles: true }));
              await tick();
              if (value === 'SAOS6') {
                expect(details(), 'SAOS6 offload details link missing');
                details().click(); await tick();
                const legacyDialog = document.querySelector('.offload-dialog');
                expect(legacyDialog.matches(':modal') && legacyDialog.querySelector('h2').textContent === 'SAOS6 offload port preparation',
                  'SAOS6 offload dialog did not open');
                expect(legacyDialog.querySelectorAll('.helper-command').length === 1
                  && legacyDialog.querySelector('.helper-command code').textContent ===
                    'chassis system-rsvd-port add port <#> feature oam-services',
                  'SAOS6 offload command is incorrect');
                expect(legacyDialog.textContent.includes('Use port 4 for 3926 and port 7 for 3928')
                  && !legacyDialog.textContent.includes('show flow-points')
                  && !legacyDialog.textContent.includes('no fps')
                  && !legacyDialog.textContent.includes('offload-activate')
                  && !legacyDialog.querySelector('ol'), 'SAOS6 includes SAOS10 circuit preparation steps');
                legacyDialog.querySelector('form button').click(); await tick();
              } else expect(!details() && !document.querySelector('.offload-dialog'), 'Offload details visible for ' + value);
            }
            expect(document.querySelector('.sat-generator').textContent.includes('conf search string "sub-port add"'),
              'Platform-specific helper text did not update');
            const savedNames = Object.fromEntries(['generator', 'reflector'].map(side =>
              [side, document.getElementById(side + 'FlowPoint').value]));
            for (const generatorType of ['SAOS6', 'SAOS8', 'SAOS10']) {
              for (const reflectorType of ['SAOS6', 'SAOS8', 'SAOS10']) {
                for (const [side, value] of [['generator', generatorType], ['reflector', reflectorType]]) {
                  const select = document.getElementById(side + 'Platform');
                  select.value = value;
                  select.dispatchEvent(new Event('change', { bubbles: true })); await tick();
                }
                expect(Boolean(document.getElementById('resultMode')) === (generatorType === 'SAOS10'),
                  'Result calculation field does not follow generator platform');
                checkAdvancedOrder();
                expect(!document.querySelector('.builder-results').textContent.includes('Result calculation applies only'),
                  'Removed result calculation warning remains');
                for (const [side, value] of [['generator', generatorType], ['reflector', reflectorType]]) {
                  const field = document.getElementById(side + 'FlowPoint');
                  expect(Boolean(field) === (value !== 'SAOS6'), side + ': SAOS6 flow field should be hidden');
                  if (field) {
                    expect(field.value === savedNames[side], side + ': switching platform lost the saved name');
                    expect(field.closest('.input-field').querySelector('.field-label').textContent ===
                      (side === 'generator' ? 'Generator' : 'Reflector') +
                      (value === 'SAOS8' ? ' Sub-Port Name' : ' Flow Point Name'), side + ': wrong platform field label');
                  }
                }
                expect(!/SAOS8 uses the sub-port name|Not used by SAOS6|SAOS10 offload preparation does not apply|Independent of the generator/.test(
                  document.querySelector('.builder-form').textContent), 'Removed SAT helper text remains');
              }
            }
            expect(!document.querySelector('[aria-label="Benchmark layout"]'), 'Removed Benchmark layout selector remains');
            {
              const container = document.querySelector('.sat-layout').getBoundingClientRect();
              const traffic = document.querySelector('.sat-traffic').getBoundingClientRect();
              const gen = document.querySelector('.sat-generator').getBoundingClientRect();
              const ref = document.querySelector('.sat-reflector').getBoundingClientRect();
              expect(traffic.bottom <= gen.top && traffic.bottom <= ref.top, 'Traffic profile is not above endpoints');
              expect(Math.abs(traffic.left - container.left) < 1 && Math.abs(traffic.width - container.width) < 1,
                'Side-by-side traffic profile does not span the usable width');
              if (innerWidth >= 1100) {
                expect(Math.abs(gen.top - ref.top) < 1 && gen.right < ref.left, 'Generator/Reflector are not left/right columns');
              } else expect(gen.bottom <= ref.top, 'Endpoint columns did not stack');
              expect(document.documentElement.scrollWidth <= innerWidth + 1, 'Benchmark layout overflows horizontally');
            }
            const settingsBefore = JSON.parse(localStorage.getItem('snl-sat-state'));
            for (const value of ['SAOS10', 'SAOS8', 'SAOS6']) {
              const select = document.getElementById('generatorPlatform');
              select.value = value;
              select.dispatchEvent(new Event('change', { bubbles: true })); await tick();
              for (const [tab, titles] of [
                ['Config', ['Configure Generator - ' + value, 'Configure Reflector - SAOS10']],
                ['Run & verify', ['Activate Generator - ' + value, 'Validate Generator - ' + value, 'Validate Reflector - SAOS10']],
                ['Remove', ['Remove Generator - ' + value, 'Remove Reflector - SAOS10']],
              ]) {
                [...document.querySelectorAll('[role="tab"]')].find(button => button.textContent === tab).click(); await tick();
                const blocks = [...document.querySelectorAll('.tab-body .code-block')];
                expect(blocks.map(block => block.querySelector('.code-heading span').textContent).join('|') === titles.join('|'),
                  'Incorrect subsection headings for ' + value + '/' + tab);
                if (tab === 'Run & verify') {
                  expect(blocks[0].querySelectorAll('.code-line').length === 4, 'Activate must contain exactly the first four commands');
                  expect(blocks[1].querySelector('.code-line code').textContent.includes(
                    value === 'SAOS10' ? 'sat stop' : 'benchmark test stop'), 'Validate must begin with original command five');
                  expect(blocks[1].querySelectorAll('.code-line').length === (value === 'SAOS10' ? 6 : 5),
                    'Validate lost generator commands');
                }
              }
            }
            platform.value = settingsBefore.generatorPlatform;
            platform.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            [...document.querySelectorAll('[role="tab"]')].find(button => button.textContent === 'Config').click(); await tick();
            const commonSizes = '64, 128, 256, 512, 1024, 1280, 1518, 2048, 9000';
            const insert = [...document.querySelectorAll('button')].find(button => button.textContent === 'Insert Common Sizes');
            expect(insert?.type === 'button', 'Insert Common Sizes action missing');
            insert.click(); await tick();
            expect(document.getElementById('frameSizes').value === commonSizes, 'Common sizes were not inserted exactly');
            expect(JSON.stringify(JSON.parse(localStorage.getItem('snl-sat-state'))) ===
              JSON.stringify({ ...settingsBefore, frameSizes: commonSizes }), 'Common sizes changed unrelated settings');
            expect(document.querySelector('.builder-results').textContent.includes('frame-size 64 128 256 512 1024 1280 1518 2048 9000'),
              'Common sizes did not update generated config');
            localStorage.setItem('snl-sat-layout', '"stacked"');
            location.hash = '#/l3ip'; await tick();
            location.hash = '#/sat'; await tick();
            expect(document.querySelector('.sat-layout-side-by-side')
              && !document.querySelector('[aria-label="Benchmark layout"]')
              && document.getElementById('frameSizes').value === commonSizes,
              'Legacy layout preference overrode fixed layout or inserted sizes did not persist');
            location.hash = '#/l3ip'; await tick();
            const legacySat = { ...settingsBefore, pcp: '2', testConnectivity: false };
            delete legacySat.priorityCodePoints;
            localStorage.setItem('snl-sat-state', JSON.stringify(legacySat));
            location.hash = '#/sat'; await tick();
            document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]').click(); await tick();
            expect(document.getElementById('sat-pcp2').checked && !document.getElementById('sat-pcp4').checked
              && document.querySelector('.builder-results').textContent.includes('c-pcp "pcp2"'),
              'Saved legacy PCP selection was lost during SAT migration');
            [...document.querySelectorAll('[role="tab"]')].find(button => button.textContent === 'Run & verify').click(); await tick();
            expect(document.querySelector('.tab-body .code-line code').textContent.startsWith('sat ping')
              && !document.getElementById('testConnectivity'),
              'Legacy saved settings must not disable the permanent sat ping');
            for (const suite of ['standard', 'rfc2544', 'y1564', 'outage']) {
              location.hash = '#/l3ip'; await tick();
              localStorage.setItem('snl-sat-state', JSON.stringify({
                ...legacySat, benchmarkType: suite, encapType: 'qinq', duration: 'Custom', priorityCodePoints: ['pcp2'],
              }));
              location.hash = '#/sat'; await tick();
              if (suite !== 'outage') {
                document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]').click(); await tick();
              }
              checkAdvancedOrder();
              expect(document.getElementById('sVlan')
                && Boolean(document.getElementById('customDuration')) === (suite !== 'outage')
                && Boolean(document.getElementById('emixSequence')) === (suite === 'y1564'),
                'Reordering changed QinQ, custom-duration or EMIX field visibility for ' + suite);
            }
            result.textContent = 'PASS';
            result.dataset.done = 'true';
          } catch (error) {
            result.textContent = 'FAIL: ' + (error instanceof Error ? error.stack : String(error));
            result.dataset.done = 'true';
          }
          document.body.append(result);
        });
      </script>`;
      const file = join(dir, 'sat.html');
      const end = html.lastIndexOf('</body>');
      assert.ok(end >= 0);
      writeFileSync(file, html.slice(0, end) + checks + html.slice(end));
      const result = await runBrowserChecks(browser, {
        userDataDir: join(dir, 'profile'), width, url: `${pathToFileURL(file).href}#/sat`, timeoutMs: 30000,
      });
      assert.equal(result, 'PASS', result);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
