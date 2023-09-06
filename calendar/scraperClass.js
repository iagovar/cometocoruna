const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const dateFns = require('date-fns');
const { convert } = require('html-to-text');

// Local imports
const DatabaseConnection = require('./databaseClass.js');


class AbstractDomScraper {
    constructor(entryPoint, maxPages, authConfig, library = 'puppeteer') {
    this.entryPoint = entryPoint;
    this.maxPages = maxPages;
    this.authConfig = authConfig;


    this.library = library;
    this.browser = null;
    this.wrapperPage = null;
    this.loginPage = null;

    this.eventPage = null;
    this.eventData = null;

    this.wrapperOfEvents = null;
    this.listOfEvents = [];


    }


    /**
     * Generates a random number of seconds between the minimum and maximum values,
     * and waits for that amount of time before resolving the promise.
     *
     * @param {number} [minSeconds=5] - The minimum number of seconds to wait.
     * @param {number} [maxSeconds=10] - The maximum number of seconds to wait.
     * @return {Promise} A promise that resolves after waiting for the random number of seconds.
     */
    static waitSomeSeconds(minSeconds = 5, maxSeconds = 10) {
        const randomSeconds = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
        return new Promise(resolve => setTimeout(resolve, randomSeconds * 1000));
    }

    /**
     * Launches a browser instance.
     *
     * @param {boolean} headless - Indicates whether the browser should run in headless mode. Default is true.
     * @return {Promise<Object>} - A promise that resolves to the browser instance.
     */
    async launchBrowser(headless = true) {
        // Starting Pupetteer
        this.browser = await puppeteer.launch({
            headless: headless // headless: 'new' in the future, watch puppeteer docs
        })

        // Return, in case we want to apply something else to browser
        return this.browser;
    }

    /**
     * Logs in the user by navigating to the login URL, entering the provided credentials,
     * and returning the login page.
     *
     * @param {string} loginUrl - The URL of the login page.
     * @param {object} userPassInputSelectorsObj - An object containing the selectors for the username and password inputs. It will look for .user, .password and .submit objects.
     * @param {number} [secondsToWait=5] - The number of seconds to wait before performing the login. Defaults to 5 seconds.
     * @param {Function} [callback=undefined] - Optional callback async function. Could be accepting coockies, for example. Will get this.loginPage and 'before'||'after' as parameters, indicating if it's called before or after login.
     * @return {Promise<Page>} - A Promise that resolves to the login page.
     */
    async login(
        loginUrl,
        userPassSelectorsObj,
        secondsToWait = 5,
        callback = undefined // Empty callback as default
        ) {
        if (this.library == 'puppeteer') {
            // Loading a new tab and going to url
            this.loginPage = await this.browser.newPage();
            await this.loginPage.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'
            );
            await this.loginPage.setJavaScriptEnabled(true);
            await this.loginPage.setViewport({width: 1920, height: 1080});
            await this.loginPage.goto(loginUrl);

            // Wait a random number of seconds based on secondsToWait seed
            if (secondsToWait !== 0) {  
                await AbstractDomScraper.waitSomeSeconds(secondsToWait-1, secondsToWait+1);
            }

            // performing optional callback
            if (typeof callback === 'function') {
                await callback(this.loginPage, 'before');
            }

            // Performing user & pass input and submit
            await this.loginPage.click(userPassSelectorsObj.user);
            await this.loginPage.type(userPassSelectorsObj.user, this.authConfig.user);
            await this.loginPage.click(userPassSelectorsObj.password);
            await this.loginPage.type(userPassSelectorsObj.password, this.authConfig.password);
            await this.loginPage.click(userPassSelectorsObj.submit);

            // performing optional callback
            if (typeof callback === 'function') {
                await callback(this.loginPage, 'after');
            }

            // Return, in case we want to apply something else to loginPage
            return this.loginPage;
        }

