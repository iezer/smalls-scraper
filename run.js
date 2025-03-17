const fs = require("fs");
const {parseEvents} = require('./dom.js');
const FOLDER = "files";

// TODO co-pilot
function writeFile({data, filename}) {
  fs.writeFile(filename, JSON.stringify(data, null, 2), err => {
    if (err) {
      console.log(`Error writing file ${filename}`, err);
    } else {
      console.log(`File ${filename} written.`);
    }
  });
}

const getEventUrl = (startDate, endDate, page) =>
`https://www.smallslive.org/search/ajax/event/?page=${page}&date_from=${startDate}&date_to=${endDate}`;

const getFilename = (year, month, page, numPages) =>
`${FOLDER}/events_${year}_${month}_page_${page}_of_${numPages}.json`;

const getUtcDateString = (year, month, day) => {
  const d = new Date(year, month, day);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
}

async function fetchForMonth(year, month) {
  const startDate = getUtcDateString(year, month, 1);
  const endDate = getUtcDateString(year, month + 1, 0);

  let numPages = 1;

  for (let page = 1; page <= numPages; page++) {
    const url = getEventUrl(startDate, endDate, page);
    console.debug(url);
    const response = await fetch(url);
    const json = await response.json();
    numPages = json.numPages || page;

    const filename = getFilename(year, month, page, numPages);

    const events = await parseEvents(json.template);
    writeFile({ data: {...json, events}, filename});
  }
}

async function getAllYears() {
  for (let year = 2021; year >= 2007; year--) {
    for (let month = 0; month < 12; month ++) {
      await fetchForMonth(year, month);
    }
  }
}

getAllYears();