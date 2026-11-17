/**
 * ระบบหลังบ้าน "เครือข่ายอารักขาพืช จังหวัดเพชรบูรณ์" บน Google Sheets
 * --------------------------------------------------------------------
 * วิธีติดตั้ง (รายละเอียดใน README.md)
 *  1) เปิด Google Sheet ข้อมูล > ส่วนขยาย > Apps Script > วางโค้ดนี้ทั้งหมด > บันทึก
 *  2) เลือกฟังก์ชัน setup แล้วกด "เรียกใช้" (ครั้งแรกจะขออนุญาต ให้กดยอมรับ)
 *  3) ใส่อีเมล/รหัสผ่านแอดมินในแผ่นงาน "admins"
 *  4) ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > ประเภท "เว็บแอป"
 *       ดำเนินการในฐานะ: ฉัน  |  ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน
 *  5) คัดลอก URL ที่ลงท้ายด้วย /exec ไปใส่ใน Vercel เป็น VITE_GAS_URL
 */

const SITE_HEADERS = ['id', 'category', 'name', 'subtype', 'level', 'amphoe', 'tambon', 'moo', 'address', 'lat', 'lng',
  'phone', 'contact_name', 'main_crops', 'members', 'established_year', 'service_hours', 'status', 'description',
  'image_url', 'documents', 'extra', 'is_published', 'source', 'updated_at']
const CAT_HEADERS = ['key', 'name', 'short_name', 'color', 'icon', 'description', 'sort_order', 'is_visible']
const SET_HEADERS = ['key', 'value']
const ADMIN_HEADERS = ['email', 'password', 'name']
const TEXT_COLS = ['phone', 'moo', 'tambon', 'id', 'established_year']
const NUM_COLS = ['lat', 'lng', 'members', 'sort_order']
const BOOL_COLS = ['is_published', 'is_visible']
const JSON_COLS = ['documents', 'extra']
const TOKEN_DAYS = 7
const MAX_UPLOAD_MB = 20

// ======================= HTTP =======================
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'data'
  try {
    if (action === 'version') return json_({ version: getVersion_() })
    if (action === 'data') return json_(getPublicData_())
    return json_({ error: 'unknown action' })
  } catch (err) {
    return json_({ error: String(err && err.message || err) })
  }
}

