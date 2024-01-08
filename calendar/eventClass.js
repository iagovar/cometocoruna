const crypto = require('crypto');
const { parse, isValid, format, formatISO, parseISO } = require('date-fns');
const { enUS } = require('date-fns/locale');
const { convert } = require('html-to-text');
const axios = require('axios');
const fs = require('fs');
const { distance } = require('fastest-levenshtein');
const compareImages = require('resemblejs/compareImages');
const webp = require('@namesmt/webp-converter');

/**
 * Class representing an Real Life Event.
 * @class
 */
class EventItem {
  /**
 * Constructor function that initializes an instance of the EventItem class.
 *
 * @param {Object} eventObject - The event object containing the necessary data.
 * @param {string} eventObject.title - Required. 
 * @param {string} eventObject.link - Required (it's the primary key)
 * @param {number} eventObject.price - Required.
 * @param {string} eventObject.description - Optional.
 * @param {string} eventObject.image - Optional, but advisable.
 * @param {string} eventObject.source - Required.
 * @param {string} eventObject.initDate - Required.
 * @param {string} eventObject.endDate - Optional.
 * @param {string} eventObject.location - Optional.
 * @param {string} eventObject.categories - Optional.
 * @param {string} eventObject.textContent - Optional.
 * @param {string} eventObject.htmlContent - Optional.
 * @param {string} eventObject.screenshot - Optional.
 */
    constructor(eventObject) {

      // Required data. Throw error if missing.
      // Don't include price, as sometimes it can't be retrieved and comes as undefined
      // In theory scrapers should discard events without this fields
      const requiredFields = ['title', 'link', 'source', 'initDate'];
      for (const field of requiredFields) {
        if (eventObject[field] === undefined) {
          throw new Error(`Missing required ${field} field on instance of EventItem:\n${JSON.stringify(eventObject)}\n\n`);
        }
      }


      this.title = this.sanitizeStringForDuckDB(eventObject.title);
      this.link = eventObject.link;
      this.price = this.setPrice(eventObject.price);
      this.description = this.sanitizeStringForDuckDB(eventObject.description);
      this.image = eventObject.image;
      this.source = eventObject.source;

      this.initDate = eventObject.initDate;
      this.endDate = eventObject.endDate;

      this.initDateISO = this.convertAnyDateToISO(eventObject.initDate);
      this.endDateISO = this.convertAnyDateToISO(eventObject.endDate);
      this.initDateHuman = this.convertISODateToHumanReadable(this.initDateISO);
      this.endDateHuman = this.convertISODateToHumanReadable(this.endDateISO);
      this.scrapedDateISO = formatISO(new Date());
      
      this.location = eventObject.location;
      this.categories = eventObject.categories;
      this.textContent = eventObject.textContent;
      this.htmlContent = eventObject.htmlContent;
      this.screenshot = eventObject.screenshot;

      // All invalid events will be discarded before submitting to DB
      this.isValidEvent = true;
    }

    /**
     * Converts the object to a JSON string representation.
     *
     * @return {string} The JSON string representation of the object.
     */
    toString() {
        return JSON.stringify(this);
    }

    /**
     * Sets the price based on the given input.
     *
     * @param {type} input - the input to set the price
     * @return {type} finalPrice - the final price after processing the input
     */
    setPrice(input) {
      let finalPrice = null;
      let sanitizedPrice = this.sanitizeStringForDuckDB(input);

      switch (sanitizedPrice) {
        case "":
        case "0.00":
        case "0":
        case 0:
        case 0.00:
        case "De balde":
        case "De Balde":
        case "de balde":
        case "Gratis":
        case "gratis":
        case "free":
        case undefined:
            finalPrice = "Free or unavailable";
            break;
    
        default:
            finalPrice = sanitizedPrice;
            break;
      }

      return finalPrice;

    }
    
