// ค่าเริ่มต้นของประเภทจุด — แอดมินแก้ชื่อ/สี/ไอคอนได้จากหน้า "ประเภทข้อมูล" (เก็บในฐานข้อมูล)
export const DEFAULT_CATEGORIES = [
  { key: 'soil', name: 'ศูนย์จัดการดินปุ๋ยชุมชน', short_name: 'ศดปช.', color: '#b45309', icon: 'Layers', sort_order: 1,
    description: 'ศูนย์ถ่ายทอดความรู้การวิเคราะห์ดิน การใช้ปุ๋ยตามค่าวิเคราะห์ดิน และการผลิตปุ๋ยอินทรีย์' },
  { key: 'cpmc', name: 'ศูนย์จัดการศัตรูพืชชุมชน', short_name: 'ศจช.', color: '#dc2626', icon: 'Bug', sort_order: 2,
    description: 'ศูนย์เรียนรู้การจัดการศัตรูพืชแบบผสมผสาน ผลิตและใช้ชีวภัณฑ์ เฝ้าระวังการระบาดในชุมชน' },
  { key: 'forecast', name: 'แปลงพยากรณ์', short_name: 'แปลงพยากรณ์', color: '#2563eb', icon: 'Radar', sort_order: 3,
    description: 'แปลงติดตามสถานการณ์การระบาดศัตรูพืชรายสัปดาห์ เพื่อแจ้งเตือนและพยากรณ์การระบาด' },
  { key: 'ffs', name: 'โรงเรียนเกษตรกร', short_name: 'รร.เกษตรกร', color: '#7c3aed', icon: 'GraduationCap', sort_order: 4,
    description: 'กระบวนการเรียนรู้แบบมีส่วนร่วมในแปลงเกษตรกร (Farmer Field School)' },
  { key: 'clinic', name: 'จุดบริการคลินิกพืช', short_name: 'คลินิกพืช', color: '#0d9488', icon: 'Stethoscope', sort_order: 5,
    description: 'บริการวินิจฉัยอาการผิดปกติของพืช แนะนำวิธีจัดการศัตรูพืชอย่างถูกต้องและปลอดภัย' },
]

export const DEFAULT_SETTINGS = {
  site_title: 'เครือข่ายอารักขาพืช จังหวัดเพชรบูรณ์',
  hero_subtitle: 'รวมศูนย์จัดการดินปุ๋ยชุมชน ศูนย์จัดการศัตรูพืชชุมชน แปลงพยากรณ์ โรงเรียนเกษตรกร และคลินิกพืช ไว้ในแผนที่เดียว ค้นหาจุดบริการใกล้บ้านได้ทันที',
  facebook_url: 'https://www.facebook.com/xarakkha.phuch.phechrburn?locale=th_TH',
  risk_map_url: 'https://plantriskmap.vercel.app/',
  office_name: 'กลุ่มอารักขาพืช สำนักงานเกษตรจังหวัดเพชรบูรณ์',
  office_phone: '',
}

export const AMPHOES = [
  'เมืองเพชรบูรณ์', 'ชนแดน', 'หล่มสัก', 'หล่มเก่า', 'วิเชียรบุรี', 'ศรีเทพ',
  'หนองไผ่', 'บึงสามพัน', 'น้ำหนาว', 'วังโป่ง', 'เขาค้อ',
]

export const LEVELS = ['A+', 'A', 'B', 'C']

export const PROVINCE_CENTER = [16.25, 101.2]

// ไอคอนที่แอดมินเลือกได้
export const ICON_CHOICES = ['Layers', 'Bug', 'Radar', 'GraduationCap', 'Stethoscope', 'Sprout', 'Leaf', 'Tractor', 'FlaskConical', 'Building2', 'MapPin', 'Wheat', 'TreePine', 'Microscope', 'Users']

// ฟิลด์ที่ใช้ในฟอร์ม/นำเข้า CSV
export const SITE_FIELDS = [
  ['category', 'ประเภท'], ['name', 'ชื่อ'], ['subtype', 'ประเภทย่อย'], ['level', 'ระดับ'],
  ['amphoe', 'อำเภอ'], ['tambon', 'ตำบล'], ['moo', 'หมู่'], ['address', 'ที่ตั้ง'],
  ['lat', 'ละติจูด'], ['lng', 'ลองจิจูด'], ['phone', 'เบอร์โทร'], ['contact_name', 'ผู้ประสานงาน/ประธาน'],
  ['main_crops', 'พืชหลัก'], ['members', 'สมาชิก (ราย)'], ['established_year', 'ปีที่จัดตั้ง (พ.ศ.)'],
  ['service_hours', 'วัน-เวลาให้บริการ'], ['status', 'สถานะ'], ['description', 'รายละเอียด'],
  ['image_url', 'รูปภาพ (URL)'], ['source', 'แหล่งข้อมูล'], ['is_published', 'แสดงบนเว็บ'],
]
