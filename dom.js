const { JSDOM } = require("jsdom");
const fs = require("fs");
const fsPromises = require("fs").promises;
const host = 'https://www.smallslive.org/'

// read file from disk or network
async function getEventFile(path) {
  const filename = `.${path.replace(/\/$/, ".html")}`
  return fsPromises.readFile(filename)
  .catch(async (err) => {
    console.log(`file ${path}, not found, fetching from network`, err);
    const response = await fetch(host + path);
    const html = await response.text();
    const written = await fsPromises.writeFile(filename, html);
    return html;
  });
}

async function parseEvent(event) {
  const url = event.getElementsByTagName('a')[0].href;
  const eventInfo = event.getElementsByClassName('event-info')[0];

  const title = eventInfo.getElementsByClassName('event-info-title')[0].textContent;
  const date = eventInfo.getElementsByClassName('margin-bottom')[0].textContent;
  const img = event.getElementsByTagName('img')[0].src;

  const html = await getEventFile(url);

  const dom = new JSDOM(html, {contentType: "text/html"});

  const domArtists = dom.window.document.getElementsByClassName('artist-link');

  const artists = Array.from(domArtists).map(artist => {
    const [name, instrument] = artist.textContent.trim().split(' / ');
    const url = artist.href;
    return { name, instrument, url};
  });

  return { url, date, title, img, artists};
}

async function parseEvents(calendarPage) {
  const dom = new JSDOM(calendarPage, { contentType: "text/html"});
  const events = dom.window.document.getElementsByTagName('article');
  return await Promise.all(Array.from(events).map(parseEvent));
}

module.exports = {
  parseEvents
}