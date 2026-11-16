// ใช้กับไฟล์ในโฟลเดอร์ public ให้ทำงานได้ทั้งบนโดเมนหลักและโฟลเดอร์ย่อย
export const asset = (p) => import.meta.env.BASE_URL + p.replace(/^\//, '')
