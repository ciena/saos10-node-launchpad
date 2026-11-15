# SAOS10 Cheatsheet

Troubleshooting and usability commands, grouped by topic. Search or pick a topic, copy one command or a whole section, or add your own entries.

## Start here

### The Basics

Use the credentials supplied for your platform. Change any initial password before placing the node into service.

[SAOS Labs](https://github.com/ciena/saos-labs) provides public fundamentals and examples.

- `set session more off` - output w/o 'more' pauses (but must re-enter each session)
- `show license` - MUST HAVE ACTIVE LICENSE IF you want to Transit Traffic through node.
- `show software`
- `show system components` - Shows system Model, Part Number, Serial Number, Chassis MAC
- `show running config` - Shows RUNNING CONFIG in "one-liner" format.
- `show alarm list active-alarms alarm-type all`
- `show flow-points` - Great for showing FPs and their associated FD and Classifier (VLAN)
- `show ip interface brief`
- `show ip route`
- `show lldp neighbor`
- `ping ip dest <ip>`
- `show mac-fdbs forwarding-domain <fd_name>`
- `sh run config excluding-bootstrap` - NEW in 10.11.0 - Only show the configs that you've added. Almost reason enough to go to 10.11.x!
- `sh run config | grep <search_term>` - Quickly search the config with the 'grep' cmd (or other linux cmds like "include" and "begin")
- `sh run config section system format xml` - Great if you use NETCONF to cfg nodes or to build Navigator Custom Scripts

...but what about just "`show running`"? - It has its (rare) usefulness (like for understanding subtending cfgs), but I find the nesting very confusing. Lame.

### Everyday show commands

- `show flow-points` - Great for showing FPs and their associated FD and Classifier (VLAN)
- `show flow-points statistics`
- `show flow-points flow-point X statistics`
- `show xcvrs` - Transceiver details, PNs, SNs, etc. Plus, I love just fast-typing "`sh x`" :-D
- `show xcvrs diagnostics`
- `show logical-ports` - Port up/down, especially good for LAGs!
- `show ettps ettp X statistics`
- `show ettps ettp X throughput sample-count 100 sample-interval 10 scale giga` - Monitor port throughput -- &lt;CTRL-C&gt; to exit
- `clear flow-point statistics`
- `clear ettps statistics`

**Alarms**

- `show alarm list active-alarms alarm-type all`
- `show alarm list`

**Ping samples**

```cli
ping ip dest <IP-ADDRESS>
ping ip dest <IP-ADDRESS> data-size 9100 source <IP-ADDRESS> repeat-count 100
```

### CLI tips and tricks

- `config` - Drop into config mode (like IOS's "`conf t`")
- `search cli keyword <STRING>` - Search for commands in CLI

**&lt;TAB&gt; Auto-Complete is your best friend!** Some variables must be completely spelled out: "xcvrs xcvr 4 state admin-state disable" fails, but "... disabled" works. &lt;TAB&gt; will help with this! (I'll admit this is lame but optimistic it'll be fixed soon.)

**Comments:** Precede a line with "#" to 'comment out', so you don't get an error message when you bulk copy/paste. Specifically, do not use "!" (bang/exclamation point) to comment out config lines like other Switch/Router OS.

**Quotes or Apostrophes or Nothing?** In (almost) all cfgs, you do NOT need the variables in Double or Single-quotes (unless you have a space in your variable, like a Description field). Personally, I always remove them when manually building/sharing configs. e.g. MGMT description is probably the only place I keep them.

**Using "pipe &lt;LinuxCmd&gt;":** for example, show all of the FPs and things attached to port 1.

- `show run config | grep 'logical-port "1"'` - newer (10.9.2 and beyond, I think)
- `show run config | grep "logical-port '1'"` - older releases

### Exit-free one-liner configs

"How do I remove all "exits" when entering configs?" In most scenarios, add one default option+value to make a config "exit-free". Find it with:

```cli
show run config with-defaults | grep <config>
```

Not all cmds follow that rule: sometimes the required option+value is in the middle of the config line (e.g. "bgp instance &lt;ASN&gt; router-id &lt;IP&gt; ..." and "ldp instance default lsr-id &lt;LSR-IP&gt; ...").

- `gotop` - Applies previous config and goes back to config-mode's root/"top" for next "one-liner"

Use "apply" then "return" to apply the config and exit config mode. (Do not use in the middle of a bulk copy/paste.)

**Common configs requiring "exits" and their "exit-free" / "one-liner" counterparts**

| Requires an "exit" | Exit-free one-liner |
| --- | --- |
| `license-management-config license-server-config <IP>` | `license-management-config license-server-config <IP> backup false` |
| `license-management-config license-client-config` | `license-management-config license-client-config server-enable enabled` |
| `system ntp associations remote-ntp-server server-entry <IP>` | `system ntp associations remote-ntp-server server-entry <IP> admin-state enabled` |
| `rib vrf default ipv4 0.0.0.0/0 next-hop <GW_IP>` | `rib vrf default ipv4 0.0.0.0/0 next-hop <GW_IP> tag 0` |
| `fds fd <fd_name>` | `fds fd <fd_name> mode vpls` |
| `isis instance ISIS1 segment-routing bindings` | `isis instance ISIS1 segment-routing bindings receive true` |
| `isis instance ISIS1 interfaces interface <interface> level-2` | `isis instance ISIS1 interfaces interface <interface> level-2 send-only false` |

**...and some examples where the variables are in the middle...**

| Requires an "exit" | Exit-free one-liner |
| --- | --- |
| `classifiers classifier ALLVLANS filter-entry vtag-stack vtags 1` | `classifiers classifier ALLVLANS filter-entry vtag-stack any vtags 1` |
| `ldp instance default target-ldp peers <IP2>` | `ldp instance default lsr-id <ID-IP> target-ldp peers <IP2>` |
| `bgp instance <ASN> address-family ipv4 unicast network <IP2>/<PREFIX>` | `bgp instance <ASN> router-id <IP1> address-family ipv4 unicast network <IP2>/<PREFIX>` |

### Initial authentication

Follow the platform's approved onboarding procedure to set a unique password for each account. Do not reuse example or factory credentials.

### Logs and debug

Use "`log view <tab>`" for the options. NOTE: It is NOT "`show log`" which is "`show logical-ports`"

- `log view cli-log` - Cmd/Cfg Audit Logs
- `log view events` - Major events in the system -- e.g. Alarm history, Port/Interface flaps, Alarms, SSH login events
- `log view troubleshoot` - Logs from Debug-enabled protocols "`log set isis all debug`"
- `log view netconf-config-change` - Config History in Netconf format (GREAT for programming/API)
- `log view netconf-rpc <tab>` - Deeper history in Netconf format
- `log monitor <tab>` - Real-time output of logs (like "tail -f")

- `log enable troubleshoot subsystem ip`
- `log view events | grep license`
- `log set netconf-config-change <enable/disable>`

**Debug**

ISIS is shown here; similar provisioning can be used to check for LDP/OSPF/MPLS/BGP logs.

- `log set isis all debug` - Enable ISIS debug logs
- `log monitor troubleshoot` - Check for ISIS debug logs - for real-time monitoring
- `log view troubleshoot` - Check for ISIS debug logs - for historical logs
- `log set isis all disabled` - Disable

'log set' options:

```text
5164> log set <TAB>
all                         igmp-querier                netconf-config-change       pcep
bgp                         isis                        nsm                         rib
evpn                        ldp                         ospf                        rsvp
grpc                        mpls                        ospfv3                      segment-routing
```

## Software and licensing

### Download and prepare SAOS10 software

Obtain software from the authorized Ciena software distribution channel for your account and platform.

Unzip the archive AND THEN unzip the "-packages.zip" (yes, you have to unzip twice), and copy that "-packages" directory to your SFTP server.

### Minimum SAOS10 package files

Optional: trim the package down to the files your platform needs.

1) Obtain the target revision from the authorized Ciena software distribution channel for your account and platform.

2) Unzip, the "saos-10-xx-xx-xxxx-packages.zip" file and (if you want) delete everything else.

3) Open the "saos-10-xx-xx-xxxx-packages" directory and edit remove the files pertinent to your release.

**Intel x86_64-based devices**

Examples: 3850, 5162, 5164-904/905 (QSFP-DD variant), 5166-902/903 (CFP2 variant), 5170, 5171, 5184, 5186, 8110, 8112, 8114, 8140, 8180, 8190, 8192

Directories/Files to KEEP:

- All saos-10-0x-xx-xxxx.\* files in the root directory
- docker-projects/
- base-os/01-xx-xx-xxxx/evernight-generic-intel-x86-64/
- cn/01-xx-xx-xxxx/\*-x86-64/
- docker-compose/1.xx.x/docker-compose-x86-64/
- docker-registry/01-xx-xx-xxxx/docker-registry-x86-64/
- en/01-xx-xx-xxxx/\*-x86-64/

Directories/Files to REMOVE:

- /wcs/
- base-os/01-xx-xx-xxx/evernight-generic-arm-aarch64/
- cn/01-xx-xx-xxx/\*-aarch64/
- docker-compose/1.xx.x/\*-aarch64/
- docker-registry/01-xx-xx-xxx/docker-registry-aarch64/
- en/01-xx-xx-xxx/\*-aarch64/

...in short, remove anything that says "aarch64" and the /wcs/ dir.

**ARM aarch64-based devices**

Examples: 3922, 3924, 3926, 3928, 3931-gen2, 3948, 3984, 3985, 5130, 5131, 5132, 5134, 5144, 5164 (QSFP28 variant), 5166-900/901 (QSPFP-DD variant), 5168, 5169

Directories/Files to KEEP:

- All saos-10-0x-xx-xxxx.\* files in the root directory
- docker-projects/
- base-os/01-xx-xx-xxx/evernight-generic-arm-aarch64/
- cn/01-xx-xx-xxx/\*-aarch64/
- docker-compose/1.xx.x/\*-aarch64/
- docker-registry/01-xx-xx-xxx/docker-registry-aarch64/
- en/01-xx-xx-xxx/\*-aarch64/

Directories/Files to REMOVE:

- /wcs/
- base-os/01-xx-xx-xxxx/evernight-generic-intel-x86-64/
- cn/01-xx-xx-xxxx/\*-x86-64/
- docker-compose/1.xx.x/docker-compose-x86-64/
- docker-registry/01-xx-xx-xxxx/docker-registry-x86-64/
- en/01-xx-xx-xxxx/\*-x86-64/

...in short, remove anything that says "x86-64" and the /wcs/ dir.

### Software upgrade

- `show software`

Before you start:

- Upgrade to 10.11+ or higher, requires intermediate upgrade to 10.9.1 or 10.10.1.
- Use "URL percent-encoding" for Special Characters in passwords or spaces in URL (e.g. "%23" for "#" or "%20" for space) - https://en.wikipedia.org/wiki/Percent-encoding
- After starting the download, you can monitor with "`show soft`" or "`log monitor troubleshoot`" (CTRL-C to exit log monitor)

**In 1 line** (e.g. to download/install/activate (reboot) all in one, non-stop sequence)

```cli
software install url sftp://<USERNAME>:<PASSWORD>@<SFTP-SERVER>/<PATH>/<PACKAGE-FILE>
```

**In 2 lines** (e.g. to download during the day, install/activate (reboot) during MW)

```cli
software download url sftp://<USERNAME>:<PASSWORD>@<SFTP-SERVER>/<PATH>/<PACKAGE-FILE>
software install package saos-10-08-00-0268-RS1
```

**In 3 lines** (e.g. to d/l during the day, install before MW, activate (reboot) during MW)

