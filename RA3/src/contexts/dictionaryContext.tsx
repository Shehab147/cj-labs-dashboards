'use client'

import { createContext, useContext, type ReactNode } from 'react'

// Import dictionaries statically for client-side use
import en from '@/data/dictionaries/en.json'
import ar from '@/data/dictionaries/ar.json'
import { useParams } from 'next/navigation'

export type Dictionary = typeof en

const dictionaries: Record<string, Dictionary> = { en, ar }

const DictionaryContext = createContext<Dictionary>(en)

export function DictionaryProvider({ children }: { children: ReactNode }) {
  const { lang } = useParams()
  const locale = (lang as string) || 'en'
  const dictionary = dictionaries[locale] || en

  return <DictionaryContext.Provider value={dictionary}>{children}</DictionaryContext.Provider>
}

export function useDictionary(): Dictionary {
  return useContext(DictionaryContext)
}
