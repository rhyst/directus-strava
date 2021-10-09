module.exports = {
  // Auth
  athleteEmail: "", // Your strava account email - only required for retrieving "full" activities
  athletePassword: "", // Your strava account password - only required for retrieving "full" activities
  authClientId: 68343, // Strava Application id - leave as default unless you are hosting your own server
  authProxyUrl: " https://directus-strava.herokuapp.com", // Auth proxy url - leave as default unless you are hosting your own server
  webhookSecret: "", // A random secret to obfusticater the webhook url
  // Paths
  directusUrl: "", // The full url to your directus instance
  extensionName: "strava", // The extension name - should match the extension directory name
  // Data
  collection: "strava", // The directus table to insert strava data into
  mapActivityToItem: (data) => ({
    // A function that maps strava activity properties into your table columns
    date: data.start_date.slice(0, 10),
    country: data.location_country,
    activity:
      {
        Ride: "cycling",
        Run: "running",
        Hike: "hiking",
      }[data.type] || data.type,
    description: data.description,
    links: [{ link: `https://www.strava.com/activities/${data.id}` }],
    name: data.name,
    latitude: data.start_latitude,
    longitude: data.start_longitude,
    data,
  }),
};
