# Directus Strava Extension

A directus extension to enable automatic and easy manual backup of strava activities.

## Usage

**Extension**

Install the extension by copying `index.js` to the directus extensions folder `<directus_root>/extensions/endpoints/strava/index.js`.

Configure the extension by copying `config.js` to the directus extensions folder `<directus_root>/extensions/endpoints/strava/config.js`. Update the config values to reflect your strava account. See the example config file for information on the different options.

Then you can visit `<directusUrl>/strava` where you can authenticate and start fetching activities.

**Server**

By default the extension uses the Directus Strava heroku app as an authentication proxy server. This is a stateless app that stores no authentication information.

If you would prefer to host your own authentication server then first set up a Strava applicaton on the strava website.

Then deploy the Heroku app:

```
heroku apps:create <name-for-your-heroku-app>

heroku config:set CLIENT_ID=<your-apps-client-id>
heroku config:set CLIENT_SECRET=<your-apps-client-secret>

npm run deploy
```

Finally update the `authProxyUrl` in `config.js` to your heroku app:

```
authProxyUrl: "https://my-heroku-app.herokuapp.com"
```

## Development

Install dependencies:

```
npm install
```

Build the extension and server files:

```
npm run build
```