function doPost(e) {
  let body = {}
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}') } catch (_) { /* ignore */ }
  try {
    const a = body.action
    if (a === 'login') return json_(login_(body.email, body.password))
    const user = verifyToken_(body.token)
    if (!user) return json_({ error: 'AUTH', message: 'กรุณาเข้าสู่ระบบใหม่' })
    if (a === 'adminData') return json_(buildData_(true))
    if (a === 'me') return json_({ email: user })

    const lock = LockService.getScriptLock()
    lock.waitLock(25000)
    try {
      let res
      switch (a) {
        case 'saveSite': res = saveSite_(body.site, user); break
        case 'deleteSites': res = deleteSites_(body.ids); break
        case 'setPublished': res = setPublished_(body.ids, body.value); break
        case 'bulkInsert': res = bulkInsert_(body.rows, user); break
        case 'saveCategory': res = saveCategory_(body.category); break
        case 'deleteCategory': res = deleteCategory_(body.key); break
        case 'saveSettings': res = saveSettings_(body.settings); break
        case 'uploadFile': res = uploadFile_(body); break
        case 'trashFile': res = trashFile_(body.id); break
        default: return json_({ error: 'unknown action' })
      }
      bumpVersion_()
      return json_(res || { ok: true })
    } finally {
      lock.releaseLock()
    }
  } catch (err) {
    return json_({ error: String(err && err.message || err) })
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

// ======================= SETUP =======================
function setup() {
  const ss = ss_()
  const props = PropertiesService.getScriptProperties()
  props.setProperty('SPREADSHEET_ID', ss.getId())
  if (!props.getProperty('TOKEN_SECRET')) props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid())

  const sites = ensureSheet_(ss, 'sites', SITE_HEADERS)
  const cats = ensureSheet_(ss, 'categories', CAT_HEADERS)
  const sets = ensureSheet_(ss, 'settings', SET_HEADERS)
  const admins = ensureSheet_(ss, 'admins', ADMIN_HEADERS)

  // คอลัมน์ข้อความ (กันเลข 0 หน้าเบอร์โทรหาย)
  TEXT_COLS.forEach(function (c) {
    const i = SITE_HEADERS.indexOf(c) + 1
    sites.getRange(2, i, sites.getMaxRows() - 1, 1).setNumberFormat('@')
  })
  const pub = SITE_HEADERS.indexOf('is_published') + 1
  sites.getRange(2, pub, sites.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build())
  const vis = CAT_HEADERS.indexOf('is_visible') + 1
  cats.getRange(2, vis, cats.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build())

  if (cats.getLastRow() < 2) {
    cats.getRange(2, 1, 5, CAT_HEADERS.length).setValues([
      ['soil', 'ศูนย์จัดการดินปุ๋ยชุมชน', 'ศดปช.', '#b45309', 'Layers', 'ศูนย์ถ่ายทอดความรู้การวิเคราะห์ดิน การใช้ปุ๋ยตามค่าวิเคราะห์ดิน และการผลิตปุ๋ยอินทรีย์', 1, true],
      ['cpmc', 'ศูนย์จัดการศัตรูพืชชุมชน', 'ศจช.', '#dc2626', 'Bug', 'ศูนย์เรียนรู้การจัดการศัตรูพืชแบบผสมผสาน ผลิตและใช้ชีวภัณฑ์ เฝ้าระวังการระบาดในชุมชน', 2, true],
      ['forecast', 'แปลงพยากรณ์', 'แปลงพยากรณ์', '#2563eb', 'Radar', 'แปลงติดตามสถานการณ์การระบาดศัตรูพืชรายสัปดาห์ เพื่อแจ้งเตือนและพยากรณ์การระบาด', 3, true],
      ['ffs', 'โรงเรียนเกษตรกร', 'รร.เกษตรกร', '#7c3aed', 'GraduationCap', 'กระบวนการเรียนรู้แบบมีส่วนร่วมในแปลงเกษตรกร (Farmer Field School)', 4, true],
      ['clinic', 'จุดบริการคลินิกพืช', 'คลินิกพืช', '#0d9488', 'Stethoscope', 'บริการวินิจฉัยอาการผิดปกติของพืช แนะนำวิธีจัดการศัตรูพืชอย่างถูกต้องและปลอดภัย', 5, true],
    ])
  }
  if (admins.getLastRow() < 2) {
    admins.getRange(2, 1, 1, 3).setValues([['admin@example.com', '', 'แอดมิน (ใส่รหัสผ่านอย่างน้อย 6 ตัวอักษร)']])
  }

  getFolder_()
  // ทริกเกอร์: แก้ข้อมูลในชีตโดยตรงแล้วเว็บอัปเดตด้วย
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onSheetChange') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onEdit().create()
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(ss).onChange().create()
  bumpVersion_()
  Logger.log('ติดตั้งเรียบร้อย — ใส่อีเมล/รหัสผ่านในแผ่นงาน admins แล้ว Deploy เป็นเว็บแอป')
}

function onSheetChange() { bumpVersion_() }

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name)
  if (!sh) sh = ss.insertSheet(name)
  const cur = sh.getRange(1, 1, 1, headers.length).getValues()[0]
  if (cur.join('') === '') sh.getRange(1, 1, 1, headers.length).setValues([headers])
  else {
    // เติมหัวคอลัมน์ที่ขาด
    const have = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String)
    headers.forEach(function (h) { if (have.indexOf(h) < 0) { sh.getRange(1, sh.getLastColumn() + 1).setValue(h) } })
  }
  sh.setFrozenRows(1)
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#0f3d24').setFontColor('#ffffff')
  return sh
}

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet()
}

