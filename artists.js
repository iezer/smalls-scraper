const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require("jsdom");

// Configure your PostgreSQL connection
const pool = new Pool({
  ssl: {
    rejectUnauthorized: false,
  },
});

async function extractArtistImage(htmlString) {
  // Parse the HTML string into a DOM
  const dom = new JSDOM(htmlString, { contentType: "text/html" });

  // Find the image tag with the class "artist-search-profile-image"
  const imageElement = dom.window.document.querySelector('.artist-search-profile-image img');

  // Extract the image URL
  const image = imageElement ? imageElement.src : null;

  const bioElement = dom.window.document.querySelector('.artist-search-profile-bio');
  const bio = bioElement ? bioElement.textContent.trim() : null;

  return {image, bio};
}

async function updateArtistData(artistId, image, bio) {
  const client = await pool.connect();

  try {
    const updateQuery = `
      UPDATE artists
      SET image = $1, bio = $2
      WHERE id = $3;
    `;
    const result = await client.query(updateQuery, [image, bio, artistId]);

    if (result.rowCount === 0) {
      console.log(`No artist found with ID ${artistId}`);
    } else {
      console.log(`Artist with ID ${artistId} updated successfully`);
    }
  } catch (error) {
    console.error('Error updating artist data:', error);
  } finally {
    client.release();
  }
}

async function fetchAndSaveArtistData() {
  const client = await pool.connect();

  try {
    // Select one artist with a null image or null bio
    const artistQuery = `
      SELECT * FROM artists
      WHERE image IS NULL OR bio IS NULL
      LIMIT 1;
    `;
    const artistResult = await client.query(artistQuery);

    if (artistResult.rows.length === 0) {
      console.log('No artist found with null image or bio.');
      return;
    }

    const artist = artistResult.rows[0];
    const artistUrl = artist.url;

    // Fetch data for the artist from the URL
    const response = await fetch(`https://www.smallslive.com/${artistUrl}`);
    const template = await response.text();

    // Save the fetched data in the "artists" folder
    const artistFolderPath = path.join(__dirname, 'artists');
    if (!fs.existsSync(artistFolderPath)) {
      fs.mkdirSync(artistFolderPath);
    }

    const {image, bio} = await extractArtistImage(template);

    const artistFilePath = path.join(artistFolderPath, `${artist.id}.json`);
    fs.writeFileSync(artistFilePath, JSON.stringify({ id: artist.id, image, bio, template }, null, 2));

    // Update the artist record in the database
    return await updateArtistData(artist.id, image, bio);

    console.log(`Fetched and saved data for artist ${artist.name}`);
  } catch (error) {
    console.error('Error fetching and saving artist data:', error);
  } finally {
    client.release();
  }
}

async function fetchArtists() {
  // Call the function

  for (let i = 0; i < 760; i++) {
    await fetchAndSaveArtistData();
  }
}

fetchArtists();