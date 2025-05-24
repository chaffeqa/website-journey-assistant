"use client"

import { useEffect, useRef } from "react"
import { JourneyChatContainer } from "../components/journey-chat-container"
import { setupParentCommunication } from "../lib/parent-communication"

export default function Home() {
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      // Setup communication with parent window
      setupParentCommunication()
      initialized.current = true
    }
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4">
      <div className="w-full max-w-md mx-auto">
        <h1 className="text-xl font-bold mb-4">Journey Assistant</h1>
        <JourneyChatContainer />
      </div>
    </main>
  )
}