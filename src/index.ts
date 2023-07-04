import type { Activity, Config, StravaRequest, StravaToken } from "./types";
import got, { RequestError as GotError, OptionsInit as GotOptions } from "got";

import { Readable } from "stream";
import cookieParser from "cookie-parser";
import { defineEndpoint } from "@directus/extensions-sdk";
import { dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import getFull from "./full";
import indexTemplate from "./views/index.njk";
import { json } from "express";
import nunjucks from "nunjucks";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Make a request and return the response
const request = async (options: GotOptions): Promise<unknown> => {
  try {
    const jsonOptions: GotOptions = {
      resolveBodyOnly: true,
      responseType: "json",
      ...options,
    };
    return got(jsonOptions);
  } catch (e) {
    if (e instanceof GotError) {
      console.log(e.response?.body);
      return e.response?.body;
    }
  }
  return null;
};

export default defineEndpoint(
  async (router, { services, getSchema, database }) => {
    const config = (await import(__dirname + "/config.js"))
      .default as unknown as Config;

    const extensionUrl = `${config.directusUrl}/${config.extensionName}`;
    const authUrl = `${extensionUrl}/auth`;
    const oauthUrl = `https://www.strava.com/oauth/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${authUrl}&approval_prompt=force&scope=activity:read_all`;
    const tokenJSONPath = path.join(__dirname, "strava.json");

    const log = (text: string, object?: any, emoji: string = "📜") => {
      const upperText =
        text?.length > 0 ? `${text[0]!.toUpperCase()}${text.slice(1)}` : "";
      const now = new Date();
      console.log(
        `${("0" + now.getHours()).slice(-2)}:${("0" + now.getMinutes()).slice(
          -2
        )}:${("0" + now.getSeconds()).slice(-2)} ${emoji} ${upperText}`
      );
      if (object) {
        console.log(object);
      }
    };

    log("Starting Strava Directus Extension", null, "🚀");

    const { ItemsService, FilesService, AuthenticationService } = services;

    router.use(cookieParser());
    router.use(json());

    // STRAVA AUTHENTICATION
    // check for all routes

    const setToken = (req: StravaRequest, data: StravaToken) => {
      const tokenJSON = JSON.stringify(data);
      fs.writeFileSync(tokenJSONPath, tokenJSON, { encoding: "utf-8" });
      req.strava_token = data;
    };

    // Get strava token if it exists
    router.use(async (req, _, next) => {
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
        setToken(req as unknown as StravaRequest, token);
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
            `${config.directusUrl}/admin/login?redirect=/${config.directusUrl}/${config.extensionName}`
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
            `${config.directusUrl}/admin/login?redirect=/${config.directusUrl}/${config.extensionName}`
          );
        }
      }
      return next();
    });

    const getActivity = async (req: StravaRequest, activityId: number) => {
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
      const results = (await database.raw(
        `select id, data from ${config.collection} where data like '%"id":${activityId}%';`
      )) as unknown as { id: number; data: string }[];
      const result = results.find(
        (r) => `${JSON.parse(r.data).id}` === `${activityId}`
      );
      const id = result?.id || null;
      const hydratedResult = id
        ? await rowService.readOne(id, {
            fields: ["files.directus_files_id.id"],
          })
        : null;
      const fileKey =
        hydratedResult?.files?.[0]?.directus_files_id?.id || undefined;

      // Get Activity
      const token = req.strava_token;
      const data = (await got(
        `https://www.strava.com/api/v3/activities/${activityId}`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      ).json()) as Activity;

      // Get things not available in the API
      const full = await getFull(config, activityId);
      if (!full) {
        return;
      }
      const { notes, gpx } = full;
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
      return true;
    };

    // Index page
    router.get("/", async (req, res) => {
      const token = (req as unknown as StravaRequest).strava_token;
      let activities: Activity[] = [];
      let updated = null;
      let failed = null;
      if (token) {
        activities = (await got(`https://www.strava.com/api/v3/activities`, {
          headers: { Authorization: `Bearer ${token.access_token}` },
        }).json()) as Activity[];
        updated = req.query.updated ? Number(req.query.updated) : null;
        failed = req.query.failed ? Number(req.query.failed) : null;
      }

      const html = nunjucks.renderString(indexTemplate, {
        extensionUrl,
        oauthUrl,
        token,
        activities,
        updated,
        failed,
      });
      return res.send(html);
    });

    // ACTIVITIES

    // View json for a single activity
    router.get("/view/:id", async (req, res) => {
      const token = (req as unknown as StravaRequest).strava_token;
      const data = await got(
        `https://www.strava.com/api/v3/activities/${req.params.id}`,
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      ).json();
      return res.send(data);
    });

    // Trigger a fetch to directus db of one activity
    router.get("/fetch/:id", async (req, res) => {
      const success = await getActivity(
        req as unknown as StravaRequest,
        parseInt(req.params.id, 10)
      );
      if (success) {
        return res.redirect(`${extensionUrl}?updated=${req.params.id}`);
      }
      return res.redirect(`${extensionUrl}?failed=${req.params.id}`);
    });

    // Auth an athlete
    router.get("/auth", async (req, res) => {
      let code = req.query.code;
      if (!code) {
        return res.send(`<a href="${oauthUrl}">Click Here To Authenticate</a>`);
      }
      const response = (await request({
        url: "https://www.strava.com/oauth/token",
        method: "post",
        json: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: "authorization_code",
        },
      })) as StravaToken;
      if (response.errors) {
        log("Athlete auth failed");
        return res.sendStatus(400);
      }
      log("Athlete authed");
      setToken(req as unknown as StravaRequest, response);
      return res.redirect(extensionUrl);
    });
  }
);
