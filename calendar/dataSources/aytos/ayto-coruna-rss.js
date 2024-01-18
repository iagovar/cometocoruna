/* const Parser = require('rss-parser'); */
const { parse } = require('rss-to-json');
const { EventItem } = require('../../eventClass.js');
const DatabaseConnection = require('../../databaseClass.js');
const dateFns = require('date-fns');

const cheerio = require('cheerio');
const axios = require('axios');


/**
 * Parses an AytoCorunaFeed from a given URL.
 *
 * @param {string} url - The URL of the feed to parse.
 * @return {Array} An array of objects representing the parsed feed items.
 */
async function parseAytoCorunaFeed(url, debug = false) {
    // Trying to download the feed
    let feed = null;
    try {
        /* const parser = new Parser({
          defaultRSS: 2.0
        });
        feed = await parser.parseURL(url); */
        feed = await parse(url);
    } catch (error) {
        console.error(`\n\nError parsing feed. Returning and empty array. \n${error}`);
        return [];
    }

    // iterating through the feed items
    let listOfEvents = [];

    for (let singleEvent of feed.items) {
      let item = {source: "aytoCoruna"};

      // Going after the title and link
      try {
          item.title = singleEvent.title;
          item.link = singleEvent.link;
      } catch (error) {
          console.error(`\n\nSkipping: Failed locating title and link in aytoCoruna item:\n${error}`);
          continue;
      }

      if (debug == false) {
        // If the item has been in the database for less than 5 days, skip it
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

      // Getting the link HTML as we need it to parse dates, that arse not provided
      // in the RSS feed
      const response = await axios.get(item.link);
      const eventPage = cheerio.load(response.data);

      // Going after the initDate
      try {
          item.initDate = eventPage('meta[property="startDate"]').attr('content');
      } catch (error) {
          console.error(`\n\nSkipping and closing tab: Failed locating start date in ${item.link}:\n${error}`);
          await eventPage.close();
          continue;
      }

      // Going after the endDate
      try {
          item.endDate = eventPage('meta[property="endDate"]').attr('content');
      } catch (error) {
          console.error(`\n\nFailed locating end date in ${item.link}, setting initDate as endDate:\n${error}`);
          item.endDate = item.initDate; 
      }

      // Extracting image url from the feed xml
      try {
          item.image = singleEvent.media.thumbnail["media:thumbnail"].url
      } catch (error) {
          console.error(`\n\nFailed to obtain image in ${item.link}, setting a default one:\n${error}`);
          item.image = "https://i.imgur.com/2rzELfg.jpg"; // Logo aytocoruna
      }

      // Going after the content
      try {
        item.description = singleEvent.description;
      } catch (error) {
        console.error(`\n\nFailed to obtain description in ${item.link}, setting description to '':\n${error}`);
        item.description = "";
      }

      // Going after the price
      try {
        item.price = eventPage('div.preciosuceso[property="offers"] p').text();
      } catch (error) {
        console.error(`\n\nFailed to obtain price in ${item.link}, setting it to 'Free or unavailable':\n${error}`);
        item.price = "Free or unavailable";
      }

      // Going after the location
      try {
        item.location = eventPage('.direccion [property="name"]').text();
      } catch (error) {
        item.location = "";
      }

      // Getting the text & HTML content of the whole page
      const copyOfEventPage = cheerio.load(eventPage.html());
      copyOfEventPage('script').remove();

      try {
        item.textContent = copyOfEventPage('#contenido').text();
        item.htmlContent = eventPage('body').html();
      } catch (error) {
        item.textContent = "";
        item.htmlContent = "";
      }

      // if nothing failed create an event instance and push it to the list of events
      // The EventItem constructor should handle all sanity checks and conversions
      const tempItem = new EventItem(
        {
          title : item.title,
          link : item.link,
          price : item.price,
          description : item.description,
          image : item.image,
          source : item.source,
          initDate : item.initDate,
          endDate : item.endDate,
          location : item.location,
          textContent : item.textContent,
          htmlContent : item.htmlContent
        }
      );

      listOfEvents.push(tempItem);

    }

    return listOfEvents;
}

/*
const aytoURL = "https://www.coruna.gal/web/es/rss/ociocultura";
const aytoEventsPromise = parseAytoCorunaFeed(aytoURL, true);
*/

// Exportamos el módulo
module.exports = parseAytoCorunaFeed;