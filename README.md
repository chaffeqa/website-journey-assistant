# Web Journey Assistant

A smart chatbot that can be embedded in an iframe on any website to guide users through the site's features and functionality. The assistant uses Google's Gemini AI to analyze the page content and provide contextual guidance with interactive tooltips.

## Features

- 🤖 AI-powered website navigation assistance
- 💬 Interactive chat interface
- 🎯 Visual element highlighting
- 🔄 Context-aware guidance
- 📱 Responsive design
- ⌨️ Keyboard accessibility

## ⚠️ Security Warning

This version of the Web Journey Assistant makes AI API calls directly from the browser. This means that your either pass in an API key from your webpage or you have the user provide one.

## Features

- **AI-Powered Guidance**: Uses Google's Gemini AI to analyze the website's HTML and provide intelligent guidance
- **Privacy-Focused**: Only sends data to AI when the user explicitly asks for help
- **Contextual Help**: Understands the current page context and user's intent
- **Interactive Tooltips**: Highlights relevant elements on the page with explanatory tooltips
- **Navigation Awareness**: Tracks navigation events to maintain context
- **Simple Integration**: Easy to add to any website with minimal code
- **Client-Side Processing**: All AI processing happens in the browser

## Prerequisites

- A deployed Next.js application to host the assistant
- A Google Generative AI API key with access to Gemini models (users will need to provide their own)
- A website where you want to integrate the assistant

## Setup

### 1. Clone and Deploy the Assistant

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/web-journey-assistant.git
   cd web-journey-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. Build and deploy the application to your hosting provider (Vercel, Netlify, etc.):
   ```bash
   npm run build
   # Follow your hosting provider's deployment steps
   ```

### 2. Integrate with Your Website

Add the following script to your website:

```html
<!-- Add this near the end of your body tag -->
<script src="https://your-assistant-domain.com/parent-script.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    if (window.JourneyAssistant) {
      window.JourneyAssistant.init();
    }
  });
</script>
```

### 3. User Setup

When users interact with the chatbot, they will need to:

1. Obtain a Google Generative AI API key from [Google AI Studio](https://makersuite.google.com/)
2. Enter this API key in the chatbot interface when prompted
3. The API key will be stored in their browser's local storage for future sessions

## Privacy and Security Considerations

This implementation has the following privacy and security characteristics:

- **User-Provided API Keys**: Each user must provide their own API key
- **Local Storage**: API keys are stored in the browser's local storage
- **Client-Side Processing**: All AI API calls are made directly from the browser
- **User-Initiated Analysis**: The assistant only sends page content to the AI when a user explicitly asks for help
- **No Server Storage**: No data is stored on any server

## Advanced Configuration

### Customizing the Assistant

You can customize the appearance and functionality of the assistant by modifying the parameters passed to the `init` function:

```javascript
window.JourneyAssistant.init({
  position: 'bottom-right', // 'bottom-right', 'bottom-left', 'top-right', 'top-left'
  width: '350px',
  height: '500px',
  borderRadius: '8px',
  zIndex: 9999,
  onCloseCallback: () => {},
  geminiApiKey: "...",
  agentAdditionalInformation: "...",
});
```

### Manually Triggering Events

You can manually trigger different events from your website:

```javascript
// Notify the assistant of a navigation event
window.JourneyAssistant.notify('NAVIGATE', {
  url: window.location.href,
  title: document.title
});

// Highlight a specific element
window.JourneyAssistant.highlight('#my-button', 'Click this button to continue');

// Clear any active highlights
window.JourneyAssistant.clearHighlight();
```

## Getting a Google Generative AI API Key

To get a Google Generative AI API key for Gemini:

1. Go to the [Google AI Studio](https://makersuite.google.com/)
2. Sign in with your Google account
3. Click on "Get API key" in the top right corner
4. If you already have an API key, it will be displayed; otherwise, click "Create API key"
5. Copy the API key to use with the Web Journey Assistant

## Development

To run the project locally:

1. Clone the repository and install dependencies
2. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser


## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) for details.