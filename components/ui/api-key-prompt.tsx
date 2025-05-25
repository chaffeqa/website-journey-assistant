import { useState } from "react"
import { Card } from "./card"
import { Button } from "./button"
import { Input } from "./input"

interface ApiKeyPromptProps {
  onSubmit: (apiKey: string) => void
}

export function ApiKeyPrompt({ onSubmit }: ApiKeyPromptProps) {
  const [apiKey, setApiKey] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) {
      setError("API key is required")
      return
    }
    onSubmit(apiKey.trim())
  }

  return (
    <Card className="p-6 max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Enter Gemini API Key</h2>
          <p className="text-sm text-muted-foreground">
            To use the chat assistant, please provide your Gemini API key.
            You can get one from the{" "}
            <a 
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Google AI Studio
            </a>
          </p>
        </div>
        
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Enter your API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full"
          />
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <Button type="submit" className="w-full">
          Submit
        </Button>
      </form>
    </Card>
  )
}