```cli
software download url sftp://<USERNAME>:<PASSWORD>@<SFTP-SERVER>/<PATH>/<PACKAGE-FILE>
software install package saos-10-08-00-0268-RS1 defer-activation
software activate package saos-10-08-00-0268-RS1
```

### Software upgrade, step by step

SAOS files hosted on an SFTP server. The example is from 10.7.1 to 10.8.0.

**1) Check what is loaded.** Run "`show soft`": at the bottom, saos-10-07-01 should be "activated" AND there should be no other version loaded.

- If 10.8.0-0268 is "activated", STOP!
- If 10.8.0-0268 is "downloaded" or "installed", go to Step 4
- If any OTHER rev is "installed", then remove it: "`soft remove package [rev]`". (Don't worry, the 'activated' load can be deleted.) ~1min

**2) Perform software download from SAOS CLI** (~9min):

```cli
software download url sftp://<USERNAME>:<PASSWORD>@<SFTP-SERVER>/<PATH>/<PACKAGE-FILE>
```

...If your password doesn't work... Some special characters may require its URL-encode hex ID. For example, "XYZ#123" would be "XYZ%23123". URL-encoded Table here: https://documentation.n-able.com/N-central/userguide/Content/Further_Reading/API_Level_Integration/API_Integration_URLEncoding.html

**3) Monitor the download process** with "`show soft`". The first big file is ~1.4GB (took ~5min on high-speed connection):

```text
|   saos-10-08-00-268-RS1   | downloading, /mnt/config/docker/ciena/installed/docker-registry/01-08-00-0268/01-08-00-0268-x86-64.registry.tar
```

...then you will get the rest of the files:

```text
|   saos-10-07-01-0275-RS10 | downloading, pulling ### of 37: ......
```

...once complete, it will show "downloaded".

**4) Perform software install/activate from SAOS CLI:**

```cli
software install package saos-10-08-00-0268-RS1
```

...system reboots after a few minutes.

Alternative: install and activate in two steps.

```cli
software install package saos-10-08-00-0268-RS1 defer-activation
software activate package saos-10-08-00-0268-RS1
```

**5) After SW Installed** (~6-7min), login prompt (and/or pings) will return, wait ~1min, then login. When logged back in, check:

- `show boot` - Wait until "Bootstrap Done" (&lt;3min. If over 10min, reboot maybe?)
- `show soft` - At bottom, "\|   saos-10-08-00-0268      \| activated"

### SAOS6 to SAOS10 upgrade (draft)

**Step 1) Prep all of the files on your SFTP Server:**

- saos-06-21-04-0057.zip (265MB) --&gt; Unzipped (285MB)
- saos-10-07-01-0275-RS10.zip (19.26GB) --&gt; Unzipped (19.7GB)
  - You will most likely only need the contents of: "saos-10-07-01-0275-core-lt-plus" (2.8GB)
  - For early, low-mem version of 3926 (-900/902) and 3928 (-900/901/905/906), you'll need "saos-10-07-01-0275-core-lt" (2.1GB), BUT NOTE: 10.7.1 was the LAST release for those low-mem models. (i.e. Why are you wasting your time, b/c you will NOT want to deploy 10.7??)
- saos-10-09-01-0240-RS5.zip (7.37GB) --&gt; Unzipped (7.6GB) AND unzip "saos-10-09-01-0240-RS5-packages.zip", since that's the directory (5.2GB) you'll need
- Latest SAOS rev (e.g. 10.10.1, 10.11.0 or newer): saos-10-11-00-0241-GA.zip (7.63GB) --&gt; Unzipped (8.0GB) AND unzip "saos-10-11-00-0241-GA-packages.zip", since that's the directory (4.9GB) you'll need

**Step 2) Upgrade SAOS6 node to at least 6.21.0, at minimum.** Personally, I recommend the latest (currently, 6.21.4), b/c I vaguely remember some bugs/quirks early on.

```cli
software install sftp-server <SFTP-SERVER-IP> login-id <USERNAME> echoless-password package <PACKAGE-NAME> package-path <PATH>/<PACKAGE-NAME>
software activate
```

**Step 3)** On your FTP/SFTP server, download/unzip SAOS 10.7.1-0275-RS10 (available on Ciena Portal).

**Step 4)** Since you will not want to stay on 10.7.1 (it's super old/antiquated!), also download/unzip SAOS 10.09.01-0240-RS5 and SAOS 10.11.0. (Note: When going to 10.11.0, you must be 10.9.1 or higher)

**Step 5) Perform Upgrade**

```cli
software upgrade sftp-server <SFTP-SERVER-IP> package <PACKAGE-NAME> package-path <PACKAGE-PATH> service-disruption allow
```

**Step 6) Upgrade 10.7.1 to 10.9.2 then 10.11.0**

Note the URL encoding for special characters in the URL ("%23" for "#", "%29" for ")", "%3D" for "=").

```cli
software download url sftp://<USERNAME>:<PASSWORD>@<SFTP-SERVER>/<PATH>/<PACKAGE-FILE>
software install package saos-10-08-00-0268-RS1 defer-activation
software activate package saos-10-08-00-0268-RS1
```

**Misc Notes:**

- SAOS6 to SAOS10 upgrade must go to 10.7.1, FIRST, since key supporting files are not in later revs.
- For SAOS 10.11.0, you must first go to any rev from 10.9.0-0346 RS4 to 10.10.1RSx.
- By default, the entire config is lost when going from SAOS6/8 to SAOS10.
  - If you have manually built a converted SAOS10 config (ciena-cfg.xml file), you can load that file to the /mnt/config/saos/user directory, before the SAOS10 upgrade:

```cli
system xftp getfile sftp-server <IP-ADDRESS> login-id <NAME> echoless-password remote-filename <PATH/ciena-cfg.xml> local-filename /mnt/config/saos/user/ciena-cfg.xml
```

### Manual node-specific license

**Step 1: Create/Transfer Node Registration File to Ciena Support Portal**

1. Create License File from CLI: "`license generate regid`"
2. SCP/SFTP into the node to copy off the created .bin file from /tmp/
3. Use the authorized Ciena support channel for license management.
4. Add Device and upload the file (if you get an error, try removing dashes from the filename)
5. Enter the activation code provided for your account. Contact your authorized support channel if you need assistance.
6. Assign appropriate License(s) to the Device you just created, and download the generated license file.

TIP: I include the Node MAC Address "`show system macs | grep chassis`" in the Name or Notes to easily track/identify in the future.

**Step 2: Copy the Generated License file to the node**

- Opt1: Upload File to Node via laptop's SCP/SFTP client (e.g. WinSCP)
- Opt2: Download File to Node via Node CLI from SCP/SFTP Server:

```cli
diag shell
cd /license/preinstall
scp <USERNAME>@<SFTP-SERVER-IP>:<REMOTE-LICENSE-PATH> <LOCAL-LICENSE-PATH>
exit
```

**Step 3: Activate License**

```cli
license activate filename <LICENSE-FILENAME>
```

NOTE: If you get an error, try removing dashes from the filename.

### Suppress unused feature alarms

Suppress the 200G Alarm on the 5164, when you are not using the 200G feature... and 5166's 400G and MPLS Alarms (you get the idea).

```cli
alarms control alarm-shelving shelf SAOS-Adv_200G_5164 resource "/ciena-licensing:license-management-state/license-client-state/license-feature[feature-name='SAOS-Adv_200G_5164']"
alarms control alarm-shelving shelf SAOS-Adv_400G_5166 resource "/ciena-licensing:license-management-state/license-client-state/license-feature[feature-name='SAOS-Adv_400G_5166']"
alarms control alarm-shelving shelf XCVR_UNREC alarm-type-id xcvr-optic-unrecognized-unqualified
alarms control alarm-shelving shelf SAOS-MPLS_5166 resource "/ciena-licensing:license-management-state/license-client-state/license-feature[feature-name='SAOS-MPLS_5166']"
```

### State dump for TAC

If TAC requests a state-dump:

```cli
system state-dump remote filename <FILENAME> targetpath sftp://<SFTP-SERVER-IP>/<PATH>/ username <USERNAME>
```

The statedump can be found by going to the following:

```cli
<NODE-PROMPT> diag shell
diag@<NODE>.ui:~$ cd <STATE-DUMP-DIRECTORY>
```

## Config backup and restore

### Back up, compare and restore

**Back up**

- `config backup filename <NAME>` - Backup config as a transferable file (not required to 'apply' or 'save' configs).
- `config backup filename <file_name>.xml` - .txt and .cfg are also options for file extension
- `config backup filename <file_name>.xml overwrite true` - if file already exists

**Compare**

- `config compare source <NAME> target running` - Shows the configs ADDED since backup
- `config compare source running target <NAME>` - Shows how to REMOVE new configs

In 10.11.0, source/target can be "bootstrap" too, which can remove all the factory-default configs from your output.

**Restore**

- `config restore filename <file_name>` - This does not trigger a reboot or reset system uptime

**Reset-to-user-config (RTUC)**

- `config reset user-config filename <file_name>` - Different from restore, system will reboot, includes failsafe in which system will fallback to pre-reset config if RTUC fails

### Automatic config and inventory backup

Auto-backup the config and SW/HW details, upon change, to SFTP/SCP/FTP/HTTP/HTTPS.

**Running config**

```cli
auto-backup config feature "show-running-config" admin-state enabled prefix "cfgPE-A-" idle-time-interval 600 local-copy-count 4
auto-backup config feature "show-running-config" remote-server "<BACKUP-SERVER>" url "sftp://<BACKUP-SERVER-IP>/sw-images/backups" username "<BACKUP-SERVER-USERNAME>" password "<BACKUP-SERVER-PASSWORD>"
```

**Software details**

```cli
auto-backup config feature "show-software" admin-state enabled prefix "swPE-A-" idle-time-interval 600
auto-backup config feature "show-software" remote-server "<BACKUP-SERVER>" url "sftp://<BACKUP-SERVER-IP>/sw-images/backups" username "<BACKUP-SERVER-USERNAME>" password "<BACKUP-SERVER-PASSWORD>"
```

**Hardware details**

```cli
auto-backup config feature "show-component" admin-state enabled prefix "hwPE-A-" idle-time-interval 600
auto-backup config feature "show-component" remote-server "<BACKUP-SERVER>" url "sftp://<BACKUP-SERVER-IP>/sw-images/backups" username "<BACKUP-SERVER-USERNAME>" password "<BACKUP-SERVER-PASSWORD>"
```

- "idle-time-interval" --&gt; Specifies the time interval for which the system is idle after a configuration change on the system. At every configuration change, the system starts a countdown timer according to the value of this parameter. When this timer reaches zero, the system uploads the current running configuration file to the specified remote server.
- "vrf-name &lt;VRF&gt;" --&gt; Use if using isolate-mgmt=true

## Management access

### USB-C console access

**Step 1: Log in via Console Port**

- Connect to Console port using a USB-C cable. You can use Ciena USB-C console cable.
  - Ciena USB-C Console Cable Part Number - 170-0353-900 (USB 2.0 MALE TO USB-C MALE CABLE, 3M/10FT)
  - NOTE: Generic Cable - Most of USB-C generic cable will still work in case you don't have Ciena USB-C console cable.

Using a Terminal program such as HyperTerminal or puTTY, establish a serial connection.

**Step 2: Know your COM Port number**

When you connect your USB-C cable to console port, then at that point your machine will start to recognize that connection as a console connection. If this is your first time to connect to a SAOS10 Console, then you may need to install the driver.

To check your Port number:

a) Click on Start Menu and type "Device Manager"

b) Connect the USB-C cable to your laptop and the console port, then check whether the device appears in Device Manager.


c) If the driver is unknown or missing, right-click the device and select update driver.


d) In the update window, select the manual option (Browse my computer for drivers).


