# Circuit Documenter

Circuit Documenter is an automated web crawler that uses AI to generate documentation for user flows in a web application. It navigates a site like a user, captures screenshots and DOM states, and creates detailed Markdown documentation for each interaction path.

## Core Technologies

- **Playwright:** For robust browser automation and crawling.
- **LangGraph & LangChain:** To create an autonomous agent that decides where to click and what to document.
- **Better-Sqlite3:** For persisting crawl state and results.
- **Docusaurus:** For rendering the final documentation.
- **GitHub Actions:** For nightly scheduled crawls and documentation updates.

## Setup

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Configure environment:**
    Create a `.env` file and add your OpenAI API key.
    ```
    OPENAI_API_KEY=your_api_key_here
    ```

3.  **Run the crawler:**
    ```bash
    pnpm crawl
    ```

4.  **View the documentation:**
    The generated docs will be in the `/docs` directory.

## Using Dev Containers

This project is configured to run in a [Dev Container](https://code.visualstudio.com/docs/devcontainers/containers). To get started, ensure you have Docker installed and running. Then, open the command palette and select `Dev Containers: Reopen in Container`. 