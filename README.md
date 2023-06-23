Project structure:

- [PicoCMS](https://picocms.org/) for managing content. Very low complexity PHP CMS that runs fast in my already purchased shared hosting. Reads Markdown and HTML, so no database. No automatic updates, no backoffice, etc. Very low surface of attack --> Peace of mind.

- Custom NodeJS calendar code, which retrieves info from APIs and/or scraping, stores in DuckDB for further analysis and deploys a simple HTML file into the CMS assets folder via simple FTP connection.
