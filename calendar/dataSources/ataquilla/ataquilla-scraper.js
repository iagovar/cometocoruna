const puppeteer = require('puppeteer');
const { EventItem } = require('../../eventClass.js');
const DatabaseConnection = require('../../databaseClass.js');
const dateFns = require('date-fns');
var Xvfb = require('xvfb');

/**
 * Parses the Ataquilla DOM to scrape events and returns a list of event items.
 *
 * @param {string} entryPoint - The entry point URL for scraping events.
 * @param {number} maxPages - The maximum number of pages to scrape.
 * @param {string} uniqueProjectUUIDNamespace - The namespace for generating unique UUIDs.
 * @return {Promise<Array>} A Promise that resolves to an array of event items.
 */
async function parseAtaquillaDOM(entryPoint, maxPages, debug = false) {
  
  // Using a virtual display for non-headless browser
  const virtualDisplay = new Xvfb();
  virtualDisplay.startSync();
  
  // Opening puppeteer and applying configurations
  const browser = await puppeteer.launch({
      headless: false
  })

  const wrapperPage = await browser.newPage();

  // Additional browser configuration
  await wrapperPage.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.150 Safari/537.36'
    );
    await wrapperPage.setJavaScriptEnabled(true);
    await wrapperPage.setViewport({
      width: 1280,
      height: 1024,
      deviceScaleFactor: 1
    });
  
  // Go to the entry point URL
  const pageUrl = `${entryPoint}`;
  await wrapperPage.goto(pageUrl);

  // make the script wait for a random number of seconds between 3 and 5
  await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000));


  // Selecting all wrapper elements
  let listOfEvents = [];
  let wrapperOfEvents = null;
  try {
      wrapperOfEvents = await wrapperPage.$$('.wrapper');
  } catch (error) {
      console.error(`\n\nCouldn't locate wrapper of events in ${entryPoint}\nClosing browser and returining an empty array`);
      await browser.close();
      return [];
  }

  /*
  * Going after single events
  * 
  * All events should have title, link, initDate
  */
  for (const singleEvent of wrapperOfEvents) {
      // Declaring Item and EventPage before try/catch so it's available in both
      // blocks
      let item = {source: "ataquilla"};
      let eventPage;
      
      // Extracting title and link from a wrapper card
      try {
          item.title =  await singleEvent.$eval('a[itemprop="url"]', (a) => a.innerText.trim());
          item.link = await singleEvent.$eval('a[itemprop="url"]', (a) => a.href);            
      } catch (error) {
          console.error(`\n\nCouldn't retrieve title and link from a ${item.source} wrapper. Jumping to next event.\n${error}`);
          continue;
      }

      // If the item has been in the database for less than 5 days, skip it
      if (debug == false) {        
        const myDatabase = new DatabaseConnection();
        const dateInDB = await myDatabase.checkLinkInDB(item.link);
        const today = new Date();
        if (dateInDB != null) {
          const howManyDays = dateFns.differenceInDays(today, dateInDB);
          if (howManyDays < 5) {
            console.log(`\nItem link already in DB for less than 5 days, skipping:\n${item.link}`);
            continue;
          }
        }
      }
      

      // Navigating to item.link, where we'll get the rest of the event info
      try {
          eventPage = await browser.newPage();
          await eventPage.setJavaScriptEnabled(true);
          await eventPage.setViewport({
            width: 1280,
            height: 1024,
            deviceScaleFactor: 1
          });
          await eventPage.goto(item.link);
          await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (10000 - 12000 + 1)) + 10000));
      } catch (error) {
          console.error(`\n\nError opening a tab in ${item.source}, skipping event ${item.link} \n${error}`);
          continue;
      }

      // Going after initDate
      try {
          tempInitDate = await singleEvent.$eval('span[itemprop="startDate"]', (span) => span.getAttribute('datetime'));
          item.initDate = new Date(tempInitDate);
      } catch (error) {
          // If datetime is not found in wrapper, extract it from eventPage
          console.error(`\n\nstartdate datetime attribute not found in ${item.link}, trying to extract it from eventPage:\n${error}`);
          try {
                tempInitDate = await eventPage.$eval('span[itemprop="startDate"]', (span) => span.getAttribute('datetime'));
                item.initDate = new Date(tempInitDate);         
          } catch (error) {
                console.error(`\n\nSkipping and closing tab: Failed locating time datetime in ${item.link} eventPage:\n${error}`);
                await eventPage.close();
                continue;
          }
      }

      // Going after endDate
      try {
          tempEndDate = await singleEvent.$eval('span[itemprop="endDate"]', (span) => span.getAttribute('datetime'));
          item.endDate = new Date(tempEndDate);
      } catch (error) {
          // if datetime is not found in wrapper, extract it from eventPage
          console.error(`\n\nendDate datetime attribute not found in ${item.link}, trying to extract it from eventPage:\n${error}`);
          try {
                tempEndDate = await eventPage.$eval('span[itemprop="endDate"]', (span) => span.getAttribute('datetime'));
                item.endDate = new Date(tempEndDate);            
          } catch (error) {
                console.error(`\n\nFailed locating endDate in ${item.link} eventPage, setting initDate as endDate:\n${error}`);
                item.endDate = item.initDate;
          }
      }

      // Extracting image url from singleEvent
      try {
          item.image = await singleEvent.$eval('img[itemprop="image"]', (img) => img.src);
      } catch (error) {
          console.error(`\n\nFailed to obtain image in ${item.link}, setting a default one:\n${error}`);
          item.image = "https://i.imgur.com/lcplSGi.png"; // Logo ataquilla
      }

      // Going after the description
      try {
          item.description = await eventPage.$eval('.event-description', (div) => div.innerText.trim());
      } catch (error) {
          console.error(`\n\nFailed to obtain description in ${item.link}, setting description to '':\n${error}`);
          item.description = "";
          console.log(await eventPage.content());
      }

      // Going after the price
      try {
          item.price = await singleEvent.$eval('strong[itemprop="lowPrice"]', (strong) => strong.innerText.trim());
      } catch (error) {
          console.error(`\n\nFailed to obtain price in ${item.link}, setting it to 'Free or unavailable':\n${error}`);
          item.price = "Free or unavailable";
      }

      // Going after the location
      try {
        item.location = await singleEvent.$eval('.venue', (element) => element.innerText.trim());
      } catch (error) {
        item.location = "";
      }

      // Getting the text & HTML content of the whole page
      try {
        item.textContent = await eventPage.$eval('#event .event-description', (div) => div.innerText);
        item.htmlContent = await eventPage.evaluate(() => document.documentElement.outerHTML);
      } catch (error) {
        item.textContent = "";
        item.htmlContent = "";
      }

      // Closing tab
      console.log(`Closing page: Scraping finished for ${item.link}`);
      await eventPage.close();

      // if nothing failed create an event instance and push it to the list of events
      // The EventItem constructor should handle all sanity checks and conversions
      const tempItem = new EventItem(
        {
          source : item.source,
          title : item.title,
          link : item.link,
          price : item.price,
          description : item.description,
          initDate : item.initDate,
          endDate : item.endDate,
          image : item.image,
          location : item.location,
          textContent : item.textContent,
          htmlContent : item.htmlContent
        }
      );

      listOfEvents.push(tempItem);

    }

    // For loope ended, close the browser & virtual display
    console.log("Closing browser in Ataquilla");
    await browser.close();
    virtualDisplay.stopSync();

    return listOfEvents;
}

/*
const entryPoint = 'https://entradas.ataquilla.com/ventaentradas/es/buscar?orderby=next_session&orderway=asc&search_query=Encuentra+tu+evento&search_city=A+Coru%C3%B1a&search_category=';
const maxPages = 1;

const scrapedItems = parseAtaquillaDOM(entryPoint, maxPages, true);
*/

module.exports = parseAtaquillaDOM;