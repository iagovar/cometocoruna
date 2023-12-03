const { distance } = require('fastest-levenshtein');
const {EventItem} = require('./eventClass');
const compareImages = require('resemblejs/compareImages');

const originalArray = [
    {
      link: "https://entradas.ataquilla.com/ventaentradas/es/otras-musicas/coliseum/15500--miguel-rios-gira-40-aniversario-rockrios.html",
      title: "Miguel Ríos – Gira 40 Aniversario ROCK&RIOS",
      price: "50,00 €",
      initDateISO: "2023-11-16T21:00:00+01:00",
      endDateISO: "2023-11-16T21:00:00+01:00",
      initDateHuman: "Thursday, 16, 21:00",
      endDateHuman: "Thursday, 16, 21:00",
      scrapedDateISO: "2023-09-05T17:38:47+02:00",
      content: "",
      image: "https://entradas.ataquilla.com/ventaentradas/15500-25494-teaser/-miguel-rios-gira-40-aniversario-rockrios.jpg",
      source: "ataquilla",
      isDuplicated: false,
      score: 5,
    },
    {
      link: "https://www.elespanol.com/quincemil/servicios/agenda/evento/concierto-de-miguel-rios-en-a-coruna/47933",
      title: "Concierto de Miguel Ríos en A Coruña",
      price: "50",
      initDateISO: "2023-11-16T21:00:00+01:00",
      endDateISO: "2023-11-16T23:00:00+01:00",
      initDateHuman: "Thursday, 16, 21:00",
      endDateHuman: "Thursday, 16, 23:00",
      scrapedDateISO: "2023-09-05T17:28:59+02:00",
      content: "EL ROCK&RÍOS VUELVE A LA CARRETERA! Miguel Ríos, tras el apabullante éxito del\n40 ANIVERSARIO que tuvo lugar en 2022 en Madrid, no sólo repite, sino que quiere\nque sigamos celebrándolo. ¡Nos vamos de gira! Rock&Ríos 40 aniversario, el mejor\ndisco en directo de la historia del rock español. Los hijos y nietos del Rock &\nRoll podrán recrear la magia de las noches de concierto con Miguel Ríos, en la\ngira por 15 ciudades de España, desde agosto hasta noviembre de 2023. Queremos\nrevivir el espíritu del Rock&Ríos, el concierto que marcó un antes y un después\nen la historia de la música y el rock en España en marzo de 1982. Habrá\nsorpresas en cada ciudad, uniendo de forma única el pasado y el presente.",
      image: "https://media.quincemil.com/imagenes/2023/03/28113458/miguel-rios-gira-40-aniversario-rockrios-640x360.webp",
      source: "quincemil",
      isDuplicated: false,
      score: 3,
    },
    {
      link: "https://www.coruna.gal/web/gl/actualidade/axenda/axenda-eventos/evento/concerto-de-miguel-rios-xira-40-aniversario-rock-rios/suceso/1453833737088",
      title: "Concerto de Miguel Ríos – XIRA 40 Aniversario ROCK&RIOS",
      price: "Cadeiras Pista (F 1 -10): 95,00 €Cadeiras Pista (F 10 -30): 85,00 €Tendido\nbaixo: 70,00 €                            Tendido medio: 60,00\n€                          Tendido alto: 50,00 €",
      initDateISO: "2023-11-16T00:00:00+01:00",
      endDateISO: "2023-11-16T00:00:00+01:00",
      initDateHuman: "Thursday, 16, 00:00",
      endDateHuman: "Thursday, 16, 00:00",
      scrapedDateISO: "2023-09-06T09:59:25+02:00",
      content: "O ROCK&RÍOS VOLVE Á ESTRADA! Miguel Ríos, tras o incrible éxito do 40\nANIVERSARIO que tivo lugar en 2022 en Madrid, non só repite, senón que quere que\nsigamos celebrándoo",
      image: "https://www.coruna.gal/IMG/P_Suceso_1453833732138_1099934327828_250_250_U_3dd697847e5dd1c2b3aba0d4fe95f92.png",
      source: "aytoCoruna",
      isDuplicated: false,
      score: 1,
    }
  
  ]



async function removeDuplicates(arrayOfEvents) {
  let scores = {
    aytoCoruna  : 1,
    meetup      : 2,
    quincemil   : 3,
    eventbrite  : 4,
    ataquilla   : 5,
  }; // JS object with each dataSource score

  // Build some flags for handling duplicates
  for (const thisEvent of arrayOfEvents) {
    thisEvent.isDuplicated = false;
  }

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

        const hasTheSameTitle = leftEvent.title == rightEvent.title;
        console.log(`\n\nComparing:\nLeft: ${leftEvent.title} \nRight: ${rightEvent.title}\nResult: ${hasTheSameTitle}`);

        
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

        console.log(`\n\nComparing:\nLeft: ${leftEvent.title} \nRight: ${rightEvent.title}\nAverage length: ${averageLength}\nLevenshtein distance: ${levenshteinDistance}\nResult: 20% is ${averageLength * 0.2} So ${levenshteinDistance <= averageLength * 0.2}`);

        if (levenshteinDistance <= averageLength * 0.2) {
          leftEvent.isDuplicated = true;
          rightEvent.isDuplicated = true;
          leftEvent.isDuplicatedBy = 'levenshtein distance';
          rightEvent.isDuplicatedBy = 'levenshtein distance';
          thisEventDuplicates.push(rightEvent);
          continue;              
        }

        // Check image similarity with resemblejs. Consider same image if mismatch score < 80.
        // I came up with this score with some manual testing with sample images.
        let imageMisMathScore;
        let diff;
        let leftEventLocalImage;
        let rightEventLocalImage;
        try {
          // Download leftEvent and rightEvent images locally to .test/img folder
          leftEventLocalImage = './test/img/' + await EventItem.downloadImage(leftEvent.image, './test/img/');
          rightEventLocalImage = './test/img/' + await EventItem.downloadImage(rightEvent.image, './test/img/');

          const options = {
            scaleToSameSize: true,
            ignore: 'alpha',
          }
          

          imageMisMathScore = (await compareImages(leftEventLocalImage, rightEventLocalImage, options)).rawMisMatchPercentage;

          console.log(`\n\nComparing images:\nLeft: ${leftEventLocalImage} \nRight: ${rightEventLocalImage}\nImage difference: ${imageMisMathScore}`);
        } catch (error) {
          console.error(`\nError comparing event images: ${error}`);
        }

        if (imageMisMathScore < 80) {
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
}

console.log(removeDuplicates(originalArray));