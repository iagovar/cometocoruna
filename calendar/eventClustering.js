const { add, format, startOfDay, endOfDay } = require('date-fns');
const axios = require('axios');
const fs = require('fs');
const { EventItem } = require('./eventClass');

async function eventClustering(events, numDays, imgLocalDestinationFolder, imgRemoteFolderURL) {
    // 1. Generate cluster bins given the numDays
    const clusterList = generateClusters(numDays);

    // 2. For every cluster, we loop though the events and add them to the cluster.
    // An event should be in a cluster in case that:
    //
    // The starting date of the event is <= of the cluster day AND the
    // ending date of the event is >= of the cluster day.
    //
    // This way, an event spanning multiple days can be in multiple clusters

    for (const cluster of clusterList) {
        for (const event of events) {
            // if an event is already in a cluster, continue
            if (cluster.dayEvents.includes(event)) {
                continue;
            }

            // If an event ends befor cluster, or starts after it, continue
            const eventInitDate = new Date(event.initDateISO);
            const eventEndDate = new Date(event.endDateISO);
            const clusterInitDate = startOfDay(cluster.date);
            const clusterEndDate = endOfDay(cluster.date);

            const eventEndsBeforeCluster = eventEndDate < clusterInitDate;
            const eventStartsAfterCluster = eventInitDate > clusterEndDate;

            if (eventEndsBeforeCluster || eventStartsAfterCluster) {
                continue;
            }

            cluster.dayEvents.push(event);
        }
    }

    // 3. For every event, download the image to imgLocalDestinationFolder
    // and replace the img url in the event with:
    // https://cometocoruna.com/assets/calendar/img/name-of-the-image.extension

    // Delete all images from imgLocalDestinationFolder folder first
    try {
        fs.rmSync(imgLocalDestinationFolder, { recursive: true, force: true });
      } catch (error) {
        console.error(error);
    }

    // Download all images and set new image url
    for (const cluster of clusterList) {
        for (const event of cluster.dayEvents) {
            // Because the same event may be clustered multiple times, and passed
            // by reference, we need to check if it has already been downloaded.
            // So any image url starting by imgRemoteFolderURL is left as is.
            if (!event.image.startsWith(imgRemoteFolderURL)) {
                imgLocalFileName = await EventItem.downloadImage(event.image, imgLocalDestinationFolder);
                // If the image downloaded successfully, then change event.url
                if (imgLocalFileName != null) {event.image = imgRemoteFolderURL + imgLocalFileName;}
                }
        }
    }

    // 4. All modifications are done, returning the clustered events
    return clusterList;
}

function generateClusters(numDays) {
    const clusterList = [];
    const today = startOfDay(new Date());

    // Generate a cluster for every day
    for (let index = 0; index < numDays; index++) {
        const tempCluster = {
            "index": index,
            "cssSelector": "plus" + index,
            "date": add(today, { days: index }),
            "dayName": "",
            "dayEvents": []
        }

        // Set dayName to format 'Tuesday 26' if it's not today or tomorrow
        // Praise date-fns
        switch (index) {
            case 0:
                tempCluster.dayName = "Today";
                break;
            case 1:
                tempCluster.dayName = "Tomorrow";
                break;
            default:
                tempDayDate = add(today, { days: index }); // date-fns module
                tempDayNumber = tempDayDate.getDate();
                tempDayName = format(tempDayDate, 'EEEE'); // date-fns module
                tempCluster.dayName = `${tempDayName} ${tempDayNumber}`;
        }

        clusterList.push(tempCluster);        
    }

    return clusterList;
}

module.exports = eventClustering