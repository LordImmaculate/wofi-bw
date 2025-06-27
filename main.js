#!/usr/bin/bun
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var child_process_1 = require("child_process");
var fs = require("fs/promises");
var modes = ["username", "password", "totp", "uri", "delete-history"];
var historyPath = "".concat(process.env.HOME, "/.cache/wofi-bw/history.json");
var historyContent = await fs
    .readFile(historyPath)
    .then(function (buf) { return buf.toString(); })
    .catch(function () {
    modes.splice(modes.indexOf("delete-history"), 1);
});
var history = historyContent
    ? JSON.parse(historyContent)
    : { last_used: new Date(0) };
var mode = process.argv[2];
if (!mode || !modes.includes(mode)) {
    mode = askMode();
}
var expired = new Date(history.last_used).getTime() < Date.now() - 60 * 1000;
var app = { id: "", display: "" };
if (mode === "delete-history") {
    fs.unlink(historyPath);
    (0, child_process_1.execSync)("notify-send \"wofi-bw\" \"History deleted.\"");
    expired = true;
    modes.splice(modes.indexOf("delete-history"), 1);
    mode = askMode();
}
if (expired) {
    var logins = (0, child_process_1.execSync)("rbw list --fields=id,user,name", {
        encoding: "utf-8"
    });
    var loginsList = logins.split("\n").map(function (line) {
        var _a = line.split("\t"), id = _a[0], _b = _a[1], user = _b === void 0 ? "" : _b, _c = _a[2], name = _c === void 0 ? "" : _c;
        return { id: id, user: user, name: name };
    });
    if (loginsList.length === 0) {
        (0, child_process_1.execSync)("notify-send \"Bitwarden\" \"No logins found.\"");
        process.exit(0);
    }
    var loginsDisplay = loginsList.map(function (login) {
        if (!login.user)
            return { id: login.id, display: login.name };
        if (!login.name)
            return { id: login.id, display: login.user };
        return { id: login.id, display: "".concat(login.name, " - ").concat(login.user) };
    });
    var appDisplay_1 = (0, child_process_1.execSync)("wofi --dmenu -p \"Select login...\"", {
        input: loginsDisplay.map(function (login) { return login.display; }).join("\n"),
        encoding: "utf-8"
    }).trim();
    app = loginsDisplay.find(function (login) { return login.display === appDisplay_1; });
    if (!app) {
        (0, child_process_1.execSync)("notify-send \"Bitwarden\" \"No login selected.\"");
        process.exit(0);
    }
}
else
    app.id = history.id;
var login = (0, child_process_1.execSync)("rbw get --raw \"".concat(app.id, "\""), { encoding: "utf-8" });
var loginData = JSON.parse(login);
var output = "";
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
(0, child_process_1.execSync)("wl-copy \"".concat(output, "\""));
(0, child_process_1.execSync)("notify-send \"bw-wofi\" \"".concat(!expired ? "Recent " : null).concat(mode, " copied to clipboard\" -h string:x-dunst-stack-tag:wofi-bw"));
history = {
    id: app.id,
    mode: mode,
    last_used: new Date().toISOString()
};
fs.mkdir("".concat(process.env.HOME, "/.cache/wofi-bw"), { recursive: true }).catch(function (err) {
    console.error("Error creating cache directory:", err);
});
fs.writeFile(historyPath, JSON.stringify(history, null, 2)).catch(function (err) {
    console.error("Error writing history:", err);
});
function askMode() {
    var modeList = modes.join("\n");
    return (0, child_process_1.execSync)("wofi --dmenu -p \"Select mode...\"", {
        input: modeList,
        encoding: "utf-8"
    }).trim();
}
