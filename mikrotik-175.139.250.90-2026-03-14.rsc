# 2026-03-14 14:43:17 by MikroTik RouterOS
# model = 188Suites-RB5009UG+S+

/system identity
set name=188Suites-RB5009UG+S+

/system ntp client
set enabled=false mode=unicast vrf=main

/interface vlan
add name="vlan100 - Guest" mtu=1500 l2mtu=1510 mac-address=DC:2C:6E:28:EF:2F arp=enabled arp-timeout=auto loop-protect=default loop-protect-status=off loop-protect-send-interval=5s loop-protect-disable-time=5m vlan-id=100 interface="ether4 - OLT > GE1" use-service-tag=false disabled=false
add name="vlan500 - Unifi" mtu=1500 l2mtu=1510 mac-address=DC:2C:6E:28:EF:2C arp=enabled arp-timeout=auto loop-protect=default loop-protect-status=off loop-protect-send-interval=5s loop-protect-disable-time=5m vlan-id=500 interface=ether1-WAN use-service-tag=false disabled=false


/ip pool
add name=vpn ranges=192.168.89.2-192.168.89.255
add name=Limit-100Mbps ranges=10.7.1.1-10.7.1.254
add name=dhcp_pool2 ranges=192.168.200.2-192.168.200.254
add name=Limit-130Mbps ranges=10.7.3.2-10.7.3.254
add name=dhcp_pool4 ranges=192.168.3.2-192.168.3.254
add name=pool-100Mbps-Cobnb ranges=10.1.0.10-10.1.1.250
add name=pool-130Mbps ranges=10.1.2.10-10.1.3.250


/ip dhcp-server
add name=dhcp_Guest interface="vlan100 - Guest" lease-time=10m address-pool=Limit-100Mbps authoritative=yes use-radius=no disabled=true
add name=dhcp1 interface="ether8 - LAN" lease-time=10m address-pool=dhcp_pool2 authoritative=yes use-radius=no disabled=false
add name=dhcp2 interface=ether7 lease-time=10m address-pool=dhcp_pool4 authoritative=yes use-radius=no disabled=false


/ip dhcp-server network
add address=192.168.3.0/24 gateway=192.168.3.1
add address=192.168.200.0/24 gateway=192.168.200.1


/ip address
add address=192.168.100.254/24 network=192.168.100.0 interface="ether6 - MgtOLT" disabled=false
add address=10.7.0.1/22 network=10.7.0.0 interface="vlan100 - Guest" disabled=false
add address=192.168.200.1/24 network=192.168.200.0 interface="ether8 - LAN" disabled=false
add address=172.16.16.1/22 network=172.16.16.0 interface="vlan100 - Guest" disabled=true comment="172.16.16.1/22 For new addressing"
add address=192.168.3.1/24 network=192.168.3.0 interface=ether7 disabled=false
add address=20.20.20.1/32 network=20.20.20.1 interface=ether2 disabled=false


/ip dns
set servers=8.8.8.8,1.1.1.1 verify-doh-cert=false doh-max-server-connections=5 doh-max-concurrent-queries=50 doh-timeout=5s allow-remote-requests=false max-udp-packet-size=4096 query-server-timeout=2s query-total-timeout=10s max-concurrent-queries=100 max-concurrent-tcp-sessions=20 cache-size=2048 cache-max-ttl=1w

/ip firewall nat
add chain=srcnat action=masquerade out-interface=pppoe-out1 log=false disabled=false
add chain=srcnat action=masquerade src-address=192.168.89.0/24 disabled=false comment="masq. vpn traffic"


/ip firewall filter
add chain=input action=accept protocol=tcp dst-port=8729 log=false disabled=false


/user
add name=broadcom group=full expired=false disabled=false
add name=broadcomuser group=full expired=false disabled=true

