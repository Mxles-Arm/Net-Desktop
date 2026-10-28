'use strict';
// Lesson content shown before each mission. Each section may have paragraphs (p), a bullet list
// (list), a monospaced example (code) and a highlighted tip. "In CAI Net" sections describe the
// actual controls of the simulator, so keep them in sync with the UI labels.

const LESSONS = [
  {
    id: 'lan',
    order: 1,
    mission: 'lan-basic',
    title: 'อุปกรณ์เครือข่ายและ LAN',
    goal: 'รู้จักอุปกรณ์หลักในเครือข่าย และต่อ LAN แบบใช้สายได้',
    sections: [
      {
        h: 'LAN คืออะไร',
        p: [
          'LAN (Local Area Network) คือเครือข่ายที่เชื่อมคอมพิวเตอร์ในพื้นที่จำกัด เช่น ห้องเรียน ห้องแล็บ หรือภายในอาคาร เพื่อให้เครื่องส่งข้อมูลถึงกันและใช้ทรัพยากรร่วมกัน เช่น ไฟล์ เครื่องพิมพ์ หรืออินเทอร์เน็ต',
        ],
      },
      {
        h: 'อุปกรณ์ที่ควรรู้จัก',
        list: [
          'Switch — จุดรวมสาย LAN ของทุกเครื่อง รับข้อมูล (เฟรม) แล้วส่งต่อไปยังพอร์ตของเครื่องปลายทางโดยดูจาก MAC Address',
          'Router — เชื่อมระหว่างเครือข่าย และเป็น "ประตู" ออกนอกวงเครือข่าย (Default Gateway) เราเตอร์ในบ้านหรือโรงเรียนมักแจก IP อัตโนมัติ (DHCP) ให้ด้วย',
          'Computer / Notebook — เครื่องปลายทางที่ผู้ใช้ใช้งาน',
          'Server — เครื่องที่ให้บริการแก่เครื่องอื่น เช่น เก็บไฟล์ หรือเว็บไซต์',
          'สาย LAN — สายคู่บิดเกลียว (UTP) หัวต่อ RJ-45 ใช้ต่อเครื่องเข้ากับ Switch หรือ Router',
        ],
      },
      {
        h: 'ตัวอย่างการต่อ LAN ในห้องเรียน',
        p: ['ทุกเครื่องต่อสายเข้า Switch แล้ว Switch ต่อสายไปที่ Router เรียกว่าการต่อแบบดาว (Star)'],
        code: ['           Router', '             |', '           Switch', '        /    |    \\', '     PC-01 PC-02 PC-03'],
      },
      {
        h: 'ทำใน CAI Net อย่างไร',
        list: [
          'ลากอุปกรณ์จาก Sidebar ด้านซ้ายมาวางบนแผนผัง',
          'ต่อสาย: ลากจุด "พอร์ตสีฟ้า" ของอุปกรณ์หนึ่งไปปล่อยบนอีกอุปกรณ์ (หรือเลือกเครื่องมือ "เชื่อมสาย")',
          'คลิกอุปกรณ์แล้วดู Inspector ด้านขวา เพื่อตั้งชื่อและค่าเครือข่าย',
          'ถ้าอุปกรณ์ขึ้นกรอบสีแดง แปลว่ายังมีปัญหา กด "ทดสอบเครือข่าย" เพื่อดูรายละเอียด',
        ],
        tip: 'ภารกิจที่ 1 ต้องตั้ง Default Gateway ของทุก Computer เป็น IP ของ Router ด้วย (อ่านเรื่อง Gateway เพิ่มได้ในบทที่ 3)',
      },
    ],
  },
  {
    id: 'wifi',
    order: 2,
    mission: 'wifi-lab',
    title: 'Wi-Fi, SSID และ Access Point',
    goal: 'ติดตั้ง Access Point และให้ Notebook เชื่อม Wi-Fi ได้ถูกต้อง',
    sections: [
      {
        h: 'Wi-Fi คืออะไร',
        p: [
          'Wi-Fi คือ LAN แบบไร้สาย (มาตรฐาน IEEE 802.11) ใช้คลื่นวิทยุแทนสาย อุปกรณ์อย่าง Notebook และมือถือจึงเชื่อมต่อได้โดยไม่ต้องเสียบสาย',
        ],
      },
      {
        h: 'Access Point (AP)',
        p: [
          'Access Point ทำหน้าที่กระจายสัญญาณ Wi-Fi และเป็นสะพานเชื่อมอุปกรณ์ไร้สายเข้ากับ LAN แบบสาย จึงต้องต่อสาย LAN จาก Access Point เข้ากับ Switch หรือ Router เสมอ ไม่อย่างนั้นเครื่องที่ต่อ Wi-Fi จะคุยได้แค่กันเองในกลุ่มไร้สาย',
        ],
      },
      {
        h: 'SSID และรหัสผ่าน',
        list: [
          'SSID คือชื่อเครือข่าย Wi-Fi ที่เราเห็นตอนเลือก Wi-Fi',
          'รหัสผ่าน Wi-Fi (เช่นแบบ WPA2 / WPA3) ป้องกันคนที่ไม่ได้รับอนุญาต แบบ WPA2-Personal ต้องยาวอย่างน้อย 8 ตัวอักษร',
          'เครื่องลูกข่ายต้องเลือก SSID ให้ตรง และใส่รหัสผ่านให้ถูก จึงจะเชื่อมต่อได้',
          'ถ้าเปลี่ยนชื่อหรือรหัสผ่านที่ Access Point เครื่องที่เคยต่อไว้ต้องตั้งค่าใหม่ให้ตรงด้วย',
        ],
      },
      {
        h: 'ทำใน CAI Net อย่างไร',
        list: [
          'ต่อสาย Access Point เข้ากับ Switch ก่อน',
          'เลือกเครื่องมือ "เชื่อม Wi-Fi" แล้วคลิก Access Point ตามด้วย Notebook',
          'เปิด "ตั้งค่า Wi-Fi" แล้วเลือกอุปกรณ์จากรายการ เพื่อเปลี่ยน SSID และรหัสผ่านของแต่ละเครื่อง',
          'ในแบบจำลองนี้ Computer และ Server ไม่มีการ์ด Wi-Fi ต้องต่อด้วยสาย LAN',
        ],
        tip: 'ภารกิจที่ 2 ให้ตั้ง SSID เป็น CAI-Lab และตั้งรหัสผ่านใหม่ที่ไม่ใช่ค่าเริ่มต้น',
      },
    ],
  },
  {
    id: 'ip',
    order: 3,
    mission: 'fix-ip',
    title: 'IP Address, Subnet Mask และ Default Gateway',
    goal: 'อ่านและตั้งค่า IP ได้ถูกต้อง และหาสาเหตุเมื่อเครื่องคุยกันไม่ได้',
    sections: [
      {
        h: 'IP Address',
        p: [
          'IP Address (IPv4) คือที่อยู่ของเครื่องในเครือข่าย มีตัวเลข 4 ชุดคั่นด้วยจุด แต่ละชุดมีค่า 0–255 เช่น 192.168.1.20 ทุกเครื่องในเครือข่ายเดียวกันต้องมี IP ไม่ซ้ำกัน ถ้าซ้ำจะเกิด IP Conflict',
          'IP ที่ขึ้นต้นด้วย 192.168. เป็น Private IP ที่ใช้ภายในองค์กรหรือบ้าน',
        ],
      },
      {
        h: 'Subnet Mask: แบ่งส่วนเครือข่ายกับส่วนเครื่อง',
        p: [
          'Subnet Mask บอกว่าเลขส่วนไหนของ IP คือ "วงเครือข่าย" ส่วนไหนคือ "หมายเลขเครื่อง" ค่าที่ใช้บ่อยคือ 255.255.255.0 (เขียนย่อว่า /24) หมายความว่าเลข 3 ชุดแรกคือวงเครือข่าย ชุดสุดท้ายคือหมายเลขเครื่อง',
        ],
        code: [
          'IP           192.168.1.20',
          'Subnet Mask  255.255.255.0   (/24)',
          'วงเครือข่าย   192.168.1.x',
          'ใช้กับเครื่องได้ .1 ถึง .254',
          '.0   = Network Address (ห้ามใช้กับเครื่อง)',
          '.255 = Broadcast Address (ห้ามใช้กับเครื่อง)',
        ],
      },
      {
        h: 'Default Gateway',
        p: [
          'ถ้าปลายทางอยู่วงเครือข่ายเดียวกัน เครื่องจะส่งข้อมูลถึงกันได้ตรง ๆ ผ่าน Switch แต่ถ้าปลายทางอยู่นอกวง เครื่องจะส่งข้อมูลไปที่ Default Gateway ซึ่งต้องเป็น IP ของ Router ที่อยู่วงเดียวกับเครื่อง',
        ],
        code: ['ถูก:  IP 192.168.1.20 /24  Gateway 192.168.1.1', 'ผิด:  IP 192.168.1.20 /24  Gateway 192.168.2.1  ← Gateway อยู่คนละวง'],
      },
      {
        h: 'อาการผิดปกติที่พบบ่อย',
        list: [
          'IP ซ้ำกัน → ข้อมูลไปผิดเครื่อง หรือใช้งานไม่ได้',
          'IP อยู่คนละวงกับ Router → ติดต่อ Router และเครื่องอื่นในห้องไม่ได้',
          'Gateway อยู่คนละวง หรือไม่ตรงกับ Router → ออกนอกวงเครือข่ายไม่ได้',
          'พิมพ์ IP ผิดรูปแบบ เช่น 192.168.1.300',
        ],
        tip: 'ใช้ Terminal พิมพ์ ipconfig เพื่อดูค่าของเครื่อง และ ping ตามด้วย IP เพื่อทดสอบว่าคุยกันได้หรือไม่',
      },
    ],
  },
  {
    id: 'dhcp-dns',
    order: 4,
    mission: 'dhcp-server',
    title: 'DHCP และ DNS',
    goal: 'ให้เครื่องรับ IP อัตโนมัติ และเรียกเครื่องอื่นด้วยชื่อได้',
    sections: [
      {
        h: 'DHCP: แจก IP อัตโนมัติ',
        p: [
          'DHCP (Dynamic Host Configuration Protocol) ทำให้เครื่องลูกข่ายได้ค่าเครือข่ายครบชุดโดยไม่ต้องตั้งเอง ได้แก่ IP Address, Subnet Mask, Default Gateway และ DNS Server ช่วยลดปัญหา IP ซ้ำและตั้งค่าผิด',
          'ขั้นตอนการขอ IP มี 4 ขั้น เรียกย่อว่า DORA: Discover (ขอ) → Offer (เสนอ) → Request (ยืนยันขอ) → Acknowledge (ตอบรับ)',
          'ถ้าเครื่องหา DHCP Server ไม่เจอ Windows จะตั้ง IP ให้ตัวเองเป็น 169.254.x.x (APIPA) ซึ่งอยู่คนละวงกับ Router จึงติดต่อ Router และเครื่องที่ได้ IP ตามปกติไม่ได้',
        ],
      },
      {
        h: 'Static IP สำหรับ Server',
        p: [
          'Server ควรใช้ IP แบบกำหนดเอง (Static) เพื่อให้ IP ไม่เปลี่ยน เครื่องอื่นจะหา Server เจอเสมอ ส่วนเครื่องลูกข่ายทั่วไปใช้ DHCP',
        ],
      },
      {
        h: 'DNS: เปลี่ยนชื่อเป็น IP',
        p: [
          'คนจำชื่อง่ายกว่าตัวเลข DNS (Domain Name System) จึงทำหน้าที่แปลงชื่อเป็น IP เหมือนสมุดโทรศัพท์ เครื่องต้องรู้ IP ของ DNS Server ก่อน (DHCP มักส่งค่านี้ให้)',
        ],
        code: ['C:\\> nslookup file-server', 'Name:    file-server.cai.local', 'Address:  192.168.1.10'],
      },
      {
        h: 'ทำใน CAI Net อย่างไร',
        list: [
          'คลิกเครื่อง แล้วเปลี่ยน "การรับ IP" ใน Inspector เป็น "อัตโนมัติ (DHCP)"',
          'Router ต้องเปิด "DHCP Server" ไว้ เครื่องจะได้ IP เริ่มที่ .100 และใช้ Router เป็น Gateway กับ DNS',
          'ชื่อ DNS ของเครื่อง = ชื่ออุปกรณ์ตัวพิมพ์เล็ก และใช้ - แทนช่องว่าง เช่น "File Server" → file-server',
          'ทดสอบใน Terminal ด้วย ipconfig /all, ping file-server และ nslookup file-server',
        ],
        tip: 'ภารกิจที่ 4: File Server ต้องตั้ง IP เอง เช่น 192.168.1.10 ส่วน Computer ทุกเครื่องใช้ DHCP',
      },
    ],
  },
];

const byId = (id) => LESSONS.find((l) => l.id === id);
const forMission = (missionId) => LESSONS.find((l) => l.mission === missionId);
const summary = (l) => ({ id: l.id, order: l.order, mission: l.mission, title: l.title, goal: l.goal });

module.exports = { LESSONS, byId, forMission, summary };
