import pg from "pg";
const {Pool} = pg;

// Configure your PostgreSQL connection
const pool = new Pool({
  user: process.env['USER_NAME'],
  password: process.env['PASSWORD'],
  host: process.env['RDS_PROXY_HOST'],
  database: process.env['DB_NAME'],
  port: 5432,

  ssl: {
    rejectUnauthorized: false,
  },
});

const EVENTS_QUERY = `SELECT 
  e.*,
  ARRAY_AGG(ea.artist_id) AS artists
FROM 
  events e
LEFT JOIN 
  event_artists ea ON e.id = ea.event_id
  WHERE EXTRACT(YEAR FROM date) = $1 AND
    EXTRACT(MONTH FROM date) = $2
GROUP BY 
  e.id; `;

const ARTISTS_QUERY = `SELECT 
  a.*
FROM 
  events e
JOIN 
  event_artists ea ON e.id = ea.event_id
JOIN 
  artists a ON ea.artist_id = a.id
WHERE 
  EXTRACT(YEAR FROM e.date) = $1
  AND EXTRACT(MONTH FROM e.date) = $2;`;

const TOP_ARTISTS_QUERY = `
SELECT 
  a.id,
  a.name,
  a.instrument,
  a.url,
  a.image,
  COUNT(ea1.event_id) AS event_count,
  COUNT(DISTINCT ea2.artist_id) AS other_artists_count,
  ARRAY_AGG(ea1.event_id) AS events
FROM 
  artists a
JOIN 
  event_artists ea1 ON a.id = ea1.artist_id
JOIN 
  event_artists ea2 ON ea1.event_id = ea2.event_id AND ea1.artist_id != ea2.artist_id
GROUP BY 
  a.id, a.name
ORDER BY 
event_count DESC
LIMIT 100;`;

const EVENTS_FOR_ARTISTS_QUERTY = `
SELECT
  e.*,
  ARRAY_AGG(ea.artist_id) AS artists
  FROM 
  events e
LEFT JOIN 
  event_artists ea ON e.id = ea.event_id
  WHERE e.id = ANY($1)
  GROUP BY 
  e.id; `;

export const handler = async(event) => {
  console.log(event);
  const { year, month } = event.queryStringParameters;
  try {
    const client = await pool.connect();

    let response;

    if (event.rawPath.includes('events')) {
    const eventsResults = await client.query(EVENTS_QUERY, [year, month]);
    const artistsResults = await client.query(ARTISTS_QUERY, [year, month]);

    const events = eventsResults.rows;
    const artists = artistsResults.rows;
    
    response = { events, artists };
    } else if (event.rawPath.includes('artists')) {
      const artistsResults = await client.query(TOP_ARTISTS_QUERY);
      const artists = artistsResults.rows;

      let artistIds = artists.map(artist => artist.id);
      const eventsResults = await client.query(EVENTS_FOR_ARTISTS_QUERTY, [artistIds]);
      const events = eventsResults.rows;
      response = { artists, events };
    } else {
      return { statusCode: 404, body: 'Not Found' };
    }

    client.release()
    return response;

  }
  catch (e) {
      console.error(e);
      return 500;
  }
};