// ======================= VERSION / CACHE =======================
function getVersion_() {
  return PropertiesService.getScriptProperties().getProperty('DATA_VERSION') || '1'
}
function bumpVersion_() {
  PropertiesService.getScriptProperties().setProperty('DATA_VERSION', Date.now() + '-' + Math.floor(Math.random() * 1e6))
}

function getPublicData_() {
  const v = getVersion_()
  const cache = CacheService.getScriptCache()
  const head = cache.get('pub_' + v + '_n')
  if (head) {
    const n = Number(head)
    const keys = []
    for (let i = 0; i < n; i++) keys.push('pub_' + v + '_' + i)
    const parts = cache.getAll(keys)
    if (Object.keys(parts).length === n) return JSON.parse(keys.map(function (k) { return parts[k] }).join(''))
  }
  const data = buildData_(false)
  const s = JSON.stringify(data)
  const size = 90000, chunks = {}
  let n = 0
  for (let i = 0; i < s.length; i += size) chunks['pub_' + v + '_' + (n++)] = s.substring(i, i + size)
  chunks['pub_' + v + '_n'] = String(n)
  try { cache.putAll(chunks, 21600) } catch (_) { /* ข้อมูลใหญ่เกินแคช ไม่เป็นไร */ }
  return data
}

// ======================= READ =======================
function readTable_(name) {
  const sh = ss_().getSheetByName(name)
  if (!sh || sh.getLastRow() < 2) return []
  const values = sh.getDataRange().getValues()
  const head = values[0].map(function (h) { return String(h).trim() })
  const out = []
  for (let r = 1; r < values.length; r++) {
    const row = values[r]
    if (row.join('') === '') continue
    const o = {}
    head.forEach(function (h, i) { if (h) o[h] = normalize_(h, row[i]) })
    // แถวที่เพิ่มเองในชีตแล้วไม่มี id — ใส่ให้อัตโนมัติ
    if (name === 'sites' && !o.id && o.name) {
      o.id = Utilities.getUuid()
      sh.getRange(r + 1, head.indexOf('id') + 1).setNumberFormat('@').setValue(o.id)
    }
    out.push(o)
  }
  return out
}

function normalize_(k, v) {
  if (v === '' || v === null || v === undefined) {
    if (k === 'is_published' || k === 'is_visible') return true
    if (k === 'documents') return []
    if (k === 'extra') return {}
    return null
  }
  if (v instanceof Date) return v.toISOString()
  if (BOOL_COLS.indexOf(k) >= 0) return !(v === false || /^(false|0|no|ไม่|ซ่อน)$/i.test(String(v).trim()))
  if (NUM_COLS.indexOf(k) >= 0) { const n = Number(v); return isNaN(n) ? null : n }
  if (k === 'established_year') { const n = parseInt(v, 10); return isNaN(n) ? null : n }
  if (JSON_COLS.indexOf(k) >= 0) {
    if (typeof v === 'string') { try { return JSON.parse(v) } catch (_) { return k === 'documents' ? [] : {} } }
    return v
  }
  return typeof v === 'string' ? v.trim() : String(v)
}

function buildData_(admin) {
  let sites = readTable_('sites')
  let categories = readTable_('categories').sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0) })
  const settings = {}
  readTable_('settings').forEach(function (r) { if (r.key) settings[r.key] = r.value == null ? '' : r.value })
  if (!admin) {
    const visible = {}
    categories = categories.filter(function (c) { return c.is_visible !== false })
    categories.forEach(function (c) { visible[c.key] = true })
    sites = sites.filter(function (s) { return s.is_published !== false && visible[s.category] })
  }
  return { sites: sites, categories: categories, settings: settings, version: getVersion_() }
}

// ======================= WRITE =======================
function sheetInfo_(name, headers) {
  const sh = ss_().getSheetByName(name)
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String)
  return { sh: sh, head: head }
}

