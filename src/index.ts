import got from "got";
import getFull from "./full";
import { Readable } from "stream";
import nunjucks from "nunjucks";
import cookieParser from "cookie-parser";
import { json } from "express";
import fs from "fs";
import path from "path";

import indexTemplate from "./views/index.njk";

type StravaActivity = {
  name: string;
};

const config = require("./config.js");

const extensionUrl = `${config.directusUrl}/${config.extensionName}`;
const authUrl = `${extensionUrl}/auth`;
const oauthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${authUrl}&approval_prompt=force&scope=activity:read_all`;
const tokenJSONPath = path.join(__dirname, "strava.json");

const log = (text: string, object?: any, emoji: string = "📜") => {
  const now = new Date();
  console.log(
    `${("0" + now.getHours()).slice(-2)}:${("0" + now.getMinutes()).slice(
      -2
    )}:${("0" + now.getSeconds()).slice(
      -2
    )} ${emoji} ${text[0].toUpperCase()}${text.slice(1)}`
  );
  if (object) {
    console.log(object);
  }
};

// Make a request and return the response
const request = async (options) => {
  try {
    const response = await got(options).json();
    return response;
  } catch (e) {
    console.log(e.response.body);
    return e.response.body;
  }
};

export default function registerEndpoint(router, { services, getSchema, database }) {
  const { ItemsService, FilesService, AuthenticationService } = services;

  router.use(cookieParser());
  router.use(json());

  // STRAVA AUTHENTICATION
  // check for all routes

  const setToken = (req, data) => {
    const tokenJSON = JSON.stringify(data);
    fs.writeFileSync(tokenJSONPath, tokenJSON, { encoding: "utf-8" });
    req.strava_token = data;
  };

  // Get strava token if it exists
  router.use(async (req, res, next) => {
    // Check and refresh strava token
    if (!fs.existsSync(tokenJSONPath)) {
      return next();
    }
    try {
      const tokenJSON = fs.readFileSync(tokenJSONPath, { encoding: "utf-8" });
      let token = JSON.parse(tokenJSON);
      const time = Math.round(Date.now() / 1000);
      if (token.expires_at - time <= 3600) {
        token = await request({
          url: `https://www.strava.com/oauth/token`,
          method: "post",
          json: {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: token.refresh_token,
            grant_type: "refresh_token",
          },
        });
      }
      setToken(req, token);
    } catch (e) {
      console.log(e);
    }
    return next();
  });

  // Directus Auth
  // Check for all routes other than webhook as the Strava API is not authed on our directus instance
  router.use(async (req, res, next) => {
    if (config.directusAuth !== false) {
      const schema = await getSchema();
      if (!req.cookies.directus_refresh_token) {
        return res.redirect(
          `${config.directusUrl}/admin/login?redirect=/${config.extensionUrl}`
        );
      }
      const authService = new AuthenticationService({ schema });
      let auth;
      try {
        auth = await authService.refresh(req.cookies.directus_refresh_token);
        res.cookie("directus_refresh_token", auth.refreshToken, {
          maxAge: auth.expires,
          httpOnly: true,
        });
      } catch (e) {
        console.log(e);
        return res.redirect(
          `${config.directusUrl}/admin/login?redirect=/${config.extensionUrl}`
        );
      }
    }
    return next();
  });

  const getActivity = async (req, activityId, body = null) => {
    const schema = await getSchema();
    const rowService = new ItemsService(config.collection, { schema });
    const filesService = new FilesService({ schema });

    // Look up existing activity
    // TODO: fix once json filtering is readded to directus
    // const results = await rowService.readByQuery({
    //   filter: { data: { _contains: `"id":${activityId}` } },
    //   fields: ["id", "files.directus_files_id.id"],
    // });
    // const id = results?.[0]?.id || null;
    // const fileKey =
    //  results?.[0]?.files?.[0]?.directus_files_id?.id || undefined;
    const results = await database.raw(`select id, data from ${config.collection} where data like '%"id":${activityId}%';`)
    const result = results.find(r => `${JSON.parse(r.data).id}` === `${activityId}`)
    const id = result?.id || null;
    const hydratedResult = id ? await rowService.readOne(id, { fields: ["files.directus_files_id.id"]}) : null;
    const fileKey = hydratedResult?.files?.[0]?.directus_files_id?.id || undefined;

    // Get Activity
    if (!body) {
      const token = req.strava_token;
      const data = (await got(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      ).json()) as StravaActivity;
    }

    // Get things not available in the API
    const { gpx, notes } = await getFull(activityId);
    let newFileKey = null;
    if (gpx) {
      const gpxAsStream = Readable.from([gpx]);
      newFileKey = await filesService.uploadOne(
        gpxAsStream,
        {
          title: data.name,
          filename_download: `${activityId}.gpx`,
          type: "application/gpx+xml",
          storage: "local",
        },
        fileKey
      );
    }

    // Create or update activity
    const key = await rowService.upsertOne({
      id,
      ...config.mapActivityToItem(data),
      files: newFileKey ? [{ directus_files_id: newFileKey }] : [],
      notes: notes,
    });
    log("Updated activity: " + key);
  };

  // Index page
  router.get("/", async (req, res) => {
    const token = req.strava_token;
    let activities = [];
    let updated = null;
    if (token) {
      activities = await got(`https://www.strava.com/api/v3/activities`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }).json();
      updated = req.query.updated ? Number(req.query.updated) : null;
    }

    const html = nunjucks.renderString(indexTemplate, {
      extensionUrl,
      oauthUrl,
      token,
      activities,
      updated,
    });
    return res.send(html);
  });

  // ACTIVITIES

  // View json for a single activity
  router.get("/view/:id", async (req, res) => {
    let token = req.strava_token;
    const data = await got(
      `https://www.strava.com/api/v3/activities/${req.params.id}`,
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    ).json();
    return res.send(data);
  });

  // Trigger a fetch to directus db of one activity
  router.get("/fetch/:id", async (req, res) => {
    await getActivity(req, req.params.id);
    return res.redirect(`${extensionUrl}?updated=${req.params.id}`);
  });

  // Auth an athlete
  router.get("/auth", async (req, res) => {
    let code = req.query.code;
    if (!code) {
      return res.send(`<a href="${oauthUrl}">Click Here To Authenticate</a>`);
    }
    const response = await request({
      url: "https://www.strava.com/oauth/token",
      method: "post",
      json: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
      },
    });
    if (response.errors) {
      log("Athlete auth failed");
      return res.sendStatus(400);
    }
    log("Athlete authed");
    setToken(req, response);
    res.redirect(extensionUrl);
  });
}
