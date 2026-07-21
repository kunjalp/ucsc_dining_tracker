export const getURL = () => {
  let url =
    process?.env?.NEXT_PUBLIC_SITE_URL ?? // https://ucsc-dining-tracker.vercel.app
    process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Set by Vercel
    'http://localhost:3000/'; // Fallback for local testing

  // Include http/https protocol if missing
  url = url.startsWith('http') ? url : `https://${url}`;
  // Ensure trailing slash
  url = url.endsWith('/') ? url : `${url}/`;
  return url;
};