import { execSync } from "child_process";

type LoginData = {
  id: string;
  folder: string | null;
  name: string;
  data: {
    username: string;
    password: string;
    totp: string;
    uris: Uri[];
  };
  fields: any[]; // could refine if structure is known
  notes: string | null;
  history: {
    last_used_date: string; // ISO 8601 format
    password: string;
  }[];
};

type Uri = {
  uri: string;
  match_type: string | null;
};

const modes = ["username", "password", "totp", "uri"];

let mode = process.argv[2];

if (!modes.includes(mode)) {
  const modeList = modes.join("\n");
  mode = execSync(`wofi --dmenu -p "Select mode..."`, {
    input: modeList,
    encoding: "utf-8"
  }).trim();
}

const logins = execSync("rbw list --fields=id,user,name", {
  encoding: "utf-8"
});

const loginsList = logins.split("\n").map((line) => {
  const [id, user = "", name = ""] = line.split("\t");
  return { id, user, name };
});

if (loginsList.length === 0) {
  execSync(`notify-send "Bitwarden" "No logins found."`);
  process.exit(0);
}

const loginsDisplay = loginsList.map((login) => {
  if (!login.user) return { id: login.id, display: login.name };
  if (!login.name) return { id: login.id, display: login.user };
  return { id: login.id, display: `${login.name} - ${login.user}` };
});

const appDisplay = execSync(`wofi --dmenu -p "Select login..."`, {
  input: loginsDisplay.map((login) => login.display).join("\n"),
  encoding: "utf-8"
}).trim();

const app = loginsDisplay.find((login) => login.display === appDisplay);

if (!app) {
  execSync(`notify-send "Bitwarden" "No login selected."`);
  process.exit(0);
}

const login = execSync(`rbw get --raw "${app.id}"`, { encoding: "utf-8" });
const loginData: LoginData = JSON.parse(login);

let output = "";

switch (mode) {
  case "username":
    output = loginData.data.username || "";
    break;
  case "password":
    output = loginData.data.password || "";
    break;
  case "totp":
    output = loginData.data.totp || "";
    break;
  case "uri":
    output = loginData.data.uris[0].uri || "";
    break;
}

execSync(`wl-copy "${output}"`);
execSync(`notify-send "Bitwarden" "${mode} copied to clipboard"`);
