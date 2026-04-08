'use client'

import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { Locale } from '@/configs/i18n'

// Import dictionaries directly for client-side use
import enDict from '@/data/dictionaries/en.json'
import arDict from '@/data/dictionaries/ar.json'

const dictionaries: Record<Locale, typeof enDict> = {
  en: enDict,
  ar: arDict
}

export const useClientDictionary = () => {
  const params = useParams()
  const lang = (params?.lang as Locale) || 'en'
  
  return dictionaries[lang] || dictionaries.en
}

export default useClientDictionary