    /**
     * Converts any given date to ISO format (date-fns)
     *
     * @param {any} inputDate - The date to be converted. It can be a number (Unix Epoch),
     * a Date object, or a string in various formats.
     * @return {string} The converted date in ISO format. Returns null if the input date
     * is invalid.
     */
    convertAnyDateToISO(inputDate) {
        let date = null;
      
        if (typeof inputDate === 'number') {
          // If input is a number, we assume it's Unix Epoch
          date = new Date(inputDate);
        } else if (inputDate instanceof Date) {
          // Check if it's a valid date
          if (inputDate.toString() == "Invalid Date") {
            console.error(`Invalid date format for input: ${inputDate.toString()} in ${this.link}`);
            this.isValidEvent = false;
            return null;
          }
          date = inputDate;
        } else if (typeof inputDate === 'string') {
          // If input is a string, try to parse it as a date with different formats
          const possibleFormats = [
            'yyyy-MM-dd',
            'yyyy-MM-dd HH:mm:ss',
            'yyyy-MM-dd HH:mm',
            'dd/MM/yyyy',
            'dd/MM/yyyy HH:mm:ss',
            'dd/MM/yyyy HH:mm',
            'yyyy-MM-dd\'T\'HH:mm:ss.SSSXXX', // timestampz format
            'yyyy-MM-dd HH:mm:ss.S', // Format with milliseconds coming from aytoCoruna
            'yyyy-MM-dd\'T\'HH:mmXXX', // coming from meetup, timestamp with timezone offset
            'yyyy-MM-dd\'T\'HH:mm:ssXXX', // new meetup format
            // Add more formats if needed
          ];
          
      
          for (const format of possibleFormats) {
            date = parse(inputDate, format, new Date());
      
            if (isValid(date)) {
              break;
            }
          }
        }

        if (isValid(date)) {
          return formatISO(date);
        }
      
        console.error(`Invalid date format for input: ${inputDate} in ${this.link}`);
        this.isValidEvent = false;
        return null;
      }
    
    /**
     * Converts any given ISO date to a human-readable format.
     *
     * @param {any} inputDate - The date to be converted.
     * @return {string|null} The human-readable date in the format 'eeee, dd', or null if the inputDate is invalid.
     */
    convertISODateToHumanReadable(inputDate) {
        let date = null;
      
        if (typeof inputDate === 'string') {
          date = parseISO(inputDate);
        }
      
        if (isValid(date)) {
          return format(date, 'eeee, dd, HH:mm', { locale: enUS });
        }
      
        console.error(`Invalid date format for Human readable input: ${inputDate} in ${this.link}`);
        this.isValidEvent = false;
        return null;
      }