e) Keep that window open and Download & Unzip the driver on your machine: Silicon Labs CP2102 USB to UART (you should be able to google and find it)

- Use a driver approved for your operating system and console adapter. If it is not recognized, contact your IT for assistance.

f) Now go back to the window that you left previously and select the Unzipped folder and Click OK button.

g) Check box for "Includes subfolders" and click Next

h) At this point the driver is updated:


i) Return to Device Manager and find your COM port number.


**Step 3: Start your connection**

At this point you will see your port number for serial connection, and you can use this info to start your session.

Use the credentials supplied for your platform and change any initial password before placing the node into service.


### Loopback for remote management

To set a remote mgmt interface using lb0 (default preferred source IP for management):

```cli
config
oc-if:interfaces interface lb0 config name lb0 cn-if:type loopback role management
oc-if:interfaces interface lb0 ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length 32
management-plane default-source-ip interface lb0
```

### TACACS

**SAOS10 config**

```cli
system aaa server-groups server-group TACACS-AUTH config name TACACS-AUTH type oc-aaa:TACACS
system aaa server-groups server-group TACACS-AUTH servers server <IP-ADDRESS> config address <IP-ADDRESS> timeout 8
system aaa server-groups server-group TACACS-AUTH servers server <IP-ADDRESS> tacacs config secret-key <SHARED-SECRET>
no system aaa authentication config authentication-method AUTH_LOC
system aaa authentication config authentication-method TACACS-AUTH AUTH_LOC
nacm enable-external-groups true
```

**Sample server config**

```text
key = <TACACS-SHARED-SECRET>
group = diag {
default service = permit
service = exec {
priv-lvl = 15
nacm-group = super
}
}
group = super {
default service = permit
service = exec {
priv-lvl = 12
nacm-group = super
}
}
group = admin {
default service = permit
service = exec {
priv-lvl = 4
nacm-group = admin
}
}
group = limited {
default service = permit
service = exec {
priv-lvl = 0
nacm-group = limited
}
}
user = <USERNAME> {
login = cleartext <PASSWORD>
member = diag
}
```

### Syslog

```cli
syslog log-actions remote dest <server IP> severity alert critical emergency error notice warning
```

If wanting to use with Dying Gasp, you must use inband mgmt and set the L3 IP-interface with Role=Management.

### Dying gasp

**Layer 3 (SNMP/syslog)**

- The dying gasp notification is transmitted via a remote management interface, a L3 IP-interface with Role=Management.
- The dying gasp notification is not transmitted by means of the local (mgmtbr0) interface, L3 loopback, and L3 IP-interfaces with Role=Data (which is the default).
- Note, you can only have 3x Interfaces with Role=Mgmt, which are typically: mgmtbr0, loopback and one IP interface. If you don't have a loopback, then (I'm pretty sure) you can configure 2x IP-Interfaces to Role=Mgmt.
- Dying Gasp supports IPv4 and IPv6 SNMP and syslog servers.
- The system does not support SNMPv3 dying gasp PDU.
- Dying Gasp is not supported on IP Unnumbered IP Interfaces

Enable syslog to launch a dying gasp syslog update:

```cli
syslog log-actions remote dest <server IP>
```

Enable SNMP Traps (via 'snmp notify') to enable Dying Gasp via SNMP:

```cli
snmp target "ISP1-AlarmTarget-1" target-params "ISP1-TargetParams" udp ip "<IP-ADDRESS>" prefix-length 32
snmp target "ISP1-AlarmTarget-1" tag "ISP1-Tag"
snmp target-params "ISP1-TargetParams" v2c security-name <SECURITY-NAME>
snmp notify "ISP1-Trap1" tag "ISP1-Tag"
snmp community <COMMUNITY-NAME> text-name <COMMUNITY-STRING> security-name <SECURITY-NAME>
snmp usm local user <SECURITY-NAME>
snmp vacm group "ISP1-GroupV2C" member <SECURITY-NAME> security-model v2c
snmp vacm group "ISP1-GroupV2C" access "" "v2c" "no-auth-no-priv" read-view "ISP1-View" notify-view "ISP1-View"
snmp vacm view "ISP1-View" include "iso"
```

**Layer 2 (Ethernet OAM/EOAM)**

Ethernet OAM notifies its peer OAM entity of a dying gasp event using the OAMPDU flags field. Enable EOAM globally, then per port (port 1 shown):

```cli
eoam-global-config-status admin-state enabled
oc-if:interfaces interface 1 config eoam-port-event-config dying-gasp true
oc-if:interfaces interface 1 config eoam-port-event-config error-frame-event-notification true
oc-if:interfaces interface 1 config eoam-port-event-config critical-event true
oc-if:interfaces interface 1 config eoam-port-config admin-status enable
```

Sample config for port 10:

```cli
oc-if:interfaces interface 10 config eoam-port-config admin-status enable
oc-if:interfaces interface 10 config eoam-port-event-config dying-gasp true
oc-if:interfaces interface 10 config eoam-port-event-config error-frame-event-notification true
oc-if:interfaces interface 10 config eoam-port-event-config critical-event true
```

## Ports and optics

### Disable a port

Different ways to disable a port:

```cli
xcvrs xcvr 34 state admin-state disabled
logical-ports logical 34 admin-state disable
ptps ptp 34 state admin-state enabled
ptps ptp 34 properties transmitter state enabled
```

For Coherent, OTN-enabled ports:

```cli
otn-ports ports 34 channels 1 state admin-state enabled
otn-ports ports 34 state admin-state enabled
```

### Client and UNI port defaults

Good Port default settings for Client / UNI ports. MTU - Common: 9136 / 9216, Best (10.9.0+): 9700 / 9800

- `oc-if:interfaces interface <INTERFACE-ID> config mtu 9136` - oc-if: 9136, or 9700 on 10.9.0+
- `logical-ports logical-port <LOGICAL-PORT-ID> mtu 9216` - logical-port: 9216, or 9800 on 10.9.0+

LACP, LLDP and RSTP:

```cli
oc-if:interfaces interface <INTERFACE-ID> config agg-port-config agg-admin-mode agg-mode-manual
oc-if:interfaces interface <INTERFACE-ID> config agg-port-config lacp-activity lacp-passive
oc-if:interfaces interface <INTERFACE-ID> config lldp-port-config admin-status disabled
logical-ports logical-port <LOGICAL-PORT-ID> rstp-port-config admin-state disable
```

- NOTE: If building EPL with L2CP/L2CFT, you (most likely) want to disable LACP, LLDP, RSTP on the Client-facing/UNI port. Also, confirm MTU is properly configured throughout the entire path.
- Though RSTP is disabled globally by default, a peer found disabling the port RSTP resolved some issue with Cisco routers.

### Change port speed to/from 400G

Remove the binding and FPs first. Note: Remove the existing FP configuration associated to the logical port before changing the port speed.

```cli
no logical-ports logical-port 42 binding
oc-if:interfaces interface 42 config port-speed 400Gb
logical-ports logical-port 42 binding 42
```

### Coherent and tunable optics

**Coherent plug grid-spacing**

```cli
ptps ptp '33' properties transmitter grid-spacing value 50GHz
```

It did work for 2321 & 2111! (and appears to be required for 2321!)

**Tuning a T80 Tunable 10G SFP+ Transceiver:** Remove the FEC type set, and it should tune immediately.

**Coherent PMs to Navigator** (draft, unconfirmed): pm commands are required in order to deliver coherent PMs to Navigator.

```cli
pm optical-power-instances "36-OpticalPower" state admin-state enabled
pm modem-performance-instances "36-Modem" state admin-state enabled
```

**Advanced grep usage:** trick to show Power and Current on xcvrs.

```cli
show xcvrs xcvr 9 | grep Power\|Current
```

```text
|   Power State       | automatic |
|         Current                  | 20    |
|         Current                  | 3.39  |
|       Rx Power(dBm)              |       |
|         Current                  | -4.3  |
|       Tx Power(dBm)              |       |
|         Current                  | -40.0 |
```

### Link flap detection

Enabled per port (ports 1 to 48 shown):

```cli
oc-if:interfaces interface 1 config link-flap-detect true
oc-if:interfaces interface 2 config link-flap-detect true
oc-if:interfaces interface 3 config link-flap-detect true
oc-if:interfaces interface 4 config link-flap-detect true
oc-if:interfaces interface 5 config link-flap-detect true
oc-if:interfaces interface 6 config link-flap-detect true
oc-if:interfaces interface 7 config link-flap-detect true
oc-if:interfaces interface 8 config link-flap-detect true
oc-if:interfaces interface 9 config link-flap-detect true
oc-if:interfaces interface 10 config link-flap-detect true
oc-if:interfaces interface 11 config link-flap-detect true
oc-if:interfaces interface 12 config link-flap-detect true
oc-if:interfaces interface 13 config link-flap-detect true
oc-if:interfaces interface 14 config link-flap-detect true
oc-if:interfaces interface 15 config link-flap-detect true
oc-if:interfaces interface 16 config link-flap-detect true
oc-if:interfaces interface 17 config link-flap-detect true
oc-if:interfaces interface 18 config link-flap-detect true
oc-if:interfaces interface 19 config link-flap-detect true
oc-if:interfaces interface 20 config link-flap-detect true
oc-if:interfaces interface 21 config link-flap-detect true
oc-if:interfaces interface 22 config link-flap-detect true
oc-if:interfaces interface 23 config link-flap-detect true
oc-if:interfaces interface 24 config link-flap-detect true
oc-if:interfaces interface 25 config link-flap-detect true
oc-if:interfaces interface 26 config link-flap-detect true
oc-if:interfaces interface 27 config link-flap-detect true
oc-if:interfaces interface 28 config link-flap-detect true
oc-if:interfaces interface 29 config link-flap-detect true
oc-if:interfaces interface 30 config link-flap-detect true
oc-if:interfaces interface 31 config link-flap-detect true
oc-if:interfaces interface 32 config link-flap-detect true
oc-if:interfaces interface 33 config link-flap-detect true
oc-if:interfaces interface 34 config link-flap-detect true
oc-if:interfaces interface 35 config link-flap-detect true
oc-if:interfaces interface 36 config link-flap-detect true
oc-if:interfaces interface 37 config link-flap-detect true
oc-if:interfaces interface 38 config link-flap-detect true
oc-if:interfaces interface 39 config link-flap-detect true
oc-if:interfaces interface 40 config link-flap-detect true
oc-if:interfaces interface 41 config link-flap-detect true
oc-if:interfaces interface 42 config link-flap-detect true
oc-if:interfaces interface 43 config link-flap-detect true
oc-if:interfaces interface 44 config link-flap-detect true
oc-if:interfaces interface 45 config link-flap-detect true
oc-if:interfaces interface 46 config link-flap-detect true
oc-if:interfaces interface 47 config link-flap-detect true
oc-if:interfaces interface 48 config link-flap-detect true
```

### LAG and LACP

**Short config**

```cli
agg-global global-admin-state enabled
oc-if:interfaces interface LAGtb1 config name LAGtb1 type lag
oc-if:interfaces interface LAGtb1 config agg member-ports 19
oc-if:interfaces interface LAGtb1 config agg member-ports 18
logical-ports logical-port LAGtb1
oc-if:interfaces interface 18 config agg-port-config lacp-timeout lacp-timeout-short
oc-if:interfaces interface 19 config agg-port-config lacp-timeout lacp-timeout-short
```

**With-Defaults config** (to see all you can tweak)

