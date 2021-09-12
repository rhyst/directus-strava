# Strava Directus

A directus extension to enable automatic and easy manual backup of strava activities.

## Usage

**Extension**

Install the extension by copying `index.js` to the directus extensions folder `<directus_root>/extensions/endpoints/strava/index.js`.

Configure the extension by copying `config.js` to the directus extensions folder `<directus_root>/extensions/endpoints/strava/config.js`. Update the config values to reflect your strava account.

Then you can visit `<directus_url>/custom/strava` where you can authenticate and start fetching activities.

**Server**

By default the extension uses the Strava Directus heroku app as an authentication proxy server. This is a stateless app that stores no authentication information.

If you would prefer to host your own authentication server then you can simply deploy the heroku app and change the url in `config.js`.

```
heroku create

npm run deploy
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
