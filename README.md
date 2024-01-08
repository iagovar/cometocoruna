Project structure:

- Custom NodeJS calendar code, which retrieves info from RSS, APIs and/or scraping (With Axios, Cheerio and Puppeteer), stores in ~~DuckDB~~ SQLite for further analysis. Deploys a simple HTML file into the CMS assets folder via simple FTP connection.

	Be aware: [DuckDB does not work in Musl systems](https://github.com/duckdb/duckdb/issues/7002), like Alpine Linux.

	- Switched from DuckDB to SQLite as the former still requires some work to use with DBveaber and other tools. DuckDB can work with SQLite as an OLAP layer on top, if I want that capability in the future.

- [PicoCMS](https://picocms.org/) for managing content. Very low complexity PHP CMS that runs fast in my already purchased shared hosting. Reads Markdown and HTML, so no database. No automatic updates, no backoffice, etc. Very low surface of attack --> Peace of mind.


## How to install and run the script

- Asumes you're using Debian 12+. Get your version with `cat /etc/os-release`.

- Assumes you have Git 2.38+, NodeJS 18.14+ and npm 9+ installed (check with `packageName --version` or install with `apt install packageName`).

- Assumes you have Chromium installed.

1. Create a directory `cometocoruna` with `mkdir ./cometocoruna` -> `cd cometocoruna`.

2. Clone the repo with `git clone https://github.com/iagovar/cometocoruna.git ./`.

3. Go to the calendar directory with `cd ./calendar`

4. Install all dependencies with `npm install`.

5. You'll need to configure the `authentication.config.json` file. An example is provided as `authentication.config.json.template` as I can't upload my credentials to a public repo for obvious reasons.

6. Try running it with `npm start`. There should be no errors in the first run (it may be in subsequent errors because the Database won't allow duplicate primary keys, but the script will continue doing its task).

7. Time to make it execute periodically with CRON. 

	1. Type `crontab -e` to open the crontab editor (likely in vi).

	2. Enter the vi editor mode pressing `i`.

	3. Paste this lines to run the script every day on 6AM:

	````
	# Run the cometocoruna.com calendar every day on 6AM
	0 6 * * * cd ~/cometocoruna/calendar/ && npm start >> debug.log 2>&1

	````

	4. Exit the vi editor mode with `esc` and write changes with `:wq`.

	5. If you write in the console `crontab -l` it should list your crontab with the changes you just introduced.


	- Here's a good resource for understaing CRONTAB: [Link](https://linuxhandbook.com/crontab/).

	- There's also a very useful [Crontab generator](https://crontab-generator.org/).

8. Any update in the script will require a `git pull` in `~/cometocoruna` to bring it to local.

## How to run the website

It should run in pretty much any standard php shared hosting, really. I'm actually running it in a low-budget one, so, in general, just upload by FTP, as PicoCMS requires no installation.