        if (this.library == 'axios') {
            throw new Error(`You can't log in with axios, use puppeteer instead: ${loginUrl}`);
        }
        
    }

    /**
     * Retrieves the wrapper page for scraping.
     *
     * @param {string} [wrapperUrl=this.entryPoint] - The URL of the wrapper page. Defaults to the entry point URL.
     * @param {number} [secondsToWait=5] - The number of seconds to wait before proceeding. Defaults to 5.
     * @returns {Promise<Page|CheerioStatic>} - The wrapper page object for scraping.
     */
    async getWrapperPage(wrapperUrl = this.entryPoint, secondsToWait = 5) {
        if (this.library == 'puppeteer') {
            this.wrapperPage = await this.browser.newPage();
            await this.wrapperPage.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'
            );
            await this.wrapperPage.setJavaScriptEnabled(true);
            await this.wrapperPage.setViewport({width: 1080, height: 1024});
            await this.wrapperPage.goto(wrapperUrl);

            // Wait a random number of seconds based on secondsToWait seed
            if (secondsToWait !== 0) {  
                await AbstractDomScraper.waitSomeSeconds(secondsToWait-1, secondsToWait+1);
            }

            // Return, in case we want to apply something else to wrapperPage
            return this.wrapperPage;
        }

        if (this.library == 'axios') {
            const response = await axios.get(wrapperUrl);
            this.wrapperPage = cheerio.load(response.data);

            // Return, in case we want to apply something else to wrapperPage
            return this.wrapperPage;
        }
    }

    /**
     * Locates & parses all event wrappers in the entrypoint url.
     *
     * @param {Page} [wrapperPage=this.wrapperPage] - The wrapper page to parse the data from.
     * @param {string} wrapperSelector - The selector used to locate the event wrappers.
     * @return {Promise<Array<ElementHandle>>} - The parsed wrapper data as an array of ElementHandles.
     */
    async parseWrapperData (wrapperPage = this.wrapperPage, wrapperSelector) {
        if (this.library == 'puppeteer') {
            // Locating all event wrappers in the entrypoint url
            try {
                this.wrapperOfEvents = await wrapperPage.$$(wrapperSelector);
            } catch (error) {
                console.error(`\n\nCouldn't locate wrapper of events in ${this.entryPoint}\nClosing browser and returining an empty array:\n${error}`);
                await browser.close();
                return [];
            }
            
            // Return, in case we want to apply something else to wrapperOfEvents
            return this.wrapperOfEvents;
        }

        if (this.library == 'axios') {
            try {
                const getHTML = cheerio.load(wrapperPage);
                const getAllElementsOnSelector = getHTML(wrapperSelector);
                this.wrapperOfEvents = getAllElementsOnSelector;
            
                // Return, in case we want to apply something else to wrapperOfEvents
                return this.wrapperOfEvents;
            } catch (error) {
                console.error(`\n\nCouldn't locate wrapper of events in ${this.entryPoint}\nCheerio returining an empty array:\n${error}`);
                return [];                
            }
        }
    }

    
    async getEventPage(eventLink, secondsToWait = 5) {
        if (this.library == 'puppeteer') {
            try {
                this.eventPage = await this.browser.newPage();
                await this.eventPage.goto(eventLink);
                // Wait a random number of seconds based on secondsToWait seed
                if (secondsToWait !== 0) {  
                    await AbstractDomScraper.waitSomeSeconds(secondsToWait-1, secondsToWait+1);
                }
            } catch (error) {
                console.error(`\n\nSkipping event: Error retrieving ${eventLink} \n${error}`);
                return error;
            }
        }

        if (this.library == 'axios') {
            try {
                const response = await axios.get(eventLink);
                this.eventPage = cheerio.load(response.data);
            } catch (error) {
                console.error(`\n\nSkipping event: Error retrieving ${eventLink} \n${error}`);
                return error;
            }
        }

        return this.eventPage;
    }

    /**
     * Retrieves event script data from the specified event page.
     *
     * @param {object} eventPage - The event page from which to retrieve the script data. Defaults to the value of `this.eventPage`.
     * @param {string} cssSelector - The CSS selector used to select the script elements. Defaults to `'script[type="application/ld+json"]'`.
     * @param {string} lookingForKey - The key to look for in the JSON content of the script elements. Defaults to `'@type'`.
     * @param {string} lookingForValue - The value to look for in the JSON content of the script elements. Defaults to `'Event'`.
     * @returns {object} - The event data retrieved from the script elements.
     */
    async getEventScriptData(
        eventPage = this.eventPage,
        cssSelector = 'script[type="application/ld+json"]',
        lookingForKey = '@type',
        lookingForValue = 'Event'
        ) {
        if (this.library == 'puppeteer') {
            try {
                // Selecting and storing all scripts
                const collectionOfScripts = await eventPage.$$eval(cssSelector, elements => elements.map(element => element.textContent));

                // Iterating over all scripts looking for @type: '*event*' or '*Event'
                for (const singleScript of collectionOfScripts) {
                    const jsonContent = JSON.parse(singleScript);
                    const type = jsonContent[lookingForKey];

                    //  This line checks if the variable type is truthy
                    //  (not null, undefined, empty string, or false) and if
                    //  its lowercase version contains the word "event".
                    if (type && type.toLowerCase().includes(lookingForValue)) {
                        this.eventData = jsonContent;
                    }
                }

                return this.eventData;
 
            } catch (error) {
                console.error(`\n\nSkipping event: Error retrieving ${eventLink} \n${error}`);
                return error;
            }
        }

        if (this.library == 'axios') {
            try {
                const scriptElements = cheerio(eventPage)(cssSelector);

                // Iterating over all scripts looking for @type: '*event*' or '*Event'
                for (const scriptElement of scriptElements) {
                    const singleScript = cheerio(scriptElement).html()
                    const jsonContent = JSON.parse(singleScript);
                    const type = jsonContent[lookingForKey];

                    //  This line checks if the variable type is truthy
                    //  (not null, undefined, empty string, or false) and if
                    //  its lowercase version contains the word "event".
                    if (type && type.toLowerCase().includes(lookingForValue)) {
                        this.eventData = jsonContent;
                    }
                }

                return this.eventData;

            } catch (error) {
                console.error(`\n\nSkipping event: Error retrieving ${eventLink} \n${error}`);
                return error;
            }
        }
    }

    async parseEventDom(wrapperOfEvents = this.wrapperOfEvents, source) {
    }

    async parseEventJson(wrapperOfEvents = this.wrapperOfEvents, source) {
        
    }

    async shouldSkipItem(itemLink, daysinDB) {
        const myDatabase = new DatabaseConnection();
        const dateInDB = await myDatabase.checkLinkInDB(itemLink);
        const today = new Date();
        if (dateInDB != null) {
          const howManyDays = dateFns.differenceInDays(today, dateInDB);
          if (howManyDays < daysinDB) {
            console.log(`\nItem link already in DB for less than ${daysinDB} days, skipping:\n${itemLink}`);
            return true; // Skip the item
          }
        }
        return false; // Don't skip the item
    }
      

}

module.exports = {
    AbstractDomScraper
};
