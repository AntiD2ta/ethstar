package auth

// StarOAuthCookieName is the cookie name used for CSRF state in the
// starring-specific classic OAuth flow.
const StarOAuthCookieName = "star_oauth_state"

// StarSuccessHTML is the HTML page returned in the popup after a successful
// token exchange. It posts the token to the opener window via postMessage
// and closes itself.
//
// It expects two format arguments:
//   1. The JSON-encoded access token (from json.Marshal — includes quotes).
//   2. The target origin for postMessage (html-escaped BaseURL).
const StarSuccessHTML = `<!DOCTYPE html>
<html><head><title>Ethstar — Authorizing</title></head>
<body>
<p>Authorization successful. This window will close automatically.</p>
<script>
if (window.opener) {
  window.opener.postMessage({type: 'ethstar-star-token', access_token: %s}, '%s');
}
window.close();
</script>
</body></html>`

// StarErrorHTML is the HTML page returned in the popup when token exchange
// fails. The error message is displayed in HTML body context.
//
// It expects one format argument: the html-escaped error message.
const StarErrorHTML = `<!DOCTYPE html>
<html><head><title>Ethstar — Error</title></head>
<body>
<p>Authorization failed: %s</p>
<p><button onclick="window.close()">Close</button></p>
</body></html>`
