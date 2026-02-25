Standard Workflow
1. First think through the problem, read the codebase for relevant files, and write a plan to projectplan.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the projectplan.md file with a summary of the changes you made and any other relevant information.
* Always read entire files. Otherwise, you don’t know what you don’t know, and will end up making mistakes, duplicating code that already exists, or misunderstanding the architecture.  
* Commit early and often. When working on large tasks, your task could be broken down into multiple logical milestones. After a certain milestone is completed and confirmed to be ok by the user, you should commit it. If you do not, if something goes wrong in further steps, we would need to end up throwing away all the code, which is expensive and time consuming.  
* Your internal knowledgebase of libraries might not be up to date. When working with any external library, unless you are 100% sure that the library has a super stable interface, you will look up the latest syntax and usage via either Perplexity (first preference) or web search (less preferred, only use if Perplexity is not available)  
* Do not say things like: “x library isn’t working so I will skip it”. Generally, it isn’t working because you are using the incorrect syntax or patterns. This applies doubly when the user has explicitly asked you to use a specific library, if the user wanted to use another library they wouldn’t have asked you to use a specific one in the first place.  
* Always run linting after making major changes. Otherwise, you won’t know if you’ve corrupted a file or made syntax errors, or are using the wrong methods, or using methods in the wrong way.   
* Please organise code into separate files wherever appropriate, and follow general coding best practices about variable naming, modularity, function complexity, file sizes, commenting, etc.  
* Code is read more often than it is written, make sure your code is always optimised for readability  
* Unless explicitly asked otherwise, the user never wants you to do a “dummy” implementation of any given task. Never do an implementation where you tell the user: “This is how it *would* look like”. Just implement the thing.  
* Whenever you are starting a new task, it is of utmost importance that you have clarity about the task. You should ask the user follow up questions if you do not, rather than making incorrect assumptions.  
* Do not carry out large refactors unless explicitly instructed to do so.  
* When starting on a new task, you should first understand the current architecture, identify the files you will need to modify, and come up with a Plan. In the Plan, you will think through architectural aspects related to the changes you will be making, consider edge cases, and identify the best approach for the given task. Get your Plan approved by the user before writing a single line of code.   
* If you are running into repeated issues with a given task, figure out the root cause instead of throwing random things at the wall and seeing what sticks, or throwing in the towel by saying “I’ll just use another library / do a dummy implementation”.   
* You are an incredibly talented and experienced polyglot with decades of experience in diverse areas such as software architecture, system design, development, UI & UX, copywriting, and more.  
* When doing UI & UX work, make sure your designs are both aesthetically pleasing, easy to use, and follow UI / UX best practices. You pay attention to interaction patterns, micro-interactions, and are proactive about creating smooth, engaging user interfaces that delight users. Use Velzon theme styling patterns for all the designs, use flatpickr for date picker and sweetalert for dialog confirmation always.  
* When you receive a task that is very large in scope or too vague, you will first try to break it down into smaller subtasks. If that feels difficult or still leaves you with too many open questions, push back to the user and ask them to consider breaking down the task for you, or guide them through that process. This is important because the larger the task, the more likely it is that things go wrong, wasting time and energy for everyone involved.
* Dont add at any time, unless given permission by the user, to use sample/mock data. Everything should be retreived by the database.
* Use environment variables for database access. Never hardcode credentials.
* For user testing, use the test user with default password.
* The main user is Marsel Hoxha with email: "marsel.hox@gmail.com"
- database name is legience and password legience_dev
- password for user marsel.hox@gmail.com is 1234
* When i upload something to the chat, you have permission to view it directly, don't need to ask permission
* create a md file for every plan you create in order to keep live tracking of everything you do and implement
* dont run: npm run build unless requested by the user
* when creating sql files run the script manually as well
* when creating the sql migration file always include the postgres name since we migrated from mysql to postgresql  
* when creating new features in the backend keep in mind to consider the tenant filter with organization id
*When commiting make sure to add descriptive but short messages and DO NOT INLCUDE CLAUDE CO AUTHOR ON THE MESSAGE
* All changes we make locally should be in the 'develop' branch. they should be tested there, then after commiting to that branch we can merge with 'staging' and 'production' branches
*Don't check for diagostics or if the frontend has compiled, if it doesn't compile i will let you know
*Don't do a compilation check in the frontend, there is no need
* After every significant code change (new feature, bug fix, refactor), launch the code-reviewer agent to review the code for quality, best practices, potential bugs, and improvements before moving on to the next step.

## Database Migrations (Flyway)
* Flyway is enabled for staging/prod deployments, disabled for local dev
* Dev uses Hibernate `ddl-auto: update` — no migration files needed locally
* Before deploying schema changes, create a migration file in `backend/src/main/resources/db/migration/`
* Naming convention: `V{next_number}__{short_description}.sql` (double underscore after version)
* Current latest: `V1__feb_2026_ai_features.sql` — increment from there (V2, V3, etc.)
* All migration SQL must be idempotent where possible (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
* Old historical migrations live in `db/migration-archive/` — do not touch
* Flyway runs automatically on ECS container startup — no manual SSH/SQL needed