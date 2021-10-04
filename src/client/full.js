import got from "got";
import FormData from "form-data";
import Cookie from "tough-cookie";
import { parse } from "node-html-parser";

const paramRe = /.*csrf-param.*content="(.*)"/;
const tokenRe = /.*csrf-token.*content="(.*)"/;

const config = require("./config.js");

export default async (activityId) => {
  if (!config.athleteEmail || !config.athletePassword) {
    return { gpx: null, notes: "" };
  }

  console.log("Getting full activity");

  const loginPage = await got("https://www.strava.com/login");
  const csrfParam = loginPage.body.match(paramRe)[1];
  const csrfToken = loginPage.body.match(tokenRe)[1];

  const cookieJar = new Cookie.CookieJar();
  let cookies = [];
  cookies = loginPage.headers["set-cookie"].map(Cookie.parse);
  cookies.forEach((cookie) => {
    cookieJar.setCookieSync(cookie, "https://strava.com");
  });

  const form = new FormData();
  form.append("email", config.athleteEmail);
  form.append("password", config.athletePassword);
  form.append("remember_me", "on");
  form.append("utf-8", "✓");
  form.append("plan", "");
  form.append(csrfParam, csrfToken);

  const login = await got.post("https://www.strava.com/session", {
    body: form,
    followRedirect: false,
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 Safari/537.36",
      referer:
        "https://www.strava.com/login?cta=log-in&element=global-header&source=registers_show",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    },
    cookieJar,
  });

  cookies = login.headers["set-cookie"].map(Cookie.parse);

  cookies.forEach((cookie) => {
    cookieJar.setCookieSync(cookie, "https://strava.com");
  });

  let gpx = await got(
    `https://www.strava.com/activities/${activityId}/export_gpx`,
    {
      cookieJar,
    }
  );
  if (gpx.body.includes("Sorry, this file can not be exported")) {
    gpx = null;
  }

  let html = await got(`https://www.strava.com/activities/${activityId}`, {
    cookieJar,
  });

  const root = parse(html.body);
  const notesHTML = root.querySelector(".private-note-js .content");
  return { gpx: gpx?.body || null, notes: notesHTML?.text || "" };
};
