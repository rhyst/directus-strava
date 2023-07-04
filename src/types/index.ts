export type ActivityType = "Ride" | "Run" | "Hike";

export type Activity = {
  name: string;
  type: ActivityType;
  start_date: string;
  start_latitude: number;
  start_longitude: number;
  location_country: string;
  description: string;
  id: number;
};

export type Config = {
  clientId: number;
  clientSecret: string;
  athleteEmail: string;
  athletePassword: string;
  webhookSecret: string;
  directusAuth: boolean;
  directusUrl: string;
  extensionName: string;
  collection: string;
  mapActivityToItem: (data: Activity) => {
    date: string;
    country: string;
    activity: string;
    description: string;
    links: { link: string }[];
    name: string;
    latitude: number;
    longitude: number;
    data: any;
  };
};

export interface StravaToken {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    expires_in: number;
    token_type: string;
    errors?: any[];
}

export interface StravaRequest extends Request {
    strava_token: StravaToken
}