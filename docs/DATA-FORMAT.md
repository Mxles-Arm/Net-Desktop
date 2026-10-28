# รูปแบบข้อมูล Workspace

Workspace หนึ่งงานคือ JSON แบบนี้ หน้าบ้านเก็บไว้ในตัวแปร `w` (ดู `newWorkspace()` ใน `frontend/js/app.js`)
และส่งให้หลังบ้านทุกครั้งที่บันทึก ตรวจเครือข่าย หรือ ping

```json
{
  "nodes":   [ /* อุปกรณ์ */ ],
  "links":   [ /* สาย LAN / Wi-Fi */ ],
  "notes":   [ { "id": "note1", "x": 10, "y": 20, "text": "โน้ต" } ],
  "strokes": [ [[x, y], [x, y]] ],
  "missionAttemptId": 12
}
```

`missionAttemptId` มีเฉพาะ Workspace ที่เป็นภารกิจ

## อุปกรณ์ (`nodes[]`)

| ฟิลด์ | ใช้กับ | ความหมาย | ค่าเริ่มต้นถ้าไม่มี |
|---|---|---|---|
| `id` | ทุกตัว | รหัสไม่ซ้ำใน Workspace | (ต้องมี) |
| `type` | ทุกตัว | `router` `switch` `pc` `laptop` `server` `access` | (ต้องมี) |
| `name` | ทุกตัว | ชื่อที่แสดง และใช้เป็นชื่อ DNS (ตัวเล็ก, ช่องว่างเป็น `-`) | ชื่อประเภท |
| `x` `y` `w` `h` | ทุกตัว | ตำแหน่งและขนาดบนแผนผัง (หลังบ้านไม่ใช้) | |
| `ip` | ทุกตัว | IPv4 เช่น `192.168.1.11` (Switch / Access Point เว้นว่างได้) | `""` |
| `mask` | ทุกตัว | Subnet Mask | `255.255.255.0` |
| `gateway` | pc laptop server | Default Gateway (ควรเป็น IP ของ Router) | `""` |
| `dns` | pc laptop server | DNS Server (Router หรือ Server) | `""` |
| `dhcp` | pc laptop server | `true` = รับ IP อัตโนมัติ (ไม่สนใจ ip/mask/gateway/dns ที่ตั้งไว้) | `false` |
| `wifi` | router access laptop | เปิด Wi-Fi | `false` |
| `ssid` | router access laptop | Router/AP: ชื่อที่กระจาย · Notebook: ชื่อที่เลือกเชื่อมต่อ | `""` |
| `password` | router access laptop | รหัสผ่าน Wi-Fi (ว่าง = เครือข่ายเปิด) | `classroom123` |
| `dhcpServer` | router | เปิดแจก IP อัตโนมัติ | `true` |
| `dhcpStart` | router | เลขชุดสุดท้ายที่เริ่มแจก (เช่น 100 → .100, .101, …) | `100` |

Workspace เก่าที่ไม่มีฟิลด์ใหม่ยังใช้งานได้ เพราะหลังบ้านเติมค่าเริ่มต้นให้

## การเชื่อมต่อ (`links[]`)

```json
{ "a": "r1", "b": "s1", "kind": "cable" }
{ "a": "r1", "b": "l1", "kind": "wireless" }
```

Wi-Fi ใช้ได้เมื่อ: ฝั่งหนึ่งเป็น Router/Access Point ที่เปิด Wi-Fi, อีกฝั่งเป็น Notebook ที่เปิด Wi-Fi,
SSID ตรงกัน และรหัสผ่านตรงกัน

## หลักการของ Network Engine (`backend/src/engine/network.js`)

- อุปกรณ์ที่เชื่อมถึงกัน (ผ่านสาย/Wi-Fi ที่ใช้ได้) อยู่ใน **segment** เดียวกัน (Switch, AP และพอร์ต LAN ของ Router ส่งต่อข้อมูลให้)
- Router มี 1 วงเครือข่าย ทำหน้าที่ Default Gateway, DHCP Server และ DNS Server
- **ping สำเร็จ** เมื่อ: ต้นทางมี IP ใช้ได้ → ปลายทางอยู่วงเดียวกันและอยู่ segment เดียวกัน (หรือส่งผ่าน Gateway ที่ถูกต้อง) → ปลายทางตอบกลับได้ → IP ไม่ซ้ำ
- DHCP ไม่สำเร็จ → เครื่องได้ IP `169.254.x.x` (APIPA) เหมือน Windows
- รหัสปัญหาทั้งหมดอยู่ในฟังก์ชัน `analyze()` เช่น `DUPLICATE_IP`, `GATEWAY_OTHER_SUBNET`, `WIFI_WRONG_PASSWORD` แต่ละปัญหามีคำใบ้ 3 ระดับ (`hints`)
