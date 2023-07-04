const config = {
  // Auth
  clientId: 123456,
  clientSecret: "",
  athleteEmail: "", // Your strava account email - only required for retrieving "full" activities
  athletePassword: "", // Your strava account password - only required for retrieving "full" activities
  webhookSecret: "", // A random secret to obfusticater the webhook url
  directusAuth: true, // Require users to have logged into directus to see the extension
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

export default config;
