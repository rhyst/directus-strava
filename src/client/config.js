module.exports = {
  // Auth
  athlete_id: 123,
  athlete_email: "",
  athlete_password: "",
  verify_token: "",
  directus_url: "",
  auth_client_id: 68343,
  auth_proxy_url: " https://strava-directus.herokuapp.com",
  // Data
  tableName: "strava",
  mapActivityToRow: (data) => ({
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
