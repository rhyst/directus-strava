import got from "got";
import getFull from "./full";
import { Readable } from "stream";
import nunjucks from "nunjucks";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { json } from "express";
import fs from "fs";
import path from "path";

import indexTemplate from "./views/index.njk";
import listTemplate from "./views/list.njk";

type StravaActivity = {
  name: string;
};

const config = require("./config.js");

const extensionUrl = `${config.directusUrl}/${config.extensionName}`;
const authUrl = `${extensionUrl}/auth`;
const listUrl = `${extensionUrl}/list`;
const webhookUrl = `${extensionUrl}/webhook-${config.webhookSecret}`;
const oauthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${authUrl}&approval_prompt=force&scope=activity:read_all`;
const tokenJSONPath = path.join(__dirname, "strava.json");

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

export default function registerEndpoint(router, { services, getSchema }) {
  let webhookVerifyToken;
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

  // WEBHOOKS

  // Respond to activity event
  router.post(`/webhook-${config.webhookSecret}`, async (req, res) => {
    res.status(200).send("EVENT_RECEIVED");
    const body = req.body;
    const type = body.aspect_type;
    const objectType = body.object_type;
    const activityId = body.object_id;
    console.log("Strava activity received: " + type + " " + activityId);

    if ((type === "create" || type === "update") && objectType === "activity") {
      getActivity(req, activityId);
    }
  });

  // Respond to webhook setup test
  router.get(`/webhook-${config.webhookSecret}`, (req, res) => {
    console.log("Webhook challenge recieved");
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
    if (mode && token) {
      if (mode === "subscribe" && token === webhookVerifyToken) {
        console.log("Responding OK to webhook challenge");
        return res.json({ "hub.challenge": challenge });
      } else {
        return res.sendStatus(403);
      }
    }
    return res.sendStatus(400);
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
    const results = await rowService.readByQuery({
      filter: { data: { _contains: `"id":${activityId}` } },
      fields: ["id", "files.directus_files_id.id"],
    });
    const id = results?.[0]?.id || null;
    const fileKey =
      results?.[0]?.files?.[0]?.directus_files_id?.id || undefined;

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
    console.log("Updated activity: " + key);
  };

  // Index page
  router.get("/", async (req, res) => {
    const token = req.strava_token;
    let subscriptionId = null;
    if (token) {
      const response = await request({
        url: "https://www.strava.com/api/v3/push_subscriptions",
        method: "get",
        searchParams: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
        },
      });
      subscriptionId = response?.[0]?.id;
    }

    const html = nunjucks.renderString(indexTemplate, {
      extensionUrl,
      oauthUrl,
      token,
      subscriptionId,
    });
    return res.send(html);
  });

  // ACTIVITIES

  // List recent activities
  router.get("/list", async (req, res) => {
    const token = req.strava_token;
    const activities = await got(`https://www.strava.com/api/v3/activities`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).json();
    const updated = req.query.updated ? Number(req.query.updated) : null;
    const html = nunjucks.renderString(listTemplate, {
      extensionUrl,
      activities,
      updated,
    });
    return res.send(html);
  });

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
    return res.redirect(`${listUrl}?updated=${req.params.id}`);
  });

  // SUBSCRIPTION

  // Initialise subscription query
  router.get("/subscription/create", async (req, res) => {
    webhookVerifyToken = crypto.randomBytes(64).toString("utf-8");
    console.log(
      await request({
        url: "https://www.strava.com/api/v3/push_subscriptions",
        method: "post",
        json: {
          callback_url: webhookUrl,
          verify_token: webhookVerifyToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        },
      })
    );
    res.redirect(extensionUrl);
  });

  // View subscription
  router.get("/subscription", async (req, res) => {
    return res.json(
      await request({
        url: "https://www.strava.com/api/v3/push_subscriptions",
        method: "get",
        searchParams: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
        },
      })
    );
  });

  // Delete subscription
  router.get("/subscription/delete", async (req, res) => {
    const id = req.query.id;
    console.log(
      await request({
        url: `https://www.strava.com/api/v3/push_subscriptions/${id}`,
        method: "delete",
        searchParams: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
        },
      })
    );
    res.redirect(extensionUrl);
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
      console.log("Athlete auth failed");
      return res.sendStatus(400);
    }
    console.log("Athlete authed");
    setToken(req, response);
    res.redirect(extensionUrl);
  });
}
