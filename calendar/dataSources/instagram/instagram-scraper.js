const { AbstractDomScraper } = require('../../scraperClass.js');
const { EventItem } = require('../../eventClass.js');
const { ApifyClient } = require('apify-client');
const puppeteer = require('puppeteer');
const { convert } = require('html-to-text');
const dateFns = require('date-fns');

const ocr = require('../../ocrClass.js');
const gpt = require('../../gptClass.js');
const DatabaseConnection = require('../../databaseClass.js');

async function parseInstagramDom(arrayOfAccounts, authConfigObj) {
    // Loading class
    let Instagram = new AbstractDomScraper(
        null, // we'll get ulrs from an external array and loop through them
        0, // no max pages required
        authConfigObj, // No auth config required
        'puppeteer' // library we'll use
    )

    // Launch browser
    const browser = await Instagram.launchBrowser(false);

    // Login into instagram
    const loginURL = 'https://www.instagram.com/accounts/login/';
    const userInputSelector = 'input[name="username"]';
    const passwordInputSelector = 'input[name="password"]';
    const submitSelector = 'button[type="submit"]';
    const selectorsObj = {
        user: userInputSelector,
        password: passwordInputSelector,
        submit: submitSelector
    }


    
    const acceptCookies = async function(loginPage, position) {
        if (position == 'before') {
        // The .click method focuses in the first element that matches the selector
            await loginPage.click('button[tabindex="0"]');
            await AbstractDomScraper.waitSomeSeconds(2,5);
        }
        if (position == 'after') {
            await AbstractDomScraper.waitSomeSeconds(10,15);
        }

    };

    const login = await Instagram.login(loginURL, selectorsObj, 5, acceptCookies);

    

    // Instagram has a public JSON endpoint adding /?__a=1&__d=dis to every
    // instagram URL which allows to get imgs and text from posts

    let instagramPostsContainer = [];

    for (const instagramUser of arrayOfAccounts) {
        const jsonEndpointURL = "?__a=1&__d=dis"
        const userWrapperPage = await Instagram.getWrapperPage(`${instagramUser}${jsonEndpointURL}`);

        // Evaluate page and get the JSON content
        const scriptContent = await userWrapperPage.evaluate(
            () => {return JSON.parse(document.body.textContent)}
        );

        // Get relevant info from posts
        const postSourceUserName = scriptContent.graphql.user.username;
        const postArray = scriptContent.graphql.user.edge_owner_to_timeline_media.edges;

        // Loop through posts
        for (const thisPost of postArray) {
            const postImg = thisPost.node.display_url;
            const postURL = `https://www.instagram.com/p/${thisPost.node.shortcode}`;
            const postText = thisPost.node.edge_media_to_caption.edges[0].node.text
            
            instagramPostsContainer.push({
                username: postSourceUserName,
                displayUrl: postImg,
                url: postURL,
                caption: postText
            })
        }

        AbstractDomScraper.waitSomeSeconds(2,5);
        userWrapperPage.close();
    }

    // Transform instagramp post image to text
    // No need to return as it passes by reference
    await performOCR(instagramPostsContainer);

    // Transforming text+img into a properly structured event
    let finalArray = await getEventStructure(instagramPostsContainer);

    


    return finalArray;

}


/**
 * Parses Instagram data using Apify API.
 *
 * @param {Array} arrayOfAccounts - An array of Instagram account URLs.
 * @param {Object} authConfigObj - An object containing authentication configuration. It should contain an `apify` property with an `token` property.
 * @param {boolean} [force=false] - Flag indicating whether to force the function execution even if it's not Wednesday.
 * @return {Array} An array of parsed Instagram data.
 */
