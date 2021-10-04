module.exports = {
  // Auth
  athleteId: 123, // Your strava athlete ID
  athleteEmail: "", // Your strava account email - only required for retrieving "full" activities
  athletePassword: "", // Your strava account password - only required for retrieving "full" activities
  authClientId: 68343, // Strava Application id - leave as default unless you are hosting your own server
  authProxyUrl: " https://directus-strava.herokuapp.com", // Auth proxy url - leave as default unless you are hosting your own server
  webhookSecret: "", // A random secret to obfusticater the webhook url
  webhookVerifyToken: "", // A random token to use during the webook set up process
  // Paths
  directusUrl: "", // The full url to your directus instance
  extensionPath: "strava", // The path you would like the strava extension to be available at
  // Data
  tableName: "strava", // The directus table to insert strava data into
  mapActivityToRow: (data) => ({
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
