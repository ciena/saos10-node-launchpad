# Sample Golden Configs

Common day-one configs (NTP, licensing, SNMP, global profiles). Edit the &lt;PLACEHOLDER&gt; fields, then copy each block.

## Going into "config" mode and exiting

Select this with any other section to start the download with `config` and finish with `exit`. Selected alone, this mode-navigation example is exported as comments.

```text
config
<your config commands>
exit
```

## System Hostname

```cli
system config hostname <HOSTNAME>
```

## Timing - NTP

```cli
system ntp associations remote-ntp-server server-entry <NTP-SERVER-IP> admin-state enabled
system ntp admin-state enabled
```

## Timing - Manual

If NTP is not available but you need to enable licensing, configure the clock manually:

```cli
system ntp admin-state disabled
exit
```

- `system set clock <MANUAL_DATETIME>` - exit out of config for the "`system set clock ...`" command

```cli
# ^^ Sample format: `2025-10-15T22:25:01Z` ^^
system set clock 2027-01-15T22:25:01Z
```

## License Server

```cli
# Note: Time (NTP or Manual) MUST be configured before enabling licensing!
license-management-config license-server-config <ACTIVE-LICENSE-SERVER-IP-ADDRESS> backup false
license-management-config license-server-config <BACKUP-LICENSE-SERVER-IP-ADDRESS> backup true primary-server <ACTIVE-LICENSE-SERVER-IP-ADDRESS>
license-management-config license-client-config server-enable enabled
# Built-in Trial License might be needed during initial turnup to enable routing/switching through node (by default, traffic to/from the node is allowed, but NOT transit traffic).
# Note: Time (NTP or Manual) MUST be configured before enabling licensing.
license activate built-in-trial-license
```

... Trial Licenses are HARD-ENFORCED: If they don't get a real license (via license server or locally installed) in time before 90-day trial expires, then those features are HARD-ENFORCED and will STOP WORKING (and you can't re-enable the trial license UNLESS your RTFD the node ("`system reset factory-defaults`") the node.

... "Real" Server-granted Licenses are SOFT-ENFORCED: If you lose connectivity to the License Server for a few weeks, the features WILL CONTINUE WORKING... The node will just nag you with an alarm.

... If SAOS10 gives you the error "Failed to find built-in short-term license", then remove any existing license server configs and try again, but note: Trial License doesn't work if node was already licensed by a valid LS.

## QoS Bandwidth Calculation Mode

QoS BW Calc "Payload" will only calc Ethernet Payload (not Headers, like QinQ, MPLS), and is required for most FttT deployments.

```cli
bw-calculation-mode eqos-bw-calculation-mode payload
bw-calculation-mode iqos-bw-calculation-mode payload
```

## Basic SNMPv2c and Traps

```cli
snmp agent admin-state enable
snmp vacm view ISP1-View include iso
snmp vacm view ISP1-View exclude snmpResearch
snmp vacm group ISP1-GroupV2C member ISP1-Public security-model v2c
snmp vacm group ISP1-GroupV2C access "" v2c no-auth-no-priv context-match exact read-view ISP1-View notify-view ISP1-View
snmp community <COMMUNITY-NAME> text-name <COMMUNITY-STRING> security-name <SECURITY-NAME>
snmp target-params ISP1-TargetParams v2c security-name ISP1-Public
snmp target-params Alarming1 v2c security-name private
snmp target AlarmingTarget1 target-params Alarming1 udp ip <SNMP-TRAP-MONITOR-IP> udp prefix-length 32
```

## NOTE: Required before creating L2 Service with Service OAM (CCM, DMM, SLM)

```cli
cfm-global-config admin-state enable
maintenance-domain md0 name-type character-string name md0 md-level 0 mhf-creation none id-permission chassis
maintenance-domain md1 name-type character-string name md1 md-level 1 mhf-creation none id-permission chassis
maintenance-domain md2 name-type character-string name md2 md-level 2 mhf-creation none id-permission chassis
maintenance-domain md3 name-type character-string name md3 mhf-creation none id-permission chassis
maintenance-domain md4 name-type character-string name md4 md-level 4 mhf-creation none id-permission chassis
maintenance-domain md5 name-type character-string name md5 md-level 5 mhf-creation none id-permission chassis
maintenance-domain md6 name-type character-string name md6 md-level 6 mhf-creation none id-permission chassis
maintenance-domain md7 name-type character-string name md7 md-level 7 mhf-creation none id-permission chassis
```

## Disable PTP, if you aren't using it (a licensed feature, which alarms if not licensed)

If command errors, platform probably doesn't support PTP.