```cli
oc-if:interfaces interface LAGtb1 config name LAGtb1 admin-status true type lag
oc-if:interfaces interface LAGtb1 config agg agg-actor-system-priority 32768 agg-admin-mode ciena-ext-lag:agg-mode-lacp lag-protection-mode ciena-ext-lag:lag-protection-mode-proprietary lag-protection-revert-state off lag-protection-revert-timer 5000 min-link-aggregation ciena-ext-lag:min-link-off min-link-threshold 1 multi-chassis ciena-ext-lag:multi-chassis-disable node-id 0
oc-if:interfaces interface LAGtb1 config agg member-ports 19 protection-port false
oc-if:interfaces interface LAGtb1 config agg member-ports 18 protection-port false
```

**To return port configs to non-LAG configs**

```cli
no logical-ports logical-port LAGtb1
no oc-if:interfaces interface LAGtb1
logical-ports logical-port 18 binding 18
logical-ports logical-port 19 binding 19
```

**Good show commands for LAG/LACP, MC-LAG**

- `show logical-ports` - Confirm LAG is up.
- `show agg agg`
- `show agg ports port 1`
- `clear icl statistics` - For MC-LAG
- `show icl instances`
- `show icl instance icl_ICL1`

**Good show commands for EV-LAG**

- `show bgp peers`
- `show evpn ethernet-segment name es-evlag1`
- `show evpn instances fxc forwarding-database` - if using FXC
- `show bgp evi evi 100 peers peer <IP-ADDRESS> advertised-routes`

### MACsec chassis options

As of Feb 2026 - SAOS10.11.2:

- 5184 -- (32) SFP56 (50G/25G/10G/1G). (4) QSFP-DD (400G/200G/100G)
- 8140 -- (8) 400G/200G/100G QSFP-DD, (40) 100G/25G/10G SFP-DD
- 8190 -- (36) 400G/200G/100G QSFP-DD
- 8192 -- (8/16) 800G/400G QSFP-DD800/QSFP-DD/QSFP112, (20) 400G/200G/100G QSFP112
- 3926-92x MACSEC Variant, (6) 10G/1G SFP+ (2) 1G SFP -- 2x Ports MACSEC
- 5136 100G -- 24x 25G/10G/1G SFP28, 4x 100G QSFP-DD - itemp
- 5171-Gen2
  - (8) 50/25/10G SFP56/SFP28/SFP+
  - (32) 25/10/1G SFP28/SFP+/SFP
- 8110/8114 -- MACSEC via FRU - (1) 200/100G QSFP-DD/QSP28, (1) 100G QSFP-DD/QSFP28

## MTU

### MTU Sizes

**Most common:**

- `logical-ports logical-port "<portNumber>" mtu 9216` - Logical-Port: 9216
- `oc-if:interfaces interface "<ipIntName>" mtu 9136` - L3 IP Interface (oc-if/ettp for type=ip, point-to-point, unnumbered): 9136

MPLS Pseudowire: 2000 (just used for signaling. Actual packets use L3 interface MTU.)

**Also popular (but must be 10.9.0+):**

- `logical-ports logical-port "<portNumber>" mtu 9800` - Logical-Port: 9800
- `oc-if:interfaces interface "<ipIntName>" mtu 9700` - L3 IP Int: 9700

**Maximum L3 MTU by platform (bytes):**

These are L3 IP interface limits, not logical-port MTU limits.

| Platform | Max L3 MTU (bytes) |
| --- | ---: |
| 5170 | 9660 |
| 5171 | 9660 |
| 8140 | 9600 |
| 8180 | 9312 |
| 8190 | 9600 |
| 8192 | 9600 |
| vRouter-BNG | 1990 |
| ALL others | 9700 |

**Some extra info on MTU**

- Limited number of unique MTU sizes: SAOS10 only supports 3 unique MTU sizes for L3 IP Interfaces, and some platforms only support 7 unique MTU sizes for L2 Logical-Ports.
- If using LinkAgg (LAG), match Logical-Port MTU of Agg and Member Ports - To-Do: Need to confirm this. Since the Logical port is not bound to the port anymore, I'm skeptical this is required.

- `logical-ports logical-port "<portNumber>.1" mtu 9800` - If using a Coherent Port with OTN-STND/OTN-MAX, append port# with ".1"
- `oc-if:interfaces interface "remote" config name "remote" mtu 9136` - Inband "remote" Management IP interface: Match to the rest of your L3 IP Interfaces, since it is "`type ip`" and traverses the same switches
- `oc-if:interfaces interface "mgmtbr0" type system mtu 1500` - Out-of-band MGMT Port IP Interface: 1500

### Where not to set MTU

Where the MTU setting is not allowed (or not necessary):

- Flow Point MTU: "`fps fp "<fpName>" mtu-size XXXXX`" - Currently (Feb'25, SAOS10.10.1), FP MTU is NOT a supported config and should not be used. (Sidenote: FP MTU might be added in the future, but as of SAOS10.10.1/Feb'25, nothing is on the roadmap.)
- L3 IP Loopback ("`oc-if:interface ... type loopback`")
- L2 Ethernet Port / ETTP ("`oc-if:interface ... type ettp`")
- L2 OC-IF LAG ("`oc-if:interface ... type lag`") - NOTE: Configure LAG MTU via: '`logical-ports logical-port "<lagName>" mtu xxx`', and make sure it is &gt;128 bytes to allow for LACP messages can transmit.

### MTU on SAOS6 and SAOS8

Other SAOS revs - current Port and IP max frame sizes.

**Port MTU**

- `port set port 10 max-frame-size 10000` - SAOS6 Max Port MTU = 12288 (default: 1526)
- `port set port 10 max-frame-size 10000` - SAOS8 Max Port MTU = 10000

SAOS10 Max Port MTU = 9800 (reqs 10.9.0+) ... so lowest common denominator is SAOS10's 9800.

**IP interface MTU**

- `interface set ip-interface intIP1 mtu 9216` - SAOS6 IP Interface Max MTU = 9216
- `interface set ip-interface intIP1 mtu 9216` - SAOS8 IP Interface Max MTU = 9216

**SAOS6 notes**

1) In SAOS6, IS-IS interface MTU is detached from the IP-Int MTU, and is a FIXED value of 1500, so you might need to disable padded-hello.

```cli
isis interface set ip-interface <IP-INT> padded-hello no
```

2) Benchmark reflectors on 3942 and 5142 devices do not reflect frames greater than 10,239 bytes.

3) The packet capture feature supports a maximum frame size of 1526 bytes.

### MTU with ISIS and MPLS

**MTU and ISIS**

If uncertain about L3 IP Interface MTU setting when using ISIS, set "hello-padding false" to disable the default behavior of validating a matching Interface MTU before neighboring up.

-- Pro Tip: If modifying a MTU sizes along an ISIS span, it is best to set to false to avoid ISIS from disconnecting when there is a mismatch when one side is changed.

- `isis instance ISIS1 interfaces interface <ipIntName> hello-padding false` - SAOS10
- `isis interface set ip-interface <ip-interface> padded-hello no` - SAOS6/8

**SAOS10 MPLS MTU**

In case of Static MPLS-TP, SAOS 10x:

- MetroLite/XGS (392x) as LSR: IP MTU and Logical-Port MTU are applied to data packets.
- MetroLite/XGS (392x) as LER, only Logical-Port MTU matters.
- DNX1/DNX2 (394x, 398x, 51xx, 81xx): Only Logical-Port MTU matters.

NOTE: In case of dynamic MPLS (LDP, SR) - not tested, but expected to be the same logic.

**Advanced MTU tricks**

- Customer might set MTU of Access/UNI ports to be lower than NNI ports.
  - e.g. Minus 4 bytes if VLAN UNI and QinQ NNI
  - Lil tough to manage, but nice to see the drops on the Access port.
- SAOS10 only supports up to 3 different MTU values across all ip-interfaces (unenforced)
- On 5164/66, A maximum of 7 unique MTU values are supported across all logical-ports (unenforced)

## IP and routing

### IP interfaces on DNX platforms

For SAOS10 81xx, 51xx, 398x, 394x (DNX chipset) - not the 392x/MetroLite/XGS, see the next section.

**Untagged IP Interface**

```cli
classifiers classifier Untagged filter-entry vtag-stack any untagged-exclude-priority-tagged true
fds fd fd_tb-unt mode vpls
oc-if:interfaces interface ip_tb-unt config name ip_tb-unt mtu 9100 description "IP Interface XYZ" role data type ip underlay-binding config fd fd_tb-unt
oc-if:interfaces interface ip_tb-unt ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length 30
fps fp fp5_tb-unt fd-name fd_tb-unt logical-port 5 classifier-list Untagged
```

**Tagged IP Interface**

```cli
classifiers classifier CLASSIFIER_999 filter-entry vtag-stack vtags 1 vlan-id 999
fds fd fd_tb999 mode vpls
oc-if:interfaces interface ip_tb999 config name ip_tb999 mtu 9100 description "IP Interface XYZ" role data type ip underlay-binding config fd fd_tb999
oc-if:interfaces interface ip_tb999 ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length 30
fps fp fp5_tb999 fd-name fd_tb999 logical-port 5 classifier-list CLASSIFIER_999
fps fp fp5_tb999 egress-l2-transform push-vid-999 vlan-stack 1 push-vid 999
fps fp fp5_tb999 ingress-l2-transform pop-vid vlan-stack 1 pop-type
```

**Dual-Stacked/QinQ/Double-Tagged IP Interface**

- Outer tag 999, Inner tag 888
- This assumes that NO other FP is using Outer-tag 999. If there is, then you need to use a Dual-Tag Classifier

```cli
classifiers classifier CLASSIFIER_999 filter-entry classifier:vtag-stack vtags 1 vlan-id 999
fds fd fd_tb999 mode vpls
fds fd fd_tb999 initiate-l2-transform vlan-stack 1 push-pcp map push-vid 888
oc-if:interfaces interface ip_tb999 config name ip_tb999 mtu 9136 type ip underlay-binding config fd fd_tb999
oc-if:interfaces interface ip_tb999 ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length 24
fps fp fp4_tb999 fd-name fd_tb999 logical-port 4 classifier-list CLASSIFIER_999
fps fp fp4_tb999 egress-l2-transform push-vid-999 vlan-stack 1 push-vid 999
fps fp fp4_tb999 ingress-l2-transform pop-vid vlan-stack 1 pop-type
```

### IP interfaces on 392x

For SAOS10 392x (3922, 3924, 3926, 3928) - MetroLite/XGS Chipset.

**Untagged IP Interface**

Chipset requires each FD to be assigned a system-unique VLAN. If none assigned, system will assume the Untagged virtual-switch.

```cli
classifiers classifier Untagged filter-entry vtag-stack any untagged-exclude-priority-tagged true
fds fd fd_Int1-Untagged mode vpls
oc-if:interfaces interface ip-Int1-Untagged config name ip-Int1-v4089 mtu 9100 role data type ip underlay-binding config fd fd_Int1-Untagged
oc-if:interfaces interface ip-Int1-Untagged ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length 30
fps fp fp9_Int1-Untagged fd-name fd_Int1-v4089 logical-port 9 stats-collection on classifier-list Untagged
```

**Tagged IP Interface**

- Chipset requires FD to be assigned a system-unique VLAN.
- To push a VLAN on egress, you can either use the FD's "initiate-l2-transform" or use a Push on Egress FP.

```cli
classifiers classifier CLASSIFIER_4088 filter-entry vtag-stack vtags 1 vlan-id 4088
fds fd fd_Int1-v4088 mode vpls vlan-id 4088
fds fd fd_Int1-v4088 initiate-l2-transform vlan-stack 1 push-pcp pcp-5 push-vid 4088
oc-if:interfaces interface ip-Int1-v4088 config name ip-Int1-v4088 mtu 9100 role data type ip underlay-binding config fd fd_Int1-v4088
oc-if:interfaces interface ip-Int1-v4088 ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length 30
fps fp fp9_Int1-v4088 fd-name fd_Int1-v4088 logical-port 9 stats-collection on classifier-list CLASSIFIER_4088
```

