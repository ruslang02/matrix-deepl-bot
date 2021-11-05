const {
    MatrixClient,
    SimpleFsStorageProvider,
    AutojoinRoomsMixin,
    RichReply,
} = require("matrix-bot-sdk");
require('isomorphic-fetch');

const translate = function (text, sourceLang = "auto", targetLang) {
    return new Promise(async (resolve, reject) => {
        targetLang = targetLang.toUpperCase()

        fetch("https://www2.deepl.com/jsonrpc?method=LMT_handle_jobs", {
            "headers": {
                "accept": "*/*",
                "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
                "content-type": "application/json",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "sec-gpc": "1"
            },
            "referrer": "https://www.deepl.com/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": "{\"jsonrpc\":\"2.0\",\"method\": \"LMT_handle_jobs\",\"params\":{\"jobs\":[{\"kind\":\"default\",\"raw_en_sentence\":\"" + text + "\",\"raw_en_context_before\":[],\"raw_en_context_after\":[],\"preferred_num_beams\":4,\"quality\":\"fast\"}],\"lang\":{\"preference\":{\"weight\":{\"DE\":0,\"EN\":0,\"ES\":0,\"FR\":0,\"IT\":0,\"JA\":0,\"NL\":0,\"PL\":0,\"PT\":0,\"RU\":0,\"ZH\":0,\"BG\":0,\"CS\":0,\"DA\":0,\"EL\":0,\"ET\":0,\"FI\":0,\"HU\":0,\"LT\":0,\"LV\":0,\"RO\":0,\"SK\":0,\"SL\":0,\"SV\":0},\"default\":\"default\"},\"source_lang_user_selected\":\"" + sourceLang + "\",\"target_lang\":\"" + targetLang + "\"},\"priority\":-1,\"timestamp\":" + Date.now() + "},\"id\":" + Math.random() * 13 + "}",
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        }).then(r => r.json()).then((json) => {
            if (json.error) {
                reject(json.error.message)
                return
            }
            var detectedLanguage = "unsupported"
            var detectedLanguageIndice = 0
            Object.keys(json.result.detectedLanguages).forEach(function (key) {
                let indice = json.result.detectedLanguages[key]
                if (indice > detectedLanguageIndice) {
                    detectedLanguage = key
                    detectedLanguageIndice = indice
                }
            })
            resolve({
                resultText: json.result.translations[0].beams[0].postprocessed_sentence,
                allResults: json.result.translations[0].beams.map(r => r.postprocessed_sentence),
                detectedLanguage,
                detectedLanguageIndice,
                detectedLanguages: json.result.detectedLanguages,
                targetLang: json.result.target_lang,
                sourceLang: json.result.source_lang
            })
        }).catch(reject)
    })
}

const homeserverUrl = process.env.HOMESERVER_URL || "https://matrix.prg";
const accessToken = process.env.ACCESS_TOKEN || "";

const storage = new SimpleFsStorageProvider("hello-bot.json");

const client = new MatrixClient(homeserverUrl, accessToken, storage);
AutojoinRoomsMixin.setupOnClient(client);

client.on("room.message", handleCommand);
client.start().then(() => console.log("Client started!")).catch(error => {
    console.error(error);
    process.exit(1);
});

async function handleCommand(roomId, event) {
    if (!event["content"]) return;
    if (event["content"]["msgtype"] !== "m.text") return;
    if (event["sender"] === await client.getUserId()) return;

    console.log("Received message", event);

    const body = event["content"]["body"];
    if (!body) return;

    function sendMessage(replyBody) {
        const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
        reply["msgtype"] = "m.notice";
        client.sendMessage(roomId, reply);
    }

    translate(body, "auto", "EN").then(result => {
        if (result.resultText) {
            sendMessage(result.resultText)
        } else sendMessage("Could not get the result text.")
    }).catch(console.error)
}