    /**
     * Sanitizes a string for DuckDB by replacing single quotes with two consecutive single quotes.
     *
     * @param {string} str - The string to be sanitized.
     * @return {string} The sanitized string.
     */
    sanitizeStringForDuckDB(str) {
        // Transform whatever comes as str into a string
        str = String(str);
        // Replace simple ' with two consecutive single quotes
        const sanitizedStr = str.replace(/'/g, "''");
        // Convert strips from any HTML tags
        return convert(sanitizedStr);
    }

    
    /**
     * Generate a hash value for the given input using the SHA256 algorithm.
     *
     * @param {string} input - The input string to be hashed.
     * @return {string} - The hashed value of the input string.
     */
    createHash(input) {
        const urlHash = crypto.createHash('sha256').update(input).digest('hex');
        return urlHash;
    }

    //------------------------------------------------------------------------//
    //                                                                        //
    // STATIC METHODS                                                         //
    //                                                                        //
    //------------------------------------------------------------------------//

    /**
     * Checks if the given object or any of its nested objects or arrays contain the string "online".
     *
     * @param {object|array} objToCheck - The object or array to check.
     * @return {boolean} Returns true if the object or any of its nested objects or arrays contain the string "online", otherwise returns false.
     */
    static checkIfOnline(objToCheck) {
      // Object.values allows to iterate from both object values
      // or arrays, that it's what we'll find in JSON from pages.
      for (const iterator of Object.values(objToCheck)) {
          // if iterator is a string, check if it contains "online"
          if (typeof iterator === "string" && iterator.toLowerCase().includes("online")) {
              return true;
          }
          // if iterator is an array or object, call checkIfOnline() recursively on it
          const isAnArray = Array.isArray(iterator);
          const isAnObject = typeof iterator === "object";
  
          if (isAnArray || isAnObject) {
              if (EventItem.checkIfOnline(iterator)) {
                  return true;
              }
          }
      }
      // If we cant find an iterable or string containing "online", return false
      return false;
    }

    /**
     * Checks for duplicates in an array of events and returns a filtered array of valid events.
     *
     * This function iterates through the array of events and checks for duplicates based on the title, levenshtein distance, and image similarity.
     * 
     * It labels each event as duplicated or not and builds clusters of duplicates.
     * 
     * It then scores the events in each cluster and filters out the events with lower scores, keeping only one event with the highest score from each cluster (If multiple events have the same score, it keeps the first).
     * 
     * IT MAY PRODUCE FALSE POSITIVES, specially the image comparison. I'm trying hard to not use LLM APIs.
     * 
     * YOU SHOULDN'T PUSH EVENTS ON DIFFERENT DAYS, because it will lable repeating events as duplicates.
     * 
     * @param {Array} arrayOfEvents - The array of events to check for duplicates (SAME DAY!!).
     * @return {Array} The filtered array of events without duplicates.
     */
    static async checkForDuplicates(arrayOfEvents) {
      // JS object with each dataSource score
      const scoresFilePath = `${__dirname}/config/filtering_scores.json`;
      let scores = JSON.parse(fs.readFileSync(scoresFilePath));
      
      // Build some flags for handling duplicates
      for (const thisEvent of arrayOfEvents) {
        thisEvent.isDuplicated = false;
      }


      //////////////////////////////////////////////////////////////////////
      // Checking for duplicates
      //
      // clustersOfDuplicates = [
      //  [Event 1, Event 2],
      //  [Event 3, Event 4],
      //  [Event 5, Event 6]
      // ]
      //
      //////////////////////////////////////////////////////////////////////

      let clustersOfDuplicates = [];

      for (const leftEvent of arrayOfEvents) {

        let thisEventDuplicates = [];

        // If the event has already been labelled as duplicate, skip it
        if (leftEvent.isDuplicated == false) {
          thisEventDuplicates.push(leftEvent);
          clustersOfDuplicates.push(thisEventDuplicates);
        } else {
          continue;
        }

        for (const rightEvent of arrayOfEvents) {

          // Avoid checking against itself
          if (rightEvent.link != leftEvent.link) {

            // Check if the titles are the same
            const hasTheSameTitle = leftEvent.title == rightEvent.title;
            if (hasTheSameTitle) {
              leftEvent.isDuplicated = true;
              rightEvent.isDuplicated = true;
              leftEvent.isDuplicatedBy = 'same title';
              rightEvent.isDuplicatedBy = 'same title';
              thisEventDuplicates.push(rightEvent);
              continue;
            }


            // Consider duplicated if levenshtein distance =<20% of the average length
            const rightLength = rightEvent.title.length;
            const leftLength = leftEvent.title.length;
            const averageLength = (rightLength + leftLength) / 2;
            const levenshteinDistance = distance(leftEvent.title, rightEvent.title);

            if (levenshteinDistance <= averageLength * 0.2) {
              leftEvent.isDuplicated = true;
              rightEvent.isDuplicated = true;
              leftEvent.isDuplicatedBy = 'levenshtein distance';
              rightEvent.isDuplicatedBy = 'levenshtein distance';
              thisEventDuplicates.push(rightEvent);
              continue;              
            }

            // Check image similarity with resemblejs. Consider same image if mismatch score < 75.
            // I came up with this score with some manual testing with sample images.
            let imageMisMathScore;
            let leftEventLocalImage = leftEvent.localImageLocation;
            let rightEventLocalImage = rightEvent.localImageLocation;

            // For image similarity, same source is likely to produce false positives, skip if same source
            const sameSource = leftEvent.source == rightEvent.source;
            if (sameSource) {continue;}

            try {    
              const options = {
                scaleToSameSize: true,
                ignore: 'alpha',
              }   
              imageMisMathScore = (await compareImages(leftEventLocalImage, rightEventLocalImage, options)).rawMisMatchPercentage;
            } catch (error) {
              console.error(`\nError comparing event images: ${error}\n Images: ${leftEventLocalImage} and ${rightEventLocalImage}`);
              imageMisMathScore = 100;
            }

            if (imageMisMathScore < 75) {
              leftEvent.isDuplicated = true;
              rightEvent.isDuplicated = true;
              leftEvent.isDuplicatedBy = 'image similarity';
              rightEvent.isDuplicatedBy = 'image similarity';
              thisEventDuplicates.push(rightEvent);
              continue;
            }

          }
        }

      }


      
      //////////////////////////////////////////////////////////////////////
      // Scoring & Filtering Events
      //////////////////////////////////////////////////////////////////////
      const filteredArray = [];

      for (const cluster of clustersOfDuplicates) {
        // Score all events in the cluster
        for (const event of cluster) {
          try {
            event.score = scores[event.source];
            if (event.score == undefined) {
              console.error(`\nError scoring event: ${event.source} not found in scores table`);
              event.score = 10;
            };
          } catch (error) {
            console.error(`\nError scoring event: ${error}`);
            event.score = 10;
          }
        }

        // Only one event for this cluster of duplicates can survive
        let maxScore = 0;
        let eventWithHigerScore;
        for (const event of cluster) {
          if (maxScore < event.score) {
            maxScore = event.score;
            eventWithHigerScore = event;
          }
        }

        filteredArray.push(eventWithHigerScore);
      }

      // return only the valid events
      return filteredArray;

    }
    
    /**
     * Filters an array of events by checking if the title of each event includes any banned strings.
     *
     * @param {Array} arrayOfEvents - The array of events to be filtered.
     * @return {Array} filteredArray - The filtered array of events.
     */
    static async filterByBannedStrings(arrayOfEvents, bannedStringsFilePath) {
      let bannedStrings;
      try {
        bannedStrings = fs.readFileSync(bannedStringsFilePath, 'utf-8').split('\n');
      } catch (error) {
        console.error('Error reading bannedstrings.txt:', error);
        return arrayOfEvents;
      }

      let filteredArray = [];

      // If the title of the event includes any of the banned strings, don't push to filtered array
      for (const event of arrayOfEvents) {
        let isBanned = false;
        for (const bannedString of bannedStrings) {
          if (event.title.toLowerCase().includes(bannedString.toLowerCase())) {
            isBanned = true;
            break;
          }
        }
        if (!isBanned) {
          filteredArray.push(event);
        }
      }

      return filteredArray;
      
    }

    static async downloadImage(url, imgLocalDestinationFolder) {
      try {
      // Make a request to fetch the image data
      const response = await axios.get(url, { responseType: 'arraybuffer' });

      // Try to extract the file extension from the 'Content-Type' header
      let extension;
      if (response.headers['content-type'] && response.headers['content-type'].startsWith('image/')) {
        extension = response.headers['content-type'].split('/')[1];
      } else {
        // If 'Content-Type' header is not present or not useful, try to infer the file extension from the URL
        const knownExtensions = ['jpg', 'jpeg', 'gif', 'png', 'webp', 'svg'];
        extension = knownExtensions.find(ext => url.includes(`.${ext}`)) || 'jpg';
      }

      // Generate a unique filename based on milisecons since Jan 1 1970
      const timestamp = Date.now();
      const filename = `${timestamp}.${extension}`;
  
      // Create the destination folder if it doesn't exist
      if (!fs.existsSync(imgLocalDestinationFolder)) {
      fs.mkdirSync(imgLocalDestinationFolder);
      }
  
      // Specify the complete file path
      const filePath = `${imgLocalDestinationFolder}${filename}`;
  
      // Write the image data to the specified file path
      fs.writeFileSync(filePath, Buffer.from(response.data));

      // If the file extension is webp, convert it to png (Resemblejs doesn't support webp, and we need it to detect duplicated events)
      if (extension === 'webp') {
        try {
          webp.grant_permission();
          const absolutePath = process.cwd()
          const localDestinationWithoutDot = imgLocalDestinationFolder.slice(1);
          const fileToConvert = `${absolutePath}${localDestinationWithoutDot}${filename}`;
          const destinationFile = `${absolutePath}${localDestinationWithoutDot}${timestamp}.png`;
          const result = await webp.dwebp(fileToConvert, destinationFile, '-o');
        } catch (error) {
          console.error(`Error converting webp to jpg: ${error}`);
        }
      }
  
      // Return a resolved promise to indicate success & the filename
      return filename;
  
      } catch (error) {
          console.error(`Error downloading or writing event img. Returning null:\n${error}\n${url}`);
          return null;
      }
    }

}

module.exports = { EventItem };