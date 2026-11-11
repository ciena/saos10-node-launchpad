import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { defaults as ipDefaults } from '../src/generator/l3ip.js';
import { defaults as l2Defaults } from '../src/generator/l2evc.js';
import { CFM_EXTRA_DEFAULTS } from '../src/generator/cfm-options.js';
import { runBrowserChecks } from './helpers/browser.js';

const browser = process.env.CHROME_BIN || ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(existsSync);
for (const width of [390, 768, 1440]) {
test(`Offline React flows, saved drafts and visualizations at ${width}px`, { skip: !browser }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'snl-ui-flows-'));
  try {
    const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
    const html = readFileSync(new URL(`../release/saos10-node-launchpad-v${version}.html`, import.meta.url), 'utf8');
    const checks = `<script>
      const runtimeErrors = [];
      const notifications = [];
      window.addEventListener('snl-notify', event => notifications.push(event.detail));
      window.addEventListener('error', e => runtimeErrors.push(e.message));
      window.addEventListener('unhandledrejection', e => runtimeErrors.push(String(e.reason)));
      window.addEventListener('load', async () => {
        const result = document.createElement('pre');
        result.id = 'flow-result';
        result.textContent = 'RUNNING';
        document.body.append(result);
        const expect = (condition, message) => { if (!condition) throw new Error(message); };
        const tick = () => new Promise(resolve => setTimeout(resolve, 60));
        const waitUntil = async (condition, message) => {
          for (let i = 0; i < 100; i++) { if (condition()) return; await tick(); }
          throw new Error(message);
        };
        const waitFor = async selector => {
          for (let i = 0; i < 40; i++) {
            const node = document.querySelector(selector);
            if (node) return node;
            await tick();
          }
          throw new Error('Missing ' + selector);
        };
        const nativeInput = (element, value) => {
          const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
          element.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const navigate = async route => {
          result.textContent = 'NAV ' + route; location.hash = '#/' + route; await tick(); await waitFor('h1');
          expect(!/[·←→▶◀❚]/u.test(document.title), 'Page title uses non-ASCII symbols on ' + route);
          expect(!/[·←→↔▶◀❚]/u.test(document.querySelector('#view').textContent),
            'Page content uses potentially unsupported symbols on ' + route);
          result.textContent = 'READY ' + route;
        };
        try {
          await waitFor('.tool-cards');
          expect(document.querySelector('.brand').textContent.includes('SAOS10')
            && document.querySelector('.brand').textContent.includes('Node Launchpad')
            && !document.querySelector('.product-caption')
            && document.querySelector('.app-header [aria-label="Current path"]').textContent === 'Overview'
            && document.title.endsWith('SAOS10 Node Launchpad')
            && !/[·←→▶◀❚]/u.test(document.title),
            'New product branding is incomplete');
          expect(document.querySelector('.download-html').getAttribute('download').startsWith('saos10-node-launchpad-v'),
            'Standalone download filename does not use the new brand');
          expect(document.documentElement.dataset.theme === 'dark' && localStorage.getItem('snl-theme') === 'dark',
            'Legacy theme preference was not migrated');
          localStorage.setItem('tbf-cheatsheet-changelog', JSON.stringify([
            { id: 'old-activity', timestamp: '2026-10-22T10:00:00Z', preview: 'show old-activity' },
          ]));
          localStorage.setItem('tbf-cheatsheet-changelog-v0.5.3', localStorage.getItem('tbf-cheatsheet-changelog'));
          localStorage.setItem('snl-cheatsheet-changelog-v0.5.6', localStorage.getItem('tbf-cheatsheet-changelog'));
          localStorage.setItem('snl-cheatsheet-changelog-v0.6.0', localStorage.getItem('tbf-cheatsheet-changelog'));
          localStorage.setItem('snl-cheatsheet-changelog-v0.7.0', localStorage.getItem('tbf-cheatsheet-changelog'));
          await navigate('changelog');
          expect(!document.querySelector('.cheatsheet-change')
            && document.querySelector('#view').textContent.includes('No additions recorded yet')
            && JSON.parse(localStorage.getItem('snl-cheatsheet-changelog-v0.8.14') ?? '[]').length === 0
            && JSON.parse(localStorage.getItem('snl-cheatsheet-changelog-v0.7.0'))[0].preview === 'show old-activity'
            && JSON.parse(localStorage.getItem('snl-cheatsheet-changelog-v0.6.0'))[0].preview === 'show old-activity'
            && JSON.parse(localStorage.getItem('snl-cheatsheet-changelog-v0.5.6'))[0].preview === 'show old-activity',
            'Existing browser activity was not flushed from the HTML page');
          await navigate('');
          expect(document.querySelector('.shell-workspace'), 'Saved alternate layout affected the fixed Workspace');
          expect(!notifications.some(message => message.includes('layout')), 'Legacy layout migration reported an error');
          const overviewButtons = () => [...document.querySelectorAll('[aria-label="Overview design"] button')];
          expect(!document.querySelector('.overview-picker').textContent.includes('OVERVIEW DESIGN'),
            'Removed Overview design caption remains');
          expect(overviewButtons().map(button => button.textContent).join('|') === 'Simple|Expert',
            'Overview should offer only Simple and Expert');
          expect(document.querySelector('[data-overview="tasks"]'), 'Removed Overview preference did not load the new Simple design');
          const checkOverview = async () => {
            for (const [index, design] of ['tasks', 'expert'].entries()) {
              overviewButtons()[index].click(); await tick();
              const overview = document.querySelector('[data-overview="' + design + '"]');
              expect(overview && overviewButtons()[index].getAttribute('aria-pressed') === 'true', 'Overview design did not switch: ' + design);
              expect(overview.querySelector('.overview-header .eyebrow').textContent === 'SAOS10 NODE LAUNCHPAD',
                'Overview heading still contains a slash');
              if (design === 'expert') expect(overview.querySelector('.tool-cards > a').getAttribute('href') === '#/l2evc',
                'Expert Overview does not prioritize configuration tools');
              if (design === 'tasks') expect([...overview.querySelectorAll('.overview-missions .panel:first-child a')]
                .map(link => link.getAttribute('href')).join(',') === '#/login,#/golden,#/terms',
                'Simple Overview is missing SAOS fundamentals at the bottom of Bring a node online');
              expect(!/Browser-only|Review before applying|Local-first tools|No device connection|Just the essentials|A compact command desk/i.test(document.querySelector('.app-shell').textContent),
                'Removed Overview caveat or tagline remains');
              expect(!overview.textContent.includes('YOUR SERVICE PATH') && !document.querySelector('.hero-map, .journey-nav'),
                'Removed Overview content remains');
              for (const route of ['login', 'golden', 'terms', 'l2evc', 'l3ip', 'sat', 'validate', 'cheatsheet', 'changelog', 'instructions']) {
                expect(overview.querySelector('a[href="#/' + route + '"]'), 'Overview omitted destination: ' + design + '/' + route);
              }
              expect(!overview.querySelector('a[href="#/design"]'), 'Visual lab still appears as a separate Overview destination');
              expect(document.documentElement.scrollWidth <= innerWidth + 1, 'Overview overflows: ' + design);
              expect(!overview.querySelector('input[type="search"], .badge'), 'Removed Overview search or badges remain: ' + design);
              expect(overview.querySelectorAll('.tool-cards > a').length === 10, 'Overview does not show all destinations');
              expect([...overview.querySelectorAll('a[href="#/cheatsheet"]')].every(link => link.querySelector('svg.cheatsheet-lightbulb')),
                'Overview cheatsheet does not use the selected lightbulb');
              expect(document.querySelector('#app-navigation a[href="#/cheatsheet"] svg.cheatsheet-lightbulb'),
                'Sidebar cheatsheet does not use the selected lightbulb');
            }
          };
          await checkOverview();
          const faviconUrl = document.querySelector('link[rel="icon"]').href;
          expect(faviconUrl.startsWith('data:image/svg+xml'), 'Offline favicon is not self-contained');
          const favicon = await (await fetch(faviconUrl)).text();
          expect(favicon.includes('stroke="#DC0000"')
            && favicon.includes(document.querySelector('.cheatsheet-lightbulb path').getAttribute('d')),
            'Ciena-red favicon does not match the selected lightbulb artwork');
          await navigate('login'); await navigate('');
          expect(document.querySelector('[data-overview="expert"]'), 'Overview design did not persist across navigation');
          expect(document.querySelector('.brand img').complete && document.querySelector('.brand img').naturalWidth > 0,
            'Offline brand image is missing');
          expect(document.querySelector('.download-html').href.split('#')[0] === location.href.split('#')[0],
            'Offline download does not reference this HTML file');
          document.querySelector('[aria-label="Page settings"]').click(); await tick();
          const settings = document.querySelector('.settings-dialog');
          expect(settings.matches(':modal'), 'Settings gear did not open a modal');
          expect(!settings.querySelector('[aria-label="Application layout"]')
            && settings.querySelector('[aria-label^="Switch to"]'), 'Settings should retain appearance controls but not a layout picker');
          const settingsGrid = settings.querySelector('.settings-grid').getBoundingClientRect();
          const sizeControl = settings.querySelector('.settings-size').getBoundingClientRect();
          expect(Math.abs(sizeControl.left - settingsGrid.left) < 1 && Math.abs(sizeControl.width - settingsGrid.width) < 1,
            'Text size control is not left-aligned and full-width');
          const colorSelect = settings.querySelector('[aria-label="Color scheme"]');
          const colorLabel = colorSelect.parentElement;
          const readingSelect = settings.querySelector('[aria-label="Reading font"]');
          expect(Math.abs((colorSelect.getBoundingClientRect().top - colorLabel.getBoundingClientRect().top)
            - (readingSelect.getBoundingClientRect().top - readingSelect.parentElement.getBoundingClientRect().top)) < 1,
            'Color scheme has extra spacing before the dropdown');
          expect(getComputedStyle(settings.querySelector('.settings-label')).fontSize === getComputedStyle(colorLabel).fontSize
            && getComputedStyle(settings.querySelector('.settings-size > span')).fontSize === getComputedStyle(colorLabel).fontSize,
            'Settings descriptions use different font sizes');
          const changeSelect = async (label, value) => {
            const select = document.querySelector('[aria-label="' + label + '"]');
            select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); await tick();
          };
          const initialFontSize = parseFloat(getComputedStyle(document.body).fontSize);
          const sizePresets = [...settings.querySelectorAll('[aria-label="Text size presets"] button')];
          expect(sizePresets.length === 4, 'Text size presets missing');
          for (const [index, button] of sizePresets.entries()) {
            button.click(); await tick();
            expect(settings.querySelector('[aria-label="Text size"]').value === String(index)
              && button.getAttribute('aria-pressed') === 'true', 'Text size label did not apply size immediately');
            const track = settings.querySelector('[aria-label="Text size"]').getBoundingClientRect();
            const rect = button.getBoundingClientRect();
            const anchor = index === 0 ? rect.left : index === 3 ? rect.right : (rect.left + rect.right) / 2;
            expect(Math.abs(anchor - (track.left + track.width * index / 3)) < 2, 'Text size label is not aligned to its slider stop');
          }
          for (const size of [1, 2, 3]) {
            nativeInput(settings.querySelector('[aria-label="Text size"]'), String(size)); await tick();
            expect(parseFloat(getComputedStyle(document.body).fontSize) > initialFontSize, 'Text-size slider did not enlarge fonts immediately');
          }
          for (const palette of ['ciena', 'ocean', 'orchid']) {
            await changeSelect('Color scheme', palette);
            expect(document.documentElement.dataset.palette === palette, 'Palette did not apply immediately');
            for (const theme of ['dark', 'light']) {
              if (document.documentElement.dataset.theme !== theme) settings.querySelector('[aria-label^="Switch to"]').click();
              await tick();
              expect(document.documentElement.dataset.theme === theme, 'Theme did not apply immediately');
              expect(getComputedStyle(settings).backgroundColor === getComputedStyle(document.querySelector('.overview-directory-item')).backgroundColor,
                'Settings panel does not follow appearance colors');
              await checkOverview();
            }
          }
          await changeSelect('Reading font', 'opendyslexic');
          await document.fonts.load('16px OpenDyslexic');
          expect(document.fonts.check('16px OpenDyslexic') && getComputedStyle(document.querySelector('h1')).fontFamily.includes('OpenDyslexic'),
            'Bundled OpenDyslexic did not load offline');
          expect(settings.querySelector('.font-license').textContent.includes('SIL OPEN FONT LICENSE'), 'Font license not included');
          document.querySelector('[aria-label="Close settings"]').click(); await tick();
          expect(!settings.open && localStorage.getItem('snl-font') === '"opendyslexic"'
            && localStorage.getItem('snl-text-size') === '3', 'Appearance settings did not persist');
          for (const route of ['golden', 'terms', 'cheatsheet', 'l2evc', 'l3ip', 'sat']) {
            await navigate(route);
            expect(document.documentElement.scrollWidth <= innerWidth + 1, 'Large-font overflow on ' + route + ': ' +
              [...document.querySelectorAll('#view *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1)
                .slice(0, 4).map(node => node.outerHTML.slice(0, 180)).join('; '));
            const command = document.querySelector('code');
            if (command) expect(!getComputedStyle(command).fontFamily.includes('OpenDyslexic'), 'Reading font replaced fixed-width commands');
          }
          document.querySelector('[aria-label="Page settings"]').click(); await tick();
          nativeInput(settings.querySelector('[aria-label="Text size"]'), '0'); await tick();
          await changeSelect('Reading font', 'default');
          await changeSelect('Color scheme', 'ciena');
          document.querySelector('[aria-label="Close settings"]').click(); await tick();
          expect(!document.querySelector('[aria-label="Application layout"]'), 'Removed layout picker remains');
          {
            await navigate(''); await checkOverview();
            for (const route of ['login', 'golden', 'terms', 'cheatsheet', 'l2evc', 'l3ip', 'sat', 'validate', 'changelog', 'instructions']) {
              await navigate(route);
              expect(document.querySelector('h1').textContent.length > 0, 'Empty route ' + route);
              const path = document.querySelector('.app-header [aria-label="Current path"]');
              const activeLink = document.querySelector('#app-navigation a[aria-current="page"]');
              expect(path && getComputedStyle(path).display !== 'none'
                && path.querySelector('strong').textContent === activeLink.textContent
                && !path.textContent.includes('Overview')
                && !document.querySelector('.app-main > .breadcrumbs'), 'Header path is missing or duplicated on ' + route);
              expect(document.documentElement.scrollWidth <= innerWidth + 1, 'Page overflow on ' + route);
            }
          }
          const legacyIp = ${JSON.stringify(ipDefaults())};
          delete legacyIp.role;
          legacyIp.name = 'legacy-ip';
          localStorage.setItem('tbf-l3ip-state', JSON.stringify(legacyIp));
          await navigate('l3ip');
          expect(document.getElementById('name-hint').textContent === 'Used for IP-Int name, and part of FD and FP names.',
            'IP interface name helper text is incorrect');
          expect(document.getElementById('name').value === 'legacy-ip'
            && JSON.parse(localStorage.getItem('snl-l3ip-state')).role === 'Data',
            'Legacy IP draft was not preserved and migrated');
          const changelogLink = document.querySelector('#app-navigation a[href="#/changelog"]');
          const instructionsLink = document.querySelector('#app-navigation a[href="#/instructions"]');
          expect(changelogLink.compareDocumentPosition(instructionsLink) & Node.DOCUMENT_POSITION_FOLLOWING,
            'Instructions is not ordered below Changelog in Explore');
          await navigate('instructions');
          expect(document.querySelector('#view').textContent.includes('The app generates configuration text')
            && document.querySelector('#view').textContent.includes('does not connect to, configure, or control a device'),
            'Instructions page does not include README guidance for AI assistants');
          await navigate('l3ip');
          expect(!document.querySelector('.profile-manager'), 'Saved profile panel should be removed');
          expect(/built \\d{4}-\\d{2}-\\d{2}/.test(document.querySelector('.app-footer').textContent) && !document.querySelector('.age-notice'),
            'Footer build date missing, or a fresh build shows the age notice');
          document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]').click(); await tick();
          expect(document.getElementById('role').value === 'Data'
            && document.getElementById('role').closest('.panel').textContent.includes('Encapsulation & routing'), 'Role default or grouping incorrect');
          expect(document.querySelector('label[for="mtu"]').textContent === 'MTU (Layer3/IP)'
            && !document.getElementById('mtu-hint').textContent.includes('Workbook default 9000.')
            && document.getElementById('mtu-hint').querySelectorAll('p').length === 2,
            'IP MTU label or two-line hint incorrect');
          const mtuCommand = () => document.getElementById('mtu-hint').querySelector('code').textContent;
          nativeInput(document.getElementById('port'), '1/1'); await tick();
          expect(mtuCommand() === 'logical-ports logical-port 1/1 mtu <MTU>', 'L2 MTU hint did not use the valid logical port');
          nativeInput(document.getElementById('port'), 'bad port'); await tick();
          expect(mtuCommand() === 'logical-ports logical-port <PORT> mtu <MTU>', 'Invalid port leaked into the L2 MTU hint');
          nativeInput(document.getElementById('port'), legacyIp.port); await tick();
          for (const id of ['prefix-hint', 'role-hint']) {
            const hint = document.getElementById(id);
            expect(hint.textContent.split('\\n').length === 2 && getComputedStyle(hint).whiteSpace === 'pre-line',
              'IP hint sentences do not render on separate lines: ' + id);
          }
          expect(!document.getElementById('prefix-hint').textContent.includes('broad-prefix acceptance')
            && document.getElementById('role-hint').textContent.endsWith('Data for transit or control traffic.')
            && !document.getElementById('vlan-hint') && !document.getElementById('qinq-hint'),
            'IP hint wording or removal is incorrect');
          expect(document.getElementById('qinq') && !document.getElementById('innerVlan'), 'QinQ inner VLAN is visible before enabling QinQ');
          document.getElementById('qinq').click(); await tick();
          expect(document.getElementById('innerVlan'), 'QinQ inner VLAN missing when enabled');
          const ipPlatform = document.getElementById('platform');
          for (const platform of ['SAOS10 (392x)', 'SAOS8 / 6500-S (PKT/eMOTR)', 'SAOS6']) {
            ipPlatform.value = platform; ipPlatform.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(!document.getElementById('qinq') && !document.getElementById('innerVlan')
              && JSON.parse(localStorage.getItem('snl-l3ip-state')).qinq === false,
              'Unsupported platform retained visible or enabled QinQ fields: ' + platform);
          }
          ipPlatform.value = legacyIp.platform; ipPlatform.dispatchEvent(new Event('change', { bubbles: true })); await tick();
          expect(document.getElementById('qinq') && !document.getElementById('qinq').checked
            && !document.getElementById('innerVlan'), 'Returning to supported platform did not restore the QinQ toggle');
          const role = document.getElementById('role');
          role.value = 'Management'; role.dispatchEvent(new Event('change', { bubbles: true })); await tick();
          expect(document.querySelector('.code-block').textContent.includes('admin-status true role management type point-to-point'),
            'Management role was not generated');
          expect([...document.querySelectorAll('.code-line code')].every(code => !code.textContent.trimStart().startsWith('#')),
            'IP config still contains comment placeholders');
          nativeInput(document.getElementById('name'), 'browser-ip');
          await tick();
          expect(document.querySelector('.code-block').textContent.includes('browser-ip'), 'IP commands did not update');
          [...document.querySelectorAll('button')].find(button => button.textContent === 'Validate config').click();
          await waitFor('#review-cli');
          expect(document.getElementById('review-cli').value.includes('browser-ip')
            && document.querySelector('#review-cli').value.includes('config'),
            'Builder review action did not preload its generated CLI');
          const releaseSelect = document.getElementById('review-release');
          const platformSelect = document.getElementById('review-platform');
          expect(releaseSelect?.tagName === 'SELECT' && platformSelect?.tagName === 'SELECT'
            && releaseSelect.options.length === 3 && platformSelect.options.length === 12
            && releaseSelect.value === '10_12_00_0228' && platformSelect.value === 'cn5164',
            'Config Validator does not use translator-supported release/platform dropdown options');
          expect([...releaseSelect.options].map(option => option.value).join('|') === '10_12_00_0228|10_11_02_0199|10_11_01_0248'
            && [...platformSelect.options].map(option => option.value).includes('cn5144')
            && ![...platformSelect.options].some(option => option.value === 'cn3926v2'),
            'Config Validator options do not match translator release/platform identifiers');
          expect([...platformSelect.options].every(option => option.textContent.trim() === option.value),
            'Platform dropdown should display only the cnXXXX identifier');
          releaseSelect.value = '10_11_01_0248';
          releaseSelect.dispatchEvent(new Event('change', { bubbles: true })); await tick();
          expect(platformSelect.options.length === 9 && ![...platformSelect.options].some(option => option.value === 'cn3926'),
            'Platform dropdown did not update to the selected release bootstrap set');
          releaseSelect.value = '10_12_00_0228';
          releaseSelect.dispatchEvent(new Event('change', { bubbles: true })); await tick();
          expect(platformSelect.value === 'cn5164' && document.querySelector('h1').textContent === 'Config Validator',
            'Config Validator did not restore the matching target or renamed page title');
          const reviewText = document.querySelector('#view').textContent;
          expect(reviewText.includes('Remote validation is not configured in this build')
            && reviewText.includes('No configuration is sent')
            && reviewText.includes('does not prove that the feature works'),
            'Unconfigured remote validation is not clearly disclosed');
          const validationButton = [...document.querySelectorAll('button')].find(button =>
            button.textContent.includes('Online validation unavailable'));
          expect(validationButton?.disabled, 'Remote validation must stay disabled without an approved endpoint');
          await navigate('sat'); await navigate('l3ip');
          expect(document.getElementById('name').value === 'browser-ip', 'IP input was not preserved');
          document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]').click(); await tick();
          expect(document.getElementById('role').value === 'Management', 'IP role did not persist');
          nativeInput(document.getElementById('prefix'), '32'); await tick();
          expect(document.querySelector('.code-block').textContent.includes('cn-if:type loopback')
            && !document.querySelector('.code-block').textContent.includes('underlay-binding')
            && !document.getElementById('port') && !document.getElementById('vlan'),
            '/32 did not replace the routed config with a loopback');
          expect(![...document.querySelectorAll('[role="tab"]')].some(tab => tab.textContent === 'Loopback'),
            'Separate Loopback output tab remains');
          nativeInput(document.getElementById('prefix'), '30'); await tick();
          expect(document.querySelector('.code-block').textContent.includes('underlay-binding')
            && document.getElementById('port').value === legacyIp.port
            && document.getElementById('vlan').value === legacyIp.vlan,
            'Returning from /32 did not restore routed config and saved port/VLAN');
          nativeInput(document.getElementById('address'), 'invalid'); await tick();
          expect(document.querySelector('[role="alert"]'), 'Invalid IPv4 not surfaced');
          expect(document.querySelector('.output-panel .panel-heading button').disabled, 'Invalid config can be copied');
          const savedOam = ${JSON.stringify(l2Defaults())};
          savedOam.cfm.dmmRemoteMac = '02:00:00:00:01:01';
          savedOam.cfm.slmRemoteMac = '02:00:00:00:02:01';
          localStorage.setItem('snl-l2evc-state', JSON.stringify(savedOam));
          await navigate('l2evc'); await tick();
          const migratedSaved = JSON.parse(localStorage.getItem('snl-l2evc-state')).cfm;
          expect(!Object.hasOwn(migratedSaved, 'dmmRemoteMac') && !Object.hasOwn(migratedSaved, 'slmRemoteMac')
            && migratedSaved.remoteMep === savedOam.cfm.remoteMep, 'Saved MAC targets were not removed while preserving Remote MEP ID');
          expect(notifications.some(message => message.includes('Removed unsupported DMM/SLM MAC targets')),
            'Saved MAC-target migration was silent');
          {
            const header = document.querySelector('.page-heading');
            const controls = header.lastElementChild;
            const share = [...controls.querySelectorAll('button')].find(button => button.textContent === 'Share settings');
            const reset = [...controls.querySelectorAll('button')].find(button => button.textContent === 'Reset');
            const detail = controls.querySelector('[aria-label="Detail level"]');
            const layouts = controls.querySelector('[aria-label="Form layout"]');
            expect(share && reset && detail && layouts, 'L2 header does not group layouts, Share settings, detail level and Reset');
            expect(header.querySelector('h1').textContent === 'Single-node service creator.'
              && document.querySelector('.breadcrumbs strong').textContent === 'L2 EVC builder'
              && document.querySelector('.app-navigation a[aria-current="page"]').textContent.includes('L2 EVC builder'),
              'Page title change altered the top banner or sidebar name');
            expect(Math.abs(controls.getBoundingClientRect().right - header.getBoundingClientRect().right) < 2,
              'L2 header controls are not right-aligned');
            if (innerWidth >= 1200) {
              const tops = [layouts, share, detail, reset].map(node => node.getBoundingClientRect().top);
              expect(Math.max(...tops) - Math.min(...tops) < 4, 'L2 header controls are not on one row');
            }
            expect(document.getElementById('l2-serviceName-hint').textContent === 'Used for FD name and part of FP and CFM names.',
              'L2 service name helper text is incorrect');
            expect(document.getElementById('live-packet-walk').textContent.includes('Click an object to highlight its config.')
              && !document.getElementById('live-packet-walk').textContent.includes('pin its highlights'),
              'Packet walk click guidance is outdated');
          }
          nativeInput(document.getElementById('l2-serviceName'), 'browser-l2'); await tick();
          expect(document.querySelector('.code-block').textContent.includes('browser-l2'), 'L2 commands did not update');
          for (const side of ['left', 'right']) {
            const vlanField = document.getElementById('l2-' + side + '-vlan').closest('[data-field]').parentElement;
            for (const [key, label] of [['allTags', 'All Tags'], ['untagged', 'Untagged']]) {
              const checkbox = document.getElementById('l2-' + side + '-' + key);
              expect(checkbox && vlanField.contains(checkbox), 'Basic VLAN option not grouped with VLAN: ' + side + '/' + key);
              expect(checkbox.closest('label').textContent === label, 'VLAN option label incorrect');
              const hint = checkbox.closest('[data-field]').querySelector('.field-hint');
              expect(key === 'allTags' ? !hint : hint?.textContent.includes('EPL UNI'), 'VLAN guidance should appear only under Untagged');
              checkbox.click(); await tick();
            }
            const allTags = document.getElementById('l2-' + side + '-allTags').closest('[data-field]');
            const untagged = document.getElementById('l2-' + side + '-untagged').closest('[data-field]');
            expect(allTags.getBoundingClientRect().left > document.getElementById('l2-' + side + '-vlan').getBoundingClientRect().right,
              'Tag options are not to the right of VLAN');
            expect(untagged.getBoundingClientRect().top >= allTags.getBoundingClientRect().bottom - 1
              && untagged.getBoundingClientRect().top - allTags.getBoundingClientRect().bottom < 2,
              'Untagged is not directly underneath All Tags');
          }
          expect(document.querySelector('.code-block').textContent.includes('CLASSIFIER_4097 CLASSIFIER_4096'),
            'Basic All Tags/Untagged options did not regenerate commands');
          for (const side of ['left', 'right']) for (const key of ['allTags', 'untagged']) {
            document.getElementById('l2-' + side + '-' + key).click(); await tick();
          }
          const setEndpointRole = async (side, value) => {
            const select = document.getElementById('l2-' + side + '-role');
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true })); await tick();
          };
          for (const roles of [['UNI', 'ENNI'], ['ENNI', 'UNI'], ['ENNI', 'ENNI'], ['UNI', 'UNI']]) {
            await setEndpointRole('left', roles[0]); await setEndpointRole('right', roles[1]);
            for (const [index, side] of ['left', 'right'].entries()) {
              expect(document.querySelector('label[for="l2-' + side + '-vlan"]').textContent === (roles[index] === 'ENNI' ? 'S-VLAN' : 'VLAN'),
                'VLAN label does not follow endpoint role');
              expect(Boolean(document.getElementById('l2-' + side + '-allTags')) === (roles[index] === 'UNI')
                && Boolean(document.getElementById('l2-' + side + '-untagged')) === (roles[index] === 'UNI'),
                'UNI tag options do not follow endpoint role');
            }
            const svg = document.querySelector('#live-packet-walk svg.packetwalk');
            expect(svg.textContent.includes('Left >>> Right') && svg.textContent.includes('Left <<< Right')
              && !/[·←→]/u.test(svg.textContent),
            'Packet walk uses non-ASCII lane labels');
            const bounds = svg.viewBox.baseVal;
            for (const rect of svg.querySelectorAll('.chip rect')) {
              const box = rect.getBBox();
              expect(box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width,
                'VLAN chip clipped for ' + roles.join('/'));
            }
            const incoming = [...svg.children].filter(child => child.classList.contains('chips'));
            for (const [side, index] of [['left', 0], ['right', 2]]) {
              const incomingRect = incoming[index].querySelector('.chip rect');
              const classifierRect = svg.querySelector('[data-obj="classifier-' + side + '"] .chip rect');
              expect(getComputedStyle(incomingRect).fill === getComputedStyle(classifierRect).fill,
                'Classifier does not match incoming outer tag for ' + side + ' ' + roles.join('/'));
            }
          }
          expect(!document.querySelector('.output-panel').textContent.includes('Show skipped lines'), 'Skipped-lines option remains');
          expect(!document.querySelector('.code-block').textContent.includes('# left blank'), 'Skipped lines remain visible');
          expect(!document.querySelector('[aria-controls="very-advanced-oam"]')
            && [...document.querySelectorAll('.text-action')].some(button => button.textContent === 'Show Advanced' && !button.querySelector('svg')),
            'Basic mode should offer Show Advanced without an arrow');
          const detail = document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]');
          detail.click(); await tick();
          expect(document.getElementById('l2-left-ingressOp'), 'Advanced L2 settings missing');
          {
            const label = document.querySelector('label[for="l2-device"]');
            const confirmation = label.querySelector('.device-confirmation');
            expect(confirmation?.textContent === 'Confirm Accurate!' && confirmation.querySelector('.lucide-arrow-left')
              && getComputedStyle(confirmation).color === 'rgb(220, 0, 0)'
              && !document.getElementById('l2-device-hint')?.textContent.includes('Confirm'),
              'Device Type confirmation is not beside its label, red and pointing left');
            const device = document.getElementById('l2-device');
            expect(!document.getElementById('l2-device-hint'), 'Device Type description should be hidden for non-392x platforms');
            device.value = '392x'; device.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(document.getElementById('l2-device-hint')?.textContent === '392x uses an FD SVLAN, and often transforms on UNI.',
              '392x Device Type description is incorrect');
            device.value = [...device.options].find(option => option.value !== '392x').value;
            device.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(!document.getElementById('l2-device-hint'), '392x Device Type description remains on another platform');
          }
          const oamToggle = document.getElementById('l2-cfm-enabled');
          if (!oamToggle.checked) { oamToggle.click(); await tick(); }
          for (const [id, expected] of [
            ['l2-cfm-localMep-hint', "far end's Remote MEP ID"],
            ['l2-cfm-remoteMep-hint', "far end's Local MEP ID"],
          ]) {
            const hint = document.getElementById(id);
            expect(hint.textContent.includes(expected) && hint.querySelector('strong u')?.textContent === expected,
              'Service OAM far-end MEP reference is not bold and underlined: ' + expected);
          }
          for (const [id, count] of [['l2-serviceType-hint', 3], ['l2-left-role-hint', 2], ['l2-right-role-hint', 2]]) {
            const hint = document.getElementById(id);
            expect(hint?.textContent.split('\\n').length === count && getComputedStyle(hint).whiteSpace === 'pre-line',
              'Hint sentences must render on separate lines: ' + id);
          }
          for (const side of ['left', 'right']) {
            expect(!document.getElementById('l2-' + side + '-vlan-hint')
              && document.getElementById('l2-' + side + '-role-hint').textContent.includes('ENNI = network-facing with S-VLAN.'),
              'Endpoint hint changes missing');
            for (const key of ['allTags', 'untagged', 'l2cp']) {
              document.getElementById('l2-' + side + '-' + key).click(); await tick();
            }
            await setEndpointRole(side, 'ENNI');
            expect(['allTags', 'untagged', 'l2cp', 'l2cpProfile'].every(key => !document.getElementById('l2-' + side + '-' + key)),
              'ENNI retains UNI-only controls');
            const stored = JSON.parse(localStorage.getItem('snl-l2evc-state'))[side];
            expect(!stored.allTags && !stored.untagged && !stored.l2cp
              && !document.querySelector('.issue-error'), 'Changing to ENNI retained incompatible hidden settings');
            expect(notifications.some(message => message.includes('endpoint changed to ENNI: disabled UNI-only options')),
              'Clearing enabled UNI-only options was silent');
            await setEndpointRole(side, 'UNI');
            expect(['allTags', 'untagged', 'l2cp'].every(key => !document.getElementById('l2-' + side + '-' + key).checked),
              'Returning to UNI restored stale options');
          }
          {
            expect(!document.getElementById('l2-cfm-slmInterval-hint'), 'Removed SLM availability hint remains');
            const toggle = document.querySelector('[aria-controls="very-advanced-oam"]');
            expect(toggle?.textContent === 'Show Very Advanced' && !toggle.querySelector('svg') && toggle.getAttribute('aria-expanded') === 'false',
              'Very advanced OAM link missing or initially expanded');
            toggle.click(); await tick();
            expect(toggle.textContent === 'Hide Very Advanced' && toggle.getAttribute('aria-expanded') === 'true' && document.getElementById('l2-cfm-dmmMeasurementInterval').value === '15'
              && document.getElementById('l2-cfm-slmFlrMeasurements').value === '10', 'Very advanced defaults differ from generated settings');
            expect(!document.getElementById('l2-cfm-lossResponder') && !document.getElementById('l2-cfm-slmResponder')
              && !document.getElementById('l2-cfm-delayResponder'), 'Read-only responder states are still offered as configuration');
            expect(!document.getElementById('l2-cfm-dmmRemoteMac') && !document.getElementById('l2-cfm-slmRemoteMac')
              && document.getElementById('l2-cfm-staticRemoteMac'), 'MAC-target removal changed static remote MEP configuration');
            expect([...document.getElementById('l2-cfm-mdPermission').options].some(o => o.value === 'chassis-manage')
              && ![...document.getElementById('l2-cfm-mdPermission').options].some(o => o.value === 'defer'),
              'MD permission options do not match SAOS hardware syntax');
            const period = document.getElementById('l2-cfm-slmInterval');
            period.value = '10s'; period.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(document.querySelector('.issues')?.textContent.includes('availability reporting interval'), 'SLM mismatch message disappeared');
            nativeInput(document.getElementById('l2-cfm-slmAvailabilityInterval'), '20'); await tick();
            expect(!document.querySelector('.issues')?.textContent.includes('availability reporting interval')
              && document.querySelector('.output-panel').textContent.includes('availability-measurement-interval 20'),
              'Edited SLM availability interval did not update validation and commands');
            period.value = '1s'; period.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            nativeInput(document.getElementById('l2-cfm-slmAvailabilityInterval'), '15'); await tick();
            const acceleration = document.getElementById('l2-cfm-slmAccelerate');
            nativeInput(document.getElementById('l2-cfm-slmTestId'), '1'); await tick();
            acceleration.value = 'true'; acceleration.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(!document.getElementById('l2-cfm-slmPriority'), 'Inherited accelerated SLM priority remains editable');
            const slmLine = [...document.querySelectorAll('.code-block code')].find(node => node.textContent.includes(' loss-measurement-config '));
            expect(slmLine?.textContent.includes('accelerate true')
              && !/\\b(priority|frame-size|test-id) /.test(slmLine.textContent), 'Accelerated fixed-field overrides still emitted');
            const tagCount = document.getElementById('l2-cfm-tagCount');
            tagCount.value = 'double'; tagCount.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            nativeInput(document.getElementById('l2-cfm-innerVlan'), '101'); await tick();
            expect(document.querySelector('.code-block').textContent.includes('apply\\nreturn\\nconfig'),
              'Double-tag pending edits are not committed together');
            tagCount.value = 'single'; tagCount.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            acceleration.value = ''; acceleration.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            nativeInput(document.getElementById('l2-cfm-slmTestId'), '4'); await tick();
            toggle.click(); await tick();
            expect(toggle.textContent === 'Show Very Advanced' && !document.getElementById('very-advanced-oam'), 'Very advanced did not collapse or update its label');
          }
          {
            const device = document.getElementById('l2-device');
            const original = device.value;
            for (const option of device.options) {
              device.value = option.value;
              device.dispatchEvent(new Event('change', { bubbles: true })); await tick();
              for (const side of ['left', 'right']) {
                expect(document.getElementById('l2-' + side + '-pfg-hint').textContent.includes('Not supported by this builder on 392x.') ===
                  option.value.includes('392x'), 'PFG limitation does not follow device selection');
              }
            }
            device.value = original;
            device.dispatchEvent(new Event('change', { bubbles: true })); await tick();
          }
          for (const endpoint of ['Left', 'Right']) {
            const endpointSelect = document.getElementById('l2-cfm-endpoint');
            endpointSelect.value = endpoint; endpointSelect.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            for (const direction of ['Up', 'Down']) {
              const directionSelect = document.getElementById('l2-cfm-direction');
              directionSelect.value = direction; directionSelect.dispatchEvent(new Event('change', { bubbles: true })); await tick();
              const instance = document.querySelector('#live-packet-walk .soam-instance');
              const exit = (endpoint === 'Left') === (direction === 'Down') ? '20' : '980';
              expect(instance?.dataset.endpoint === endpoint && instance?.dataset.direction === direction
                && instance.querySelector('[data-traffic="tx"]').getAttribute('d').endsWith('H' + exit),
                'SOAM path does not follow selected MEP orientation');
              const box = instance.querySelector('.soam-node').getBBox();
              const center = direction === 'Up' ? (endpoint === 'Left' ? 190 : 810) : 500;
              expect(box.x + box.width / 2 === center
                && instance.querySelector('.soam-binding').getAttribute('d') ===
                  'M' + (endpoint === 'Left' ? 340 : 660) + ',364 V370 H' + center + ' V377',
                'SOAM box position or FP binding is incorrect');
              const labels = [...instance.querySelectorAll('.soam-label')].map(node => node.getBBox());
              const labelTop = Math.min(...labels.map(label => label.y));
              const labelBottom = Math.max(...labels.map(label => label.y + label.height));
              expect(labels.length === 3 && labels.every(label => Math.abs(label.x + label.width / 2 - center) < 2)
                && Math.abs((labelTop + labelBottom) / 2 - (box.y + box.height / 2)) < 4,
                'SOAM labels are not centered within the box');
              for (const tag of instance.querySelectorAll('.soam-tags .chip rect')) {
                const chip = tag.getBBox();
                expect(chip.x + chip.width <= box.x || chip.x >= box.x + box.width,
                  'SOAM tag chip overlaps the repositioned box');
              }
              instance.dispatchEvent(new MouseEvent('click', { bubbles: true })); await tick();
              expect([...document.querySelectorAll('.code-line.is-highlighted')].some(line => line.textContent.includes('maintenance-domain')),
                'SOAM instance click did not highlight its config');
              instance.dispatchEvent(new MouseEvent('click', { bubbles: true })); await tick();
            }
          }
          document.getElementById('l2-cfm-enabled').click(); await tick();
          expect(!document.querySelector('.soam-instance'), 'Disabled SOAM remains visible');
          document.getElementById('l2-cfm-enabled').click(); await tick();
          expect(document.querySelector('.soam-instance'), 'Enabling SOAM did not create visualization');
          {
            const vlanLabel = () => document.querySelector('label[for="l2-left-vlan"]').textContent;
            const endpoint = document.getElementById('l2-cfm-endpoint');
            endpoint.value = 'Left'; endpoint.dispatchEvent(new Event('change', { bubbles: true })); await tick();
            expect(vlanLabel() === 'VLAN', 'VLAN label changed without All Tags');
            document.getElementById('l2-left-allTags').click(); await tick();
            expect(vlanLabel() === 'VLAN for Service OAM', 'All Tags + Service OAM VLAN label missing');
            document.getElementById('l2-left-allTags').click(); await tick();
          }
          for (const side of ['left', 'right']) {
            const options = document.getElementById('l2-' + side + '-untagged').closest('.vlan-options');
            const l2cp = document.getElementById('l2-' + side + '-l2cp');
            expect(options.contains(l2cp) && l2cp.getBoundingClientRect().top >
              document.getElementById('l2-' + side + '-untagged').closest('[data-field]').getBoundingClientRect().bottom,
              'L2CP is not beneath tag options and helper text');
          }
          expect(!document.getElementById('l2-l2-mtu'), 'MTU input visible while disabled');
          document.getElementById('l2-emitMtu').click(); await tick();
          const mtuInput = document.getElementById('l2-l2-mtu');
          expect(mtuInput?.tagName === 'INPUT' && mtuInput.previousElementSibling.textContent === 'L2 MTU Size'
            && document.getElementById('l2-emitMtu').closest('[data-field]').parentElement.contains(mtuInput),
            'L2 MTU Size field did not appear beneath checkbox');
          expect(!document.getElementById('l2-left-mtu') && !document.getElementById('l2-right-mtu'), 'Duplicate endpoint MTU fields remain');
          expect(mtuInput.closest('[data-field]').querySelector('.field-hint').textContent.includes('Max = 9800 Bytes. If <10.9.0, max = 9216.')
            && !document.getElementById('l2-emitMtu').closest('[data-field]').querySelector('.field-hint'),
            'MTU limit helper missing');
          nativeInput(mtuInput, '9500'); await tick();
          expect(['1', '2'].every(port => document.querySelector('.code-block').textContent.includes('logical-ports logical-port ' + port + ' mtu 9500')),
            'Custom MTU not reflected in both endpoint commands');
          expect(!document.getElementById('view').textContent.includes('Restore typical'), 'Restore typical action remains');
          nativeInput(mtuInput, '9801'); await tick();
          expect(document.querySelector('[role="alert"]') && document.querySelector('.output-panel .panel-heading button').disabled,
            'Invalid MTU is not blocked');
          nativeInput(mtuInput, '9500'); await tick();
          const mtuLink = document.querySelector('a[href="#/cheatsheet?section=mtu-sizes"]');
          expect(mtuLink?.textContent === 'MTU Details', 'MTU Details link missing');
          mtuLink.click();
          await waitUntil(() => {
            const section = document.getElementById('mtu-sizes');
            return section && Math.abs(section.getBoundingClientRect().top) < 150;
          }, 'MTU Details did not scroll to its section');
          const mtuSection = document.getElementById('mtu-sizes');
          expect([...document.querySelectorAll('.field-note-heading h2')].filter(h => h.textContent.endsWith('- MTU Sizes')).length === 1,
            'Duplicate MTU Sizes section remains');
          const mtuRows = [...mtuSection.querySelectorAll('tbody tr')].map(row => [...row.cells].map(cell => cell.textContent).join(':'));
          expect(JSON.stringify(mtuRows) === JSON.stringify(['5170:9660', '5171:9660', '8140:9600', '8180:9312',
            '8190:9600', '8192:9600', 'vRouter-BNG:1990', 'ALL others:9700']), 'MTU platform chart differs from requested values');
          nativeInput(document.querySelector('[aria-label="Search commands and notes"]'), '5170'); await tick();
          expect(document.getElementById('mtu-sizes')?.querySelector('table'), 'Platform chart cannot be found by search');
          await navigate('l2evc');
          expect(document.getElementById('l2-l2-mtu').value === '9500', 'MTU value not preserved after Details navigation');
          document.getElementById('l2-emitMtu').click(); await tick();
          expect(!document.getElementById('l2-l2-mtu') && !document.querySelector('.code-block').textContent.includes(' mtu '),
            'Disabling MTU output did not hide fields and commands');
          const formModes = document.querySelector('[aria-label="Detail level"]');
          const formLayouts = document.querySelector('[aria-label="Form layout"]');
          expect(formModes.parentElement === formLayouts.parentElement, 'Form layouts should share the header action row');
          expect(formModes.previousElementSibling.textContent.includes('Share settings')
            && formModes.nextElementSibling.textContent.includes('Reset'), 'Header actions are not ordered Share settings, Basic/Advanced, Reset');
          expect(!document.getElementById('l2-l2cpProfile') && !document.getElementById('l2-left-l2cpProfile'), 'L2CP profile visible before enabling endpoint');
          document.getElementById('l2-left-l2cp').click(); await tick();
          const profile = document.getElementById('l2-left-l2cpProfile');
          expect(profile && document.getElementById('l2-left-l2cp').closest('[data-field]').parentElement.contains(profile),
            'L2CP profile did not appear below endpoint checkbox');
          nativeInput(profile, 'MY_L2CP_PROFILE'); await tick();
          expect(document.querySelector('.code-block').textContent.includes('MY_L2CP_PROFILE'), 'L2CP profile edit did not regenerate output');
          document.getElementById('l2-left-l2cp').click(); await tick();
          expect(!document.getElementById('l2-left-l2cpProfile'), 'L2CP profile remains after disabling endpoint');
          const walkObject = id => document.querySelector('#live-packet-walk [data-obj="' + id + '"]');
          const clickObject = async id => {
            walkObject(id).dispatchEvent(new MouseEvent('click', { bubbles: true })); await tick();
          };
          const highlightedCommands = () => [...document.querySelectorAll('.code-line.is-highlighted')].map(line => line.textContent);
          walkObject('fd').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await tick();
          expect(highlightedCommands().length === 0, 'Packet walk still selects on hover');
          await clickObject('fd');
          expect(walkObject('fd').getAttribute('aria-pressed') === 'true'
            && highlightedCommands().some(text => text.includes('fds fd browser-l2')), 'Click did not select matching CLI');
          const pinned = JSON.stringify(highlightedCommands());
          document.querySelector('#live-packet-walk .diagram-host').dispatchEvent(new MouseEvent('mouseleave'));
          document.querySelector('.code-block').scrollIntoView(); await tick();
          const otherLine = [...document.querySelectorAll('.code-line')].find(line => !line.classList.contains('is-highlighted'));
          otherLine.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          otherLine.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
          const serviceField = document.getElementById('l2-serviceName').closest('[data-field]').parentElement;
          serviceField.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          serviceField.dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); await tick();
          expect(JSON.stringify(highlightedCommands()) === pinned, 'Scrolling or hovering replaced pinned CLI highlights');
          nativeInput(document.getElementById('l2-serviceName'), 'selected-l2'); await tick();
          expect(walkObject('fd').classList.contains('hl') && walkObject('fd').getAttribute('aria-pressed') === 'true'
            && highlightedCommands().some(text => text.includes('fds fd selected-l2')), 'Input redraw lost packet selection');
          nativeInput(document.getElementById('l2-serviceName'), 'browser-l2'); await tick();
          await clickObject('fp-left');
          expect(walkObject('fd').getAttribute('aria-pressed') === 'false'
            && highlightedCommands().some(text => text.includes('fps fp fp1_browser-l2')), 'Click did not replace selection');
          await clickObject('fp-left');
          expect(highlightedCommands().length === 0, 'Clicking selected object did not clear');
          for (const key of ['Enter', ' ']) {
            const object = walkObject('fd');
            object.focus();
            object.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); await tick();
            expect(highlightedCommands().length > 0 && object.getAttribute('aria-pressed') === 'true', 'Keyboard selection failed: ' + key);
            object.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
            expect(highlightedCommands().length === 0, 'Escape did not clear');
          }
          const layoutButtons = [...document.querySelectorAll('[aria-label="Form layout"] button')];
          for (const button of layoutButtons) {
            button.click(); await tick();
            expect(document.getElementById('l2-serviceName').value === 'browser-l2', 'L2 state lost on layout switch');
            await clickObject('fd');
            const expand = document.querySelector('#live-packet-walk button[aria-controls="packet-walk-diagram"]');
            expand.click(); await tick();
            const expanded = document.querySelector('.expanded-packet-walk');
            const form = document.querySelector('.builder-layout, .mirror-layout');
            expect(expanded && Math.abs(expanded.getBoundingClientRect().width - form.getBoundingClientRect().width) < 2,
              'Expanded packet walk does not fill the content width');
            expect(document.querySelectorAll('#live-packet-walk').length === 1
              && expanded.querySelector('.diagram-host svg'), 'Expanded packet walk is missing or duplicated');
            expect(walkObject('fd').getAttribute('aria-pressed') === 'true' && highlightedCommands().length > 0,
              'Expanding packet walk lost selection');
            expect(document.documentElement.scrollWidth <= innerWidth + 1, 'Expanded packet walk overflows viewport');
            const collapse = expanded.querySelector('button[aria-controls="packet-walk-diagram"]');
            expect(collapse.getAttribute('aria-expanded') === 'true' && collapse.textContent === 'Collapse',
              'Packet walk toggle does not reflect expansion');
            collapse.click(); await tick();
            expect(!document.querySelector('.expanded-packet-walk')
              && document.querySelector('.builder-results #live-packet-walk'), 'Packet walk did not return to results');
            expect(walkObject('fd').getAttribute('aria-pressed') === 'true', 'Collapsing packet walk lost selection');
            await clickObject('fd');
          }
          const shared = JSON.parse(localStorage.getItem('snl-l2evc-state'));
          for (const key of ${JSON.stringify(Object.keys(CFM_EXTRA_DEFAULTS))}) delete shared.cfm[key];
          shared.serviceName = 'shared-service';
          shared.cfm.lossResponder = 'false';
          shared.cfm.mdPermission = 'chassisManage';
          shared.cfm.dmmRemoteMac = '02:00:00:00:01:01';
          shared.cfm.slmRemoteMac = '02:00:00:00:02:01';
          shared.cfm.dmmRemoteMep = '7';
          shared.cfm.slmRemoteMep = '8';
          const macNoticesBeforeShare = notifications.filter(message => message.includes('Removed unsupported DMM/SLM MAC targets')).length;
          const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(shared))));
          location.hash = '#/l2evc?s=' + encoded; await tick(); await tick();
          expect(document.getElementById('l2-serviceName').value === 'shared-service', 'Same-route shared link did not load');
          expect(JSON.parse(localStorage.getItem('snl-l2evc-state')).cfm.slmAvailabilityInterval === '15',
            'Old shared settings did not gain Very advanced defaults');
          expect(!Object.hasOwn(JSON.parse(localStorage.getItem('snl-l2evc-state')).cfm, 'lossResponder')
            && JSON.parse(localStorage.getItem('snl-l2evc-state')).cfm.mdPermission === 'chassis-manage',
            'Legacy OAM overrides did not migrate to supported configuration');
          const migratedShared = JSON.parse(localStorage.getItem('snl-l2evc-state')).cfm;
          expect(!Object.hasOwn(migratedShared, 'dmmRemoteMac') && !Object.hasOwn(migratedShared, 'slmRemoteMac')
            && migratedShared.dmmRemoteMep === '7' && migratedShared.slmRemoteMep === '8',
            'Shared MAC targets were not removed while preserving per-session MEP IDs');
          expect(notifications.filter(message => message.includes('Removed unsupported DMM/SLM MAC targets')).length > macNoticesBeforeShare,
            'Shared MAC-target migration was silent');
          expect(!document.querySelector('.code-block').textContent.includes('remote-mac-address')
            && document.querySelector('.code-block').textContent.includes('remote-mep-id 7')
            && document.querySelector('.code-block').textContent.includes('remote-mep-id 8'),
            'Migrated shared settings did not generate Remote MEP ID targets');
          expect(document.querySelector('.code-block').textContent.includes('shared-service'), 'Shared input did not regenerate commands');
          await navigate('design');
          expect(location.hash === '#/l2evc', 'Legacy Visual lab route did not redirect to the L2 builder');
          expect(!document.querySelector('.layout-examples'), 'Removed layout mockups remain in the L2 builder');
          const tabs = [...document.querySelectorAll('[aria-label="Visualization"] button')];
          expect(![...document.querySelectorAll('.output-panel [role="tab"]')].some(tab => tab.textContent.includes('Workbook'))
            && !document.querySelector('.output-panel').textContent.includes('Workbook-compat'),
            'L2 Workbook tab or compatibility mode remains');
          for (const label of ['Object maps', 'Frame Encapsulation', 'Packet walk']) {
            tabs.find(button => button.textContent === label).click(); await tick();
            expect(document.querySelector('.diagram-host').childElementCount > 0, 'Empty visualization: ' + label);
            const visualPanel = document.querySelector(label === 'Packet walk' ? '#live-packet-walk' : '#live-visualization');
            expect(visualPanel?.querySelector('button[aria-controls]')
              && ![...visualPanel.querySelectorAll('button')].some(button => button.textContent === 'Clear selection'),
            'Expand control missing or removed Clear selection remains: ' + label);
            expect(![...document.querySelectorAll('.panel-heading .badge')].some(badge =>
              ['BASIC', 'INTERMEDIATE', 'ADVANCED', '3D'].includes(badge.textContent.trim())),
            'Visualization category badge remains: ' + label);
            if (label === 'Frame Encapsulation') {
              const controls = visualPanel.querySelector('.row');
              expect(controls.textContent.includes('Left >>> Right') && controls.textContent.includes('Left <<< Right')
                && controls.textContent.includes('Play') && controls.textContent.includes('<<')
                && controls.textContent.includes('>>') && !/[·←→▶◀❚]/u.test(controls.textContent),
              'Frame controls use non-ASCII labels');
              const stage = document.querySelector('[aria-label="Frame encapsulation step"]');
              expect(stage && stage.options.length === 6, 'Frame encapsulation stage selector is missing its six stages');
              stage.value = '3'; stage.dispatchEvent(new Event('change', { bubbles: true })); await tick();
              expect(document.querySelector('.frame-cap').textContent.includes('4/6'), 'Direct frame stage selection did not update the current step');
              const play = [...controls.querySelectorAll('button')].find(button => button.textContent === 'Play');
              play.click(); await tick();
              expect(play.textContent === 'Pause', 'Frame playback did not use the ASCII Pause label');
              play.click(); await tick();
              expect(play.textContent === 'Play', 'Frame playback did not return to the ASCII Play label');
            }
          }
          for (const [label, id] of [['Object maps', 'map-diagram'], ['Frame Encapsulation', 'frame-diagram']]) {
            [...document.querySelectorAll('[aria-label="Visualization"] button')].find(button => button.textContent === 'Packet walk').click(); await tick();
            await clickObject('fd');
            [...document.querySelectorAll('[aria-label="Visualization"] button')].find(button => button.textContent === label).click(); await tick();
            const panel = document.querySelector('#live-visualization');
            if (label === 'Object maps') {
              const mapObject = obj => panel.querySelector('[data-obj="' + obj + '"]');
              expect(highlightedCommands().length === 0 && !panel.querySelector('[data-obj].hl'),
                'Switching to Object maps retained selection');
              mapObject('fd').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); await tick();
              expect(highlightedCommands().length === 0 && !panel.querySelector('[data-obj].hl'), 'Object map still highlights on hover');
              mapObject('fd').dispatchEvent(new MouseEvent('click', { bubbles: true })); await tick();
              expect(mapObject('fd').getAttribute('aria-pressed') === 'true'
                && mapObject('fd').classList.contains('hl')
                && highlightedCommands().some(text => text.includes('fds fd shared-service')), 'Object map click did not highlight matching CLI');
              mapObject('fp-left').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              panel.querySelector('.diagram-host').dispatchEvent(new MouseEvent('mouseleave')); await tick();
              expect(mapObject('fd').classList.contains('hl') && !mapObject('fp-left').classList.contains('hl'),
                'Object map hover or mouseleave changed selection');
              nativeInput(document.getElementById('l2-serviceName'), 'map-selected'); await tick();
              expect(mapObject('fd').classList.contains('hl')
                && highlightedCommands().some(text => text.includes('fds fd map-selected')), 'Object map redraw lost selection');
              nativeInput(document.getElementById('l2-serviceName'), 'shared-service'); await tick();
              mapObject('fp-left').dispatchEvent(new MouseEvent('click', { bubbles: true })); await tick();
              expect(!mapObject('fd').classList.contains('hl') && mapObject('fp-left').classList.contains('hl'), 'Object map click did not replace selection');
              mapObject('fp-left').dispatchEvent(new MouseEvent('click', { bubbles: true })); await tick();
              expect(highlightedCommands().length === 0 && !panel.querySelector('[data-obj].hl'), 'Object map second click did not clear selection');
              for (const key of ['Enter', ' ']) {
                mapObject('fd').focus();
                mapObject('fd').dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); await tick();
                expect(mapObject('fd').getAttribute('aria-pressed') === 'true', 'Object map keyboard selection failed: ' + key);
                mapObject('fd').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
                expect(highlightedCommands().length === 0 && !panel.querySelector('[data-obj].hl'), 'Object map Escape did not clear');
              }
              mapObject('fd').dispatchEvent(new MouseEvent('click', { bubbles: true })); await tick();
            } else {
              expect(document.querySelector('.frame-cap').textContent.includes('1/6')
                && highlightedCommands().some(text => text.includes('fps fp fp1_shared-service'))
                && !highlightedCommands().some(text => text.startsWith('fds fd')), 'Previous diagram selection blocked frame stage highlighting');
            }
            const expand = panel.querySelector('button[aria-controls="' + id + '"]');
            expect(expand && expand.textContent.includes('Expand'), 'Expand control missing for ' + label);
            expand.click(); await tick();
            const expanded = document.querySelector('.expanded-packet-walk');
            expect(expanded?.querySelector('#' + id + ' .diagram-host'), 'Expanded diagram missing for ' + label);
            if (label === 'Object maps') expect(expanded.querySelector('[data-obj="fd"]').getAttribute('aria-pressed') === 'true',
              'Expanding Object maps lost selection');
            const collapse = expanded.querySelector('button[aria-controls="' + id + '"]');
            expect(collapse?.getAttribute('aria-expanded') === 'true' && collapse.textContent.includes('Collapse'),
              'Collapse control missing for ' + label);
            collapse.click(); await tick();
            expect(!document.querySelector('.expanded-packet-walk') && document.querySelector('#live-visualization #' + id),
              'Collapse did not restore ' + label);
          }
          await navigate('login');
          const checkGuideComments = () => {
            const notes = [...document.querySelectorAll('.prose .guide-comment')];
            expect(notes.length > 0, 'Hash-prefixed guide notes missing');
            for (const note of notes) {
              expect(note.textContent.trimStart().startsWith('#') && !note.matches('code'), 'Entire guide comment is still code');
              for (const example of note.querySelectorAll('code')) {
                expect(getComputedStyle(example).fontFamily === getComputedStyle(document.querySelector('code')).fontFamily,
                  'Embedded comment example is not fixed-width');
                expect(getComputedStyle(example).fontFamily !== getComputedStyle(note).fontFamily,
                  'Embedded example uses the surrounding prose font');
                expect(!example.textContent.includes('\u0060'), 'Formatting markers leaked into embedded comment example');
              }
              const row = note.closest('li');
              expect(!row || getComputedStyle(row).listStyleType === 'none', 'Guide comment retains a bullet');
              expect(getComputedStyle(note).fontFamily === getComputedStyle(note.closest('.prose')).fontFamily,
                'Guide comment is not proportional-font prose');
            }
            expect([...document.querySelectorAll('.prose .command-list code, .prose code.cmd')].every(code =>
              !code.textContent.trimStart().startsWith('#')), 'Hash-prefixed guide line remains fixed-width');
          };
          checkGuideComments();
          expect(document.querySelector('.guide-comment code.inline-example')?.textContent === 'mgmtbr0',
            'Initial Login comment example is not marked as code');
          expect(document.querySelector('.prose .cli code'), 'Guide CLI blocks missing');
          expect(!document.querySelector('.prose pre') && document.querySelector('.prose ul.command-list li code'),
            'Initial Login still embeds code boxes instead of command bullets');
          const loginSections = [...document.querySelectorAll('.prose details.login-section')];
          expect(loginSections.length > 4 && loginSections.every(node => !node.open), 'Initial Login sections are not all collapsed by default');
          const loginHeadingsWithoutCopy = [
            'Console Cable Type and Terminal Settings, per platform', 'Console Cable Notes', 'No Console/USB Cable?',
            '[392x] Initial IP Configs for Management',
            '[393x, 394x, 398x, 51xx, 81xx] Initial IP Configs for Management',
          ];
          expect(loginSections.filter(node => loginHeadingsWithoutCopy.includes(node.querySelector(':scope > summary').firstChild.textContent)).length === 5
            && !document.querySelector('.prose button.copy') && loginSections.every(node => {
              const summary = node.querySelector(':scope > summary');
              return loginHeadingsWithoutCopy.includes(summary.firstChild.textContent)
                ? !summary.querySelector('button') : Boolean(summary.querySelector('button.section-copy svg'));
            }), 'Login removed the wrong section-header copy controls');
          const initialIp = loginSections.filter(node => node.querySelector(':scope > summary').textContent.includes('Initial IP'));
          expect(initialIp.length === 2 && initialIp.every(node => node.querySelectorAll(':scope > details').length === 2),
            'Inband/out-of-band subsections are not nested under each Initial IP section');
          initialIp[0].querySelector(':scope > summary').click(); await tick();
          expect(initialIp[0].open && [...initialIp[0].querySelectorAll('details')].every(node => !node.open), 'Opening parent also opened child subsections');
          initialIp[0].querySelector(':scope > details > summary').click(); await tick();
          expect(initialIp[0].querySelector('details').open, 'Management subsection cannot be expanded independently');
          const tocTarget = document.querySelector('.document-toc a');
          tocTarget.click(); await tick();
          expect(document.getElementById(tocTarget.getAttribute('href').slice(1)).open, 'Table of contents did not open collapsed section');
          const fillInPanel = document.querySelector('.placeholder-panel');
          expect(!fillInPanel.open, 'Initial Login Fill-in values must start collapsed');
          fillInPanel.querySelector('summary').click(); await tick();
          expect(fillInPanel.open, 'Initial Login Fill-in values cannot be expanded');
          const placeholder = document.querySelector('.placeholder-panel input');
          expect(placeholder, 'Placeholder inputs missing');
          const loginPlaceholderNames = [...document.querySelectorAll('.placeholder-panel label')].map(label => label.textContent);
          expect(loginPlaceholderNames.includes('<VLAN#>') && loginPlaceholderNames.includes('<PORT#>'),
            'Initial Login VLAN and port fill-in parameters are missing');
          expect(loginPlaceholderNames.indexOf('<PORT#>') < loginPlaceholderNames.indexOf('<VLAN#>'),
            'VLAN fill-in value should follow the port value');
          expect(loginPlaceholderNames.includes('<IP-ADDRESS>') && !loginPlaceholderNames.includes('<IPV4-ADDRESS>'),
            'Initial Login address placeholders are not consolidated');
          expect(!initialIp[1].textContent.split('\\n').some(line => line.trim() === '#'),
            'Standalone # remains in 393x+ management config');
          nativeInput(placeholder, 'browser-value'); await tick();
          expect(fillInPanel.open && document.querySelector('.prose').textContent.includes('browser-value'),
            'Editing a placeholder did not update commands or keep Fill-in values expanded');
          await navigate('golden');
          checkGuideComments();
          expect(document.querySelector('.page-heading .lead').textContent.startsWith('Ciena Solution Architect recommended baseline configurations'),
            'Golden Config introduction has not been updated');
          const checkConciseTitles = () => {
            for (const title of document.querySelectorAll('.field-note-heading h2')) {
              const words = title.textContent.replace(/^#\\d+ - /, '').trim().split(/\\s+/);
              expect(words.length <= 7, 'Guide section heading exceeds seven words: ' + title.textContent);
            }
            const descriptions = [...document.querySelectorAll('.guide-section-description')];
            expect(descriptions.length > 5, 'Long section details were not moved below their titles');
            for (const description of descriptions) {
              expect(description.tagName === 'P' && getComputedStyle(description).fontFamily === getComputedStyle(description.closest('.prose')).fontFamily
                && getComputedStyle(description).fontWeight === getComputedStyle(description.closest('.prose')).fontWeight,
                'Long section details are not normal-font body text');
              expect(description.closest('.field-note-section').querySelector('.field-note-heading').compareDocumentPosition(description)
                & Node.DOCUMENT_POSITION_FOLLOWING, 'Section details are not below the title');
            }
          };
          checkConciseTitles();
          expect([...document.querySelectorAll('.guide-comment code.inline-example')].some(code => code.textContent === 'idle-time-interval'),
            'Golden Config parameter example is not marked as code');
          const manualDateLabel = [...document.querySelectorAll('.placeholder-panel label')].find(label => label.textContent === '<MANUAL_DATETIME>');
          const insertDate = [...document.querySelectorAll('.placeholder-panel button')].find(button => button.textContent.includes('Insert current date/time'));
          expect(manualDateLabel && insertDate, 'Manual date/time field or insert button is missing');
          insertDate.click(); await tick();
          const manualDate = document.getElementById(manualDateLabel.htmlFor).value;
          expect(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$/.test(manualDate),
            'Insert current date/time did not use the SAOS clock format');
          expect(!document.querySelector('.placeholder-panel label')?.textContent.includes('<FORMAT_BELOW>'),
            'Old date/time placeholder remains');
          const goldenPlaceholderLabels = [...document.querySelectorAll('.placeholder-panel label')].map(label => label.textContent);
          expect(goldenPlaceholderLabels.includes('<BACKUP-SERVER-USERNAME>')
            && goldenPlaceholderLabels.includes('<BACKUP-SERVER-PASSWORD>')
            && goldenPlaceholderLabels.includes('<BACKUP-SERVER-IP>')
            && !goldenPlaceholderLabels.includes('<FP_name>'),
            'Backup credentials should be fill-ins, but the flow-point example should remain literal: ' + goldenPlaceholderLabels.join(', '));
          const backupSection = [...document.querySelectorAll('.field-note-section')].find(section =>
            section.textContent.includes('Auto-Backup Config and SW/HW Details'));
          expect(backupSection?.textContent.includes('sftp://<BACKUP-SERVER-IP>/sw-images/backups')
            && backupSection.textContent.includes('username "<BACKUP-SERVER-USERNAME>" password "<BACKUP-SERVER-PASSWORD>"')
            && !backupSection.textContent.includes('username "ubuntu"'), 'Backup config placeholders are incorrect');
          const goldenDownload = [...document.querySelectorAll('button')].find(button => button.textContent === 'Download selected .txt');
          const buildPanel = goldenDownload.closest('.panel');
          expect(buildPanel.compareDocumentPosition(document.querySelector('.placeholder-panel')) & Node.DOCUMENT_POSITION_FOLLOWING,
            'Build panel is not above fill-in values');
          expect(buildPanel.textContent.includes('Common day-one configs') && !buildPanel.textContent.includes('No config/exit wrapper'),
            'Build panel introduction not consolidated');
          const include = title => [...document.querySelectorAll('input[type="checkbox"]')].find(input => input.getAttribute('aria-label') === 'Include ' + title);
          const goldenSections = [...document.querySelectorAll('.field-note-heading h2')];
          expect(!document.querySelector('.prose pre') && document.querySelector('.prose ul.command-list li code'),
            'Golden Configs still embeds code boxes instead of command bullets');
          expect(!document.querySelector('.prose button.copy')
            && document.querySelectorAll('.field-note-heading button svg').length === goldenSections.length,
            'Golden configs still have per-block copy controls or missing icons');
          expect(document.querySelectorAll('input[type="checkbox"][aria-label^="Include "]').length === goldenSections.length,
            'Not every golden config section has a checkbox');
          expect([...document.querySelectorAll('input[aria-label^="Include "]')].every(input =>
            input.parentElement.classList.contains('field-note-heading') && input.nextElementSibling.tagName === 'H2'),
            'Golden checkbox is not directly before section header');
          expect(!document.querySelector('#view').textContent.includes('Include this section'), 'Old checkbox text remains');
          expect(goldenDownload.disabled, 'Empty selection can be downloaded');
          include('SSH Session Inactivity Timer').click(); await tick();
          include('System Hostname').click(); await tick();
          expect(!goldenDownload.disabled && !document.querySelector('.panel [role="alert"]'), 'Unfilled selected placeholder blocks the download');
          expect(document.querySelector('.panel details pre')?.textContent.includes('system config hostname <HOSTNAME>'),
            'Unfilled placeholder is not kept as <NAME> in the combined text');
          const hostnameLabel = [...document.querySelectorAll('.placeholder-panel label')].find(label => label.textContent === '<HOSTNAME>');
          nativeInput(document.getElementById(hostnameLabel.htmlFor), 'customer-nid'); await tick();
          expect(!goldenDownload.disabled, 'Filled selection cannot be downloaded');
          expect(!include('Common IP-BFD Profiles') && !include('MTU for releases before 10.9.0 (use 9216)'),
            'IP-BFD profiles or the pre-10.9.0 MTU section are still golden configs');
          expect(include('QoS Bandwidth Calculation Mode')?.closest('.field-note-section').textContent.includes('only calc Ethernet Payload'),
            'QoS bandwidth calculation is not its own section with its description');
          include('Going into "config" mode and exiting').click(); await tick();
          const offloadTitle = '3926/3928 Offload Port Preparation';
          const offloadSection = document.querySelector('[aria-label="Include ' + offloadTitle + '"]').closest('.field-note-section');
          expect(offloadSection.querySelector('.guide-section-description').textContent.startsWith('For 3926 and 3928'),
            'Original offload heading details were lost');
          include(offloadTitle).click(); await tick();
          let capturedBlob;
          let capturedName;
          const createUrl = URL.createObjectURL;
          const anchorClick = HTMLAnchorElement.prototype.click;
          URL.createObjectURL = blob => { capturedBlob = blob; return createUrl.call(URL, blob); };
          HTMLAnchorElement.prototype.click = function () {
            if (this.download === 'saos10-golden-config.txt') capturedName = this.download;
            else anchorClick.call(this);
          };
          try { goldenDownload.click(); } finally {
            URL.createObjectURL = createUrl;
            HTMLAnchorElement.prototype.click = anchorClick;
          }
          expect(capturedName === 'saos10-golden-config.txt', 'Combined config download not triggered');
          const goldenText = await capturedBlob.text();
          expect(goldenText.includes('# System Hostname\\n\\nsystem config hostname customer-nid'), 'Header or filled command missing from download');
          expect(goldenText.includes('# SSH Session Inactivity Timer\\n\\nsystem ssh-server config timeout 600'), 'Second selected section missing');
          expect(goldenText.indexOf('# System Hostname') < goldenText.indexOf('# SSH Session Inactivity Timer'), 'Download follows click order, not page order');
          expect(!goldenText.includes('motd-banner') && !goldenText.includes('snmp agent'), 'Unselected commands leaked into download');
          expect(goldenText.startsWith('config\\n') && goldenText.endsWith('\\nexit\\n')
            && !goldenText.includes('<your config commands>'), 'Selected config-mode section did not wrap the download');
          expect(goldenText.includes('# Step1: Remove any FPs') && goldenText.includes('# Step3:'), 'Manual instructions not preserved as comments');
          expect(!goldenText.includes('<span') && !goldenText.includes('Copy') && !goldenText.includes('\u0060'),
            'HTML, copy buttons or formatting markers leaked into download');
          expect(goldenText.includes('"show flow-points" then "no fps fp <<FP_name>>"'),
            'Flow-point placeholder changed in the plain-text download');
          [...document.querySelectorAll('button')].find(button => button.textContent === 'Clear selection').click(); await tick();
          expect(goldenDownload.disabled && !document.querySelector('input[aria-label^="Include "]:checked'), 'Clear selection failed');
          include('Going into "config" mode and exiting').click(); await tick();
          expect(document.querySelector('.panel pre').textContent.includes('# config')
            && !document.querySelector('.panel pre').textContent.startsWith('config'),
            'Config mode selected alone should remain a commented example');
          [...document.querySelectorAll('button')].find(button => button.textContent === 'Clear selection').click(); await tick();
          include('Timing - NTP').click(); await tick();
          const ntpSection = document.querySelector('[aria-label="Include Timing - NTP"]').closest('.field-note-section');
          const manualTimingSection = document.querySelector('[aria-label="Include Timing - Manual"]').closest('.field-note-section');
          expect(ntpSection.textContent.includes('system ntp admin-state enabled')
            && !ntpSection.textContent.includes('system ntp admin-state disabled')
            && manualTimingSection.textContent.includes('system ntp admin-state disabled')
            && manualTimingSection.textContent.includes('system set clock 2027-01-15T22:25:01Z'),
          'Manual timing commands were not split into their own Golden Config section');
          const ntpLabel = [...document.querySelectorAll('.placeholder-panel label')].find(label => label.textContent === '<NTP-SERVER-IP>');
          nativeInput(document.getElementById(ntpLabel.htmlFor), '192.0.2.1'); await tick();
          expect(!goldenDownload.disabled, 'Placeholders in commented guidance incorrectly block download');
          const cfmGlobal = document.querySelector('[aria-label="Include CFM Global Configuration"]').closest('.field-note-section');
          expect(cfmGlobal.textContent.includes('NOTE: Required before creating L2 Service with Service OAM (CCM, DMM, SLM)')
            && !cfmGlobal.textContent.includes('Navigator/MCP'), 'Service OAM prerequisite description did not change');
          expect(document.querySelector('[aria-label="Include Disable Unused PTP"]').closest('.field-note-section')
            .textContent.includes("If command errors, platform probably doesn't support PTP."), 'PTP platform hint missing');
          await navigate('terms');
          expect(!document.querySelector('.placeholder-panel'), 'Fundamentals still shows fill-in values');
          expect(!document.querySelector('.prose button'), 'Fundamentals still shows Copy buttons');
          expect(!document.querySelector('[aria-label="Fundamentals source"]')
            && document.querySelector('#view').textContent.includes('ciena/saos-labs')
            && !document.querySelector('#view').textContent.includes('F0'),
            'F0 terminology remains on the Fundamentals page');
          {
            const originalTheme = document.documentElement.dataset.theme;
            const images = [...document.querySelectorAll('.prose img')];
            expect(images.length === 2, 'Fundamentals object diagrams missing');
            for (const theme of ['dark', 'light']) {
              document.documentElement.dataset.theme = theme; await tick();
              for (const image of images) {
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0);
                const pixels = context.getImageData(0, 0, canvas.width, 75).data;
                const expected = theme === 'dark' ? [237, 237, 237] : [23, 32, 51];
                let matches = 0;
                for (let index = 0; index < pixels.length; index += 4) {
                  if (pixels[index + 3] > 250 && expected.every((value, channel) => pixels[index + channel] === value)) matches++;
                }
                expect(matches > 100, 'Fundamentals diagram title does not follow ' + theme + ' theme: ' + image.alt);
              }
            }
            document.documentElement.dataset.theme = originalTheme; await tick();
          }
          expect(!document.querySelector('[aria-label="Fundamentals source"]')
            && !document.querySelector('.prose').textContent.includes('Key SAOS Terms'),
          'Workbook glossary remains on the Fundamentals page');
          await navigate('cheatsheet');
          checkGuideComments();
          {
            const zabbix = [...document.querySelectorAll('.field-note-section')].find(section =>
              section.textContent.includes('Zabbix Template: Ciena SAOS 10 by SNMP'));
            expect(zabbix?.textContent.includes('SNMPv2c or SNMPv3 polling')
              && zabbix.textContent.includes('Zabbix 7.0') && zabbix.textContent.includes('Zabbix 7.4')
              && zabbix.querySelector('a[href*="community-templates/pull/880"]')
              && zabbix.textContent.includes('snmp notify zabbixNotify type trap tag zabbixTrapTag')
              && zabbix.textContent.includes('do not install Ciena MIBs'),
            'SAOS10 Zabbix template guide is incomplete');
            expect(!document.querySelector('[id^="saos10-software-upgrade-using-pc-sftp-client"]'),
              'Shell-dependent PC SFTP upgrade remains');
            const allowedShellSections = ['if-tac-requests-a-state-dump', 'manual-node-specific-license-sequence'];
            expect(!document.getElementById('enable-saos10-device-for-statedump-sftp-download')
              && ![...document.querySelectorAll('.field-note-heading h2')].some(node => node.textContent.endsWith('Configuration Output Formats')),
              'Archived statedump SFTP or output-format section remains');
            expect(allowedShellSections.every(id => document.getElementById(id)),
              'One or more approved shell-command sections are missing');
          }
          expect(!document.querySelector('.page-heading').textContent.includes('Workbook commands'),
            'Removed cheatsheet wording remains');
          checkConciseTitles();
          expect(!document.querySelector('.placeholder-panel'), 'CLI field notes still shows fill-in values');
          expect(!document.querySelector('.field-note-section pre'), 'CLI field notes still embeds code boxes');
          expect([...document.querySelectorAll('.field-note-section .prose li')].filter(item => !item.querySelector('code')).every(item =>
            getComputedStyle(item).listStyleType === 'none'), 'Prose-only line still has a bullet');
          const basics = document.querySelector('[id^="the-basics"]');
          expect(basics && !basics.querySelector('pre') && basics.querySelectorAll('li code.cmd').length >= 15,
            'Basics is not a bulleted fixed-width command section');
          for (const section of document.querySelectorAll('.field-note-section')) {
            expect(section.querySelectorAll('button[aria-label^="Copy "]').length === 1
              && !section.querySelector('button.copy'), 'Section has per-line or duplicate copy buttons');
            expect(section.querySelector('.field-note-heading button svg'), 'Field-note Copy icon missing');
          }
          const routing = document.getElementById('popular-routing-commands');
          expect(routing && /^#\\d+ - Popular Routing Commands$/.test(routing.querySelector('.field-note-heading h2').textContent),
            'Nested routing header is not an independent section');
          const routingTitle = routing.querySelector('h2').textContent;
          const vlanClassification = [...document.querySelectorAll('.field-note-section')].find(section =>
            section.querySelector('.field-note-heading h2').textContent.endsWith('VLAN and QinQ Classification'));
          expect(vlanClassification, 'VLAN/QinQ guidance is not its own summarized section');
          expect(vlanClassification.id === 'advanced-details-about-vlan-and-qinq-classifying-aka-assigning-a-port-39-s-vlan-s-to-a-flow-point-fp-and-attaching-it-to-the-forwarding-domain-fd',
            'VLAN/QinQ section does not retain its source-heading anchor');
          expect(vlanClassification.querySelector('.guide-section-description').textContent.startsWith('Advanced Details about VLAN and QinQ Classifying'),
            'Full VLAN/QinQ section title was not retained below its summary');
          expect(vlanClassification.textContent.includes('CVID bundling is achieved')
            && vlanClassification.textContent.includes('VLAN-tagged classifiers are categorized'),
            'VLAN/QinQ guidance content is not grouped into its section');
          expect(!document.getElementById('saos10-port-packet-capture-haldebug-mirror-tcpdump-procedure-2026-0826'),
            'Shell-dependent packet capture section remains');
          expect(!['command-list-quick', 'notes-on-haldebug-mirror', 'notes-on-tcpdump', 'additional-tcpdump-samples',
            'finding-the-pcap-file-for-transfer', 'transfer-opt-1-upload-the-pcap-file-to-your-scp-server',
            'transfer-opt-2-download-the-pcap-file-from-your-pc-scp-client-e-g-winscp']
            .some(id => document.getElementById(id)), 'Packet capture subheaders still create separate sections');
          const numbered = [...document.querySelectorAll('.field-note-heading h2')].map(node => node.textContent).filter(text => /^#\\d+/.test(text));
          expect(numbered.every((text, index) => text.startsWith('#' + (index + 1) + ' -')), 'Built-in section numbers are not sequential');
          expect(document.querySelector('[id^="if-tac-requests-a-state-dump"]'), 'Upgrade subheading was not split into its own section');
          const heading = routing.querySelector('.field-note-heading');
          expect(heading.querySelector('button').getBoundingClientRect().left >= heading.querySelector('h2').getBoundingClientRect().right,
            'Copy button is not to the right of the header');
          let copiedSection;
          const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
          const originalExecCommand = document.execCommand;
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copiedSection = text; } } });
          document.execCommand = action => {
            if (action === 'copy') { copiedSection = document.querySelector('textarea[style*="position"]').value; return true; }
            return originalExecCommand.call(document, action);
          };
          try {
            const downloadNote = [...document.querySelectorAll('.guide-comment')].find(note => note.textContent.includes('After starting the download'));
            expect(downloadNote && [...downloadNote.querySelectorAll('code')].map(code => code.textContent).join('|') === 'show soft|log monitor troubleshoot',
              'Cheatsheet command examples are not fixed-width within prose');
            const noteSection = downloadNote.closest('.field-note-section');
            const noteTitle = noteSection.querySelector('.field-note-heading h2').textContent;
            noteSection.querySelector('.field-note-heading button').click(); await tick();
            expect(copiedSection.startsWith(noteTitle) && copiedSection.includes(downloadNote.textContent)
              && !copiedSection.includes('\u0060')
              && !copiedSection.includes('\\nshow soft\\nlog monitor troubleshoot'),
              'Copy omitted the section header/comment or duplicated embedded examples');
            basics.querySelector('.field-note-heading button').click(); await tick();
            expect(copiedSection.startsWith(basics.querySelector('.field-note-heading h2').textContent)
              && copiedSection.includes('show software') && copiedSection.includes('Use the credentials supplied for your platform'),
            'Section copy omitted its header, comments, or commands');
            const savedBackup = document.getElementById('backup-compare-config-changes');
            const fixedWidthLines = [...savedBackup.querySelectorAll('code.cmd')].filter(code =>
              code.textContent === 'config backup filename <NAME>');
            const commandFont = getComputedStyle(document.querySelector('.field-note-section .command-list code')).fontFamily;
            expect(fixedWidthLines.length === 1 && fixedWidthLines.every(code =>
              getComputedStyle(code).fontFamily === commandFont),
            'Retained backup command is missing or not fixed-width');
            expect(![...document.querySelectorAll('.field-note-heading h2')]
              .some(heading => heading.textContent.includes('Restore the Default Password')),
            'Default password example remains in the Cheatsheet');
            const bfd = [...document.querySelectorAll('.field-note-section')].find(section =>
              section.querySelector('.field-note-heading h2').textContent.endsWith('Common IP-BFD Profiles'));
            expect(bfd?.textContent.includes('bfd profiles ip-bfd-profile Profile-10ms'), 'IP-BFD profiles missing from the cheatsheet');
            await navigate('login');
            expect(![...document.querySelectorAll('button')].some(button => button.textContent === 'Download .txt'),
              'Initial Login still has a download button');
            const management = [...document.querySelectorAll('.login-section')].find(node =>
              node.querySelector(':scope > summary').textContent.includes('Initial IP'));
            const child = management.querySelector(':scope > details');
            child.querySelector(':scope > summary > button').click(); await tick();
            expect(!management.open && !child.open, 'Copying a collapsed login section toggled an accordion');
            expect(copiedSection === [...child.querySelectorAll('.cli code, code.cmd, .guide-comment')].filter(node => !node.parentElement.closest('.guide-comment')).map(node => node.textContent).join('\\n'),
              'Login section copy has wrong commands');
            expect(!management.querySelector(':scope > summary > button') && !document.querySelector('.placeholder-panel').open,
              'Management parent copy remains or saved Fill-in values no longer start collapsed');
            await navigate('golden');
            document.querySelector('[aria-label="Copy System Hostname"]').click(); await tick();
            expect(copiedSection === 'system config hostname customer-nid', 'Golden section copy did not apply fill-in values');
            const oldSharedIp = { ...legacyIp, name: 'legacy-shared-ip' };
            location.hash = '#/l3ip?s=' + btoa(unescape(encodeURIComponent(JSON.stringify(oldSharedIp))));
            await waitUntil(() => document.getElementById('name')?.value === oldSharedIp.name, 'Legacy IP share link did not load');
            document.querySelector('[aria-label="Detail level"] [data-mode="advanced"]').click(); await tick();
            expect(document.getElementById('role').value === 'Data'
              && JSON.parse(localStorage.getItem('snl-l3ip-state')).role === 'Data', 'Legacy IP share link did not default to Data');
            for (const [route, storage, expectedName] of [['l3ip', 'l3ip-state', 'shared-ip'], ['sat', 'sat-state', 'shared-sat']]) {
              await navigate(route);
              if (route === 'sat') {
                const testMode = document.getElementById('mode');
                expect([...testMode.options].map(option => option.value).join(',') === 'in-service,evc-out-of-service'
                  && document.getElementById('mode-hint').textContent
                    === "NOTE: To avoid disabling shared ports, 'Out-of-Service' mode is only available via CLI.",
                'SAT Test mode options or shared-port safety note are incorrect');
              }
              nativeInput(document.getElementById('name'), expectedName); await tick();
              [...document.querySelectorAll('button')].find(button => button.textContent === 'Share settings').click(); await tick();
              expect(copiedSection.includes('#/' + route + '?s='), 'Creator share link missing: ' + route);
              const shareLink = copiedSection;
              const payload = JSON.parse(decodeURIComponent(escape(atob(shareLink.split('?s=')[1]))));
              expect(payload.name === expectedName, 'Share link omitted current settings: ' + route);
              nativeInput(document.getElementById('name'), 'temporary-name'); await tick();
              location.hash = shareLink.split('#')[1]; await tick(); await tick();
              expect(document.getElementById('name').value === expectedName
                && JSON.parse(localStorage.getItem('snl-' + storage)).name === expectedName,
                'Same-route share link did not load and persist: ' + route);
              location.hash = '#/' + route + '?s=invalid'; await tick(); await tick();
              expect(document.getElementById('name').value === expectedName
                && document.querySelector('.toast-message').textContent.includes('Could not load shared settings'),
                'Invalid share link did not preserve saved inputs: ' + route);
              if (route === 'sat') {
                const legacySettings = JSON.parse(localStorage.getItem('snl-sat-state'));
                legacySettings.mode = 'out-of-service';
                localStorage.setItem('snl-sat-state', JSON.stringify(legacySettings));
                await navigate(''); await navigate('sat');
                expect(document.getElementById('mode').value === 'in-service'
                  && document.querySelector('.output-panel').textContent.includes('role generator mode in-service'),
                'Previously saved port-level Out-of-Service mode was not made safe');
              }
            }
            for (const route of ['l2evc', 'l3ip', 'sat']) {
              await navigate(route);
              {
                const link = () => [...document.querySelectorAll('.text-action')].find(button =>
                  /^(Show|Hide) Advanced$/.test(button.textContent));
                const startedExpanded = link()?.getAttribute('aria-expanded') === 'true';
                const storedKey = 'snl-' + (route === 'l2evc' ? 'l2evc' : route === 'l3ip' ? 'l3ip' : 'sat') + '-state';
                const before = localStorage.getItem(storedKey);
                if (startedExpanded) { link().click(); await tick(); }
                expect(link()?.textContent === 'Show Advanced' && link().getAttribute('aria-expanded') === 'false'
                  && !link().querySelector('svg'), 'Collapsed advanced link is incorrect: ' + route);
                link().click(); await tick();
                expect(link().textContent === 'Hide Advanced' && link().getAttribute('aria-expanded') === 'true'
                  && !link().querySelector('svg'), 'Expanded advanced link is incorrect: ' + route);
                const field = route === 'l2evc' ? 'l2-left-ingressOp' : route === 'l3ip' ? 'mtu' : 'maxSearches';
                expect(document.getElementById(field), 'Show Advanced did not reveal settings: ' + route);
                link().click(); await tick();
                expect(!document.getElementById(field) && localStorage.getItem(storedKey) === before,
                  'Hide Advanced retained fields or changed saved inputs: ' + route);
                if (startedExpanded) { link().click(); await tick(); }
              }
              const noComments = text => !text.split('\\n').some(line => /^\\s*#/.test(line));
              const workspace = document.querySelector('.output-panel');
              expect(!document.querySelector('.builder-results').textContent.includes('Potentially disruptive commands'),
                'Review before applying panel should be removed: ' + route);
              const downloadButton = () => [...workspace.querySelectorAll('button')].find(button => button.textContent === 'Download .txt');
              expect(workspace.querySelector('.panel-heading h2')?.textContent === 'Configs and Commands'
                && downloadButton()?.closest('.panel-heading') && downloadButton().classList.contains('button-small')
                && ![...workspace.querySelectorAll('button')].some(button => button.textContent === 'Copy all'),
                'Workspace heading, small header download or Copy all removal is wrong: ' + route);
              expect(!downloadButton().disabled, 'Creator fixture is invalid: ' + route);
              const validators = [...workspace.querySelectorAll('.panel-heading button')].filter(button =>
                button.textContent.startsWith('Validate config'));
              expect(validators.length > 0 && validators.every(button => button.parentElement === downloadButton().parentElement
                && (button.compareDocumentPosition(downloadButton()) & Node.DOCUMENT_POSITION_FOLLOWING)),
                'Validate config buttons must precede the header download: ' + route);
              const commentToggle = [...workspace.querySelectorAll('input[type="checkbox"]')].find(input =>
                input.closest('label')?.textContent.includes('Include inline Comments'));
              expect(route === 'sat' ? !commentToggle : commentToggle && !commentToggle.checked,
                'Inline comment control missing or not off by default: ' + route);
              if (commentToggle) {
                const label = commentToggle.closest('.inline-comment-toggle');
                expect(label && label.querySelector('strong')?.textContent === 'Include inline Comments'
                  && label.textContent.includes('Add brief # comments before each command section.'),
                'Inline comment label is not a single bold-prefix sentence: ' + route);
              }
              for (const tab of workspace.querySelectorAll('[role="tab"]')) {
                tab.click(); await tick();
                for (const block of workspace.querySelectorAll('.code-block')) {
                  const commands = [...block.querySelectorAll('.code-line code')].map(code => code.textContent).join('\\n');
                  expect(noComments(commands), 'Creator panel still contains comments: ' + route);
                  block.querySelector('.code-copy').click(); await tick();
                  expect(copiedSection === commands && noComments(copiedSection), 'Creator section copy differs from panel: ' + route);
                }
              }
              if (route === 'l2evc') {
                const leftL2cp = document.getElementById('l2-left-l2cp');
                const rightL2cp = document.getElementById('l2-right-l2cp');
                const oldLeft = leftL2cp.checked, oldRight = rightL2cp.checked;
                if (oldLeft) leftL2cp.click();
                if (oldRight) rightL2cp.click();
                await tick();
                expect(!workspace.textContent.includes('L2CP forwarding'), 'L2CP setup appears with both endpoint flags off');
                leftL2cp.click(); await tick();
                expect(workspace.textContent.includes('L2CP forwarding'), 'L2CP setup missing when enabled');
                if (!oldLeft) leftL2cp.click();
                if (oldRight) rightL2cp.click();
                await tick();
              }
              let downloaded;
              const makeUrl = URL.createObjectURL;
              const clickAnchor = HTMLAnchorElement.prototype.click;
              const download = async () => {
                URL.createObjectURL = blob => { downloaded = blob; return makeUrl.call(URL, blob); };
                HTMLAnchorElement.prototype.click = function () { if (!this.download) clickAnchor.call(this); };
                try { downloadButton().click(); } finally { URL.createObjectURL = makeUrl; HTMLAnchorElement.prototype.click = clickAnchor; }
                return downloaded.text();
              };
              const plain = await download();
              const headers = plain.split('\\n').filter(line => line.startsWith('#'));
              expect(plain.length > 0 && !plain.split('\\n').some(line => line.startsWith('!'))
                && headers.length >= 2 && headers.some(line => /^# (Verify|Remove|Validate)/.test(line)),
                'Creator download headers are not # comments: ' + route);
              if (commentToggle) {
                workspace.querySelector('[role="tab"]').click(); await tick();
                const original = [...workspace.querySelectorAll('.code-line code')].map(code => code.textContent);
                commentToggle.click(); await tick();
                const annotated = [...workspace.querySelectorAll('.code-line code')].map(code => code.textContent);
                expect(annotated.some(line => line.startsWith('# '))
                  && JSON.stringify(annotated.filter(line => !line.startsWith('#'))) === JSON.stringify(original),
                  'Inline comments missing or changed commands: ' + route);
                workspace.querySelector('.code-copy').click(); await tick();
                expect(copiedSection.split('\\n').some(line => line.startsWith('# ')), 'Section copy omitted inline comments: ' + route);
                const commented = await download();
                expect(commented.split('\\n').filter(line => line.startsWith('# ')).length
                  > plain.split('\\n').filter(line => line.startsWith('# ')).length, 'Download omitted inline comments: ' + route);
                await navigate(''); await navigate(route);
                const savedToggle = [...document.querySelectorAll('.output-panel input[type="checkbox"]')].find(input =>
                  input.closest('label')?.textContent.includes('Include inline Comments'));
                expect(savedToggle?.checked, 'Inline comment preference did not persist: ' + route);
                savedToggle.click(); await tick();
                expect([...document.querySelectorAll('.code-line code')].every(code => !code.textContent.startsWith('#')),
                  'Disabling inline comments left comments behind: ' + route);
              }
            }
            await navigate('cheatsheet');
          }
          finally {
            if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
            else delete navigator.clipboard;
            document.execCommand = originalExecCommand;
          }
          [...document.querySelectorAll('button')].find(button => button.textContent === 'Add entry').click(); await tick();
          nativeInput(document.querySelector('.entry-form textarea'), 'show browser-smoke');
          nativeInput(document.querySelector('.entry-form input'), 'Browser field note'); await tick();
          document.querySelector('.entry-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick();
          expect(document.getElementById('my-entries').textContent.includes('show browser-smoke'), 'Note not saved');
          expect(document.querySelector('#my-entries .personal-command-list li code')
            && !document.querySelector('#my-entries pre'), 'Personal entry still embeds a code box');
          const firstNumber = JSON.parse(localStorage.getItem('snl-cheatsheet-user'))[0].number;
          expect(firstNumber === numbered.length + 1, 'Add entry did not assign the next section number');
          expect(document.getElementById('my-entries').querySelector('h2').textContent.includes('My entries'), 'Personal section group missing');
          expect(document.querySelector('#my-entries .field-note-heading h2').textContent.startsWith('#' + firstNumber), 'Personal entry number missing');
          const activity = JSON.parse(localStorage.getItem('snl-cheatsheet-changelog-v0.8.14'));
          expect(activity.length === 1 && activity[0].preview === 'show browser-smoke\\nBrowser field note', 'Entry activity snapshot missing');
          expect(!Number.isNaN(Date.parse(activity[0].timestamp)) && activity[0].timestamp.includes('T'), 'Activity timestamp is not full ISO date-time');
          await navigate('changelog');
          expect(!document.querySelector('.placeholder-panel'), 'Changelog still shows fill-in values');
          expect(document.querySelector('.cheatsheet-change time').dateTime === activity[0].timestamp, 'Activity timestamp not displayed');
          expect(document.querySelector('.cheatsheet-change').textContent.includes('show browser-smoke'), 'Activity preview missing');
          expect(document.querySelector('.prose').textContent.includes('${version}'), 'Bundled release notes missing');
          expect([...document.querySelectorAll('.prose h2')].every(heading => {
            const release = heading.textContent.match(/\\[(\\d+)\\.(\\d+)\\.(\\d+)\\]/);
            if (!release) return false;
            const major = Number(release[1]);
            return major >= 1;
          }), 'HTML changelog still shows Unreleased or pre-v1.0.0 releases');
          expect([...document.querySelectorAll('.prose h2')].some(heading => heading.textContent.includes('[1.0.0]')),
            'HTML changelog does not show the v1.0.0 release');
          expect(!document.querySelector('.cheatsheet-change').textContent.includes('old-activity'),
            'Pre-v0.8.14 activity leaked into the fresh log');
          expect(JSON.parse(localStorage.getItem('tbf-cheatsheet-changelog'))[0].preview === 'show old-activity',
            'Starting a fresh activity log deleted the old history');
          expect(document.querySelector('.app-footer').textContent.includes('v${version}'), 'Build revision not displayed');
          await navigate('cheatsheet');
          [...document.querySelectorAll('button')].find(button => button.textContent === 'Add entry').click(); await tick();
          nativeInput(document.querySelector('.entry-form textarea'), 'line-1\\nline-2\\nline-3\\nline-4\\nline-5\\nline-6');
          nativeInput(document.querySelector('.entry-form input'), 'note-after-six-lines'); await tick();
          document.querySelector('.entry-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick();
          await navigate('changelog');
          const latest = document.querySelector('.cheatsheet-change');
          expect(document.querySelectorAll('.cheatsheet-change').length === 2, 'Activity did not persist between routes');
          expect(latest.textContent.includes('line-5') && !latest.textContent.includes('line-6') && !latest.textContent.includes('note-after-six-lines'), 'Activity snapshot did not stop at five lines');
          await navigate('cheatsheet');
          const search = document.querySelector('[aria-label="Search commands and notes"]');
          nativeInput(search, 'browser-smoke'); await tick();
          expect(document.getElementById('my-entries').textContent.includes('show browser-smoke'), 'Note search failed');
          nativeInput(search, 'Popular Routing Commands'); await tick();
          expect(document.getElementById('popular-routing-commands').querySelector('h2').textContent === routingTitle, 'Filtering renumbered a section');
          nativeInput(search, 'zero-matches-unique'); await tick();
          expect(document.getElementById('my-entries').textContent.includes('No entries to show'), 'No-results state missing');
          await navigate(''); await navigate('cheatsheet');
          expect(document.getElementById('my-entries').textContent.includes('show browser-smoke'), 'Saved note did not survive route changes');
          const importer = document.querySelector('input[type="file"]');
          const selectJson = contents => {
            const transfer = new DataTransfer();
            transfer.items.add(new File([contents], 'entries.json', {type:'application/json'}));
            importer.files = transfer.files;
            importer.dispatchEvent(new Event('change', {bubbles:true}));
          };
          const noteJson = JSON.stringify([{id:'import-browser',command:'show import-browser',note:'Imported note',section:'my-entries'}]);
          selectJson(noteJson); await tick();
          await waitUntil(() => document.getElementById('my-entries').textContent.includes('show import-browser')
            && !document.querySelector('[aria-label="Import entries"]').disabled, 'JSON note import failed');
          selectJson(noteJson); await tick();
          await waitUntil(() => document.querySelector('.toast-message').textContent.includes('Imported 0 new entries')
            && !document.querySelector('[aria-label="Import entries"]').disabled, 'Duplicate import did not complete');
          expect(document.getElementById('my-entries').textContent.includes('My entries (3)'), 'Import did not deduplicate IDs');
          selectJson('[{"command":17}]'); await tick();
          await waitUntil(() => document.querySelector('.toast-message').textContent.includes('Import failed'), 'Invalid import not surfaced');
          expect(document.getElementById('my-entries').textContent.includes('My entries (3)'), 'Invalid import modified notes');
          expect(JSON.parse(localStorage.getItem('snl-cheatsheet-changelog-v0.8.14')).length === 2, 'Imports incorrectly added activity');
          const beforeDeleteNumbers = JSON.parse(localStorage.getItem('snl-cheatsheet-user')).map(entry => entry.number);
          expect(new Set(beforeDeleteNumbers).size === 3 && beforeDeleteNumbers[1] === firstNumber + 1
            && beforeDeleteNumbers[2] === firstNumber + 2, 'New or imported entries have duplicate/nonsequential numbers');
          const originalConfirm = window.confirm;
          window.confirm = () => true;
          try { [...document.querySelectorAll('button')].find(button => button.textContent === 'Delete entry').click(); }
          finally { window.confirm = originalConfirm; }
          await tick();
          expect(JSON.parse(localStorage.getItem('snl-cheatsheet-user')).map(entry => entry.number).join(',') === beforeDeleteNumbers.slice(1).join(','),
            'Deleting an entry renumbered remaining entries');
          await navigate('changelog');
          expect(document.querySelectorAll('.cheatsheet-change').length === 2
            && document.querySelector('.cheatsheet-change').parentElement.textContent.includes('show browser-smoke'),
            'Deleting an entry removed activity history');
          expect(runtimeErrors.length === 0, runtimeErrors.join('; '));
          expect(performance.getEntriesByType('resource').every(entry => !/^(https?|file):/.test(entry.name)), 'Offline build requested an external resource');
          result.textContent = 'PASS';
          result.dataset.done = 'true';
        } catch (error) { result.textContent = 'FAIL: ' + (error.stack || error.message) + '; notifications=' + JSON.stringify(notifications); result.dataset.done = 'true'; }
      });
    </script>`;
    const file = join(dir, 'app.html');
    const seededHtml = html.replace('<head>', '<head><script>localStorage.setItem("tbf-theme", "dark");localStorage.setItem("tbf-layout", JSON.stringify("dashboard"));localStorage.setItem("tbf-overview-design", JSON.stringify("' + (width === 390 ? 'simple' : width === 768 ? 'learning' : 'tasks') + '"));</script>');
    const end = seededHtml.lastIndexOf('</body>');
    writeFileSync(file, seededHtml.slice(0, end) + checks + seededHtml.slice(end));
    const result = await runBrowserChecks(browser, {
      userDataDir: join(dir, 'profile'), width, url: pathToFileURL(file).href, timeoutMs: 90000,
      flags: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader'],
    });
    assert.equal(result, 'PASS', result);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
}
