import got from "got";
import express from "express";

const app = express();
const port = process.env.PORT || 3000;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

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

app.get("/", async (req, res, next) => {
  res.json(200);
});

// Create subscription
app.post("/subscription", async (req, res) => {
  const callback_url = req.query.callback_url;
  const verify_token = req.query.verify_token;
  console.log(callback_url, verify_token);
  return res.json(
    await request({
      url: "https://www.strava.com/api/v3/push_subscriptions",
      method: "post",
      json: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        callback_url,
        verify_token,
      },
    })
  );
});

// View subscription
app.get("/subscription", async (req, res) => {
  return res.json(
    await request({
      url: "https://www.strava.com/api/v3/push_subscriptions",
      method: "get",
      searchParams: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    })
  );
});

// Delete subscription
app.delete("/subscription", async (req, res) => {
  const id = req.query.id;
  return res.json(
    await request({
      url: `https://www.strava.com/api/v3/push_subscriptions/${id}`,
      method: "delete",
      searchParams: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
    })
  );
});

// Auth an athlete
app.get("/auth", async (req, res) => {
  let code = req.query["code"];
  if (!code) {
    console.log("No auth code present");
    return res.sendStatus(400);
  }
  return res.json(
    await request({
      url: "https://www.strava.com/oauth/token",
      method: "post",
      json: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      },
    })
  );
});

// Refresh a token
app.get("/refresh", async (req, res) => {
  const refresh_token = req.query.refresh_token;
  if (!refresh_token) {
    console.log("No refresh_token present");
    return res.sendStatus(400);
  }
  return res.json(
    await request({
      url: "https://www.strava.com/oauth/token",
      method: "post",
      json: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token,
        grant_type: "refresh_token",
      },
    })
  );
});

app.listen(port, "0.0.0.0", () => {
  console.log(`App listening at http://0.0.0.0:${port}`);
});
