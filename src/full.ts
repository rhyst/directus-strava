import type { Config } from "./types";
import Cookie from "tough-cookie";
import FormData from "form-data";
import got from "got";
import { parse } from "node-html-parser";

const paramRe = /.*csrf-param.*content="(.*)"/;
const tokenRe = /.*csrf-token.*content="(.*)"/;

export default async (
  config: Config,
  activityId: number
): Promise<{ gpx: string | null; notes: string } | null> => {
  try {
    if (!config.athleteEmail || !config.athletePassword) {
      return { gpx: null, notes: "" };
    }

    console.log("Getting full activity");

    const loginPage = (await got(
      "https://www.strava.com/login"
    )) as unknown as { body: string; headers: { "set-cookie": string[] } };
    const csrfParam = loginPage.body.match(paramRe)![1]!;
    const csrfToken = loginPage.body.match(tokenRe)![1]!;

    const cookieJar = new Cookie.CookieJar();
    let cookies = [];
    cookies =
      loginPage?.headers["set-cookie"]?.map((setCookie) =>
        Cookie.parse(setCookie)
      ) || [];
    if (!cookies.length) {
      console.log("No cookies found in login page");
      return null;
    }

    cookies.forEach(
      (cookie) =>
        cookie && cookieJar.setCookieSync(cookie, "https://strava.com")
    );

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

    cookies =
      login?.headers["set-cookie"]?.map((setCookie) =>
        Cookie.parse(setCookie)
      ) || [];

    cookies.forEach(
      (cookie) =>
        cookie && cookieJar.setCookieSync(cookie, "https://strava.com")
    );

    let gpx: string | null =
      (
        await got(
          `https://www.strava.com/activities/${activityId}/export_gpx`,
          {
            cookieJar,
          }
        )
      )?.body || null;
    if (gpx && gpx.includes("Sorry, this file can not be exported")) {
      gpx = null;
    }

    let html = await got(`https://www.strava.com/activities/${activityId}`, {
      cookieJar,
    });

    const root = parse(html.body);
    const notesHTML = root.querySelector(".private-note-js .content");
    return { gpx, notes: notesHTML?.text || "" };
  } catch (e) {
    console.error(e);
    return null;
  }
};