### Static route, ECMP and BFD

**Add an IP Route**

- `rib vrf default ipv4 0.0.0.0/0 next-hop <gateway IP> description "default GW" tag 0` - Add a default route
- `no rib vrf default ipv4 0.0.0.0/0` - To remove

**Enable ECMP** (off by default)

```cli
routing ecmp enable true
```

**Common IP-BFD Profiles**

```cli
bfd profiles ip-bfd-profile Profile-10ms accelerate true desired-min-tx-interval 10000 local-multiplier 3 required-min-rx-interval 10000
bfd profiles ip-bfd-profile Profile-3.3ms accelerate true desired-min-tx-interval 3300 local-multiplier 3 required-min-rx-interval 3300
```

### Popular Routing Commands

```cli
show ip interfaces brief
show ip routes
show tp-tunnel
show pseudowires
show vrfs
show ldp sessions
show ldp adjacencies
show isis summary
show isis route
show isis topology
show bfd sessions
show segment-routing connected-prefix-sid-map
show mpls forwarding-table
show isis segment-routing
show isis lfa-routes
show isis ti-lfa-routes
show ldp adjacencies
show ldp interfaces
show bgp peers
show bgp routes vpnv4/vpnv6
show bgp vrf vrf <l3vpn_vrf> routes
show evpn ethernet-segment name es-evlag1
show evpn instances fxc forwarding-database
show evpn instances fxc service-tunnels
```

**Important MPLS show commands**

- `show mpls ftn-table` - This table tells the router which packets that arrive unlabeled can support mpls forwarding. If a label is not found here the routing table will be checked next.
- `show mpls ftn-backup-table` - This table represents forwarding entries for LFA/TI-LFA
- `show mpls ilm-table` - This table helps the router swap labels inbound with labels outbound
- `show isis lfa-routes` - LFA routes or single segment TI-LFA routes
- `show isis ti-lfa-routes` - Double segment TI-LFA routes

### LFA and TI-LFA

**TI-LFA good commands**

Configure in OSPF (10.10.0):

```cli
ospf instance 0 fast-reroute lfa per-prefix-enable true
ospf instance 0 areas area 0.0.0.0 fast-reroute ti-lfa enable true
```

- `show ospf ti-lfa-routes` - To check TI-LFA routes under OSPF
- `show mpls ftn-table` - To check mpls FEC to Nexthop table
- `show mpls ftn-backup-table` - To check mpls FEC to Nexthop table for backup path

**Understanding LFA, TI-LFA, and FTN-Table**

- LFA table: per-prefix backup neighbor for classic FRR (no extra label stack).
- TI-LFA table: per-prefix SR-aware repair path when LFA alone is insufficient.
- FTN table: the actual MPLS programming:
  - O \* &gt; = primary path
  - O b (no inner labels) = LFA FRR
  - O b (with inner label stack) = TI-LFA FRR

### OSPF deployment tips