function toCell_(k, v) {
  if (v === null || v === undefined) return ''
  if (JSON_COLS.indexOf(k) >= 0) return JSON.stringify(v || (k === 'documents' ? [] : {}))
  if (BOOL_COLS.indexOf(k) >= 0) return v !== false
  if (TEXT_COLS.indexOf(k) >= 0) return String(v)
  return v
}

function rowFor_(head, obj) {
  return head.map(function (h) { return h ? toCell_(h, obj[h]) : '' })
}

function findRow_(sh, colIndex, value) {
  const last = sh.getLastRow()
  if (last < 2) return -1
  const vals = sh.getRange(2, colIndex + 1, last - 1, 1).getValues()
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(value)) return i + 2
  return -1
}

function setTextFormat_(sh, head, row, n) {
  TEXT_COLS.forEach(function (c) {
    const i = head.indexOf(c)
    if (i >= 0) sh.getRange(row, i + 1, n || 1, 1).setNumberFormat('@')
  })
}

function saveSite_(site, user) {
  if (!site || !site.name) throw new Error('ข้อมูลไม่ครบ')
  const t = sheetInfo_('sites')
  const idCol = t.head.indexOf('id')
  site.updated_at = new Date().toISOString()
  let row = site.id ? findRow_(t.sh, idCol, site.id) : -1
  if (row < 0) {
    if (!site.id) site.id = Utilities.getUuid()
    row = t.sh.getLastRow() + 1
  } else {
    // คงค่าคอลัมน์ที่ไม่ได้ส่งมา
    const old = t.sh.getRange(row, 1, 1, t.head.length).getValues()[0]
    t.head.forEach(function (h, i) { if (h && !(h in site)) site[h] = normalize_(h, old[i]) })
  }
  setTextFormat_(t.sh, t.head, row)
  t.sh.getRange(row, 1, 1, t.head.length).setValues([rowFor_(t.head, site)])
  return { ok: true, id: site.id }
}

function bulkInsert_(rows, user) {
  if (!rows || !rows.length) return { ok: true, count: 0 }
  const t = sheetInfo_('sites')
  const now = new Date().toISOString()
  const data = rows.map(function (r) { r.id = r.id || Utilities.getUuid(); r.updated_at = now; return rowFor_(t.head, r) })
  const start = t.sh.getLastRow() + 1
  setTextFormat_(t.sh, t.head, start, data.length)
  t.sh.getRange(start, 1, data.length, t.head.length).setValues(data)
  return { ok: true, count: data.length }
}

function deleteSites_(ids) {
  const t = sheetInfo_('sites')
  const idCol = t.head.indexOf('id')
  const set = {}
  ;(ids || []).forEach(function (i) { set[i] = true })
  const vals = t.sh.getRange(2, idCol + 1, Math.max(t.sh.getLastRow() - 1, 1), 1).getValues()
  for (let i = vals.length - 1; i >= 0; i--) if (set[String(vals[i][0])]) t.sh.deleteRow(i + 2)
  return { ok: true }
}

function setPublished_(ids, value) {
  const t = sheetInfo_('sites')
  const idCol = t.head.indexOf('id'), pubCol = t.head.indexOf('is_published')
  const set = {}
  ;(ids || []).forEach(function (i) { set[i] = true })
  const n = t.sh.getLastRow() - 1
  if (n < 1) return { ok: true }
  const idv = t.sh.getRange(2, idCol + 1, n, 1).getValues()
  const pr = t.sh.getRange(2, pubCol + 1, n, 1)
  const pv = pr.getValues()
  for (let i = 0; i < n; i++) if (set[String(idv[i][0])]) pv[i][0] = value !== false
  pr.setValues(pv)
  return { ok: true }
}

function saveCategory_(c) {
  if (!c || !c.key || !c.name) throw new Error('ข้อมูลประเภทไม่ครบ')
  const t = sheetInfo_('categories')
  let row = findRow_(t.sh, t.head.indexOf('key'), c.key)
  if (row < 0) row = t.sh.getLastRow() + 1
  t.sh.getRange(row, 1, 1, t.head.length).setValues([rowFor_(t.head, c)])
  return { ok: true }
}

