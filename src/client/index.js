import got from "got";
import getFull from "./full";
import { Readable } from "stream";
import nunjucks from "nunjucks";

import indexTemplate from "./views/index.njk";
import listTemplate from "./views/list.njk";

const config = require("./config.js");

const auth_redirect_url = `${config.directus_url}/custom/strava/auth`;
const webhook_callback_url = `${config.directus_url}/custom/strava/webhook`;
const oauthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.auth_client_id}&response_type=code&redirect_uri=${auth_redirect_url}&approval_prompt=force&scope=activity:read_all`;

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
  const { ItemsService, FilesService } = services;

  const getToken = async () => {
    const schema = await getSchema();
    const metaService = new ItemsService("meta", { schema });
    const result = await metaService.readOne("strava_token", { fields: ["*"] });
    let token = result.data;
    if (!token) {
      return null;
    }
    // Check token
    const time = Math.round(Date.now() / 1000);
    if (token.expires_at - time <= 3600) {
      const token = await got
        .get(`${config.auth_proxy_url}/refresh`, {
          searchParams: { refresh_token: token.refresh_token },
        })
        .json();
      await setToken(token);
    }
    return token;
  };

  const setToken = async (data) => {
    const schema = await getSchema();
    const metaService = new ItemsService("meta", { schema });
    await metaService.upsertOne({ key: "strava_token", data });
    if (data.athlete) {
      await metaService.upsertOne({
        key: "strava_athlete",
        data: data.athlete,
      });
    }
    return data;
  };

  const getActivity = async (activityId) => {
    const schema = await getSchema();
    const rowService = new ItemsService(config.tableName, { schema });
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
    let token = await getToken();
    const data = await got(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    ).json();

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
      ...config.mapActivityToRow(data),
      files: newFileKey ? [{ directus_files_id: newFileKey }] : [],
      notes: notes,
    });
    console.log("Updated activity: " + key);
  };

  // Index page
  router.get("/", async (req, res, next) => {
    const token = await getToken();

    let subscriptionId = null;
    if (token) {
      const response = await request({
        url: `${config.auth_proxy_url}/subscription`,
        method: "get",
      });
      subscriptionId = response?.[0]?.id;
    }

    const html = nunjucks.renderString(indexTemplate, {
      oauthUrl,
      token,
      subscriptionId,
    });
    return res.send(html);
  });

  // ACTIVITIES

  // List recent activities
  router.get("/list", async (req, res) => {
    const token = await getToken();
    const activities = await got(`https://www.strava.com/api/v3/activities`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }).json();
    const updated = req.query.updated;
    const html = nunjucks.renderString(listTemplate, { activities, updated });
    return res.send(html);
  });

  // View json for a single activity
  router.get("/view/:id", async (req, res) => {
    let token = await getToken();
    const data = await got(
      `https://www.strava.com/api/v3/activities/${req.params.id}`,
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    ).json();
    return res.send(data);
  });

  // Trigger a fetch to directus db of one activity
  router.get("/fetch/:id", async (req, res) => {
    await getActivity(req.params.id);
    return res.redirect(`/custom/strava/list?updated=${req.params.id}`);
  });

  // WEBHOOKS

  // Respond to activity event
  router.post("/webhook", async (req, res) => {
    res.status(200).send("EVENT_RECEIVED");
    const body = req.body;
    const type = body.aspect_type;
    const objectType = body.object_type;
    const ownerId = body.owner_id;
    const activityId = body.object_id;
    console.log("Strava activity received: " + type + " " + activityId);

    if (
      (type === "create" || type === "update") &&
      objectType === "activity" &&
      ownerId === config.athlete_id
    ) {
      getActivity(activityId);
    }
  });

  // Respond to webhook setup test
  router.get("/webhook", (req, res) => {
    let mode = req.query["hub.mode"];
    let token = req.query["hub.verify_token"];
    let challenge = req.query["hub.challenge"];
    if (mode && token) {
      if (mode === "subscribe" && token === config.verify_token) {
        return res.json({ "hub.challenge": challenge });
      } else {
        return res.sendStatus(403);
      }
    }
    return res.sendStatus(400);
  });

  // SUBSCRIPTION

  // Initialise subscription query
  router.get("/subscription/create", async (req, res) => {
    return res.json(
      await request({
        url: `${config.auth_proxy_url}/subscription`,
        method: "post",
        searchParams: {
          callback_url: webhook_callback_url,
          verify_token: config.verify_token,
        },
      })
    );
  });

  // View subscription
  router.get("/subscription", async (req, res) => {
    return res.json(
      await request({
        url: `${config.auth_proxy_url}/subscription`,
        method: "get",
      })
    );
  });

  // Delete subscription
  router.get("/subscription/delete", async (req, res) => {
    const id = req.query.id;
    return res.json(
      await request({
        url: `${config.auth_proxy_url}/subscription`,
        method: "delete",
        searchParams: {
          id,
        },
      })
    );
  });

  // Auth an athlete
  router.get("/auth", async (req, res) => {
    let code = req.query.code;
    if (!code) {
      return res.send(`<a href="${oauthUrl}">Click Here To Authenticate</a>`);
    }
    const response = await got
      .get(`${config.auth_proxy_url}/auth`, {
        searchParams: {
          code,
        },
      })
      .json();
    if (response.errors) {
      console.log("Athlete auth failed");
      return res.sendStatus(400);
    }
    console.log("Athlete authed");
    setToken(response);
    res.sendStatus(200);
  });
}
