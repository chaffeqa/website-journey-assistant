"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { ChatContainer } from "@/components/ui/chat-container"
import { Button } from "@/components/ui/button"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import { PromptInput, PromptInputTextarea, PromptInputActions, PromptInputAction } from "@/components/ui/prompt-input"
import { Loader2, SendHorizonalIcon } from "lucide-react"
import { setupParentCommunication, waitForInitialization } from "@/lib/parent-communication"
import { analyzeHtmlWithAI } from "@/lib/client-ai-analyzer"
import { MESSAGE_EVENT_TYPES } from "@/lib/message-types"
import { highlightElement, getCurrentHtml, clearHighlight } from "@/lib/parent-communication"
import { USER_AVATAR_URL, AI_AVATAR_URL } from "@/lib/utils"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export function JourneyChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your journey assistant. I can help guide you through using this website. Please describe what you're trying to do or what problem you're facing, and I'll help you navigate.",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [agentAdditionalInformation, setAgentAdditionalInformation] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [, setCurrentHtml] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState<string | null>(null)
  const [currentTitle, setCurrentTitle] = useState<string | null>(null)
  const messagesRef = useRef(messages)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const initialize = async () => {
      try {
        const initData = await waitForInitialization()
        console.log("Initialization data received:", initData)
        setApiKey(initData.apiKey || process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY || null)
        setAgentAdditionalInformation(initData.agentAdditionalInformation)
        setIsInitialized(true)
      } catch (error) {
        console.error("Initialization failed:", error)
      }
    }

    setupParentCommunication()
    initialize()
  }, [])

  // Listen for messages from parent window
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const { type, data } = event.data;
      
      if (type === MESSAGE_EVENT_TYPES.NAVIGATION_EVENT) {
        console.log("Navigation event received:", data)
        // Store URL and title for context
        if (data) {
          setCurrentUrl(data.url || null)
          setCurrentTitle(data.title || null)
          setCurrentHtml(data.html || null)
        }
        clearHighlight()
        console.log(`Current URL: ${data.url}, last messages:`)
        console.dir(messagesRef.current)
        // find the last user message and use it as context
        const lastUserMessage = messagesRef.current.slice().reverse().find((msg) => msg.role === "user")

        if (lastUserMessage) {
          // Check if API key is available
          if (!apiKey) {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: "The API key is not configured. Please check the application setup.",
                timestamp: new Date(),
              },
            ])
            return
          }
          // Notify the user of navigation without AI analysis
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `I notice you've navigated to a new page${data?.title ? ` titled "${data.title}"` : ""}.  Retrieving the next step...`,
              timestamp: new Date(),
            },
          ])
          // If we have HTML, we can analyze it
          if (data?.html) {
            const analysis = await analyzeHtmlWithAI(data.html, lastUserMessage.content, apiKey, data.url, data.title)

            // Add assistant message
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: analysis.explanation,
                timestamp: new Date(),
              },
            ])

            // Highlight the element if a selector was provided
            if (analysis.nextStep) {
              highlightElement(analysis.nextStep.selector, analysis.nextStep.description)
            }
          }
        } else {
          // we dont have a current user message - so ignore the navigation and wait for the user to ask a question
          // setMessages((prev) => [
          //   ...prev,
          //   {
          //     role: "assistant",
          //     content: `I notice you've navigated to a new page${data?.title ? ` titled "${data.title}"` : ""}.  Would you like any help with this page?`,
          //     timestamp: new Date(),
          //   },
          // ])
        }
      } else if (type === MESSAGE_EVENT_TYPES.NOTIFY_OF_COMPLETION) {
        console.log("Completion event received:", data)
        // Notify the user of completion
        setMessages(() => [
          {
            role: "assistant",
            content: `Glad to hear that you've completed a task on this page. Let me know if you need help with anything else!`,
            timestamp: new Date(),
          },
        ])
      }
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [apiKey, agentAdditionalInformation])

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing || !apiKey) {
      console.error(`"Input is empty or processing is already in progress or API key is not set": ${input}, ${isProcessing}, ${apiKey}`)
      return
    }

    const userMessage = {
      role: "user" as const,
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsProcessing(true)

    try {
      // Get current HTML if we don't have it
      const html = await getCurrentHtml()
      setCurrentHtml(html)

      if (html) {
        // Now that the user has specified a problem, analyze the HTML
        const analysis = await analyzeHtmlWithAI(html, userMessage.content, apiKey, agentAdditionalInformation, currentUrl, currentTitle)

        // Add assistant message
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: analysis.explanation,
            timestamp: new Date(),
          },
        ])

        // Highlight the element if a selector was provided
        if (analysis.nextStep) {
          highlightElement(analysis.nextStep.selector, analysis.nextStep.description, analysis.nextStep.menuSelectorToExpand)
        }
      } else {
        // Fallback if we couldn't get HTML
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "I couldn't access the current page. Could you describe what you're trying to do in more detail?",
            timestamp: new Date(),
          },
        ])
      }
    } catch (error) {
      console.error("Error processing message:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I encountered an error while processing your request. Please check the API key configuration.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isInitialized) {
    return (
      <Card className="w-full">
        <div className="h-[400px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Initializing chat assistant...
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <div className="flex flex-col h-[400px]">
        <ChatContainer className="flex-1 p-4 overflow-y-auto">
          {messages.map((message, index) => (
            <Message 
              key={index} 
              className="mb-4"
            >
              <MessageAvatar
                src={message.role === "assistant" ? AI_AVATAR_URL : USER_AVATAR_URL}
                alt={message.role === "assistant" ? "AI" : "User"}
                fallback={message.role === "assistant" ? "AI" : "U"}
              />
              <MessageContent markdown={message.role === "assistant"}>
                {message.content}
              </MessageContent>
            </Message>
          ))}
        </ChatContainer>

        <div className="p-4 border-t">
          <PromptInput
            value={input}
            onValueChange={setInput}
            isLoading={isProcessing}
            onSubmit={handleSubmit}
          >
              <PromptInputTextarea
                placeholder="What would you like to do on this website?"
              />
              <PromptInputActions className="flex items-center justify-end gap-2 pt-2">
                <PromptInputAction tooltip={isProcessing ? "Stop generation" : "Send message"}>
                <Button
                  size="icon"
                  onClick={handleSubmit}
                  disabled={!input.trim() || isProcessing}
                  className="h-8 w-8 rounded-full"
                >
                  {isProcessing ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <SendHorizonalIcon className="size-5" />
                  )}
                </Button>
                </PromptInputAction>
              </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </Card>
  )
}
