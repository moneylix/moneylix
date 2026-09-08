import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-4 bg-[#334155]/20 rounded-full mb-4">
        <Icon size={40} className="text-[#334155]" />
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-[#94A3B8] max-w-[280px] mb-6">{description}</p>
      {action}
    </div>
  )
}
