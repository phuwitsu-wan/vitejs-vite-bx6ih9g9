import { asset } from '../lib/asset'
export default function Spinner({ full }) {
  return (
    <div className={full ? 'grid h-full min-h-[50vh] place-items-center' : 'grid place-items-center p-6'}>
      <div className="flex flex-col items-center gap-3 text-forest-800">
        <img src={asset("/pp-logo.webp")} alt="" className="h-14 w-14 animate-float" />
        <span className="text-sm">กำลังโหลดข้อมูล…</span>
      </div>
    </div>
  )
}