function deleteCategory_(key) {
  const t = sheetInfo_('categories')
  const row = findRow_(t.sh, t.head.indexOf('key'), key)
  if (row > 0) t.sh.deleteRow(row)
  return { ok: true }
}

function saveSettings_(obj) {
  const t = sheetInfo_('settings')
  Object.keys(obj || {}).forEach(function (k) {
    let row = findRow_(t.sh, 0, k)
    if (row < 0) row = t.sh.getLastRow() + 1
    t.sh.getRange(row, 1, 1, 2).setValues([[k, obj[k] == null ? '' : String(obj[k])]])
  })
  return { ok: true }
}

// ======================= FILES (Google Drive) =======================
function getFolder_() {
  const props = PropertiesService.getScriptProperties()
  const id = props.getProperty('FOLDER_ID')
  if (id) { try { return DriveApp.getFolderById(id) } catch (_) { /* สร้างใหม่ */ } }
  const f = DriveApp.createFolder('ไฟล์เว็บเครือข่ายอารักขาพืช (อย่าลบ)')
  props.setProperty('FOLDER_ID', f.getId())
  return f
}

function uploadFile_(b) {
  if (!b.data) throw new Error('ไม่มีไฟล์')
  const bytes = Utilities.base64Decode(b.data)
  if (bytes.length > MAX_UPLOAD_MB * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน ' + MAX_UPLOAD_MB + ' MB')
  const blob = Utilities.newBlob(bytes, b.mimeType || 'application/octet-stream', b.name || 'file')
  const file = getFolder_().createFile(blob)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  const id = file.getId()
  return {
    ok: true, id: id, name: file.getName(), size: file.getSize(), mime: b.mimeType,
    url: 'https://drive.google.com/file/d/' + id + '/view',
    download: 'https://drive.google.com/uc?export=download&id=' + id,
    image: 'https://lh3.googleusercontent.com/d/' + id + '=w1280',
  }
}

function trashFile_(id) {
  if (!id) return { ok: true }
  try {
    const f = DriveApp.getFileById(id)
    const parents = f.getParents()
    if (parents.hasNext() && parents.next().getId() === getFolder_().getId()) f.setTrashed(true)
  } catch (_) { /* ไม่พบไฟล์ */ }
  return { ok: true }
}

// ======================= AUTH =======================
function login_(email, password) {
  email = String(email || '').trim().toLowerCase()
  const cache = CacheService.getScriptCache()
  const failKey = 'fail_' + email
  const fails = Number(cache.get(failKey) || 0)
  if (fails >= 8) throw new Error('ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาที')
  const admins = readTable_('admins')
  const ok = admins.some(function (a) {
    return String(a.email || '').trim().toLowerCase() === email && String(a.password || '') === String(password || '') && String(a.password || '').length >= 6
  })
  if (!ok) {
    cache.put(failKey, String(fails + 1), 900)
    throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  }
  cache.remove(failKey)
  const exp = Date.now() + TOKEN_DAYS * 86400000
  return { ok: true, email: email, token: sign_(email + '|' + exp), expires: exp }
}

function sign_(payload) {
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET')
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret))
  return Utilities.base64EncodeWebSafe(payload, Utilities.Charset.UTF_8) + '.' + sig
}

function verifyToken_(token) {
  if (!token || token.indexOf('.') < 0) return null
  const parts = token.split('.')
  let payload
  try { payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8') } catch (_) { return null }
  if (sign_(payload) !== token) return null
  const p = payload.split('|')
  if (Number(p[1]) < Date.now()) return null
  // ยังเป็นแอดมินอยู่หรือไม่ (ลบแถวในชีตแล้วจะเข้าไม่ได้ทันที)
  const still = readTable_('admins').some(function (a) { return String(a.email || '').trim().toLowerCase() === p[0] })
  return still ? p[0] : null
}
