## Code Style
- Write concise, technical documentation. Avoid fluff. Use Markdown. Use bullet points. Use headings. Use tables. Use code with accurate examples.
- Use functional and declarative programming patterns; avoid imperative code.
- Use CamelCase for variable and function names.
- Use snake_case for class names.
- Use snake_case for file names.
- Use snake_case for database table names.
- Use snake_case for database column names.
- Maintain clear and concise workflow in WORKFLOW.md file.
- Use Git for version control.
- Use npm for dependency management.
- Use bootstrap for CSS.
- Use jQuery for DOM manipulation.
- Use Font Awesome for icons.
- Use AOS for animations.
- Use html jQuery for client-side processing.
- Use JavaScript for dynamic behavior.
- Use CSS for styling.
- Use HTML for structuring content.
- Use Oracle or Azure Sql Database for data storage, ask before creating a new schema.
- Use PHP or cSharp for server-side processing, ask before creating a new component.

## Code Change Log
- create and maintain a changelog.md of what have been done in this session, keep it short and concise.

## Coding workflow preferences
- Focus on the area of code relevant to the task
- Do not touch code that is unrelated to the task
- write thorough unit tests for all major functions
- Avoid making major changes to the patterns and architecture of how a feature works, after it has shown to work well, unless explicitly structured for that purpose
- Always think about what other methods could be used to solve the same problem
- Always think about what other methods and areas might be affected by code change

## Coding pattern preferences
- After making changes, ALWAYS make sure to start up a new server so I can test it.
- Always look for existing code to iterate on instead of creating new code.
- Do not drastically change the patterns before trying to iterate on existing patterns.
- Always kill all existing related servers that may have been created in previous testing before trying to start a new server.
- Always prefer simple solutions
- Avoid duplication of code whenever possible, which means checking for other areas of the codebase that might already have similar code and functionality
- Write code that takes into account the different environments: dev, test, and prod
- You are careful to only make changes that are requested or you are confident are well understood and related to the change being requested
- When fixing an issue or bug, do not introduce a new pattern or technology without first exhausting all options for the existing implementation. And if you finally do this, make sure to remove the old implementation afterwards so we don't have duplicate logic.
- Keep the codebase very clean and organized
- Avoid writing scripts in files if possible, especially if the script is likely only to be run once
- Avoid having files over 200-300 lines of code. Refactor at that point.
- Mocking data is only needed for tests, never mock data for dev or prod
- Never add stubbing or fake data patterns to code that affects the dev or prod environments
- Never overwrite my .env file without first asking and confirming
- Focus on the areas of code relevant to the task
- Do not touch code that is unrelated to the task
- Write thorough tests for all major functionality
- Avoid making major changes to the patterns and architecture of how a feature works, after it has shown to work well, unless explicitly instructed
- Always think about what other methods and areas of code might be affected by code changes

## Project Structure
root/
├─ index.html               # Main application page
├─ login.html               # Login page
├─ logout.html              # Logout page
├─ README.md                # Project documentation
├─ WORKFLOW.md              # Project workflow
├─ CHANGELOG.md             # Project change log
├─ assets/
│  ├─ cfc/                  # ColdFusion Components
│  │  ├─ functions.cfc
│  ├─ php/                  # PHP Components
│  │  ├─ functions.php
│  ├─ css/
│  │  └─ styles.css          # Main CSS file
│  ├─ js/
│  │  └─ app.js             # Main JavaScript file
│  ├─ images/               # Image files
│  ├─ json/                 # JSON files
│  ├─ database/
│  │  └─ schema.sql
│  ├─ fonts/                # Font files
│  │  └─ fontawesome/
│  └─ temp/                 # Temporary upload directory
├─ documents/               # Processed document storage
└─ node_modules/            # NPM dependencies
├─ .windsurfrules           # Windsurf rules

## Tech Stack
- PHP on port 4000 for front-end components and 4001 for backend components
- HTML/JS/CSS for front-end
- AJAX for asynchronous requests to PHP backend components for data processing and storage, never JSON file storage unless explicitly asked to
- Asure SQL Database or Oracle for data storage, ask before creating a new schema
- Sepaeperate database for text, dev and prod
- python tests
- NPM Install Bootstrap, jQuery, Font Awesome, AOS

## Security
- Use HTTPS for secure communication.
- Implement authentication and authorization.
- Use CSRF tokens for protection against cross-site request forgery.
- Use strong password policies.
- Use secure cookie settings.
- Implement secure file upload.
- Implement secure data storage in localstorage.
- Implement secure database interactions.

## Performance
- Optimize code for performance.
- Use lazy loading for images.
- Use responsive design.
- Use AOS for animations.

## Documentation
- Maintain clear and concise documentation for each component.
- Use code comments to explain complex code snippets.
- Document API interactions and data flow.
- Keep manifest.json well documented.
- Document permission requirements.

## Testing
- Use Jest for unit testing.
- Use Cypress for end-to-end testing.
- Use Storybook for component testing.
- Use Lighthouse for performance testing.

## Git Usage
- "fix:" for bug fixes.
- "feat:" for new features.
- "pref:" for performance improvements.
- "chore:" for non-code changes.
- "docs:" for documentation changes.
- "refactor:" for code refactoring.
- "style:" for style changes.
- "test:" for adding or updating tests.

## Commit Rules:
- Use lowercase for comments and message.
- Keep the summary line concise
- Include description for non-obvious changes.
- Referance the issue number when applicable.
