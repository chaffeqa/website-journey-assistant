import { MESSAGE_EVENT_TYPES } from "./message-types"

type InitializationData = {
  apiKey: string;
  // Can add more initialization data here in the future
  agentAdditionalInformation: string | null;
}

let isInitialized = false;
let initData: InitializationData | null = null;

export function setupParentCommunication() {
  if (typeof window !== "undefined") {
    // Request initialization from parent
    window.parent.postMessage({ 
      type: MESSAGE_EVENT_TYPES.REQUEST_INIT 
    }, "*")
  }
}

export function waitForInitialization(): Promise<InitializationData> {
  return new Promise((resolve) => {
    if (isInitialized && initData) {
      resolve(initData);
      return;
    }

    const handleInitMessage = (event: MessageEvent) => {
      if (event.data.type === MESSAGE_EVENT_TYPES.INITIALIZE) {
        window.removeEventListener("message", handleInitMessage);
        isInitialized = true;
        initData = event.data.data as InitializationData;
        resolve(initData);
      }
    };

    window.addEventListener("message", handleInitMessage);
  });
}

// Function to get the current HTML from parent window
export async function getCurrentHtml(): Promise<string | null> {
  return new Promise((resolve) => {
    // Create a unique message ID
    const messageId = `get_html_${Date.now()}`

    // Setup a one-time listener for the response
    const listener = (event: MessageEvent) => {
      if (event.data.type === MESSAGE_EVENT_TYPES.GET_HTML_RESPONSE && event.data.messageId === messageId) {
        window.removeEventListener("message", listener)
        resolve(event.data.html)
      } else if (event.data.type === MESSAGE_EVENT_TYPES.GET_HTML_RESPONSE) {
        console.warn("Received HTML response with mismatched message ID:", event.data.messageId)
      }
    }

    window.addEventListener("message", listener)

    // Request HTML from parent
    window.parent.postMessage(
      {
        type: MESSAGE_EVENT_TYPES.GET_HTML,
        data: {
          messageId,
        },
      },
      "*",
    )

    // Timeout after 3 seconds
    setTimeout(() => {
      window.removeEventListener("message", listener)
      resolve(null)
    }, 3000)
  })
}

export function clearHighlight() {
  window.parent.postMessage(
    {
      type: MESSAGE_EVENT_TYPES.CLEAR_HIGHLIGHT,
    },
    "*",
  )
}

// Function to highlight an element in the parent window
export function highlightElement(selector: string, description?: string, menuSelectorToExpand?: string) {
  window.parent.postMessage(
    {
      type: MESSAGE_EVENT_TYPES.HIGHLIGHT_ELEMENT,
      data: {
        selector,
        description,
        menuSelectorToExpand,
      },
    },
    "*",
  )
}
