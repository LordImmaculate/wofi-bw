import { execSync } from "child_process";
import * as fs from "fs/promises";

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

type History = {
  id: string;
  mode: string;
  last_used: string;
};

const modes = ["username", "password", "totp", "uri", "delete-history"];
const historyPath = `${process.env.HOME}/.cache/wofi-bw/history.json`;

const historyContent = await fs
  .readFile(historyPath)
  .then((buf) => buf.toString())
  .catch(() => {
    modes.splice(modes.indexOf("delete-history"), 1);
  });

let history: History = historyContent
  ? JSON.parse(historyContent)
  : { last_used: new Date(0) };

let mode = process.argv[2];

if (!mode || !modes.includes(mode)) {
  mode = askMode();
}

let expired = new Date(history.last_used).getTime() < Date.now() - 60 * 1000;

let app: { id: string; display: string } | undefined = { id: "", display: "" };

if (mode === "delete-history") {
  fs.unlink(historyPath);
  execSync(`notify-send "wofi-bw" "History deleted."`);
  expired = true;
  modes.splice(modes.indexOf("delete-history"), 1);
  mode = askMode();
}

if (expired) {
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

  app = loginsDisplay.find((login) => login.display === appDisplay);

  if (!app) {
    execSync(`notify-send "Bitwarden" "No login selected."`);
    process.exit(0);
  }
} else app.id = history.id;
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
execSync(
  `notify-send "bw-wofi" "${
    !expired ? "Recent " : null
  }${mode} copied to clipboard" -h string:x-dunst-stack-tag:wofi-bw`
);

history = {
  id: app.id,
  mode,
  last_used: new Date().toISOString()
};

fs.mkdir(`${process.env.HOME}/.cache/wofi-bw`, { recursive: true }).catch(
  (err) => {
    console.error("Error creating cache directory:", err);
  }
);

fs.writeFile(historyPath, JSON.stringify(history, null, 2)).catch((err) => {
  console.error("Error writing history:", err);
});

function askMode() {
  const modeList = modes.join("\n");

  return execSync(`wofi --dmenu -p "Select mode..."`, {
    input: modeList,
    encoding: "utf-8"
  }).trim();
}
