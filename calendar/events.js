const utils = require('./utils.js');
const axios = require('axios');
const fs = require('fs');


/**
 * Modifies a list of events and groups them by day.
 * 
 * It assumes a list of events from today +10 days, it cannot handle events
 * spanning multiple +1 month
 *  
 * @param {Array} events - list of events to be binned
 * @param {number} numDays - number of days to bin the events by
 * @return {Array} - the modified list of binned events
 */
async function modifyEvents(events, numDays) {
  
    // 1. Creating main bins/groups for each day (numDays)
    let binsList = generateMyTempDayObjects(numDays);


    // 2. Looping through the events and pushing em to matching bins/groups
    // The match is done by comparing the event's initDate & endDate to the bin dayNumber
    //
    // If initDate <= daynumber && endDate >= daynumber garantees that all events will be
    // binned into the day they begin until the day they finish
    for (let i = 0; i < events.length; i++) {
        const eventInitNumber = events[i].initDate.getDate();
        const eventEndNumber = events[i].endDate.getDate();

        // 2.1. Looping through all bins/groups to see if the event's initDate
        // matches one of the dayNumbers of the bins
        for (let j = 0; j < binsList.length; j++) {
            const binDayNumber = binsList[j].dayNumber;

            // 2.1.1. If the event's initDate matches the two conditions
            // push the event into the matching bin
            const itBeganTodayOrBefore = eventInitNumber <= binDayNumber;
            const itEndedTodayOrAfter = eventEndNumber >= binDayNumber;

            if (itBeganTodayOrBefore && itEndedTodayOrAfter) {
                // 2.1.2. Before pushing the event to the bin, we need to modify
                // and/or include some fields so the template system renders it
                // nicely

                    // 2.1.2.1. Include human-readable dates
                    const humanInitDay = utils.getDateShortName(events[i].initDate).dayName;
                    const humanInitHour = utils.getDateShortName(events[i].initDate).hour;
                    const humanEndDay = utils.getDateShortName(events[i].endDate).dayName;
                    const humanEndHour = utils.getDateShortName(events[i].endDate).hour;

                    events[i].HumanInitDate = humanInitDay + " at " + humanInitHour;
                    events[i].HumanEndDate = humanEndDay + " at " + humanEndHour;

                    // 2.1.2.2. Transform Date obj to ISO format
                    events[i].initDate = events[i].initDate.toJSON();
                    events[i].endDate = events[i].endDate.toJSON();

                // 2.1.3. Finally Push the event into the matching bin
                binsList[j].dayEvents.push(events[i]);
            }
        }

    }

    // 3. Download all images, put em into ./template/img folder and replace all urls in the events
    // by https://cometocoruna.com/assets/calendar/img/name-of-the-image.extension

    // 3.0 Delete all images from ./template/img folder
    try {
      fs.rmSync(destinationFolder, { recursive: true, force: true });
    } catch (error) {
      console.error(error);
    }

    for (const bin of binsList) {
      for (const event of bin.dayEvents) {
        try {
          // 3.1 Download event.image into ./template/img folder
          const fileName = await downloadImage(event.image, "./template/img/");
          console.log('Image downloaded and saved successfully!');
          // 3.2 Replace the URL pointing to https://cometocoruna.com/assets/calendar/img/*
          event.image = "https://cometocoruna.com/assets/calendar/img/" + fileName;
        } catch (error) {
          console.error('Image download failed:', error);
        }  
      }
    }

    // 4. Now that all events are binned and modified, we need to return the bin list
    return binsList;

  }

/**
 * Generates a list of `myTempDayObj` objects for a given number of days.
 * @param {number} numDays - The number of days to generate the objects for.
 * @returns {Array} - An array of `myTempDayObj` objects.
 */
function generateMyTempDayObjects(numDays) {
    const myTempDayObjects = [];
  
    for (let i = 0; i < numDays; i++) {
      let dayName = null;
      if (i === 0) {
        dayName = "Today";
      } else if (i === 1) {
        dayName = "Tomorrow";
      } else {
        dayName = utils.getDateShortName(i).dayName;
      }
  
      const dayNumber = utils.getDateShortName(i).dayNumber;
  
      const myTempDayObj = {
        "index": i,
        "cssSelector": "plus" + i,
        "dayName": dayName,
        "dayNumber": dayNumber,
        "dayEvents": []
      };
  
      myTempDayObjects.push(myTempDayObj);
    }
  
    return myTempDayObjects;
  }
  
  

  /**
   * Downloads an image from the specified URL and saves it to the destination folder.
   *
   * @param {string} url - The URL of the image to download.
   * @param {string} destinationFolder - The folder where the downloaded image will be saved.
   * @return {Promise<string>} A promise that resolves with the filename of the saved image if successful, or rejects with an error message if there was an error downloading or saving the image.
   */
  async function downloadImage(url, destinationFolder) {
    try {
      // Make a request to fetch the image data
      const response = await axios.get(url, { responseType: 'arraybuffer' });
  
      // Generate a unique filename based on the current timestamp
      const timestamp = Date.now();
      const filename = `${timestamp}.jpg`;

      // Create the destination folder if it doesn't exist
      if (!fs.existsSync(destinationFolder)) {
        fs.mkdirSync(destinationFolder);
      }
      // Specify the complete file path
      const filePath = `${destinationFolder}${filename}`;
  
      // Write the image data to the specified file path
      fs.writeFileSync(filePath, Buffer.from(response.data));
  
      // Return a resolved promise to indicate success & the filename
      return Promise.resolve(filename);
    } catch (error) {
      // Return a rejected promise with the error message to indicate failure
      return Promise.reject(error.message);
    }
  }
  
  
  /**
   * Returns the file name from a given URL.
   *
   * @param {string} url - The URL from which to extract the file name.
   * @return {string} The file name extracted from the URL.
   */
  function getFileName(url) {
    const lastSlashIndex = url.lastIndexOf("/");
    return url.substring(lastSlashIndex + 1);
  }
  

  module.exports = {
    modifyEvents
  }