# Initial Login

Out-of-box access, removing the factory ZTP configs and bringing up management IP. Fill in the &lt;PLACEHOLDER&gt; fields once and every block on the page updates.

## Default Login and Console

Use the credentials supplied for your platform and change any initial password before placing the node into service.

No Default IP Address on SAOS10 devices - Must use Serial Console or DHCP Server

### Console Cable Type and Terminal Settings, per platform

- For 3948, 3949, 3984, 5130, 5131-CAP, 5132, 5134, 5144, 5164, 5166, 5168, 5169, 5171 Router, 5184, 5186, 8110, 8112, 8114, 8140, 8190, 8192, etc.:

USB-C Serial: 115200 bps, 8, None, 1, No Flow Control

- For 3924, 3926, 3928:

RJ-45 Serial: 9600 bps, 8, None, 1, No Flow Control

- For 5162, 5170, 5171, 8180:

RJ-45 Serial: 115200 bps, 8, None, 1, No Flow Control

- For 5131, 3985:

USB-A Serial: 115200 bps, 8, None, 1, No Flow Control

- For 3922:

USB-C Serial: 9600 bps, 8, None, 1, No Flow Control

### Console Cable Notes

- Console Cable is "null modem" (not "blue Cisco cable"). Pinout in docs or can buy adaptors from Ciena.

- For USB-C, use a cable that supports data, not power only.

- Use a compatible console cable for the platform and connector type.

- USB driver may be needed for Windows OS "CP210x_Universal_Windows_Driver"

### No Console/USB Cable?

Connect DHCP Server to MGMT port (Untagged) or to any Data Port (VLAN127). After Node pulls an IP, connect via SSH

Use a trusted DHCP service approved for your environment.

## Nuke the ZTP Configs (if not using ZTP)

```cli
config
no fps
no dhcp-client client 'remote'
no dhcpv6-client client 'remote'
no oc-if:interfaces interface 'remote'
no fds fd 'remote-fd'
no classifiers classifier default-vid-127
ztp admin-state disabled
dhcp-client client mgmtbr0 admin-enable false
no dhcp-client
no dhcpv6-client
exit
```

### More Specific FP Removal (aka: don't delete "remote-fpX" if your SSH session is through PortX!)

```cli
no fps fp remote-fp1
no fps fp remote-fp2
no fps fp remote-fp3
no fps fp remote-fp4
no fps fp remote-fp5
no fps fp remote-fp6
no fps fp remote-fp7
no fps fp remote-fp8
no fps fp remote-fp9
no fps fp remote-fp10
no fps fp remote-fp11
no fps fp remote-fp12
no fps fp remote-fp13
no fps fp remote-fp14
no fps fp remote-fp15
no fps fp remote-fp16
no fps fp remote-fp17
no fps fp remote-fp18
no fps fp remote-fp19
no fps fp remote-fp20
no fps fp remote-fp21
no fps fp remote-fp22
no fps fp remote-fp23
no fps fp remote-fp24
no fps fp remote-fp25
no fps fp remote-fp26
no fps fp remote-fp27
no fps fp remote-fp28
no fps fp remote-fp29
no fps fp remote-fp30
no fps fp remote-fp31
no fps fp remote-fp32
no fps fp remote-fp33
no fps fp remote-fp34
no fps fp remote-fp35
no fps fp remote-fp36
no fps fp remote-fp37
no fps fp remote-fp38
no fps fp remote-fp39
no fps fp remote-fp40
no fps fp remote-fp41
no fps fp remote-fp42
no fps fp remote-fp43
no fps fp remote-fp44
no fps fp remote-fp45
no fps fp remote-fp46
no fps fp remote-fp47
no fps fp remote-fp48
no fps fp remote-fp49
no fps fp remote-fp50
no fps fp remote-fp51
no fps fp remote-fp52
no fps fp remote-fp53
no fps fp remote-fp54
no fps fp remote-fp1/1
no fps fp remote-fp1/2
no fps fp remote-fp2/1
no fps fp remote-fp2/2
no fps fp remote-fp1/1.1
no fps fp remote-fp1/2.1
no fps fp remote-fp2/1.1
no fps fp remote-fp2/2.1
```

## [392x] Initial IP Configs for Management

### Creating IP Interface, if using Inband Management

```cli
config
fds fd fd_remote mode vpls vlan-id <VLAN#>
fds fd fd_remote initiate-l2-transform vlan-stack 1 push-pcp map push-vid <VLAN#>
oc-if:interfaces interface int_remote config name int_remote mtu 9136 description 'in band remote management interface' role cn-if:management type ip underlay-binding config fd fd_remote
oc-if:interfaces interface int_remote ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length <PREFIX-LENGTH>
rib vrf default ipv4 0.0.0.0/0 next-hop <GATEWAY-IP-ADDRESS> tag 0
classifiers classifier CLASSIFIER_<VLAN#> filter-entry classifier:vtag-stack vtags 1 vlan-id <VLAN#>
fps fp remote-fp<PORT#> fd-name fd_remote logical-port <PORT#> classifier-list CLASSIFIER_<VLAN#>
exit
```

### Configs if using the Out-of-Band "MGMT" Port off Faceplate (untagged only)

```cli
config
oc-if:interfaces interface mgmtbr0 config name mgmtbr0 mtu 1500 role cn-if:management type system
oc-if:interfaces interface mgmtbr0 ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length <PREFIX-LENGTH>
rib vrf default ipv4 0.0.0.0/0 next-hop <GATEWAY-IP-ADDRESS> description "default route out" tag 0
dhcp-client client mgmtbr0 admin-enable false
# ^^ IMPORTANT STEP: disable DHCP on `mgmtbr0`
exit
```

## [393x, 394x, 398x, 51xx, 81xx] Initial IP Configs for Management

### Creating IP Interface, if using Inband Management

```cli
config
fds fd fd_remote mode vpls
oc-if:interfaces interface int_remote config name int_remote mtu 9136 description 'in band remote management interface' role cn-if:management type ip underlay-binding config fd fd_remote
oc-if:interfaces interface int_remote ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length <PREFIX-LENGTH>
rib vrf default ipv4 0.0.0.0/0 next-hop <GATEWAY-IP-ADDRESS> tag 0
classifiers classifier CLASSIFIER_<VLAN#> filter-entry classifier:vtag-stack vtags 1 vlan-id <VLAN#>
fps fp remote-fp<PORT#> fd-name fd_remote logical-port <PORT#> classifier-list CLASSIFIER_<VLAN#>
fps fp remote-fp<PORT#> egress-l2-transform push-vid-<VLAN#> vlan-stack 1 push-vid <VLAN#>
fps fp remote-fp<PORT#> ingress-l2-transform pop-vid vlan-stack 1 pop-type
exit
```

### Configs if using the Out-of-Band "MGMT" Port off Faceplate (untagged only)

```cli
config
oc-if:interfaces interface mgmtbr0 config name mgmtbr0 mtu 1500 role cn-if:management type system
oc-if:interfaces interface mgmtbr0 ipv4 addresses address <IP-ADDRESS> config ip <IP-ADDRESS> prefix-length <PREFIX-LENGTH>
rib vrf default ipv4 0.0.0.0/0 next-hop <GATEWAY-IP-ADDRESS> description "default route out" tag 0
dhcp-client client mgmtbr0 admin-enable false
# ^^ IMPORTANT STEP: disable DHCP on `mgmtbr0`!
exit
```
