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
    pnpm crawl https://your-app.local
    # => traces/trace-<timestamp>.zip
    ```

## Running the crawler

You can run the crawler in two modes:

### One-off trace
This captures a single Playwright trace for debugging.

```bash
pnpm crawl https://example.com
```

### Exploratory graph crawl
This simulates a user exploring the application by clicking links.

```bash
# Crawl 5 levels deep with a visible browser
pnpm crawl https://example.com --graph --depth=5 --headful
```

### Regenerate docs

```bash
# rebuild only one flow
pnpm docs:regen "https://example.com"

# rebuild all flows
pnpm docs:regen
```

4.  **View the documentation:**
    The generated docs will be in the `/docs` directory.

## Using Dev Containers

This project is configured to run in a [Dev Container](https://code.visualstudio.com/docs/devcontainers/containers). To get started, ensure you have Docker installed and running. Then, open the command palette and select `Dev Containers: Reopen in Container`. 

## Production deployment

### Environment Configuration

For different environments like staging or production, create a `.env` file based on `.env.example`. You'll need to configure `LOGIN_URL`, `USERNAME`, and `PASSWORD` for automated authentication. For production, it's highly recommended to set up S3 off-loading by providing the `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` variables.

### Authentication

The crawler can authenticate using two methods:
1.  **Saved Session**: If an `auth.json` file exists, it will be used to restore the browser session, including cookies and local storage.
2.  **Environment Variables**: If `auth.json` is not found, the crawler will attempt to log in using the `LOGIN_URL`, `USERNAME`, and `PASSWORD` variables from your `.env` file. After a successful login, it will create `auth.json` for subsequent runs.

To clear a saved session and force a new login, run:
```bash
pnpm auth:reset
```

### Authenticated crawl

# First time only – headful login, cookies saved
pnpm crawl $LOGIN_URL --headful

# Subsequent crawls reuse auth.json automatically
pnpm crawl https://dashboard.razorpay.com --headful

### Sharded Crawling

For very large websites, you can parallelize the crawling process across multiple machines or containers using Playwright's sharding feature. The `--shard` flag allows you to split the list of URLs to crawl into a number of shards and run only a specific one.

For example, to split the crawl into 5 shards and run the first one (index 0):
```bash
pnpm crawl --shard=1/5
```
You would then run commands for `2/5`, `3/5`, etc. on different machines.

This is useful for ensuring that visual changes are intentional and for catching regressions in the UI.