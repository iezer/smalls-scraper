const { Pool } = require("pg");
const fs = require('fs');
const path = require('path');

// Configure your PostgreSQL connection
const pool = new Pool({
  
  ssl: {
    rejectUnauthorized: false,
  },
});

function convertDateFormat(dateStr) {
// Convert from MM/DD/YYYY to YYYY-MM-DD (PostgreSQL format)
const [month, day, year] = dateStr.split("/");
return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function insertEventData(eventData) {
const client = await pool.connect();

try {
// Start transaction
await client.query("BEGIN");

// Convert date format
const formattedDate = convertDateFormat(eventData.date);

// 1. Insert event
const eventInsert = `
INSERT INTO events (title, url, date, image)
VALUES ($1, $2, $3::date, $4)
RETURNING id;
`;
const eventResult = await client.query(eventInsert, [
eventData.title,
eventData.url,
formattedDate, // Now using the formatted date
eventData.img || null,
]);
const eventId = eventResult.rows[0].id;

// 2. Process each artist
for (const artist of eventData.artists) {
// Parse name and instrument from combined string
const [name, instrument] = artist.name.split(" / ").map((s) => s.trim());

// Try to insert artist if they don't exist
const artistInsert = `
INSERT INTO artists (name, url, instrument, image)
VALUES ($1, $2, $3, NULL)
ON CONFLICT (url) DO UPDATE
SET name = EXCLUDED.name,
instrument = EXCLUDED.instrument
RETURNING id;
`;
const artistResult = await client.query(artistInsert, [
name,
artist.url,
instrument || "Unknown",
]);
const artistId = artistResult.rows[0].id;

// 3. Create relationship in join table
const relationInsert = `
INSERT INTO event_artists (event_id, artist_id)
VALUES ($1, $2)
ON CONFLICT (event_id, artist_id) DO NOTHING;
`;
await client.query(relationInsert, [eventId, artistId]);
}

// Commit transaction
await client.query("COMMIT");
} catch (e) {
// Rollback transaction on error
await client.query("ROLLBACK");
throw e;
} finally {
// Release the client back to the pool
client.release();
}
}

// Example usage:

const eventData = {
eventUrl: "/events/23446-pasquale-grasso-sam-edwards-clifford-barbaro/",
date: "31/01/2024", // Now in DD/MM/YYYY format
title: "Pasquale Grasso, Sam Edwards & Clifford Barbaro",
img: "https://res.cloudinary.com/dhvjntfe2/image/upload/c_fill,g_auto,h_300,q_auto,w_300/f_jpg/v1/mezzrowstaticmedia/event_images/pasquale_aJ1v2dA.jpeg",
artists: [
{
name: "Pasquale Grasso / Guitar",
url: "/search/?artist_pk=619",
},
{
name: "Sam Edwards / Bass",
url: "/search/?artist_pk=4034",
},
{
name: "Clifford Barbaro / Drums",
url: "/search/?artist_pk=137",
},
],
};

async function parseJsonFilesInFolder(folderPath) {
  try {
    const files = await fs.promises.readdir(folderPath);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');
      
      try {
        const jsonData = JSON.parse(fileContent);
        console.log(`Parsed JSON from ${file}:`, jsonData);

        jsonData.events.forEach(async (eventData) => {
          try {
            await insertEventData(eventData);
            console.log(`Inserted event data for ${eventData.title}`);
          } catch (insertError) {
            console.error(`Error inserting event data for ${eventData.title}:`, insertError);
          }
        });
      } catch (jsonError) {
        console.error(`Error parsing JSON from ${file}:`, jsonError);
      }
    }
  } catch (err) {
    console.error('Error reading folder:', err);
  }
}

//parseJsonFilesInFolder('files');

async function getCount() {
  const client = await pool.connect();

  client.query('SELECT count(*) FROM events', (err, res) => {
    console.log(err, res);
    client.end();
  });

}

getCount();

// // Call the function
// insertEventData(eventData)
//   .then(() => console.log("Event data inserted successfully"))
//   .catch((err) => console.error("Error inserting event data:", err));

// Handle pool closure separately when the application is shutting down
process.on('exit', () => {
  pool.end();
});