```cli
sync global admin-state disabled
```

## Enable Node Essentials (Supported on most platforms in 10.11.2. 392x support added in 10.12.0. Support prior to 10.11 was intermittent.)

```cli
management-plane server-applications application web-gui enable true
```

## For 3926 and 3928, an "Offload Port" must be enabled to support SAT/Benchmark and Hardware-accelerated CFMs.

```cli
# Offload Ports: 3928 Port 7 // 3926 = Port 4
# When `offload-activate` parameter is modified, all system port traffic is affected for up to two minutes.
# Steps to enable offload port:
```

Step1: Remove any FPs attached to port ("`show flow-points`" then "`no fps fp <<FP_name>>`")

Step2: "`no logical-ports logical-port 7 binding`"

Step2: "`no logical-ports logical-port 4 binding`"

Step3: "`oc-if:interfaces interface 7 config offload-activate true`"

Step3: "`oc-if:interfaces interface 4 config offload-activate true`"

## Benchmark Test KPI (Key Perf Indicator) to show pass/fail on Benchmark/SAT Tests

```cli
# For throughput and frameloss, variable is a percentage of the starting rate multiplied by 10000 to provide a value to four decimal places. For example:
# - Setting Frameloss/Throughput to "`10000`" means: Test result must be <=1% different from configured starting rate to pass
# - Setting Frameloss/Throughput to "`1`" means: Test result must be <=0.0001% different from configured starting rate to pass
# If you want your KPI to only PASS throughput/frameloss tests where there is no packet loss, then set their values to "`1`" (aka: 0.0001%)
# Latency (and PDV) variable is in msec. So, if long spans are common, 10msec might not be enough.
sat kpi-profile KPI_noLoss_10msec untagged throughput 1 frameloss 1 latency 10 pdv 2
sat kpi-profile KPI_noLoss_10msec pcp 0 throughput 1 frameloss 1 latency 10 pdv 2
sat kpi-profile KPI_noLoss_10msec pcp 1 throughput 1 frameloss 1 latency 10 pdv 2
sat kpi-profile KPI_noLoss_10msec pcp 2 throughput 1 frameloss 1 latency 10 pdv 2
sat kpi-profile KPI_noLoss_10msec pcp 3 throughput 1 frameloss 1 latency 10 pdv 2
sat kpi-profile KPI_noLoss_10msec pcp 4 throughput 1 frameloss 1 latency 10 pdv 2
sat kpi-profile KPI_noLoss_10msec pcp 5 throughput 1 frameloss 1 latency 10 pdv 2
sat kpi-profile KPI_noLoss_10msec pcp 6 throughput 1 frameloss 1 latency 10 pdv 2
sat kpi-profile KPI_noLoss_10msec pcp 7 throughput 1 frameloss 1 latency 10 pdv 2
```

## Metering Profiles - 10% CIR, 90% EIR

```cli
meter-profiles meter-profile BP_PROFILE_1 cir 100000 eir 900000 cbs 128 ebs 1280
meter-profiles meter-profile BP_PROFILE_2 cir 200000 eir 1800000 cbs 250 ebs 2500
meter-profiles meter-profile BP_PROFILE_3 cir 300000 eir 2700000 cbs 375 ebs 4000
meter-profiles meter-profile BP_PROFILE_5 cir 500000 eir 4500000 cbs 625 ebs 4000
meter-profiles meter-profile BP_PROFILE_10 cir 1000000 eir 9000000 cbs 1280 ebs 4000
```

## Create a new diag-privs user

```cli
system aaa authentication users user su config role SYSTEM_ROLE_DIAG username su password <PASSWORD>
nacm groups group admin user-name su
```

## Sample Frame-to-CoS map for Fixed Pbit of 5.

```cli
frame-to-cos-maps frame-to-cos-map fixed_40 non-conforming-cos 40 non-conforming-color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp0 pcp 0 dei disabled cos 40 color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp1 pcp 1 dei disabled cos 40 color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp2 pcp 2 dei disabled cos 40 color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp3 pcp 3 dei disabled cos 40 color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp4 pcp 4 dei disabled cos 40 color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp5 pcp 5 dei disabled cos 40 color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp6 pcp 6 dei disabled cos 40 color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp7 pcp 7 dei disabled cos 40 color green
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp0 pcp 0 dei enabled cos 40 color yellow
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp1 pcp 1 dei enabled cos 40 color yellow
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp2 pcp 2 dei enabled cos 40 color yellow
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp3 pcp 3 dei enabled cos 40 color yellow
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp4 pcp 4 dei enabled cos 40 color yellow
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp5 pcp 5 dei enabled cos 40 color yellow
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp6 pcp 6 dei enabled cos 40 color yellow
frame-to-cos-maps frame-to-cos-map fixed_40 map-entry pcp7 pcp 7 dei enabled cos 40 color yellow
```

