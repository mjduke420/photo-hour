declare module "tz-lookup" {
  /** Returns the IANA time zone name for a latitude/longitude. */
  export default function tzlookup(lat: number, lon: number): string;
}
