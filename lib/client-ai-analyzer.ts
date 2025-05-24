import { generateText } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

interface AIAnalysisResult {
  nextStep?: {
    selector: string
    description: string
    menuSelectorToExpand?: string
  }
  explanation: string
}


// Function to analyze HTML with AI directly from the client
export async function analyzeHtmlWithAI(
  html: string,
  userQuery: string,
  apiKey: string,
  agentAdditionalInformation: string | null,
  url?: string | null,
  title?: string | null
): Promise<AIAnalysisResult> {
  try {
    // Ensure userQuery is provided
    if (!userQuery || userQuery.trim() === "") {
      return {
        explanation: "Please describe what you're trying to do so I can help you navigate this page."
      }
    }

    const google = createGoogleGenerativeAI({
      apiKey,
    })

    const systemPrompt = `You are a web navigation assistant that helps users interact with websites.
Your task is to analyze HTML content and determine the most logical next step for the user based on their specific question or problem.
Focus on identifying links and form submit buttons that would help the user accomplish their task.  You can also use buttons that have the role="button" and aria-label attributes to identify actionable elements.
Use precise CSS selectors that will work in a browser environment. Do not use selectors that cannot be retrieved via document.querySelector such as :contains or :has. Prefer using IDs, aria attributes, hrefs, or titles that are likely to be unique when specifying a selector.
Never ask the user to interact with input elements.
If the user asks a question not about the website content, respond by letting them know you can only help with navigating the current site.
If the user asks a question that you are unsure about, respond by asking them to clarify their question as well as offer to direct them to any support resources available on the site.

Based on the user's specific question and the current webpage, determine the most logical next step.
Always respond with a JSON object that includes:
1. An explanation of what the user should do next to solve their specific problem.
2. A nextStep object with a valid CSS selector for the element to interact with and a description of the action.  If the next step is a link within an collapsed menu (specified by a role="menu" and aria-expanded="false"), include the menuSelectorToExpand field in the JSON response to indicate which menu must be expanded before interacting with the element.  The menuSelectorToExpand should be a button or link with the id specified by the aria-labelledby attribute on the menu.  Omit menuSelectorToExpand if the next step is not a link within an unexpanded menu. DO NOT direct the user to expand the menu as the action itself, but instead ALWAYS use the menuSelectorToExpand field to indicate which menu needs to be expanded in order to perform the next step.
3. If you cannot determine a specific element to interact with, omit the nextStep field.
4. If you see a message or alert (specified by a role="alert") that is relevant to the user's question, include it in the explanation.  If the alert is not relevant to the user's question, do not include it in the explanation.

Example responses of the JSON object:
{
  "explanation": "To find the lastest payments made, navigate to the 'Member Payment History' page.",
  "nextStep": {
    "selector": "#page-header [aria-labelledby="manage-menu"] a[href="/members"]",
    "description": "Click the 'Member Payment History' link to view your Member's payment history.",
    "menuSelectorToExpand": "#manage-menu"
  }
}
{
  "explanation": "To complete the form, you need to fill in the required fields first, then click the submit button.",
  "nextStep": {
    "selector": "[role='form'][action="/member_form_statuses/2"] [type='submit']",
    "description": "Complete the form and click submit."
  }
}
{
  "explanation": "You are viewing the last 10 payments made by your members."
}

${agentAdditionalInformation ? `\n\nAdditional Information:\n${agentAdditionalInformation}` : ""}
`

    // Create the prompt for the AI
    const prompt = createAIPrompt(html, userQuery, url, title)

    // Call the AI model using Gemini directly from the client
    const { text } = await generateText({
      model: google("models/gemini-2.5-flash-preview-05-20"),
      prompt,
      system: systemPrompt,
    })

    // Parse the AI response
    return parseAIResponse(text)
  } catch (error) {
    console.error("Error analyzing HTML with AI:", error)
    return {
      explanation: "I couldn't analyze the current page. Could you describe what you're trying to do in more detail?"
    }
  }
}

// Create a prompt for the AI based on HTML and user query
function createAIPrompt(html: string, userQuery: string, url?: string | null, pageTitle?: string | null): string {
  return `
The user has asked: "${userQuery}"

Here is the current webpage information:
${pageTitle ? `Page Title: ${pageTitle}` : ""}
${url ? `URL: ${url}` : ""}
HTML Content:
###############
${html}
###############

Based on the user's specific question and the current webpage, determine the most logical next step following the system prompt guidelines.
`
}

// Parse the AI response into a structured format
function parseAIResponse(response: string): AIAnalysisResult {
  try {
    // Extract JSON from the response (in case there's additional text)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[0]
      const parsed = JSON.parse(jsonStr)

      return {
        explanation: parsed.explanation || "I've analyzed the page but couldn't determine a specific next step.",
        nextStep: parsed.nextStep,
      }
    }

    // Fallback if JSON parsing fails
    return {
      explanation: response || "I've analyzed the page but couldn't determine a specific next step.",
    }
  } catch (error) {
    console.error("Error parsing AI response:", error, response)
    return {
      explanation: "I analyzed the page but encountered an error processing the results.",
    }
  }
}