## Auto-Backup Config and SW/HW Details upon change to SFTP/SCP/FTP/HTTP/HTTPS

```cli
auto-backup config feature "show-running-config" admin-state enabled prefix "cfgPE-A-" idle-time-interval 600 local-copy-count 4
auto-backup config feature "show-running-config" remote-server "<BACKUP-SERVER>" url "sftp://<BACKUP-SERVER-IP>/sw-images/backups" username "<BACKUP-SERVER-USERNAME>" password "<BACKUP-SERVER-PASSWORD>"
# "`idle-time-interval`" --> Specifies the time interval for which the system is idle after a configuration change on the system. At every configuration change, the system starts a countdown timer according to the value of this parameter. When this timer reaches zero, the system uploads the current running configuration file to the specified remote server.
```

## MTU Maximize (if &lt;10.9.0, use 9216)

```cli
logical-ports logical-port 1 mtu 9800
logical-ports logical-port 2 mtu 9800
logical-ports logical-port 3 mtu 9800
logical-ports logical-port 4 mtu 9800
logical-ports logical-port 5 mtu 9800
logical-ports logical-port 6 mtu 9800
logical-ports logical-port 7 mtu 9800
logical-ports logical-port 8 mtu 9800
logical-ports logical-port 9 mtu 9800
logical-ports logical-port 10 mtu 9800
logical-ports logical-port 11 mtu 9800
logical-ports logical-port 12 mtu 9800
logical-ports logical-port 13 mtu 9800
logical-ports logical-port 14 mtu 9800
logical-ports logical-port 15 mtu 9800
logical-ports logical-port 16 mtu 9800
logical-ports logical-port 17 mtu 9800
logical-ports logical-port 18 mtu 9800
logical-ports logical-port 19 mtu 9800
logical-ports logical-port 20 mtu 9800
logical-ports logical-port 21 mtu 9800
logical-ports logical-port 22 mtu 9800
logical-ports logical-port 23 mtu 9800
logical-ports logical-port 24 mtu 9800
logical-ports logical-port 25 mtu 9800
logical-ports logical-port 26 mtu 9800
logical-ports logical-port 27 mtu 9800
logical-ports logical-port 28 mtu 9800
logical-ports logical-port 29 mtu 9800
logical-ports logical-port 30 mtu 9800
logical-ports logical-port 31 mtu 9800
logical-ports logical-port 32 mtu 9800
logical-ports logical-port 33 mtu 9800
logical-ports logical-port 34 mtu 9800
logical-ports logical-port 35 mtu 9800
logical-ports logical-port 36 mtu 9800
logical-ports logical-port 37 mtu 9800
logical-ports logical-port 38 mtu 9800
logical-ports logical-port 39 mtu 9800
logical-ports logical-port 40 mtu 9800
logical-ports logical-port 41 mtu 9800
logical-ports logical-port 42 mtu 9800
logical-ports logical-port 43 mtu 9800
logical-ports logical-port 44 mtu 9800
logical-ports logical-port 45 mtu 9800
logical-ports logical-port 46 mtu 9800
logical-ports logical-port 47 mtu 9800
logical-ports logical-port 48 mtu 9800
logical-ports logical-port 49 mtu 9800
logical-ports logical-port 50 mtu 9800
logical-ports logical-port 51 mtu 9800
logical-ports logical-port 52 mtu 9800
logical-ports logical-port 53 mtu 9800
logical-ports logical-port 54 mtu 9800
logical-ports logical-port 1/1 mtu 9800
logical-ports logical-port 1/2 mtu 9800
logical-ports logical-port 2/1 mtu 9800
logical-ports logical-port 2/2 mtu 9800
# ...and if using OTN ports, add .1. Examples
logical-ports logical-port 33.1 mtu 9800
logical-ports logical-port 34.1 mtu 9800
logical-ports logical-port 35.1 mtu 9800
logical-ports logical-port 36.1 mtu 9800
logical-ports logical-port 1/1.1 mtu 9800
logical-ports logical-port 1/2.1 mtu 9800
logical-ports logical-port 2/1.1 mtu 9800
logical-ports logical-port 2/2.1 mtu 9800
```

## SSH Session Inactivity Timer

```cli
system ssh-server config timeout 600
```

## Session Banner/MOTD

```cli
system config motd-banner "\n\n###\nLAB NETWORK\n####\n\n"
```
