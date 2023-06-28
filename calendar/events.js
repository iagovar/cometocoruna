const utils = require('./utils.js');


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
function modifyEvents(events, numDays) {
  
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

    // 3. Now that all events are binned and modified, we need to return the bin list
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
  

  module.exports = {
    modifyEvents
  }