- Set auto-cost on all OSPF nodes (Core, Tower, Nokia) - "`ospf instance 1 auto-cost enable true reference-bandwidth 200`" -&gt; Set to highest speed of network (200Gbps)
- Set OSPF Interfaces to Metrics 10000 on Nokia spans -&gt; since 2:1 cost difference for Ciena 200G core might not be enough to avoid going over the Nokia (especially if you don't set the ref-bw on the Nokias and it claims costs are like 1 or 2 for some links.)
- Set OSPF Interfaces to 'lfa-candidate-enable false' facing Nokias AND Tower 3924s -&gt; assures that MPLS FRR calculations do not include these interfaces in their calculations.

## L2 services and OAM

### VLAN and QinQ classification

Advanced details about VLAN and QinQ classifying, aka: assigning a Port's VLAN(s) to a Flow-Point (FP) and attaching it to the Forwarding Domain (FD).

EPL classification generally means a single flow point on a logical port with a classification of untagged + tagged-all.

Other flow points can be configured with single or double-tagged classification in addition to an EPL flow-point and will take precedence over the EPL flow point.

Double tagged classifiers take precedence over single tagged classifiers with same outer-vid value.

Single tagged and double tagged classifiers take precedence over tagged-all classification.

CVID bundling is achieved by individually adding multiple classifiers to the same flow point.

CVID range means classifying multiple CVIDs to the same flow point by attaching a single classifier. CVID range is achieved by attaching a single ranged classifier to the flow point. CVID range (without H/W optimization) acts as a bundled CVID when added to a flow point, which means all VIDs in a range would use hardware resources on an individual basis rather than a single ranged hardware resource.

VLAN-tagged classifiers are categorized into two types: outer tags and inner tags. A classifier can be configured with only an outer tag or with both outer and inner tags. Each type of tag, whether outer or inner, has the capability to support a range of Customer VLAN IDs (CVIDs).

**Note: The CVID range cannot be simultaneously supported on both outer and inner tags. The system allows for the CVID range to be applied to only one tag type at a time. The CVID range can either be associated with the outer tag or the inner tag, but not both concurrently.**

### Dual-tagged classifiers

Dual-Tagged Classifiers are supported on 51xx, 81xx, 394x and 398x devices. (No support on 392x devices.)

Below are two sample configs, that were running at the same time, both using the same SVLAN (100) on port 21, but each service classified on the Outer+Inner VLAN.

Precedence rules with classifiers on the same port:

- Double tagged classifiers take precedence over single tagged classifiers with same outer-vid value.
- Single tagged and double tagged classifiers take precedence over tagged-all classification.

**Service 1:** Double-Tagged (s100:c10) on ENNI Port (21), Single Tagged (vlan10) on UNI Port (22). Classifiers, then the forwarding domain, then the FPs for port 21 and port 22.

```cli
classifiers classifier "CLASSIFIER_100:10" filter-entry "classifier:vtag-stack" vtags "1" vlan-id 100
classifiers classifier "CLASSIFIER_100:10" filter-entry "classifier:vtag-stack" vtags "2" vlan-id 10
classifiers classifier "CLASSIFIER_10" filter-entry "classifier:vtag-stack" vtags "1" vlan-id 10
fds fd "evpl-s100c10-to-c10-tb1" description "evpl-s100c10-to-c10-tb1" mode vpws
fps fp "21_evpl-s100c10-to-c10-tb1_1" fd-name "evpl-s100c10-to-c10-tb1" logical-port "21" classifier-list-precedence 100 stats-collection on classifier-list "CLASSIFIER_100:10"
fps fp "21_evpl-s100c10-to-c10-tb1_1" ingress-l2-transform "ingressTransform" vlan-stack "1" pop-type
fps fp "21_evpl-s100c10-to-c10-tb1_1" egress-l2-transform "egressTransform" vlan-stack "1" push-pcp map push-vid 100
fps fp "22_evpl-s100c10-to-c10-tb1_1" fd-name "evpl-s100c10-to-c10-tb1" logical-port "22" classifier-list-precedence 100 stats-collection on classifier-list "CLASSIFIER_10"
```

**Service 2:** Double-Tagged (s100:c20) on both ports (21 and 23).

```cli
classifiers classifier "CLASSIFIER_100:20" filter-entry "classifier:vtag-stack" vtags "1" vlan-id 100
classifiers classifier "CLASSIFIER_100:20" filter-entry "classifier:vtag-stack" vtags "2" vlan-id 20
fds fd "evpl-s100c20-to-s100c20-tb2" description "evpl-s100c20-to-s100c20-tb2" mode vpws
fps fp "21_evpl-s100c20-to-s100c20-tb2_1" fd-name "evpl-s100c20-to-s100c20-tb2" logical-port "21" classifier-list-precedence 1 stats-collection on classifier-list "CLASSIFIER_100:20"
fps fp "23_evpl-s100c20-to-s100c20-tb2_1" fd-name "evpl-s100c20-to-s100c20-tb2" logical-port "23" classifier-list-precedence 100 stats-collection on classifier-list "CLASSIFIER_100:20"
```

### MAC learning in SAOS6, 8 and 10

**In SAOS6, MAC Learning is enabled at the Virtual Switch and the VLAN**

To view:

```cli
flow show mac-addr
```

To disable:

```cli
flow learning disable vlan <vlan name>
flow learning disable vs <vs name>
```

**In SAOS8, a VS with only two sub-ports attached will NOT enable MAC-Learning**

Tip: To force a VS to MAC-Learn (for troubleshooting), create/attach a dummy Agg sub-port, to confirm we were seeing the traffic from the expected neighbors. The dummy Agg is there so I don't have to use a real 'parent-port'.

```cli
aggregation create agg DummyPort
sub-port create sub-port DummySubPort parent-port DummyPort classifier-precedence 1337
virtual-switch interface attach sub-port DummySubPort vs <vs_name>
mac-addr show vs <vs_name>
```

**MAC Learning in SAOS10**

In SAOS10, if a Flow Domain ('fds fd ...') is configured with 'mode vpws' then MAC-Learning is NOT enabled (since it's a point-to-point service).

- '`fds fd <name> mac-learning enabled`' is not allowed on VPWS FDs

- '`fps fp <name> mac-learning enabled`' doesn't do anything for VPWS FPs

- To enable MAC-Learning on a VPWS EVC, delete/rebuilt ELINE EVC as ELAN in MCP or de/reconfig FD as 'mode vpls' in CLI

In SAOS10, if an FD is 'mode vpls' then MAC-Learning IS enabled (since VPLS allows &gt;2 end-points).

To view:

```cli
show mac-fdbs forwarding-domain <FD_NAME>
```

- For SAOS10 FPs and VPLS FDs, "`fps fp <name> mac-learning enabled`" and "`fds fd <name> mac-learning enabled`" are set by default, but they don't show up in "`show run config with-defaults`." If desired, they can be disabled.

### 392x EPL and EPLAN examples

For 392x (XGS).

**EPL (builds as VPWS)** - no CFM enabled -- UNI-to-ENNI

```cli
classifiers classifier CLASSIFIER_1337 filter-entry vtag-stack vtags 1 vlan-id 1337
classifiers classifier CLASSIFIER_4096 filter-entry vtag-stack untagged-exclude-priority-tagged false
classifiers classifier CLASSIFIER_4097 filter-entry vtag-stack logical-not false vtags 1
fds fd test1020-tb description test1020-tb mode vpws vlan-id 1337
fps fp 2_test1020-tb_1 fd-name test1020-tb logical-port 2 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_4096 CLASSIFIER_4097
fps fp 2_test1020-tb_1 ingress-l2-transform ingressTransform vlan-stack 1 push-pcp map push-vid 1337
fps fp 2_test1020-tb_1 egress-l2-transform egressTransform vlan-stack 1 pop-type
fps fp 6_test1020-tb_1 fd-name test1020-tb logical-port 6 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_1337
fps fp 6_test1020-tb_1 egress-l2-transform egressTransform vlan-stack 1 stamp-tpid tpid-8100 stamp-pcp map
```

**EPLAN (builds as VPLS)** - no CFM enabled

```cli
classifiers classifier CLASSIFIER_1337 filter-entry vtag-stack vtags 1 vlan-id 1337
classifiers classifier CLASSIFIER_4096 filter-entry vtag-stack untagged-exclude-priority-tagged false
classifiers classifier CLASSIFIER_4097 filter-entry vtag-stack logical-not false vtags 1
fds fd test2-tb123 description test2-tb123 mode vpls vlan-id 1337
fps fp 2_test2-tb123_1 fd-name test2-tb123 logical-port 2 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_4096 CLASSIFIER_4097
fps fp 2_test2-tb123_1 ingress-l2-transform ingressTransform vlan-stack 1 push-pcp map push-vid 1337
fps fp 2_test2-tb123_1 egress-l2-transform egressTransform vlan-stack 1 pop-type
fps fp 6_test2-tb123_1 fd-name test2-tb123 logical-port 6 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_1337
fps fp 6_test2-tb123_1 egress-l2-transform egressTransform vlan-stack 1 stamp-tpid tpid-8100 stamp-pcp map
```

**EPLAN with CFM** - (uni) port 2 to port 6 (nni) ... (nni) port 6 to port 2 (uni)

A-End:

```cli
classifiers classifier CLASSIFIER_2014 filter-entry vtag-stack vtags 1 vlan-id 2014
classifiers classifier CLASSIFIER_4096 filter-entry vtag-stack untagged-exclude-priority-tagged false
classifiers classifier CLASSIFIER_4097 filter-entry vtag-stack logical-not false vtags 1
maintenance-domain md3 name-type character-string name md3 mhf-creation none id-permission chassis
fds fd tbtest123 description tbtest123 mode vpls vlan-id 2014
fps fp 6_tbtest123_1 fd-name tbtest123 logical-port 6 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_2014
fps fp 6_tbtest123_1 egress-l2-transform egressTransform vlan-stack 1 stamp-tpid tpid-8100 stamp-pcp map
fps fp 2_tbtest123_1 fd-name tbtest123 logical-port 2 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_4096 CLASSIFIER_4097
fps fp 2_tbtest123_1 ingress-l2-transform ingressTransform vlan-stack 1 push-pcp map push-vid 2014
fps fp 2_tbtest123_1 egress-l2-transform egressTransform vlan-stack 1 pop-type
maintenance-domain md3 maintenance-association tbtest123 name-type character-string name tbtest123 ccm-interval 100ms component-list 1 fd-name tbtest123
maintenance-domain md3 maintenance-association tbtest123 maintenance-association-end-point 2 interface 2_tbtest123_1 direction up administrative-state true ccm-ltm-priority 4
maintenance-domain md3 maintenance-association tbtest123 maintenance-association-end-point 2 continuity-check cci-enabled true lowest-fault-priority-defect invalid-ccm fng-alarm-time 0
maintenance-domain md3 maintenance-association tbtest123 maintenance-association-end-point 2 delay-measurements delay-measurement-config 1 operation-type create remote-mep-id 1 priority 5 frame-size 1400 start-time-type immediate stop-time-type none test-id 1
```

Z-End:

```cli
classifiers classifier CLASSIFIER_2014 filter-entry vtag-stack vtags 1 vlan-id 2014
classifiers classifier CLASSIFIER_4096 filter-entry vtag-stack untagged-exclude-priority-tagged false
classifiers classifier CLASSIFIER_4097 filter-entry vtag-stack logical-not false vtags 1
maintenance-domain md3 name-type character-string name md3 mhf-creation none id-permission chassis
fds fd tbtest123 description tbtest123 mode vpls vlan-id 2014
fps fp 2_tbtest123_1 fd-name tbtest123 logical-port 2 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_4096 CLASSIFIER_4097
fps fp 2_tbtest123_1 ingress-l2-transform ingressTransform vlan-stack 1 push-pcp map push-vid 2014
fps fp 2_tbtest123_1 egress-l2-transform egressTransform vlan-stack 1 pop-type
fps fp 6_tbtest123_1 fd-name tbtest123 logical-port 6 classifier-list-precedence 100 stats-collection on classifier-list CLASSIFIER_2014
fps fp 6_tbtest123_1 egress-l2-transform egressTransform vlan-stack 1 stamp-tpid tpid-8100 stamp-pcp map
maintenance-domain md3 maintenance-association tbtest123 name-type character-string name tbtest123 ccm-interval 100ms component-list 1 fd-name tbtest123
maintenance-domain md3 maintenance-association tbtest123 maintenance-association-end-point 1 interface 2_tbtest123_1 direction up administrative-state true ccm-ltm-priority 4
maintenance-domain md3 maintenance-association tbtest123 maintenance-association-end-point 1 continuity-check cci-enabled true lowest-fault-priority-defect invalid-ccm fng-alarm-time 0
maintenance-domain md3 maintenance-association tbtest123 maintenance-association-end-point 1 delay-measurements delay-measurement-config 1 operation-type create remote-mep-id 2 priority 5 frame-size 1400 start-time-type immediate stop-time-type none test-id 1
```

### CFM show commands

If using Services with CFM enabled:

- `sh cfm meps` - You want to "Active Defects" column blank, but some error are even acceptable, like remote-defect might just mean the UNI port is down, but transport path is up and running.
- `sh cfm meps md-id <md-id> ma-id <name> local-mep-id <local-id>` - Great for seeing TX/RX Packets to confirm you have end-to-end connectivity.
- `sh cfm delay-measurements md-id <md-id> ma-id <name> local-mep-id <local-id>` - Great for seeing Packet Latency and Jitter across the service.

### Ethernet OAM and performance measurements

Configure CFM, Ethernet OAM, and performance-measurement sessions using the platform's CLI help and supported feature documentation. Before relying on measurements, verify both request and reply paths on the target platform.

### G.8032 ERP

- g8032-ring = "Logical Ring". Logical Rings are the physical port/spans.
- erp-instance = "Virtual Ring". Multiple Virtual Rings in a Single Logical Ring, like for Counter-rotating rings by applying RPLO on different ports.

- `show ring-protection g8032-ring ring MR-WL-CR-IC-tb1-log` - Logical Ring
- `show ring-protection erp-instance instance MR-WL-CR-IC-tb1-virt` - Virtual Ring

Data members of a Virtual Ring:

```cli
g8032-rings g8032-ring "Logical_Ring_Name" erp-instances erp-instance "Virtual_Ring_name" data-members "E-Line_Name"
```

Sample config, as shown by "`show run config section g8032-rings`":

```cli
g8032-rings
g8032-ring "LR3100"
ring-id 123
ring-ports
ring-port "port0" interface "LAG3"
ring-port "port1" interface "34"
exit
exit
exit
g8032-rings g8032-ring "LR3100" erp-instances erp-instance "VR-3100" raps-vid 3100 raps-level 0 erp-instance-construct g8032:major-ring ports port "port0"
g8032-rings g8032-ring "LR3100" erp-instances erp-instance "VR-3100" ports port "port1"
exit
exit
exit
exit
exit
exit
```

### DHCP L2 relay

Came out in SAOS 10.10.0.

```cli
dhcpv4-l2-relay-agent admin-status enabled
dhcpv4-l2-relay-agent instance fd_v105 admin-status enabled option82 true existing-option82 allow circuit-id-type circuit-id-fp remote-id-type remote-id-device-mac
```

- `dhcpv4-l2-relay-agent instance fd_v105 flow-point fd105-p13 trust-mode untrusted` - Apply DHCP Snooping. Apply "trusted" on FP facing your DHCP Server
- `dhcpv4-l2-relay-agent instance fd_v105 flow-point fd105-p13 static-snooping-binding <MAC-ADDRESS> <IP-ADDRESS>` - I think these are optional

**DHCP L2 Relay Options**

existing-option82 &lt;OPTION&gt;:

- Specify "block" to block the DHCP request which already have option82. (default)
- Specify "allow" to forward the DHCP request with existing option82 without modifying option82.
- Specify "replace" to replace the existing option82 before forwarding the DHCP request.

circuit-id-type &lt;OPTION&gt;:

- Specify "circuit-id-type" to set the type of circuit ID sub-option as the flow point name. (default)
- Specify "circuit-id-string" to set the type of circuit ID sub-option as a string, as defined by the "circuit-id &lt;string&gt;" on the FP option when enabling relay on the FP. (eg "dhcpv4-l2-relay-agent instance "fd_v105" flow-point "fd105-p13" circuit-id CIRCUIT123")

remote-id-type &lt;OPTION&gt;:

- Specify "remote-id-device-mac" to use the MAC address of the device. (default)
- Specify "remote-id-hostname" to use the hostname of the device.
- Specify "remote-id-string remote-id &lt;STRING&gt;" to use a string.

Example with circuit-id and remote-id strings:

```cli
dhcpv4-l2-relay-agent instance "fd_v105" flow-point "fd105-p13" circuit-id "dhcp-client"
dhcpv4-l2-relay-agent instance "fd_v105" admin-status enabled circuit-id-type dhcp-types:circuit-id-string remote-id-type dhcp-types:remote-id-string remote-id "dhcp123"
dhcpv4-l2-relay-agent instance "fd_v105" flow-point "fd105-p13" circuit-id "dhcp-client"
dhcpv4-l2-relay-agent instance "fd_v105" flow-point "fp105-p8" circuit-id "dhcp-client"
```

## QoS

### Global Scheduler and Percent Shaper

```cli
egress-qos scheduler-profile scheduler-auto tap-point-count 8 scheduling-algorithm wrr eir-percent 100 ebs 256 eir-policy eir-as-percent tap-point 0 priority 0 weight 2
egress-qos scheduler-profile scheduler-auto tap-point 1 priority 1 weight 4
egress-qos scheduler-profile scheduler-auto tap-point 2 priority 2 weight 8
egress-qos scheduler-profile scheduler-auto tap-point 3 priority 3 weight 12
egress-qos scheduler-profile scheduler-auto tap-point 4 priority 4 weight 30
egress-qos scheduler-profile scheduler-auto tap-point 5 priority 5 weight 44
egress-qos scheduler-profile scheduler-auto tap-point 6 priority 6 weight 0
egress-qos scheduler-profile scheduler-auto tap-point 7 priority 7 weight 0
egress-qos queue-group-profile scheduler-auto queue-count 8 cos-queue-map default-ctq-8q queue 0 eir-percent 100 ebs 256
egress-qos queue-group-profile scheduler-auto queue 1 eir-percent 100 ebs 256
egress-qos queue-group-profile scheduler-auto queue 2 eir-percent 100 ebs 256
egress-qos queue-group-profile scheduler-auto queue 3 eir-percent 100 ebs 256
egress-qos queue-group-profile scheduler-auto queue 4 eir-percent 100 ebs 256
egress-qos queue-group-profile scheduler-auto queue 5 eir-percent 100 ebs 256
egress-qos queue-group-profile scheduler-auto queue 6 eir-percent 100 ebs 256
egress-qos queue-group-profile scheduler-auto queue 7 eir-percent 100 ebs 256
```

**Apply Shaper Compensation &amp; Calculation Mode**

```cli
egress-qos queue-group-profile scheduler-auto shaper-compensation 100
bw-calculation-mode eqos-bw-calculation-mode payload
```

**Enable QoS Scheduler per Port**

```cli
egress-qos scheduler scheduler-lp01 scheduler-profile scheduler-auto instance-id 1 parent-port 1
```

**Queue Group Instance per Logical Port**

```cli
egress-qos queue-group scheduler-lp01 queue-group-profile scheduler-auto instance-id 1 parent-scheduler scheduler-lp01 stats-collection on
```

**Interface QoS Binding per Logical Port**

```cli
interface-qos-binding interface-qos-binding scheduler-lp01 queue-group-instance scheduler-lp01 logical-port 1
```

**Schedule/Queue-Group Show Commands**

```cli
show scheduler-profiles
show scheduler-instances
show queue-group-instances
show queue-group-instances queue-group-instance scheduler-lp30
```

### uOLT 8.5G scheduler and shaper

Sample Scheduler &amp; Queue Group Profile uOLT Shaper (8.5G).

```cli
egress-qos scheduler-profile scheduler-OLT-10G tap-point-count 8 scheduling-algorithm wrr eir 8550000 ebs 32 eir-policy auto-adjust-disabled tap-point 0 priority 0 weight 2
egress-qos scheduler-profile scheduler-OLT-10G tap-point 1 priority 1 weight 4
egress-qos scheduler-profile scheduler-OLT-10G tap-point 2 priority 2 weight 8
egress-qos scheduler-profile scheduler-OLT-10G tap-point 3 priority 3 weight 12
egress-qos scheduler-profile scheduler-OLT-10G tap-point 4 priority 4 weight 30
egress-qos scheduler-profile scheduler-OLT-10G tap-point 5 priority 5 weight 44
egress-qos scheduler-profile scheduler-OLT-10G tap-point 6 priority 6 weight 0
egress-qos scheduler-profile scheduler-OLT-10G tap-point 7 priority 7 weight 0
egress-qos queue-group-profile scheduler-OLT-10G queue-count 8 cos-queue-map default-ctq-8q queue 0 eir 8550000 ebs 32
egress-qos queue-group-profile scheduler-OLT-10G queue 1 eir 8550000 ebs 32
egress-qos queue-group-profile scheduler-OLT-10G queue 2 eir 8550000 ebs 32
egress-qos queue-group-profile scheduler-OLT-10G queue 3 eir 8550000 ebs 32
egress-qos queue-group-profile scheduler-OLT-10G queue 4 eir 8550000 ebs 32
egress-qos queue-group-profile scheduler-OLT-10G queue 5 eir 8550000 ebs 32
egress-qos queue-group-profile scheduler-OLT-10G queue 6 eir 8550000 ebs 32
egress-qos queue-group-profile scheduler-OLT-10G queue 7 eir 8550000 ebs 32
egress-qos queue-group-profile scheduler-OLT-10G shaper-compensation 100
```

### Three-queue QoS sample

**Congestion Avoidance Profiles All Queues**

```cli
egress-qos congestion-avoidance-profile "Q0-Q2_WRED" type wred config-form custom drop-rate-exponent 2 max-queue-depth 120ms
egress-qos congestion-avoidance-profile "Q0-Q2_WRED" curve "1" lower-threshold 100 upper-threshold 100 max-drop-probability 100
egress-qos congestion-avoidance-profile "Q0-Q2_WRED" curve "2" lower-threshold 50 upper-threshold 85 max-drop-probability 100
egress-qos congestion-avoidance-profile "Q3-Q4_WRED" type wred config-form custom drop-rate-exponent 2 max-queue-depth 10ms
egress-qos congestion-avoidance-profile "Q3-Q4_WRED" curve "1" lower-threshold 100 upper-threshold 100 max-drop-probability 100
egress-qos congestion-avoidance-profile "Q3-Q4_WRED" curve "2" lower-threshold 60 upper-threshold 96 max-drop-probability 100
egress-qos congestion-avoidance-profile "Q5-Q7_WRED" type wred config-form custom drop-rate-exponent 2 max-queue-depth 1ms
egress-qos congestion-avoidance-profile "Q5-Q7_WRED" curve "1" lower-threshold 100 upper-threshold 100 max-drop-probability 100
egress-qos congestion-avoidance-profile "Q5-Q7_WRED" curve "2" lower-threshold 80 upper-threshold 96 max-drop-probability 100
```

**1G/10G/100G Port Queue Group Profile - Number of queues/Congestion Avoidance**

1G:

```cli
egress-qos queue-group-profile QGProfile-1G-Default queue-count 8 queue 0 congestion-avoidance-profile Q0-Q2_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-1G-Default queue 1 congestion-avoidance-profile Q0-Q2_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-1G-Default queue 2 congestion-avoidance-profile Q0-Q2_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-1G-Default queue 3 congestion-avoidance-profile Q3-Q4_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-1G-Default queue 4 congestion-avoidance-profile Q3-Q4_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-1G-Default queue 5 congestion-avoidance-profile Q5-Q7_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-1G-Default queue 6 congestion-avoidance-profile Q5-Q7_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-1G-Default queue 7 congestion-avoidance-profile Q5-Q7_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
```

10G:

```cli
egress-qos queue-group-profile QGProfile-10G-Default queue-count 8 queue 0 congestion-avoidance-profile Q0-Q2_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-10G-Default queue 1 congestion-avoidance-profile Q0-Q2_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-10G-Default queue 2 congestion-avoidance-profile Q0-Q2_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-10G-Default queue 3 congestion-avoidance-profile Q3-Q4_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-10G-Default queue 4 congestion-avoidance-profile Q3-Q4_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-10G-Default queue 5 congestion-avoidance-profile Q5-Q7_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-10G-Default queue 6 congestion-avoidance-profile Q5-Q7_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-10G-Default queue 7 congestion-avoidance-profile Q5-Q7_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
```

100G:

```cli
egress-qos queue-group-profile QGProfile-100G-Default queue-count 8 queue 0 congestion-avoidance-profile Q0-Q2_WRED cir 10000000 cbs 128 eir 10000000 ebs 128
egress-qos queue-group-profile QGProfile-100G-Default queue 1 congestion-avoidance-profile Q0-Q2_WRED cir 100000000 cbs 128 eir 100000000 ebs 128
egress-qos queue-group-profile QGProfile-100G-Default queue 2 congestion-avoidance-profile Q0-Q2_WRED cir 100000000 cbs 128 eir 100000000 ebs 128
egress-qos queue-group-profile QGProfile-100G-Default queue 3 congestion-avoidance-profile Q3-Q4_WRED cir 100000000 cbs 128 eir 100000000 ebs 128
egress-qos queue-group-profile QGProfile-100G-Default queue 4 congestion-avoidance-profile Q3-Q4_WRED cir 100000000 cbs 128 eir 100000000 ebs 128
egress-qos queue-group-profile QGProfile-100G-Default queue 5 congestion-avoidance-profile Q5-Q7_WRED cir 100000000 cbs 128 eir 100000000 ebs 128
egress-qos queue-group-profile QGProfile-100G-Default queue 6 congestion-avoidance-profile Q5-Q7_WRED cir 100000000 cbs 128 eir 100000000 ebs 128
egress-qos queue-group-profile QGProfile-100G-Default queue 7 congestion-avoidance-profile Q5-Q7_WRED cir 100000000 cbs 128 eir 100000000 ebs 128
```

**1G/10G/100G Scheduler Profile**

1G:

```cli
egress-qos scheduler-profile SchProfile-1G-Default tap-point-count 8 scheduling-algorithm sp cir 1000000 cbs 128 eir 1000000 ebs 128 cir-policy auto-adjust-disabled eir-policy auto-adjust-disabled tap-point 0 priority 0 weight 10
egress-qos scheduler-profile SchProfile-1G-Default tap-point 1 priority 1 weight 20
egress-qos scheduler-profile SchProfile-1G-Default tap-point 2 priority 2 weight 30
egress-qos scheduler-profile SchProfile-1G-Default tap-point 3 priority 3 weight 40
egress-qos scheduler-profile SchProfile-1G-Default tap-point 4 priority 4 weight 50
egress-qos scheduler-profile SchProfile-1G-Default tap-point 5 priority 5 weight 0
egress-qos scheduler-profile SchProfile-1G-Default tap-point 6 priority 6 weight 0
egress-qos scheduler-profile SchProfile-1G-Default tap-point 7 priority 7 weight 0
```

10G:

```cli
egress-qos scheduler-profile SchProfile-10G-Default tap-point-count 8 scheduling-algorithm wfq cir 10000000 cbs 128 eir 10000000 ebs 128 cir-policy auto-adjust-disabled eir-policy auto-adjust-disabled tap-point 0 priority 0 weight 10
egress-qos scheduler-profile SchProfile-10G-Default tap-point 1 priority 1 weight 20
egress-qos scheduler-profile SchProfile-10G-Default tap-point 2 priority 2 weight 30
egress-qos scheduler-profile SchProfile-10G-Default tap-point 3 priority 3 weight 40
egress-qos scheduler-profile SchProfile-10G-Default tap-point 4 priority 4 weight 50
egress-qos scheduler-profile SchProfile-10G-Default tap-point 5 priority 5 weight 0
egress-qos scheduler-profile SchProfile-10G-Default tap-point 6 priority 6 weight 0
egress-qos scheduler-profile SchProfile-10G-Default tap-point 7 priority 7 weight 0
```

100G:

```cli
egress-qos scheduler-profile SchProfile-100G-Default tap-point-count 8 scheduling-algorithm wfq cir 1000000000 cbs 128 eir 1000000000 ebs 128 cir-policy auto-adjust-disabled eir-policy auto-adjust-disabled tap-point 0 priority 0 weight 10
egress-qos scheduler-profile SchProfile-100G-Default tap-point 1 priority 1 weight 20
egress-qos scheduler-profile SchProfile-100G-Default tap-point 2 priority 2 weight 30
egress-qos scheduler-profile SchProfile-100G-Default tap-point 3 priority 3 weight 40
egress-qos scheduler-profile SchProfile-100G-Default tap-point 4 priority 4 weight 50
egress-qos scheduler-profile SchProfile-100G-Default tap-point 5 priority 5 weight 0
egress-qos scheduler-profile SchProfile-100G-Default tap-point 6 priority 6 weight 0
egress-qos scheduler-profile SchProfile-100G-Default tap-point 7 priority 7 weight 0
```

## SNMP and monitoring

### SNMP config walkthrough and notes

**SNMP Config Template**

```cli
snmp agent admin-state [ enabled | disable ]
snmp vacm view <ViewName> include <subtree>
snmp vacm view <ViewName> exclude <subtree>
snmp vacm group <GroupName> member <SecurityName> security-model [ v1 | v2c | usm ]
snmp vacm group <GroupName> access "*" [ v1 | v2c | usm ] [ no-auth-no-priv | auth-no-priv | auth-priv ] context-match exact read-view <ViewName> notify-view <ViewName>
snmp target-params <TargetParams> [ v1 | v2c | usm ] security-name <SecurityName>
snmp community <UniqueName> text-name <CommunityName> security-name <SecurityName>
snmp target <TargetName> target-params <TargetParams> timeout <timeout> retries <retries> udp ip <ip> port <port> prefix-length <prefix>
snmp target <TargetName> tag <TargetTag>
snmp notify <NotifyName> tag <TargetTag> type [ trap | inform ]
```

**Sample SNMPv2c Config**

```cli
snmp agent admin-state enable
snmp vacm view ISP1-View include iso
snmp vacm view ISP1-View exclude snmpResearch
snmp vacm group ISP1-GroupV2C member <SECURITY-NAME> security-model v2c
snmp vacm group ISP1-GroupV2C access "" v2c no-auth-no-priv context-match exact read-view ISP1-View notify-view ISP1-View
snmp community <COMMUNITY-NAME> text-name <COMMUNITY-STRING> security-name <SECURITY-NAME>
snmp target-params ISP1-TargetParams v2c security-name <SECURITY-NAME>
snmp target ISP1-AlarmTarget-1 target-params ISP1-TargetParams udp ip <IP-ADDRESS> prefix-length 32
snmp target ISP1-AlarmTarget-1 retries 3
snmp target ISP1-AlarmTarget-1 tag ISP1-Tag
snmp target ISP1-AlarmTarget-2 target-params ISP2-TargetParams udp ip <IP-ADDRESS> prefix-length 32
snmp target ISP1-AlarmTarget-2 retries 3
snmp target ISP1-AlarmTarget-2 tag ISP2-Tag
snmp notify ISP1-Trap1 tag ISP1-Tag type trap
snmp notify ISP1-Inform1 tag ISP2-Tag type inform
```

**SNMP: View Include/Exclude Notes**

- Sample include/exclude subtrees values: \*, iso, snmpResearch, private, internet

- The 'include' entry has a higher priority than an exclude entry for the same OID subtree. It is independent of the order in which it appears in the configuration.

- The OID subtree name cannot be validated for being a valid OID numeric sequence. An invalid OID subtree name has no significance.

- There is at least one include entry at the top level under which a subtree can be excluded. By default a subtree is considered excluded

**SNMP: Tag / Target-Tag Notes**

- The value of the notify tag is the corresponding notify-tag parameter defined in the notification type for which this target receives notifications.

- If there is no match, notifications are not sent.

- The value of the transport tag is the corresponding target-tag parameter defined in the community string configuration.

- If wanting to use with Dying Gasp, via a remote management interface (a L3 IP-interface with Role=Management).

**SNMP: Other Notes**

- Security Name is either a Community String or User-Name for v1 or v2. For v3, use the "user-name" parameter.

  - Community's Security-Name must appear in at least one security-to-group table entry to assign the community string to an access control group.

- Only VACM Group context of "" (2x double- or single-quotes) is supported in current rev (10.11.2)

- Only VACM Group Context-match of 'exact' is supported in current rev (10.11.2)

- In VACM Group Access, the security models "v1" and "v2c" only suport security-level "No-Auth-No-Priv"

- The member you are adding to the group (security-name + security-model) is only in one VACM group.

  - For example, if a member named "cienaUser" is a part of the VACM group "cienaGroup1," then the same member cannot be a part of another VACM group "cienaGroup2". To add "cienaUser" to "cienaGroup2" you must first delete "cienaUser" from "cienaGroup1".)

### Zabbix Template: Ciena SAOS 10 by SNMP

The Zabbix community template supports SNMPv2c or SNMPv3 polling and SNMP traps for SAOS 10 platforms. Import the file that matches your Zabbix version:

- Zabbix 7.0: https://github.com/zabbix/community-templates/tree/main/Network_Devices/Ciena/template_ciena_saos10_snmp/7.0
- Zabbix 7.4: https://github.com/zabbix/community-templates/tree/main/Network_Devices/Ciena/template_ciena_saos10_snmp/7.4
- Source contribution and history: https://github.com/zabbix/community-templates/pull/880

The template monitors system identity and inventory, CPU, memory, filesystems, interfaces, environmental sensors, transceiver diagnostics, software/modules, and traps. SAOS 6/8 use a different template.

Example read-only SNMPv2c configuration with a Zabbix trap target (replace the angle-bracket values):

```cli
config
snmp vacm view zabbixRO include iso
snmp community zabbixV2c text-name <COMMUNITY> security-name zabbixSecV2c
snmp vacm group zabbixGroupV2c member zabbixSecV2c security-model v2c
snmp vacm group zabbixGroupV2c access "" v2c no-auth-no-priv context-match exact read-view zabbixRO
snmp vacm group zabbixGroupV2c access "" v2c no-auth-no-priv context-match exact notify-view zabbixRO
snmp target-params zabbixTrapParams v2c security-name zabbixSecV2c
snmp target zabbixTrapTarget target-params zabbixTrapParams udp ip <ZABBIX-SERVER-IP> port 162
snmp target zabbixTrapTarget tag zabbixTrapTag
snmp notify zabbixNotify type trap tag zabbixTrapTag
exit
```

In Zabbix, import the matching YAML, add a host with an SNMP interface on UDP 161, and link **Ciena SAOS 10 by SNMP**. Set `{$SNMP_COMMUNITY}` as a secret host macro for v2c. To receive traps, enable the Zabbix SNMP trapper and configure its trap file and receiver; do not install Ciena MIBs on the trap receiver because the template matches numeric notification OIDs.

### SNMP v1

**Get**

```cli
snmp agent admin-state enable
snmp community <COMMUNITY-NAME> security-name <SECURITY-NAME> text-name <COMMUNITY-STRING>
snmp vacm view cienaAll include internet
snmp vacm group cienaGroup access "" v1 no-auth-no-priv context-match exact notify-view cienaAll
snmp vacm group cienaGroup member <SECURITY-NAME> security-model v1
snmp target-params TestParams v1 security-name <SECURITY-NAME>
```

**Trap**

```cli
snmp community <COMMUNITY-NAME> security-name <SECURITY-NAME> text-name <COMMUNITY-STRING>
snmp vacm view cienaAll include internet
snmp vacm group cienaGroup access "" v1 no-auth-no-priv context-match exact notify-view cienaAll
snmp vacm group cienaGroup member <SECURITY-NAME> security-model v1
snmp target-params TestParams v1 security-name <SECURITY-NAME>
snmp target TestTarget target-params TestParams udp ip <x.x.x.x>
snmp target TestTarget tag TestTag
```

### SNMP v2c

**Get**

```cli
snmp community <COMMUNITY-NAME> security-name <SECURITY-NAME> text-name <COMMUNITY-STRING>
snmp vacm view cienaAll include internet
snmp vacm group cienaGroupV2c member <SECURITY-NAME> security-model v2c
snmp vacm group cienaGroupV2c access "" v2c no-auth-no-priv context-match exact notify-view cienaAll
```

**Trap**

```cli
snmp community <COMMUNITY-NAME> security-name <SECURITY-NAME> text-name <COMMUNITY-STRING>
snmp vacm view cienaAll include internet
snmp vacm group cienaGroupV2c access "" v2c no-auth-no-priv context-match exact notify-view cienaAll
snmp vacm group cienaGroupV2c member <SECURITY-NAME> security-model v2c
snmp target TestTarget1 target-params TestParamsV2c udp ip <x.x.x.x>
snmp target-params TestParamsV2c v2c security-name <SECURITY-NAME>
snmp target TestTarget1 tag TestTag
snmp notify Test-NOTIFY type trap tag TestTag
```

**Inform**

```cli
snmp community <COMMUNITY-NAME> security-name <SECURITY-NAME> text-name <COMMUNITY-STRING>
snmp vacm view cienaAll include internet
snmp vacm group cienaGroupV2c access "" v2c no-auth-no-priv context-match exact notify-view cienaAll
snmp vacm group cienaGroupV2c member <SECURITY-NAME> security-model v2c
snmp target TestTarget1 target-params TestParamsV2c udp ip <x.x.x.x>
snmp target-params TestParamsV2c v2c security-name <SECURITY-NAME>
snmp target TestTarget1 tag TestTag
snmp notify Test-NOTIFY type inform tag TestTag
```

### SNMP v3

**Get**

User-based Security Model (USM) for Authentication and Encryption services.

First, define the local users with different privilege levels

The keys used in this example are regular strings converted into a HEX format.

- MD5 authentication key - <AUTH-KEY-HEX>

- DES privacy key - <PRIVACY-KEY-HEX>

Second, define the Read Access and MIB View privileges for each user.

```cli
snmp usm local user cienaNoAuthNoPrivUser
exit
exit
exit
exit
snmp usm local user cienaNoAuthNoPrivUser auth md5 key <AUTH-KEY-HEX>
snmp usm local user cienaAuthPrivUser auth md5 key <AUTH-KEY-HEX>
snmp usm local user cienaAuthPrivUser priv des key <PRIVACY-KEY-HEX>
snmp vacm group cienaV3Group access "" usm no-auth-no-priv context-match exact read-view cienaAll
snmp vacm group cienaV3Group access "" usm auth-no-priv context-match exact read-view cienaAll
snmp vacm group cienaV3Group access "" usm auth-priv context-match exact read-view cienaAll
snmp vacm group cienaV3Group member cienaNoAuthNoPrivUser security-model usm
snmp vacm group cienaV3Group member cienaAuthNoPrivUser security-model usm
snmp vacm group cienaV3Group member cienaAuthPrivUser security-model usm
snmp vacm view cienaAll include internet
```

**Trap**

Same as the SNMP GET parameters, but additional fields are added to specify the Trap target IP.

```cli
snmp usm local user cienaNoAuthNoPrivUser
exit
exit
exit
exit
snmp usm local user cienaNoAuthNoPrivUser auth md5 key <AUTH-KEY-HEX>
snmp usm local user cienaAuthPrivUser auth md5 key <AUTH-KEY-HEX>
snmp usm local user cienaAuthPrivUser priv des key <PRIVACY-KEY-HEX>
snmp vacm group cienaV3Group access "" usm no-auth-no-priv context-match exact read-view cienaAll
snmp vacm group cienaV3Group access "" usm auth-no-priv context-match exact read-view cienaAll
snmp vacm group cienaV3Group access "" usm auth-priv context-match exact read-view cienaAll
snmp vacm group cienaV3Group member cienaNoAuthNoPrivUser security-model usm
snmp vacm group cienaV3Group member cienaAuthNoPrivUser security-model usm
snmp vacm group cienaV3Group member cienaAuthPrivUser security-model usm
snmp target TestTarget2 target-params TestUsmNoAuthNoPriv udp ip <x.x.x.x>
snmp target TestTarget2 tag TestTag
snmp target TestTarget3 target-params TestUsmAuthNoPriv udp ip <x.x.x.x>
snmp target TestTarget3 tag TestTag
snmp target TestTarget4 target-params TestUsmAuthPriv udp ip <x.x.x.x>
snmp target TestTarget4 tag TestTag
snmp target-params TestUsmNoAuthNoPriv usm security-level no-auth-no-priv user-name cienaNoAuthNoPrivUser
snmp target-params TestUsmAuthNoPriv usm security-level auth-no-priv user-name cienaAuthNoPrivUser
snmp target-params TestUsmAuthPriv usm security-level auth-priv user-name cienaAuthPrivUser
snmp vacm view cienaAll include internet
snmp notify Test-NOTIFY type trap
```

**Inform**

In the case of SNMPv3, when the agent sends an Inform Request to a manager, it expects a "reply" or "acknowledgement from the manager.  The manager is the authoritative entity.

Users are defined as remote users and the snmpEngineID of the manager should be configured along with the username of the agent.

SNMP Inform are enabled by specifying the type as "inform" whereas type "trap" will be used for SNMP traps.

```cli
snmp usm remote <ENGINE-ID> user cienaNoAuthNoPrivUser
exit
exit
exit
exit
snmp usm remote <ENGINE-ID> user cienaAuthNoPrivUser auth md5 key <AUTH-KEY-HEX>
snmp usm remote <ENGINE-ID> user cienaAuthPrivUser auth md5 key <AUTH-KEY-HEX>
snmp usm remote <ENGINE-ID> user cienaAuthPrivUser priv des key <PRIVACY-KEY-HEX>
snmp vacm group cienaV3Group access "" usm no-auth-no-priv context-match exact notify-view cienaAll
snmp vacm group cienaV3Group access "" usm auth-no-priv context-match exact notify-view cienaAll
snmp vacm group cienaV3Group access "" usm auth-priv context-match exact notify-view cienaAll
snmp vacm group cienaV3Group member cienaNoAuthNoPrivUser security-model usm
snmp vacm group cienaV3Group member cienaAuthNoPrivUser security-model usm
snmp vacm group cienaV3Group member cienaAuthPrivUser security-model usm
snmp target TestTarget2 target-params TestUsmNoAuthNoPriv udp ip <x.x.x.x>
snmp target TestTarget2 tag TestTag
snmp target TestTarget3 target-params TestUsmAuthNoPriv udp ip <x.x.x.x>
snmp target TestTarget3 tag TestTag
snmp target TestTarget4 target-params TestUsmAuthPriv udp ip <x.x.x.x>
snmp target TestTarget4 tag TestTag
snmp target-params TestUsmNoAuthNoPriv usm security-level no-auth-no-priv user-name cienaNoAuthNoPrivUser
snmp target-params TestUsmAuthNoPriv usm security-level auth-no-priv user-name cienaAuthNoPrivUser
snmp target-params TestUsmAuthPriv usm security-level auth-priv user-name cienaAuthPrivUser
snmp vacm view cienaAll include internet
snmp notify Test-NOTIFY tag TestTag type inform
```
