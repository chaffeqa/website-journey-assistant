import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const USER_AVATAR_URL = 'https://placehold.co/64x64/000000/FFF?text=You'
export const AI_AVATAR_URL = "https://placehold.co/64x64/000000/FFF?text=Asst"