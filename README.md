Project structure:

- Custom NodeJS calendar code, which retrieves info from RSS, APIs and/or scraping (With Axios, Cheerio and Puppeteer), stores in DuckDB for further analysis. Deploys a simple HTML file into the CMS assets folder via simple FTP connection.

- [PicoCMS](https://picocms.org/) for managing content. Very low complexity PHP CMS that runs fast in my already purchased shared hosting. Reads Markdown and HTML, so no database. No automatic updates, no backoffice, etc. Very low surface of attack --> Peace of mind.


## How to install and run the script

- Asumes you're using Alpine Linux 3.17+. Get your version with `cat /etc/alpine-release`.

- Assumes you have Git 2.38+, NodeJS 18.14+ and npm 9+ installed (check with `packageName --version` ir install with `apk add packageName`).

	Remember Alpine has no Sudoers by default so if you're in a fresh Alpine install you'll need to log in as root.

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
	0 6 * * * npm start ~/cometocoruna/calendar >/dev/null 2>&1

	````

	4. Exit the vi editor mode with `esc` and write changes with `:wq`.

	5. If you write in the console `crontab -l` it should list your crontab with the changes you just introduced.


	- Here's a good resource for understaing CRONTAB: [Link](https://linuxhandbook.com/crontab/).

	- There's also a very useful [Crontab generator](https://crontab-generator.org/).

8. Any update in the script will require a `git pull` in `~/cometocoruna` to bring it to local.