async function parseInstagramApify(arrayOfAccounts, authConfigObj, force = false) {
    // Only run every wednesday (unless forced)
    const today = new Date();
    const isDefinedDay = dateFns.isWednesday(today);
    if (!force) {
        if (!isDefinedDay) {
            return [];
        };
    }


    try {
        // Initialize the ApifyClient with API token
        const client = new ApifyClient({
            token: authConfigObj.apify.token,
        });

        // Prepare Actor input
        const input = {
            "username": [],
            "resultsLimit": 5
        };

        for (const accountURL of arrayOfAccounts) {
            input.username.push(accountURL);
        }

        // Run the Actor and wait for it to finish
        const run = await client.actor("apify/instagram-post-scraper").call(input)

        // Fetch actor results
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        // Check if the item is already in the database (by URL & date), and remove from items if it is
        // This saves money from the OCR and GPT APIs
        if (force == false) {
            const myDatabase = new DatabaseConnection();
            for (let index = 0; index < items.length; index++) {
                const dateInDB = await myDatabase.checkLinkInDB(items[index].url);
                if (dateInDB !== null) {
                    items.splice(index, 1);
                    console.log(`\n\nInstagram post already in DB, removing before sending to OCR+GPT: ${items[index].url}\n\n`);
                }
            }
        }

        // Transform instagram post image to text
        // Array passes by reference so no need to return
        await performOCR(items, authConfigObj);

        // Transforming text+img into a properly structured event list
        let finalArray = await getEventStructure(items, authConfigObj);

        return finalArray;
    } catch (error) {
        console.error(`\n\nInstagram scraping failed, returning empty array:\n${error}`);
        return [];
    }
}

async function performOCR(arrayOfPosts, authConfigObj) {
    // Instance of cloud ocr
    const cloudOCR = new ocr.ReadTextFromImage(authConfigObj, "azure");

    // Let's transform images into text through cloud OCR
    for (const post of arrayOfPosts) {
        // Azure free tier is rate limited to 2 calls per second and 20 per minute, so we need to wait a bit
        await AbstractDomScraper.waitSomeSeconds(4,4);
        post.ocr = await cloudOCR.getTextFromURL(post.displayUrl);
    }

    return arrayOfPosts;
}

async function getEventStructure(arrayOfPosts, authConfigObj) {

    // Creating LLM instance
    const llm = new gpt.RetrieveFromLLM(authConfigObj);

    // Creating empty array of events for later use
    let arrayOfLLmResults = [];
    let arrayOfEventObjects = [];

    // Send every post to LLM and retrieve the list of events
    for (const post of arrayOfPosts) {
        // Creating prompt for LLM ingesting
        post.llmInput = `
        Timestamp of the instagram post: <instagram-timestamp>${post.timestamp}</instagram-timestamp>
        
        Caption of the instagram post: <instagram-post>${post.caption}</instagram-post>
        
        Hashtags of the instagram post: <instagram-hashtags>${JSON.stringify(post.hashtags)}</instagram-hashtags>
        
        OCR performed to the instagram image: <instagram-ocr>${post.ocr}</instagram-ocr>`;

        // Sending post to LLM and get an array of events
        let tempArray;
        try {
            tempArray = await llm.getEventsList(post.llmInput); 
        } catch (error) {
            console.error(`\n\nError getting events from LLM:\n${error.message}`);
            continue;
        }

        // Adding necessary properties from posts to the events in the array
        // Check apify/instagram-post-scraper
        for (const event of tempArray) {
            event.url = post.url;
            event.username = post.ownerUsername;
            event.img = post.displayUrl;
        }

        arrayOfLLmResults.push(...tempArray);
    }

    // Create array of event objects
    for (const thisEvent of arrayOfLLmResults) {
        try {
            let tempEvent = new EventItem(
                {
                    title: thisEvent.title,
                    link: thisEvent.url,
                    price: thisEvent.price,
                    description: thisEvent.description,
                    image: thisEvent.img,
                    source: thisEvent.username,
                    initDate: new Date(thisEvent.initDate),
                    endDate: new Date(thisEvent.endDate),
                    location: thisEvent.location,
                    categories: thisEvent.categories
                }
            );
    
            arrayOfEventObjects.push(tempEvent);
        } catch (error) {
            console.error(`\n\nError creating event object from LLM results:\n${error}`);
            continue;
        }
    }

    return arrayOfEventObjects;
}

/*
const arrayOfAccounts = [
    "https://www.instagram.com/ateneobarcultural/",
    "https://www.instagram.com/acefala.colectivo/",
    "https://www.instagram.com/galeriagreleria/"
];
const fs = require('fs');
const authConfigObj = require(`${__dirname}/../../config/authentication.config.json`);
//const scrapedItems = parseInstagramDom(arrayOfAccounts, authConfig.instagram);
const scrapedItems2 = parseInstagramApify(arrayOfAccounts, authConfigObj, true);
*/

module.exports = {
    parseInstagramDom,
    parseInstagramApify
}