import React from 'react'

interface AvatarProps {
  src?: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-yellow-500',
    'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

export function Avatar({ src, name, size = 'md', className = '' }: AvatarProps) {
  const sizeClass = SIZE_MAP[size]
  const colorClass = getAvatarColor(name)

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white dark:ring-gray-800 ${className}`}
        onError={(e) => {
          // Fallback para iniciais se a foto não carregar
          const target = e.target as HTMLImageElement
          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            parent.innerHTML = `<span class="text-white font-semibold">${getInitials(name)}</span>`
            parent.className = `${sizeClass} rounded-full ${colorClass} flex items-center justify-center ring-2 ring-white dark:ring-gray-800 ${className}`
          }
        }}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full ${colorClass} flex items-center justify-center ring-2 ring-white dark:ring-gray-800 flex-shrink-0 ${className}`}
      title={name}
    >
      <span className="text-white font-semibold">{getInitials(name)}</span>
    </div>
  )
}
