const crypto = require('crypto');
const { parse, isValid, format, formatISO, parseISO } = require('date-fns');
const { enUS } = require('date-fns/locale');

/**
 * Class representing an Real Life Event.
 * @class
 */
class EventItem {
    /**
     * Constructor for the Event class.
     * @constructor
     * @param {string} title - The title of the event.
     * @param {string} link - The link of the event.
     * @param {string} price - The price of the event.
     * @param {string} content - The content/description of the event.
     * @param {string} image - The image URL of the event.
     * @param {string} source - The source of the event.
     * @param {string|number|Date} initDate - The start date of the event.
     * @param {string|number|Date} endDate - The end date of the event.
     */
    constructor(title, link, price, content, image, source, initDate, endDate) {
        this.title = this.sanitizeStringForDuckDB(title);
        this.link = link;
        this.price = this.setPrice(price);
        this.content = this.sanitizeStringForDuckDB(content);
        this.image = image;
        this.source = source;

        this.initDate = initDate;
        this.endDate = endDate;

        this.initDateISO = this.convertAnyDateToISO(initDate);
        this.endDateISO = this.convertAnyDateToISO(endDate);
        this.initDateHuman = this.convertISODateToHumanReadable(this.initDateISO);
        this.endDateHuman = this.convertISODateToHumanReadable(this.endDateISO);
        this.scrapedDateISO = formatISO(new Date());

        this.hash = this.createHash(this.link);

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
        case 0:
        case 0.00:
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
        return sanitizedStr;
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
          if (typeof iterator === "string" && iterator.includes("online")) {
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



}

module.exports = { EventItem };