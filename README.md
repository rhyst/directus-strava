# Directus Strava Extension

A directus extension to enable automatic and easy manual backup of strava activities.

- Authenticates using included Strava OAuth application
- Retrieves activity data on manual trigger
- Automatically retreive activity data on creation or update (and updates existing Directus items)
- Use full log in details to retrieve full activity data

**Limitations**

The Strava activity endpoint does not allow access to private notes or original GPX data. If you wish these to be retrieved then you can provide login details to get these from the Strava website (you can verify that these never leave the client extension).

The Strava webhooks only trigger if the title of an activity changes. If you want other changes to be automatically then you must make a trivial change to the title to trigger the webhook. Alternatively use the list page in the extension to trigger retrieval of updated activities.

## Usage

### Install

Install the extension by copying the release files to your directus extensions folder:

- Copy `endpoint.js` to `<directus_root>/extensions/endpoints/strava/index.js`
- Copy `config.js` to `<directus_root>/extensions/endpoints/strava/config.js`

Configure the extension by editing `config.js`. See below for config options. You must set `directusUrl` for authentication to work.

Then you can visit `<directus_url>/strava` where you can authenticate and start fetching activities.

### Configure

Configuration is done in `config.js`. The options are:

| Option              | Type     | Default                                   | Description                                                                     |
| ------------------- | -------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `directusUrl`       | string   |                                           | The full url to your directus instance                                          |
| `webhookSecret`     | string   |                                           | A random secret to obfusticate the webhook url                                  |
| `collection`        | string   | `"strava"`                                | The directus collection to insert strava data into                              |
| `mapActivityToItem` | function |                                           | A function that maps strava activity properties into a directus item            |
| `extensionName`     | string   | `"strava"`                                | Extension name - should match the extension directory name                      |
| `authClientId`      | number   | `68343`                                   | Strava Application id - leave as default unless you are hosting your own server |
| `authProxyUrl`      | string   | `"https://directus-strava.herokuapp.com"` | Auth proxy url - leave as default unless you are hosting your own server        |
| `athleteEmail`      | string   |                                           | Your strava account email - only required for retrieving "full" activities      |
| `athletePassword`   | string   |                                           | Your strava account password - only required for retrieving "full" activities   |

### Server

By default the extension uses the Directus Strava heroku app as an authentication proxy server. This is a stateless app that stores no authentication information.

If you would prefer to host your own authentication server then first set up a Strava applicaton on the [strava website](https://developers.strava.com/docs/).

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
