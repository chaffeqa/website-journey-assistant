import { getCurrentHtml, highlightElement, clearHighlight } from "./parent-communication"
import {FunctionDeclaration, Type, CallableTool, Part} from '@google/genai';


export const getPageHtmlTool: FunctionDeclaration = {
    name: "get_page_html",
    description: "Retrieves the HTML content of the current page",
    parameters: {},
}
export const highlightElementTool: FunctionDeclaration = {
    name: "highlight_element",
    description: "Highlights an element on the page and shows a tooltip with instructions",
    parameters: {
        type: Type.OBJECT,
        properties: {
            selector: { type: Type.STRING, description: "CSS selector of the element to highlight" },
            description: { type: Type.STRING, description: "Description to show in the tooltip" },
            menuSelectorToExpand: { type: Type.STRING, description: "Optional CSS selector for a menu to expand" }
        },
        required: ["selector", "description"]
    },
}
export const clearHighlightTool: FunctionDeclaration = {
    name: "clear_highlight",
    description: "Clears any active element highlights on the page",
    parameters: {},
}


export const tools: CallableTool[] = [
  {
    tool: async () => {
        return Promise.resolve({
        functionDeclarations: [getPageHtmlTool, highlightElementTool, clearHighlightTool],
      });
    },
    callTool: async (params: FunctionDeclaration[]): Promise<Part[]> => {
      console.log('Tool called', params);
      const responses: Part[] = [];
      for (const param of params) {
        if (param.name === 'highlight_element') {
          const { selector, description, menuSelectorToExpand } = param.parameters as {
            selector: string
            description?: string
            menuSelectorToExpand?: string
            };
            highlightElement(selector, description, menuSelectorToExpand);
            const response: Part = {
                functionResponse: {
                name: 'highlight_element',
                response: { success: true },
                },
            };
            responses.push(response);
            }
        else if (param.name === 'get_page_html') {
            const html = await getCurrentHtml();
            const response: Part = {
                functionResponse: {
                    name: 'get_page_html',
                    response: { html },
                },
            };
            responses.push(response);
        }
        else if (param.name === 'clear_highlight') {
            clearHighlight();
            const response: Part = {
                functionResponse: {
                    name: 'clear_highlight',
                    response: { success: true },
                },
            };
            responses.push(response);
        }
        else {
            const response: Part = {
                functionResponse: {
                    name: param.name,
                    response: { success: false, error: 'Unknown tool' },
                },
            };
            responses.push(response);
        }
    }
    return responses;
},
  },
]