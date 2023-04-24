# Website Content Summarizer
This project is a Node.js application that summarizes website content using OpenAI's GPT-3 engine.


## Features
- Fetch website content using `axios` and `cheerio`
- Remove unnecessary elements from the HTML
- Extract meta description and text from the HTML
- Preprocess text using the `natural` package
- Generate summaries using OpenAI's GPT-3 engine
- Print the summarized content and token usage


## Prerequisites
You'll need the following installed on your system:
- Node.js (v12 or later)
- NPM (v6 or later)


## Setup
1. Clone this repository:
git clone https://github.com/ComBba/HtmlToJsonUsingNode.js.git

2. Navigate to the project directory:
cd HtmlToJsonUsingNode.js

3. Install the required dependencies:
npm install

4. Create an `.env.local` file in the project root with the following content:
OPENAI_API_KEY=your_openai_api_key

Replace `your_openai_api_key` with your actual OpenAI API key.


## Usage
1. Run the application:
node webToJson.js

3. The application will fetch the website content, generate a summary using OpenAI's GPT-3 engine, and print the summarized content and token usage.

## License
This project is licensed under the MIT License.
