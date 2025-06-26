"use client"

import { useEffect, useRef, useState } from "react"
import { Card } from "@/components/ui/card"
import { ChatContainer } from "@/components/ui/chat-container"
import { Button } from "@/components/ui/button"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import { PromptInput, PromptInputTextarea, PromptInputActions, PromptInputAction } from "@/components/ui/prompt-input"
import { Loader2, SendHorizonalIcon } from "lucide-react"
import { setupParentCommunication, waitForInitialization } from "@/lib/parent-communication"
// import { analyzeWithAI } from "@/lib/client-ai-analyzer"
import { MESSAGE_EVENT_TYPES } from "@/lib/message-types"
import { getCurrentHtml, clearHighlight } from "@/lib/parent-communication"
import { USER_AVATAR_URL, AI_AVATAR_URL } from "@/lib/utils"
import {tools} from "@/lib/tools"
import { ApiKeyPrompt } from "./ui/api-key-prompt"
import {
  FunctionCallingConfigMode,
  Chat,
  GoogleGenAI,
} from '@google/genai';

type ChatMessage = {
  role: "user" | "model"
  content: string
  timestamp: Date
}

export function JourneyChatContainer() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content:
        "Hi! I'm your journey assistant. I can help guide you through using this website. Please describe what you're trying to do or what problem you're facing, and I'll help you navigate.",
      timestamp: new Date(),
    },
  ])
  const [chatInstance, setChatInstance] = useState<Chat | null>(null)
  const [input, setInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [agentAdditionalInformation, setAgentAdditionalInformation] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const messagesRef = useRef(messages)



  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    const initialize = async () => {
      try {
        const initData = await waitForInitialization()
        // console.log("Initialization data received:", initData)
        setApiKey(initData.apiKey || null)
        setAgentAdditionalInformation(initData.agentAdditionalInformation)
        setIsInitialized(true)
      } catch (error) {
        console.error("Initialization failed:", error)
      }
    }

    setupParentCommunication()
    initialize()
  }, [])

  // initialize the chat instance when API key is set
  useEffect(() => {
    if (apiKey) {
      const systemInstruction = `
      You are a helpful website navigation assistant. You have access to tools that can help users navigate and complete tasks on a website.
      
      When helping users, first get the page HTML using get_page_html, analyze it, then use highlight_element to guide them through completing their task.

      You can also clear any highlights with clear_highlight.

      When a user triggers a navigation event, the last highlight will automatically be removed and you will receive a message with the new URL, title, and HTML content. Use this information to provide context-aware assistance.
      You can also use the current page HTML to provide more accurate guidance.
      
      Always think step by step and explain your reasoning.
      
      Additional context about this website:
      ${agentAdditionalInformation || "No additional context provided"}
      `
      const ai = new GoogleGenAI({vertexai: false, apiKey: apiKey});
      const chat = ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          tools: tools,
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO,
            },
          },
          systemInstruction:
            systemInstruction,
          },
      });
      setChatInstance(chat)
    }
  }, [apiKey, agentAdditionalInformation])

  // Listen for messages from parent window
  useEffect(() => {
    if (!chatInstance) return

    const handleMessage = async (event: MessageEvent) => {
      const { type, data } = event.data;

      if (type === MESSAGE_EVENT_TYPES.NAVIGATION_EVENT) {
        // console.log("Navigation event received:", data)
        await clearHighlight()
        const userMessage: ChatMessage = {
          role: "user",
          content: `I just navigated to a new page: ${data.url || "unknown URL"}. The title is "${data.title || "unknown title"}". Please help me with this page.`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMessage])
        setIsProcessing(true)
        try {
          const response = await chatInstance.sendMessage({
            message: [
              {
                text: userMessage.content,
              },
              {
                functionCall: {
                  name: "get_page_html",
                },
                functionResponse: {
                  name: "get_page_html",
                  response: {
                    success: true,
                    html: data.html || "",
                  },
                },
              },
            ],
          });
          // add all the response candidates to the messages
          if (response.candidates) {
            const messagesToAdd: ChatMessage[] = []
            response.candidates.forEach((candidate) => {
              const parts = candidate.content?.parts || [];
              parts.forEach((part) => {
                if (part.text) {
                  messagesToAdd.push({
                    role: "model",
                    content: part.text,
                    timestamp: new Date(),
                  });
                }
              });
            });
            setMessages((prev) => [...prev, ...messagesToAdd]);
          }
        } catch (error) {
          console.error("Error processing navigation event:", error)
        } finally {
          setIsProcessing(false)
        }
        
      } else if (type === MESSAGE_EVENT_TYPES.NOTIFY_OF_COMPLETION) {
        const userMessage: ChatMessage = {
          role: "user",
          content: `I am done with the task I was working on. Thank you!`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, userMessage])
        const response = await chatInstance.sendMessage({
          message: [
            {
              text: userMessage.content,
            },
          ],
        });
        // add all the response candidates to the messages
        if (response.candidates) {
          const messagesToAdd: ChatMessage[] = []
          response.candidates.forEach((candidate) => {
            const parts = candidate.content?.parts || [];
            parts.forEach((part) => {
              if (part.text) {
                messagesToAdd.push({
                  role: "model",
                  content: part.text,
                  timestamp: new Date(),
                });
              }
            });
          });
          setMessages((prev) => [...prev, ...messagesToAdd]);
        }
      }
    }
    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [chatInstance])

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing || !chatInstance) {
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
      const html = await getCurrentHtml()
      const response = await chatInstance.sendMessage({
        message: [
          {
            text: userMessage.content,
          },
          {
            functionCall: {
              name: "get_page_html",
            },
            functionResponse: {
              name: "get_page_html",
              response: {
                success: true,
                html: html || "",
              },
            },
          },
        ],
      });
      // add all the response candidates to the messages
      if (response.candidates) {
        const messagesToAdd: ChatMessage[] = []
        response.candidates.forEach((candidate) => {
          const parts = candidate.content?.parts || [];
          parts.forEach((part) => {
            if (part.text) {
              messagesToAdd.push({
                role: "model",
                content: part.text,
                timestamp: new Date(),
              });
            }
          });
        });
        setMessages((prev) => [...prev, ...messagesToAdd]);
      }
    } catch (error) {
      console.error("Error processing message:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
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

  if (!apiKey) {
    return <ApiKeyPrompt onSubmit={(newApiKey) => setApiKey(newApiKey)} />
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
                src={message.role === "model" ? AI_AVATAR_URL : USER_AVATAR_URL}
                alt={message.role === "model" ? "AI" : "User"}
                fallback={message.role === "model" ? "AI" : "U"}
              />
              <MessageContent markdown={message.role === "model"}>
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
